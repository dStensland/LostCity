"""
Alan Avery Art Company exhibition crawler.

The gallery runs on Wix. The homepage navigation contains links to:
  - /current-exhibition-<slug> — the currently running show
  - /upcoming-exhibitions — upcoming shows (often empty)

We discover the current exhibition URL from the homepage nav CURRENT link,
then parse the show page for title, dates, description, and images.
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

_BASE_URL = "https://www.alanaveryartcompany.com"

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_DATE_RE = re.compile(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})")
_SHORT_DATE_RE = re.compile(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?")
_YEAR_RE = re.compile(r"\b(\d{4})\b")


def _parse_date(text: str, fallback_year: int | None = None) -> str | None:
    m = _DATE_RE.search(text)
    if m:
        mon = _MONTHS.get(m.group(1).lower())
        if mon:
            try:
                return date(int(m.group(3)), mon, int(m.group(2))).isoformat()
            except ValueError:
                return None
    if fallback_year:
        m2 = _SHORT_DATE_RE.search(text)
        if m2:
            mon = _MONTHS.get(m2.group(1).lower())
            if mon:
                try:
                    return date(fallback_year, mon, int(m2.group(2))).isoformat()
                except ValueError:
                    return None
    return None


def _parse_date_range(text: str) -> tuple[str | None, str | None]:
    """Parse date range like 'April 4 - July 31' or 'April 4, 2025 - July 31, 2025'."""
    text = re.sub(r"[–—]", "-", text)
    parts = re.split(r"\s*-\s*", text, maxsplit=1)

    # Determine year: prefer explicit year from either part
    year_match = _YEAR_RE.search(text)
    year = int(year_match.group(1)) if year_match else date.today().year

    closing = _parse_date(parts[1], fallback_year=year) if len(parts) > 1 else None
    if closing:
        closing_year = int(closing[:4])
        opening = _parse_date(parts[0], fallback_year=closing_year)
    else:
        opening = _parse_date(parts[0], fallback_year=year)

    return opening, closing


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "Alan Avery Art Company",
        "slug": "alan-avery-art-company",
        "address": "656 Miami Cir NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "lat": 33.8432,
        "lng": -84.3735,
        "place_type": "gallery",
        "website": "https://www.alanaveryartcompany.com",
    }

    def _find_exhibition_urls(self, session: requests.Session) -> list[str]:
        """Discover current and upcoming exhibition URLs from the homepage nav."""
        try:
            resp = session.get(_BASE_URL, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Alan Avery: failed to fetch homepage: %s", exc)
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        urls = []
        seen: set[str] = set()

        for a in soup.find_all("a"):
            href = a.get("href", "")
            link_text = a.get_text(strip=True).upper()
            # Look for CURRENT and UPCOMING nav links
            if not href or href in seen:
                continue
            if "CURRENT" in link_text and "current" in href.lower():
                seen.add(href)
                full = href if href.startswith("http") else f"{_BASE_URL}{href}"
                urls.append(full)
            elif "UPCOMING" in link_text and "upcoming" in href.lower():
                seen.add(href)
                full = href if href.startswith("http") else f"{_BASE_URL}{href}"
                urls.append(full)

        return urls

    def _parse_exhibition_page(
        self, session: requests.Session, url: str
    ) -> list[dict]:
        """Parse an Alan Avery exhibition page. Returns 0 or more exhibition dicts."""
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code != 200:
                return []
        except requests.RequestException as exc:
            logger.warning("Alan Avery: failed to fetch %s: %s", url, exc)
            return []

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find exhibition entries — each current show is a block with:
        #  h2: "Current Exhibition" or "Upcoming Exhibitions"
        #  h2: [Exhibition Title]
        #  h2: [Artist Name]
        #  h2: [Date range]
        #  p: [Description]

        exhibitions = []
        headings = soup.find_all("h2")

        # Skip the first "Current Exhibition" / "Upcoming Exhibitions" heading
        # Work through blocks: title -> artists -> dates -> description
        i = 0
        while i < len(headings):
            h = headings[i]
            txt = h.get_text(strip=True)

            # Skip section headers
            if txt.upper() in ("CURRENT EXHIBITION", "UPCOMING EXHIBITIONS", "PAST EXHIBITIONS"):
                i += 1
                continue

            # Look for a date-like pattern in one of the next 3 headings
            date_text = None
            title = txt
            artist_names = []

            # Scan forward for date heading
            j = i + 1
            while j < min(i + 5, len(headings)):
                next_txt = headings[j].get_text(strip=True)
                if re.search(r"[A-Za-z]+\s+\d+", next_txt):
                    date_text = next_txt
                    # Anything between title and date is artist names
                    for k in range(i + 1, j):
                        artist_txt = headings[k].get_text(strip=True)
                        if artist_txt and not re.search(r"[A-Za-z]+\s+\d+", artist_txt):
                            # Split by "and " or "&"
                            for name in re.split(r"\s+and\s+|\s*&\s*", artist_txt):
                                name = name.strip()
                                if name and len(name) > 3:
                                    artist_names.append(name)
                    break
                j += 1

            if not title or len(title) < 3:
                i += 1
                continue

            opening_date, closing_date = _parse_date_range(date_text or "")

            # Description: find paragraphs between this heading and the next section
            description = None
            for p in h.find_all_next("p"):
                ptxt = p.get_text(strip=True)
                # Stop at gallery address / hours
                if any(x in ptxt for x in ["Miami Circle", "Gallery hours", "Hours Tues", "info@"]):
                    break
                if len(ptxt) > 50:
                    description = ptxt[:500]
                    break

            # Image: look for Wix image following this heading
            image_url = None
            for img in h.find_all_next("img"):
                src = img.get("src", "")
                if "wixstatic" in src and "media" in src:
                    image_url = src
                    break

            artists = [{"artist_name": name} for name in artist_names[:10]]

            exhibitions.append({
                "title": title,
                "description": description,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": image_url,
                "source_url": url,
                "exhibition_type": "solo" if len(artists) == 1 else "group",
                "artists": artists,
            })

            # Advance past the block we just parsed
            i = j + 1

        return exhibitions

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        exhibition_urls = self._find_exhibition_urls(session)
        if not exhibition_urls:
            logger.warning("Alan Avery: no exhibition URLs found on homepage")
            return []

        all_exhibitions: list[dict] = []
        for url in exhibition_urls:
            exs = self._parse_exhibition_page(session, url)
            all_exhibitions.extend(exs)
            time.sleep(0.5)

        logger.info("Alan Avery: found %d exhibitions", len(all_exhibitions))
        return all_exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
