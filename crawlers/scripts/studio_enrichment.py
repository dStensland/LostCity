# crawlers/scripts/studio_enrichment.py
"""
Enrich studio venues with studio-specific metadata.

Visits each studio venue's website and extracts studio type, availability,
rates, and application URL from 'Rentals'/'Studios' subpages.

Run: cd crawlers && python3 scripts/studio_enrichment.py --dry-run
     cd crawlers && python3 scripts/studio_enrichment.py --apply
"""

import argparse
import logging
import re
import time

import requests
from bs4 import BeautifulSoup

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
_REQUEST_TIMEOUT = 15

RENTAL_PATHS = ["/rentals", "/rental", "/studios", "/studio-rental",
                "/availability", "/spaces", "/studio-spaces", "/rent"]

STUDIO_TYPE_KEYWORDS = {
    "private": "private",
    "shared": "shared",
    "co-op": "coop",
    "coop": "coop",
    "cooperative": "coop",
    "residency": "residency",
    "makerspace": "makerspace",
    "maker space": "makerspace",
}

RATE_RE = re.compile(r"\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?(?:\s*/\s*(?:month|mo|monthly))?", re.IGNORECASE)


def enrich_studio(venue: dict, dry_run: bool = True) -> dict:
    """Visit a studio venue's website and extract studio metadata."""
    website = venue.get("website")
    if not website:
        return {}

    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})

    updates = {}

    for path in RENTAL_PATHS:
        url = website.rstrip("/") + path
        try:
            resp = session.get(url, timeout=_REQUEST_TIMEOUT, allow_redirects=True)
            if resp.status_code != 200:
                continue
            text = resp.text.lower()

            # Check for studio type keywords
            for keyword, studio_type in STUDIO_TYPE_KEYWORDS.items():
                if keyword in text:
                    updates.setdefault("studio_type", studio_type)
                    break

            # Check for rates
            soup = BeautifulSoup(resp.text, "html.parser")
            body_text = soup.get_text()
            rate_match = RATE_RE.search(body_text)
            if rate_match:
                updates["monthly_rate_range"] = rate_match.group()

            # Check for availability status
            avail_keywords = {
                "available": "available",
                "now leasing": "available",
                "accepting applications": "available",
                "waitlist": "waitlist",
                "wait list": "waitlist",
                "fully leased": "unavailable",
                "no availability": "unavailable",
                "no vacancies": "unavailable",
                "sold out": "unavailable",
            }
            for keyword, status in avail_keywords.items():
                if keyword in text:
                    updates.setdefault("availability_status", status)
                    break

            # Check for application URL
            for a in soup.find_all("a", href=True):
                href_text = (a.get_text() or "").lower()
                if any(w in href_text for w in ("apply", "application", "inquire", "request")):
                    updates["studio_application_url"] = a["href"]
                    break

            if updates:
                logger.info("  Found studio info at %s: %s", path, updates)
                break

        except requests.RequestException:
            continue

        time.sleep(0.5)

    return updates


def run_enrichment(dry_run: bool = True):
    client = get_client()

    result = client.table("venues").select(
        "id, name, website, venue_type, studio_type"
    ).eq("venue_type", "studio").is_("studio_type", "null").execute()

    venues = result.data
    logger.info("Unenriched studio venues: %d", len(venues))

    enriched = 0
    for venue in venues:
        logger.info("Checking %s (%s)", venue["name"], venue.get("website") or "no website")
        updates = enrich_studio(venue, dry_run=dry_run)

        if updates and not dry_run:
            client.table("venues").update(updates).eq("id", venue["id"]).execute()
            enriched += 1
        elif updates:
            enriched += 1

    logger.info("Enriched %d / %d studios%s", enriched, len(venues), " (dry run)" if dry_run else "")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    run_enrichment(dry_run=not args.apply)
