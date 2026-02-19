#!/usr/bin/env node
/**
 * Fetches official Atlanta neighborhood boundaries from the City of Atlanta GIS
 * and merges them according to our rollup mapping into simplified config neighborhoods.
 *
 * Source: City of Atlanta Department of City Planning (CC-BY-SA)
 * API: https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/3
 *
 * Usage:
 *   node scripts/build-neighborhood-boundaries.js
 *
 * Output:
 *   data/neighborhood-boundaries.json
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const API_URL =
  "https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/3/query" +
  "?where=1%3D1&outFields=NAME,NPU,ACRES&f=geojson&resultRecordCount=300";

// Complete rollup: official neighborhood name → our config name
// If an official name is not in this map, it matches a config name directly.
const ROLLUP = {
  // ─── BUCKHEAD (NPU A mansions + NPU B sub-areas + northern NPU C) ───
  "Buckhead Village": "Buckhead",
  "Buckhead Forest": "Buckhead",
  "Buckhead Heights": "Buckhead",
  "North Buckhead": "Buckhead",
  "Pine Hills": "Buckhead",
  "East Chastain Park": "Buckhead",
  "Garden Hills": "Buckhead",
  "Lenox": "Buckhead",
  "Peachtree Park": "Buckhead",
  "South Tuxedo Park": "Buckhead",
  "Peachtree Heights East": "Buckhead",
  "Peachtree Heights West": "Buckhead",
  "Ridgedale Park": "Buckhead",
  "Paces": "Buckhead",
  "Tuxedo Park": "Buckhead",
  "Mt. Paran/Northside": "Buckhead",
  "West Paces Ferry/Northside": "Buckhead",
  "Whitewater Creek": "Buckhead",
  "Mt. Paran Parkway": "Buckhead",
  "Peachtree Battle Alliance": "Buckhead",
  "Brandon": "Buckhead",
  "Castlewood": "Buckhead",
  "Wesley Battle": "Buckhead",

  // ─── CHASTAIN PARK ───
  "Margaret Mitchell": "Chastain Park",
  "Kingswood": "Chastain Park",
  "Pleasant Hill": "Chastain Park",
  "Randall Mill": "Chastain Park",

  // ─── COLLIER HILLS (western NPU C) ───
  "Collier Hills North": "Collier Hills",
  "Argonne Forest": "Collier Hills",
  "Cross Creek": "Collier Hills",
  "Wyngate": "Collier Hills",
  "Springlake": "Collier Hills",
  "Ridgewood Heights": "Collier Hills",
  "Arden/Habersham": "Collier Hills",
  "Channing Valley": "Collier Hills",
  "Fernleaf": "Collier Hills",
  "Westover Plantation": "Collier Hills",
  "Woodfield": "Collier Hills",
  "Wildwood (NPU-C)": "Collier Hills",
  "Westminster/Milmar": "Collier Hills",

  // ─── BROOKWOOD ───
  "Colonial Homes": "Brookwood",
  "Hanover West": "Brookwood",

  // ─── ANSLEY PARK ───
  "Memorial Park": "Ansley Park",

  // ─── MIDTOWN ───
  "Sherwood Forest": "Midtown",
  "Loring Heights": "Midtown",
  "Georgia Tech": "Midtown",
  "Marietta Street Artery": "Midtown",
  "Ardmore": "Midtown",

  // ─── MORNINGSIDE ───
  "Morningside/Lenox Park": "Morningside",
  "Lindridge/Martin Manor": "Morningside",
  "Atkins Park": "Morningside",
  "Edmund Park": "Morningside",

  // ─── CHESHIRE BRIDGE ───
  "Lindbergh/Morosgo": "Cheshire Bridge",

  // ─── DRUID HILLS ───
  "Emory": "Druid Hills",

  // ─── VIRGINIA-HIGHLAND ───
  "Virginia Highland": "Virginia-Highland",

  // ─── WEST MIDTOWN (NPU D) ───
  "Blandtown": "West Midtown",
  "Berkeley Park": "West Midtown",
  "Underwood Hills": "West Midtown",
  "Hills Park": "West Midtown",
  "Riverside": "West Midtown",
  "Whittier Mill Village": "West Midtown",
  "Bolton": "West Midtown",

  // ─── DOWNTOWN ───
  "Capitol Gateway": "Downtown",

  // ─── CASTLEBERRY HILL ───
  "The Villages at Castleberry Hill": "Castleberry Hill",

  // ─── VINE CITY ───
  "Atlanta University Center": "Vine City",

  // ─── EAST ATLANTA VILLAGE ───
  "East Atlanta": "East Atlanta Village",

  // ─── EAST LAKE ───
  "The Villages at East Lake": "East Lake",

  // ─── GRANT PARK ───
  "Chosewood Park": "Grant Park",
  "Woodland Hills": "Grant Park",
  "Oakland": "Grant Park",
  "Benteen Park": "Grant Park",
  "State Facility": "Grant Park",

  // ─── ORMEWOOD PARK ───
  "Custer/McDonough/Guice": "Ormewood Park",

  // ─── WEST END ───
  "Westview": "West End",
  "Ashview Heights": "West End",
  "Harris Chiles": "West End",
  "Just Us": "West End",

  // ─── BANKHEAD ───
  "Bankhead/Bolton": "Bankhead",
  "Bankhead Courts": "Bankhead",
  "Historic Westin Heights/Bankhead": "Bankhead",
  "Knight Park/Howell Station": "Bankhead",

  // ─── GROVE PARK (NPU J) ───
  "Center Hill": "Grove Park",
  "Dixie Hills": "Grove Park",
  "Penelope Neighbors": "Grove Park",
  "West Lake": "Grove Park",
  "Harvel Homes Community": "Grove Park",

  // ─── CASCADE HEIGHTS (NPU I + NPU Q) ───
  "Collier Heights": "Cascade Heights",
  "Beecher Hills": "Cascade Heights",
  "Florida Heights": "Cascade Heights",
  "Harland Terrace": "Cascade Heights",
  "Peyton Forest": "Cascade Heights",
  "Peyton Heights": "Cascade Heights",
  "West Manor": "Cascade Heights",
  "Westhaven": "Cascade Heights",
  "Magnum Manor": "Cascade Heights",
  "Audobon Forest": "Cascade Heights",
  "Audobon Forest West": "Cascade Heights",
  "Green Acres Valley": "Cascade Heights",
  "Green Forest Acres": "Cascade Heights",
  "Chalet Woods": "Cascade Heights",
  "Ivan Hill": "Cascade Heights",
  "East Ardley Road": "Cascade Heights",
  "Horseshoe Community": "Cascade Heights",
  "Westwood Terrace": "Cascade Heights",
  "Midwest Cascade": "Cascade Heights",
  "Regency Trace": "Cascade Heights",

  // ─── SYLVAN HILLS ───
  "Perkerson": "Sylvan Hills",
  "Hammond Park": "Sylvan Hills",

  // ─── CAPITOL VIEW ───
  "Capitol View Manor": "Capitol View",

  // ─── LAKEWOOD ───
  "Lakewood Heights": "Lakewood",

  // ─── WASHINGTON PARK (NPU K) ★ NEW ───
  "Hunter Hills": "Washington Park",
  "Mozley Park": "Washington Park",
  "Washington Park": "Washington Park",

  // ─── OAKLAND CITY (NPU S) ★ NEW ───
  "Oakland City": "Oakland City",
  "Venetian Hills": "Oakland City",
  "Fort McPherson": "Oakland City",
  "Cascade Avenue/Road": "Oakland City",
  "Bush Mountain": "Oakland City",

  // ─── ADAMSVILLE (NPU H) ★ NEW ───
  "Adamsville": "Adamsville",
  "Fairburn Mays": "Adamsville",
  "Boulder Park": "Adamsville",
  "Fairburn Heights": "Adamsville",
  "Carroll Heights": "Adamsville",
  "Mays": "Adamsville",
  "Wilson Mill Meadows": "Adamsville",
  "Baker Hills": "Adamsville",
  "Wildwood (NPU-H)": "Adamsville",
  "Bakers Ferry": "Adamsville",
  "Wisteria Gardens": "Adamsville",
  "Fairburn Road/Wisteria Lane": "Adamsville",
  "Old Gordon": "Adamsville",
  "Ridgecrest Forest": "Adamsville",
  "Oakcliff": "Adamsville",

  // ─── NORTHWEST ATLANTA (NPU G) ★ NEW ───
  "West Highlands": "Northwest Atlanta",
  "Atlanta Industrial Park": "Northwest Atlanta",
  "Rockdale": "Northwest Atlanta",
  "Brookview Heights": "Northwest Atlanta",
  "Almond Park": "Northwest Atlanta",
  "Carey Park": "Northwest Atlanta",
  "Scotts Crossing": "Northwest Atlanta",
  "Monroe Heights": "Northwest Atlanta",
  "Chattahoochee": "Northwest Atlanta",
  "Carver Hills": "Northwest Atlanta",
  "Lincoln Homes": "Northwest Atlanta",
  "English Park": "Northwest Atlanta",
  "Bolton Hills": "Northwest Atlanta",

  // ─── BEN HILL (NPU P) ★ NEW ───
  "Ben Hill": "Ben Hill",
  "Princeton Lakes": "Ben Hill",
  "Kings Forest": "Ben Hill",
  "Niskey Lake": "Ben Hill",
  "Heritage Valley": "Ben Hill",
  "Arlington Estates": "Ben Hill",
  "Ben Hill Terrace": "Ben Hill",
  "Fairburn Tell": "Ben Hill",
  "Butner/Tell": "Ben Hill",
  "Elmco Estates": "Ben Hill",
  "Fairway Acres": "Ben Hill",
  "Deerwood": "Ben Hill",
  "Fairburn": "Ben Hill",
  "Ben Hill Forest": "Ben Hill",
  "Ben Hill Acres": "Ben Hill",
  "Meadowbrook Forest": "Ben Hill",
  "Briar Glen": "Ben Hill",
  "Wildwood Forest": "Ben Hill",
  "Sandlewood Estates": "Ben Hill",
  "Niskey Cove": "Ben Hill",
  "Cascade Green": "Ben Hill",
  "Brentwood": "Ben Hill",
  "Ben Hill Pines": "Ben Hill",
  "Lake Estates": "Ben Hill",
  "Greenbriar Village": "Ben Hill",
  "Ashley Courts": "Ben Hill",
  "Mt. Gilead Woods": "Ben Hill",
  "Huntington": "Ben Hill",
  "Mellwood": "Ben Hill",
  "Rue Royal": "Ben Hill",
  "South Oakes at Cascade": "Ben Hill",
  "Old Fairburn Village": "Ben Hill",
  "Tampa Park": "Ben Hill",

  // ─── GREENBRIAR (NPU R) ★ NEW ───
  "Southwest": "Greenbriar",
  "Greenbriar": "Greenbriar",
  "Adams Park": "Greenbriar",
  "Campbellton Road": "Greenbriar",
  "Baker Hills at Campbellton": "Greenbriar",
  "Laurens Valley": "Greenbriar",
  "Continental Colony": "Greenbriar",
  "Bonnybrook Estates": "Greenbriar",
  "Pomona Park": "Greenbriar",
  "Fort Valley": "Greenbriar",

  // ─── SOUTH ATLANTA (NPU Y) ★ NEW ───
  "South Atlanta": "South Atlanta",
  "The Villages at Carver": "South Atlanta",
  "Joyland": "South Atlanta",
  "Betmar LaVilla": "South Atlanta",
  "High Point": "South Atlanta",
  "Amal Heights": "South Atlanta",

  // ─── SOUTHEAST ATLANTA (NPU Z) ★ NEW ───
  "South River Gardens": "Southeast Atlanta",
  "Glenrose Heights": "Southeast Atlanta",
  "Blair Villa/Poole Creek": "Southeast Atlanta",
  "Browns Mill Park": "Southeast Atlanta",
  "Thomasville Heights": "Southeast Atlanta",
  "Norwood Manor": "Southeast Atlanta",
  "Leila Valley": "Southeast Atlanta",
  "Polar Rock": "Southeast Atlanta",
  "Orchard Knob": "Southeast Atlanta",
  "Rosedale Heights": "Southeast Atlanta",
  "Swallow Circle/Baywood": "Southeast Atlanta",
  "Rebel Valley Forest": "Southeast Atlanta",
};

// Official names that directly match our config (no rollup needed)
const DIRECT_MATCHES = new Set([
  "Adair Park", "Ansley Park", "Atlantic Station", "Boulevard Heights",
  "Brookwood", "Brookwood Hills", "Cabbagetown", "Candler Park",
  "Capitol View", "Cascade Heights", "Castleberry Hill", "Chastain Park",
  "Collier Hills", "Downtown", "Druid Hills", "East Lake", "Edgewood",
  "English Avenue", "Grant Park", "Grove Park", "Home Park", "Inman Park",
  "Kirkwood", "Lake Claire", "Lakewood", "Mechanicsville", "Midtown",
  "Old Fourth Ward", "Ormewood Park", "Peachtree Hills", "Peoplestown",
  "Piedmont Heights", "Pittsburgh", "Poncey-Highland", "Reynoldstown",
  "Summerhill", "Sweet Auburn", "Sylvan Hills", "Vine City", "West End",
]);

// OTP areas (Brookhaven is in official Atlanta data but is OTP in our config)
const OTP_NAMES = new Set(["Brookhaven"]);

function resolveTarget(officialName) {
  if (OTP_NAMES.has(officialName)) return officialName; // keep as-is
  if (DIRECT_MATCHES.has(officialName)) return officialName;
  if (ROLLUP[officialName]) return ROLLUP[officialName];
  return null; // unaccounted
}

/** Normalize a geometry to an array of polygon coordinate arrays */
function toPolygonArray(geometry) {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates;
  }
  return [];
}

