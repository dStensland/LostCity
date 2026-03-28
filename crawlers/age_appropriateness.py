"""
age_appropriateness.py — Batch age-tag inference for ALL events.

Tags events with age_min/age_max based on venue type, event category, and
negative (adult-only) signals in title/description. Complements age_inference.py,
which only catches explicit title patterns ("ages 5-12", "teen", "storytime").

This engine covers the much larger population of events that are obviously
age-appropriate based on VENUE and CATEGORY — a movie at Plaza Theatre, a concert
at Tabernacle, a volunteer cleanup, a museum exhibition — without needing explicit
age language in the text.

Runs across ALL events (not just family portal), so federated events automatically
get age data.

Usage:
    python3 age_appropriateness.py --dry-run
    python3 age_appropriateness.py --dry-run --portal atlanta-families
    python3 age_appropriateness.py --apply
    python3 age_appropriateness.py --apply --limit 5000

Flags:
    --dry-run       (default) Preview what would be tagged; no writes.
    --apply         Execute updates against the database.
    --portal        Optional: scope to sources subscribed to this portal slug.
    --limit         Max events to process per page (default: 5000).
    --min-date      Earliest start_date to process (default: today, YYYY-MM-DD).
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from repo root before importing config/db
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from config import get_config  # noqa: E402
from supabase import create_client  # noqa: E402

# ---------------------------------------------------------------------------
# Venue type -> default (age_min, age_max), or None to skip.
# None means "don't tag by venue type alone" — let the category rule decide,
# or leave the event untagged (adult/ambiguous venues like bars).
# ---------------------------------------------------------------------------
VENUE_TYPE_AGE_DEFAULTS: dict[str, Optional[tuple[int, int]]] = {
    # Unambiguously all-ages
    "museum": (0, 99),
    "children_museum": (0, 12),
    "library": (0, 99),
    "park": (0, 99),
    "garden": (0, 99),
    "zoo": (0, 99),
    "aquarium": (0, 99),
    "bowling": (0, 99),
    "cinema": (0, 99),
    "bookstore": (0, 99),
    "community_center": (0, 99),
    "farmers_market": (0, 99),
    "skating_rink": (0, 99),
    "college": (0, 99),
    "university": (0, 99),
    "church": (0, 99),
    "fitness_center": (0, 99),
    "recreation_center": (0, 99),
    "botanical_garden": (0, 99),
    "nature_center": (0, 99),
    "science_center": (0, 99),
    "historic_site": (0, 99),
    "outdoor_space": (0, 99),
    # Teen+ contexts (music/comedy skew older, but still all-ages at arenas)
    "music_venue": (13, 99),
    "comedy_club": (13, 99),
    "arena": (0, 99),
    "convention_center": (0, 99),
    "escape_room": (8, 99),
    "theater": (5, 99),
    "performing_arts": (5, 99),
    "concert_hall": (0, 99),
    # Adult-leaning but frequently all-ages (especially daytime)
    "brewery": (0, 99),     # Most ATL breweries are family-friendly during the day
    "restaurant": (0, 99),
    "cafe": (0, 99),
    "coffee_shop": (0, 99),
    "food_hall": (0, 99),
    "winery": (0, 99),
    "distillery": (0, 99),
    "hotel": (0, 99),
    "rooftop": (0, 99),
    # Sports + recreation
    "sports_venue": (0, 99),
    "stadium": (0, 99),
    "golf_course": (0, 99),
    "tennis_center": (0, 99),
    "climbing_gym": (0, 99),
    "trampoline_park": (0, 99),
    # Misc
    "gallery": (0, 99),
    "art_space": (0, 99),
    "event_space": (0, 99),
    "festival_grounds": (0, 99),
    "record_store": (0, 99),
    "coworking": (0, 99),
    "organization": (0, 99),
    # Explicit skip — nightlife-primary, let other signals decide
    "bar": None,
    "nightclub": None,
    "strip_club": None,
    "sports_bar": None,
}

# ---------------------------------------------------------------------------
# Category -> default (age_min, age_max), or None to skip.
# ---------------------------------------------------------------------------
CATEGORY_AGE_DEFAULTS: dict[str, Optional[tuple[int, int]]] = {
    "family": (0, 99),
    "learning": (0, 99),
    "art": (0, 99),
    "film": (0, 99),
    "theater": (5, 99),
    "music": (0, 99),
    "comedy": (13, 99),
    "sports": (0, 99),
    "outdoors": (0, 99),
    "exercise": (0, 99),
    "recreation": (0, 99),
    "fitness": (0, 99),
    "community": (0, 99),
    "volunteer": (10, 99),
    "words": (0, 99),
    "food_drink": (0, 99),
    "wellness": (0, 99),
    "religious": (0, 99),
    "support_group": (0, 99),
    "other": (0, 99),
    # Explicit skip — let negative signals or venue type decide
    "nightlife": None,
}

# ---------------------------------------------------------------------------
# Negative signals — if any match in title + description, skip the event.
# We do NOT tag events with adult content, even if the venue/category default
# would otherwise suggest all-ages.
# ---------------------------------------------------------------------------
_ADULT_ONLY_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b21\s*\+", re.IGNORECASE),
    re.compile(r"\b21\s*and\s*(?:over|up)\b", re.IGNORECASE),
    re.compile(r"\bno\s*minors?\b", re.IGNORECASE),
    re.compile(r"\badults?\s*only\b", re.IGNORECASE),
    re.compile(r"\bbar\s*only\b", re.IGNORECASE),
    re.compile(r"\blate\s*night\b", re.IGNORECASE),
    re.compile(r"\bmidnight\b", re.IGNORECASE),
    re.compile(r"\bburlesque\b", re.IGNORECASE),
    re.compile(r"\bstrip(?:per|pers|tease)?\b", re.IGNORECASE),
    re.compile(r"\bdrag\s+brunch\b", re.IGNORECASE),
    re.compile(r"\b18\s*\+", re.IGNORECASE),
    re.compile(r"\b18\s*and\s*(?:over|up)\b", re.IGNORECASE),
]

# Signals that raise age_min to 13 (PG-13 / R rating, explicit content)
_TEEN_PLUS_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b(?:rated?\s+)?PG-?13\b", re.IGNORECASE),
    re.compile(r"\b(?:rated?\s+)?R\b(?!\s*\d)", re.IGNORECASE),  # "Rated R" not "R&B"
    re.compile(r"\bexplicit\s+(?:content|lyrics?)\b", re.IGNORECASE),
]

SAMPLE_PRINT_LIMIT = 20


# ---------------------------------------------------------------------------
# Core inference logic
# ---------------------------------------------------------------------------

def has_adult_signal(text: str) -> bool:
    """Return True if the text contains any adult-only indicator."""
    for pat in _ADULT_ONLY_PATTERNS:
        if pat.search(text):
            return True
    return False


def has_teen_plus_signal(text: str) -> bool:
    """Return True if the text suggests teen-minimum (PG-13/R, explicit)."""
    for pat in _TEEN_PLUS_PATTERNS:
        if pat.search(text):
            return True
    return False


def infer_age_range(
    title: str,
    description: str,
    venue_type: Optional[str],
    category: Optional[str],
) -> Optional[tuple[int, int]]:
    """
    Infer (age_min, age_max) from venue type and category with negative-signal
    gating.  Returns None if the event should not be tagged.

    Priority:
      1. Adult-only signal in text → skip (return None)
      2. Venue type has a non-None default → use it
      3. Category has a non-None default → use it
      4. Neither produces a non-None result → return None

    After picking a range, apply teen-plus signals to raise age_min if needed.
    """
    search_text = f"{title or ''} {(description or '')[:500]}"

    # 1. Adult-only signal gates everything
    if has_adult_signal(search_text):
        return None

    age_range: Optional[tuple[int, int]] = None
    source = "none"

    # 2. Venue type lookup
    if venue_type:
        vt_key = venue_type.lower().strip()
        if vt_key in VENUE_TYPE_AGE_DEFAULTS:
            venue_result = VENUE_TYPE_AGE_DEFAULTS[vt_key]
            if venue_result is not None:
                age_range = venue_result
                source = f"venue_type:{vt_key}"

    # 3. Category fallback
    if age_range is None and category:
        cat_key = category.lower().strip()
        if cat_key in CATEGORY_AGE_DEFAULTS:
            cat_result = CATEGORY_AGE_DEFAULTS[cat_key]
            if cat_result is not None:
                age_range = cat_result
                source = f"category:{cat_key}"

    if age_range is None:
        return None

    # 4. Teen-plus override
    age_min, age_max = age_range
    if has_teen_plus_signal(search_text):
        age_min = max(age_min, 13)

    return (age_min, age_max)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch age-tag inference for events (by venue type + category)"
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Preview what would be tagged without writing (default)",
    )
    mode_group.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Execute updates against the database",
    )
    parser.add_argument(
        "--portal",
        default=None,
        help="Optional portal slug to scope to subscribed sources only",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5000,
        help="Max events to process (default: 5000)",
    )
    parser.add_argument(
        "--min-date",
        default=str(date.today()),
        help="Earliest start_date to process, YYYY-MM-DD (default: today)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=False,
        help="Print adult-signal skips and unresolved events",
    )
    args = parser.parse_args()

    apply_mode = args.apply and not args.dry_run

    print(f"Mode:      {'APPLY' if apply_mode else 'DRY-RUN'}")
    print(f"Portal:    {args.portal or '(all portals)'}")
    print(f"Min date:  {args.min_date}")
    print(f"Limit:     {args.limit}")
    print()

    cfg = get_config()
    sb = create_client(
        cfg.database.active_supabase_url,
        cfg.database.active_supabase_service_key or cfg.database.active_supabase_key,
    )

    # -----------------------------------------------------------------------
    # Optional: resolve portal and collect subscribed source IDs
    # -----------------------------------------------------------------------
    subscribed_source_ids: Optional[list[int]] = None

    if args.portal:
        portal_resp = (
            sb.table("portals")
            .select("id, slug")
            .eq("slug", args.portal)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        portal = portal_resp.data
        if not portal:
            print(f"ERROR: Portal '{args.portal}' not found or not active.", file=sys.stderr)
            sys.exit(1)

        subs_resp = (
            sb.table("source_subscriptions")
            .select("source_id")
            .eq("subscriber_portal_id", portal["id"])
            .eq("is_active", True)
            .execute()
        )
        subscribed_source_ids = [row["source_id"] for row in (subs_resp.data or [])]
        if not subscribed_source_ids:
            print(f"No active source subscriptions found for portal '{args.portal}'.", file=sys.stderr)
            sys.exit(1)
        print(f"Portal '{portal['slug']}' → {len(subscribed_source_ids)} subscribed sources")

    # -----------------------------------------------------------------------
    # Fetch events with no age tags
    # -----------------------------------------------------------------------
    query = (
        sb.table("events")
        .select("id, title, description, category_id, venue_id, start_date")
        .is_("age_min", "null")
        .is_("age_max", "null")
        .eq("is_active", True)
        .gte("start_date", args.min_date)
        .limit(args.limit)
    )
    if subscribed_source_ids:
        query = query.in_("source_id", subscribed_source_ids)

    events_resp = query.execute()
    events = events_resp.data or []
    print(f"Events with no age tags: {len(events)}")
    print()

    if not events:
        print("Nothing to process.")
        return

    # -----------------------------------------------------------------------
    # Bulk-load venue types for all referenced venue IDs
    # -----------------------------------------------------------------------
    venue_ids = list({e["venue_id"] for e in events if e.get("venue_id")})
    venue_type_map: dict[int, str] = {}

    if venue_ids:
        # Supabase in-filter limit: process in chunks of 500
        CHUNK = 500
        for i in range(0, len(venue_ids), CHUNK):
            chunk = venue_ids[i : i + CHUNK]
            vresp = (
                sb.table("places")
                .select("id, venue_type")
                .in_("id", chunk)
                .execute()
            )
            for row in (vresp.data or []):
                if row.get("venue_type"):
                    venue_type_map[row["id"]] = row["venue_type"]
        print(f"Loaded venue_type for {len(venue_type_map)} of {len(venue_ids)} venues")
    print()

    # -----------------------------------------------------------------------
    # Infer age ranges
    # -----------------------------------------------------------------------
    tagged: list[dict] = []
    skipped_adult: int = 0
    skipped_no_signal: int = 0
    source_tally: dict[str, int] = {}

    for event in events:
        title = event.get("title") or ""
        description = event.get("description") or ""
        venue_type = venue_type_map.get(event.get("venue_id") or 0)
        category = event.get("category_id") or ""

        # Check adult signals first
        search_text = f"{title} {description[:500]}"
        if has_adult_signal(search_text):
            skipped_adult += 1
            if args.verbose:
                print(f"  [ADULT SKIP] {title[:80]}")
            continue

        result = infer_age_range(title, description, venue_type, category)

        if result is None:
            skipped_no_signal += 1
            if args.verbose:
                print(f"  [NO SIGNAL] venue={venue_type or '-'} cat={category or '-'} | {title[:60]}")
            continue

        age_min, age_max = result

        # Determine the inference source for reporting
        if venue_type and VENUE_TYPE_AGE_DEFAULTS.get(venue_type.lower()) is not None:
            sig_source = f"venue_type:{venue_type.lower()}"
        elif category and CATEGORY_AGE_DEFAULTS.get(category.lower()) is not None:
            sig_source = f"category:{category.lower()}"
        else:
            sig_source = "unknown"

        source_tally[sig_source] = source_tally.get(sig_source, 0) + 1

        tagged.append({
            "id": event["id"],
            "title": title,
            "age_min": age_min,
            "age_max": age_max,
            "source": sig_source,
            "start_date": event.get("start_date", ""),
        })

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    total = len(events)
    venue_type_count = sum(v for k, v in source_tally.items() if k.startswith("venue_type:"))
    category_count = sum(v for k, v in source_tally.items() if k.startswith("category:"))
    tag_rate = (len(tagged) / total * 100) if total else 0.0

    print("--- RESULTS ---")
    print(f"Total events processed:   {total}")
    print(f"Would tag:                {len(tagged)} ({tag_rate:.1f}%)")
    print(f"  - Tagged by venue type: {venue_type_count}")
    print(f"  - Tagged by category:   {category_count}")
    print(f"Skipped (adult signals):  {skipped_adult}")
    print(f"Skipped (no signal):      {skipped_no_signal}")
    print()

    # Top venue type and category buckets
    if source_tally:
        print("Top inference sources:")
        for src, count in sorted(source_tally.items(), key=lambda x: -x[1])[:15]:
            print(f"  {count:>5}  {src}")
        print()

    # Sample of tagged events
    if tagged:
        sample = tagged[:SAMPLE_PRINT_LIMIT]
        print(f"Sample (first {min(SAMPLE_PRINT_LIMIT, len(tagged))} of {len(tagged)}):")
        print(f"  {'ID':<8} {'ages':<8} {'source':<30} title")
        print(f"  {'-'*8} {'-'*8} {'-'*30} {'-'*40}")
        for row in sample:
            age_label = f"{row['age_min']}-{row['age_max']}"
            src_short = row["source"][:30]
            title_preview = row["title"][:50]
            print(f"  {row['id']:<8} {age_label:<8} {src_short:<30} {title_preview}")
        print()

    if not apply_mode:
        print("Dry-run complete. Run with --apply to write changes.")
        return

    # -----------------------------------------------------------------------
    # Apply updates
    # -----------------------------------------------------------------------
    if not tagged:
        print("Nothing to update.")
        return

    print(f"Writing {len(tagged)} updates...")
    updated = 0
    errors = 0
    BATCH_SIZE = 50
    MAX_RETRIES = 3
    BASE_DELAY = 1.0

    for i in range(0, len(tagged), BATCH_SIZE):
        batch = tagged[i : i + BATCH_SIZE]
        for row in batch:
            success = False
            for attempt in range(MAX_RETRIES):
                try:
                    result = (
                        sb.table("events")
                        .update({"age_min": row["age_min"], "age_max": row["age_max"]})
                        .eq("id", row["id"])
                        .is_("age_min", "null")   # Safety: never overwrite existing data
                        .is_("age_max", "null")
                        .execute()
                    )
                    if result.data:
                        updated += 1
                    success = True
                    break
                except Exception as e:
                    err_str = str(e)
                    if attempt < MAX_RETRIES - 1 and (
                        "502" in err_str or "503" in err_str or "timeout" in err_str.lower()
                        or "connection" in err_str.lower()
                    ):
                        delay = BASE_DELAY * (2 ** attempt)
                        print(f"  Transient error for {row['id']}, retry {attempt+1} in {delay:.1f}s...")
                        time.sleep(delay)
                    else:
                        errors += 1
                        print(f"  ERROR updating event {row['id']}: {err_str[:120]}", file=sys.stderr)
                        break

        progress = min(i + BATCH_SIZE, len(tagged))
        print(f"  Progress: {progress}/{len(tagged)}")
        # Brief pause between batches to avoid overwhelming the connection pool
        time.sleep(0.1)

    print()
    print(f"Done. Updated: {updated}  Errors: {errors}")


if __name__ == "__main__":
    main()
