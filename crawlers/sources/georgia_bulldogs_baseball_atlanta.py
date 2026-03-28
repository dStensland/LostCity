"""
Crawler for official Georgia Bulldogs baseball Atlanta-area games.

Uses the official georgiadogs.com baseball schedule page and only surfaces
Atlanta-market neutral-site inventory, so the Atlanta portal can prefer the
official school source over Ticketmaster when those games land in-market.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

import requests
from bs4 import BeautifulSoup

from db import (
    find_existing_event_for_insert,
    get_client,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://georgiadogs.com"
SCHEDULE_URL = f"{BASE_URL}/sports/baseball/schedule"

TRUIST_PARK = {
    "name": "Truist Park",
    "slug": "truist-park",
    "address": "755 Battery Ave SE",
    "neighborhood": "Cumberland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30339",
    "lat": 33.8908,
    "lng": -84.4677,
    "place_type": "stadium",
    "spot_type": "stadium",
    "website": "https://www.mlb.com/braves/ballpark",
}


def parse_time_label(time_text: str | None) -> str | None:
    if not time_text:
        return None
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_text, re.IGNORECASE)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or "0")
    period = match.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def parse_schedule_cards(soup: BeautifulSoup, *, today: date | None = None) -> list[dict]:
    today = today or date.today()
    cards = soup.select('[data-test-id="s-game-card-standard__root"]')
    games: list[dict] = []

    for card in cards:
        facility = (
            card.select_one('[data-test-id="s-game-card-facility-and-location__standard-facility-title"]')
            or card.select_one('[data-test-id="s-game-card-facility-and-location__details-standard"] span')
        )
        facility_name = facility.get_text(" ", strip=True) if facility else ""
        if facility_name != "Truist Park":
            continue

        opponent_link = card.select_one('[data-test-id="s-game-card-standard__header-team-opponent-link"]')
        opponent = opponent_link.get_text(" ", strip=True) if opponent_link else ""
        if not opponent:
            continue

        promo = card.select_one(".s-game-card__promotion-btn-text")
        promotion = promo.get_text(" ", strip=True) if promo else None

        date_label = card.select_one('[data-test-id="s-game-card-standard__header-game-date"]')
        if not date_label:
            continue
        date_text = date_label.get_text(" ", strip=True)
        date_match = re.search(r"([A-Z][a-z]{2})\s+(\d{1,2})", date_text)
        if not date_match:
            continue
        month_str, day_str = date_match.groups()
        parsed_date = datetime.strptime(f"{month_str} {day_str} {today.year}", "%b %d %Y").date()
        if parsed_date < today.replace(month=1, day=1) and parsed_date < today:
            parsed_date = parsed_date.replace(year=today.year + 1)

        time_label = card.select_one('[data-test-id="s-game-card-standard__header-game-time"]')
        start_time = parse_time_label(time_label.get_text(" ", strip=True) if time_label else None)

        links = [a.get("href", "").strip() for a in card.find_all("a", href=True)]
        listen_link = next((href for href in links if href.startswith("/showcase?")), None)

        games.append(
            {
                "date": parsed_date.isoformat(),
                "time": start_time,
                "opponent": opponent,
                "promotion": promotion,
                "source_url": f"{BASE_URL}{listen_link}" if listen_link else SCHEDULE_URL,
            }
        )

    return games


def build_consumer_title(opponent: str) -> str:
    return f"Georgia Bulldogs Baseball vs. {opponent} Baseball"


def maybe_adopt_existing_public_title(
    source_id: int,
    venue_id: int,
    start_date: str,
    start_time: str | None,
    generated_title: str,
) -> str:
    client = get_client()
    query = (
        client.table("events")
        .select("title,source_id")
        .eq("place_id", venue_id)
        .eq("start_date", start_date)
        .eq("is_active", True)
        .neq("source_id", source_id)
    )
    if start_time:
        query = query.eq("start_time", start_time)
    result = query.execute()
    candidates = result.data or []
    candidates = [
        row
        for row in candidates
        if isinstance(row.get("title"), str)
        and (
            row["title"].lower().startswith("spring classic:")
            or ("georgia" in row["title"].lower() and "georgia tech" in row["title"].lower())
        )
    ]
    if len(candidates) == 1:
        return candidates[0]["title"]
    return generated_title


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    response = requests.get(
        SCHEDULE_URL,
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=30,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    venue_id = get_or_create_place(TRUIST_PARK)

    for game in parse_schedule_cards(soup):
        events_found += 1

        title = build_consumer_title(game["opponent"])
        title = maybe_adopt_existing_public_title(
            source_id,
            venue_id,
            game["date"],
            game["time"],
            title,
        )
        promotion = game.get("promotion")
        description = (
            f"Official Georgia Bulldogs baseball schedule listing for {title} at Truist Park."
        )
        if promotion:
            description = f"{description} {promotion}."

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description,
            "start_date": game["date"],
            "start_time": game["time"],
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": "baseball",
            "tags": ["sports", "baseball", "college", "georgia", "bulldogs", "atlanta"],
            "price_min": None,
            "price_max": None,
            "price_note": "Check official Georgia Bulldogs and ticket links for availability",
            "is_free": False,
            "source_url": game["source_url"],
            "ticket_url": None,
            "image_url": None,
            "raw_text": None,
            "extraction_confidence": 0.9,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": generate_content_hash(title, TRUIST_PARK["name"], game["date"]),
        }

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            events_updated += 1
            continue

        insert_event(event_record)
        events_new += 1

    logger.info(
        "Georgia Bulldogs baseball Atlanta crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
