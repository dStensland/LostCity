"""
Mason Fine Art exhibition crawler.

Mason uses the ArtCloud CMS (artcld.com). The exhibitions page loads shows
via a React app (client-side AJAX), but each show page embeds a rich
JSON-LD block with @type ExhibitionEvent including title, description,
startDate, endDate, and image. Additionally, the homepage static HTML
contains visible links to /show/<slug> pages.

Strategy:
1. Scrape homepage and exhibitions page for /show/ links
2. For each unique show slug, fetch the show page and parse JSON-LD
"""
from __future__ import annotations

import html
import json
import logging
import re
import time

import requests
from bs4 import BeautifulSoup

from sources._exhibitions_base import GenericExhibitionCrawler

logger = logging.getLogger(__name__)

_SHOW_URL_RE = re.compile(r'href=["\']?(https://masonfineartandevents\.com/show/[^"\'> ]+)')


def _parse_date(date_str: str | None) -> str | None:
    """Parse ISO date or datetime string to YYYY-MM-DD."""
    if not date_str:
        return None
    # Handle "2026-02-06T00:00:00.0000000" format
    m = re.match(r"(\d{4}-\d{2}-\d{2})", date_str)
    if m:
        return m.group(1)
    return None


class _Crawler(GenericExhibitionCrawler):
    PLACE_DATA = {
        "name": "Mason Fine Art",
        "slug": "mason-fine-art",
        "address": "761-D Miami Cir NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30324",
        "lat": 33.8439,
        "lng": -84.3735,
        "place_type": "gallery",
        "website": "https://masonfineartandevents.com",
    }

    BASE_URL = "https://masonfineartandevents.com"
    DISCOVERY_PAGES = [
        "https://masonfineartandevents.com",
        "https://masonfineartandevents.com/exhibitions",
    ]

    def _discover_show_slugs(self, session: requests.Session) -> list[str]:
        """Collect unique show slugs from homepage and exhibitions page HTML."""
        slugs: list[str] = []
        seen: set[str] = set()

        for page_url in self.DISCOVERY_PAGES:
            try:
                resp = session.get(page_url, timeout=20)
                resp.raise_for_status()
            except requests.RequestException as exc:
                logger.warning("Mason: failed to fetch %s: %s", page_url, exc)
                continue

            for m in _SHOW_URL_RE.finditer(resp.text):
                full_url = m.group(1)
                slug = full_url.rsplit("/show/", 1)[-1].strip("/")
                if slug and slug not in seen:
                    seen.add(slug)
                    slugs.append(slug)

            time.sleep(0.5)

        return slugs

    def _parse_show_page(
        self, session: requests.Session, slug: str
    ) -> dict | None:
        url = f"{self.BASE_URL}/show/{slug}"
        try:
            resp = session.get(url, timeout=20)
            if resp.status_code != 200:
                return None
        except requests.RequestException as exc:
            logger.warning("Mason: failed to fetch show %s: %s", slug, exc)
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # Find the ExhibitionEvent JSON-LD block
        exhibition_data: dict | None = None
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.get_text())
                if data.get("@type") == "ExhibitionEvent":
                    exhibition_data = data
                    break
            except (json.JSONDecodeError, ValueError):
                continue

        if not exhibition_data:
            logger.warning("Mason: no ExhibitionEvent JSON-LD on %s", url)
            return None

        title = html.unescape(exhibition_data.get("name", "")).strip()
        if not title:
            return None

        description_raw = html.unescape(exhibition_data.get("description", ""))
        description = description_raw[:1000] if description_raw else None

        opening_date = _parse_date(exhibition_data.get("startDate"))
        closing_date = _parse_date(exhibition_data.get("endDate"))

        # Image from JSON-LD or og:image
        image_url = exhibition_data.get("image")
        if not image_url:
            og_img = soup.find("meta", property="og:image")
            if og_img:
                image_url = og_img.get("content")

        # Artists from the ItemList JSON-LD block
        artists = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.get_text())
                if data.get("@type") == "ItemList" and data.get("name") == "Artists":
                    for item in data.get("itemListElement", []):
                        artist_url = item.get("url", "")
                        # Extract artist name from URL slug
                        if artist_url:
                            parts = artist_url.rstrip("/").rsplit("/", 1)
                            name_from_slug = parts[-1].replace("-", " ").title()
                            if name_from_slug:
                                artists.append({
                                    "artist_name": name_from_slug,
                                    "artist_url": artist_url,
                                })
            except (json.JSONDecodeError, ValueError):
                continue

        return {
            "title": title,
            "description": description,
            "opening_date": opening_date,
            "closing_date": closing_date,
            "image_url": image_url,
            "source_url": url,
            "exhibition_type": "solo" if len(artists) == 1 else "group",
            "artists": artists,
        }

    def get_exhibitions(
        self, session: requests.Session, source: dict
    ) -> list[dict]:
        slugs = self._discover_show_slugs(session)
        if not slugs:
            logger.warning("Mason: no show slugs found on homepage/exhibitions pages")
            return []

        logger.info("Mason: found %d unique show slugs", len(slugs))
        exhibitions = []
        for slug in slugs:
            ex = self._parse_show_page(session, slug)
            if ex:
                exhibitions.append(ex)
            time.sleep(0.8)

        return exhibitions


def crawl(source: dict) -> tuple[int, int, int]:
    return _Crawler().crawl(source)
