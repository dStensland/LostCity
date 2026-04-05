# crawlers/sources/exhibitions_base.py
"""
Template base classes for gallery/museum exhibition crawlers.

Provides WordPress and Squarespace templates that galleries can configure
via data dicts instead of writing full crawler files. Also provides a
generic base for custom galleries.

Usage:
    class MyGallery(WordPressExhibitionCrawler):
        PLACE_DATA = { ... }
        WP_EXHIBITION_POST_TYPE = "exhibition"

    def crawl(source):
        return MyGallery().crawl(source)
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from datetime import date

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place
from db.exhibitions import insert_exhibition

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
_REQUEST_TIMEOUT = 20
_DETAIL_DELAY_S = 1.0


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------


class ExhibitionCrawlerBase(ABC):
    """Abstract base for exhibition crawlers."""

    PLACE_DATA: dict = {}  # Override in subclass

    def _make_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({"User-Agent": _USER_AGENT})
        return session

    def _get_venue_id(self) -> int:
        return get_or_create_place(self.PLACE_DATA)

    @abstractmethod
    def get_exhibitions(self, session: requests.Session, source: dict) -> list[dict]:
        """Return list of exhibition dicts with keys:
        title, description, opening_date, closing_date, image_url,
        source_url, exhibition_type, artists (list of dicts with artist_name, artist_url)
        """
        ...

    def crawl(self, source: dict) -> tuple[int, int, int]:
        source_id = source["id"]
        session = self._make_session()
        venue_id = self._get_venue_id()

        exhibitions = self.get_exhibitions(session, source)
        found = new = updated = 0
        today = date.today().isoformat()

        for ex in exhibitions:
            found += 1
            closing = ex.get("closing_date")

            # Skip past exhibitions
            if closing and closing < today:
                continue

            artists = ex.pop("artists", None) or []
            exhibition_data = {
                "title": ex["title"],
                "place_id": venue_id,
                "source_id": source_id,
                "opening_date": ex.get("opening_date"),
                "closing_date": closing,
                "description": ex.get("description"),
                "image_url": ex.get("image_url"),
                "source_url": ex.get("source_url"),
                "exhibition_type": ex.get("exhibition_type", "group"),
                "is_active": True,
                "_venue_name": self.PLACE_DATA.get("name", "gallery"),
            }

            result = insert_exhibition(exhibition_data, artists=artists)
            if result:
                new += 1

        return found, new, updated


# ---------------------------------------------------------------------------
# WordPress template
# ---------------------------------------------------------------------------


class WordPressExhibitionCrawler(ExhibitionCrawlerBase):
    """Crawl exhibitions from WordPress REST API.

    Override these class attributes:
        PLACE_DATA: dict — full venue data dict
        WP_BASE_URL: str — e.g. "https://gallery.example.com"
        WP_EXHIBITION_POST_TYPE: str — "exhibition" or "exhibitions" (varies by theme)
        WP_PER_PAGE: int — results per page (default 20)
    """

    WP_BASE_URL: str = ""
    WP_EXHIBITION_POST_TYPE: str = "exhibition"
    WP_PER_PAGE: int = 20

    def get_exhibitions(self, session: requests.Session, source: dict) -> list[dict]:
        url = f"{self.WP_BASE_URL}/wp-json/wp/v2/{self.WP_EXHIBITION_POST_TYPE}"
        params = {"per_page": self.WP_PER_PAGE, "status": "publish", "_embed": "true"}

        try:
            resp = session.get(url, params=params, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
            posts = resp.json()
        except Exception as e:
            logger.error("WordPress API failed for %s: %s", self.WP_BASE_URL, e)
            return []

        exhibitions = []
        for post in posts:
            title = (post.get("title", {}).get("rendered") or "").strip()
            if not title:
                continue

            content_html = post.get("content", {}).get("rendered", "")
            soup = BeautifulSoup(content_html, "html.parser")
            description = soup.get_text(separator=" ", strip=True)[:500]

            # Try to get featured image
            image_url = None
            embedded = post.get("_embedded", {})
            featured = embedded.get("wp:featuredmedia", [])
            if featured and isinstance(featured[0], dict):
                image_url = featured[0].get("source_url")

            # Parse dates from post meta or content
            opening_date = None
            closing_date = None
            meta = post.get("meta", {}) or post.get("acf", {}) or {}
            if isinstance(meta, dict):
                opening_date = meta.get("opening_date") or meta.get("start_date")
                closing_date = meta.get("closing_date") or meta.get("end_date")

            exhibitions.append({
                "title": title,
                "description": description,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "image_url": image_url,
                "source_url": post.get("link"),
                "exhibition_type": "group",
                "artists": [],
            })

            time.sleep(_DETAIL_DELAY_S)

        return exhibitions


# ---------------------------------------------------------------------------
# Squarespace template
# ---------------------------------------------------------------------------


class SquarespaceExhibitionCrawler(ExhibitionCrawlerBase):
    """Crawl exhibitions from Squarespace ?format=json API.

    Override these class attributes:
        PLACE_DATA: dict — full venue data dict
        SQUARESPACE_URL: str — URL of the exhibitions page (e.g. "https://gallery.com/exhibitions")
    """

    SQUARESPACE_URL: str = ""

    def get_exhibitions(self, session: requests.Session, source: dict) -> list[dict]:
        url = f"{self.SQUARESPACE_URL}?format=json"
        try:
            resp = session.get(url, timeout=_REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error("Squarespace API failed for %s: %s", self.SQUARESPACE_URL, e)
            return []

        items = data.get("items", [])
        exhibitions = []

        for item in items:
            title = (item.get("title") or "").strip()
            if not title:
                continue

            # Extract description from body HTML
            body_html = item.get("body") or ""
            soup = BeautifulSoup(body_html, "html.parser")
            description = soup.get_text(separator=" ", strip=True)[:500]

            # Image
            image_url = item.get("assetUrl") or item.get("socialImageUrl")

            # URL
            item_url = item.get("fullUrl")

            exhibitions.append({
                "title": title,
                "description": description,
                "opening_date": None,
                "closing_date": None,
                "image_url": image_url,
                "source_url": item_url,
                "exhibition_type": "group",
                "artists": [],
            })

            time.sleep(_DETAIL_DELAY_S)

        return exhibitions


# ---------------------------------------------------------------------------
# Generic HTML template
# ---------------------------------------------------------------------------


class GenericExhibitionCrawler(ExhibitionCrawlerBase):
    """Generic template for galleries with custom HTML structure.

    Override these class attributes:
        PLACE_DATA: dict — full venue data dict
        EXHIBITIONS_URL: str — URL of the exhibitions listing page

    Override get_exhibitions() to implement custom HTML parsing.
    """

    EXHIBITIONS_URL: str = ""
