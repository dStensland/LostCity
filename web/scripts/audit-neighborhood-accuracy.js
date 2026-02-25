#!/usr/bin/env node
/**
 * Audit neighborhood accuracy: check if venues are actually located
 * in the neighborhood they claim to be in, using official polygon boundaries.
 *
 * Uses merged polygon boundaries from data/neighborhood-boundaries.json
 * (built from City of Atlanta GIS official neighborhood data).
 *
 * Usage:
 *   node scripts/audit-neighborhood-accuracy.js --audit        # Show mismatches
 *   node scripts/audit-neighborhood-accuracy.js --fix-dry-run  # Preview fixes
 *   node scripts/audit-neighborhood-accuracy.js --fix-apply    # Apply fixes
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const boundaries = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "neighborhood-boundaries.json"), "utf-8")
);

// --- Point-in-polygon (ray casting) ---

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

function findNeighborhood(lat, lng) {
  for (const feature of boundaries.features) {
    const geom = feature.geometry;
    const inside =
      geom.type === "Polygon"
        ? pointInPolygon(lng, lat, geom.coordinates)
        : pointInMultiPolygon(lng, lat, geom.coordinates);
    if (inside) return feature.properties.name;
  }
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findClosestCentroid(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const f of boundaries.features) {
    const [cLng, cLat] = f.properties.centroid;
    const dist = haversineKm(lat, lng, cLat, cLng);
    if (dist < bestDist) {
      bestDist = dist;
      best = f.properties.name;
    }
  }
  return best ? { name: best, distKm: Math.round(bestDist * 10) / 10 } : null;
}

async function main() {
  const mode = process.argv[2];
  if (!["--audit", "--fix-dry-run", "--fix-apply"].includes(mode)) {
    console.log("Usage: node scripts/audit-neighborhood-accuracy.js --audit|--fix-dry-run|--fix-apply");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sb = createClient(url, key);

  // Fetch all venues with coordinates
  let allVenues = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("venues")
      .select("id, name, neighborhood, lat, lng, city")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allVenues = allVenues.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`Loaded ${allVenues.length} venues with coordinates\n`);

  const mismatches = [];
  const confirmedOk = [];
  const outsidePolygons = [];
  const couldAssign = []; // no neighborhood but inside polygon

  for (const venue of allVenues) {
    const polyHood = findNeighborhood(venue.lat, venue.lng);

    if (!venue.neighborhood) {
      if (polyHood) {
        couldAssign.push({ id: venue.id, name: venue.name, city: venue.city, suggested: polyHood });
      }
      continue;
    }

    if (!polyHood) {
      outsidePolygons.push(venue);
      continue;
    }

    if (polyHood === venue.neighborhood) {
      confirmedOk.push(venue);
    } else {
      mismatches.push({
        id: venue.id,
        name: venue.name,
        city: venue.city,
        current: venue.neighborhood,
        suggested: polyHood,
      });
    }
  }

  console.log("=== RESULTS ===");
  console.log(`Confirmed correct (polygon match): ${confirmedOk.length}`);
  console.log(`Mismatched (polygon differs):      ${mismatches.length}`);
  console.log(`Outside all polygons (OTP/other):   ${outsidePolygons.length}`);
  console.log(`No neighborhood, could auto-assign: ${couldAssign.length}`);

  if (mismatches.length > 0) {
    const grouped = {};
    mismatches.forEach((m) => {
      const key = `"${m.current}" → "${m.suggested}"`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    console.log("\n=== MISMATCHES BY TYPE ===\n");
    Object.entries(grouped)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([key, venues]) => {
        console.log(`${venues.length}\t${key}`);
        if (mode === "--audit") {
          venues.slice(0, 3).forEach((v) => console.log(`\t  ${v.name}`));
          if (venues.length > 3) console.log(`\t  ...and ${venues.length - 3} more`);
        }
      });
  }

  if (couldAssign.length > 0) {
    const assignGrouped = {};
    couldAssign.forEach((v) => { assignGrouped[v.suggested] = (assignGrouped[v.suggested] || 0) + 1; });

    console.log("\n=== AUTO-ASSIGNABLE ===");
    Object.entries(assignGrouped)
      .sort((a, b) => b[1] - a[1])
      .forEach(([hood, count]) => console.log(`  ${count}\t→ ${hood}`));
  }

  // Fix modes
  if (mode === "--fix-dry-run" || mode === "--fix-apply") {
    const allFixes = [
      ...mismatches.map((m) => ({ id: m.id, name: m.name, from: m.current, to: m.suggested })),
      ...couldAssign.map((v) => ({ id: v.id, name: v.name, from: "(null)", to: v.suggested })),
    ];

    console.log(`\n=== FIX PLAN ===`);
    console.log(`Reassign mismatches: ${mismatches.length}`);
    console.log(`Auto-assign nulls:   ${couldAssign.length}`);
    console.log(`Total fixes:         ${allFixes.length}`);

    if (mode === "--fix-apply" && allFixes.length > 0) {
      console.log("\nApplying fixes...");
      let applied = 0;
      let errors = 0;
      for (const fix of allFixes) {
        const { error } = await sb.from("venues").update({ neighborhood: fix.to }).eq("id", fix.id);
        if (error) { console.error(`  Error: ${fix.name}: ${error.message}`); errors++; }
        else { applied++; }
      }
      console.log(`Done: ${applied} applied, ${errors} errors`);
    } else if (mode === "--fix-dry-run") {
      console.log("\nDry run — no changes applied.");
    }
  }
}

main().catch(console.error);
