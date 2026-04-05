"""
Crawler for Shaky Knees Festival (shakykneesfestival.com).

The festival publishes its lineup as a poster image on the official lineup page.
We OCR the poster into day-level lineup events so the source produces real
festival program structure instead of a single annual parent event.
"""

from __future__ import annotations

import logging
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.shakykneesfestival.com"
LINEUP_URL = f"{BASE_URL}/lineup"

PLACE_DATA = {
    "name": "Piedmont Park",
    "slug": "piedmont-park",
    "address": "1320 Monroe Drive NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30306",
    "lat": 33.7879,
    "lng": -84.3732,
    "place_type": "park",
    "spot_type": "park",
    "website": "https://piedmontpark.org",
}

KNOWN_DATES = {
    2026: ("2026-09-18", "2026-09-20"),
}

DAY_OFFSETS = {
    "FRIDAY": 0,
    "SATURDAY": 1,
    "SUNDAY": 2,
}

DAY_ORDER = ("FRIDAY", "SATURDAY", "SUNDAY")

LINEUP_TOKEN_FIXES = {
    "THE STROKES": "The Strokes",
    "TURNSTILE": "Turnstile",
    "FONTAINES D.C.": "Fontaines D.C.",
    "GEESE": "Geese",
    "ALICE PHOEBE LOU": "Alice Phoebe Lou",
    "GOLDFORD": "GoldFord",
    "CARTEL": "Cartel",
    "TWENTY ONE PILOTS": "Twenty One Pilots",
    "ERCE T* VEIL": "Pierce The Veil",
    "PIERCE THE VEIL": "Pierce The Veil",
    "THE PRODIGY": "The Prodigy",
    "PAVEMENT": "Pavement",
    "MINUS THE BEAR": "Minus the Bear",
    "WOLF ALICE": "Wolf Alice",
    "THE RAPTURE": "The Rapture",
    "CONGRESS THE BAND": "Congress the Band",
    "PSYCHEDELIC PORN CRUMPETS": "Psychedelic Porn Crumpets",
    "GEORDIE GREEP": "Geordie Greep",
    "ELIO MEI": "Elio Mei",
    "VILLANELLE": "Villanelle",
    "CRUZ BECKHAM": "Cruz Beckham",
    "REHASH": "Rehash",
    "RUM JUNGLE": "Rum Jungle",
    "THE INSPECTOR CLUZO": "The Inspector Cluzo",
    "HOTEL FICTION": "Hotel Fiction",
    "SOPHIE'S BODY": "Sophie's Body",
    "SONGS FOR KIDS": "Songs for Kids",
    "GORILLAZ": "Gorillaz",
    "LCD SOUNDSYSTEM": "LCD Soundsystem",
    "WU-TANG CLAN": "Wu-Tang Clan",
    "WU-TANG GLAN": "Wu-Tang Clan",
    "COHEED AND CAMBRIA": "Coheed and Cambria",
    "JET": "Jet",
    "OK GO": "OK Go",
    "FCUKERS": "FCUKERS",
    "AMERICAN HI-FI": "American Hi-Fi",
    "THE TWO LIPS": "The Two Lips",
    "VIOLET GROHL": "Violet Grohl",
    "CARDINALS": "Cardinals",
    "BIG SPECIAL": "Big Special",
    "PORCH LIGHT": "Porch Light",
    "SHOWING TEETH": "Showing Teeth",
    "GARBAGEBARBIE": "Garbagebarbie",
}


def _resolve_target_dates(
    now: Optional[datetime] = None,
) -> tuple[int, datetime, datetime]:
    now = now or datetime.now()
    year = now.year

    if year in KNOWN_DATES:
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    elif year + 1 in KNOWN_DATES:
        year += 1
        start_str, end_str = KNOWN_DATES[year]
        start_date = datetime.strptime(start_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_str, "%Y-%m-%d")
    else:
        sept_1 = datetime(year, 9, 1)
        days_until_friday = (4 - sept_1.weekday()) % 7
        first_friday = sept_1.replace(day=1 + days_until_friday)
        third_friday = first_friday.replace(day=first_friday.day + 14)
        start_date = third_friday
        end_date = third_friday.replace(day=third_friday.day + 2)

    if end_date < now:
        return _resolve_target_dates(datetime(year + 1, 1, 1))

    return year, start_date, end_date


def _fetch_html(url: str) -> str:
    response = requests.get(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
            )
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.text


