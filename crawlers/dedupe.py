"""
Event deduplication logic for Lost City.
Identifies and merges duplicate events from different sources.
"""

import hashlib
import re
import logging
from datetime import date, timedelta
from datetime import date as dt_date, datetime
from typing import Optional
from rapidfuzz import fuzz
from extract import EventData
from db import find_event_by_hash, find_events_by_date_and_venue_family
from utils import is_likely_non_event_image

logger = logging.getLogger(__name__)

# Similarity thresholds
VENUE_SIMILARITY_THRESHOLD = 80
TITLE_SIMILARITY_THRESHOLD = 85

# Multi-room venue patterns: base name -> list of room suffix patterns
# These venues have multiple rooms that should be treated as the same venue for dedup
MULTI_ROOM_VENUES = {
    "the masquerade": [
        r"\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$",
    ],
    "masquerade": [
        r"\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$",
    ],
    # Add more multi-room venues here as needed
    # "terminal west": [r"\s*-\s*(main|rooftop)$"],
}


def normalize_venue_for_dedup(venue_name: str) -> str:
    """
    Normalize venue name for deduplication purposes.
    Strips room suffixes from multi-room venues so events at different rooms
    of the same venue are detected as potential duplicates.

    Example: "The Masquerade - Hell" -> "the masquerade"
    """
    if not venue_name:
        return ""

    normalized = venue_name.lower().strip()

    # Check each multi-room venue pattern
    for base_name, patterns in MULTI_ROOM_VENUES.items():
        for pattern in patterns:
            # Check if venue name starts with base and has room suffix
            if normalized.startswith(base_name):
                stripped = re.sub(pattern, "", normalized, flags=re.IGNORECASE)
                if stripped != normalized:
                    logger.debug(f"Normalized venue '{venue_name}' -> '{stripped}' for dedup")
                    return stripped.strip()

    return normalized


def normalize_text(text: str) -> str:
    """Normalize text for comparison. Strips status suffixes (sold out, cancelled,
    etc.) before normalization so titled events differing only by suffix are
    treated as the same event."""
    if not text:
        return ""
    # Lowercase
    text = text.lower()
    # Strip status suffixes before whitespace normalization
    text = re.sub(r'\s*\((sold[\s-]?out|rescheduled|cancelled|postponed|waitlist)\)\s*$', '', text, flags=re.IGNORECASE)
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Remove common prefixes/suffixes
    text = re.sub(r"^(the|a|an)\s+", "", text)
    # Remove punctuation
    text = re.sub(r"[^\w\s]", "", text)
    return text


def _normalize_date_for_hash(value) -> str:
    """Normalize date-like values to YYYY-MM-DD for stable hashing.

    Strips ISO datetime suffixes (T00:00:00, space-delimited times) but
    preserves pipe-separated time suffixes like "2026-03-02|14:00" used
    by cinema crawlers to produce unique hashes per showtime.
    """
    if isinstance(value, dt_date):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()

    text = str(value or "").strip()
    if not text:
        return ""

    # Strip ISO datetime suffixes: "2026-02-17T00:00:00" / "2026-02-17 00:00:00"
    # but NOT pipe-separated time: "2026-03-02|14:00" (intentional per-showtime key)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})[T ]", text)
    if m:
        return m.group(1)
    return text


def generate_legacy_content_hash(title: str, venue_name: str, date) -> str:
    """
    Legacy hash used before 2026-02-16 venue normalization change.
    Kept for backward-compatible dedupe lookup during migration.
    """
    normalized_venue = normalize_venue_for_dedup(venue_name)
    normalized = f"{normalize_text(title)}|{normalized_venue}|{_normalize_date_for_hash(date)}"
    return hashlib.md5(normalized.encode()).hexdigest()


