#!/usr/bin/env python3
"""
Backfill MARTA proximity, BeltLine adjacency, and transit scores for venues.

All computation is done from coordinates — no external HTTP requests needed.
Runs in seconds since it's just math on lat/lng.

Usage:
    python3 enrich_transit.py                     # Backfill all venues
    python3 enrich_transit.py --dry-run            # Preview without writing
    python3 enrich_transit.py --slug fox-theatre   # Single venue
    python3 enrich_transit.py --force              # Re-enrich even if already populated
"""

from __future__ import annotations

import math
import sys
import logging
import argparse
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MARTA rail stations (from GTFS data, deduplicated)
# ---------------------------------------------------------------------------

MARTA_STATIONS = [
    {"name": "Airport", "lat": 33.640831, "lon": -84.446198, "lines": ["red", "gold"]},
    {"name": "Arts Center", "lat": 33.789669, "lon": -84.387414, "lines": ["red", "gold"]},
    {"name": "Ashby", "lat": 33.756478, "lon": -84.41723, "lines": ["blue", "green"]},
    {"name": "Avondale", "lat": 33.775554, "lon": -84.281487, "lines": ["blue"]},
    {"name": "Bankhead", "lat": 33.772159, "lon": -84.428873, "lines": ["green"]},
    {"name": "Brookhaven/Oglethorpe", "lat": 33.860329, "lon": -84.339245, "lines": ["gold"]},
    {"name": "Buckhead", "lat": 33.84781, "lon": -84.367629, "lines": ["red"]},
    {"name": "Chamblee", "lat": 33.887929, "lon": -84.305556, "lines": ["gold"]},
    {"name": "Civic Center", "lat": 33.766111, "lon": -84.387504, "lines": ["red", "gold"]},
    {"name": "College Park", "lat": 33.650577, "lon": -84.448656, "lines": ["red", "gold"]},
    {"name": "Decatur", "lat": 33.774699, "lon": -84.295417, "lines": ["blue"]},
    {"name": "Doraville", "lat": 33.902411, "lon": -84.281166, "lines": ["gold"]},
    {"name": "Dunwoody", "lat": 33.920862, "lon": -84.344213, "lines": ["red"]},
    {"name": "East Lake", "lat": 33.765241, "lon": -84.312937, "lines": ["blue"]},
    {"name": "East Point", "lat": 33.677424, "lon": -84.440542, "lines": ["red", "gold"]},
    {"name": "Edgewood/Candler Park", "lat": 33.761803, "lon": -84.340825, "lines": ["blue", "green"]},
    {"name": "Five Points", "lat": 33.753837, "lon": -84.391397, "lines": ["red", "gold", "blue", "green"]},
    {"name": "Garnett", "lat": 33.748938, "lon": -84.395545, "lines": ["red", "gold"]},
    {"name": "Georgia State", "lat": 33.750161, "lon": -84.385915, "lines": ["blue", "green"]},
    {"name": "Hamilton E. Holmes", "lat": 33.754553, "lon": -84.469302, "lines": ["blue"]},
    {"name": "Indian Creek", "lat": 33.769856, "lon": -84.228906, "lines": ["blue"]},
    {"name": "Inman Park/Reynoldstown", "lat": 33.757451, "lon": -84.352762, "lines": ["blue", "green"]},
    {"name": "Kensington", "lat": 33.772764, "lon": -84.252151, "lines": ["blue"]},
    {"name": "King Memorial", "lat": 33.749951, "lon": -84.375675, "lines": ["blue", "green"]},
    {"name": "Lakewood/Ft. McPherson", "lat": 33.70088, "lon": -84.428768, "lines": ["red", "gold"]},
    {"name": "Lenox", "lat": 33.845307, "lon": -84.358387, "lines": ["red", "gold"]},
    {"name": "Lindbergh Center", "lat": 33.823385, "lon": -84.369357, "lines": ["red", "gold"]},
    {"name": "Medical Center", "lat": 33.910757, "lon": -84.35189, "lines": ["red"]},
    {"name": "Midtown", "lat": 33.781247, "lon": -84.386342, "lines": ["red", "gold"]},
    {"name": "North Ave", "lat": 33.77179, "lon": -84.38674, "lines": ["red", "gold"]},
    {"name": "North Springs", "lat": 33.944377, "lon": -84.357253, "lines": ["red"]},
    {"name": "Oakland City", "lat": 33.7173, "lon": -84.42503, "lines": ["red", "gold"]},
    {"name": "Peachtree Center", "lat": 33.758189, "lon": -84.387596, "lines": ["red", "gold"]},
    {"name": "Sandy Springs", "lat": 33.931671, "lon": -84.351069, "lines": ["red"]},
    {"name": "Vine City", "lat": 33.756613, "lon": -84.403902, "lines": ["blue", "green"]},
    {"name": "West End", "lat": 33.736564, "lon": -84.413653, "lines": ["red", "gold"]},
    {"name": "West Lake", "lat": 33.753328, "lon": -84.445329, "lines": ["blue"]},
]

