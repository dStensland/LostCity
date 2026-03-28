"""
Post-crawl cross-source event deduplication.

Finds events from different sources that represent the same real-world event
and links them via canonical_event_id. Does NOT delete — just establishes
canonical relationships so the web layer can merge them.

The insert-time function find_cross_source_canonical_for_insert() (db/events.py)
handles new events as they arrive. This batch job covers historical data that
pre-dates that function, and cases where venue_id differs between sources (e.g.,
a venue had two slugs, or Ticketmaster used a slightly different venue record).

Usage:
    python3 post_crawl_dedup.py [--dry-run] [--days N] [--verbose]
    python3 post_crawl_dedup.py --write --days 60
"""

import argparse
import logging
import re
from datetime import date, timedelta

from db.client import get_client, writes_enabled

logger = logging.getLogger(__name__)


def normalize_title(title: str) -> str:
    """Normalize title for comparison: lowercase, strip articles/punctuation, collapse whitespace.

    Intentionally simpler than _normalize_title_for_natural_key in db/events.py —
    that function strips presenter prefixes and collapses sports matchup separators,
    which adds complexity. For batch dedup we want a stable, readable key.
    """
    t = (title or "").lower().strip()
    # Strip leading articles
    t = re.sub(r"^(the|a|an)\s+", "", t)
    # Strip status suffixes (sold out, cancelled, etc.) so they don't prevent matching
    t = re.sub(
        r"\s*\((sold[\s-]?out|rescheduled|cancelled|postponed|waitlist)\)\s*$",
        "",
        t,
        flags=re.IGNORECASE,
    )
    # Remove punctuation
    t = re.sub(r"[^\w\s]", " ", t)
    # Collapse whitespace
    t = re.sub(r"\s+", " ", t).strip()
    return t


def find_duplicate_clusters(days_ahead: int = 30) -> list[list[dict]]:
    """Find clusters of events that match on (normalized_title, start_date, venue_id)
    across different sources.

    Returns list of clusters, where each cluster is a list of event dicts.
    Only returns clusters with 2+ events from different sources.

    Note: this function fetches all active, non-linked future events in the window
    and groups them in-process. For large windows (> 90 days) on a large dataset,
    consider chunking by date range.
    """
    client = get_client()
    today = date.today().isoformat()
    future = (date.today() + timedelta(days=days_ahead)).isoformat()

    # Paginate to avoid Supabase default 1,000 row limit
    PAGE_SIZE = 1000
    events: list[dict] = []
    offset = 0
    while True:
        result = (
            client.table("events")
            .select(
                "id, title, start_date, start_time, place_id, source_id, "
                "canonical_event_id, image_url, description, ticket_url, "
                "created_at, is_active, data_quality"
            )
            .gte("start_date", today)
            .lte("start_date", future)
            .eq("is_active", True)
            .is_("canonical_event_id", "null")
            .order("start_date")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        page = result.data or []
        events.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info("Loaded %d future active events for dedup analysis", len(events))

    # Group by (normalized_title, start_date, place_id)
    groups: dict[tuple, list[dict]] = {}
    for event in events:
        norm = normalize_title(event.get("title") or "")
        start_date = event.get("start_date")
        place_id = event.get("place_id") or event.get("venue_id")

        # Skip if any key component is missing — can't reliably match
        if not norm or not start_date or not place_id:
            continue

        key = (norm, start_date, place_id)
        groups.setdefault(key, []).append(event)

    # Filter to clusters with events from at least 2 distinct sources
    clusters = []
    for key, group in groups.items():
        source_ids = {e["source_id"] for e in group}
        if len(source_ids) >= 2:
            clusters.append(group)
            logger.debug(
                "Cluster key=%s sources=%s event_ids=%s",
                key,
                source_ids,
                [e["id"] for e in group],
            )

    return clusters


def pick_canonical(cluster: list[dict]) -> dict:
    """Pick the best event in a cluster to be the canonical record.

    Priority (lower tuple = preferred):
    1. Highest data_quality score (negated so higher = better)
    2. Has image_url
    3. Has description (longer is better)
    4. Has ticket_url
    5. Earliest created_at (original listing wins ties)
    """

    def score(event: dict) -> tuple:
        dq = event.get("data_quality") or 0
        has_image = 1 if event.get("image_url") else 0
        desc_len = len(event.get("description") or "")
        has_ticket = 1 if event.get("ticket_url") else 0
        created = event.get("created_at") or ""
        # Negate numeric fields so min() picks the "best" (highest quality)
        return (-dq, -has_image, -desc_len, -has_ticket, created)

    return min(cluster, key=score)


def link_duplicates(
    clusters: list[list[dict]], dry_run: bool = True
) -> tuple[int, int]:
    """For each cluster, pick a canonical event and set canonical_event_id on the others.

    Returns (clusters_processed, events_linked).
    """
    client = get_client()
    clusters_processed = 0
    events_linked = 0

    for cluster in clusters:
        canonical = pick_canonical(cluster)
        others = [e for e in cluster if e["id"] != canonical["id"]]

        if not others:
            continue

        canonical_title = (canonical.get("title") or "")[:60]
        logger.info(
            "Cluster: '%s' on %s — canonical=%d (source=%s), linking %d duplicate(s)",
            canonical_title,
            canonical.get("start_date"),
            canonical["id"],
            canonical.get("source_id"),
            len(others),
        )

        if not dry_run and writes_enabled():
            for event in others:
                try:
                    client.table("events").update(
                        {"canonical_event_id": canonical["id"]}
                    ).eq("id", event["id"]).execute()
                    events_linked += 1
                    logger.debug(
                        "  Linked event %d (source=%s) -> canonical %d",
                        event["id"],
                        event.get("source_id"),
                        canonical["id"],
                    )
                except Exception as e:
                    logger.warning(
                        "  Failed to link event %d -> %d: %s",
                        event["id"],
                        canonical["id"],
                        e,
                    )
        else:
            events_linked += len(others)
            for event in others:
                logger.info(
                    "  [DRY-RUN] Would link event %d (source=%s) -> canonical %d",
                    event["id"],
                    event.get("source_id"),
                    canonical["id"],
                )

        clusters_processed += 1

    return clusters_processed, events_linked


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Cross-source event deduplication batch job"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Show what would be linked without writing (default: True)",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Actually write canonical links to DB (overrides --dry-run)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Look ahead N days for duplicates (default: 30)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    dry_run = not args.write
    if dry_run:
        logger.info("DRY RUN — no changes will be written (pass --write to commit)")
    else:
        logger.info("WRITE MODE — canonical links will be persisted to DB")

    clusters = find_duplicate_clusters(days_ahead=args.days)
    logger.info("Found %d cross-source duplicate cluster(s)", len(clusters))

    if not clusters:
        logger.info("No cross-source duplicates found in the next %d days", args.days)
        return

    processed, linked = link_duplicates(clusters, dry_run=dry_run)
    action = "Would link" if dry_run else "Linked"
    logger.info(
        "%s %d event(s) across %d cluster(s)",
        action,
        linked,
        processed,
    )


if __name__ == "__main__":
    main()
