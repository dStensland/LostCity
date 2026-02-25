#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Add boundary polygons for the 5 config neighborhoods that don't have
 * official City of Atlanta boundaries:
 *
 * 1. Decatur — city boundary from DeKalb County GIS
 * 2. Little Five Points — custom polygon around commercial core
 * 3. Toco Hills — custom polygon around shopping/residential area
 * 4. Armour — custom polygon around Armour/Ottley industrial district
 * 5. Glenwood Park — custom polygon around the development
 *
 * Usage:
 *   node scripts/add-missing-boundaries.js
 */

const fs = require("fs");
const path = require("path");

const DEKALB_MUNI_URL =
  "https://dcgis.dekalbcountyga.gov/hosted/rest/services/MunicipalBoundary/MapServer/0/query" +
  "?where=NAME=%27Decatur%27&outFields=NAME&returnGeometry=true&f=geojson";

// Custom polygon boundaries for areas without official GIS data.
// Defined by major street boundaries that locals would recognize.
const CUSTOM_BOUNDARIES = {
  "Little Five Points": {
    // The commercial district around Moreland/Euclid/McLendon intersection
    // Bounded roughly by: North Ave (N), Moreland Ave (E), DeKalb Ave (S), Sinclair Ave (W)
    type: "Polygon",
    coordinates: [[
      [-84.3520, 33.7690], // NW corner: Sinclair & North Ave area
      [-84.3460, 33.7690], // NE corner: Moreland & North Ave
      [-84.3440, 33.7670], // E: Moreland south of Euclid
      [-84.3440, 33.7620], // SE: Moreland & DeKalb Ave
      [-84.3480, 33.7600], // S: DeKalb Ave west
      [-84.3530, 33.7610], // SW: Seminole Ave area
      [-84.3540, 33.7640], // W: west of Findley/Seminole
      [-84.3520, 33.7690], // close
    ]],
  },
  "Toco Hills": {
    // Residential/commercial area in unincorporated DeKalb around Toco Hills shopping center
    // Bounded roughly by: N Druid Hills Rd (W), LaVista Rd (N), Briarcliff Rd (E), Clairmont Rd (S)
    type: "Polygon",
    coordinates: [[
      [-84.3250, 33.8090], // NW: N Druid Hills & LaVista
      [-84.3100, 33.8090], // NE: LaVista & Briarcliff area
      [-84.3050, 33.8050], // E: Briarcliff south
      [-84.3050, 33.7950], // SE: Clairmont & Briarcliff
      [-84.3150, 33.7920], // S: Clairmont west
      [-84.3280, 33.7930], // SW: N Druid Hills south
      [-84.3280, 33.8000], // W: N Druid Hills
      [-84.3250, 33.8090], // close
    ]],
  },
  "Armour": {
    // Armour/Ottley industrial-turned-commercial district
    // Between Piedmont Rd, railroad tracks, Armour Dr, and Ottley Dr
    type: "Polygon",
    coordinates: [[
      [-84.3700, 33.8200], // NW: Armour Dr & Piedmont area
      [-84.3630, 33.8200], // NE: east of railroad
      [-84.3620, 33.8150], // E: south along tracks
      [-84.3620, 33.8100], // SE: Ottley Dr area
      [-84.3680, 33.8100], // S: back to Piedmont
      [-84.3710, 33.8130], // SW: Piedmont Rd south
      [-84.3710, 33.8170], // W: Piedmont north
      [-84.3700, 33.8200], // close
    ]],
  },
  "Glenwood Park": {
    // New urbanist development bounded by:
    // Glenwood Ave (N), Bill Kennedy Way (E), I-20 (S), Boulevard (W)
    type: "Polygon",
    coordinates: [[
      [-84.3500, 33.7410], // NW: Boulevard & Glenwood
      [-84.3410, 33.7410], // NE: Bill Kennedy & Glenwood
      [-84.3400, 33.7380], // E: south along Bill Kennedy
      [-84.3400, 33.7340], // SE: near I-20
      [-84.3470, 33.7330], // S: along I-20
      [-84.3510, 33.7340], // SW: Boulevard & I-20
      [-84.3510, 33.7380], // W: Boulevard north
      [-84.3500, 33.7410], // close
    ]],
  },
};

function computeCentroid(geometry) {
  let sumLng = 0, sumLat = 0, count = 0;
  const coords = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  for (const poly of coords) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
        count++;
      }
    }
  }
  return [
    Math.round((sumLng / count) * 10000) / 10000,
    Math.round((sumLat / count) * 10000) / 10000,
  ];
}

function roundCoords(coords, precision = 5) {
  if (typeof coords[0] === "number") {
    return coords.map((c) => Math.round(c * 10 ** precision) / 10 ** precision);
  }
  return coords.map((c) => roundCoords(c, precision));
}

async function main() {
  const boundariesPath = path.join(__dirname, "..", "data", "neighborhood-boundaries.json");
  const boundaries = JSON.parse(fs.readFileSync(boundariesPath, "utf-8"));

  const existingNames = new Set(boundaries.features.map((f) => f.properties.name));
  let added = 0;

  // 1. Fetch Decatur from DeKalb County GIS
  console.log("Fetching Decatur boundary from DeKalb County GIS...");
  const response = await fetch(DEKALB_MUNI_URL);
  const decaturGeo = await response.json();

  if (decaturGeo.features && decaturGeo.features.length > 0) {
    const feat = decaturGeo.features[0];
    const geometry = {
      type: feat.geometry.type,
      coordinates: roundCoords(feat.geometry.coordinates),
    };
    if (!existingNames.has("Decatur")) {
      boundaries.features.push({
        type: "Feature",
        properties: {
          name: "Decatur",
          centroid: computeCentroid(geometry),
          acres: 2833, // ~4.4 sq miles
          officialCount: 1,
          npus: "",
          source: "DeKalb County GIS Municipal Boundary",
        },
        geometry,
      });
      added++;
      console.log("  Added Decatur (from DeKalb County GIS)");
    } else {
      console.log("  Decatur already exists, skipping");
    }
  }

  // 2. Add custom boundaries
  for (const [name, geometry] of Object.entries(CUSTOM_BOUNDARIES)) {
    if (existingNames.has(name)) {
      console.log(`  ${name} already exists, skipping`);
      continue;
    }

    const roundedGeometry = {
      type: geometry.type,
      coordinates: roundCoords(geometry.coordinates),
    };

    boundaries.features.push({
      type: "Feature",
      properties: {
        name,
        centroid: computeCentroid(roundedGeometry),
        acres: 0, // custom boundaries, no acreage data
        officialCount: 0,
        npus: "",
        source: "Custom boundary (street-defined)",
      },
      geometry: roundedGeometry,
    });
    added++;
    console.log(`  Added ${name} (custom polygon)`);
  }

  // Sort features alphabetically
  boundaries.features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  // Write
  fs.writeFileSync(boundariesPath, JSON.stringify(boundaries, null, 0).replace(/\n/g, ""));

  // Minify
  const data = JSON.parse(fs.readFileSync(boundariesPath, "utf-8"));
  fs.writeFileSync(boundariesPath, JSON.stringify(data));

  const fileSize = fs.statSync(boundariesPath).size;
  console.log(`\nDone: added ${added} boundaries`);
  console.log(`Total neighborhoods: ${boundaries.features.length}`);
  console.log(`File size: ${(fileSize / 1024).toFixed(0)}KB`);
}

main().catch(console.error);