def generate_content_hash(title: str, venue_name: str, date) -> str:
    """
    Generate a content hash for deduplication.
    Hash is based on ONLY: normalized title + normalized venue + date.
    Does NOT include description or other varying fields.
    Uses special venue normalization that strips room suffixes from multi-room venues.
    """
    # Use venue-specific normalization to handle multi-room venues, then apply text normalization
    venue_after_room_strip = normalize_venue_for_dedup(venue_name)
    normalized_venue = normalize_text(venue_after_room_strip)
    normalized_title = normalize_text(title)
    normalized = f"{normalized_title}|{normalized_venue}|{_normalize_date_for_hash(date)}"
    return hashlib.md5(normalized.encode()).hexdigest()


def generate_content_hash_candidates(title: str, venue_name: str, date) -> list[str]:
    """Return current+legacy hash candidates (deduped, stable order)."""
    hashes = [
        generate_content_hash(title, venue_name, date),
        generate_legacy_content_hash(title, venue_name, date),
    ]
    deduped = list(dict.fromkeys(hashes))
    return [h for h in deduped if h]


def calculate_similarity(event1: EventData, event2: dict) -> float:
    """
    Calculate similarity score between two events.
    Returns a score from 0-100.
    """
    # Must be on same date
    if event1.start_date != event2.get("start_date"):
        return 0.0

    # Compare titles
    title_sim = fuzz.ratio(
        normalize_text(event1.title),
        normalize_text(event2.get("title", ""))
    )

    # Compare venues
    venue_sim = fuzz.ratio(
        normalize_text(event1.venue.name),
        normalize_text(event2.get("venue_name", ""))
    )

    # Weighted average (title is more important)
    return (title_sim * 0.6) + (venue_sim * 0.4)


def is_duplicate(event: EventData, venue_id: int) -> Optional[int]:
    """
    Check if an event is a duplicate of an existing event.

    Args:
        event: The event to check
        venue_id: The resolved venue ID

    Returns:
        The ID of the canonical event if duplicate, None otherwise
    """
    # First check exact hash match
    content_hash = generate_content_hash(
        event.title,
        event.venue.name,
        event.start_date
    )

    existing = find_event_by_hash(content_hash)
    if existing:
        logger.debug(f"Found exact hash match for '{event.title}'")
        return existing["id"]

    # Then check fuzzy match - search across venue "family" (e.g., all Masquerade rooms)
    candidates = find_events_by_date_and_venue_family(event.start_date, venue_id)

    for candidate in candidates:
        similarity = calculate_similarity(event, candidate)
        if similarity >= TITLE_SIMILARITY_THRESHOLD:
            logger.debug(
                f"Found fuzzy match for '{event.title}' -> '{candidate['title']}' "
                f"at '{candidate.get('venue_name', 'unknown')}' (similarity: {similarity:.1f}%)"
            )
            return candidate["id"]

    return None


def merge_event_data(existing: dict, new: EventData) -> dict:
    """
    Merge new event data into existing event, keeping more complete data.

    Args:
        existing: The existing event record
        new: The new event data

    Returns:
        Merged event data dict
    """
    merged = existing.copy()

    # Prefer longer description
    if new.description and (
        not existing.get("description") or
        len(new.description) > len(existing.get("description", ""))
    ):
        merged["description"] = new.description

    # Add missing times
    if new.start_time and not existing.get("start_time"):
        merged["start_time"] = new.start_time
    if new.end_time and not existing.get("end_time"):
        merged["end_time"] = new.end_time

    # Prefer lower confidence to be conservative
    if new.confidence < existing.get("extraction_confidence", 1.0):
        merged["extraction_confidence"] = new.confidence

    # Merge tags
    existing_tags = set(existing.get("tags") or [])
    new_tags = set(new.tags or [])
    merged["tags"] = list(existing_tags | new_tags)

    # Add price info if missing
    if new.price_min is not None and existing.get("price_min") is None:
        merged["price_min"] = new.price_min
    if new.price_max is not None and existing.get("price_max") is None:
        merged["price_max"] = new.price_max
    if new.price_note and not existing.get("price_note"):
        merged["price_note"] = new.price_note

    # Add image if missing, or upgrade a known low-quality placeholder/logo image.
    if new.image_url:
        existing_img = existing.get("image_url")
        if not existing_img:
            if not is_likely_non_event_image(new.image_url):
                merged["image_url"] = new.image_url
        elif (
            is_likely_non_event_image(existing_img)
            and not is_likely_non_event_image(new.image_url)
        ):
            merged["image_url"] = new.image_url

    # Add ticket URL if missing
    if new.ticket_url and not existing.get("ticket_url"):
        merged["ticket_url"] = new.ticket_url

    return merged


