#!/usr/bin/env python3
"""
Backfill short descriptions for non-Eventbrite sources with richer factual detail.

Targets by default:
- ticketmaster (Atlanta)
- ticketmaster-nashville (detail page extraction)
- gsu-athletics (structured sports matchup context)
- emory-healthcare-community (structured logistics/context)
- atlanta-recurring-social (recurring schedule context)
- team-trivia (OutSpoken recurring trivia context)
- meetup (schedule/location/topic context)
- amc-atlanta (cinema showtime logistics context)
- fulton-library (library program logistics/registration context)
- truist-park (stadium event logistics context)
- laughing-skull (comedy lineup logistics context)
- lore-atlanta (LGBTQ+ nightlife recurring context)
- cooks-warehouse (cooking class logistics context)
- big-peach-running (group run/ride logistics context)
- terminal-west (concert logistics context)
- aisle5 (concert logistics context)
- ksu-athletics (sports matchup logistics context)
- painting-with-a-twist (paint-and-sip logistics context)

Default mode is dry-run.
"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
import sys
import time
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields

DEFAULT_SOURCE_SLUGS = [
    "ticketmaster",
    "ticketmaster-nashville",
    "gsu-athletics",
    "emory-healthcare-community",
    "atlanta-recurring-social",
    "team-trivia",
    "meetup",
    "amc-atlanta",
    "fulton-library",
    "truist-park",
    "laughing-skull",
    "lore-atlanta",
    "cooks-warehouse",
    "big-peach-running",
    "terminal-west",
    "aisle5",
    "ksu-athletics",
    "painting-with-a-twist",
]

DETAIL_TIMEOUT = 15
DETAIL_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich short non-Eventbrite event descriptions."
    )
    parser.add_argument(
        "--start-date",
        default=date.today().isoformat(),
        help="Lower bound start_date (YYYY-MM-DD). Default: today.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=600,
        help="Maximum candidate events to process. Default: 600.",
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=220,
        help="Only process descriptions shorter than this length. Default: 220.",
    )
    parser.add_argument(
        "--min-delta",
        type=int,
        default=30,
        help="Minimum character increase required before updating. Default: 30.",
    )
    parser.add_argument(
        "--source-slugs",
        default=",".join(DEFAULT_SOURCE_SLUGS),
        help=(
            "Comma-separated source slugs. Default: "
            "ticketmaster,ticketmaster-nashville,gsu-athletics,emory-healthcare-community,"
            "atlanta-recurring-social,team-trivia,meetup,amc-atlanta,fulton-library,"
            "truist-park,laughing-skull,lore-atlanta,cooks-warehouse,big-peach-running,"
            "terminal-west,aisle5,ksu-athletics,painting-with-a-twist."
        ),
    )
    parser.add_argument(
        "--all-sources",
        action="store_true",
        help="Ignore --source-slugs and process all sources in scope.",
    )
    parser.add_argument(
        "--exclude-source-slugs",
        default="eventbrite",
        help=(
            "Comma-separated source slugs to skip. Default: eventbrite "
            "(handled by dedicated Eventbrite enrichment script)."
        ),
    )
    parser.add_argument(
        "--festival-only",
        action="store_true",
        help="Only process events linked to a festival (festival_id is not null).",
    )
    parser.add_argument(
        "--portal",
        help=(
            "Optional portal slug scope. When set, process events where portal_id is NULL "
            "or matches the resolved portal UUID."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write updates to DB (default is dry-run).",
    )
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Page size for candidate fetch pagination. Default: 1000.",
    )
    parser.add_argument(
        "--update-retries",
        type=int,
        default=3,
        help="Retry attempts for DB updates when --apply is set. Default: 3.",
    )
    parser.add_argument(
        "--update-retry-delay",
        type=float,
        default=1.5,
        help="Base retry delay in seconds for DB updates. Default: 1.5.",
    )
    return parser.parse_args()


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).split()).strip()


def parse_json(raw_text: Optional[str]) -> dict:
    if not raw_text:
        return {}
    try:
        parsed = json.loads(raw_text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def format_time_label(time_24: Optional[str]) -> Optional[str]:
    if not time_24:
        return None
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(time_24, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return time_24


def format_price_note(price_min: Optional[float], price_max: Optional[float]) -> Optional[str]:
    if price_min is None and price_max is None:
        return None
    if price_min is not None and price_max is not None:
        if float(price_min) == float(price_max):
            return f"Ticket price: ${float(price_min):.0f}."
        return f"Ticket range: ${float(price_min):.0f}-${float(price_max):.0f}."
    if price_min is not None:
        return f"Tickets from ${float(price_min):.0f}."
    return f"Tickets up to ${float(price_max):.0f}."


def day_name_for_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%A")
    except ValueError:
        return None


def is_low_quality_description(description: Optional[str]) -> bool:
    current = clean_text(description)
    if not current:
        return True
    if len(current) < 120:
        return True
    lowered = current.lower()
    return lowered.startswith(
        (
            "event at ",
            "music event at ",
            "sports event at ",
            "theatre event at ",
            "dance event at ",
            "other event at ",
        )
    )


def fetch_detail_description(url: str) -> Optional[str]:
    if not url:
        return None
    try:
        resp = requests.get(url, headers={"User-Agent": DETAIL_UA}, timeout=DETAIL_TIMEOUT)
        if not resp.ok:
            return None
        html = resp.text
        jsonld = extract_jsonld_event_fields(html)
        description = clean_text(jsonld.get("description"))
        if description:
            return description
        og = extract_open_graph_fields(html)
        return clean_text(og.get("description")) or None
    except Exception:
        return None


def merge_descriptions(current: str, incoming: str, max_len: int = 1400) -> str:
    current = clean_text(current)
    incoming = clean_text(incoming)
    if not incoming:
        return current
    if not current:
        return incoming[:max_len]

    current_lower = current.lower()
    incoming_lower = incoming.lower()
    if incoming_lower in current_lower:
        return current[:max_len]
    if current_lower in incoming_lower:
        return incoming[:max_len]
    return f"{current}\n\n{incoming}"[:max_len]


def enrich_gsu(event: dict) -> Optional[str]:
    raw = parse_json(event.get("raw_text"))
    title = clean_text(event.get("title"))
    if not title:
        return None

    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    base = clean_text(event.get("description"))
    source_url = clean_text(event.get("source_url"))

    if not raw:
        parts: list[str] = [f"Georgia State Panthers matchup: {title}."]
        if start_date and start_time:
            parts.append(f"Scheduled on {start_date} at {start_time}.")
        elif start_date:
            parts.append(f"Scheduled on {start_date}.")
        if base and base.lower() not in " ".join(parts).lower():
            parts.append(base if base.endswith(".") else f"{base}.")
        if source_url:
            parts.append(
                f"Confirm final game details and ticket links from the official opponent or host listing ({source_url})."
            )
        else:
            parts.append("Confirm final game details and ticket links from official athletics listings.")
        return " ".join(parts)[:1200]

    sport_label = "Sports"
    if ":" in title:
        prefix = title.split(":", 1)[0]
        prefix = prefix.replace("GSU Panthers", "").strip()
        if prefix:
            sport_label = prefix
    location = ""
    loc = raw.get("location")
    if isinstance(loc, dict):
        location = clean_text(loc.get("name"))

    away_team = ""
    home_team = ""
    away_obj = raw.get("awayTeam")
    home_obj = raw.get("homeTeam")
    if isinstance(away_obj, dict):
        away_team = clean_text(away_obj.get("name"))
    if isinstance(home_obj, dict):
        home_team = clean_text(home_obj.get("name"))

    is_home = ": Vs " in title or title.endswith(" Vs")

    parts: list[str] = []
    if away_team and home_team:
        parts.append(f"Georgia State Panthers {sport_label} matchup: {home_team} vs {away_team}.")
    elif away_team:
        parts.append(f"Georgia State Panthers {sport_label} game against {away_team}.")
    else:
        parts.append(f"Georgia State Panthers {sport_label} game.")

    parts.append("Home game." if is_home else "Away or neutral-site game.")

    if location:
        parts.append(f"Location: {location}.")

    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if base and len(base) < 140 and base.lower() not in " ".join(parts).lower():
        parts.append(base if base.endswith(".") else f"{base}.")

    parts.append("Confirm final game time, broadcast, and ticket details on GeorgiaStateSports.com.")
    return " ".join(parts)[:1200]


def enrich_emory(event: dict) -> Optional[str]:
    raw = parse_json(event.get("raw_text"))
    if not raw:
        return None

    category_name = clean_text(raw.get("category")) or "community"
    venue_name = clean_text(raw.get("venueName"))
    base = clean_text(event.get("description"))
    is_recurring = bool(raw.get("recurringEventId"))
    is_free = bool(event.get("is_free"))

    parts: list[str] = []
    if base and len(base) >= 120:
        parts.append(base if base.endswith(".") else f"{base}.")
    else:
        parts.append(f"Emory Healthcare {category_name.lower()} program.")

    if venue_name:
        parts.append(f"Location: {venue_name}.")

    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    end_time = format_time_label(clean_text(event.get("end_time")) or None)
    if start_date and start_time and end_time:
        parts.append(f"Scheduled on {start_date} from {start_time} to {end_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    keywords = raw.get("keywords")
    if isinstance(keywords, list) and keywords:
        keyword_preview = [clean_text(v) for v in keywords if clean_text(v)]
        if keyword_preview:
            parts.append(f"Focus areas: {', '.join(keyword_preview[:4])}.")

    if is_recurring:
        parts.append("Part of an ongoing recurring Emory series.")
    parts.append("Free registration." if is_free else "Registration required.")

    if base and len(base) < 120 and base.lower() not in " ".join(parts).lower():
        parts.insert(1, base if base.endswith(".") else f"{base}.")

    parts.append("Check Emory Healthcare event details for latest class requirements.")
    return " ".join(parts)[:1200]


def enrich_recurring_event(event: dict, venue: Optional[dict], host_label: Optional[str] = None) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    base = clean_text(event.get("description"))
    venue_name = clean_text((venue or {}).get("name")) or "the listed venue"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"
    start_date = clean_text(event.get("start_date"))
    day_name = day_name_for_date(start_date)
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))

    location = venue_name
    if neighborhood:
        location = f"{location} in {neighborhood}"
    location = f"{location}, {city}, {state}"

    parts: list[str] = []
    if base:
        parts.append(base if base.endswith(".") else f"{base}.")
    else:
        parts.append(f"Recurring event: {title}.")

    schedule_parts: list[str] = []
    if day_name:
        schedule_parts.append(f"every {day_name}")
    if start_time:
        schedule_parts.append(f"at {start_time}")
    if schedule_parts:
        parts.append(f"Recurring weekly {' '.join(schedule_parts)}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    parts.append(f"Location: {location}.")
    if host_label:
        parts.append(host_label)

    is_free = bool(event.get("is_free"))
    price_min = event.get("price_min")
    price_max = event.get("price_max")
    if is_free:
        parts.append("Typically free to attend.")
    elif price_min is not None and price_max is not None and price_min == price_max:
        parts.append(f"Typical cost: ${price_min}.")
    elif price_min is not None or price_max is not None:
        low = "?" if price_min is None else str(price_min)
        high = "?" if price_max is None else str(price_max)
        parts.append(f"Typical cost range: ${low}-${high}.")
    else:
        parts.append("Cover charge and specials may vary by week.")

    if source_url:
        parts.append(f"Check the source listing for weekly lineup updates ({source_url}).")
    else:
        parts.append("Check venue listings for weekly lineup updates.")

    return " ".join(parts)[:1400]


def enrich_meetup_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    base = clean_text(event.get("description"))
    title = clean_text(event.get("title"))
    if not title:
        return None

    tags_raw = event.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [clean_text(t) for t in tags_raw if clean_text(t)]

    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)

    venue_name = clean_text((venue or {}).get("name"))
    is_online = "virtual" in venue_name.lower() or "online" in venue_name.lower()
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city"))

    parts: list[str] = []
    if base:
        parts.append(base if base.endswith(".") else f"{base}.")
    else:
        parts.append(f"Meetup community event: {title}.")

    if is_online:
        parts.append("Format: Online meetup.")
    elif venue_name:
        location = venue_name
        if neighborhood:
            location = f"{location} in {neighborhood}"
        if city:
            location = f"{location}, {city}"
        parts.append(f"Location: {location}.")
    else:
        parts.append("Location details are listed on Meetup.")

    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if tags:
        parts.append(f"Topics: {', '.join(tags[:5])}.")

    parts.append("Check Meetup for RSVP limits, attendance requirements, and updates.")
    return " ".join(parts)[:1600]


def enrich_ticketmaster_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None

    current = clean_text(event.get("description"))
    source_url = clean_text(event.get("source_url"))
    merged = current
    if source_url and is_low_quality_description(current):
        detail = fetch_detail_description(source_url)
        if detail:
            merged = merge_descriptions(current, detail, max_len=1600)

    if merged and not is_low_quality_description(merged) and len(merged) >= 220:
        if merged != current:
            return merged
        return None

    venue_name = clean_text((venue or {}).get("name"))
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    parts: list[str] = []
    if merged and not is_low_quality_description(merged):
        parts.append(merged if merged.endswith(".") else f"{merged}.")
    else:
        parts.append(f"{title} is a live Ticketmaster event.")

    if venue_name:
        location = venue_name
        if neighborhood:
            location = f"{location} in {neighborhood}"
        parts.append(f"Location: {location}, {city}, {state}.")
    elif city:
        parts.append(f"Location: {city}, {state}.")

    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if price_note:
        parts.append(price_note)

    if source_url:
        parts.append(f"Check Ticketmaster for latest lineup updates and ticket availability ({source_url}).")
    else:
        parts.append("Check Ticketmaster for latest lineup updates and ticket availability.")

    enriched = " ".join(parts)[:1600]
    if enriched == current:
        return None
    return enriched


def enrich_support_group_event(event: dict, venue: Optional[dict], *, program_label: str) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None

    base = clean_text(event.get("description"))
    source_url = clean_text(event.get("source_url"))
    start_date = clean_text(event.get("start_date"))
    day_name = day_name_for_date(start_date)
    start_time = format_time_label(clean_text(event.get("start_time")) or None)

    venue_name = clean_text((venue or {}).get("name"))
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"
    is_virtual = "virtual" in venue_name.lower() or "online" in venue_name.lower()

    tags_raw = event.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [clean_text(t).lower() for t in tags_raw if clean_text(t)]

    format_tags: list[str] = []
    for candidate in ("lgbtq", "spanish", "women", "men", "beginners", "young-people"):
        if candidate in tags:
            format_tags.append(candidate.replace("-", " ").title())

    parts: list[str] = []
    if base and len(base) >= 120:
        parts.append(base if base.endswith(".") else f"{base}.")
    else:
        parts.append(f"{program_label} peer-support meeting: {title}.")

    if is_virtual:
        parts.append("Format: Online meeting.")
    elif venue_name:
        location = venue_name
        if neighborhood:
            location = f"{location} in {neighborhood}"
        parts.append(f"Location: {location}, {city}, {state}.")
    else:
        parts.append(f"Location details are listed by {program_label}.")

    if day_name and start_time:
        parts.append(f"Scheduled on {day_name}, {start_date} at {start_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if format_tags:
        parts.append(f"Meeting focus: {', '.join(format_tags[:4])}.")

    if source_url:
        parts.append(f"Check the official listing for current format and access details ({source_url}).")
    else:
        parts.append("Check the official listing for current format and access details.")

    enriched = " ".join(parts)[:1600]
    if enriched == base:
        return None
    return enriched


def enrich_amc_showtime_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    venue_name = clean_text((venue or {}).get("name")) or "AMC theater"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        parts.append(f"Movie showtime for {title} at {venue_name}.")
    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if source_url:
        parts.append(f"Check AMC for runtime, format options, and seat availability ({source_url}).")
    else:
        parts.append("Check AMC for runtime, format options, and seat availability.")

    enriched = " ".join(parts)[:1200]
    if enriched == current:
        return None
    return enriched


def enrich_fulton_library_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    venue_name = clean_text((venue or {}).get("name")) or "Fulton County Library System"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    end_time = format_time_label(clean_text(event.get("end_time")) or None)
    category = clean_text(event.get("category")) or "community"
    source_url = clean_text(event.get("source_url"))
    ticket_url = clean_text(event.get("ticket_url"))

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append(f"Fulton County Library {category.replace('_', ' ')} program.")
    else:
        parts.append(f"Fulton County Library {category.replace('_', ' ')} program: {title}.")

    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")

    if start_date and start_time and end_time:
        parts.append(f"Scheduled on {start_date} from {start_time} to {end_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if ticket_url:
        parts.append("Registration may be required; verify capacity and attendance details before arriving.")
    else:
        parts.append("Open community program; check listing for updated attendance details.")

    if source_url:
        parts.append(f"Confirm the latest details on the official library listing ({source_url}).")
    else:
        parts.append("Confirm the latest details on the official library listing.")

    enriched = " ".join(parts)[:1600]
    if enriched == current:
        return None
    return enriched


def enrich_truist_park_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))

    venue_name = clean_text((venue or {}).get("name")) or "Truist Park"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "The Battery"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    lowered = title.lower()
    if any(k in lowered for k in ("braves", "baseball", "vs.", " vs ")):
        context = "Live baseball experience at the Atlanta Braves' home stadium."
    elif any(k in lowered for k in ("tour", "tours")):
        context = "Stadium tour experience with venue access details published by the organizer."
    else:
        context = "Live event hosted at Truist Park in The Battery district."

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        parts.append(f"{title} at {venue_name}.")
        parts.append(context)
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if source_url:
        parts.append(f"Check the official listing for latest entry rules, parking guidance, and ticket availability ({source_url}).")
    else:
        parts.append("Check the official listing for latest entry rules, parking guidance, and ticket availability.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_laughing_skull_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    venue_name = clean_text((venue or {}).get("name")) or "Laughing Skull Lounge"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "Midtown"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("Stand-up comedy event at Laughing Skull Lounge.")
    else:
        parts.append(f"{title} is a stand-up comedy event at Laughing Skull Lounge.")

    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if price_note:
        parts.append(price_note)
    if source_url:
        parts.append(f"Check the official listing for lineup updates, show policies, and current ticket availability ({source_url}).")
    else:
        parts.append("Check the official listing for lineup updates, show policies, and current ticket availability.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_lore_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    venue_name = clean_text((venue or {}).get("name")) or "Lore Atlanta"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "Edgewood"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("LGBTQ+ nightlife program at Lore Atlanta.")
    else:
        parts.append(f"{title} is an LGBTQ+ nightlife program at Lore Atlanta.")
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    parts.append("Venue programming includes drag, karaoke, trivia, and variety nightlife formats.")
    if source_url:
        parts.append(f"Check Lore's official listing for host lineup updates, cover details, and entry policy ({source_url}).")
    else:
        parts.append("Check Lore's official listing for host lineup updates, cover details, and entry policy.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_cooks_warehouse_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))
    venue_name = clean_text((venue or {}).get("name")) or "The Cook's Warehouse"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "Midtown"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    else:
        parts.append(f"{title} is a cooking class at The Cook's Warehouse.")
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if price_note:
        parts.append(price_note.replace("Ticket", "Class"))
    else:
        parts.append("Class pricing varies by menu and session format.")
    if source_url:
        parts.append(f"Check the official class listing for menu, skill level, and availability ({source_url}).")
    else:
        parts.append("Check the official class listing for menu, skill level, and availability.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_big_peach_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    venue_name = clean_text((venue or {}).get("name")) or "Big Peach Running Co"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("Community run/ride program hosted by Big Peach Running Co.")
    else:
        parts.append(f"{title} is a community run/ride program hosted by Big Peach Running Co.")

    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    parts.append("Open-to-community fitness programming; pace groups and routes vary by session.")
    if source_url:
        parts.append(f"Check the official listing for route details, pace expectations, and weather updates ({source_url}).")
    else:
        parts.append("Check the official listing for route details, pace expectations, and weather updates.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_terminal_west_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    venue_name = clean_text((venue or {}).get("name")) or "Terminal West"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "West Midtown"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("Live music performance at Terminal West.")
    else:
        parts.append(f"{title} is a live music performance at Terminal West.")
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if price_note:
        parts.append(price_note)
    if source_url:
        parts.append(f"Check the official listing for lineup updates, age policy, and ticket availability ({source_url}).")
    else:
        parts.append("Check the official listing for lineup updates, age policy, and ticket availability.")

    enriched = " ".join(parts)[:1500]
    if enriched == current:
        return None
    return enriched


def enrich_aisle5_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    venue_name = clean_text((venue or {}).get("name")) or "Aisle 5"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "Little Five Points"
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("Live music event at Aisle 5.")
    else:
        parts.append(f"{title} is a live music event at Aisle 5.")
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if price_note:
        parts.append(price_note)
    if source_url:
        parts.append(f"Check the official listing for lineup updates, age policy, and ticket availability ({source_url}).")
    else:
        parts.append("Check the official listing for lineup updates, age policy, and ticket availability.")

    enriched = " ".join(parts)[:1500]
    if enriched == current:
        return None
    return enriched


def enrich_ksu_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    venue_name = clean_text((venue or {}).get("name")) or "Kennesaw State Athletics venue"
    neighborhood = clean_text((venue or {}).get("neighborhood")) or "Kennesaw"
    city = clean_text((venue or {}).get("city")) or "Kennesaw"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append("Kennesaw State Owls college athletics matchup.")
    else:
        parts.append(f"{title} is a Kennesaw State Owls college athletics matchup.")
    parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if source_url:
        parts.append(f"Check KSU Athletics for final game time, broadcast, and ticket details ({source_url}).")
    else:
        parts.append("Check KSU Athletics for final game time, broadcast, and ticket details.")

    enriched = " ".join(parts)[:1400]
    if enriched == current:
        return None
    return enriched


def enrich_painting_with_a_twist_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    source_url = clean_text(event.get("source_url"))
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))

    venue_name = clean_text((venue or {}).get("name")) or "Painting With a Twist studio"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append(f"Paint-and-sip class at {venue_name}.")
    else:
        parts.append(f"{title} is a paint-and-sip class at {venue_name}.")
    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")
    if start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")
    if price_note:
        parts.append(price_note)
    parts.append("BYOB-friendly studio class with guided step-by-step painting instruction.")
    if source_url:
        parts.append(f"Check the official listing for painting theme, cancellation policy, and seat availability ({source_url}).")
    else:
        parts.append("Check the official listing for painting theme, cancellation policy, and seat availability.")

    enriched = " ".join(parts)[:1600]
    if enriched == current:
        return None
    return enriched


def enrich_city_meeting_event(event: dict, venue: Optional[dict]) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None

    current = clean_text(event.get("description"))
    source_url = clean_text(event.get("source_url"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    end_time = format_time_label(clean_text(event.get("end_time")) or None)

    venue_name = clean_text((venue or {}).get("name")) or "City Hall"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    meeting_kind = "public civic meeting"
    lowered = title.lower()
    if "committee" in lowered:
        meeting_kind = "city committee meeting"
    elif "council" in lowered:
        meeting_kind = "city council meeting"
    elif "board" in lowered:
        meeting_kind = "public board meeting"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append(f"{title} is a {meeting_kind}.")
    else:
        parts.append(f"{title} is a {meeting_kind}.")

    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")

    if start_date and start_time and end_time:
        parts.append(f"Scheduled on {start_date} from {start_time} to {end_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    parts.append(
        "Agenda packets, public comment instructions, and final time adjustments are managed by the city before meeting start."
    )
    if source_url:
        parts.append(f"Check the official posting for the latest agenda, livestream link, and attendance guidance ({source_url}).")
    else:
        parts.append("Check the official city posting for the latest agenda, livestream link, and attendance guidance.")

    enriched = " ".join(parts)[:1700]
    if enriched == current:
        return None
    return enriched


def generic_event_context_label(category_hint: str, title: str) -> str:
    category_lower = category_hint.lower()
    title_lower = title.lower()
    if any(token in category_lower for token in ("music", "concert")):
        return "live music event"
    if any(token in category_lower for token in ("comedy",)):
        return "comedy event"
    if any(token in category_lower for token in ("sports", "athletics")):
        return "sports event"
    if any(token in category_lower for token in ("festival",)):
        return "festival program"
    if any(token in category_lower for token in ("film", "movie", "cinema")):
        return "film screening"
    if any(token in category_lower for token in ("food", "drink", "culinary")):
        return "food and drink event"
    if any(token in category_lower for token in ("art", "gallery", "museum")):
        return "arts program"
    if any(token in category_lower for token in ("community", "education", "workshop", "class")):
        return "community program"

    if any(token in title_lower for token in ("vs", "match", "game")):
        return "sports event"
    if any(token in title_lower for token in ("festival", "fair")):
        return "festival program"
    if any(token in title_lower for token in ("comedy", "stand-up")):
        return "comedy event"
    if any(token in title_lower for token in ("dj", "live", "concert", "show")):
        return "live event"
    return "local event"


def enrich_generic_event(event: dict, venue: Optional[dict], source_slug: str) -> Optional[str]:
    title = clean_text(event.get("title"))
    if not title:
        return None
    current = clean_text(event.get("description"))
    start_date = clean_text(event.get("start_date"))
    start_time = format_time_label(clean_text(event.get("start_time")) or None)
    end_time = format_time_label(clean_text(event.get("end_time")) or None)
    tags_raw = event.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [clean_text(tag).lower() for tag in tags_raw if clean_text(tag)]
    raw_payload = parse_json(event.get("raw_text"))
    category_hint = " ".join(tags)
    if not category_hint and isinstance(raw_payload, dict):
        for key in ("category", "type", "eventType", "genre"):
            value = clean_text(raw_payload.get(key))
            if value:
                category_hint = value
                break

    context_label = generic_event_context_label(category_hint, title)
    price_note = format_price_note(event.get("price_min"), event.get("price_max"))
    is_free = bool(event.get("is_free"))

    venue_name = clean_text((venue or {}).get("name")) or "listed venue"
    neighborhood = clean_text((venue or {}).get("neighborhood"))
    city = clean_text((venue or {}).get("city")) or "Atlanta"
    state = clean_text((venue or {}).get("state")) or "GA"

    parts: list[str] = []
    if current and len(current) >= 140:
        parts.append(current if current.endswith(".") else f"{current}.")
    elif current:
        parts.append(current if current.endswith(".") else f"{current}.")
        parts.append(f"{title} is a {context_label}.")
    else:
        parts.append(f"{title} is a {context_label}.")

    if neighborhood:
        parts.append(f"Location: {venue_name} in {neighborhood}, {city}, {state}.")
    else:
        parts.append(f"Location: {venue_name}, {city}, {state}.")

    if start_date and start_time and end_time:
        parts.append(f"Scheduled on {start_date} from {start_time} to {end_time}.")
    elif start_date and start_time:
        parts.append(f"Scheduled on {start_date} at {start_time}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if is_free:
        parts.append("Admission: free.")
    elif price_note:
        parts.append(price_note)

    title_lower = title.lower()
    if "trivia" in title_lower:
        parts.append("Typical format is team-based trivia with house rules and prize structure set by the host venue.")
    elif "poker" in title_lower:
        parts.append("Typical format is free-to-play social poker with venue-managed seating and start-time cutoffs.")
    elif "farmers market" in title_lower or "market" in title_lower:
        parts.append("Vendor lineup and product availability rotate each week; arrive early for best produce selection.")
    elif "meeting" in title_lower or "work session" in title_lower:
        parts.append("Meeting agendas and attendance details can change near session time, so confirm before arriving.")

    enriched = " ".join(parts)[:1600]
    if enriched == current:
        return None
    return enriched


# Sources that have dedicated crawlers fetching real descriptions — the generic
# enricher must never overwrite what those crawlers produce.
_NEVER_OVERWRITE_SOURCES: frozenset[str] = frozenset(
    {
        "eddies-attic",
        "terminal-west",
        "aisle5",
        "blind-willies",
        "the-earl",
        "punchline",
        "laughing-skull",
        "city-winery",
        "the-masquerade",
        "state-farm-arena",
        "truist-park",
        "star-community-bar",
        "ameris-bank-amphitheatre",
        "tabernacle",
        "chastain-park-amphitheatre",
        "fox-theatre",
        "variety-playhouse",
        "center-stage",
        "coca-cola-roxy",
        "uptown-comedy",
        "dads-garage",
        "whole-world-improv",
        "smiths-olde-bar",
        "lore-atlanta",
    }
)


def enrich_event(event: dict, source_slug: str, venue: Optional[dict]) -> Optional[str]:
    if source_slug in _NEVER_OVERWRITE_SOURCES:
        return None

    current = clean_text(event.get("description"))
    if source_slug in {"ticketmaster", "ticketmaster-nashville"}:
        enriched = enrich_ticketmaster_event(event, venue)
        if not enriched:
            return None
        if len(enriched) < len(current) + 30 and len(current) >= 150:
            return None
        return enriched

    if source_slug == "gsu-athletics":
        enriched = enrich_gsu(event)
        if not enriched:
            return None
        if enriched == current:
            return None
        if len(enriched) < len(current) + 30 and len(current) >= 150:
            return None
        return enriched

    if source_slug == "emory-healthcare-community":
        enriched = enrich_emory(event)
        if not enriched:
            return None
        if enriched == current:
            return None
        if len(enriched) < len(current) + 30 and len(current) >= 150:
            return None
        return enriched

    if source_slug == "atlanta-recurring-social":
        enriched = enrich_recurring_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "team-trivia":
        enriched = enrich_recurring_event(
            event,
            venue,
            host_label="Hosted by OutSpoken Entertainment. Free to play with team-based scoring and venue prizes.",
        )
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "meetup":
        enriched = enrich_meetup_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "aa-atlanta":
        enriched = enrich_support_group_event(event, venue, program_label="Alcoholics Anonymous")
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "na-georgia":
        enriched = enrich_support_group_event(event, venue, program_label="Narcotics Anonymous")
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "amc-atlanta":
        enriched = enrich_amc_showtime_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "fulton-library":
        enriched = enrich_fulton_library_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "truist-park":
        enriched = enrich_truist_park_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "laughing-skull":
        enriched = enrich_laughing_skull_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "lore-atlanta":
        enriched = enrich_lore_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "cooks-warehouse":
        enriched = enrich_cooks_warehouse_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "big-peach-running":
        enriched = enrich_big_peach_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "terminal-west":
        enriched = enrich_terminal_west_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "aisle5":
        enriched = enrich_aisle5_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "ksu-athletics":
        enriched = enrich_ksu_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "painting-with-a-twist":
        enriched = enrich_painting_with_a_twist_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    if source_slug == "atlanta-city-meetings":
        enriched = enrich_city_meeting_event(event, venue)
        if not enriched or enriched == current:
            return None
        return enriched

    enriched = enrich_generic_event(event, venue, source_slug)
    if not enriched or enriched == current:
        return None
    return enriched


def fetch_source_rows(client, slugs: list[str]) -> list[dict]:
    source_rows = (
        client.table("sources")
        .select("id,slug")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    return [row for row in source_rows if row.get("id") and row.get("slug")]


def fetch_all_source_rows(client) -> list[dict]:
    source_rows = (
        client.table("sources")
        .select("id,slug")
        .execute()
        .data
        or []
    )
    return [row for row in source_rows if row.get("id") and row.get("slug")]


def resolve_portal_id(client, portal_slug: Optional[str]) -> Optional[str]:
    slug = clean_text(portal_slug)
    if not slug:
        return None
    rows = (
        client.table("portals")
        .select("id,slug")
        .eq("slug", slug)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise ValueError(f"Portal slug not found: {slug}")
    portal_id = clean_text(rows[0].get("id"))
    if not portal_id:
        raise ValueError(f"Portal slug resolved without id: {slug}")
    return portal_id


def fetch_venue_map(client, venue_ids: list[int]) -> dict[int, dict]:
    if not venue_ids:
        return {}
    rows = (
        client.table("places")
        .select("id,name,neighborhood,city,state")
        .in_("id", venue_ids)
        .execute()
        .data
        or []
    )
    result: dict[int, dict] = {}
    for row in rows:
        try:
            result[int(row["id"])] = row
        except Exception:
            continue
    return result


def fetch_candidate_events(
    client,
    *,
    source_ids: list[int],
    start_date: str,
    festival_only: bool,
    portal_id: Optional[str],
    limit: int,
    page_size: int,
) -> list[dict]:
    candidates: list[dict] = []
    offset = 0
    remaining = max(1, int(limit))
    chunk_size = max(1, int(page_size))

    while remaining > 0:
        batch_size = min(chunk_size, remaining)
        query = (
            client.table("events")
            .select(
                "id,title,description,source_url,start_date,start_time,end_time,"
                "raw_text,source_id,is_free,place_id,price_min,price_max,tags,ticket_url,"
                "festival_id"
            )
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
        )
        if source_ids:
            query = query.in_("source_id", source_ids)
        if festival_only:
            query = query.not_.is_("festival_id", "null")
        if portal_id:
            query = query.or_(f"portal_id.is.null,portal_id.eq.{portal_id}")

        batch = (
            query.order("start_date")
            .order("id")
            .range(offset, offset + batch_size - 1)
            .execute()
            .data
            or []
        )
        if not batch:
            break

        candidates.extend(batch)
        fetched = len(batch)
        remaining -= fetched
        if fetched < batch_size:
            break
        offset += fetched

    return candidates


def update_description_with_retry(
    client,
    event_id: int,
    description: str,
    *,
    retries: int,
    retry_delay: float,
) -> bool:
    attempts = max(1, int(retries))
    base_delay = max(0.0, float(retry_delay))

    for attempt in range(1, attempts + 1):
        try:
            client.table("events").update({"description": description}).eq("id", event_id).execute()
            return True
        except Exception as exc:
            if attempt >= attempts:
                print(f"[error] update failed id={event_id} attempts={attempts} err={exc}")
                return False
            delay = base_delay * (2 ** (attempt - 1))
            print(
                f"[warn] retrying update id={event_id} attempt={attempt}/{attempts} "
                f"delay={delay:.1f}s err={exc}"
            )
            if delay > 0:
                time.sleep(delay)
    return False


def main() -> int:
    args = parse_args()
    source_slugs = [s.strip() for s in args.source_slugs.split(",") if s.strip()]
    excluded_slugs = {
        s.strip().lower() for s in args.exclude_source_slugs.split(",") if s.strip()
    }
    client = get_client()
    try:
        portal_id = resolve_portal_id(client, args.portal)
    except ValueError as exc:
        print(str(exc))
        return 1

    if args.all_sources:
        source_rows = fetch_all_source_rows(client)
    else:
        source_rows = fetch_source_rows(client, source_slugs)
    if not source_rows:
        if args.all_sources:
            print("No sources found.")
        else:
            print(f"No sources found for slugs: {source_slugs}")
        return 1

    source_id_to_slug = {int(row["id"]): str(row["slug"]) for row in source_rows}
    source_ids = list(source_id_to_slug.keys())

    candidates = fetch_candidate_events(
        client,
        source_ids=source_ids,
        start_date=args.start_date,
        festival_only=bool(args.festival_only),
        portal_id=portal_id,
        limit=args.limit,
        page_size=args.page_size,
    )
    venue_ids = sorted(
        {
            int(row["place_id"])
            for row in candidates
            if row.get("place_id") is not None
        }
    )
    venue_map = fetch_venue_map(client, venue_ids)

    scanned = 0
    updated = 0
    improved = 0
    skipped = 0
    failed_updates = 0

    for event in candidates:
        scanned += 1
        event_id = int(event["id"])
        source_slug = source_id_to_slug.get(int(event["source_id"]), "unknown")
        if source_slug.lower() in excluded_slugs:
            skipped += 1
            continue
        current_desc = clean_text(event.get("description"))
        venue = venue_map.get(int(event["place_id"])) if event.get("place_id") is not None else None

        if len(current_desc) >= args.min_length:
            skipped += 1
            continue

        enriched_desc = enrich_event(event, source_slug, venue)
        if not enriched_desc:
            skipped += 1
            continue

        delta = len(enriched_desc) - len(current_desc)
        if delta < args.min_delta:
            skipped += 1
            continue

        improved += 1
        title = clean_text(event.get("title"))
        print(
            f"[improved] source={source_slug} id={event_id} "
            f"len {len(current_desc)} -> {len(enriched_desc)} title={title[:90]}"
        )

        if args.apply:
            ok = update_description_with_retry(
                client,
                event_id,
                enriched_desc,
                retries=args.update_retries,
                retry_delay=args.update_retry_delay,
            )
            if ok:
                updated += 1
            else:
                failed_updates += 1

    mode = "apply" if args.apply else "dry-run"
    print(
        f"\nDone ({mode}): scanned={scanned} improved={improved} updated={updated} "
        f"skipped={skipped} failed_updates={failed_updates}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
