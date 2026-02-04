"""
Crawler for AMC Theatres Atlanta-area locations.

Navigates to amctheatres.com showtime pages for each location,
extracts movie titles and showtimes using Playwright.
6 locations: Phipps Plaza, North DeKalb, Southlake Pavilion,
Sugarloaf Mills, Camp Creek, Mansell Crossing.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)


class AMCAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "AMC Theatres"
    CHAIN_TAG = "amc"
    LOCATIONS = [
        {
            "venue_data": {
                "name": "AMC Phipps Plaza 14",
                "slug": "amc-phipps-plaza",
                "address": "3500 Peachtree Rd NE",
                "neighborhood": "Buckhead",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30326",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-phipps-plaza-14",
                "lat": 33.8522,
                "lng": -84.3628,
            },
            "url_slug": "amc-phipps-plaza-14",
        },
        {
            "venue_data": {
                "name": "AMC North DeKalb 16",
                "slug": "amc-north-dekalb",
                "address": "2042 Lawrenceville Hwy",
                "neighborhood": "North DeKalb",
                "city": "Decatur",
                "state": "GA",
                "zip": "30033",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-north-dekalb-16",
                "lat": 33.8086,
                "lng": -84.2806,
            },
            "url_slug": "amc-north-dekalb-16",
        },
        {
            "venue_data": {
                "name": "AMC Southlake Pavilion 24",
                "slug": "amc-southlake-pavilion",
                "address": "7065 Mount Zion Blvd",
                "neighborhood": "Morrow",
                "city": "Morrow",
                "state": "GA",
                "zip": "30260",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-southlake-pavilion-24",
                "lat": 33.5833,
                "lng": -84.3513,
            },
            "url_slug": "amc-southlake-pavilion-24",
        },
        {
            "venue_data": {
                "name": "AMC Sugarloaf Mills 18",
                "slug": "amc-sugarloaf-mills",
                "address": "5900 Sugarloaf Pkwy",
                "neighborhood": "Lawrenceville",
                "city": "Lawrenceville",
                "state": "GA",
                "zip": "30043",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-sugarloaf-mills-18",
                "lat": 34.0025,
                "lng": -84.0488,
            },
            "url_slug": "amc-sugarloaf-mills-18",
        },
        {
            "venue_data": {
                "name": "AMC Camp Creek 14",
                "slug": "amc-camp-creek",
                "address": "3760 Princeton Lakes Pkwy",
                "neighborhood": "Camp Creek",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30331",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-camp-creek-14",
                "lat": 33.6555,
                "lng": -84.5148,
            },
            "url_slug": "amc-camp-creek-14",
        },
        {
            "venue_data": {
                "name": "AMC Mansell Crossing 14",
                "slug": "amc-mansell-crossing",
                "address": "7730 North Point Pkwy",
                "neighborhood": "Alpharetta",
                "city": "Alpharetta",
                "state": "GA",
                "zip": "30022",
                "venue_type": "cinema",
                "website": "https://www.amctheatres.com/movie-theatres/atlanta/amc-mansell-crossing-14",
                "lat": 34.0536,
                "lng": -84.2806,
            },
            "url_slug": "amc-mansell-crossing-14",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        date_str = date.strftime("%Y-%m-%d")
        slug = location["url_slug"]
        return f"https://www.amctheatres.com/movie-theatres/atlanta/{slug}/showtimes/all/{date_str}/all"

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from AMC showtime page.

        AMC renders movie cards with showtime buttons. Structure:
        - Movie title in h3 or showtime card header
        - Showtime buttons with time text
        - Movie poster images
        """
        movies = []

        try:
            # Wait for showtime content to load
            page.wait_for_selector(".ShowtimeButtons-amenityBtn, .Showtime--a, .showtimes-movie-container", timeout=10000)
        except Exception:
            logger.debug(f"  No showtime elements found for {location['venue_data']['name']}")
            # Try alternate approach with page text
            return self._extract_from_text(page)

        # Try to find movie containers
        containers = page.query_selector_all(".ShowtimesMovieCard, .showtimes-movie-container, [data-testid='showtime-movie-card']")

        if not containers:
            return self._extract_from_text(page)

        for container in containers:
            try:
                # Extract title
                title_el = container.query_selector("h3, h2, .MovieTitleHeader-title, [data-testid='movie-title']")
                if not title_el:
                    continue
                title = title_el.inner_text().strip()
                if not title or len(title) < 2:
                    continue

                # Clean title
                title = " ".join(title.split())

                # Extract showtimes
                time_buttons = container.query_selector_all(".Showtime--a, .ShowtimeButtons-amenityBtn, button[data-testid='showtime-btn']")
                times = []
                for btn in time_buttons:
                    try:
                        btn_text = btn.inner_text().strip()
                        parsed = parse_time(btn_text)
                        if parsed and parsed not in times:
                            times.append(parsed)
                    except Exception:
                        continue

                if not times:
                    continue

                # Extract image
                img_el = container.query_selector("img")
                image_url = None
                if img_el:
                    image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                movies.append({
                    "title": title,
                    "times": times,
                    "image_url": image_url,
                })

            except Exception as e:
                logger.debug(f"  Error parsing AMC movie container: {e}")
                continue

        return movies

    def _extract_from_text(self, page: Page) -> list[dict]:
        """Fallback text-based extraction for AMC pages."""
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
                elif len(line) > 3 and not time_pattern.match(line) and not line.startswith("•"):
                    # Potential movie title - save previous movie
                    if current_movie and current_times:
                        movies.append({
                            "title": current_movie,
                            "times": current_times,
                            "image_url": None,
                        })
                    # Check if this looks like a movie title (not UI text)
                    skip_words = ["AMC", "Filter", "Sort", "Today", "Select", "Menu", "Sign", "Gift"]
                    if not any(line.startswith(w) for w in skip_words) and len(line) < 100:
                        current_movie = " ".join(line.split())
                        current_times = []
                    else:
                        current_movie = None
                        current_times = []

            if current_movie and current_times:
                movies.append({
                    "title": current_movie,
                    "times": current_times,
                    "image_url": None,
                })

        except Exception as e:
            logger.warning(f"  AMC text extraction failed: {e}")

        return movies


_crawler = AMCAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
