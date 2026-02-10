#!/usr/bin/env python3
"""
Festival program enrichment pipeline.

Crawls a festival's website and subpages to extract rich program data:
  - Sessions/panels → events linked to the festival series
  - Authors/speakers → artists table with event_artists links
  - Experiences/add-ons → events with pricing
  - Keynotes → events with headliner flags

Usage:
    python enrich_festival_program.py --slug love-yall-book-fest
    python enrich_festival_program.py --slug love-yall-book-fest --dry-run
    python enrich_festival_program.py --slug dragon-con --render-js
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from dotenv import load_dotenv

from config import get_config
from db import (
    get_client,
    get_source_by_slug,
    insert_event,
    find_event_by_hash,
    upsert_event_artists,
)
from artists import get_or_create_artist
from dedupe import generate_content_hash
from llm_client import generate_text
from utils import setup_logging, slugify

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Page fetching
# ---------------------------------------------------------------------------

def fetch_html(url: str, render_js: bool = False) -> str:
    if render_js:
        return _fetch_with_playwright(url)
    return _fetch_with_requests(url)


def _fetch_with_requests(url: str) -> str:
    cfg = get_config()
    headers = {"User-Agent": cfg.crawler.user_agent}
    resp = requests.get(url, headers=headers, timeout=cfg.crawler.request_timeout)
    resp.raise_for_status()
    return resp.text


def _fetch_with_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        for _ in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(800)
        html = page.content()
        browser.close()
        return html


def _strip_html(html: str, max_chars: int = 50000) -> str:
    """Strip HTML to plain text for LLM input, keeping structure hints."""
    soup = BeautifulSoup(html, "lxml")
    # Remove scripts, styles, nav, footer
    for tag in soup.find_all(["script", "style", "nav", "footer", "noscript", "svg"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    # Collapse blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text[:max_chars]


# ---------------------------------------------------------------------------
# Page discovery
# ---------------------------------------------------------------------------

def discover_pages(homepage_url: str, html: str) -> dict[str, str]:
    """Find relevant subpages from the homepage. Returns {page_type: url}."""
    soup = BeautifulSoup(html, "lxml")
    base = urlparse(homepage_url)
    base_domain = base.netloc

    pages: dict[str, str] = {}
    link_map: dict[str, list[str]] = {}

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        full_url = urljoin(homepage_url, href)

        # Only same-domain links
        if urlparse(full_url).netloc != base_domain:
            continue

        path = urlparse(full_url).path.lower().rstrip("/")
        combined = f"{text} {path}"

        if not link_map.get(full_url):
            link_map[full_url] = []
        link_map[full_url].append(combined)

    # Classify pages by keywords
    schedule_kw = ["schedule", "program", "agenda", "lineup", "panel", "session"]
    author_kw = ["author", "speaker", "guest", "performer", "artist", "lineup", "roster"]
    experience_kw = ["experience", "special event", "add-on", "activity", "workshop"]
    ticket_kw = ["ticket", "register", "pass", "admission"]

    for url, signals in link_map.items():
        combined = " ".join(signals)

        if any(kw in combined for kw in schedule_kw) and "schedule" not in pages:
            # Prefer schedule over other matches
            pages["schedule"] = url
        if any(kw in combined for kw in author_kw) and "authors" not in pages:
            # Avoid if this is also the schedule page
            if url != pages.get("schedule"):
                pages["authors"] = url
        if any(kw in combined for kw in experience_kw) and "experiences" not in pages:
            pages["experiences"] = url
        if any(kw in combined for kw in ticket_kw) and "tickets" not in pages:
            pages["tickets"] = url

    return pages


# ---------------------------------------------------------------------------
# LLM extraction prompts
# ---------------------------------------------------------------------------

SCHEDULE_SYSTEM_PROMPT = """You are a data extraction assistant. Extract ALL scheduled activities, performances, sessions, panels, parades, shows, and events from this festival page.

This could be a conference (with panel sessions and keynotes) OR a cultural/entertainment festival (with shows, parades, performances, competitions, and activities). Extract everything that has a time or is a distinct programmed activity.

Return a JSON array of sessions. Each session should have:
{
  "title": "Event or activity title",
  "program_title": "Program/track/stage grouping name" (null if not available),
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM" (24h format, null if not available),
  "end_time": "HH:MM" (24h format, null if not available),
  "room": "Room, location, or area name" (null if not available),
  "description": "Brief description" (null if not available),
  "panelists": ["Performer Name 1", "Speaker Name 2"],
  "moderator": null,
  "is_keynote": false,
  "sponsor": "Sponsor name" (null if not available)
}

