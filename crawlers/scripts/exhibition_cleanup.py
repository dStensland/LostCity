"""
One-time exhibition data cleanup.

Fixes:
1. Junk titles (Kai Lin Art "View Fullsize" artifacts)
2. Non-exhibition content (concerts, animal encounters, sports)
3. Lifecycle sweep (stale exhibitions with NULL closing_date)
4. Duplicate cleanup (keep best row, delete rest)
5. Cook's Warehouse venue_type fix

Run: cd crawlers && python3 scripts/exhibition_cleanup.py --dry-run
     cd crawlers && python3 scripts/exhibition_cleanup.py --apply
"""

import argparse
import logging
import re
from datetime import date, timedelta

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

JUNK_TITLE_RE = re.compile(
    r"^(view\s+fullsize|download\s+(press|release|pdf|image|file|brochure)|click\s+here|read\s+more|learn\s+more)",
    re.IGNORECASE,
)

# Titles that are clearly not exhibitions (identified in data audit)
NON_EXHIBITION_TITLES = {
    "live animal encounter",
    "klezmer",
}

TWO_YEARS_AGO = (date.today() - timedelta(days=730)).isoformat()


def run_cleanup(dry_run: bool = True):
    client = get_client()
    stats = {
        "junk_removed": 0,
        "non_exhibition_removed": 0,
        "stale_deactivated": 0,
        "duplicates_found": 0,
        "duplicates_deleted": 0,
        "venue_fixes": 0,
    }

    # Fetch all exhibitions
    result = client.table("exhibitions").select(
        "id, title, venue_id, opening_date, closing_date, exhibition_type, is_active, source_id"
    ).execute()
    exhibitions = result.data

    logger.info("Total exhibition rows: %d", len(exhibitions))

    # 1. Junk titles
    for ex in exhibitions:
        if JUNK_TITLE_RE.match(ex["title"]):
            logger.info("JUNK: %r (id=%s)", ex["title"], ex["id"])
            stats["junk_removed"] += 1
            if not dry_run:
                client.table("exhibition_artists").delete().eq("exhibition_id", ex["id"]).execute()
                client.table("exhibitions").delete().eq("id", ex["id"]).execute()

    # 2. Non-exhibition content
    for ex in exhibitions:
        if ex["title"].strip().lower() in NON_EXHIBITION_TITLES:
            logger.info("NON-EXHIBITION: %r (id=%s)", ex["title"], ex["id"])
            stats["non_exhibition_removed"] += 1
            if not dry_run:
                client.table("exhibition_artists").delete().eq("exhibition_id", ex["id"]).execute()
                client.table("exhibitions").delete().eq("id", ex["id"]).execute()

    # 3. Lifecycle sweep
    today = date.today().isoformat()
    for ex in exhibitions:
        if not ex["is_active"]:
            continue

        # Past closing date → deactivate
        if ex.get("closing_date") and ex["closing_date"] < today:
            logger.info("EXPIRED: %r closing_date=%s (id=%s)", ex["title"], ex["closing_date"], ex["id"])
            stats["stale_deactivated"] += 1
            if not dry_run:
                client.table("exhibitions").update({"is_active": False}).eq("id", ex["id"]).execute()
            continue

        # No closing date + old opening + not permanent → deactivate
        if (
            not ex.get("closing_date")
            and ex.get("opening_date")
            and ex["opening_date"] < TWO_YEARS_AGO
            and ex.get("exhibition_type") != "permanent"
        ):
            logger.info(
                "STALE (no close date, opened %s): %r (id=%s)",
                ex["opening_date"],
                ex["title"],
                ex["id"],
            )
            stats["stale_deactivated"] += 1
            if not dry_run:
                client.table("exhibitions").update({"is_active": False}).eq("id", ex["id"]).execute()

    # 4. Duplicate cleanup — keep the row with most data, delete the rest
    seen: dict = {}  # (title_lower, venue_id) → best row
    dupes_to_delete = []
    for ex in exhibitions:
        key = (ex["title"].strip().lower(), ex["venue_id"])
        if key in seen:
            stats["duplicates_found"] += 1
            existing = seen[key]
            # Prefer the one with a closing_date set
            if ex.get("closing_date") and not existing.get("closing_date"):
                dupes_to_delete.append(existing["id"])
                seen[key] = ex
            else:
                dupes_to_delete.append(ex["id"])
            logger.info(
                "DUPLICATE: %r at venue %s — keeping id=%s, deleting id=%s",
                ex["title"],
                ex["venue_id"],
                seen[key]["id"],
                dupes_to_delete[-1],
            )
        else:
            seen[key] = ex

    if dupes_to_delete:
        logger.info("Duplicate rows to delete: %d", len(dupes_to_delete))
        if not dry_run:
            for dup_id in dupes_to_delete:
                client.table("exhibition_artists").delete().eq("exhibition_id", dup_id).execute()
                client.table("exhibitions").delete().eq("id", dup_id).execute()
            stats["duplicates_deleted"] = len(dupes_to_delete)

    # 5. Fix Cook's Warehouse venue_type
    cooks = client.table("places").select("id, name, venue_type").ilike("name", "%cook%warehouse%").execute()
    for v in cooks.data:
        if v.get("venue_type") == "studio":
            logger.info("VENUE FIX: %r venue_type studio → event_space (id=%s)", v["name"], v["id"])
            stats["venue_fixes"] += 1
            if not dry_run:
                client.table("places").update({"place_type": "event_space"}).eq("id", v["id"]).execute()

    logger.info("--- Summary ---")
    for k, v in stats.items():
        logger.info("  %s: %d", k, v)
    if dry_run:
        logger.info("DRY RUN — no changes made. Use --apply to execute.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="One-time exhibition data cleanup")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default is dry run)")
    args = parser.parse_args()
    run_cleanup(dry_run=not args.apply)
