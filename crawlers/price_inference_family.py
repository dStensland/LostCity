#!/usr/bin/env python3
"""
Family Portal Price Inference.

Fills in is_free=true for events where pricing is unknown but the source or
content strongly implies the event is free. Targets the 55% price-gap in the
family portal but can run against any portal or the full event set.

Rules applied (each is independent — any match marks the event free):
  1. Library source  — libraries do not charge admission for their programs.
  2. "free" in title or description text.
  3. "$0", "no cost", or "no charge" in description.
  4. Parks & rec source AND ("open play" or "drop-in" or "drop in") in title
     or description.
  5. ticket_url contains "eventbrite" AND ("free" in ticket_url or is_free
     already parseable from the URL as a free ticket).

Only events where is_free IS NULL AND price_min IS NULL AND price_max IS NULL
are considered — we never overwrite explicit pricing decisions.

Usage:
    python price_inference_family.py                          # dry-run (safe)
    python price_inference_family.py --portal atlanta-families # scope to portal
    python price_inference_family.py --apply                  # write to DB
    python price_inference_family.py --apply --portal atlanta-families
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from repo root before importing db/config
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db.client import get_client  # noqa: E402

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Source classification
# ---------------------------------------------------------------------------

# Any source whose slug or name contains "library" is treated as free.
# IDs cached at runtime from the sources table.
_LIBRARY_IDS: Optional[set[int]] = None

# Parks & recreation source IDs — free only when open play / drop-in signals
# are present in the event text.
_PARKS_IDS: Optional[set[int]] = None


def _load_library_ids(sb) -> set[int]:
    global _LIBRARY_IDS
    if _LIBRARY_IDS is not None:
        return _LIBRARY_IDS
    result = (
        sb.table("sources")
        .select("id")
        .or_("slug.ilike.%library%,name.ilike.%library%")
        .execute()
    )
    _LIBRARY_IDS = {row["id"] for row in result.data}
    logger.debug("Library source IDs: %s", _LIBRARY_IDS)
    return _LIBRARY_IDS


def _load_parks_ids(sb) -> set[int]:
    global _PARKS_IDS
    if _PARKS_IDS is not None:
        return _PARKS_IDS
    result = (
        sb.table("sources")
        .select("id")
        .or_(
            "slug.ilike.%parks%,"
            "name.ilike.%parks%,"
            "slug.ilike.%-rec,"
            "slug.ilike.%-recreation,"
            "name.ilike.%recreation%"
        )
        .execute()
    )
    _PARKS_IDS = {row["id"] for row in result.data}
    logger.debug("Parks & rec source IDs: %s", _PARKS_IDS)
    return _PARKS_IDS


# ---------------------------------------------------------------------------
# Rule helpers
# ---------------------------------------------------------------------------

_OPEN_PLAY_TERMS = ("open play", "drop-in", "drop in", "dropin")

# Patterns that look like "free" but are NOT free-admission signals.
# These are checked against the surrounding context window when "free" appears.
_FREE_FALSE_POSITIVE_CONTEXTS = (
    "free trial",
    "free consultation",
    "free demo",
    "free choice",
    "free time",
    "feel free",
    "toll-free",
    "toll free",
    "sugar-free",
    "gluten-free",
    "carefree",
    "hands-free",
    "hands free",
    "camera-free",
    "device-free",
    "screen-free",
    "worry-free",
    "worry free",
    "guilt-free",
    "obligation-free",
    "cage-free",
    "allergen-free",
    "chemical-free",
    "drug-free",
    "smoke-free",
    "nut-free",
    "dairy-free",
    "stress-free",
    "hassle-free",
)

# Strong indicators in the title that the event itself is free admission
_FREE_TITLE_PATTERNS = (
    "free admission",
    "free event",
    "free to attend",
    "free and open",
    "free program",
    "free class",
    "free workshop",
    "free concert",
    "free for all",
    "free community",
    "free public",
    "(free)",
    "[free]",
)

# Strong indicators in the description that admission/attendance is free
_FREE_DESC_PATTERNS = (
    "admission is free",
    "admission: free",
    "free admission",
    "free to attend",
    "free to all",
    "free and open to the public",
    "free event",
    "free for all",
    "free public",
    "attendance is free",
    "no admission",
    "no registration fee",
    "free registration",
)

_ZERO_PRICE_TERMS = ("$0", "no cost", "no charge")


def _lower(text: Optional[str]) -> str:
    return (text or "").lower()


def _rule_library_source(event: dict, library_ids: set[int]) -> Optional[str]:
    """Rule 1: Library sources are always free."""
    if event.get("source_id") in library_ids:
        return "library_source"
    return None


def _rule_free_in_text(event: dict) -> Optional[str]:
    """
    Rule 2+3: Structured free-admission signals in title or description.

    Requires specific admission-language patterns rather than bare 'free'
    to avoid false positives like 'free trial', 'feel free', 'gluten-free'.
    Also catches '$0', 'no cost', 'no charge'.
    """
    title = _lower(event.get("title"))
    desc = _lower(event.get("description"))

    # Strong free-admission patterns in title
    for pattern in _FREE_TITLE_PATTERNS:
        if pattern in title:
            return f"free_title:{pattern!r}"

    # Strong free-admission patterns in description
    for pattern in _FREE_DESC_PATTERNS:
        if pattern in desc:
            return f"free_desc:{pattern!r}"

    # Zero-price explicit strings (safe, no false positives)
    for term in _ZERO_PRICE_TERMS:
        if term in title or term in desc:
            return f"zero_price:{term!r}"

    return None


def _rule_parks_open_play(event: dict, parks_ids: set[int]) -> Optional[str]:
    """Rule 4: Parks & rec source with open play / drop-in signal."""
    if event.get("source_id") not in parks_ids:
        return None
    title = _lower(event.get("title"))
    desc = _lower(event.get("description"))
    for term in _OPEN_PLAY_TERMS:
        if term in title or term in desc:
            return f"parks_open_play:{term!r}"
    return None


def _rule_eventbrite_free(event: dict) -> Optional[str]:
    """Rule 5: Eventbrite ticket URL with 'free' in it."""
    ticket_url = _lower(event.get("ticket_url") or "")
    if "eventbrite" in ticket_url and "free" in ticket_url:
        return "eventbrite_free_url"
    return None


def _classify_event(
    event: dict,
    library_ids: set[int],
    parks_ids: set[int],
) -> Optional[str]:
    """
    Return the rule name that marks this event as free, or None if no rule fires.
    """
    for check in (
        lambda: _rule_library_source(event, library_ids),
        lambda: _rule_free_in_text(event),
        lambda: _rule_parks_open_play(event, parks_ids),
        lambda: _rule_eventbrite_free(event),
    ):
        result = check()
        if result:
            return result
    return None


# ---------------------------------------------------------------------------
# Fetch events
# ---------------------------------------------------------------------------

_PAGE_SIZE = 1000


def _fetch_unpriced_events(sb, portal_id: Optional[str]) -> list[dict]:
    """Fetch all events where is_free, price_min, price_max are all NULL."""
    events: list[dict] = []
    offset = 0
    while True:
        query = (
            sb.table("events")
            .select("id,title,description,source_id,ticket_url")
            .is_("is_free", "null")
            .is_("price_min", "null")
            .is_("price_max", "null")
        )
        if portal_id:
            query = query.eq("portal_id", portal_id)
        result = query.range(offset, offset + _PAGE_SIZE - 1).execute()
        events.extend(result.data)
        if len(result.data) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return events


# ---------------------------------------------------------------------------
# Apply updates
# ---------------------------------------------------------------------------

_UPDATE_BATCH = 100


def _apply_updates(sb, event_ids: list[str]) -> int:
    """Batch-update is_free=True for the given event IDs. Returns count updated."""
    updated = 0
    for i in range(0, len(event_ids), _UPDATE_BATCH):
        batch = event_ids[i : i + _UPDATE_BATCH]
        sb.table("events").update({"is_free": True}).in_("id", batch).execute()
        updated += len(batch)
    return updated


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(portal_slug: Optional[str], apply: bool, verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )

    sb = get_client()

    # Resolve portal ID
    portal_id: Optional[str] = None
    portal_label = "all portals"
    if portal_slug:
        result = (
            sb.table("portals")
            .select("id,name")
            .eq("slug", portal_slug)
            .single()
            .execute()
        )
        if not result.data:
            logger.error("Portal not found: %s", portal_slug)
            sys.exit(1)
        portal_id = result.data["id"]
        portal_label = f"{result.data['name']} ({portal_slug})"

    logger.info("Loading source classifications...")
    library_ids = _load_library_ids(sb)
    parks_ids = _load_parks_ids(sb)
    logger.info(
        "  %d library sources, %d parks/rec sources identified",
        len(library_ids),
        len(parks_ids),
    )

    logger.info("Fetching unpriced events for %s...", portal_label)
    events = _fetch_unpriced_events(sb, portal_id)
    logger.info("  %d events with no price info", len(events))

    # Classify
    to_mark_free: list[str] = []
    rule_counts: dict[str, int] = {}
    still_unknown: list[dict] = []

    for event in events:
        rule = _classify_event(event, library_ids, parks_ids)
        if rule:
            to_mark_free.append(event["id"])
            # Normalize rule key for reporting
            rule_key = rule.split(":")[0]
            rule_counts[rule_key] = rule_counts.get(rule_key, 0) + 1
            if verbose:
                logger.debug(
                    "  [%s] %s — rule=%s",
                    event["id"],
                    (event.get("title") or "")[:60],
                    rule,
                )
        else:
            still_unknown.append(event)

    # Summary
    print()
    print("=" * 60)
    print(f"Price Inference Summary — {portal_label}")
    print("=" * 60)
    print(f"  Unpriced events scanned:        {len(events)}")
    print(f"  Would be marked is_free=true:   {len(to_mark_free)}")
    print(f"  Still unknown after inference:  {len(still_unknown)}")
    print()
    if rule_counts:
        print("  Rules fired:")
        for rule_key, count in sorted(rule_counts.items(), key=lambda x: -x[1]):
            print(f"    {rule_key}: {count}")
    print()

    if not to_mark_free:
        print("Nothing to update.")
        return

    if not apply:
        print(
            "DRY RUN — no changes made. Re-run with --apply to write to the database."
        )
        return

    print(f"Applying {len(to_mark_free)} updates...")
    updated = _apply_updates(sb, to_mark_free)
    print(f"Done. Marked {updated} events as is_free=true.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Infer is_free=true for family portal events with missing price info."
    )
    parser.add_argument(
        "--portal",
        metavar="SLUG",
        default=None,
        help="Scope to a specific portal by slug (e.g. atlanta-families). "
        "Omit to run across all portals.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Write inferred values to the database. Default is dry-run.",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        default=False,
        help="Log each event being classified.",
    )
    args = parser.parse_args()
    run(portal_slug=args.portal, apply=args.apply, verbose=args.verbose)


if __name__ == "__main__":
    main()
