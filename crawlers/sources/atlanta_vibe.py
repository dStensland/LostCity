"""
Crawler for Atlanta Vibe home matches.

Uses the official Gas South District team page for Atlanta Vibe upcoming home
matches hosted at Gas South Arena.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    remove_stale_source_events,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

TEAM_URL = "https://www.gassouthdistrict.com/teams/detail/atlanta-vibe"
TICKETS_URL = "https://www.gassouthdistrict.com/teams/detail/atlanta-vibe"
BASE_URL = "https://www.gassouthdistrict.com"
SCHEDULE_ARTICLE_URL = "https://provolleyball.com/news/2025/10/atlanta-vibe-unveils-2026-season-schedule"

GAS_SOUTH_VENUE_DATA = {
    "name": "Gas South Arena",
    "slug": "gas-south-arena",
    "address": "6400 Sugarloaf Pkwy",
    "neighborhood": "Duluth",
    "city": "Duluth",
    "state": "GA",
    "zip": "30097",
    "lat": 33.9618,
    "lng": -84.0965,
    "place_type": "arena",
    "spot_type": "stadium",
    "active": True,
    "website": "https://www.gassouthdistrict.com/arena",
}

GSU_CONVOCATION_VENUE_DATA = {
    "name": "GSU Convocation Center",
    "slug": "gsu-convocation-center",
    "address": "100 Piedmont Avenue SE",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "place_type": "arena",
    "spot_type": "arena",
    "active": True,
    "website": "https://convocationcenter.gsu.edu/",
}

SUPPLEMENTAL_HOME_MATCHES = [
    {
        "title": "Atlanta Vibe vs. Omaha Supernovas",
        "opponent": "Omaha Supernovas",
        "start_date": "2026-04-02",
        "start_time": "19:00",
        "source_url": SCHEDULE_ARTICLE_URL,
        "ticket_url": "https://www.ticketmaster.com/atlanta-vibe-vs-omaha-supernovas-atlanta-georgia-04-02-2026/event/0E0063710344B648",
        "image_url": None,
        "raw_text": "Official 2026 Atlanta Vibe schedule article lists Omaha at GSU Convocation Center on Thursday, April 2, 2026.",
    },
    {
        "title": "Atlanta Vibe vs. Orlando Valkyries",
        "opponent": "Orlando Valkyries",
        "start_date": "2026-04-04",
        "start_time": "18:00",
        "source_url": SCHEDULE_ARTICLE_URL,
        "ticket_url": "https://www.ticketmaster.com/atlanta-vibe-vs-orlando-valkyries-atlanta-georgia-04-04-2026/event/0E006371065BB823",
        "image_url": None,
        "raw_text": "Official 2026 Atlanta Vibe schedule article lists Orlando at GSU Convocation Center on Saturday, April 4, 2026.",
    },
]


def build_matchup_participants(opponent: str) -> list[dict]:
    """Return structured home/opponent participants for Vibe matches."""
    return [
        {"name": "Atlanta Vibe", "role": "team", "billing_order": 1},
        {"name": opponent, "role": "team", "billing_order": 2},
    ]


def parse_game_date(value: str) -> Optional[str]:
    cleaned = (value or "").strip().replace(",", "")
    if not cleaned:
        return None
    for fmt in ("%B %d %Y", "%b %d %Y"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_game_time(value: str) -> Optional[str]:
    cleaned = " ".join((value or "").strip().split()).upper()
    if not cleaned:
        return None
    for fmt in ("%I:%M%p", "%I:%M %p"):
        try:
            return datetime.strptime(cleaned, fmt).strftime("%H:%M")
        except ValueError:
            continue
    return None


def _absolute_url(value: str | None) -> str | None:
    if not value:
        return None
    return urljoin(BASE_URL, value.strip())


def parse_schedule_html(html: str, *, today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now().date()
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select(".event_list .eventItem")

    matches: list[dict] = []
    for card in cards:
        if not isinstance(card, Tag):
            continue

        location = card.select_one(".meta .location")
        if not location or "gas south arena" not in location.get_text(" ", strip=True).lower():
            continue

        title = card.select_one(".info h3.title")
        tagline = card.select_one(".info h4.tagline")
        date_node = card.select_one(".info .date[aria-label]")
        ticket_link = card.select_one('.buttons a.tickets[href]')
        detail_link = card.select_one('.thumb a[href*="/events/detail/"], .info h3.title a[href*="/events/detail/"]')
        image = card.select_one(".thumb img")
        time_node = card.select_one(".meta .time .start")

        title_text = title.get_text(" ", strip=True) if title else ""
        tagline_text = tagline.get_text(" ", strip=True) if tagline else ""
        date_text = date_node.get("aria-label", "").strip() if date_node else ""

        if not title_text or not tagline_text or not date_text:
            continue

        start_date = parse_game_date(date_text)
        if not start_date:
            continue

        if datetime.strptime(start_date, "%Y-%m-%d").date() < ref_today:
            continue

        matches.append(
            {
                "title": f"{title_text} {tagline_text}".strip(),
                "opponent": tagline_text.removeprefix("vs.").strip(),
                "start_date": start_date,
                "start_time": parse_game_time(time_node.get_text(" ", strip=True) if time_node else ""),
                "source_url": _absolute_url(detail_link.get("href")) if detail_link else TEAM_URL,
                "ticket_url": _absolute_url(ticket_link.get("href")) if ticket_link else TICKETS_URL,
                "image_url": _absolute_url(image.get("src")) if image else None,
                "raw_text": card.get_text(" | ", strip=True)[:1000],
            }
        )

    return matches


def upcoming_supplemental_matches(today: date | None = None) -> list[dict]:
    ref_today = today or datetime.now().date()
    return [
        match
        for match in SUPPLEMENTAL_HOME_MATCHES
        if datetime.strptime(match["start_date"], "%Y-%m-%d").date() >= ref_today
    ]


def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    current_hashes: set[str] = set()

    response = requests.get(
        TEAM_URL,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
        timeout=30,
    )
    response.raise_for_status()

    gas_south_venue_id = get_or_create_place(GAS_SOUTH_VENUE_DATA)
    gsu_venue_id = get_or_create_place(GSU_CONVOCATION_VENUE_DATA)

    venue_matches = [
        (gas_south_venue_id, GAS_SOUTH_VENUE_DATA, parse_schedule_html(response.text)),
        (gsu_venue_id, GSU_CONVOCATION_VENUE_DATA, upcoming_supplemental_matches()),
    ]

    for venue_id, place_data, matches in venue_matches:
        for match in matches:
            events_found += 1
            content_hash = generate_content_hash(match["title"], place_data["name"], match["start_date"])
            current_hashes.add(content_hash)

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": match["title"],
                "description": (
                    f"{match['title']} at {place_data['name']}. "
                    "Official Atlanta Vibe Major League Volleyball home match."
                ),
                "start_date": match["start_date"],
                "start_time": match["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "volleyball",
                "tags": ["sports", "volleyball", "mlv", "atlanta-vibe", place_data["slug"], "home-game"],
                "price_min": None,
                "price_max": None,
                "price_note": "See Atlanta Vibe or Ticketmaster for current pricing",
                "is_free": False,
                "source_url": match["source_url"],
                "ticket_url": match["ticket_url"],
                "image_url": match["image_url"],
                "raw_text": match["raw_text"],
                "extraction_confidence": 0.95,
                "content_hash": content_hash,
                "_parsed_artists": build_matchup_participants(match["opponent"]),
            }

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1

    remove_stale_source_events(source_id, current_hashes)
    logger.info(
        "Atlanta Vibe: Found %s events, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
