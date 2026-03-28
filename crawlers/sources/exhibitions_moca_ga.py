"""
MOCA GA (Museum of Contemporary Art of Georgia) exhibition crawler.

The site uses WordPress but exhibitions are published as standard WP pages
at /YYYY-exhibitions/. The current/upcoming page loads via AJAX and has an
empty DOM, so we scrape the yearly pages directly. Each page has h3 titles
with a following <p> containing the date range.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import date

import requests
from bs4 import BeautifulSoup

from sources._exhibitions_base import GenericExhibitionCrawler

logger = logging.getLogger(__name__)

_DATE_PATTERN = re.compile(
    r"(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2}),?\s+(?P<year>\d{4})",
)
_SHORT_DATE_PATTERN = re.compile(
    r"(?P<month>[A-Za-z]+)\s+(?P<day>\d{1,2})(?:\s*[-–]\s*"
    r"(?:[A-Za-z]+\s+\d{1,2},?\s+)?(?P<year>\d{4}))?",
)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_date_range(text: str) -> tuple[str | None, str | None]:
    """Parse a date range string like 'Aug 30, 2025 - Oct 25, 2025'.

    Returns (opening_date, closing_date) as YYYY-MM-DD strings.
    """
    text = text.strip()
    # Split on dash/ndash
    parts = re.split(r"\s*[-–]\s*", text, maxsplit=1)

    def parse_one(s: str, fallback_year: int | None = None) -> str | None:
        s = s.strip()
        m = _DATE_PATTERN.search(s)
        if m:
            month = _MONTHS.get(m.group("month").lower())
            if not month:
                return None
            day = int(m.group("day"))
            year = int(m.group("year"))
            try:
                return date(year, month, day).isoformat()
            except ValueError:
                return None
        # Try without year
        m2 = re.match(r"([A-Za-z]+)\s+(\d{1,2})", s)
        if m2 and fallback_year:
            month = _MONTHS.get(m2.group(1).lower())
            if month:
                try:
                    return date(fallback_year, month, int(m2.group(2))).isoformat()
                except ValueError:
                    return None
        return None

    opening_date = None
    closing_date = None

    if len(parts) >= 1:
        opening_date = parse_one(parts[0])
    if len(parts) >= 2:
        # Extract year from closing date first, then use it for opening if needed
        closing_date = parse_one(parts[1])
        if closing_date and not opening_date:
            # Opening date may lack year — use closing year
            closing_year = int(closing_date[:4])
            opening_date = parse_one(parts[0], fallback_year=closing_year)

    return opening_date, closing_date


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "MOCA GA",
        "slug": "moca-ga",
        "address": "75 Bennett St NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.8009,
        "lng": -84.4011,
        "place_type": "museum",
        "website": "https://www.mocaga.org",
    }

    EXHIBITIONS_BASE = "https://mocaga.org"

    def _year_page_url(self, year: int) -> str:
        return f"{self.EXHIBITIONS_BASE}/{year}-exhibitions/"

    def _fetch_year_page(
        self, session: requests.Session, year: int
    ) -> list[dict]:
        url = self._year_page_url(year)
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("MOCA GA: failed to fetch %s: %s", url, exc)
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        main_div = soup.find("div", id="main")
        if not main_div:
            logger.warning("MOCA GA: no #main div on %s", url)
            return []

        exhibitions = []
        # Each exhibition is an h3 followed by a <p> containing the date range
        headings = main_div.find_all("h3")
        for h3 in headings:
            title = h3.get_text(strip=True)
            if not title:
                continue

            # Look for date in following paragraph
            date_text = ""
            nxt = h3.find_next_sibling("p")
            if nxt:
                date_text = nxt.get_text(strip=True)

            opening_date, closing_date = _parse_date_range(date_text)

            # Look for link on the heading or nearby
            link = h3.find("a")
            source_url = None
            if link and link.get("href"):
                href = link.get("href")
                source_url = href if href.startswith("http") else f"{self.EXHIBITIONS_BASE}{href}"

            # Try to find link in the next sibling anchor
            if not source_url:
                for sib in h3.next_siblings:
                    if hasattr(sib, "name") and sib.name == "h3":
                        break
                    if hasattr(sib, "name") and sib.name == "a":
                        href = sib.get("href", "")
                        if href:
                            source_url = href if href.startswith("http") else f"{self.EXHIBITIONS_BASE}{href}"
                        break

            exhibitions.append({
                "title": title,
                "description": None,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": None,
                "source_url": source_url or url,
                "exhibition_type": "group",
                "artists": [],
            })

        return exhibitions

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        current_year = date.today().year
        all_exhibitions: list[dict] = []

        # Check current year, next year (in case it exists), and previous year
        # (galleries often don't post a new yearly page until mid-year).
        for year in (current_year + 1, current_year, current_year - 1):
            results = self._fetch_year_page(session, year)
            all_exhibitions.extend(results)
            if results:
                time.sleep(0.5)

        logger.info("MOCA GA: found %d exhibitions across year pages", len(all_exhibitions))
        return all_exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
