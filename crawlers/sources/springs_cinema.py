"""
Crawler for The Springs Cinema & Taphouse (springscinema.com).
Independent dine-in cinema in Sandy Springs showing first-run films
with craft beer and upscale food.

The site is a Vue.js/Quasar app backed by a GraphQL API at /graphql.
The API requires session cookies + custom headers (circuit-id, site-id).
We use Playwright to load the page (establishing the session), then
make GraphQL calls from within the browser context using the same
headers the page itself uses.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, remove_stale_source_events
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.springscinema.com"

VENUE_DATA = {
    "name": "The Springs Cinema & Taphouse",
    "slug": "springs-cinema",
    "address": "5920 Roswell Rd NE Suite A-103",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "venue_type": "cinema",
    "website": BASE_URL,
    "lat": 33.9196,
    "lng": -84.3563,
}

IMAGE_BASE = "https://indy-systems.imgix.net"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Springs Cinema & Taphouse showtimes via GraphQL API."""
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0
    seen_hashes: set[str] = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_venue(VENUE_DATA)
            today = datetime.now().date()

            # Capture the auth headers from the page's own GraphQL requests
            auth_headers = {}

            def capture_headers(request):
                if "/graphql" in request.url and request.method == "POST":
                    body = request.post_data or ""
                    if "showingsForDate" in body or "datesWithShowing" in body:
                        for key in ("circuit-id", "site-id", "client-type"):
                            val = request.headers.get(key)
                            if val:
                                auth_headers[key] = val

            page.on("request", capture_headers)

            # Load the page to establish session
            logger.info(f"Fetching: {BASE_URL}/showtimes")
            page.goto(f"{BASE_URL}/showtimes", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(8000)

            if not auth_headers:
                logger.warning("Failed to capture auth headers from page requests")
                browser.close()
                return 0, 0, 0

            logger.info(f"Captured auth headers: {auth_headers}")

            # Now make authenticated GraphQL calls from browser context
            # Step 1: Get available dates
            dates_raw = page.evaluate(
                """
                async (headers) => {
                    try {
                        const resp = await fetch('/graphql', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/graphql-response+json,application/json;q=0.9',
                                'circuit-id': headers['circuit-id'],
                                'site-id': headers['site-id'],
                                'client-type': headers['client-type'] || 'consumer',
                                'is-electron-mode': 'false',
                            },
                            body: JSON.stringify({
                                query: `query ($siteIds: [ID], $titleClassIds: [ID], $everyShowingBadgeIds: [ID]) {
                                    datesWithShowing(
                                        siteIds: $siteIds,
                                        titleClassIds: $titleClassIds,
                                        everyShowingBadgeIds: $everyShowingBadgeIds
                                    ) { value }
                                }`,
                                variables: {
                                    siteIds: [parseInt(headers['site-id'])],
                                    titleClassIds: [28,24,25,207,135,293,50,90,136,104,26,292,27,51,609],
                                    everyShowingBadgeIds: [null],
                                }
                            })
                        });
                        const data = await resp.json();
                        return data?.data?.datesWithShowing?.value || '[]';
                    } catch (e) {
                        return JSON.stringify({error: e.message});
                    }
                }
                """,
                auth_headers,
            )

            available_dates = json.loads(dates_raw) if isinstance(dates_raw, str) else dates_raw
            if isinstance(available_dates, dict) and "error" in available_dates:
                logger.error(f"Dates query error: {available_dates['error']}")
                browser.close()
                return 0, 0, 0

            max_date = today + timedelta(days=7)
            target_dates = [
                d for d in available_dates
                if today.isoformat() <= d <= max_date.isoformat()
            ]

            logger.info(f"Found {len(target_dates)} dates with showings in next 7 days")

            # Step 2: Get showings for each date
            for date_str in target_dates:
                showings_result = page.evaluate(
                    """
                    async (args) => {
                        const [dateStr, headers] = args;
                        try {
                            const siteId = parseInt(headers['site-id']);
                            const resp = await fetch('/graphql', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/graphql-response+json,application/json;q=0.9',
                                    'circuit-id': headers['circuit-id'],
                                    'site-id': headers['site-id'],
                                    'client-type': headers['client-type'] || 'consumer',
                                    'is-electron-mode': 'false',
                                },
                                body: JSON.stringify({
                                    query: `query ($date: String, $titleClassIds: [ID], $siteIds: [ID], $everyShowingBadgeIds: [ID]) {
                                        showingsForDate(
                                            date: $date,
                                            ids: [],
                                            movieId: null,
                                            movieIds: [],
                                            titleClassId: null,
                                            titleClassIds: $titleClassIds,
                                            siteIds: $siteIds,
                                            anyShowingBadgeIds: null,
                                            everyShowingBadgeIds: $everyShowingBadgeIds,
                                            resultVersion: null
                                        ) {
                                            data {
                                                id
                                                time
                                                published
                                                movie {
                                                    name
                                                    urlSlug
                                                    posterImage
                                                    allGenres
                                                    rating
                                                    duration
                                                }
                                            }
                                        }
                                    }`,
                                    variables: {
                                        date: dateStr,
                                        titleClassIds: [28,24,25,207,135,293,50,90,136,104,26,292,27,51,609],
                                        siteIds: [siteId],
                                        everyShowingBadgeIds: [null],
                                    }
                                })
                            });
                            const data = await resp.json();
                            return data?.data?.showingsForDate?.data || [];
                        } catch (e) {
                            return [{error: e.message}];
                        }
                    }
                    """,
                    [date_str, auth_headers],
                )

                if not showings_result:
                    continue

                # Check for error
                if showings_result and isinstance(showings_result[0], dict) and "error" in showings_result[0]:
                    logger.error(f"Showings query error for {date_str}: {showings_result[0]['error']}")
                    continue

                logger.info(f"  {date_str}: {len(showings_result)} showings")

                for showing in showings_result:
                    if not showing.get("published", False):
                        continue

                    movie = showing.get("movie")
                    if not movie:
                        continue

                    title = movie.get("name", "").strip()
                    if not title or len(title) < 2:
                        continue

                    # Parse ISO time to Eastern
                    time_iso = showing.get("time", "")
                    if not time_iso:
                        continue

                    try:
                        dt = datetime.fromisoformat(time_iso.replace("Z", "+00:00"))
                        eastern_tz = timezone(timedelta(hours=-5))
                        dt_eastern = dt.astimezone(eastern_tz)
                        start_time = dt_eastern.strftime("%H:%M")
                        event_date = dt_eastern.strftime("%Y-%m-%d")
                    except Exception:
                        continue

                    total_found += 1
                    content_hash = generate_content_hash(
                        title, "The Springs Cinema & Taphouse", f"{event_date}|{start_time}"
                    )
                    seen_hashes.add(content_hash)

                    existing = find_event_by_hash(content_hash)
                    if existing:
                        total_updated += 1
                        continue

                    poster_key = movie.get("posterImage")
                    image_url = (
                        f"{IMAGE_BASE}/{poster_key}?fit=crop&w=400&h=600&fm=jpeg&auto=format,compress"
                        if poster_key
                        else None
                    )

                    url_slug = movie.get("urlSlug", "")
                    ticket_url = f"{BASE_URL}/movie/{url_slug}" if url_slug else None

                    parts = []
                    if movie.get("allGenres"):
                        parts.append(movie["allGenres"])
                    if movie.get("rating"):
                        parts.append(f"Rated {movie['rating']}")
                    if movie.get("duration"):
                        parts.append(f"{movie['duration']} min")
                    description = " | ".join(parts) if parts else None

                    event_record = {
                        "source_id": source_id,
                        "venue_id": venue_id,
                        "title": title,
                        "description": description,
                        "start_date": event_date,
                        "start_time": start_time,
                        "end_date": None,
                        "end_time": None,
                        "is_all_day": False,
                        "category": "film",
                        "subcategory": "cinema",
                        "tags": ["film", "cinema", "independent", "dine-in", "springs-cinema"],
                        "price_min": None,
                        "price_max": None,
                        "price_note": None,
                        "is_free": False,
                        "source_url": f"{BASE_URL}/showtimes",
                        "ticket_url": ticket_url,
                        "image_url": image_url,
                        "raw_text": None,
                        "extraction_confidence": 0.95,
                        "is_recurring": False,
                        "recurrence_rule": None,
                        "content_hash": content_hash,
                    }

                    series_hint = {"series_type": "film", "series_title": title}

                    try:
                        insert_event(event_record, series_hint=series_hint)
                        total_new += 1
                        logger.info(f"    Added: {title} on {event_date} at {start_time}")
                    except Exception as e:
                        logger.error(f"    Failed to insert: {e}")

            browser.close()

        if seen_hashes:
            stale_removed = remove_stale_source_events(source_id, seen_hashes)
            if stale_removed:
                logger.info(f"Removed {stale_removed} stale showtimes")

        logger.info(
            f"Springs Cinema crawl complete: {total_found} found, {total_new} new, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Springs Cinema: {e}")
        raise

    return total_found, total_new, total_updated
