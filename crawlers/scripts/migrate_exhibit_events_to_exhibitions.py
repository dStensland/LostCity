#!/usr/bin/env python3
"""
Migrate active exhibit events from the events table.

Most events with content_kind='exhibit' are FALSE POSITIVES from the old
auto-classification in validation.py (anything 30+ days, or with tags like
"museum"/"gallery"). Only events at actual gallery/museum venues that look
like art exhibitions should go to the exhibitions table. Everything else
gets reclassified back to content_kind='event'.

Usage:
    python scripts/migrate_exhibit_events_to_exhibitions.py --dry-run
    python scripts/migrate_exhibit_events_to_exhibitions.py --apply
"""

import argparse
import logging
import re
import sys
from datetime import date, datetime

sys.path.insert(0, ".")
from db.client import get_client
from db.exhibitions import generate_exhibition_hash, insert_exhibition, find_exhibition_by_hash
from db.venues import upsert_venue_feature

logger = logging.getLogger(__name__)

# Venue types where exhibits are real art exhibitions
EXHIBITION_VENUE_TYPES = {
    "gallery", "museum", "art_gallery", "arts_center", "cultural_center",
}

# Known attraction titles → venue_features
ATTRACTION_TITLES = {
    "summit skyride", "scenic railroad", "dinosaur explore", "skyhike",
    "mini golf", "general admission", "play at the museum", "geyser tower",
    "farmyard", "4-d theater", "duck adventures", "adventure golf",
    "gemstone mining", "nature playground", "splash pad",
    "permanent collection", "river roots science stations",
    "weekend activities", "birdseed fundraiser pick up",
    "visit goizueta children's experience",
}

# Title patterns that are clearly NOT exhibitions (false positives from auto-classification)
_NOT_EXHIBITION_RE = re.compile(
    r"(ballet|tap combo|hip-hop|jazz|modern with|creative movement|"
    r"pre-ballet|foundations \d|salsa|improvisation|yoga|pilates|"
    r"swim|basketball|soccer|volleyball|softball|baseball|football|"
    r"tennis|pickleball|league|camp|class|workshop|lesson|"
    r"hike|morning hike|volunteer|packing|warehouse sort|"
    r"film screening|recital|lecture|concert|comedy|live$|"
    r"opening reception|meet\s|fundraiser|gala|benefit|"
    r"book club|story time|storytime|toddler|baby|"
    r"fitness|zumba|crossfit|martial art|karate|"
    r"birthday|party|brunch|happy hour|trivia|"
    r"tour|walking tour|run\b|5k|10k|marathon)",
    re.IGNORECASE,
)

# Title patterns that ARE likely real exhibitions
_EXHIBITION_SIGNAL_RE = re.compile(
    r"(exhibit|exhibition|on view|gallery show|art show|retrospective|"
    r"solo show|group show|collection|installation\b)",
    re.IGNORECASE,
)

# Source slugs known to produce real exhibitions
EXHIBITION_SOURCE_SLUGS = {
    "atlanta-contemporary", "high-museum", "moca-ga", "clark-atlanta-art-museum",
    "hammonds-house", "kai-lin-art", "marcia-wood-gallery", "atlanta-printmakers-studio",
    "scad-fash", "spelman-college", "breman-museum", "spruill-center-for-the-arts",
    "atlanta-history-center", "moda",
}


def classify_exhibit(event: dict) -> str:
    """Classify an exhibit event into its correct destination.

    Returns one of: 'exhibition', 'venue_feature', 'reclassify', 'skip'
    - exhibition: real art exhibition → exhibitions table
    - venue_feature: permanent attraction → venue_features table
    - reclassify: false positive → clear content_kind back to 'event'
    - skip: already exists in exhibitions table
    """
    title = (event.get("title") or "").strip()
    title_lower = title.lower()
    venue_type = (event.get("venue_type") or "").strip().lower()
    source_slug = (event.get("source_slug") or "").strip().lower()
    start_date = event.get("start_date")

    # Known attraction titles → venue_features
    if title_lower in ATTRACTION_TITLES:
        return "venue_feature"

    # Already exists in exhibitions table → skip
    content_hash = generate_exhibition_hash(title, event.get("venue_id", 0), start_date)
    existing = find_exhibition_by_hash(content_hash)
    if existing:
        return "skip"

    # Clear false positives: titles that are obviously not exhibitions
    if _NOT_EXHIBITION_RE.search(title):
        return "reclassify"

    # Venue is a gallery/museum → likely real exhibition
    if venue_type in EXHIBITION_VENUE_TYPES:
        return "exhibition"

    # Source is a known exhibition-producing crawler
    if source_slug in EXHIBITION_SOURCE_SLUGS:
        return "exhibition"

    # Title has exhibition signals
    if _EXHIBITION_SIGNAL_RE.search(title):
        return "exhibition"

    # Default: false positive from auto-classification → reclassify as event
    return "reclassify"