async function main() {
  console.log("Fetching official neighborhood boundaries from Atlanta GIS...");

  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const geojson = await response.json();
  const features = geojson.features;
  console.log(`Fetched ${features.length} official neighborhoods`);

  // Group features by target config name
  const groups = {};
  const unaccounted = [];

  for (const feature of features) {
    const name = feature.properties.NAME;
    const target = resolveTarget(name);
    if (!target) {
      unaccounted.push(name);
      continue;
    }
    if (!groups[target]) {
      groups[target] = { polygons: [], officialNames: [], npus: new Set(), totalAcres: 0 };
    }
    groups[target].polygons.push(...toPolygonArray(feature.geometry));
    groups[target].officialNames.push(name);
    groups[target].npus.add(feature.properties.NPU);
    groups[target].totalAcres += feature.properties.ACRES || 0;
  }

  if (unaccounted.length > 0) {
    console.error(`\nWARNING: ${unaccounted.length} unaccounted neighborhoods:`);
    unaccounted.forEach(n => console.error(`  ${n}`));
  }

  // Build merged GeoJSON
  const mergedFeatures = [];
  let totalCoords = 0;

  for (const [name, group] of Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))) {
    // Calculate centroid from all polygon points
    let sumLat = 0, sumLng = 0, count = 0;
    for (const poly of group.polygons) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          sumLng += lng;
          sumLat += lat;
          count++;
        }
      }
    }
    totalCoords += count;

    const geometry = group.polygons.length === 1
      ? { type: "Polygon", coordinates: group.polygons[0] }
      : { type: "MultiPolygon", coordinates: group.polygons };

    mergedFeatures.push({
      type: "Feature",
      properties: {
        name,
        centroid: [
          Math.round((sumLng / count) * 10000) / 10000,
          Math.round((sumLat / count) * 10000) / 10000,
        ],
        acres: Math.round(group.totalAcres),
        officialCount: group.officialNames.length,
        npus: [...group.npus].sort().join(","),
      },
      geometry,
    });
  }

  const output = {
    type: "FeatureCollection",
    metadata: {
      source: "City of Atlanta Department of City Planning",
      sourceUrl: "https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/3",
      license: "CC-BY-SA",
      generated: new Date().toISOString().split("T")[0],
      description: "Official Atlanta neighborhood boundaries merged into LostCity config neighborhoods",
    },
    features: mergedFeatures,
  };

  const outPath = path.join(__dirname, "..", "data", "neighborhood-boundaries.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output));

  // Stats
  const fileSize = fs.statSync(outPath).size;
  console.log(`\nWrote ${mergedFeatures.length} merged neighborhoods to ${outPath}`);
  console.log(`File size: ${(fileSize / 1024).toFixed(0)}KB`);
  console.log(`Total coordinate points: ${totalCoords}`);
  console.log(`Unaccounted: ${unaccounted.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
