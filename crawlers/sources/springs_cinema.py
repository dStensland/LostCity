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

from db import (
    get_or_create_place,
    persist_screening_bundle,
    sync_run_events_from_screenings,
    remove_stale_showtime_events,
    build_screening_bundle_from_event_rows,
    entries_to_event_like_rows,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://www.springscinema.com"

PLACE_DATA = {
    "name": "The Springs Cinema & Taphouse",
    "slug": "springs-cinema",
    "address": "5920 Roswell Rd NE Suite A-103",
    "neighborhood": "Sandy Springs",
    "city": "Sandy Springs",
    "state": "GA",
    "zip": "30328",
    "place_type": "cinema",
    "website": BASE_URL,
    "lat": 33.9196,
    "lng": -84.3563,
}

IMAGE_BASE = "https://indy-systems.imgix.net"
_GRAPHQL_AUTH_KEYS = ("circuit-id", "site-id", "client-type")


def goto_with_retry(
    page,
    url: str,
    *,
    attempts: int = 3,
    timeout_ms: int = 90000,
    wait_until: str = "domcontentloaded",
) -> None:
    """Navigate with retry/backoff for transient renderer/network failures."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            page.goto(url, wait_until=wait_until, timeout=timeout_ms)
            return
        except Exception as exc:  # noqa: BLE001 - crawler retry guard
            last_exc = exc
            if attempt >= attempts:
                raise
            page.wait_for_timeout(2000 * attempt)
    if last_exc:
        raise last_exc


def merge_graphql_auth_headers(
    auth_headers: dict[str, str],
    request_headers: dict[str, str],
) -> bool:
    """Merge required GraphQL auth headers from a browser request."""
    changed = False
    for key in _GRAPHQL_AUTH_KEYS:
        val = request_headers.get(key)
        if val and auth_headers.get(key) != val:
            auth_headers[key] = val
            changed = True
    return changed


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl The Springs Cinema & Taphouse showtimes via GraphQL API."""
    source_id = source["id"]
    all_entries: list[dict] = []

    # In-process dedup guard: (title, date, time) tuples seen this run
    seen_showtimes: set = set()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            venue_id = get_or_create_place(PLACE_DATA)
            today = datetime.now().date()

            # Capture the auth headers from the page's own GraphQL requests
            auth_headers = {}

            def capture_headers(request):
                if "/graphql" not in request.url or request.method != "POST":
                    return
                if merge_graphql_auth_headers(auth_headers, request.headers):
                    logger.info("Captured Springs GraphQL auth headers from browser request")

            page.on("request", capture_headers)

            # Load the page to establish session
            logger.info(f"Fetching: {BASE_URL}/showtimes")
            goto_with_retry(
                page,
                f"{BASE_URL}/showtimes",
                attempts=3,
                timeout_ms=90000,
                wait_until="domcontentloaded",
            )
            for _ in range(20):
                if auth_headers.get("circuit-id") and auth_headers.get("site-id"):
                    break
                page.wait_for_timeout(1000)

            if not auth_headers:
                logger.info("No GraphQL headers captured on first load; retrying showtimes bootstrap")
                page.reload(wait_until="domcontentloaded", timeout=90000)
                for _ in range(20):
                    if auth_headers.get("circuit-id") and auth_headers.get("site-id"):
                        break
                    page.wait_for_timeout(1000)

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

                    showtime_key = (title, event_date, start_time)
                    if showtime_key in seen_showtimes:
                        continue
                    seen_showtimes.add(showtime_key)

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

                    all_entries.append({
                        "title": title,
                        "start_date": event_date,
                        "start_time": start_time,
                        "image_url": image_url,
                        "source_url": f"{BASE_URL}/showtimes",
                        "ticket_url": ticket_url,
                        "description": description,
                        "tags": ["film", "cinema", "independent", "showtime", "dine-in", "springs-cinema"],
                        "source_id": source_id,
                        "place_id": venue_id,
                    })

            browser.close()

        # --- Screening-primary persistence ---
        total_found = len(all_entries)
        source_slug = source.get("slug", "springs-cinema")

        event_like_rows = entries_to_event_like_rows(all_entries)
        bundle = build_screening_bundle_from_event_rows(
            source_id=source_id,
            source_slug=source_slug,
            events=event_like_rows,
        )
        screening_summary = persist_screening_bundle(bundle)
        logger.info(
            "Springs Cinema screening sync: %s titles, %s runs, %s times",
            screening_summary.get("titles", 0),
            screening_summary.get("runs", 0),
            screening_summary.get("times", 0),
        )

        run_summary = sync_run_events_from_screenings(
            source_id=source_id,
            source_slug=source_slug,
        )
        total_new = run_summary.get("events_created", 0)
        total_updated = run_summary.get("events_updated", 0)
        logger.info(
            "Springs Cinema run events: %s created, %s updated, %s times linked",
            total_new, total_updated, run_summary.get("times_linked", 0),
        )

        run_event_hashes = run_summary.get("run_event_hashes", set())
        if run_event_hashes:
            cleanup = remove_stale_showtime_events(
                source_id=source_id,
                run_event_hashes=run_event_hashes,
            )
            if cleanup.get("deactivated") or cleanup.get("deleted"):
                logger.info("Stale showtime cleanup: %s", cleanup)

        logger.info(
            f"Springs Cinema crawl complete: {total_found} showtimes, {total_new} new run events, {total_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Springs Cinema: {e}")
        raise

    return total_found, total_new, total_updated
