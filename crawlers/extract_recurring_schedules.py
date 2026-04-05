"""
extract_recurring_schedules.py

Scans Atlanta bar/restaurant/music venue websites for recurring weekly events
(trivia nights, karaoke, DJ nights, open mics, game nights, drag shows, etc.)
using Playwright for page fetching and the configured LLM provider for extraction.

Usage:
    python extract_recurring_schedules.py                   # dry run, all venues
    python extract_recurring_schedules.py --limit 10        # dry run, 10 venues
    python extract_recurring_schedules.py --venue-slug brick-store-pub  # single venue
    python extract_recurring_schedules.py --execute          # insert results into DB
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ---------------------------------------------------------------------------
# Bootstrap path so we can import from the crawlers package directly
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent))

from config import get_config
from llm_client import generate_text
from db import (
    get_client,
    insert_event,
    find_existing_event_for_insert,
    configure_write_mode,
)
from dedupe import generate_content_hash

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("extract_recurring_schedules")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096

# Venue types we want to scan
TARGET_VENUE_TYPES = (
    "bar",
    "restaurant",
    "music_venue",
    "nightclub",
    "brewery",
    "comedy_club",
    "sports_bar",
    "distillery",
    "winery",
)

# Day names indexed 0=Monday … 6=Sunday (matches the prompt contract)
DAY_NAMES = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

# Rate limiting
FETCH_DELAY_SECONDS = 2.0
CLAUDE_DELAY_SECONDS = 1.0

# Playwright page-load timeout (milliseconds)
PAGE_TIMEOUT_MS = 10_000

# Report output directory
REPORTS_DIR = Path(__file__).parent / "reports"

# ---------------------------------------------------------------------------
# Extraction prompt
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """\
You are reviewing the content of a venue's website page to find recurring weekly events.

VENUE: {venue_name}
WEBSITE: {website}
PAGE URL: {page_url}

PAGE CONTENT (text):
---
{page_text}
---

Your task: Extract ONLY events that happen on a regular weekly (or specific-day-of-week) schedule. These are standing programming items — things the venue does every week on the same night. Examples: trivia night every Tuesday, karaoke every Friday, DJ nights on weekends, open mic every Monday, game nights, drag shows, bingo, line dancing, comedy nights, open jams, etc.

DO NOT include:
- One-off concerts or special ticketed shows with a specific date
- Private events
- Events with no clear weekly recurrence pattern
- General opening hours or "we are open" language

For each recurring event found, return a JSON object with these fields:
- day_of_week: integer 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
- title: string — the event name (e.g. "Tuesday Trivia Night", "Karaoke with DJ Smooth")
- start_time: string in HH:MM 24-hour format (e.g. "19:00", "21:30") — null if not mentioned
- description: string — one sentence describing the event, null if nothing useful to add
- category: one of: nightlife, music, comedy, food_drink
- subcategory: one of: trivia, karaoke, dj, open_mic, game_night, drag, bingo, line_dancing, comedy_night, pub_quiz, poker, open_jam, live_music, other — null if none fits

Return your answer as a JSON object with a single key "events" containing an array of the above objects. If no recurring weekly events are found, return {{"events": []}}.

