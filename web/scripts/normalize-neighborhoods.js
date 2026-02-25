#!/usr/bin/env node
/**
 * Neighborhood data quality pass
 *
 * 1. Apply alias normalization to existing venue neighborhood values
 * 2. Clear junk values (county names, quadrants, "Multiple Locations")
 * 3. Assign neighborhoods to null-neighborhood Atlanta venues using lat/lng proximity
 *
 * Usage:
 *   node scripts/normalize-neighborhoods.js --dry-run    # Preview changes
 *   node scripts/normalize-neighborhoods.js --apply      # Apply changes to DB
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const fs = require("fs");
/* eslint-enable @typescript-eslint/no-require-imports */

// Load polygon boundaries for geo-assignment
const boundariesPath = path.join(__dirname, "..", "data", "neighborhood-boundaries.json");
const boundaries = JSON.parse(fs.readFileSync(boundariesPath, "utf-8"));

// Inline the alias map (avoid TS import issues)
const NEIGHBORHOOD_ALIASES = {
  "Virginia Highland": "Virginia-Highland",
  "virginia highland": "Virginia-Highland",
  "VaHi": "Virginia-Highland",
  "vahi": "Virginia-Highland",
  "Poncey Highland": "Poncey-Highland",
  "poncey highland": "Poncey-Highland",
  "O4W": "Old Fourth Ward",
  "o4w": "Old Fourth Ward",
  "EAV": "East Atlanta Village",
  "eav": "East Atlanta Village",
  "L5P": "Little Five Points",
  "l5p": "Little Five Points",
  "PCM": "Old Fourth Ward",
  "AUC": "Vine City",
  "East Atlanta": "East Atlanta Village",
  "Westside": "West Midtown",
  "West Side": "West Midtown",
  "Upper Westside": "West Midtown",
  "Westside Provisions": "West Midtown",
  "Reynolds Town": "Reynoldstown",
  "Downtown Decatur": "Decatur",
  "Oakhurst": "Decatur",
  "Ponce City Market": "Old Fourth Ward",
  "Ponce City Market Area": "Old Fourth Ward",
  "Krog Street": "Cabbagetown",
  "The Battery": "Cumberland",
  "The Battery / Cumberland": "Cumberland",
  "Georgia Tech": "Midtown",
  "Emory": "Druid Hills",
  "North Druid Hills": "Druid Hills",
  "Briarcliff": "Druid Hills",
  "Buford Highway": "Chamblee",
  "Cheshire Bridge Road": "Cheshire Bridge",
  "Marietta Blvd": "West Midtown",
  "Howell Mill": "West Midtown",
  "Atlanta Buckhead": "Buckhead",
};

// Values that should become null
const JUNK_VALUES = new Set([
  "Atlanta", "Atlanta NE", "Atlanta SE", "Atlanta NW", "Atlanta SW",
  "North Atlanta", "South Atlanta", "Southeast Atlanta", "Southwest Atlanta",
  "Northwest Atlanta", "Northeast Atlanta", "West Atlanta", "East Point",
  "Multiple Locations", "Fulton", "Cobb", "DeKalb", "DeKalb County",
  "Atlanta NE", "Atlanta SE",
]);

