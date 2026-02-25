"""
Crawler for NCG Cinemas Acworth.

Navigates to ncgmovies.com showtime page,
extracts movie titles and showtimes using Playwright.
1 location: Acworth.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class NCGAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "NCG Cinemas"
    CHAIN_TAG = "ncg"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "NCG Acworth Cinema",
                "slug": "ncg-acworth",
                "address": "4432 Cinema Dr",
                "neighborhood": "Acworth",
                "city": "Acworth",
                "state": "GA",
                "zip": "30101",
                "venue_type": "cinema",
                "website": "https://www.ncgmovies.com/movie-theater/acworth",
                "lat": 34.0649,
                "lng": -84.6671,
            },
            "url_slug": "acworth",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://www.ncgmovies.com/movie-theater/{slug}?date={date_str}"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from NCG showtime page."""
        movies = []

        try:
            page.wait_for_selector(".nowPlaying__item, .button--showtime", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            return self._extract_from_text(page)

        containers = page.query_selector_all(".nowPlaying__item")
        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                title = ""
                title_el = container.query_selector(".nowPlaying__movieTitle, h3")
                if title_el:
                    title = title_el.inner_text().strip()
                    if not title:
                        title = (title_el.get_attribute("title") or "").strip()

                if not title:
                    img_for_title = container.query_selector("img.nowPlaying__img, img")
                    alt = (img_for_title.get_attribute("alt") if img_for_title else None) or ""
                    if alt:
                        title = alt.replace(" Movie Poster", "").strip()

                if not title or len(title) < 2:
                    continue
                title = " ".join(title.split())

                time_elements = container.query_selector_all("a.button--showtime")
                times = []
                for el in time_elements:
                    try:
                        text = el.inner_text().strip()
                        parsed = parse_time(text)
                        if parsed and parsed not in times:
                            times.append(parsed)
                    except Exception:
                        continue

                if not times:
                    continue

                img_el = container.query_selector("img.nowPlaying__img, img")
                image_url = None
                if img_el:
                    image_url = (
                        img_el.get_attribute("data-src")
                        or img_el.get_attribute("src")
                        or img_el.get_attribute("data-srcset")
                        or img_el.get_attribute("srcset")
                    )
                    if image_url and "," in image_url:
                        image_url = image_url.split(",")[0].strip().split(" ")[0]

                movies.append({"title": title, "times": times, "image_url": image_url})

            except Exception as e:
                logger.debug(f"  Error parsing NCG movie container: {e}")
                continue

        return movies

    def _extract_from_text(self, page: Page) -> list[dict]:
        """Fallback text-based extraction."""
        movies = []
        try:
            body_text = page.inner_text("body")
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]

            time_pattern = re.compile(r'^(\d{1,2}:\d{2})\s*(AM|PM)$', re.IGNORECASE)
            current_movie = None
            current_times: list[str] = []

            for line in lines:
                time_match = time_pattern.match(line)
                if time_match:
                    parsed = parse_time(line)
                    if parsed and current_movie and parsed not in current_times:
                        current_times.append(parsed)
                elif len(line) > 3:
                    if current_movie and current_times:
                        movies.append({"title": current_movie, "times": current_times, "image_url": None})
                    skip_words = ["NCG", "Filter", "Sort", "Today", "Select", "Menu", "Trax"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({"title": current_movie, "times": current_times, "image_url": None})
        except Exception as e:
            logger.warning(f"  NCG text extraction failed: {e}")
        return movies


_crawler = NCGAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