# ---------------------------------------------------------------------------
# Cross-source fuzzy deduplication (aggregator vs. venue-direct)
# ---------------------------------------------------------------------------

# Aggregator source slug prefixes — events from these are lower-priority
# canonicals vs. venue-direct sources.
_CROSS_SOURCE_AGGREGATOR_PREFIXES = (
    "ticketmaster",
    "eventbrite",
)

# Default aggregator slugs to target when no explicit list is provided.
_DEFAULT_AGGREGATOR_SLUGS = [
    "ticketmaster",
    "ticketmaster-nashville",
    "eventbrite",
    "eventbrite-nashville",
]

# Suffixes that aggregators (and some venue crawlers) append to titles that
# should be stripped before fuzzy comparison.
_AGGREGATOR_TITLE_SUFFIX_RE = re.compile(
    r"""
    \s+@\s+.+$                                   # " @ Venue Name" (venue crawlers)
    | \s+-\s+.+$                                  # " - Venue Name" (some crawlers)
    | \s+\(18\s*\+\)\s*$                          # " (18+)"
    | \s+\(all\s+ages?\)\s*$                      # " (All Ages)"
    | \s+\(18\s+and\s+over\)\s*$                  # " (18 and Over)"
    | \s+\(21\s*\+\)\s*$                          # " (21+)"
    | \s+\(ages?\s+\d+\s*\+\)\s*$                # " (Ages 13+)"
    | \s+\(sold[\s-]?out\)\s*$                    # " (Sold Out)"
    | \s+\(rescheduled\)\s*$                      # " (Rescheduled)"
    | \s+\(cancelled\)\s*$                        # " (Cancelled)"
    | \s+\(postponed\)\s*$                        # " (Postponed)"
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _strip_aggregator_title_suffixes(title: str) -> str:
    """
    Iteratively strip known aggregator/venue suffixes from a title until none remain.

    Handles stacked suffixes like "Band Name @ Venue (18+)" -> "Band Name".
    """
    t = (title or "").strip()
    # Apply repeatedly because some titles stack multiple suffixes
    for _ in range(5):
        stripped = _AGGREGATOR_TITLE_SUFFIX_RE.sub("", t).strip()
        if stripped == t:
            break
        t = stripped
    return t


def _normalize_for_cross_source(title: str) -> str:
    """
    Full normalization pipeline for cross-source fuzzy comparison:
    1. Strip aggregator-specific suffixes ("@ Venue", "(18+)", etc.)
    2. Apply standard normalize_text() (lowercase, strip articles, remove punctuation)
    """
    stripped = _strip_aggregator_title_suffixes(title)
    return normalize_text(stripped)


def find_cross_source_duplicates(
    client,
    aggregator_slugs: list[str] = None,
    min_similarity: float = 0.80,
    dry_run: bool = True,
    days_ahead: int = 60,
) -> list[tuple[int, int]]:
    """
    Find events that exist from both a venue-direct source and an aggregator source
    (Ticketmaster, Eventbrite) where the titles diverge due to appended suffixes.

    Returns list of (keep_id, dupe_id) pairs where keep_id is the venue-direct
    event and dupe_id is the aggregator copy.

    Strategy:
    1. Resolve the source IDs for the aggregator slugs.
    2. Fetch all active future events from those aggregator sources.
    3. For each aggregator event, query the same venue + same date from
       non-aggregator sources.
    4. Fuzzy-match titles after stripping known suffixes ("@ Venue", "(18+)", etc.).
    5. If similarity >= min_similarity, mark aggregator copy as duplicate
       (venue-direct copy is preferred canonical).

    Args:
        client:           Supabase client instance.
        aggregator_slugs: Source slugs to treat as aggregators. Defaults to
                          _DEFAULT_AGGREGATOR_SLUGS.
        min_similarity:   Minimum fuzz.ratio score (0.0–1.0) to declare a match.
                          Default 0.80 (80/100 on rapidfuzz scale).
        dry_run:          If True, only report pairs without writing to DB.
        days_ahead:       How many days of future events to scan. Default 60.

    Returns:
        List of (keep_id, dupe_id) tuples. keep_id is the venue-direct event;
        dupe_id is the aggregator event that should be linked/suppressed.
    """
    if aggregator_slugs is None:
        aggregator_slugs = _DEFAULT_AGGREGATOR_SLUGS

    # ── Step 1: resolve aggregator source IDs ────────────────────────────────
    agg_source_rows = (
        client.table("sources")
        .select("id, slug")
        .in_("slug", aggregator_slugs)
        .execute()
    )
    agg_source_id_to_slug = {
        row["id"]: row["slug"] for row in (agg_source_rows.data or [])
    }
    if not agg_source_id_to_slug:
        logger.warning(
            "No active sources found for aggregator slugs: %s — nothing to deduplicate",
            aggregator_slugs,
        )
        return []

    agg_source_ids = list(agg_source_id_to_slug.keys())
    logger.info(
        "Scanning %d aggregator source(s): %s",
        len(agg_source_ids),
        list(agg_source_id_to_slug.values()),
    )

    # ── Step 2: fetch aggregator events in window ─────────────────────────────
    today = date.today().isoformat()
    future = (date.today() + timedelta(days=days_ahead)).isoformat()

    PAGE_SIZE = 1000
    agg_events: list[dict] = []
    offset = 0
    while True:
        result = (
            client.table("events")
            .select("id, title, start_date, start_time, venue_id, source_id, canonical_event_id")
            .gte("start_date", today)
            .lte("start_date", future)
            .eq("is_active", True)
            .is_("canonical_event_id", "null")
            .in_("source_id", agg_source_ids)
            .order("start_date")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = result.data or []
        agg_events.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info("Loaded %d aggregator events to check", len(agg_events))

    if not agg_events:
        return []

    # ── Step 3 & 4: for each aggregator event, find venue-direct matches ──────
    # Collect all unique (venue_id, start_date) pairs to batch-fetch candidates.
    date_venue_keys: set[tuple[int, str]] = {
        (e["venue_id"], e["start_date"])
        for e in agg_events
        if e.get("venue_id") and e.get("start_date")
    }

    # Batch fetch venue-direct events for each (date, venue_id) combination.
    # Group by date to reduce query count.
    date_to_venue_ids: dict[str, set[int]] = {}
    for venue_id, start_date in date_venue_keys:
        date_to_venue_ids.setdefault(start_date, set()).add(venue_id)

    # venue_direct_map: (venue_id, start_date) -> list of non-aggregator events
    venue_direct_map: dict[tuple[int, str], list[dict]] = {}

    for start_date, venue_ids in date_to_venue_ids.items():
        venue_id_list = list(venue_ids)
        result = (
            client.table("events")
            .select("id, title, start_date, start_time, venue_id, source_id, canonical_event_id")
            .eq("start_date", start_date)
            .eq("is_active", True)
            .is_("canonical_event_id", "null")
            .in_("venue_id", venue_id_list)
            .not_.in_("source_id", agg_source_ids)
            .execute()
        )
        for row in (result.data or []):
            key = (row["venue_id"], row["start_date"])
            venue_direct_map.setdefault(key, []).append(row)

    # ── Step 5: fuzzy title matching ──────────────────────────────────────────
    # Scale min_similarity from 0.0–1.0 to 0–100 for rapidfuzz
    threshold_scaled = min_similarity * 100.0

    pairs: list[tuple[int, int]] = []
    seen_dupe_ids: set[int] = set()  # guard against double-reporting

    for agg_event in agg_events:
        venue_id = agg_event.get("venue_id")
        start_date = agg_event.get("start_date")
        agg_id = agg_event["id"]
        agg_title = agg_event.get("title") or ""
        agg_source_slug = agg_source_id_to_slug.get(agg_event.get("source_id"), "?")

        if not venue_id or not start_date or not agg_title:
            continue

        candidates = venue_direct_map.get((venue_id, start_date), [])
        if not candidates:
            continue

        agg_norm = _normalize_for_cross_source(agg_title)
        if not agg_norm:
            continue

        for candidate in candidates:
            candidate_id = candidate["id"]
            if candidate_id in seen_dupe_ids or agg_id in seen_dupe_ids:
                continue

            cand_norm = _normalize_for_cross_source(candidate.get("title") or "")
            if not cand_norm:
                continue

            score = fuzz.ratio(agg_norm, cand_norm)
            if score >= threshold_scaled:
                pairs.append((candidate_id, agg_id))
                seen_dupe_ids.add(agg_id)

                agg_title_display = agg_title[:70]
                cand_title_display = (candidate.get("title") or "")[:70]
                logger.info(
                    "MATCH (%.0f%%): keep=%d '%s' | dupe=%d [%s] '%s' | date=%s venue_id=%d",
                    score,
                    candidate_id,
                    cand_title_display,
                    agg_id,
                    agg_source_slug,
                    agg_title_display,
                    start_date,
                    venue_id,
                )
                break  # one match per aggregator event is enough

    logger.info("Found %d cross-source fuzzy duplicate pair(s)", len(pairs))

    # ── Step 6: optionally write canonical_event_id links ────────────────────
    if not dry_run and pairs:
        from db.client import writes_enabled

        if writes_enabled():
            linked = 0
            for keep_id, dupe_id in pairs:
                try:
                    client.table("events").update(
                        {"canonical_event_id": keep_id}
                    ).eq("id", dupe_id).execute()
                    linked += 1
                    logger.debug("Linked dupe=%d -> canonical=%d", dupe_id, keep_id)
                except Exception as exc:
                    logger.warning(
                        "Failed to link dupe=%d -> canonical=%d: %s",
                        dupe_id,
                        keep_id,
                        exc,
                    )
            logger.info("Wrote %d canonical_event_id link(s) to DB", linked)
        else:
            logger.warning(
                "Writes not enabled — skipping DB update for %d pair(s). "
                "Pass --execute and ensure DB write mode is active.",
                len(pairs),
            )
    elif dry_run and pairs:
        logger.info(
            "DRY RUN — %d pair(s) found, no DB changes written. "
            "Pass --execute to persist canonical_event_id links.",
            len(pairs),
        )

    return pairs


if __name__ == "__main__":
    import argparse
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Cross-source fuzzy dedup: find Ticketmaster/Eventbrite events "
        "that duplicate venue-direct entries via title suffix divergence."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Report pairs without writing to DB (default: True)",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write canonical_event_id links to DB (overrides --dry-run)",
    )
    parser.add_argument(
        "--min-similarity",
        type=float,
        default=0.80,
        help="Minimum title similarity 0.0-1.0 to declare a match (default: 0.80)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=60,
        help="How many days of future events to scan (default: 60)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    from db.client import get_client

    client = get_client()
    dry_run = not args.execute

    if dry_run:
        logger.info(
            "DRY RUN — no changes written (pass --execute to persist links)"
        )
    else:
        logger.info("EXECUTE MODE — canonical_event_id links will be written to DB")

    pairs = find_cross_source_duplicates(
        client,
        dry_run=dry_run,
        min_similarity=args.min_similarity,
        days_ahead=args.days,
    )

    print(f"\nFound {len(pairs)} duplicate pair(s)")
    if pairs:
        print(f"{'keep_id':>10}  {'dupe_id':>10}")
        print("-" * 24)
        for keep_id, dupe_id in pairs:
            print(f"{keep_id:>10}  {dupe_id:>10}")

    sys.exit(0)