# ---------------------------------------------------------------------------
# BeltLine trail segments (waypoints along built trail sections)
# ---------------------------------------------------------------------------

BELTLINE_SEGMENTS = [
    {
        "name": "Eastside Trail",
        "points": [
            (33.7927, -84.3695),
            (33.7892, -84.3665),
            (33.7850, -84.3640),
            (33.7810, -84.3625),
            (33.7780, -84.3630),
            (33.7740, -84.3625),
            (33.7700, -84.3620),
            (33.7655, -84.3605),
            (33.7610, -84.3590),
        ],
    },
    {
        "name": "Westside Trail",
        "points": [
            (33.7520, -84.4105),
            (33.7470, -84.4090),
            (33.7420, -84.4075),
            (33.7360, -84.4050),
            (33.7290, -84.4020),
            (33.7230, -84.3995),
        ],
    },
    {
        "name": "Southside Trail",
        "points": [
            (33.7610, -84.3590),
            (33.7560, -84.3550),
            (33.7510, -84.3520),
            (33.7460, -84.3500),
            (33.7400, -84.3480),
        ],
    },
    {
        "name": "Northeast Trail",
        "points": [
            (33.7927, -84.3695),
            (33.7970, -84.3700),
            (33.8020, -84.3700),
            (33.8070, -84.3690),
            (33.8120, -84.3680),
        ],
    },
    {
        "name": "Northwest Trail",
        "points": [
            (33.7730, -84.4140),
            (33.7780, -84.4180),
            (33.7830, -84.4200),
        ],
    },
]

# Maximum walk distance to show MARTA info (miles)
MARTA_MAX_MILES = 0.95  # ~15 min walk

# Maximum distance to be "BeltLine adjacent" (miles)
BELTLINE_MAX_MILES = 0.25


# ---------------------------------------------------------------------------
# Geo math
# ---------------------------------------------------------------------------


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3959
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _walk_minutes(miles: float) -> int:
    """~3 mph walking speed."""
    return max(1, round(miles * 20))