// ── Polygon-based geo-assignment (replaces old center+radius haversine) ──

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lng, lat, coords) {
  if (!pointInRing(lng, lat, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) {
    if (pointInRing(lng, lat, coords[i])) return false;
  }
  return true;
}

function pointInMultiPolygon(lng, lat, coords) {
  return coords.some((poly) => pointInPolygon(lng, lat, poly));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestNeighborhood(lat, lng) {
  // Try polygon containment first
  for (const feature of boundaries.features) {
    const geom = feature.geometry;
    const inside = geom.type === "Polygon"
      ? pointInPolygon(lng, lat, geom.coordinates)
      : pointInMultiPolygon(lng, lat, geom.coordinates);
    if (inside) return feature.properties.name;
  }
  // Fallback: closest centroid within 3km
  let closest = null;
  let closestDist = Infinity;
  for (const feature of boundaries.features) {
    const [cLng, cLat] = feature.properties.centroid;
    const dist = haversineKm(lat, lng, cLat, cLng);
    if (dist < closestDist) {
      closestDist = dist;
      closest = feature.properties.name;
    }
  }
  return closestDist <= 3 ? closest : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");

  if (!dryRun && !apply) {
    console.log("Usage: node scripts/normalize-neighborhoods.js --dry-run|--apply");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);

  // ── Phase 1: Alias normalization ──
  console.log("\n=== PHASE 1: Alias normalization ===\n");

  const aliasUpdates = [];
  for (const [from, to] of Object.entries(NEIGHBORHOOD_ALIASES)) {
    const { data, error } = await sb.from("venues")
      .select("id, name, neighborhood")
      .eq("neighborhood", from);

    if (error) { console.error("Error querying:", from, error.message); continue; }
    if (!data || data.length === 0) continue;

    for (const venue of data) {
      aliasUpdates.push({ id: venue.id, name: venue.name, from: venue.neighborhood, to });
    }
  }

  console.log(`Found ${aliasUpdates.length} venues to rename via aliases:`);
  const grouped = {};
  aliasUpdates.forEach(u => {
    const key = `"${u.from}" → "${u.to}"`;
    grouped[key] = (grouped[key] || 0) + 1;
  });
  Object.entries(grouped).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  ${count}\t${key}`);
  });

  // ── Phase 2: Junk value cleanup ──
  console.log("\n=== PHASE 2: Junk value cleanup (set to null) ===\n");

  const junkUpdates = [];
  for (const junk of JUNK_VALUES) {
    const { data, error } = await sb.from("venues")
      .select("id, name, neighborhood")
      .eq("neighborhood", junk);

    if (error) { console.error("Error querying:", junk, error.message); continue; }
    if (!data || data.length === 0) continue;

    for (const venue of data) {
      junkUpdates.push({ id: venue.id, name: venue.name, from: venue.neighborhood });
    }
  }

  console.log(`Found ${junkUpdates.length} venues with junk neighborhood values to clear:`);
  const junkGrouped = {};
  junkUpdates.forEach(u => {
    junkGrouped[u.from] = (junkGrouped[u.from] || 0) + 1;
  });
  Object.entries(junkGrouped).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  ${count}\t"${key}" → null`);
  });

  // ── Phase 3: Geo-assign null-neighborhood Atlanta venues ──
  console.log("\n=== PHASE 3: Geo-assign null-neighborhood Atlanta venues ===\n");

  const { data: nullVenues, error: nullErr } = await sb.from("venues")
    .select("id, name, lat, lng, city")
    .eq("city", "Atlanta")
    .is("neighborhood", null)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (nullErr) {
    console.error("Error fetching null-neighborhood venues:", nullErr.message);
  }

  const geoAssignments = [];
  if (nullVenues) {
    for (const venue of nullVenues) {
      const hood = findNearestNeighborhood(venue.lat, venue.lng);
      if (hood) {
        geoAssignments.push({ id: venue.id, name: venue.name, to: hood });
      }
    }
  }

  console.log(`Found ${nullVenues ? nullVenues.length : 0} null-neighborhood Atlanta venues with coords`);
  console.log(`Can geo-assign ${geoAssignments.length} of them:`);
  const geoGrouped = {};
  geoAssignments.forEach(u => {
    geoGrouped[u.to] = (geoGrouped[u.to] || 0) + 1;
  });
  Object.entries(geoGrouped).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.log(`  ${count}\t→ ${key}`);
  });

  // Also try to geo-assign the junk-cleared venues
  const junkWithCoords = [];
  if (apply || dryRun) {
    const junkIds = junkUpdates.map(u => u.id);
    if (junkIds.length > 0) {
      // Fetch coords for junk venues in batches
      for (let i = 0; i < junkIds.length; i += 100) {
        const batch = junkIds.slice(i, i + 100);
        const { data: coordData } = await sb.from("venues")
          .select("id, name, lat, lng")
          .in("id", batch)
          .not("lat", "is", null)
          .not("lng", "is", null);
        if (coordData) {
          for (const venue of coordData) {
            const hood = findNearestNeighborhood(venue.lat, venue.lng);
            if (hood) {
              junkWithCoords.push({ id: venue.id, name: venue.name, to: hood });
            }
          }
        }
      }
      console.log(`\nOf junk-cleared venues, ${junkWithCoords.length} can be geo-reassigned`);
    }
  }

  // ── Summary ──
  const totalChanges = aliasUpdates.length + junkUpdates.length + geoAssignments.length + junkWithCoords.length;
  console.log(`\n=== SUMMARY ===`);
  console.log(`Alias renames:      ${aliasUpdates.length}`);
  console.log(`Junk cleared:       ${junkUpdates.length}`);
  console.log(`Geo-assigned:       ${geoAssignments.length}`);
  console.log(`Junk re-assigned:   ${junkWithCoords.length}`);
  console.log(`Total changes:      ${totalChanges}`);

  if (dryRun) {
    console.log("\n🔍 DRY RUN — no changes applied. Use --apply to commit.\n");
    return;
  }

  // ── Apply ──
  console.log("\n🔧 Applying changes...\n");

  let applied = 0;
  let errors = 0;

  // Apply alias renames
  for (const update of aliasUpdates) {
    const { error } = await sb.from("venues")
      .update({ neighborhood: update.to })
      .eq("id", update.id);
    if (error) { console.error(`  ✗ ${update.name}: ${error.message}`); errors++; }
    else { applied++; }
  }
  console.log(`  Alias renames: ${applied} applied, ${errors} errors`);

  // Apply junk cleanup — first set to null, then try geo-assign
  let junkApplied = 0;
  let junkErrors = 0;
  for (const update of junkUpdates) {
    // Check if we have a geo-assignment for this venue
    const geoMatch = junkWithCoords.find(g => g.id === update.id);
    const newHood = geoMatch ? geoMatch.to : null;
    const { error } = await sb.from("venues")
      .update({ neighborhood: newHood })
      .eq("id", update.id);
    if (error) { console.error(`  ✗ ${update.name}: ${error.message}`); junkErrors++; }
    else { junkApplied++; }
  }
  console.log(`  Junk cleanup: ${junkApplied} applied, ${junkErrors} errors`);

  // Apply geo-assignments for originally-null venues
  let geoApplied = 0;
  let geoErrors = 0;
  for (const update of geoAssignments) {
    const { error } = await sb.from("venues")
      .update({ neighborhood: update.to })
      .eq("id", update.id);
    if (error) { console.error(`  ✗ ${update.name}: ${error.message}`); geoErrors++; }
    else { geoApplied++; }
  }
  console.log(`  Geo-assignments: ${geoApplied} applied, ${geoErrors} errors`);

  console.log(`\n✅ Done. ${applied + junkApplied + geoApplied} total updates applied.\n`);
}

main().catch(console.error);
