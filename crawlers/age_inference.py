"""
age_inference.py — Batch age-tag inference for family portal events.

Tags events with age_min/age_max from title and description patterns.
Only updates events where BOTH age_min AND age_max are NULL (never overwrites).

Usage:
    python3 age_inference.py --portal atlanta-families --dry-run
    python3 age_inference.py --portal atlanta-families --apply

Flags:
    --dry-run   (default) Print sample of what would be tagged; no writes.
    --apply     Execute the updates against the database.
    --portal    Scope to sources subscribed to this portal slug.
    --limit     Max events to process (default: 5000).
"""

import argparse
import re
import sys
from typing import Optional

from config import get_config
from supabase import create_client


# ---------------------------------------------------------------------------
# Age patterns — ordered most-specific to least-specific so first match wins.
# Patterns match against the event title (and description if title has no hit).
# ---------------------------------------------------------------------------

_RANGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "ages 5-12", "age 3-6", "ages 5–12" (en-dash), "ages 3 to 5"
    (re.compile(r"ages?\s+(\d+)\s*(?:[-\u2013]|to)\s*(\d+)", re.IGNORECASE), "range"),
    # "(6-8 yrs)", "(6-8 years)"
    (re.compile(r"\((\d+)\s*[-\u2013]\s*(\d+)\s*(?:yr|year)", re.IGNORECASE), "range"),
    # "6-8 yrs", "6-8 years"
    (re.compile(r"(\d+)\s*[-\u2013]\s*(\d+)\s*(?:yr|year)", re.IGNORECASE), "range"),
    # "grades 3-5" → age 8-10 (grade + 5 approximation)
    (re.compile(r"grade[s]?\s+(\d+)\s*[-\u2013]\s*(\d+)", re.IGNORECASE), "grade_range"),
    # "12 & under", "8 and under"
    (re.compile(r"(\d+)\s*(?:&|and)\s+under", re.IGNORECASE), "max_only"),
    # "under 5", "under 12"
    (re.compile(r"under\s+(\d+)", re.IGNORECASE), "max_only"),
]

# Keyword → (age_min, age_max). Checked after regex patterns (regex wins if found).
_KEYWORD_RULES: list[tuple[re.Pattern, int, int]] = [
    (re.compile(r"\binfant[s]?\b", re.IGNORECASE), 0, 1),
    (re.compile(r"\btoddler[s]?\b", re.IGNORECASE), 1, 3),
    (re.compile(r"\bpreschool(er|ers|age)?\b", re.IGNORECASE), 3, 5),
    (re.compile(r"\bkindergarten\b", re.IGNORECASE), 5, 6),
    (re.compile(r"\bstorytime\b|\bstory\s+time\b", re.IGNORECASE), 0, 5),
    (re.compile(r"\bjunior[s]?\b", re.IGNORECASE), 6, 12),
    (re.compile(r"\bkid[s]?\b|\bchildren[s]?\b|\bchild\b", re.IGNORECASE), 3, 12),
    (re.compile(r"\byouth\b", re.IGNORECASE), 6, 17),
    (re.compile(r"\bteen[s]?\b|\bteenager[s]?\b", re.IGNORECASE), 13, 17),
    (re.compile(r"\btween[s]?\b", re.IGNORECASE), 10, 14),
    (re.compile(r"\bfamily\s+friendly\b|\bfamilies\b|\bfamily\b", re.IGNORECASE), 0, 12),
]

SAMPLE_PRINT_LIMIT = 20


def parse_age_from_text(text: str) -> tuple[Optional[int], Optional[int]]:
    """
    Extract age range from event text using regex patterns, then keyword rules.
    Returns (age_min, age_max) or (None, None) if nothing parseable found.
    Only returns ranges where age_max <= 18 — avoids tagging adult programs.
    """
    if not text:
        return None, None

    # 1. Try regex patterns first (specific wins)
    for pattern, ptype in _RANGE_PATTERNS:
        m = pattern.search(text)
        if m is None:
            continue
        groups = m.groups()

        if ptype == "range" and len(groups) == 2:
            a, b = int(groups[0]), int(groups[1])
            if b <= 18 and a <= b:
                return a, b

        elif ptype == "grade_range" and len(groups) == 2:
            a, b = int(groups[0]) + 5, int(groups[1]) + 5
            if b <= 18 and a <= b:
                return a, b

        elif ptype == "max_only" and len(groups) == 1:
            upper = int(groups[0])
            if 0 < upper <= 18:
                return 0, upper

    # 2. Fall back to keyword rules
    for pattern, kw_min, kw_max in _KEYWORD_RULES:
        if pattern.search(text):
            return kw_min, kw_max

    return None, None


