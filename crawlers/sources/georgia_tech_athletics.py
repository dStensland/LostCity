"""
Crawler for Georgia Tech Athletics (ramblinwreck.com).
Yellow Jackets sports events - football, basketball, baseball, etc.
Scrapes sport-specific schedule pages for game information.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from bs4 import BeautifulSoup
import requests

from date_utils import MAX_FUTURE_DAYS_DEFAULT
from db import (
    find_existing_event_for_insert,
    get_client,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
    writes_enabled,
)
from dedupe import generate_content_hash
from utils import extract_image_url

logger = logging.getLogger(__name__)

BASE_URL = "https://ramblinwreck.com"

# Sport-specific schedule URLs
SPORTS = [
    ("football", "/sports/m-footbl/schedule/", "m-footbl"),
    ("mens-basketball", "/sports/m-baskbl/schedule/", "m-baskbl"),
    ("womens-basketball", "/sports/w-baskbl/schedule/", "w-baskbl"),
    ("baseball", "/sports/m-basebl/schedule/", "m-basebl"),
    ("softball", "/sports/w-softbl/schedule/", "w-softbl"),
    ("volleyball", "/sports/w-volley/schedule/", "w-volley"),
]

# Venue mappings for different sports
VENUES = {
    "football": {
        "name": "Bobby Dodd Stadium",
        "slug": "bobby-dodd-stadium",
        "address": "177 North Avenue NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30313",
        "venue_type": "stadium",
        "website": "https://ramblinwreck.com",
    },
    "mens-basketball": {
        "name": "McCamish Pavilion",
        "slug": "mccamish-pavilion",
        "address": "965 Fowler Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "arena",
        "website": "https://ramblinwreck.com",
    },
    "womens-basketball": {
        "name": "McCamish Pavilion",
        "slug": "mccamish-pavilion",
        "address": "965 Fowler Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "venue_type": "arena",
        "website": "https://ramblinwreck.com",
    },
    "baseball": {
        "name": "Russ Chandler Stadium",
        "slug": "russ-chandler-stadium",
        "address": "150 Bobby Dodd Way NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "stadium",
        "website": "https://ramblinwreck.com",
    },
    "softball": {
        "name": "Shirley C. Mewborn Field",
        "slug": "shirley-c-mewborn-field",
        "address": "955 Fowler Street NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "stadium",
        "website": "https://ramblinwreck.com",
    },
    "default": {
        "name": "Georgia Tech Campus",
        "slug": "georgia-tech-campus",
        "address": "North Avenue NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30332",
        "venue_type": "university",
        "website": "https://gatech.edu",
    },
}

SPORT_TITLE_FORMATS = {
    "baseball": ("Georgia Tech Yellow Jackets Baseball", "Baseball"),
    "softball": ("Georgia Tech Yellow Jackets Softball", "Softball"),
}


def resolve_schedule_date(
    month_str: str,
    day_str: str,
    *,
    today: date | None = None,
) -> str | None:
    """
    Infer a year for season schedule dates without explicit year metadata.

    Sidearm season pages frequently mix Nov/Dec dates with Jan/Feb dates for the
    same season. We allow year rollover for winter dates, but skip anything
    beyond the event validation horizon instead of attempting inserts that will
    be rejected downstream.
    """
    reference_date = today or datetime.now().date()

    try:
        candidate = datetime.strptime(
            f"{month_str} {day_str} {reference_date.year}",
            "%b %d %Y",
        ).date()
    except ValueError as exc:
        logger.debug(f"Failed to parse date {month_str} {day_str}: {exc}")
        return None

    if candidate < reference_date - timedelta(days=30):
        try:
            candidate = candidate.replace(year=candidate.year + 1)
        except ValueError as exc:
            logger.debug(
                "Failed to roll Georgia Tech schedule date %s %s into next year: %s",
                month_str,
                day_str,
                exc,
            )
            return None

    if candidate > reference_date + timedelta(days=MAX_FUTURE_DAYS_DEFAULT):
        logger.debug(
            "Skipping Georgia Tech schedule date outside %s-day horizon: %s-%02d-%02d",
            MAX_FUTURE_DAYS_DEFAULT,
            candidate.year,
            candidate.month,
            candidate.day,
        )
        return None

    return candidate.isoformat()


def parse_schedule_page(
    soup: BeautifulSoup,
    sport_name: str,
    *,
    today: date | None = None,
) -> list[dict]:
    """Parse game information from schedule page by finding schedule item divs."""
    games = []

    # Find all schedule items
    schedule_items = soup.select("div.schedule__table_item--inner")
    logger.debug(f"Found {len(schedule_items)} schedule items")

    for item in schedule_items:
        try:
            # Check if this is a home game
            item_classes = item.get("class", [])
            is_home = "home" in item_classes

            # Skip away and neutral games - we only want home games
            if not is_home:
                continue

            # Check if game already has results (past game)
            has_result = item.select_one("div.score_results") is not None
            if has_result:
                logger.debug("Skipping past game with results")
                continue

            # Extract date from <time> tag
            time_elem = item.select_one("time")
            if not time_elem:
                logger.debug("No time element found, skipping")
                continue

            date_str = time_elem.get_text(strip=True)  # e.g., "Mon Nov 3" or "Sat Dec 6"

            # Parse date - format is like "Mon Nov 3" or "Fri Nov 7"
            # Remove day of week if present
            date_parts = date_str.split()
            if len(date_parts) >= 3:
                # Format: "Mon Nov 3"
                month_str = date_parts[1]
                day_str = date_parts[2]
            elif len(date_parts) == 2:
                # Format: "Nov 3"
                month_str = date_parts[0]
                day_str = date_parts[1]
            else:
                logger.debug(f"Could not parse date: {date_str}")
                continue

            parsed_date = resolve_schedule_date(month_str, day_str, today=today)
            if not parsed_date:
                continue

            # Extract opponent from the explicit team-name block when available.
            opponent_name_block = item.select_one("div.matchup .name")
            opponent = ""
            if opponent_name_block:
                school = opponent_name_block.select_one("span")
                mascot = opponent_name_block.select_one("p")
                school_text = school.get_text(" ", strip=True) if school else ""
                mascot_text = mascot.get_text(" ", strip=True) if mascot else ""
                opponent = " ".join(part for part in [school_text, mascot_text] if part)

            if not opponent:
                # Fallback to the opponent logo alt if the name block is absent.
                logos = item.select("img[alt]")
                if len(logos) < 2:
                    logger.debug("Could not find opponent logo")
                    continue
                opponent = logos[1].get("alt", "").strip()

            # Extract time if available
            # NOTE: ramblinwreck.com typically does not publish game times until closer
            # to game day (usually 1-2 weeks before). The <div class="time"> element
            # only appears on the schedule page once times are announced. This is normal
            # for college athletics - most future games will have date but no time.
            time_div = item.select_one("div.time")
            game_time = None
            if time_div:
                time_str = time_div.get_text(strip=True)
                # Parse time like "7:00 PM" or "2:00 PM"
                time_match = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_str, re.IGNORECASE)
                if time_match:
                    hour, minute, period = time_match.groups()
                    hour = int(hour)
                    if period.upper() == "PM" and hour != 12:
                        hour += 12
                    elif period.upper() == "AM" and hour == 12:
                        hour = 0
                    game_time = f"{hour:02d}:{minute}"
                    logger.debug(f"Found game time: {game_time}")

            ticket_link = None
            for link in item.select("div.information a[href]"):
                if "ticket" not in link.get_text(" ", strip=True).lower():
                    continue
                href = link.get("href", "").strip()
                if not href:
                    continue
                if href.startswith("http://") or href.startswith("https://"):
                    ticket_link = href
                else:
                    ticket_link = f"{BASE_URL}{href}"
                break

            games.append({
                "date": parsed_date,
                "time": game_time,
                "opponent": opponent,
                "ticket_url": ticket_link,
                "is_home": is_home,
            })
            logger.debug(f"Found game: {opponent} on {parsed_date}")

        except Exception as e:
            logger.warning(f"Error parsing schedule item: {e}")
            continue

    return games


def build_consumer_title(sport_name: str, opponent: str, is_home: bool) -> str:
    """Emit consumer-facing matchup titles that can hand off weaker sources."""
    label_pair = SPORT_TITLE_FORMATS.get(sport_name)
    if label_pair:
        team_label, opponent_suffix = label_pair
        separator = "vs." if is_home else "at"
        return f"{team_label} {separator} {opponent} {opponent_suffix}"

    sport_display = sport_name.replace("-", " ").title()
    separator = "vs." if is_home else "at"
    return f"Georgia Tech Yellow Jackets {sport_display} {separator} {opponent}"


def build_matchup_participants(
    sport_name: str, opponent: str, is_home: bool
) -> list[dict]:
    label_pair = SPORT_TITLE_FORMATS.get(sport_name)
    if label_pair:
        team_label, opponent_suffix = label_pair
        opponent_label = f"{opponent} {opponent_suffix}".strip()
    else:
        sport_display = sport_name.replace("-", " ").title()
        team_label = f"Georgia Tech Yellow Jackets {sport_display}"
        opponent_label = opponent

    participants = [
        {"name": team_label, "role": "team", "billing_order": 1},
        {"name": opponent_label, "role": "team", "billing_order": 2},
    ]
    if not is_home:
        # Keep Georgia Tech first for stable participant matching across home/away rows.
        return participants
    return participants


def maybe_adopt_existing_public_title(
    source_id: int,
    venue_id: int | None,
    start_date: str,
    generated_title: str,
) -> str:
    """Borrow the fuller public title when one same-slot external row already exists."""
    if not venue_id or not start_date:
        return generated_title

    title_lower = generated_title.lower()
    if "yellow jackets baseball" not in title_lower and "yellow jackets softball" not in title_lower:
        return generated_title

    client = get_client()
    result = (
        client.table("events")
        .select("title,source_id")
        .eq("venue_id", venue_id)
        .eq("start_date", start_date)
        .eq("is_active", True)
        .neq("source_id", source_id)
        .execute()
    )
    candidates = result.data or []
    candidates = [
        row for row in candidates
        if isinstance(row.get("title"), str)
        and row["title"].startswith("Georgia Tech Yellow Jackets ")
    ]
    if len(candidates) == 1:
        return candidates[0]["title"]
    return generated_title


def _score_same_slot_variant(row: dict) -> tuple[int, int]:
    title = str(row.get("title") or "").strip()
    title_lower = title.lower()
    score = 0
    if title_lower.startswith("georgia tech yellow jackets"):
        score += 20
    if " vs. " in title_lower:
        score += 10
    if " baseball" in title_lower or " softball" in title_lower:
        score += 5
    if "gt softball:" in title_lower or "gt baseball:" in title_lower:
        score -= 5
    return score, len(title)


def select_preferred_same_slot_variant(rows: list[dict]) -> dict | None:
    if not rows:
        return None
    return max(rows, key=_score_same_slot_variant)


def reconcile_same_slot_variants(
    source_id: int,
    venue_id: int | None,
    start_date: str,
    keep_event_id: int,
) -> int:
    """Deactivate stale same-slot Georgia Tech title variants after canonical update."""
    if not venue_id or not start_date:
        return 0

    client = get_client()
    result = (
        client.table("events")
        .select("id,title,is_active")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("start_date", start_date)
        .eq("is_active", True)
        .execute()
    )
    rows = result.data or []
    duplicate_ids = [row["id"] for row in rows if row.get("id") != keep_event_id]
    if not duplicate_ids:
        return 0

    if not writes_enabled():
        logger.info(
            "[DRY RUN] Would deactivate %s Georgia Tech same-slot variants for %s",
            len(duplicate_ids),
            start_date,
        )
        return len(duplicate_ids)

    (
        client.table("events")
        .update({"is_active": False})
        .in_("id", duplicate_ids)
        .execute()
    )
    logger.info(
        "Deactivated %s stale Georgia Tech same-slot variants for venue %s on %s",
        len(duplicate_ids),
        venue_id,
        start_date,
    )
    return len(duplicate_ids)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Tech Athletics schedule."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    for sport_name, schedule_path, sport_code in SPORTS:
        try:
            url = f"{BASE_URL}{schedule_path}"
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Get venue for this sport
            place_data = VENUES.get(sport_name, VENUES["default"])
            venue_id = get_or_create_place(place_data)

            # Parse games from the page
            games = parse_schedule_page(soup, sport_name)

            for game in games:
                events_found += 1

                opponent = game["opponent"]
                start_date = game["date"]
                start_time = game["time"]
                ticket_url = game.get("ticket_url")
                is_home = game["is_home"]

                sport_display = sport_name.replace("-", " ").title()
                title = build_consumer_title(sport_name, opponent, is_home)
                title = maybe_adopt_existing_public_title(
                    source_id,
                    venue_id if is_home else None,
                    start_date,
                    title,
                )

                # Generate hash
                content_hash = generate_content_hash(
                    title, place_data["name"], start_date
                )


                # Build description with TBA note if no time
                description = f"Georgia Tech Yellow Jackets {sport_display} {'home game' if is_home else 'away game'} vs {opponent}"
                if start_time is None:
                    description += "\n\nGame time TBA — typically announced 1-2 weeks before the game."

                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id if is_home else None,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "sports",
                    "subcategory": sport_name.replace("-", "_"),
                    "tags": ["sports", "college", "georgia-tech", "yellow-jackets", sport_name],
                    "price_min": None,
                    "price_max": None,
                    "price_note": "Check ramblinwreck.com for tickets",
                    "is_free": False,
                    "source_url": url,
                    "ticket_url": ticket_url,
                    "image_url": extract_image_url(soup) if soup else None,
                    "raw_text": None,
                    "extraction_confidence": 0.80,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                    "_parsed_artists": build_matchup_participants(
                        sport_name, opponent, is_home
                    ),
                }

                existing = find_existing_event_for_insert(event_record)
                if sport_name in {"baseball", "softball"} and venue_id:
                    same_slot_rows = (
                        get_client()
                        .table("events")
                        .select("id,title,is_active")
                        .eq("source_id", source_id)
                        .eq("venue_id", venue_id)
                        .eq("start_date", start_date)
                        .eq("is_active", True)
                        .execute()
                        .data
                        or []
                    )
                    preferred = select_preferred_same_slot_variant(same_slot_rows)
                    if preferred:
                        existing = preferred

                if existing:
                    smart_update_existing_event(existing, event_record)
                    if sport_name in {"baseball", "softball"}:
                        reconcile_same_slot_variants(
                            source_id,
                            venue_id,
                            start_date,
                            existing["id"],
                        )
                    events_updated += 1
                    continue

                try:
                    event_id = insert_event(event_record)
                    if sport_name in {"baseball", "softball"}:
                        reconcile_same_slot_variants(
                            source_id,
                            venue_id,
                            start_date,
                            event_id,
                        )
                    events_new += 1
                    logger.debug(f"Added: {title} on {start_date}")
                except Exception as e:
                    logger.error(f"Failed to insert {title}: {e}")

            logger.info(f"GT {sport_name}: Found {len(games)} games")

        except requests.RequestException as e:
            logger.warning(f"Failed to fetch GT {sport_name} schedule: {e}")
            continue

    logger.info(f"Georgia Tech Athletics: Found {events_found} events, {events_new} new, {events_updated} existing")
    return events_found, events_new, events_updated