Rules:
- Include ALL activities, performances, shows, parades, and sessions — not just a sample
- For recurring daily schedules (same activities each day of the festival), create ONE entry per activity with the first date of the festival
- Use ISO date format YYYY-MM-DD
- Use 24-hour time format
- Mark headline/main events with is_keynote: true
- If the year isn't specified, use 2026
- Use a stable program_title to group related sessions when possible
- Return ONLY the JSON array, no other text
- If the page has no scheduled events or activities, return []"""

AUTHOR_SYSTEM_PROMPT = """You are a data extraction assistant. Extract ALL authors/speakers/guests from this festival page.

Return a JSON array of people. Each person should have:
{
  "name": "Full Name",
  "bio": "Short bio (1-2 sentences max, null if not available)",
  "photo_url": "URL to their photo/headshot" (null if not available),
  "genres": ["genre1", "genre2"] (book genres, specialties, etc.),
  "role": "author" | "keynote_speaker" | "panelist" | "moderator" | "guest",
  "pronouns": "she/her" (null if not available)
}

Rules:
- Include ALL people listed, not just a sample
- Keep bios concise (under 200 chars)
- For photo URLs, include the full URL including any CDN prefix
- Return ONLY the JSON array, no other text"""

EXPERIENCE_SYSTEM_PROMPT = """You are a data extraction assistant. Extract ALL special experiences, add-on events, or ticketed activities from this festival page.

Return a JSON array of experiences. Each should have:
{
  "title": "Experience title",
  "program_title": "Program/track/stage grouping name" (null if not available),
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM" (24h format, null if not available),
  "end_time": "HH:MM" (24h format, null if not available),
  "price": 79.00 (numeric, null if not available),
  "description": "Brief description",
  "featured_people": ["Person Name 1", "Person Name 2"],
  "age_restriction": "21+" (null if none),
  "amenities": "Includes transportation, snacks, etc." (null if not available)
}