def _extract_lineup_image_url(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "lxml")
    candidates: list[tuple[int, str]] = []

    def score_url(url: str) -> int:
        normalized = url.lower()
        score = 0
        if "lineup" in normalized:
            score += 5
        if "admat" in normalized:
            score += 4
        if "sk26" in normalized or "sk25" in normalized:
            score += 3
        if normalized.endswith(".png"):
            score += 2
        return score

    for img in soup.find_all("img"):
        src = (img.get("src") or img.get("data-src") or "").strip()
        if not src:
            continue
        full_url = urljoin(LINEUP_URL, src)
        score = score_url(full_url)
        if score:
            candidates.append((score, full_url))

    for meta_name in ("og:image", "twitter:image"):
        meta = soup.find("meta", attrs={"property": meta_name}) or soup.find(
            "meta", attrs={"name": meta_name}
        )
        if not meta:
            continue
        content = (meta.get("content") or "").strip()
        if not content:
            continue
        full_url = urljoin(LINEUP_URL, content)
        score = score_url(full_url)
        if score:
            candidates.append((score, full_url))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def _download_lineup_image(image_url: str) -> str:
    suffix = ".png"
    if "." in image_url.rsplit("/", 1)[-1]:
        suffix = "." + image_url.rsplit(".", 1)[-1].split("?")[0]
    fd, path = tempfile.mkstemp(prefix="shaky-knees-lineup-", suffix=suffix)
    os.close(fd)
    response = requests.get(image_url, timeout=45)
    response.raise_for_status()
    with open(path, "wb") as handle:
        handle.write(response.content)
    return path