def build_search_text(event: dict) -> str:
    """Combine title and description into a single string for pattern matching."""
    parts = []
    if event.get("title"):
        parts.append(event["title"])
    if event.get("description"):
        # Limit description to first 500 chars — age info is usually at the top.
        parts.append(event["description"][:500])
    return " ".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch age-tag inference for family events")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Preview what would be tagged without writing (default behavior when neither flag given)",
    )
    mode_group.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Execute updates against the database",
    )
    parser.add_argument(
        "--portal",
        default="atlanta-families",
        help="Portal slug to scope source filtering (default: atlanta-families)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5000,
        help="Max events to process (default: 5000)",
    )
    args = parser.parse_args()

    # Default to dry-run when neither flag is explicitly set
    apply_mode = args.apply and not args.dry_run

    print(f"Mode: {'APPLY' if apply_mode else 'DRY-RUN'}")
    print(f"Portal: {args.portal}")
    print(f"Limit: {args.limit}")
    print()

    cfg = get_config()
    supabase = create_client(
        cfg.database.active_supabase_url,
        cfg.database.active_supabase_service_key or cfg.database.active_supabase_key,
    )

    # Resolve portal ID from slug
    portal_resp = (
        supabase.table("portals")
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

    portal_id = portal["id"]
    print(f"Resolved portal: {portal['slug']} ({portal_id})")

    # Collect source IDs subscribed to this portal
    subs_resp = (
        supabase.table("source_subscriptions")
        .select("source_id")
        .eq("subscriber_portal_id", portal_id)
        .eq("is_active", True)
        .execute()
    )
    subscribed_source_ids: list[int] = [row["source_id"] for row in (subs_resp.data or [])]

    if not subscribed_source_ids:
        print(f"No active source subscriptions found for portal '{args.portal}'.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(subscribed_source_ids)} subscribed sources")

    # Fetch events where BOTH age_min AND age_max are NULL, scoped to portal sources
    events_resp = (
        supabase.table("events")
        .select("id, title, description, age_min, age_max, source_id")
        .is_("age_min", "null")
        .is_("age_max", "null")
        .in_("source_id", subscribed_source_ids)
        .eq("is_active", True)
        .limit(args.limit)
        .execute()
    )
    events = events_resp.data or []
    print(f"Events with no age tags: {len(events)}")
    print()

    # Infer age ranges
    tagged: list[dict] = []
    untagged_count = 0

    for event in events:
        search_text = build_search_text(event)
        age_min, age_max = parse_age_from_text(search_text)

        if age_min is not None and age_max is not None:
            tagged.append({
                "id": event["id"],
                "title": event["title"],
                "age_min": age_min,
                "age_max": age_max,
            })
        else:
            untagged_count += 1

    print(f"Would tag: {len(tagged)}")
    print(f"No pattern found: {untagged_count}")
    tagging_rate = (len(tagged) / len(events) * 100) if events else 0
    print(f"Tagging rate: {tagging_rate:.1f}%")
    print()

    # Print sample
    if tagged:
        sample = tagged[:SAMPLE_PRINT_LIMIT]
        print(f"Sample (first {min(SAMPLE_PRINT_LIMIT, len(tagged))} of {len(tagged)}):")
        print(f"  {'ID':<8} {'ages':<10} Title")
        print(f"  {'-'*8} {'-'*10} {'-'*50}")
        for row in sample:
            age_label = f"{row['age_min']}-{row['age_max']}"
            title_preview = (row["title"] or "")[:60]
            print(f"  {row['id']:<8} {age_label:<10} {title_preview}")
        print()

    if not apply_mode:
        print("Dry-run complete. Run with --apply to write changes.")
        return

    # Apply updates
    if not tagged:
        print("Nothing to update.")
        return

    print(f"Writing {len(tagged)} updates...")
    updated = 0
    errors = 0

    # Batch in groups of 100 to stay within API limits
    BATCH_SIZE = 100
    for i in range(0, len(tagged), BATCH_SIZE):
        batch = tagged[i : i + BATCH_SIZE]
        for row in batch:
            try:
                result = (
                    supabase.table("events")
                    .update({"age_min": row["age_min"], "age_max": row["age_max"]})
                    .eq("id", row["id"])
                    .is_("age_min", "null")   # Double-check: never overwrite existing data
                    .is_("age_max", "null")
                    .execute()
                )
                if result.data:
                    updated += 1
            except Exception as e:
                errors += 1
                print(f"  ERROR updating event {row['id']}: {e}", file=sys.stderr)

        print(f"  Progress: {min(i + BATCH_SIZE, len(tagged))}/{len(tagged)}")

    print()
    print(f"Done. Updated: {updated}, Errors: {errors}")


if __name__ == "__main__":
    main()