Rules:
- Include ALL experiences, not just a sample
- Use ISO date format YYYY-MM-DD
- Use 24-hour time format
- Price should be numeric (no $ sign)
- If the year isn't specified, use 2026
- Use a stable program_title to group related experiences when possible
- Return ONLY the JSON array, no other text"""


def _extract_json_from_llm(response: str) -> list[dict]:
    """Parse JSON array from LLM response, handling markdown fences."""
    text = response.strip()
    # Strip markdown fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        return [data]
    except json.JSONDecodeError:
        # Try to find JSON array in the response
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        logger.warning(f"Failed to parse LLM JSON response ({len(text)} chars)")
        return []


# ---------------------------------------------------------------------------
# Extraction functions
# ---------------------------------------------------------------------------

def extract_sessions(html: str, festival_dates: dict) -> list[dict]:
    """Extract sessions from a schedule page using LLM."""
    text = _strip_html(html)
    date_context = ""
    if festival_dates.get("start") and festival_dates.get("end"):
        date_context = f"\n\nFestival dates: {festival_dates['start']} to {festival_dates['end']}"

    response = generate_text(
        SCHEDULE_SYSTEM_PROMPT,
        f"Extract all sessions from this schedule page:{date_context}\n\n{text}",
    )
    return _extract_json_from_llm(response)


def extract_authors(html: str) -> list[dict]:
    """Extract author/speaker profiles from an authors page using LLM."""
    text = _strip_html(html)
    response = generate_text(
        AUTHOR_SYSTEM_PROMPT,
        f"Extract all authors/speakers from this page:\n\n{text}",
    )
    return _extract_json_from_llm(response)


def extract_experiences(html: str, festival_dates: dict) -> list[dict]:
    """Extract special experiences from an experiences page using LLM."""
    text = _strip_html(html)
    date_context = ""
    if festival_dates.get("start") and festival_dates.get("end"):
        date_context = f"\n\nFestival dates: {festival_dates['start']} to {festival_dates['end']}"

    response = generate_text(
        EXPERIENCE_SYSTEM_PROMPT,
        f"Extract all special experiences from this page:{date_context}\n\n{text}",
    )
    return _extract_json_from_llm(response)


# ---------------------------------------------------------------------------
# Database insertion
# ---------------------------------------------------------------------------

def _clean_program_title(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = re.sub(r"\s+", " ", value).strip(" -:|")
    return normalized[:120] if normalized else None


def infer_session_program_title(session: dict) -> str:
    """Infer program title from extracted session fields."""
    for key in ("program_title", "program", "program_name", "track", "stage"):
        title = _clean_program_title(session.get(key))
        if title:
            return title
    if session.get("is_keynote"):
        return "Keynotes"
    return "General Program"


def infer_experience_program_title(exp: dict) -> str:
    """Infer program title from extracted experience fields."""
    for key in ("program_title", "program", "program_name", "track", "stage"):
        title = _clean_program_title(exp.get(key))
        if title:
            return title
    return "Experiences"


def ensure_program_series(festival: dict, program_title: str) -> str:
    """Get or create a festival_program series for a specific program title."""
    client = get_client()
    program_title = _clean_program_title(program_title) or "General Program"

    # Check for existing series
    result = (
        client.table("series")
        .select("id")
        .eq("festival_id", festival["id"])
        .eq("series_type", "festival_program")
        .eq("title", program_title)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["id"]

    # Create new per-program series
    base_slug = slugify(f"{festival.get('slug', festival['name'])}-{program_title}")
    candidate_slug = base_slug
    counter = 2
    while True:
        existing_slug = (
            client.table("series")
            .select("id")
            .eq("slug", candidate_slug)
            .limit(1)
            .execute()
        )
        if not existing_slug.data:
            break
        candidate_slug = f"{base_slug}-{counter}"
        counter += 1

    series_data = {
        "title": program_title,
        "slug": candidate_slug,
        "series_type": "festival_program",
        "festival_id": festival["id"],
        "category": (festival.get("categories") or ["community"])[0],
        "description": f"{program_title} program at {festival['name']}",
        "image_url": festival.get("image_url"),
        "tags": ["festival", "program"],
        "is_active": True,
    }
    result = client.table("series").insert(series_data).execute()
    return result.data[0]["id"]


def insert_session_event(
    session: dict,
    festival: dict,
    source_id: int,
    venue_id: int,
    series_id: str,
    program_title: str,
    dry_run: bool = False,
) -> Optional[int]:
    """Insert a single session as an event. Returns event ID or None."""
    title = session.get("title", "").strip()
    start_date = session.get("date", "")
    if not title or not start_date:
        return None

    # Validate date format
    if not re.match(r"\d{4}-\d{2}-\d{2}", start_date):
        logger.warning(f"Bad date format for session '{title}': {start_date}")
        return None

    # Reject past dates
    if start_date < date.today().isoformat():
        logger.debug(f"Past date, skipping: {title} on {start_date}")
        return None

    venue_name = festival.get("location") or festival.get("name")
    content_hash = generate_content_hash(title, venue_name, start_date)

    if find_event_by_hash(content_hash):
        logger.debug(f"Duplicate: {title} on {start_date}")
        return None

    if dry_run:
        panelists = session.get("panelists", [])
        logger.info(
            f"  [DRY RUN] {title} | {start_date} {session.get('start_time', '??:??')} | "
            f"program={program_title} | room={session.get('room', '-')} | {len(panelists)} panelists"
        )
        return -1

    # Build category from session type
    category = "learning"
    is_keynote = session.get("is_keynote", False)
    tags = ["festival", "panel"]
    if is_keynote:
        tags.append("keynote")

    description = session.get("description", "")
    room = session.get("room")
    if room and description:
        description = f"[{room}] {description}"
    elif room:
        description = f"Location: {room}"

    # Add moderator/sponsor info
    moderator = session.get("moderator")
    if moderator:
        description = f"{description}\nModerated by {moderator}" if description else f"Moderated by {moderator}"

    event_data = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description[:1000] if description else None,
        "start_date": start_date,
        "start_time": session.get("start_time"),
        "end_time": session.get("end_time"),
        "is_all_day": False,
        "category": category,
        "tags": tags,
        "is_free": False,
        "source_url": festival.get("website", ""),
        "image_url": festival.get("image_url"),
        "content_hash": content_hash,
        "is_recurring": False,
        "series_id": series_id,
    }

    try:
        event_id = insert_event(event_data)

        # Link panelists as event_artists
        panelists = session.get("panelists", [])
        moderator_name = session.get("moderator")
        if panelists:
            artist_entries = []
            for i, name in enumerate(panelists, 1):
                role = "moderator" if name == moderator_name else "panelist"
                if is_keynote:
                    role = "keynote"
                artist_entries.append({
                    "name": name,
                    "role": role,
                    "billing_order": i,
                    "is_headliner": is_keynote,
                })
            upsert_event_artists(event_id, artist_entries)

        return event_id
    except Exception as e:
        logger.warning(f"Failed to insert session '{title}': {e}")
        return None


def insert_experience_event(
    exp: dict,
    festival: dict,
    source_id: int,
    venue_id: int,
    series_id: str,
    program_title: str,
    dry_run: bool = False,
) -> Optional[int]:
    """Insert a special experience as an event. Returns event ID or None."""
    title = exp.get("title", "").strip()
    start_date = exp.get("date", "")
    if not title or not start_date:
        return None

    if not re.match(r"\d{4}-\d{2}-\d{2}", start_date):
        logger.warning(f"Bad date format for experience '{title}': {start_date}")
        return None

    # Reject past dates
    if start_date < date.today().isoformat():
        logger.debug(f"Past date, skipping experience: {title} on {start_date}")
        return None

    venue_name = festival.get("location") or festival.get("name")
    content_hash = generate_content_hash(title, venue_name, start_date)

    if find_event_by_hash(content_hash):
        logger.debug(f"Duplicate experience: {title}")
        return None

    if dry_run:
        price = exp.get("price")
        logger.info(
            f"  [DRY RUN] Experience: {title} | {start_date} {exp.get('start_time', '??:??')} | "
            f"program={program_title} | ${price or '?'}"
        )
        return -1

    description = exp.get("description", "")
    amenities = exp.get("amenities")
    age = exp.get("age_restriction")
    if amenities:
        description = f"{description}\n{amenities}" if description else amenities
    if age:
        description = f"{description}\nAge restriction: {age}" if description else f"Age restriction: {age}"

    price = exp.get("price")

    event_data = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description[:1000] if description else None,
        "start_date": start_date,
        "start_time": exp.get("start_time"),
        "end_time": exp.get("end_time"),
        "is_all_day": False,
        "category": "learning",
        "tags": ["festival", "experience", "special-event"],
        "is_free": False,
        "price_min": price,
        "price_max": price,
        "source_url": festival.get("website", ""),
        "image_url": festival.get("image_url"),
        "content_hash": content_hash,
        "is_recurring": False,
        "series_id": series_id,
    }

    try:
        event_id = insert_event(event_data)

        # Link featured people
        people = exp.get("featured_people", [])
        if people:
            artist_entries = [
                {"name": name, "role": "featured", "billing_order": i}
                for i, name in enumerate(people, 1)
            ]
            upsert_event_artists(event_id, artist_entries)

        return event_id
    except Exception as e:
        logger.warning(f"Failed to insert experience '{title}': {e}")
        return None


def create_author_artists(
    authors: list[dict],
    dry_run: bool = False,
) -> dict[str, dict]:
    """Create artist records for all authors. Returns {name: artist_record}."""
    created = {}
    for author in authors:
        name = author.get("name", "").strip()
        if not name:
            continue

        if dry_run:
            logger.info(f"  [DRY RUN] Author: {name} | genres={author.get('genres', [])}")
            created[name] = {"id": None, "name": name}
            continue

        try:
            artist = get_or_create_artist(name, discipline="author")

            # Backfill bio, photo, genres if missing
            updates = {}
            if author.get("bio") and not artist.get("bio"):
                updates["bio"] = author["bio"][:500]
            if author.get("photo_url") and not artist.get("image_url"):
                updates["image_url"] = author["photo_url"]
            if author.get("genres") and not artist.get("genres"):
                updates["genres"] = author["genres"]

            if updates:
                client = get_client()
                client.table("artists").update(updates).eq("id", artist["id"]).execute()
                artist.update(updates)

            created[name] = artist
        except Exception as e:
            logger.warning(f"Failed to create artist '{name}': {e}")

    return created


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def enrich_festival_program(
    slug: str,
    render_js: bool = False,
    dry_run: bool = False,
    skip_authors: bool = False,
    skip_sessions: bool = False,
    skip_experiences: bool = False,
) -> dict:
    """
    Full festival program enrichment pipeline.

    Returns stats dict with counts of extracted/inserted items.
    """
    client = get_client()

    # 1. Load festival record
    result = client.table("festivals").select("*").eq("slug", slug).execute()
    if not result.data:
        raise ValueError(f"Festival not found: {slug}")
    festival = result.data[0]

    # 2. Load source record
    source = get_source_by_slug(slug)
    if not source:
        raise ValueError(f"Source not found: {slug}")
    source_id = source["id"]

    # 3. Resolve venue — try source, then search by location name
    venue_id = source.get("venue_id")
    if not venue_id and festival.get("location"):
        from db import get_venue_by_slug
        # Try exact slug
        venue_slug = slugify(festival["location"])
        existing = get_venue_by_slug(venue_slug)
        if existing:
            venue_id = existing["id"]
        if not existing:
            # Fuzzy search — match on key words from the location
            words = [w for w in festival["location"].split() if len(w) > 3]
            if len(words) >= 2:
                # Use first and last significant words for broad match
                pattern = f"%{words[0]}%{words[-1]}%"
                result = (
                    client.table("venues")
                    .select("id, name")
                    .ilike("name", pattern)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    venue_id = result.data[0]["id"]
                    logger.info(f"Resolved venue by name search: {result.data[0]['name']}")
    if not venue_id:
        raise ValueError(f"No venue resolved for festival: {slug}")

    # Festival date context
    festival_dates = {
        "start": festival.get("announced_start"),
        "end": festival.get("announced_end"),
    }

    website = festival.get("website")
    if not website:
        raise ValueError(f"No website for festival: {slug}")

    stats = {
        "pages_crawled": 0,
        "authors_found": 0,
        "authors_created": 0,
        "sessions_found": 0,
        "sessions_inserted": 0,
        "experiences_found": 0,
        "experiences_inserted": 0,
        "programs_grouped": 0,
    }
    program_series_map: dict[str, str] = {}

    logger.info(f"Festival Program Enrichment: {festival['name']}")
    logger.info(f"{'=' * 70}")
    logger.info(f"Website: {website}")
    logger.info(f"Dates: {festival_dates['start']} to {festival_dates['end']}")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"{'=' * 70}\n")

    # 5. Fetch homepage and discover subpages
    logger.info("Fetching homepage...")
    homepage_html = fetch_html(website, render_js=render_js)
    stats["pages_crawled"] += 1

    pages = discover_pages(website, homepage_html)
    logger.info(f"Discovered pages: {json.dumps(pages, indent=2)}")

    # 6. Extract authors
    if not skip_authors:
        author_pages = []
        if "authors" in pages:
            author_pages.append(pages["authors"])

        # Also check for YA vs Adult author pages (common pattern)
        soup = BeautifulSoup(homepage_html, "lxml")
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True).lower()
            href = urljoin(website, a["href"])
            if urlparse(href).netloc == urlparse(website).netloc:
                if any(kw in text for kw in ["ya author", "young adult", "adult author"]):
                    if href not in author_pages:
                        author_pages.append(href)

        if author_pages:
            all_authors = []
            for url in author_pages:
                logger.info(f"\nExtracting authors from: {url}")
                try:
                    html = fetch_html(url, render_js=render_js)
                    stats["pages_crawled"] += 1
                    authors = extract_authors(html)
                    logger.info(f"  Found {len(authors)} authors")
                    all_authors.extend(authors)
                except Exception as e:
                    logger.warning(f"  Failed to fetch/extract authors: {e}")
                time.sleep(1.0)

            # Deduplicate by name
            seen_names = set()
            unique_authors = []
            for a in all_authors:
                name = a.get("name", "").strip().lower()
                if name and name not in seen_names:
                    seen_names.add(name)
                    unique_authors.append(a)

            stats["authors_found"] = len(unique_authors)
            logger.info(f"\nTotal unique authors: {len(unique_authors)}")

            author_map = create_author_artists(unique_authors, dry_run=dry_run)
            stats["authors_created"] = len(author_map)
        else:
            logger.info("\nNo author pages found")

    # 7. Extract sessions/panels
    # Try homepage first (many festivals have schedule on main page),
    # then fall back to discovered schedule subpage
    if not skip_sessions:
        sessions = []

        # Try homepage first
        logger.info("\nExtracting sessions from homepage...")
        sessions = extract_sessions(homepage_html, festival_dates)
        if sessions:
            logger.info(f"  Found {len(sessions)} sessions on homepage")

        # Fall back to schedule subpage if homepage yielded nothing
        if not sessions:
            schedule_url = pages.get("schedule")
            if schedule_url:
                logger.info(f"\nExtracting sessions from: {schedule_url}")
                try:
                    html = fetch_html(schedule_url, render_js=render_js)
                    stats["pages_crawled"] += 1
                    sessions = extract_sessions(html, festival_dates)
                    logger.info(f"  Found {len(sessions)} sessions")
                except Exception as e:
                    logger.warning(f"  Failed to fetch/extract sessions: {e}")

        stats["sessions_found"] = len(sessions)
        for session in sessions:
            program_title = infer_session_program_title(session)
            if program_title not in program_series_map:
                if dry_run:
                    program_series_map[program_title] = f"dry-run-{slugify(program_title)}"
                else:
                    try:
                        program_series_map[program_title] = ensure_program_series(festival, program_title)
                    except Exception as e:
                        logger.warning(
                            f"Failed to ensure program series '{program_title}', using fallback: {e}"
                        )
                        program_series_map[program_title] = ensure_program_series(festival, "General Program")

            result = insert_session_event(
                session,
                festival,
                source_id,
                venue_id,
                program_series_map[program_title],
                program_title,
                dry_run,
            )
            if result is not None:
                stats["sessions_inserted"] += 1

    # 8. Extract experiences
    if not skip_experiences:
        experience_url = pages.get("experiences")
        if experience_url:
            logger.info(f"\nExtracting experiences from: {experience_url}")
            try:
                html = fetch_html(experience_url, render_js=render_js)
                stats["pages_crawled"] += 1
                experiences = extract_experiences(html, festival_dates)
                stats["experiences_found"] = len(experiences)
                logger.info(f"  Found {len(experiences)} experiences")

                for exp in experiences:
                    program_title = infer_experience_program_title(exp)
                    if program_title not in program_series_map:
                        if dry_run:
                            program_series_map[program_title] = f"dry-run-{slugify(program_title)}"
                        else:
                            try:
                                program_series_map[program_title] = ensure_program_series(festival, program_title)
                            except Exception as e:
                                logger.warning(
                                    f"Failed to ensure program series '{program_title}', using fallback: {e}"
                                )
                                program_series_map[program_title] = ensure_program_series(
                                    festival, "Experiences"
                                )

                    result = insert_experience_event(
                        exp,
                        festival,
                        source_id,
                        venue_id,
                        program_series_map[program_title],
                        program_title,
                        dry_run,
                    )
                    if result is not None:
                        stats["experiences_inserted"] += 1
            except Exception as e:
                logger.warning(f"  Failed to fetch/extract experiences: {e}")
        else:
            logger.info("\nNo experience page found")

    stats["programs_grouped"] = len(program_series_map)

    # Summary
    logger.info(f"\n{'=' * 70}")
    logger.info("ENRICHMENT RESULTS")
    logger.info(f"{'=' * 70}")
    logger.info(f"Pages crawled:        {stats['pages_crawled']}")
    logger.info(f"Authors found:        {stats['authors_found']}")
    logger.info(f"Authors created:      {stats['authors_created']}")
    logger.info(f"Sessions found:       {stats['sessions_found']}")
    logger.info(f"Sessions inserted:    {stats['sessions_inserted']}")
    logger.info(f"Experiences found:    {stats['experiences_found']}")
    logger.info(f"Experiences inserted: {stats['experiences_inserted']}")
    logger.info(f"Programs grouped:     {stats['programs_grouped']}")
    if program_series_map:
        top_programs = ", ".join(sorted(program_series_map.keys())[:12])
        logger.info(f"Program buckets:      {top_programs}")
    if dry_run:
        logger.info("\nDRY RUN — no data written to database")

    return stats


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Enrich festival with program data")
    parser.add_argument("--slug", required=True, help="Festival slug")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright")
    parser.add_argument("--dry-run", action="store_true", help="Preview without inserting")
    parser.add_argument("--skip-authors", action="store_true", help="Skip author extraction")
    parser.add_argument("--skip-sessions", action="store_true", help="Skip session extraction")
    parser.add_argument("--skip-experiences", action="store_true", help="Skip experience extraction")
    parser.add_argument("--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        enrich_festival_program(
            slug=args.slug,
            render_js=args.render_js,
            dry_run=args.dry_run,
            skip_authors=args.skip_authors,
            skip_sessions=args.skip_sessions,
            skip_experiences=args.skip_experiences,
        )
    except ValueError as e:
        logger.error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
