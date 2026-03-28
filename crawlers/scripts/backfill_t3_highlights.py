#!/usr/bin/env python3
"""
Backfill venue_highlights for T3 venues missing them.

Generates type-appropriate highlights based on venue_type. These are
generic but accurate — crawlers can override with better data later.

Usage:
    python3 scripts/backfill_t3_highlights.py --dry-run
    python3 scripts/backfill_t3_highlights.py --allow-production-writes
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from db import get_client

T3_TYPES = ["museum", "arena", "stadium", "convention_center", "zoo", "aquarium", "theme_park"]

# Type-based highlight templates: (highlight_type, title_template, description_template)
# {name} is replaced with venue name
HIGHLIGHT_TEMPLATES = {
    "museum": [
        ("art", "Permanent Collection", "Rotating and permanent exhibitions showcasing diverse artistic and cultural works. Check the website for current exhibitions and special programming."),
    ],
    "arena": [
        ("architecture", "Live Event Venue", "Purpose-built arena hosting concerts, sporting events, and large-scale entertainment. The venue atmosphere transforms based on the event — from intimate concert configurations to full-capacity game day energy."),
    ],
    "stadium": [
        ("architecture", "Stadium Experience", "Large-scale outdoor or domed venue designed for major sporting events and concerts. The game day atmosphere, tailgating culture, and crowd energy make it a destination beyond just the event itself."),
    ],
    "convention_center": [
        ("architecture", "Convention & Event Space", "Versatile large-format venue hosting conventions, trade shows, expos, and special events throughout the year. Multiple halls and meeting spaces accommodate everything from intimate gatherings to massive multi-day events."),
    ],
    "zoo": [
        ("nature", "Animal Habitats & Exhibits", "Immersive animal habitats and educational exhibits designed to connect visitors with wildlife. Seasonal programming, keeper talks, and special encounters add layers beyond the standard visit."),
    ],
    "aquarium": [
        ("nature", "Marine Life Exhibits", "Underwater galleries and immersive aquatic habitats showcasing marine life from around the world. Interactive encounters and behind-the-scenes experiences elevate the visit beyond observation."),
    ],
    "theme_park": [
        ("hidden_feature", "Signature Attractions", "Flagship rides, shows, and immersive themed areas that define the park experience. Seasonal events and limited-time experiences keep repeat visits fresh."),
    ],
}


def main():
    parser = argparse.ArgumentParser(description="Backfill T3 venue highlights")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--allow-production-writes", action="store_true", help="Write to DB")
    args = parser.parse_args()

    write = args.allow_production_writes and not args.dry_run

    client = get_client()

    # Get all active T3 venues
    all_t3 = []
    for vt in T3_TYPES:
        r = client.table("places").select("id,name,place_type").eq("is_active", True).eq("place_type", vt).execute()
        all_t3.extend(r.data or [])

    t3_ids = [v["id"] for v in all_t3]
    print(f"Total T3 venues: {len(t3_ids)}")

    # Find which already have highlights
    existing = set()
    for offset in range(0, len(t3_ids), 500):
        batch = t3_ids[offset:offset + 500]
        r = client.table("venue_highlights").select("place_id").in_("place_id", batch).execute()
        existing.update(row["place_id"] for row in (r.data or []))

    missing = [v for v in all_t3 if v["id"] not in existing]
    print(f"Already have highlights: {len(existing)}")
    print(f"Missing highlights: {len(missing)}")

    if not missing:
        print("Nothing to do.")
        return

    created = 0
    errors = 0

    for v in missing:
        vid = v["id"]
        vtype = v["venue_type"]
        templates = HIGHLIGHT_TEMPLATES.get(vtype, [])

        if not templates:
            continue

        for highlight_type, title, description in templates:
            row = {
                "place_id": vid,
                "highlight_type": highlight_type,
                "title": title,
                "description": description,
                "sort_order": 0,
            }

            if write:
                try:
                    client.table("venue_highlights").insert(row).execute()
                    created += 1
                except Exception as e:
                    errors += 1
                    print(f"  Error {vid} ({v['name']}): {e}")
            else:
                created += 1
                if created <= 10:
                    print(f"  [{vtype}] {v['name']}: {title}")

    print(f"\n{'─' * 60}")
    print(f"Highlights created: {created}")
    if errors:
        print(f"Errors: {errors}")
    if not write:
        print(f"\n  DRY RUN — use --allow-production-writes to apply")


if __name__ == "__main__":
    main()