def fetch_exhibit_events() -> list[dict]:
    """Fetch all active exhibit events with venue and source info."""
    client = get_client()
    result = (
        client.table("events")
        .select("id, title, description, image_url, start_date, end_date, "
                "venue_id, source_id, source_url, is_free, tags, content_kind, "
                "venues!inner(id, name, venue_type, slug), "
                "sources!inner(slug)")
        .eq("content_kind", "exhibit")
        .eq("is_active", True)
        .execute()
    )
    rows = result.data or []
    for row in rows:
        venue = row.pop("venues", {}) or {}
        row["venue_name"] = venue.get("name", "")
        row["venue_type"] = venue.get("venue_type", "")
        row["venue_slug"] = venue.get("slug", "")
        source = row.pop("sources", {}) or {}
        row["source_slug"] = source.get("slug", "")
    return rows


def migrate_to_exhibition(event: dict, apply: bool) -> bool:
    """Migrate an exhibit event to the exhibitions table."""
    exhibition_data = {
        "title": event["title"],
        "venue_id": event["venue_id"],
        "source_id": event.get("source_id"),
        "_venue_name": event.get("venue_name", "gallery"),
        "opening_date": event.get("start_date"),
        "closing_date": event.get("end_date"),
        "description": event.get("description"),
        "image_url": event.get("image_url"),
        "source_url": event.get("source_url"),
        "admission_type": "free" if event.get("is_free") else "ticketed",
        "tags": event.get("tags") or ["exhibition"],
        "is_active": True,
    }
    if apply:
        result = insert_exhibition(exhibition_data)
        return result is not None
    return True


def migrate_to_venue_feature(event: dict, apply: bool) -> bool:
    """Migrate an exhibit event to the venue_features table."""
    feature_data = {
        "title": event["title"],
        "description": event.get("description"),
        "feature_type": "attraction",
        "is_active": True,
    }
    if apply:
        result = upsert_venue_feature(event["venue_id"], feature_data)
        return result is not None
    return True


def reclassify_event(event_id: int, apply: bool) -> None:
    """Clear content_kind back to 'event' (was a false positive)."""
    if apply:
        client = get_client()
        client.table("events").update({"content_kind": "event"}).eq("id", event_id).execute()


def deactivate_event(event_id: int) -> None:
    """Mark an event as inactive after migration."""
    client = get_client()
    client.table("events").update({"is_active": False}).eq("id", event_id).execute()


def main():
    parser = argparse.ArgumentParser(description="Migrate exhibit events")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated")
    parser.add_argument("--apply", action="store_true", help="Execute the migration")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        parser.error("Specify --dry-run or --apply")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    # Suppress HTTP request logging
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    events = fetch_exhibit_events()
    logger.info("Found %d active exhibit events", len(events))

    stats = {"exhibition": 0, "venue_feature": 0, "reclassify": 0, "skip": 0, "error": 0}

    for event in events:
        destination = classify_exhibit(event)
        stats[destination] += 1

        venue_label = event.get("venue_name", "?")
        title = event.get("title", "?")

        if args.dry_run:
            logger.info(
                "[DRY RUN] %s → %-15s %s @ %s (%s)",
                event["id"], destination, title[:60], venue_label,
                event.get("start_date"),
            )
            continue

        if destination == "exhibition":
            ok = migrate_to_exhibition(event, apply=True)
            if not ok:
                stats["error"] += 1
                stats["exhibition"] -= 1
                logger.warning("Failed to migrate exhibition: %s", title)
                continue
            deactivate_event(event["id"])

        elif destination == "venue_feature":
            ok = migrate_to_venue_feature(event, apply=True)
            if not ok:
                stats["error"] += 1
                stats["venue_feature"] -= 1
                logger.warning("Failed to migrate venue feature: %s", title)
                continue
            deactivate_event(event["id"])

        elif destination == "reclassify":
            reclassify_event(event["id"], apply=True)

        elif destination == "skip":
            deactivate_event(event["id"])

    logger.info(
        "Migration complete: %d → exhibitions, %d → venue_features, "
        "%d reclassified to event, %d skipped (already exists), %d errors",
        stats["exhibition"], stats["venue_feature"],
        stats["reclassify"], stats["skip"], stats["error"],
    )


if __name__ == "__main__":
    main()