def _point_to_segment_distance(
    plat: float, plon: float, lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Approximate distance from point to line segment (in miles)."""
    # Project point onto segment, compute perpendicular distance
    dx = lat2 - lat1
    dy = lon2 - lon1
    if dx == 0 and dy == 0:
        return _haversine_miles(plat, plon, lat1, lon1)

    t = max(0, min(1, ((plat - lat1) * dx + (plon - lon1) * dy) / (dx * dx + dy * dy)))
    proj_lat = lat1 + t * dx
    proj_lon = lon1 + t * dy
    return _haversine_miles(plat, plon, proj_lat, proj_lon)


# ---------------------------------------------------------------------------
# Computation
# ---------------------------------------------------------------------------


def compute_nearest_marta(lat: float, lng: float) -> Optional[dict]:
    """Find nearest MARTA station within walking distance."""
    best_dist = float("inf")
    best_station = None

    for s in MARTA_STATIONS:
        dist = _haversine_miles(lat, lng, s["lat"], s["lon"])
        if dist < best_dist:
            best_dist = dist
            best_station = s

    if best_dist > MARTA_MAX_MILES or not best_station:
        return None

    return {
        "nearest_marta_station": best_station["name"],
        "marta_walk_minutes": _walk_minutes(best_dist),
        "marta_lines": best_station["lines"],
    }


def compute_beltline_proximity(lat: float, lng: float) -> Optional[dict]:
    """Find nearest BeltLine trail segment."""
    best_dist = float("inf")
    best_segment = None

    for seg in BELTLINE_SEGMENTS:
        points = seg["points"]
        for i in range(len(points) - 1):
            dist = _point_to_segment_distance(
                lat, lng,
                points[i][0], points[i][1],
                points[i + 1][0], points[i + 1][1],
            )
            if dist < best_dist:
                best_dist = dist
                best_segment = seg["name"]

    if best_dist > BELTLINE_MAX_MILES or not best_segment:
        return None

    return {
        "beltline_adjacent": True,
        "beltline_segment": best_segment,
        "beltline_walk_minutes": _walk_minutes(best_dist),
    }


def compute_transit_score(
    marta: Optional[dict],
    beltline: Optional[dict],
    parking_free: Optional[bool],
    has_parking: bool,
) -> int:
    """
    Composite transit accessibility score (1-10).
    - MARTA <= 5 min: +4
    - MARTA 5-10 min: +2
    - MARTA 10-15 min: +1
    - BeltLine adjacent: +3
    - Free parking: +2
    - Any parking: +1
    """
    score = 0

    if marta:
        mins = marta["marta_walk_minutes"]
        if mins <= 5:
            score += 4
        elif mins <= 10:
            score += 2
        else:
            score += 1

    if beltline:
        score += 3

    if parking_free is True:
        score += 2
    elif has_parking:
        score += 1

    return min(10, max(1, score))


# ---------------------------------------------------------------------------
# Main backfill
# ---------------------------------------------------------------------------


def backfill(
    dry_run: bool = False,
    slug: Optional[str] = None,
    force: bool = False,
) -> dict:
    client = get_client()
    stats = {"marta": 0, "beltline": 0, "scored": 0, "skipped": 0, "total": 0}

    # Fetch venues with coordinates
    select_fields = "id, name, slug, lat, lng, parking_free, parking_note"
    try:
        query = client.table("venues").select(select_fields)
    except Exception:
        # parking columns might not exist
        query = client.table("venues").select("id, name, slug, lat, lng")

    if slug:
        query = query.eq("slug", slug)
    if not force:
        query = query.is_("nearest_marta_station", "null")

    result = query.not_.is_("lat", "null").order("id").execute()
    venues = result.data or []
    stats["total"] = len(venues)

    logger.info(f"Processing {len(venues)} venues with coordinates")

    for i, venue in enumerate(venues):
        lat = float(venue["lat"])
        lng = float(venue["lng"])
        name = venue.get("name", "?")
        vid = venue["id"]

        if i > 0 and i % 500 == 0:
            logger.info(f"  ...processed {i}/{len(venues)}")

        # Compute MARTA proximity
        marta = compute_nearest_marta(lat, lng)

        # Compute BeltLine adjacency
        beltline = compute_beltline_proximity(lat, lng)

        # Compute transit score
        parking_free = venue.get("parking_free")
        has_parking = bool(venue.get("parking_note"))
        score = compute_transit_score(marta, beltline, parking_free, has_parking)

        # Build update
        update: dict = {"transit_score": score}

        if marta:
            update["nearest_marta_station"] = marta["nearest_marta_station"]
            update["marta_walk_minutes"] = marta["marta_walk_minutes"]
            update["marta_lines"] = marta["marta_lines"]
            stats["marta"] += 1

        if beltline:
            update["beltline_adjacent"] = True
            update["beltline_segment"] = beltline["beltline_segment"]
            update["beltline_walk_minutes"] = beltline["beltline_walk_minutes"]
            stats["beltline"] += 1

        stats["scored"] += 1

        # Log interesting ones
        parts = []
        if marta:
            lines = "/".join(l.title() for l in marta["marta_lines"])
            parts.append(f"MARTA {marta['nearest_marta_station']} ({lines}) {marta['marta_walk_minutes']}min")
        if beltline:
            parts.append(f"BeltLine {beltline['beltline_segment']} {beltline['beltline_walk_minutes']}min")
        parts.append(f"score={score}")

        if marta or beltline:
            logger.info(f"  {name}: {' | '.join(parts)}")

        if dry_run:
            continue

        try:
            client.table("venues").update(update).eq("id", vid).execute()
        except Exception as e:
            logger.warning(f"  Failed to update {name}: {e}")

    logger.info(
        f"\nDone: {stats['marta']} near MARTA, {stats['beltline']} near BeltLine, "
        f"{stats['scored']} scored (of {stats['total']} total)"
    )
    return stats


# ---------------------------------------------------------------------------
# Walkable neighbors
# ---------------------------------------------------------------------------

WALKABLE_MAX_MILES = 0.3


def backfill_walkable(dry_run: bool = False) -> dict:
    """Compute walkable venue pairs (within 0.3 miles) and write to walkable_neighbors table."""
    client = get_client()
    stats = {"pairs": 0, "venues_with_neighbors": 0}

    # Fetch all venues with coordinates
    result = (
        client.table("venues")
        .select("id, name, slug, lat, lng")
        .not_.is_("lat", "null")
        .order("id")
        .execute()
    )
    venues = result.data or []
    logger.info(f"Computing walkable pairs for {len(venues)} venues...")

    # Build spatial grid for fast neighbor lookup (~0.3mi ≈ 0.005 degrees)
    GRID_SIZE = 0.005
    grid: dict[tuple[int, int], list[dict]] = {}
    for v in venues:
        lat, lng = float(v["lat"]), float(v["lng"])
        gx, gy = int(lat / GRID_SIZE), int(lng / GRID_SIZE)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                key = (gx + dx, gy + dy)
                grid.setdefault(key, []).append(v)

    # Find all walkable pairs
    pairs: list[dict] = []
    neighbor_counts: dict[int, int] = {}

    for v in venues:
        lat, lng = float(v["lat"]), float(v["lng"])
        gx, gy = int(lat / GRID_SIZE), int(lng / GRID_SIZE)
        key = (gx, gy)

        neighbors = []
        for candidate in grid.get(key, []):
            if candidate["id"] == v["id"]:
                continue
            dist = _haversine_miles(lat, lng, float(candidate["lat"]), float(candidate["lng"]))
            if dist <= WALKABLE_MAX_MILES:
                neighbors.append((candidate, dist))

        if neighbors:
            neighbor_counts[v["id"]] = len(neighbors)
            for neighbor, dist in neighbors:
                # Only store one direction (lower id -> higher id) to avoid dupes in insert
                if v["id"] < neighbor["id"]:
                    pairs.append({
                        "venue_id": v["id"],
                        "neighbor_id": neighbor["id"],
                        "walk_minutes": _walk_minutes(dist),
                        "distance_miles": round(dist, 3),
                    })

    stats["pairs"] = len(pairs)
    stats["venues_with_neighbors"] = len(neighbor_counts)

    # Stats
    if neighbor_counts:
        counts = list(neighbor_counts.values())
        avg = sum(counts) / len(counts)
        logger.info(
            f"  {len(pairs)} unique pairs across {len(neighbor_counts)} venues "
            f"(avg {avg:.1f} neighbors, max {max(counts)})"
        )
        # Show top clusters
        top = sorted(neighbor_counts.items(), key=lambda x: -x[1])[:10]
        for vid, count in top:
            name = next((v["name"] for v in venues if v["id"] == vid), "?")
            logger.info(f"    {name}: {count} walkable neighbors")

    if dry_run:
        return stats

    # Clear and rewrite (idempotent)
    logger.info("  Clearing existing walkable_neighbors...")
    client.table("walkable_neighbors").delete().gte("venue_id", 0).execute()

    # Insert in batches of 500
    logger.info(f"  Inserting {len(pairs)} pairs...")
    # Also insert the reverse direction for easy lookups
    all_rows = []
    for p in pairs:
        all_rows.append(p)
        all_rows.append({
            "venue_id": p["neighbor_id"],
            "neighbor_id": p["venue_id"],
            "walk_minutes": p["walk_minutes"],
            "distance_miles": p["distance_miles"],
        })

    batch_size = 500
    for i in range(0, len(all_rows), batch_size):
        batch = all_rows[i : i + batch_size]
        client.table("walkable_neighbors").insert(batch).execute()
        if (i // batch_size) % 10 == 0 and i > 0:
            logger.info(f"    ...inserted {i}/{len(all_rows)} rows")

    # Update neighbor counts on venues
    logger.info("  Updating walkable_neighbor_count on venues...")
    # Reset all to 0 first
    client.table("venues").update({"walkable_neighbor_count": 0}).gte("id", 0).execute()
    for vid, count in neighbor_counts.items():
        client.table("venues").update({"walkable_neighbor_count": count}).eq("id", vid).execute()

    logger.info(f"\nWalkable neighbors done: {len(pairs)} pairs, {len(neighbor_counts)} venues")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Backfill MARTA/BeltLine/transit scores + walkable clusters")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--slug", type=str, help="Single venue slug")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if populated")
    parser.add_argument("--walkable", action="store_true", help="Compute walkable neighbor pairs")
    parser.add_argument("--all", action="store_true", help="Run both transit + walkable")
    args = parser.parse_args()

    if args.walkable or args.all:
        backfill_walkable(dry_run=args.dry_run)

    if not args.walkable or args.all:
        backfill(dry_run=args.dry_run, slug=args.slug, force=args.force)


if __name__ == "__main__":
    main()
