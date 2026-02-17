"""
Generic LLM-powered crawler for venue websites.

Uses Claude to extract events from any venue website, enabling bulk crawling
of venues without needing custom parsers for each site.

Usage:
    # Crawl specific venues
    python generic_venue_crawler.py --venue-ids 901,902,903

    # Crawl all venues with websites that have no events
    python generic_venue_crawler.py --missing-events --limit 50

    # Dry run (don't insert events)
    python generic_venue_crawler.py --missing-events --limit 10 --dry-run

    # Crawl venues marked as event venues
    python generic_venue_crawler.py --event-venues --limit 100
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime
from typing import Optional
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from supabase import Client

from db import get_client, insert_event, find_event_by_hash, update_source_health_tags
from dedupe import generate_content_hash
from extract import extract_events
from utils import setup_logging, extract_text_content

logger = logging.getLogger(__name__)

# Health tag constants
HEALTH_TAG_TIMEOUT = "timeout"
HEALTH_TAG_DNS_ERROR = "dns-error"
HEALTH_TAG_SSL_ERROR = "ssl-error"
HEALTH_TAG_NO_EVENTS = "no-events"
HEALTH_TAG_INSTAGRAM_ONLY = "instagram-only"
HEALTH_TAG_FACEBOOK_EVENTS = "facebook-events"
HEALTH_TAG_PARSE_ERROR = "parse-error"
HEALTH_TAG_SEASONAL = "seasonal"


def detect_health_tags(content: str, error: str | None = None) -> list[str]:
    """
    Detect health tags based on page content and errors.

    Args:
        content: The page content (empty if fetch failed)
        error: Optional error message from fetch attempt

    Returns:
        List of detected health tags
    """
    tags = []
    error_lower = (error or "").lower()
    content_lower = (content or "").lower()

    # Error-based tags
    if "timeout" in error_lower or "timed out" in error_lower:
        tags.append(HEALTH_TAG_TIMEOUT)
    if "dns" in error_lower or "name resolution" in error_lower or "getaddrinfo" in error_lower:
        tags.append(HEALTH_TAG_DNS_ERROR)
    if "ssl" in error_lower or "certificate" in error_lower:
        tags.append(HEALTH_TAG_SSL_ERROR)

    # Content-based tags (only if we got content but no events)
    if content and len(content) > 100:
        # Check for Instagram-only pattern
        has_instagram = (
            "instagram.com" in content_lower or
            "@" in content and ("follow" in content_lower or "instagram" in content_lower)
        )
        has_calendar = any(kw in content_lower for kw in [
            "calendar", "events", "schedule", "upcoming", "shows", "tickets"
        ])

        if has_instagram and not has_calendar:
            tags.append(HEALTH_TAG_INSTAGRAM_ONLY)

        # Check for Facebook events link
        if "facebook.com/events" in content_lower or "fb.com/events" in content_lower:
            tags.append(HEALTH_TAG_FACEBOOK_EVENTS)

    return tags

# Rate limiting between LLM calls (seconds)
LLM_RATE_LIMIT = 1.0

# Maximum pages to crawl per venue (reduced for speed)
MAX_PAGES_PER_VENUE = 2

# Common paths to check for events (prioritized list)
EVENT_PAGE_PATHS = [
    "",  # Homepage first - most likely to have events
    "/events",
    "/calendar",
]


def get_venues_with_websites(
    client: Client,
    venue_ids: Optional[list[int]] = None,
    missing_events: bool = False,
    event_venues_only: bool = False,
    limit: int = 100,
) -> list[dict]:
    """Fetch venues with websites to crawl."""

    query = client.table("venues").select(
        "id, name, slug, website, venue_type, address, neighborhood, city, state, zip, vibes"
    ).eq("active", True).not_.is_("website", "null")

    if venue_ids:
        query = query.in_("id", venue_ids)

    if event_venues_only:
        query = query.eq("is_event_venue", True)

    if missing_events:
        # Get venues with no events in the database
        # This requires a subquery approach
        pass  # Will filter after fetching

    query = query.limit(limit)
    result = query.execute()
    venues = result.data or []

    if missing_events and venues:
        # Filter to venues with no events
        venue_ids_list = [v["id"] for v in venues]
        events_result = client.table("events").select("venue_id").in_("venue_id", venue_ids_list).execute()
        venues_with_events = set(e["venue_id"] for e in (events_result.data or []))
        venues = [v for v in venues if v["id"] not in venues_with_events]

    return venues


def get_venues_missing_events(client: Client, limit: int = 100) -> list[dict]:
    """Get event venues with websites but no crawled events."""

    # Get all event venues with websites
    venues_result = client.table("venues").select(
        "id, name, slug, website, venue_type, address, neighborhood, city, state, zip, vibes"
    ).eq("active", True).eq("is_event_venue", True).not_.is_("website", "null").execute()

    venues = venues_result.data or []
    if not venues:
        return []

    # Get venue IDs that have events
    venue_ids = [v["id"] for v in venues]
    events_result = client.table("events").select("venue_id").in_("venue_id", venue_ids).execute()
    venues_with_events = set(e["venue_id"] for e in (events_result.data or []))

    # Return venues without events
    missing = [v for v in venues if v["id"] not in venues_with_events]
    return missing[:limit]


def fetch_venue_page(website: str, path: str = "") -> tuple[str, str, str | None]:
    """
    Fetch venue page content using Playwright.

    Returns:
        Tuple of (raw_text_content, full_url, error_message)
    """
    # Normalize URL
    url = website.rstrip("/")
    if path:
        url = f"{url}{path}"

    if not url.startswith("http"):
        url = f"https://{url}"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
                ignore_https_errors=True,  # Handle SSL issues
            )
            page = context.new_page()

            try:
                page.goto(url, wait_until="networkidle", timeout=15000)
                page.wait_for_timeout(1500)

                # Scroll to load lazy content
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(500)

                # Get page content
                html = page.content()
                text_content = extract_text_content(html)

                # Also try to get inner text for JS-rendered content
                body_text = page.inner_text("body")

                # Combine both approaches
                combined = f"{text_content}\n\n--- PAGE TEXT ---\n\n{body_text}"

            except PlaywrightTimeout:
                logger.warning(f"Timeout fetching {url}")
                return "", url, "timeout"
            finally:
                browser.close()

            return combined, url, None

    except Exception as e:
        error_str = str(e)
        logger.error(f"Error fetching {url}: {e}")
        return "", url, error_str


def find_events_page(website: str) -> tuple[str, str, str | None]:
    """
    Find the best events page for a venue.

    Tries common paths and returns the one with the most event-like content.

    Returns:
        Tuple of (best_content, best_url, last_error)
    """
    best_content = ""
    best_url = website
    best_score = 0
    last_error = None

    for path in EVENT_PAGE_PATHS[:MAX_PAGES_PER_VENUE]:
        content, url, error = fetch_venue_page(website, path)

        if error:
            last_error = error

        if not content:
            continue

        # Score based on event-related keywords
        content_lower = content.lower()
        score = 0

        event_keywords = [
            "event", "show", "concert", "performance", "ticket",
            "doors", "lineup", "schedule", "calendar", "upcoming",
            "pm", "am", "admission", "rsvp", "free", "cover",
        ]

        for keyword in event_keywords:
            score += content_lower.count(keyword)

        # Also look for date patterns
        import re
        date_patterns = [
            r"\d{1,2}/\d{1,2}/\d{2,4}",  # 1/15/2026
            r"\d{1,2}-\d{1,2}-\d{2,4}",  # 1-15-2026
            r"(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}",  # January 15
            r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday)",  # Day names
        ]

        for pattern in date_patterns:
            score += len(re.findall(pattern, content_lower)) * 2

        if score > best_score:
            best_score = score
            best_content = content
            best_url = url
            # Clear error if we found good content
            last_error = None

    return best_content, best_url, last_error


def crawl_venue(
    venue: dict,
    source_id: int,
    dry_run: bool = False,
    update_health_tags: bool = True,
) -> tuple[int, int, int, list[str]]:
    """
    Crawl a single venue website and extract events.

    Returns:
        Tuple of (events_found, events_new, events_updated, health_tags)
    """
    venue_id = venue["id"]
    venue_name = venue["name"]
    website = venue["website"]

    logger.info(f"Crawling {venue_name}: {website}")

    events_found = 0
    events_new = 0
    events_updated = 0
    health_tags: list[str] = []

    try:
        # Find the best events page
        content, source_url, fetch_error = find_events_page(website)

        # Detect health tags based on fetch results
        health_tags = detect_health_tags(content, fetch_error)

        if not content or len(content) < 100:
            logger.warning(f"No content found for {venue_name}")
            if fetch_error and not health_tags:
                # Add generic error tag if we have an error but no specific tag
                health_tags.append(HEALTH_TAG_NO_EVENTS)
            return 0, 0, 0, health_tags

        # Rate limit before LLM call
        time.sleep(LLM_RATE_LIMIT)

        # Extract events using LLM
        try:
            extracted_events = extract_events(
                raw_content=content,
                source_url=source_url,
                source_name=venue_name,
            )
        except Exception as e:
            logger.error(f"LLM extraction failed for {venue_name}: {e}")
            if HEALTH_TAG_PARSE_ERROR not in health_tags:
                health_tags.append(HEALTH_TAG_PARSE_ERROR)
            return 0, 0, 0, health_tags

        events_found = len(extracted_events)
        logger.info(f"Extracted {events_found} events from {venue_name}")

        # If we got content but no events, mark as no-events
        if events_found == 0 and HEALTH_TAG_NO_EVENTS not in health_tags:
            health_tags.append(HEALTH_TAG_NO_EVENTS)

        if dry_run:
            for event in extracted_events:
                logger.info(f"  [DRY RUN] {event.title} on {event.start_date}")
            return events_found, 0, 0, health_tags

        # Insert events
        for event in extracted_events:
            # Skip past events
            try:
                event_date = datetime.strptime(event.start_date, "%Y-%m-%d").date()
                if event_date < datetime.now().date():
                    continue
            except ValueError:
                continue

            # Generate content hash for deduplication
            content_hash = generate_content_hash(
                event.title,
                venue_name,
                event.start_date,
            )

            # Check for existing event
            if find_event_by_hash(content_hash):
                events_updated += 1
                continue

            # Build event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": event.title,
                "description": event.description,
                "start_date": event.start_date,
                "start_time": event.start_time,
                "end_date": event.end_date,
                "end_time": event.end_time,
                "is_all_day": event.is_all_day,
                "category": event.category,
                "tags": event.tags,
                "price_min": event.price_min,
                "price_max": event.price_max,
                "price_note": event.price_note,
                "is_free": event.is_free,
                "source_url": source_url,
                "ticket_url": event.ticket_url or source_url,
                "image_url": event.image_url,
                "raw_text": f"{event.title} - {event.start_date}",
                "extraction_confidence": event.confidence,
                "is_recurring": event.is_recurring,
                "recurrence_rule": event.recurrence_rule,
                "content_hash": content_hash,
            }

            try:
                insert_event(
                    event_record,
                    series_hint=event.series_hint.model_dump() if event.series_hint else None,
                    genres=event.genres,
                )
                events_new += 1
                logger.info(f"  Added: {event.title} on {event.start_date}")
            except Exception as e:
                logger.error(f"  Failed to insert {event.title}: {e}")

        # Clear error tags if we successfully found events
        if events_found > 0:
            health_tags = [t for t in health_tags if t not in [
                HEALTH_TAG_NO_EVENTS, HEALTH_TAG_PARSE_ERROR,
                HEALTH_TAG_TIMEOUT, HEALTH_TAG_DNS_ERROR, HEALTH_TAG_SSL_ERROR
            ]]

    except Exception as e:
        logger.error(f"Error crawling {venue_name}: {e}")

    return events_found, events_new, events_updated, health_tags


def get_or_create_generic_source(client: Client) -> int:
    """Get or create the generic venue crawler source."""

    slug = "generic-venue-crawler"

    # Check if exists
    result = client.table("sources").select("id").eq("slug", slug).execute()
    if result.data:
        return result.data[0]["id"]

    # Create new source
    source_data = {
        "slug": slug,
        "name": "Generic Venue Crawler",
        "url": "https://lostcity.ai",  # Placeholder
        "source_type": "website",
        "crawl_frequency": "weekly",
        "is_active": True,
    }

    result = client.table("sources").insert(source_data).execute()
    return result.data[0]["id"]


def main():
    parser = argparse.ArgumentParser(description="Generic LLM-powered venue crawler")
    parser.add_argument(
        "--venue-ids",
        help="Comma-separated list of venue IDs to crawl",
    )
    parser.add_argument(
        "--missing-events",
        action="store_true",
        help="Crawl event venues with no crawled events",
    )
    parser.add_argument(
        "--event-venues",
        action="store_true",
        help="Crawl all venues marked as event venues",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum number of venues to crawl (default: 50)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extract events but don't insert into database",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    client = get_client()

    # Get or create source
    source_id = get_or_create_generic_source(client)
    logger.info(f"Using source ID: {source_id}")

    # Get venues to crawl
    if args.venue_ids:
        venue_ids = [int(v.strip()) for v in args.venue_ids.split(",")]
        venues = get_venues_with_websites(client, venue_ids=venue_ids, limit=args.limit)
    elif args.missing_events:
        venues = get_venues_missing_events(client, limit=args.limit)
    elif args.event_venues:
        venues = get_venues_with_websites(client, event_venues_only=True, limit=args.limit)
    else:
        print("Please specify --venue-ids, --missing-events, or --event-venues")
        sys.exit(1)

    logger.info(f"Found {len(venues)} venues to crawl")

    if not venues:
        print("No venues found to crawl")
        sys.exit(0)

    # Crawl venues
    total_found = 0
    total_new = 0
    total_updated = 0
    successful = 0
    failed = 0
    all_health_tags: dict[str, int] = {}  # Track tag occurrences

    for i, venue in enumerate(venues, 1):
        logger.info(f"\n[{i}/{len(venues)}] Processing {venue['name']}...")

        try:
            found, new, updated, health_tags = crawl_venue(venue, source_id, dry_run=args.dry_run)
            total_found += found
            total_new += new
            total_updated += updated

            # Track health tags
            for tag in health_tags:
                all_health_tags[tag] = all_health_tags.get(tag, 0) + 1

            if found > 0:
                successful += 1
            else:
                failed += 1

            # Log detected health tags
            if health_tags:
                logger.info(f"  Health tags: {', '.join(health_tags)}")

        except Exception as e:
            logger.error(f"Failed to crawl {venue['name']}: {e}")
            failed += 1

    # Update source health tags based on aggregated results
    if not args.dry_run and all_health_tags:
        # Determine overall source health tags based on majority of venues
        source_tags = []
        total_venues = len(venues)
        for tag, count in all_health_tags.items():
            # If more than 50% of venues have a tag, apply it to source
            if count > total_venues * 0.5:
                source_tags.append(tag)

        if source_tags:
            logger.info(f"Updating source health tags: {source_tags}")
            update_source_health_tags(source_id, source_tags)

    # Summary
    print("\n" + "=" * 60)
    print("CRAWL SUMMARY")
    print("=" * 60)
    print(f"Venues processed: {len(venues)}")
    print(f"Venues with events: {successful}")
    print(f"Venues without events: {failed}")
    print(f"Events found: {total_found}")
    print(f"Events new: {total_new}")
    print(f"Events updated: {total_updated}")

    if all_health_tags:
        print("\nHealth tags detected:")
        for tag, count in sorted(all_health_tags.items(), key=lambda x: -x[1]):
            print(f"  {tag}: {count} venue(s)")

    if args.dry_run:
        print("\n[DRY RUN - No events were inserted]")


if __name__ == "__main__":
    main()