Respond with ONLY the JSON object, no explanation.
"""


# ---------------------------------------------------------------------------
# Playwright helpers
# ---------------------------------------------------------------------------

def _fetch_page_text(page, url: str, timeout_ms: int = PAGE_TIMEOUT_MS) -> Optional[str]:
    """Navigate to url and return visible page text, or None on failure."""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        # Give JS a moment to settle
        page.wait_for_timeout(1500)
        text = page.evaluate("() => document.body ? document.body.innerText : ''")
        return (text or "").strip() or None
    except PlaywrightTimeoutError:
        logger.warning(f"Timeout loading {url}")
        return None
    except Exception as exc:
        logger.warning(f"Error loading {url}: {exc}")
        return None


def fetch_venue_content(
    page, website: str
) -> tuple[Optional[str], str]:
    """
    Fetch homepage and /events page for a venue website.

    Returns (page_text, extraction_source) where extraction_source is
    "events_page" if the /events page had meaningful content, else "homepage".
    """
    # Normalise base URL
    base = website.rstrip("/")

    # Try /events first
    events_candidates = [
        base + "/events",
        base + "/calendar",
        base + "/whats-on",
        base + "/schedule",
    ]

    for events_url in events_candidates:
        text = _fetch_page_text(page, events_url)
        if text and len(text) > 200:
            logger.debug(f"  Using events page: {events_url} ({len(text)} chars)")
            return text, "events_page"

    # Fall back to homepage
    text = _fetch_page_text(page, base)
    if text and len(text) > 100:
        logger.debug(f"  Using homepage: {base} ({len(text)} chars)")
        return text, "homepage"

    return None, "homepage"


# ---------------------------------------------------------------------------
# LLM extraction
# ---------------------------------------------------------------------------

def extract_recurring_events(
    venue_name: str,
    website: str,
    page_url: str,
    page_text: str,
) -> list[dict]:
    """Send page content to the configured LLM and return recurring events."""
    # Truncate to avoid context overruns — first 8000 chars is plenty
    truncated_text = page_text[:8000]

    prompt = EXTRACTION_PROMPT.format(
        venue_name=venue_name,
        website=website,
        page_url=page_url,
        page_text=truncated_text,
    )

    try:
        cfg = get_config()
        provider = (cfg.llm.provider or "").strip().lower()
        if provider in ("", "auto"):
            provider = "openai" if cfg.llm.openai_api_key else "anthropic"
        model_override = cfg.llm.openai_model if provider == "openai" else MODEL
        raw = generate_text(
            "",
            prompt,
            provider_override=provider,
            model_override=model_override,
        ).strip()

        # Strip markdown code fences if the LLM wrapped the JSON
        if raw.startswith("```"):
            lines = raw.splitlines()
            # Drop first and last fence lines
            inner = []
            in_block = False
            for line in lines:
                if line.startswith("```") and not in_block:
                    in_block = True
                    continue
                if line.startswith("```") and in_block:
                    break
                if in_block:
                    inner.append(line)
            raw = "\n".join(inner).strip()

        parsed = json.loads(raw)
        events = parsed.get("events", [])
        if not isinstance(events, list):
            logger.warning(f"LLM returned unexpected 'events' type: {type(events)}")
            return []
        return events

    except json.JSONDecodeError as exc:
        logger.warning(f"LLM returned non-JSON for {venue_name}: {exc}")
        return []
    except Exception as exc:
        logger.error(f"LLM extraction error for {venue_name}: {exc}")
        return []


# ---------------------------------------------------------------------------
# Validate a single extracted event
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"nightlife", "music", "comedy", "food_drink"}
VALID_SUBCATEGORIES = {
    "trivia", "karaoke", "dj", "open_mic", "game_night", "drag",
    "bingo", "line_dancing", "comedy_night", "pub_quiz", "poker",
    "open_jam", "live_music", "other",
}


def validate_extracted_event(raw: dict) -> tuple[bool, str]:
    """Basic sanity-check on an extracted event dict. Returns (ok, reason)."""
    if not isinstance(raw, dict):
        return False, "not a dict"

    title = (raw.get("title") or "").strip()
    if not title:
        return False, "missing title"
    if len(title) < 3:
        return False, f"title too short: {title!r}"

    day = raw.get("day_of_week")
    if day is None or not isinstance(day, int) or day < 0 or day > 6:
        return False, f"invalid day_of_week: {day!r}"

    category = (raw.get("category") or "").strip()
    if category not in VALID_CATEGORIES:
        # Coerce unknown categories to nightlife — these are bar events
        raw["category"] = "nightlife"

    subcategory = raw.get("subcategory")
    if subcategory and subcategory not in VALID_SUBCATEGORIES:
        raw["subcategory"] = None

    # Validate start_time format if present
    start_time = raw.get("start_time")
    if start_time:
        try:
            h, m = start_time.split(":")
            assert 0 <= int(h) <= 23
            assert 0 <= int(m) <= 59
        except Exception:
            logger.debug(f"Dropping malformed start_time {start_time!r} for {title!r}")
            raw["start_time"] = None

    return True, ""


# ---------------------------------------------------------------------------
# DB query helpers
# ---------------------------------------------------------------------------

def fetch_target_venues(
    client_sb,
    limit: Optional[int] = None,
    venue_slug: Optional[str] = None,
) -> list[dict]:
    """Query Supabase venues for bars/restaurants/etc. in Atlanta with a website."""
    query = (
        client_sb.table("places")
        .select("id, name, slug, website, place_type, city, state")
        .eq("city", "Atlanta")
        .eq("state", "GA")
        .not_.is_("website", "null")
        .neq("website", "")
        .in_("place_type", list(TARGET_VENUE_TYPES))
        .order("name")
    )

    if venue_slug:
        query = query.eq("slug", venue_slug)

    if limit:
        query = query.limit(limit)

    result = query.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Recurring event date generation (for --execute mode)
# ---------------------------------------------------------------------------

def next_occurrences(
    day_of_week: int, start_time_str: Optional[str], weeks_ahead: int = 6
) -> list[tuple[str, Optional[str]]]:
    """
    Generate up to `weeks_ahead` future (date, start_time) pairs for a
    given day_of_week (0=Mon) starting from today.

    Returns list of (YYYY-MM-DD, HH:MM or None).
    """
    today = date.today()
    # Number of days until next occurrence of target weekday
    days_until = (day_of_week - today.weekday()) % 7
    if days_until == 0:
        days_until = 0  # Include today if it's the right day

    result = []
    for week in range(weeks_ahead):
        target_date = today + timedelta(days=days_until + week * 7)
        result.append((target_date.strftime("%Y-%m-%d"), start_time_str))

    return result


# ---------------------------------------------------------------------------
# Execute mode: insert events into DB
# ---------------------------------------------------------------------------

def insert_recurring_event(
    venue_record: dict,
    extracted: dict,
) -> tuple[int, int]:
    """
    Insert future occurrences of a recurring event for one venue.
    Returns (attempted, inserted) counts.
    """
    venue_id = venue_record["id"]
    venue_name = venue_record["name"]
    venue_record["slug"]
    website = venue_record.get("website", "")

    day = extracted["day_of_week"]
    title = extracted["title"].strip()
    start_time_str = extracted.get("start_time")
    description = extracted.get("description") or ""
    category = extracted.get("category", "nightlife")
    subcategory = extracted.get("subcategory")

    series_hint = {
        "series_type": "recurring_show",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": DAY_NAMES[day],
    }

    occurrences = next_occurrences(day, start_time_str, weeks_ahead=6)

    attempted = 0
    inserted = 0

    for event_date, event_time in occurrences:
        attempted += 1

        content_hash = generate_content_hash(title, venue_name, event_date)

        event_data: dict = {
            "title": title,
            "start_date": event_date,
            "start_time": event_time,
            "description": description or None,
            "category": category,
            "subcategory": subcategory,
            "place_id": venue_id,
            "source_url": website,
            "is_recurring": True,
            "content_hash": content_hash,
        }

        # Dedup check
        existing = find_existing_event_for_insert(event_data)
        if existing:
            logger.debug(f"  Skipping duplicate: {title} on {event_date}")
            continue

        try:
            event_id = insert_event(event_data, series_hint=series_hint)
            logger.info(
                f"  Inserted: {title} @ {venue_name} on {event_date} (ID={event_id})"
            )
            inserted += 1
        except ValueError as exc:
            logger.warning(f"  Rejected by insert_event: {exc}")
        except Exception as exc:
            logger.error(f"  Failed to insert {title} on {event_date}: {exc}")

    return attempted, inserted


# ---------------------------------------------------------------------------
# Main processing loop
# ---------------------------------------------------------------------------

def process_venues(
    venues: list[dict],
    execute: bool,
) -> list[dict]:
    """
    For each venue:
      1. Fetch page content with Playwright
      2. Extract recurring events with the configured LLM
      3. Validate results
      4. If execute: insert into DB
      5. Collect results for report

    Returns list of per-venue result dicts.
    """
    cfg = get_config()
    if not (cfg.llm.openai_api_key or cfg.llm.anthropic_api_key):
        logger.error("No LLM API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")
        sys.exit(1)

    results: list[dict] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        total = len(venues)
        for idx, venue in enumerate(venues, start=1):
            venue_id = venue["id"]
            venue_name = venue["name"]
            venue_slug = venue["slug"]
            website = (venue.get("website") or "").strip()

            logger.info(
                f"[{idx}/{total}] {venue_name} ({venue_slug}) — {website}"
            )

            if not website or not website.startswith("http"):
                logger.warning(f"  Skipping: invalid website URL {website!r}")
                continue

            # Fetch page content
            page_text, extraction_source = fetch_venue_content(page, website)

            if not page_text:
                logger.warning(f"  No page content retrieved for {venue_name}")
                time.sleep(FETCH_DELAY_SECONDS)
                continue

            # Determine the actual URL that was loaded (events or homepage)
            if extraction_source == "events_page":
                page_url = website.rstrip("/") + "/events"
            else:
                page_url = website

            # Call LLM
            time.sleep(CLAUDE_DELAY_SECONDS)
            raw_events = extract_recurring_events(
                venue_name=venue_name,
                website=website,
                page_url=page_url,
                page_text=page_text,
            )

            # Validate
            valid_events = []
            for raw in raw_events:
                ok, reason = validate_extracted_event(raw)
                if ok:
                    valid_events.append(raw)
                else:
                    logger.debug(f"  Dropped invalid event: {reason} — {raw}")

            logger.info(
                f"  Extracted {len(raw_events)} events, "
                f"{len(valid_events)} valid (source: {extraction_source})"
            )

            # Execute mode: insert into DB
            total_attempted = 0
            total_inserted = 0
            if execute and valid_events:
                for extracted in valid_events:
                    attempted, inserted = insert_recurring_event(
                        venue_record=venue,
                        extracted=extracted,
                    )
                    total_attempted += attempted
                    total_inserted += inserted
                logger.info(
                    f"  Inserted {total_inserted}/{total_attempted} occurrences"
                )

            result_entry: dict = {
                "place_id": venue_id,
                "venue_name": venue_name,
                "venue_slug": venue_slug,
                "website": website,
                "extraction_source": extraction_source,
                "extracted_events": valid_events,
            }
            if execute:
                result_entry["insert_attempted"] = total_attempted
                result_entry["insert_succeeded"] = total_inserted

            results.append(result_entry)

            # Rate limit between venues
            time.sleep(FETCH_DELAY_SECONDS)

        page.close()
        context.close()
        browser.close()

    return results


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------

def write_report(results: list[dict]) -> Path:
    """Write results to a timestamped JSON file in crawlers/reports/."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORTS_DIR / f"recurring_schedules_{timestamp}.json"

    total_venues = len(results)
    total_events = sum(len(r["extracted_events"]) for r in results)

    payload = {
        "generated_at": datetime.now().isoformat(),
        "total_venues_processed": total_venues,
        "total_recurring_events_found": total_events,
        "results": results,
    }

    report_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return report_path


