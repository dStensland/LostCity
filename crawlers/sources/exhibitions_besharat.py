"""
Besharat Contemporary exhibition crawler.

The gallery uses WordPress but has no exhibition custom post type registered
in the WP REST API. Exhibitions are WP pages under /exhibitions/<slug>/.
We discover them by fetching the WP pages list filtered to the /exhibitions/
parent path, then fetch each detail page for title, dates, description,
and artists.
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

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})"
)


def _parse_date(text: str) -> str | None:
    """Parse 'Month DD, YYYY' into YYYY-MM-DD."""
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


def _parse_date_range(text: str) -> tuple[str | None, str | None]:
    """Parse 'Month DD, YYYY - Month DD, YYYY' date range."""
    # Find all date occurrences
    dates = []
    for m in _DATE_RE.finditer(text):
        month = _MONTHS.get(m.group(1).lower())
        if month:
            try:
                dt = date(int(m.group(3)), month, int(m.group(2))).isoformat()
                dates.append(dt)
            except ValueError:
                pass

    if len(dates) >= 2:
        return dates[0], dates[1]
    if len(dates) == 1:
        return dates[0], None
    return None, None


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "Besharat Contemporary",
        "slug": "besharat-contemporary",
        "address": "163 Peters St SW",
        "neighborhood": "Castleberry Hill",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "lat": 33.7470,
        "lng": -84.3985,
        "place_type": "gallery",
        "website": "https://www.besharatcontemporary.com",
    }

    BASE_URL = "https://www.besharatcontemporary.com"

    def _get_exhibition_slugs(self, session: requests.Session) -> list[str]:
        """Discover exhibition page slugs via WP REST API pages endpoint."""
        slugs = []
        page = 1
        while True:
            try:
                resp = session.get(
                    f"{self.BASE_URL}/wp-json/wp/v2/pages",
                    params={"per_page": 100, "page": page},
                    timeout=20,
                )
                resp.raise_for_status()
                pages = resp.json()
            except Exception as exc:
                logger.warning("Besharat: WP pages API error: %s", exc)
                break

            if not pages:
                break

            for pg in pages:
                link = pg.get("link", "")
                if "/exhibitions/" in link:
                    # Extract the exhibition slug from the link
                    slug = pg.get("slug", "")
                    if slug:
                        slugs.append(slug)

            # Check if there are more pages
            total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
            if page >= total_pages:
                break
            page += 1
            time.sleep(0.3)

        return slugs

    def _parse_exhibition_page(
        self, session: requests.Session, slug: str
    ) -> dict | None:
        url = f"{self.BASE_URL}/exhibitions/{slug}/"
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("Besharat: failed to fetch %s: %s", url, exc)
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Title is in an h2 inside the page
        title_tag = soup.find("h2")
        if not title_tag:
            # Fall back to page title
            title_tag = soup.find("title")
        title = (title_tag.get_text(strip=True) if title_tag else slug.replace("-", " ").title())
        # Strip site name from title if present
        title = re.sub(r"\s*[\|–]\s*Besharat.*$", "", title, flags=re.IGNORECASE).strip()

        # Date range — look for "Month DD, YYYY - Month DD, YYYY" pattern
        date_text = ""
        for p in soup.find_all("p"):
            txt = p.get_text(strip=True)
            if re.search(r"[A-Za-z]+\s+\d{1,2},?\s+\d{4}", txt):
                date_text = txt
                break

        opening_date, closing_date = _parse_date_range(date_text)

        # Description — first substantive paragraph after the date
        description = None
        paragraphs = soup.find_all("p")
        for p in paragraphs:
            txt = p.get_text(strip=True)
            # Skip short strings, gallery info, and date strings
            if (
                len(txt) > 80
                and not re.search(r"^(Gallery:|Phone:|Parking:)", txt)
                and not re.search(r"\d{4}", txt[:30])
            ):
                description = txt[:500]
                break

        # Image — look for featured/og image
        image_url = None
        og_image = soup.find("meta", property="og:image")
        if og_image:
            image_url = og_image.get("content")
        if not image_url:
            img = soup.find("img", src=re.compile(r"https?://"))
            if img:
                image_url = img.get("src")

        # Artists — look for names in specific heading or listed links
        artists = []
        # Often artist names appear as the first heading after ARTISTS h4
        artist_heading = soup.find("h4", string=re.compile(r"artist", re.IGNORECASE))
        if artist_heading:
            # Artists are listed as links or text siblings
            for sib in artist_heading.next_siblings:
                if hasattr(sib, "name") and sib.name in ("h1", "h2", "h3", "h4"):
                    break
                if hasattr(sib, "name") and sib.name == "a":
                    name = sib.get_text(strip=True)
                    if name and len(name) > 2:
                        artists.append({"artist_name": name, "artist_url": sib.get("href")})
                elif hasattr(sib, "get_text"):
                    txt = sib.get_text(strip=True)
                    for name in re.split(r"[,;&]|\band\b", txt):
                        name = name.strip()
                        if name and len(name) > 3 and not re.search(r"\d", name):
                            artists.append({"artist_name": name})

        return {
            "title": title,
            "description": description,
            "opening_date": opening_date,
            "closing_date": closing_date,
            "image_url": image_url,
            "source_url": url,
            "exhibition_type": "solo" if len(artists) == 1 else "group",
            "artists": artists[:10],
        }

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        slugs = self._get_exhibition_slugs(session)
        if not slugs:
            logger.warning("Besharat: no exhibition slugs found via WP API")
            return []

        logger.info("Besharat: found %d exhibition pages to parse", len(slugs))
        exhibitions = []
        for slug in slugs:
            ex = self._parse_exhibition_page(session, slug)
            if ex and ex.get("title"):
                exhibitions.append(ex)
            time.sleep(0.8)

        return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