def _ocr_image_with_vision(image_path: str) -> Optional[str]:
    if shutil.which("swift") is None:
        logger.warning("swift not available; skipping lineup OCR")
        return None

    script = """
import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let image = NSImage(contentsOf: url),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fputs("image_load_failed\\n", stderr)
  exit(1)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])
for observation in request.results ?? [] {
  if let best = observation.topCandidates(1).first {
    print(best.string)
  }
}
"""

    fd, script_path = tempfile.mkstemp(prefix="shaky-knees-ocr-", suffix=".swift")
    os.close(fd)
    try:
        with open(script_path, "w", encoding="utf-8") as handle:
            handle.write(script)
        result = subprocess.run(
            ["swift", script_path, image_path],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            logger.warning("Shaky Knees OCR failed: %s", result.stderr.strip())
            return None
        text = result.stdout.strip()
        return text or None
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


def _normalize_ocr_lines(ocr_text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in (ocr_text or "").splitlines():
        line = re.sub(r"\s+", " ", raw_line.strip())
        if not line:
            continue
        if line.upper().startswith("FOR TICKETS"):
            break
        if "SHAKYKNEESFESTIVAL.COM" in line.upper():
            break
        lines.append(line)
    return lines


def _normalize_day_heading(line: str) -> Optional[tuple[str, str]]:
    upper = line.upper().strip()
    if "FRIDAY" in upper:
        remainder = upper.replace("FRIDAY", "", 1).strip(" -•:")
        return "FRIDAY", remainder
    if "SATURDAY" in upper:
        remainder = upper.replace("SATURDAY", "", 1).strip(" -•:")
        return "SATURDAY", remainder
    if "SUNDAY" in upper or upper.startswith("SUNDY"):
        remainder = re.sub(r"^SUND(?:AY|Y)\s*", "", upper).strip(" -•:")
        return "SUNDAY", remainder
    return None


def _normalize_artist_token(token: str) -> Optional[str]:
    normalized = token.strip(" -*:|¡!")
    normalized = re.sub(r"\s+", " ", normalized)
    if not normalized:
        return None
    upper = normalized.upper()
    if upper in {"SUNDAY", "SATURDAY", "FRIDAY"}:
        return None
    if upper in LINEUP_TOKEN_FIXES:
        return LINEUP_TOKEN_FIXES[upper]
    if len(upper) <= 2:
        return None
    return normalized.title()


def _extract_day_artists(section_lines: list[str]) -> list[str]:
    artists: list[str] = []
    for idx, line in enumerate(section_lines):
        normalized_line = line.upper().replace("·", "•")
        pieces = [normalized_line]
        if "•" in normalized_line:
            pieces = [piece.strip() for piece in normalized_line.split("•")]

        for piece in pieces:
            if not piece:
                continue
            if idx > 0 and "•" not in normalized_line:
                continue
            artist = _normalize_artist_token(piece)
            if artist and artist not in artists:
                artists.append(artist)
    return artists


def _parse_lineup_days(ocr_text: str) -> dict[str, list[str]]:
    days: dict[str, list[str]] = {day: [] for day in DAY_ORDER}
    current_day: Optional[str] = None

    for line in _normalize_ocr_lines(ocr_text):
        heading = _normalize_day_heading(line)
        if heading:
            current_day, remainder = heading
            if remainder:
                days[current_day].append(remainder)
            continue
        if current_day:
            days[current_day].append(line)

    parsed: dict[str, list[str]] = {}
    for day in DAY_ORDER:
        artists = _extract_day_artists(days[day])
        if artists:
            parsed[day] = artists
    return parsed


def _build_annual_description(year: int, lineup_days: dict[str, list[str]]) -> str:
    base = (
        f"Shaky Knees {year} is Atlanta's indie and rock festival at Piedmont Park, "
        "with day-by-day lineup announcements published on the official festival poster."
    )
    if not lineup_days:
        return (
            f"Shaky Knees {year} is Atlanta's premier indie rock festival featuring "
            "multiple stages over three days at Piedmont Park."
        )
    highlights: list[str] = []
    for day in DAY_ORDER:
        artists = lineup_days.get(day) or []
        if not artists:
            continue
        highlights.append(f"{day.title()}: {', '.join(artists[:4])}")
    return f"{base} {'; '.join(highlights)}."


def _build_day_lineup_description(day: str, year: int, artists: list[str]) -> str:
    preview = ", ".join(artists[:8])
    return (
        f"The official Shaky Knees {year} lineup poster lists {day.title()} artists including "
        f"{preview}. Additional artists appear on the official poster."
    )


def _build_artist_payload(artists: list[str]) -> list[dict]:
    payload = []
    for index, artist in enumerate(artists):
        payload.append(
            {
                "name": artist,
                "role": "performer",
                "billing_order": index + 1,
                "is_headliner": index == 0,
            }
        )
    return payload


def _upsert_event(
    event_record: dict, series_hint: Optional[dict] = None
) -> tuple[int, int]:
    existing = find_event_by_hash(event_record["content_hash"])
    if existing:
        smart_update_existing_event(existing, event_record)
        return 0, 1
    insert_event(event_record, series_hint=series_hint)
    return 1, 0


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shaky Knees Festival into an annual parent event and lineup day events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    year, start_date, end_date = _resolve_target_dates()
    venue_id = get_or_create_place(PLACE_DATA)

    lineup_image_url: Optional[str] = None
    lineup_days: dict[str, list[str]] = {}

    try:
        lineup_html = _fetch_html(LINEUP_URL)
        lineup_image_url = _extract_lineup_image_url(lineup_html)
        if lineup_image_url:
            image_path = _download_lineup_image(lineup_image_url)
            try:
                ocr_text = _ocr_image_with_vision(image_path)
            finally:
                try:
                    os.unlink(image_path)
                except OSError:
                    pass
            if ocr_text:
                lineup_days = _parse_lineup_days(ocr_text)
    except Exception as exc:
        logger.warning("Shaky Knees lineup extraction failed: %s", exc)

    annual_title = f"Shaky Knees Music Festival {year}"
    annual_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": annual_title,
        "description": _build_annual_description(year, lineup_days),
        "start_date": start_date.strftime("%Y-%m-%d"),
        "start_time": "12:00",
        "end_date": end_date.strftime("%Y-%m-%d"),
        "end_time": "23:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "festival",
        "tags": ["shaky-knees", "music-festival", "indie", "rock", "piedmont-park"],
        "price_min": 150.0,
        "price_max": 400.0,
        "price_note": "Single-day and 3-day passes available",
        "is_free": False,
        "source_url": BASE_URL,
        "ticket_url": BASE_URL,
        "image_url": lineup_image_url,
        "raw_text": None,
        "extraction_confidence": 0.95 if lineup_days else 0.85,
        "is_recurring": True,
        "recurrence_rule": "FREQ=YEARLY;BYMONTH=9",
        "_suppress_title_participants": True,
        "content_hash": generate_content_hash(
            annual_title, "Piedmont Park", start_date.strftime("%Y-%m-%d")
        ),
    }
    events_found += 1
    new_count, updated_count = _upsert_event(annual_record)
    events_new += new_count
    events_updated += updated_count

    if not lineup_days:
        logger.info("Shaky Knees lineup poster not parsed; annual event only")
        return events_found, events_new, events_updated

    series_hint = {
        "series_type": "festival_program",
        "series_title": f"Shaky Knees {year} Lineup",
        "festival_name": "Shaky Knees Festival",
        "festival_website": BASE_URL,
        "description": (
            f"Official day-by-day lineup announcements for Shaky Knees {year} at Piedmont Park, "
            "covering the published Friday, Saturday, and Sunday festival poster lineup."
        ),
        "image_url": lineup_image_url,
    }

    for day, artists in lineup_days.items():
        day_date = start_date + timedelta(days=DAY_OFFSETS[day])
        title = f"Shaky Knees {day.title()} Lineup"
        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": _build_day_lineup_description(day, year, artists),
            "start_date": day_date.strftime("%Y-%m-%d"),
            "start_time": None,
            "end_date": day_date.strftime("%Y-%m-%d"),
            "end_time": None,
            "is_all_day": True,
            "category": "music",
            "subcategory": "festival",
            "tags": [
                "shaky-knees",
                "festival-lineup",
                day.lower(),
                "music-festival",
                "piedmont-park",
            ],
            "price_min": 150.0,
            "price_max": 400.0,
            "price_note": "Included with festival admission",
            "is_free": False,
            "source_url": LINEUP_URL,
            "ticket_url": BASE_URL,
            "image_url": lineup_image_url,
            "raw_text": "\n".join(artists),
            "extraction_confidence": 0.72,
            "is_recurring": False,
            "recurrence_rule": None,
            "_parsed_artists": _build_artist_payload(artists),
            "_suppress_title_participants": True,
            "content_hash": generate_content_hash(
                title, "Piedmont Park", day_date.strftime("%Y-%m-%d")
            ),
        }
        events_found += 1
        new_count, updated_count = _upsert_event(event_record, series_hint=series_hint)
        events_new += new_count
        events_updated += updated_count

    return events_found, events_new, events_updated
