"""
Crawler for AMC Theatres Atlanta-area locations.

Navigates to amctheatres.com theater showtime pages for each location,
extracts movie titles and showtimes using Playwright.
6 locations: Phipps Plaza, North DeKalb, Southlake Pavilion,
Sugarloaf Mills, Camp Creek, Mansell Crossing.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler, parse_time

logger = logging.getLogger(__name__)

# Time pattern: "7:30pm", "3:00PM", "10:15am"
TIME_RE = re.compile(r"^(\d{1,2}:\d{2})\s*(am|pm)$", re.IGNORECASE)


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
        """Theater showtimes page with date parameter."""
        slug = location["url_slug"]
        date_str = date.strftime("%Y-%m-%d")
        return f"https://www.amctheatres.com/movie-theatres/atlanta/{slug}/showtimes?date={date_str}"

    def _crawl_location(
        self,
        page: Page,
        location: dict,
        source_id: int,
        venue_id: int,
        venue_name: str,
        seen_hashes: set[str],
    ) -> tuple[int, int, int]:
        """Override: navigate to each date URL directly (no tab clicking)."""
        from db import insert_event, find_event_by_hash, smart_update_existing_event
        from dedupe import generate_content_hash

        found = 0
        new = 0
        updated = 0
        today = datetime.now().date()

        for day_offset in range(self.DAYS_AHEAD):
            target_date = today + timedelta(days=day_offset)
            target_dt = datetime.combine(target_date, datetime.min.time())
            date_str = target_date.strftime("%Y-%m-%d")

            url = self.get_showtime_url(location, target_dt)
            logger.info(f"  Loading {venue_name} for {date_str}: {url}")

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(8000)
            except Exception as e:
                logger.warning(f"  Failed to load {url}: {e}")
                continue

            # Check for 404 / error page
            body_text = page.inner_text("body")
            if "gone off script" in body_text or "ERROR 404" in body_text:
                logger.warning(f"  {venue_name}: 404 page — theater may have moved or closed")
                return found, new, updated

            movies = self.extract_showtimes(page, location, target_dt)

            if not movies:
                logger.debug(f"  No showtimes for {venue_name} on {date_str}")
                continue

            for movie in movies:
                title = movie["title"]
                times = movie["times"]
                image_url = movie.get("image_url")

                for start_time in times:
                    content_hash = generate_content_hash(
                        title, venue_name, f"{date_str}|{start_time}"
                    )
                    # Skip duplicate rows for the same title/time seen in this run.
                    if content_hash in seen_hashes:
                        continue
                    seen_hashes.add(content_hash)
                    found += 1


                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": None,
                        "start_date": date_str,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "cinema",
                        "tags": ["film", "cinema", "chain-cinema", "showtime", self.CHAIN_TAG],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": url,
                        "ticket_url": None,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.85,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        smart_update_existing_event(existing, event_record)
                        updated += 1
                        continue

                    series_hint = {
                        "series_type": "film",
                        "series_title": title,
                    }

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        new += 1
                        logger.info(f"    Added: {title} at {start_time}")
                    except Exception as e:
                        logger.error(f"    Failed to insert {title}: {e}")

            logger.info(f"  {venue_name} {date_str}: {len(movies)} movies found")

        return found, new, updated

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Extract movies and showtimes from AMC showtime page.

        AMC text structure per movie:
            Movie Title
            X HR Y MIN
            RATING (G/PG/PG13/R/NC17/NR)
            AMC Theater Name
            FORMAT NAME (e.g. "DOLBY CINEMA AT AMC")
            :
            Format tagline (e.g. "COMPLETELY CAPTIVATING")
            Amenities...
            Time buttons (e.g. "7:30pm")
            ...repeat format sections...
            Next Movie Title
            X HR Y MIN
            ...

        Key: movie titles are identified by being followed by a duration line.
        Format taglines (after ':') are NOT movie titles.
        """
        movies = []

        try:
            body_text = page.inner_text("body")
        except Exception:
            return movies

        lines = [line.strip() for line in body_text.split("\n") if line.strip()]

        time_re = re.compile(r"^(\d{1,2}:\d{2})(am|pm)", re.IGNORECASE)
        duration_re = re.compile(r"^\d+ HR \d+ MIN$")

        # Two-pass approach:
        # Pass 1: Find movie titles (lines followed by duration lines)
        movie_indices: list[int] = []
        for i in range(len(lines) - 1):
            if duration_re.match(lines[i + 1]) and len(lines[i]) > 2 and len(lines[i]) < 100:
                movie_indices.append(i)

        if not movie_indices:
            return movies

        # Pass 2: For each movie, collect all times until the next movie
        for idx, movie_line_idx in enumerate(movie_indices):
            title = " ".join(lines[movie_line_idx].split())

            # Collect times from this movie's section until next movie
            end_idx = movie_indices[idx + 1] if idx + 1 < len(movie_indices) else len(lines)
            times: list[str] = []

            for j in range(movie_line_idx + 1, end_idx):
                time_match = time_re.match(lines[j])
                if time_match:
                    time_text = time_match.group(1) + time_match.group(2)
                    parsed = parse_time(time_text)
                    if parsed and parsed not in times:
                        times.append(parsed)

            if times:
                movies.append({
                    "title": title,
                    "times": times,
                    "image_url": None,
                })

        return movies


_crawler = AMCAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
