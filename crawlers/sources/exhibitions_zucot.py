"""
ZuCot Gallery exhibition crawler.

ZuCot is on Squarespace but the ?format=json API returns empty items arrays
for all collection pages. Instead we scrape the homepage HTML for the current
featured exhibition, and the past-exhibitions page for additional shows.
"""
from __future__ import annotations

import logging
import re
from datetime import date

import requests
from bs4 import BeautifulSoup

from sources._exhibitions_base import GenericExhibitionCrawler

logger = logging.getLogger(__name__)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_DATE_RE = re.compile(r"([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})")
_YEAR_RANGE_RE = re.compile(r"\b(\d{4})\b")


def _parse_date(text: str) -> str | None:
    m = _DATE_RE.search(text)
    if not m:
        return None
    month = _MONTHS.get(m.group(1).lower())
    if not month:
        return None
    try:
        return date(int(m.group(3)), month, int(m.group(2))).isoformat()
    except ValueError:
        return None


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "ZuCot Gallery",
        "slug": "zucot-gallery",
        "address": "100 Centennial Olympic Park Dr SW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.7597,
        "lng": -84.3976,
        "place_type": "gallery",
        "website": "https://www.zucotgallery.com",
    }

    BASE_URL = "https://www.zucotgallery.com"

    def _scrape_page_for_exhibitions(
        self, session: requests.Session, url: str
    ) -> list[dict]:
        """Scrape a ZuCot page for exhibition title+description blocks."""
        try:
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("ZuCot: failed to fetch %s: %s", url, exc)
            return []

        soup = BeautifulSoup(resp.text, "html.parser")

        # ZuCot homepage: featured exhibition is in a <section> with h1 title
        # and a <p> description below it.
        exhibitions = []
        sections = soup.find_all("section")

        for section in sections:
            title_tag = section.find(["h1", "h2", "h3"])
            if not title_tag:
                continue

            title = title_tag.get_text(strip=True)
            # Skip navigation/header sections
            if len(title) < 4 or title.upper() in ("HOME", "ARTISTS", "PRESS", "CONTACT"):
                continue

            # Description: check <p> tags first, then fall back to block text
            # (Squarespace often puts description in sqs-layout divs, not <p>)
            description = None
            for p in section.find_all("p"):
                txt = p.get_text(strip=True)
                if len(txt) > 50:
                    description = txt[:500]
                    break

            if not description:
                # Try any div with substantial text content
                for div in section.find_all("div"):
                    div_txt = div.get_text(strip=True)
                    if len(div_txt) > 80 and title not in div_txt[:len(title) + 5]:
                        description = div_txt[:500]
                        break
                    elif len(div_txt) > 80 and title in div_txt:
                        # Strip the title prefix and use the rest as description
                        rest = div_txt[div_txt.find(title) + len(title):].strip()
                        if len(rest) > 50:
                            description = rest[:500]
                            break

            # Image
            image_url = None
            img = section.find("img", src=re.compile(r"https?://"))
            if img:
                image_url = img.get("src")

            # Try to find a link to the exhibition detail page
            source_url = url
            for a in section.find_all("a"):
                href = a.get("href", "")
                if href and href.startswith("/") and len(href) > 2:
                    source_url = f"{self.BASE_URL}{href}"
                    break

            exhibitions.append({
                "title": title,
                "description": description,
                "opening_date": None,
                "closing_date": None,
                "image_url": image_url,
                "source_url": source_url,
                "exhibition_type": "group",
                "artists": [],
            })

        return exhibitions

    # Section titles that are not exhibition names
    _JUNK_TITLES = frozenset({
        "ZUCOT VIRTUAL GALLERY",
        "ARTISTS INTERVIEWS",
        "COME, SEE, COLLECT.",
        "HOME",
        "CONTACT",
        "ABOUT",
        "PRESS",
    })

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        # Scrape the homepage for the currently featured exhibition
        homepage_exs = self._scrape_page_for_exhibitions(session, self.BASE_URL)

        # Filter: must have description, must not be a known junk section header
        filtered = [
            e for e in homepage_exs
            if e.get("description")
            and e.get("title", "").upper().strip() not in self._JUNK_TITLES
        ][:3]

        if filtered:
            logger.info("ZuCot: found %d exhibitions on homepage", len(filtered))
        else:
            logger.warning("ZuCot: no exhibitions with descriptions found on homepage")

        return filtered


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