# ---------------------------------------------------------------------------
# Print summary to stdout
# ---------------------------------------------------------------------------

def print_summary(results: list[dict], execute: bool) -> None:
    """Print a human-readable summary of extraction results."""
    total_events = sum(len(r["extracted_events"]) for r in results)
    venues_with_events = sum(1 for r in results if r["extracted_events"])

    print()
    print("=" * 60)
    print("RECURRING SCHEDULE EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Venues processed:      {len(results)}")
    print(f"Venues with events:    {venues_with_events}")
    print(f"Total recurring events found: {total_events}")
    print()

    for result in results:
        events = result["extracted_events"]
        if not events:
            continue
        print(f"  {result['venue_name']} ({result['venue_slug']})")
        for ev in events:
            day_name = DAY_NAMES[ev["day_of_week"]].capitalize()
            time_str = ev.get("start_time") or "time TBD"
            subcat = ev.get("subcategory") or ev.get("category", "")
            print(f"    [{day_name} {time_str}] {ev['title']} ({subcat})")

        if execute:
            attempted = result.get("insert_attempted", 0)
            succeeded = result.get("insert_succeeded", 0)
            print(f"    -> Inserted {succeeded}/{attempted} occurrences")
        print()

    if not execute:
        print("NOTE: Dry run — no events were written to the database.")
        print("      Re-run with --execute to insert.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract recurring weekly events from Atlanta venue websites."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        default=False,
        help="Insert extracted events into the database (default: dry run)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Cap the number of venues to process",
    )
    parser.add_argument(
        "--venue-slug",
        type=str,
        default=None,
        metavar="SLUG",
        help="Process a single venue by slug",
    )
    args = parser.parse_args()

    mode_label = "EXECUTE" if args.execute else "DRY RUN"
    logger.info(f"Starting extract_recurring_schedules — mode={mode_label}")

    # Configure write mode for db.py helpers
    configure_write_mode(
        enable_writes=args.execute,
        reason="" if args.execute else "dry-run",
    )

    # Fetch target venues from Supabase
    sb = get_client()
    venues = fetch_target_venues(
        sb,
        limit=args.limit,
        venue_slug=args.venue_slug,
    )

    if not venues:
        logger.warning("No venues matched the query. Nothing to do.")
        sys.exit(0)

    logger.info(f"Found {len(venues)} venue(s) to process.")

    # Run extraction
    results = process_venues(venues, execute=args.execute)

    # Write report
    report_path = write_report(results)
    logger.info(f"Report written to: {report_path}")

    # Print summary
    print_summary(results, execute=args.execute)


if __name__ == "__main__":
    main()
