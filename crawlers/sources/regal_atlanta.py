"""
Crawler for Regal Cinemas Atlanta-area locations.

Uses Regal's internal /api/getShowtimes endpoint to fetch structured showtime
data per-date. The initial page load establishes the session (bypassing
Cloudflare), then subsequent dates are fetched via the API from the page context.

5 locations: Atlantic Station, Perimeter Pointe, Mall of Georgia,
Hollywood @ North I-85, Avalon.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

from playwright.sync_api import Page

from sources.chain_cinema_base import ChainCinemaCrawler

logger = logging.getLogger(__name__)


class RegalAtlantaCrawler(ChainCinemaCrawler):
    CHAIN_NAME = "Regal Cinemas"
    CHAIN_TAG = "regal"
    DAYS_AHEAD = 7
    LOCATIONS = [
        {
            "venue_data": {
                "name": "Regal Atlantic Station",
                "slug": "regal-atlantic-station",
                "address": "261 19th St NW, Suite 1250",
                "neighborhood": "Atlantic Station",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30363",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-atlantic-station-1346",
                "lat": 33.7919,
                "lng": -84.3955,
            },
            "url_slug": "regal-atlantic-station-1346",
        },
        {
            "venue_data": {
                "name": "Regal Perimeter Pointe",
                "slug": "regal-perimeter-pointe",
                "address": "1155 Mt Vernon Hwy NE",
                "neighborhood": "Dunwoody",
                "city": "Atlanta",
                "state": "GA",
                "zip": "30338",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-perimeter-pointe-1309",
                "lat": 33.9280,
                "lng": -84.3410,
            },
            "url_slug": "regal-perimeter-pointe-1309",
        },
        {
            "venue_data": {
                "name": "Regal Mall of Georgia",
                "slug": "regal-mall-of-georgia",
                "address": "3333 Buford Dr",
                "neighborhood": "Buford",
                "city": "Buford",
                "state": "GA",
                "zip": "30519",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-mall-of-georgia-0701",
                "lat": 34.0655,
                "lng": -83.9899,
            },
            "url_slug": "regal-mall-of-georgia-0701",
        },
        {
            "venue_data": {
                "name": "Regal Hollywood @ North I-85",
                "slug": "regal-hollywood-north-i85",
                "address": "3265 Northeast Expy NE",
                "neighborhood": "Chamblee",
                "city": "Chamblee",
                "state": "GA",
                "zip": "30341",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-hollywood-north-i-85-0745",
                "lat": 33.8865,
                "lng": -84.2938,
            },
            "url_slug": "regal-hollywood-north-i-85-0745",
        },
        {
            "venue_data": {
                "name": "Regal Avalon",
                "slug": "regal-avalon",
                "address": "3950 1st St",
                "neighborhood": "Alpharetta",
                "city": "Alpharetta",
                "state": "GA",
                "zip": "30009",
                "venue_type": "cinema",
                "website": "https://www.regmovies.com/theatres/regal-avalon-1694",
                "lat": 34.0702,
                "lng": -84.2753,
            },
            "url_slug": "regal-avalon-1694",
        },
    ]

    def get_showtime_url(self, location: dict, date: datetime) -> str:
        """Theater page URL (used for initial load and source_url)."""
        slug = location["url_slug"]
        date_str = date.strftime("%Y-%m-%d")
        return f"https://www.regmovies.com/theatres/{slug}?date={date_str}"

    @staticmethod
    def _get_cinema_id(location: dict) -> str:
        """Extract 4-digit cinema ID from the url_slug (last segment after final hyphen)."""
        slug = location["url_slug"]
        match = re.search(r"-(\d{4})$", slug)
        if match:
            return match.group(1)
        # Fallback: last 4 chars
        return slug[-4:]

    def _fetch_showtimes_api(self, page: Page, cinema_id: str, date: datetime) -> list[dict]:
        """Fetch showtimes from Regal's internal API via the page context."""
        date_str = date.strftime("%m-%d-%Y")
        api_url = f"/api/getShowtimes?theatres={cinema_id}&date={date_str}&hoCode=&ignoreCache=false&moviesOnly=false"

        try:
            result = page.evaluate(f"""async () => {{
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {{
                    const resp = await fetch("{api_url}", {{ signal: controller.signal }});
                    clearTimeout(timeout);
                    if (!resp.ok) return {{ error: resp.status }};
                    return await resp.json();
                }} catch (e) {{
                    clearTimeout(timeout);
                    return {{ error: e.message }};
                }}
            }}""")
        except Exception as e:
            logger.warning(f"  page.evaluate failed for cinema {cinema_id} on {date_str}: {e}")
            return []

        if not result or isinstance(result, str):
            return []

        if "error" in result:
            logger.warning(f"  API error for cinema {cinema_id} on {date_str}: {result['error']}")
            return []

        # Response structure: { shows: [{ Film: [...], AdvertiseShowDate: "..." }] }
        shows = result.get("shows", [])
        if not shows:
            # Fallback: response might be the shows array directly
            if isinstance(result, list):
                return result
        return shows

    def _process_day(
        self,
        day_data: dict,
        venue_name: str,
        source_id: int,
        venue_id: int,
        url: str,
        seen_hashes: set[str],
    ) -> tuple[int, int, int]:
        """Process one day's showtime data. Returns (found, new, updated)."""
        from db import insert_event, find_event_by_hash, smart_update_existing_event
        from dedupe import generate_content_hash

        found = 0
        new = 0
        updated = 0

        films = day_data.get("Film", [])
        show_date = day_data.get("AdvertiseShowDate", "")

        if not films:
            return found, new, updated

        logger.info(f"  {venue_name}: {len(films)} films for {show_date[:10]}")

        for film in films:
            title = film.get("Title", "").strip()
            if not title:
                continue

            performances = film.get("Performances", [])
            times_added: set[str] = set()

            for perf in performances:
                cal_time = perf.get("CalendarShowTime", "")
                if not cal_time:
                    continue

                # CalendarShowTime format: "2026-02-12T11:00:00"
                try:
                    dt = datetime.fromisoformat(cal_time)
                    date_str = dt.strftime("%Y-%m-%d")
                    time_str = dt.strftime("%H:%M")
                except (ValueError, TypeError):
                    continue

                if time_str in times_added:
                    continue
                times_added.add(time_str)

                found += 1
                content_hash = generate_content_hash(
                    title, venue_name, f"{date_str}|{time_str}"
                )
                seen_hashes.add(content_hash)


                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": None,
                    "start_date": date_str,
                    "start_time": time_str,
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
                    "image_url": None,
                    "raw_text": None,
                    "extraction_confidence": 0.95,
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
                    logger.info(f"    Added: {title} at {time_str}")
                except Exception as e:
                    logger.error(f"    Failed to insert {title}: {e}")

        return found, new, updated

    def _crawl_location(
        self,
        page: Page,
        location: dict,
        source_id: int,
        venue_id: int,
        venue_name: str,
        seen_hashes: set[str],
    ) -> tuple[int, int, int]:
        """Load page once to establish session, then fetch each date via API."""
        found = 0
        new = 0
        updated = 0
        today = datetime.now().date()
        cinema_id = self._get_cinema_id(location)

        # Load the theater page once to establish Cloudflare session
        base_url = f"https://www.regmovies.com/theatres/{location['url_slug']}"
        logger.info(f"  Loading {venue_name} (cinema {cinema_id}): {base_url}")

        try:
            page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(8000)
        except Exception as e:
            logger.warning(f"  Failed to load {base_url}: {e}")
            return found, new, updated

        # Check for Cloudflare challenge
        body_text = page.inner_text("body")
        if "Just a moment" in body_text or "cf-error" in body_text:
            logger.warning(f"  {venue_name}: Cloudflare challenge — waiting for pass-through")
            page.wait_for_timeout(15000)
            body_text = page.inner_text("body")
            if "Just a moment" in body_text:
                logger.error(f"  {venue_name}: Stuck on Cloudflare challenge, skipping")
                return found, new, updated

        # Fetch showtimes for each date via API
        for day_offset in range(self.DAYS_AHEAD):
            target_date = today + timedelta(days=day_offset)
            target_dt = datetime.combine(target_date, datetime.min.time())
            date_str = target_date.strftime("%Y-%m-%d")
            url = self.get_showtime_url(location, target_dt)

            logger.info(f"  Fetching API for {venue_name} on {date_str}")

            shows = self._fetch_showtimes_api(page, cinema_id, target_dt)

            if not shows:
                logger.debug(f"  {venue_name}: No shows from API for {date_str}")
                continue

            for day_data in shows:
                f, n, u = self._process_day(
                    day_data, venue_name, source_id, venue_id, url, seen_hashes
                )
                found += f
                new += n
                updated += u

            # Small delay between API calls to be polite
            page.wait_for_timeout(1000)

        logger.info(f"  {venue_name}: {found} total showtimes, {new} new, {updated} existing")
        return found, new, updated

    def extract_showtimes(self, page: Page, location: dict, target_date: datetime) -> list[dict]:
        """Not used — _crawl_location handles extraction directly from __NEXT_DATA__."""
        return []


_crawler = RegalAtlantaCrawler()


def crawl(source: dict) -> tuple[int, int, int]:
    return _crawler.crawl(source)
