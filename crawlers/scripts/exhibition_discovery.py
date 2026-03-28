# crawlers/scripts/exhibition_discovery.py
"""
Discovery: find galleries that ArtsATL covers but we don't have exhibition crawlers for.

Uses existing editorial_mentions data to identify gaps.

Run: cd crawlers && python3 scripts/exhibition_discovery.py
"""

import logging

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ARTS_VENUE_TYPES = ("gallery", "museum", "studio", "event_space")


def run_discovery():
    client = get_client()

    # Get venues with editorial mentions
    mentions = client.table("editorial_mentions").select(
        "place_id, venues(id, name, venue_type, website, city)"
    ).execute()

    # Group by venue
    venue_mentions = {}
    for m in mentions.data:
        venue = m.get("venues")
        if not venue or venue.get("city") != "Atlanta":
            continue
        vid = venue["id"]
        if vid not in venue_mentions:
            venue_mentions[vid] = {
                "name": venue["name"],
                "place_type": venue.get("place_type"),
                "website": venue.get("website"),
                "mention_count": 0,
            }
        venue_mentions[vid]["mention_count"] += 1

    # Get sources with entity_family = 'exhibitions'
    sources = client.table("sources").select(
        "id, slug, venue_id"
    ).eq("entity_family", "exhibitions").eq("is_active", True).execute()
    crawled_venue_ids = {s.get("venue_id") for s in sources.data if s.get("venue_id")}

    # Also check which venues already have exhibitions
    exhibitions = client.table("exhibitions").select(
        "venue_id"
    ).eq("is_active", True).execute()
    venues_with_exhibitions = {e["venue_id"] for e in exhibitions.data}

    # Find gaps: venues with editorial mentions + arts venue type + no crawler + no exhibitions
    gaps = []
    for vid, info in venue_mentions.items():
        if info["venue_type"] not in ARTS_VENUE_TYPES:
            continue
        if vid in crawled_venue_ids:
            continue
        if vid in venues_with_exhibitions:
            continue
        gaps.append({
            "place_id": vid,
            **info,
        })

    # Sort by mention count (most covered = highest priority)
    gaps.sort(key=lambda x: -x["mention_count"])

    logger.info("=== Gallery Exhibition Crawler Gaps ===")
    logger.info("Galleries with editorial coverage but no exhibition data:")
    logger.info("")
    for g in gaps:
        logger.info(
            "  %3d mentions | %-35s | %-12s | %s",
            g["mention_count"],
            g["name"][:35],
            g.get("venue_type", "?"),
            g.get("website") or "no website",
        )
    logger.info("")
    logger.info("Total gaps: %d galleries", len(gaps))

    # Also list the top galleries that already have data (for reference)
    covered = []
    for vid, info in venue_mentions.items():
        if info["venue_type"] not in ARTS_VENUE_TYPES:
            continue
        if vid in crawled_venue_ids or vid in venues_with_exhibitions:
            covered.append({
                "place_id": vid,
                **info,
            })
    covered.sort(key=lambda x: -x["mention_count"])

    logger.info("=== Already Covered ===")
    for c in covered[:10]:
        logger.info("  %3d mentions | %-35s | covered", c["mention_count"], c["name"][:35])


if __name__ == "__main__":
    run_discovery()
