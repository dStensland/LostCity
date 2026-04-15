"""
Backfill exhibitions.closing_date by scraping source_url pages and inferring defaults.

Strategy:
1. For each exhibition with null closing_date, fetch source_url
2. Extract closing date from page text using patterns:
   - Date range: "Month DD – Month DD, YYYY"
   - Through: "through Month DD", "on view through"
   - Closes: "closes Month DD", "closing Month DD"
   - JSON-LD: endDate in structured data
3. If no date found and exhibition_type != 'permanent':
   - Infer 3-month default from opening_date
   - Tag with metadata.closing_date_inferred = true

Run: cd crawlers && PYTHONPATH=. python3 scripts/exhibition_closing_dates.py [--dry-run]
"""

import argparse
import json
import logging
import re
import sys
import time
from datetime import date, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_MONTH_NAMES = "|".join(_MONTHS.keys())

# Pattern: "through May 15, 2026" or "on view through May 15"
_THROUGH_RE = re.compile(
    rf"(?:through|thru|until|closes?|closing)\s+({_MONTH_NAMES})\s+(\d{{1,2}}),?\s*(\d{{4}})?",
    re.IGNORECASE,
)

# Pattern: "Month DD – Month DD, YYYY" (date range with end date)
_RANGE_END_RE = re.compile(
    rf"[-–—]\s*({_MONTH_NAMES})\s+(\d{{1,2}}),?\s*(\d{{4}})",
    re.IGNORECASE,
)

# JSON-LD endDate
_JSON_LD_RE = re.compile(r'"endDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"')


def _parse_month_day_year(month_str: str, day_str: str, year_str: Optional[str]) -> Optional[str]:
    month = _MONTHS.get(month_str.lower())
    if not month:
        return None
    day = int(day_str)
    year = int(year_str) if year_str else date.today().year
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def extract_closing_date(text: str) -> Optional[str]:
    """Extract a closing date from page text or HTML."""
    if not text:
        return None

    # Try JSON-LD first (most structured)
    m = _JSON_LD_RE.search(text)
    if m:
        return m.group(1)

    # Try "through/closes Month DD, YYYY"
    m = _THROUGH_RE.search(text)
    if m:
        return _parse_month_day_year(m.group(1), m.group(2), m.group(3))

    # Try date range end "– Month DD, YYYY"
    m = _RANGE_END_RE.search(text)
    if m:
        return _parse_month_day_year(m.group(1), m.group(2), m.group(3))

    return None


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition closing dates")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max exhibitions to process")
    args = parser.parse_args()

    client = get_client()
    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})

    # Fetch exhibitions with null closing_date
    query = client.table("exhibitions").select(
        "id, title, source_url, opening_date, closing_date, exhibition_type, metadata"
    ).eq("is_active", True).is_("closing_date", "null")

    result = query.execute()
    exhibitions = result.data or []

    if args.limit:
        exhibitions = exhibitions[:args.limit]

    logger.info("Processing %d exhibitions with null closing_date", len(exhibitions))

    scraped = 0
    inferred = 0
    failed = 0

    for ex in exhibitions:
        source_url = ex.get("source_url", "")
        title = ex.get("title", "")

        closing_date = None
        source_url_yielded_date = False

        # Try to scrape from source_url
        if source_url and source_url.startswith("http"):
            try:
                resp = session.get(source_url, timeout=15)
                if resp.status_code == 200:
                    closing_date = extract_closing_date(resp.text)
                    if closing_date:
                        source_url_yielded_date = True
                        scraped += 1
                        logger.info("  Scraped: %s → %s", title[:50], closing_date)
                time.sleep(1)  # Rate limit
            except Exception as e:
                logger.debug("  Failed to fetch %s: %s", source_url[:60], e)

        # Infer 3-month default if no scraped date
        if not closing_date and ex.get("opening_date") and ex.get("exhibition_type") != "permanent":
            try:
                opening = date.fromisoformat(ex["opening_date"])
                closing_date = (opening + timedelta(days=90)).isoformat()
                inferred += 1
                logger.debug("  Inferred: %s → %s (3-month default)", title[:50], closing_date)
            except ValueError:
                failed += 1
                continue

        if not closing_date:
            failed += 1
            continue

        # Validate: closing_date must be >= opening_date (DB constraint)
        if ex.get("opening_date"):
            try:
                if date.fromisoformat(closing_date) < date.fromisoformat(ex["opening_date"]):
                    logger.debug("  Skipped %s — closing %s < opening %s", title[:50], closing_date, ex["opening_date"])
                    failed += 1
                    continue
            except ValueError:
                pass

        # Track whether this was scraped or inferred
        was_inferred = closing_date and not source_url_yielded_date

        if not args.dry_run:
            update_data: dict = {"closing_date": closing_date}

            # Tag inferred dates with provenance metadata
            if was_inferred:
                metadata = ex.get("metadata") or {}
                metadata["closing_date_inferred"] = True
                update_data["metadata"] = metadata

            try:
                client.table("exhibitions").update(update_data).eq("id", ex["id"]).execute()
            except Exception as e:
                logger.warning("  Failed to update %s: %s", title[:50], e)
                failed += 1

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total processed: %d", len(exhibitions))
    logger.info("Scraped from source_url: %d", scraped)
    logger.info("Inferred (3-month default): %d", inferred)
    logger.info("No date found: %d", failed)

    if args.dry_run:
        logger.info("DRY RUN — no changes written.")


if __name__ == "__main__":
    main()
