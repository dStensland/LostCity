"""
Hathaway Contemporary Gallery exhibition crawler.

The site runs on photobiz.com (custom gallery CMS). The exhibitions page at
/exhibitions1 lists all shows as <a> elements. Each <a> contains a
list-editorial-layout__info div with:
  - <h3>: exhibition title (or artist name for solo shows)
  - <p>: "Artist Name | Date Range" (or "Subtitle | Date Range")

A lazy-loaded thumbnail image is embedded in data-lazy-image on the <img>.
For current/upcoming shows we also fetch the detail page for description.
"""
from __future__ import annotations

import calendar
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

_FULL_DATE_RE = re.compile(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})")
_PARTIAL_DATE_RE = re.compile(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?")
_MONTH_YEAR_RE = re.compile(r"([A-Za-z]+)\s+(\d{4})")

_NAV_HREFS = frozenset({"/exhibitions1", "/fairs", "/press", "/about", "/"})


def _parse_date_or_none(month_str: str, day: int, year: int) -> str | None:
    month = _MONTHS.get(month_str.lower())
    if not month:
        return None
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _parse_date_range(text: str) -> tuple[str | None, str | None]:
    """Parse exhibition date range text. Returns (opening, closing) as ISO strings."""
    if not text:
        return None, None

    text = re.sub(r"[–—]", "-", text)

    dates_full = list(_FULL_DATE_RE.finditer(text))
    dates_partial = list(_PARTIAL_DATE_RE.finditer(text))

    if len(dates_full) >= 2:
        d1 = _parse_date_or_none(dates_full[0].group(1), int(dates_full[0].group(2)), int(dates_full[0].group(3)))
        d2 = _parse_date_or_none(dates_full[1].group(1), int(dates_full[1].group(2)), int(dates_full[1].group(3)))
        return d1, d2

    if len(dates_full) == 1:
        closing_year = int(dates_full[0].group(3))
        closing = _parse_date_or_none(dates_full[0].group(1), int(dates_full[0].group(2)), closing_year)
        opening = None
        for m in dates_partial:
            if m.start() < dates_full[0].start():
                opening = _parse_date_or_none(m.group(1), int(m.group(2)), closing_year)
                break
        return opening, closing

    # Handle "Month YYYY" format (no day number)
    my_matches = list(_MONTH_YEAR_RE.finditer(text))
    if my_matches:
        last = my_matches[-1]
        month = _MONTHS.get(last.group(1).lower())
        if month:
            yr = int(last.group(2))
            try:
                last_day = calendar.monthrange(yr, month)[1]
                closing = date(yr, month, last_day).isoformat()
                if len(my_matches) > 1:
                    first = my_matches[0]
                    mon0 = _MONTHS.get(first.group(1).lower())
                    opening = date(int(first.group(2)), mon0, 1).isoformat() if mon0 else None
                else:
                    opening = date(yr, month, 1).isoformat()
                return opening, closing
            except ValueError:
                pass

    return None, None


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "Hathaway Contemporary Gallery",
        "slug": "hathaway-contemporary-gallery",
        "address": "2322 Peachtree Rd NW",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.8278,
        "lng": -84.3856,
        "place_type": "gallery",
        "website": "https://www.hathawaygallery.com",
    }

    EXHIBITIONS_URL = "https://www.hathawaygallery.com/exhibitions1"
    BASE_URL = "https://www.hathawaygallery.com"

    def _fetch_detail_page(
        self, session: requests.Session, slug: str
    ) -> tuple[str | None, str | None]:
        """Fetch exhibition detail page. Returns (description, image_url)."""
        url = f"{self.BASE_URL}{slug}"
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code != 200:
                return None, None
        except requests.RequestException:
            return None, None

        soup = BeautifulSoup(resp.text, "html.parser")

        description = None
        for p in soup.find_all("p"):
            txt = p.get_text(strip=True)
            if len(txt) > 100:
                description = txt[:500]
                break

        image_url = None
        og = soup.find("meta", property="og:image")
        if og:
            image_url = og.get("content")
        if not image_url:
            for img in soup.find_all("img"):
                src = img.get("src", "")
                if src.startswith("https://image") and "photobiz" in src:
                    image_url = src
                    break

        return description, image_url

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        try:
            resp = session.get(self.EXHIBITIONS_URL, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Hathaway: failed to fetch exhibitions page: %s", exc)
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        today = date.today().isoformat()

        exhibitions = []
        seen_slugs: set[str] = set()

        for a in soup.find_all("a"):
            href = a.get("href", "")
            if not href or not href.startswith("/") or href in _NAV_HREFS:
                continue
            if href in seen_slugs:
                continue
            seen_slugs.add(href)

            # Photobiz structure: list-editorial-layout__info div with h3 + p
            info_div = a.find("div", class_="list-editorial-layout__info")
            if not info_div:
                continue

            h3 = info_div.find("h3")
            p = info_div.find("p")
            h3_text = h3.get_text(strip=True) if h3 else ""
            p_text = p.get_text(strip=True) if p else ""

            if not h3_text:
                continue

            # p_text format: "Secondary Text | Date Range"
            # The date portion is after the last " | "
            date_text = ""
            secondary_text = ""
            if " | " in p_text:
                idx = p_text.rfind(" | ")
                secondary_text = p_text[:idx].strip()
                date_text = p_text[idx + 3:].strip()
            else:
                # No separator — the whole p_text may be the date
                if re.search(r"[A-Za-z]+\s+\d", p_text):
                    date_text = p_text
                else:
                    secondary_text = p_text

            opening_date, closing_date = _parse_date_range(date_text)

            # Artist names from secondary_text
            artists = []
            if secondary_text:
                for name in re.split(r"\s+and\s+|\s*[,&]\s*", secondary_text):
                    name = name.strip()
                    if name and len(name) > 3:
                        artists.append({"artist_name": name})

            # Lazy-loaded image
            image_url = None
            img = a.find("img")
            if img:
                candidate = img.get("data-lazy-image") or img.get("src", "")
                if candidate and not candidate.startswith("data:"):
                    image_url = candidate

            exhibitions.append({
                "title": h3_text,
                "description": None,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": image_url,
                "source_url": f"{self.BASE_URL}{href}",
                "exhibition_type": "solo" if len(artists) == 1 else "group",
                "artists": artists,
                "_slug": href,
            })

        # For current/upcoming shows, fetch detail pages for description
        enriched = []
        for ex in exhibitions:
            slug = ex.pop("_slug")
            closing = ex.get("closing_date")
            if closing and closing < today:
                enriched.append(ex)
                continue

            description, detail_image = self._fetch_detail_page(session, slug)
            if description:
                ex["description"] = description
            if detail_image and not ex.get("image_url"):
                ex["image_url"] = detail_image
            enriched.append(ex)
            time.sleep(0.5)

        logger.info("Hathaway: parsed %d exhibitions from listing page", len(enriched))
        return enriched


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
