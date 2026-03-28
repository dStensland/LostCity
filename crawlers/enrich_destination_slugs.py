#!/usr/bin/env python3
"""
Targeted destination enrichment for a list of venue slugs.

Enrichment steps (best-effort, non-destructive):
1. Geocode missing coordinates from address (Nominatim)
2. Foursquare search + details (hours, image, website/phone/instagram, descriptions)
3. Parking backfill (website extraction, then OSM fallback)
4. Transit accessibility fields (MARTA/BeltLine score)

Usage:
    python3 enrich_destination_slugs.py --slugs slug-a,slug-b
    python3 enrich_destination_slugs.py --slugs-file /tmp/slugs.txt
    python3 enrich_destination_slugs.py --slugs slug-a,slug-b --dry-run
"""

from __future__ import annotations

import argparse
import html as html_lib
import logging
import os
import re
import subprocess
import time
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from db import get_client
from geocode_venues import geocode_address
from hydrate_venues_foursquare import (
    ATLANTA_LAT,
    ATLANTA_LNG,
    CATEGORY_MAP,
    parse_foursquare_hours,
    parse_foursquare_photo,
    search_foursquare,
)
from parking_extract import extract_parking_info, is_valid_parking_note, _focused_parking_snippet
from enrich_parking import _fetch_osm_parking, _osm_parking_for_venue
from enrich_transit import (
    compute_beltline_proximity,
    compute_nearest_marta,
    compute_transit_score,
)
from hours_utils import prepare_hours_update, should_update_hours
from scrape_place_hours import scrape_hours_from_website
from utils import extract_text_content, fetch_page, validate_url

# Load .env from repo root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOURSQUARE_API_KEY = os.environ.get("FOURSQUARE_API_KEY", "")
FOURSQUARE_API_BASE = "https://places-api.foursquare.com"
FOURSQUARE_API_VERSION = "2025-06-17"

PLANNING_LINK_HINTS = (
    "plan-your-visit",
    "plan-your-trip",
    "visit",
    "getting-here",
    "getting here",
    "guest-services",
    "accessibility",
    "parking",
    "direction",
    "directions",
    "faq",
    "guide",
    "information",
    "ticket",
    "special-offers",
    "hours",
)

VISIT_CHILD_GUESSES = (
    "plan-a-visit/",
    "plan-your-visit/",
    "visit-us",
    "hours-and-special-closures/",
    "directions-parking/",
)

ROOT_PLANNING_GUESSES = (
    "visit/",
    "plan-your-visit/",
    "visitor-information/",
    "getting-here/",
    "daily-schedule/",
    "accessibility/",
    "faq/",
    "directions-parking/",
)

PLANNING_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "free_admission",
        re.compile(
            r"free admission(?: every day)?[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "free_public",
        re.compile(
            r"museum is free and open to the public[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "hours_visit",
        re.compile(
            r"(?:museum visitation hours|museum & shop hours|open(?:ed)?)\s+[^.]{0,260}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "hours_museum_label",
        re.compile(
            r"museum hours[:\s]+[^.]{0,280}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.]{0,280}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "available_hours",
        re.compile(
            r"available hours[:\s]+[^.]{0,320}(?:mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)[^.]{0,320}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "hours_operation",
        re.compile(
            r"hours of operation.{0,280}(?:sun|sunday|mon|monday|tues|tuesday|wed|wednesday|thurs|thursday|fri|friday|sat|saturday).{0,280}(?:\.|$)",
            re.IGNORECASE | re.DOTALL,
        ),
    ),
    (
        "hours_gallery",
        re.compile(
            r"gallery hours[^.]{0,280}(?:sun|sunday|mon|monday|tues|tuesday|wed|wednesday|thurs|thursday|fri|friday|sat|saturday)[^.]{0,280}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "appointment_only",
        re.compile(
            r"(?:by appointment only|currently closed for install|hours (?:will )?resume \d{1,2}/\d{1,2})[^.]{0,180}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "suggested_donation",
        re.compile(
            r"suggested donation[:\s]+\$?\d+[^.]{0,120}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "admission_fee",
        re.compile(
            r"admission fee[:\s]+[^.]{0,180}\$?\d+[^.]{0,180}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking",
        re.compile(
            r"parking (?:is|garage|available)[^.]{0,220}?\$?\d+[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_free",
        re.compile(
            r"(?:parking is free|limited free parking)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_limited",
        re.compile(
            r"(?:parking is limited|carpooling are highly encouraged as parking is limited)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_none",
        re.compile(
            r"(?:does not offer designated parking|public parking lots located|metered parking available)[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_capacity",
        re.compile(
            r"parking garage[^.]{0,220}?(?:limited capacity|first-come|first served)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_decks_map",
        re.compile(
            r"parking is available in the [^.]{0,180}?(?:deck|decks)[^.]{0,160}?(?:shown on the map|map)[^.]{0,80}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_general",
        re.compile(
            r"(?:limited\s+)?(?:on-site|onsite|nearby)?\s*parking options are available[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_walkable_garages",
        re.compile(
            r"multiple parking garages are located within walking distance[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "accessible_parking",
        re.compile(
            r"accessible parking[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "dropoff",
        re.compile(
            r"drop off point[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "accessible_entry",
        re.compile(
            r"(?:avoid stairs|rear entrance|lower level is accessible)[^.]{0,240}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "oversize",
        re.compile(
            r"(?:buses|oversize vehicles|rvs)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "wheelchair",
        re.compile(
            r"(?:courtesy )?wheelchairs?[^.]{0,220}?(?:first-come|available|ADA compliant)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "accessible_facilities",
        re.compile(
            r"(?:wheelchair-accessible|accessible)\s+(?:entrances|ramps|restrooms)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "accessibility_general",
        re.compile(
            r"all galleries and restrooms are wheelchair accessible[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "stroller",
        re.compile(
            r"(?:baby )?strollers?[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "register_visit",
        re.compile(
            r"(?:all visitors are asked to register|please consider registering your visit)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "location_gps",
        re.compile(
            r"(?:gps address|mailing address|location)\s*:?[^.]{0,260}(?:atlanta,\s*ga\s*\d{5})[^.]{0,120}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "location_address",
        re.compile(
            r"our address\s*:?[^.]{0,220}(?:atlanta,\s*ga\s*\d{5})(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "day_range_hours",
        re.compile(
            r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[–-]\s*"
            r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:?[^.]{0,220}"
            r"(?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "split_day_hours",
        re.compile(
            r"(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[:\-][^.]{0,80}"
            r"(?:closed|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))[^.]{0,260}"
            r"(?:saturday|sunday|monday|tuesday|wednesday|thursday|friday)\s*[:\-][^.]{0,160}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "guided_tour",
        re.compile(
            r"guided tours?(?: tickets?)?[^.]{0,220}(?:time slot|checking out|guided experience|advance reservation|available)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "reservations",
        re.compile(
            r"reservations[:\s]+[^.]{0,180}(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}[^.]{0,120}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "reservations_email",
        re.compile(
            r"(?:table reservations|reservations available)[^.]{0,220}[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}[^.]{0,120}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "reservations_recommended",
        re.compile(
            r"reservations(?: are)?(?: always)?(?: strongly)?(?: highly)? (?:encouraged|recommended)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "walkins_welcome",
        re.compile(
            r"walk-?ins?(?: are)? (?:always )?(?:welcome|accepted)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "patio_seating",
        re.compile(
            r"(?:patio seating available|double the patios|upstairs patio|downstairs patio|patio is in the shade|patio gets full sun)[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "cover_charge",
        re.compile(
            r"cover[:\s]+\$?\d+[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "dinner_served",
        re.compile(
            r"dinner served until \d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)[^.]{0,160}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "doors_open",
        re.compile(
            r"doors to the venue open[^.]{0,220}(?:minutes|hour)[^.]{0,120}(?:before|prior)[^.]{0,120}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "security_screening",
        re.compile(
            r"(?:enhanced )?security screenings?[^.]{0,220}(?:metal detectors|allow extra time|enter the venue)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "public_transport",
        re.compile(
            r"public transportation[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "visit_duration",
        re.compile(
            r"most (?:visitors|people) spend\s+\d{1,3}(?:\s*[–-]\s*\d{1,3})?\s+minutes[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "marta",
        re.compile(
            r"(?:reach us via marta|arts center marta station|visit itsmarta\.com|taking marta\?|located next to the [^.]{0,120}marta station|accessible via [^.]{0,120}marta[^.]{0,120})(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "transit_circulator",
        re.compile(
            r"(?:accessible via|public transportation)[^.]{0,260}(?:cobblinc|cumberland circulator|marta)[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "bike",
        re.compile(
            r"(?:bike racks|visit us by bike|accessible by bicycle)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "bag_policy",
        re.compile(
            r"bag policy[^.]{0,320}(?:bags are not allowed|clear bags|medical bags|diaper bags|ADA needs)[^.]{0,320}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "will_call",
        re.compile(
            r"will call[^.]{0,260}(?:no longer offered|not offered|mobile)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "rideshare_zone",
        re.compile(
            r"rideshare[^.]{0,260}(?:zone|pick-up|drop-off|access)[^.]{0,260}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "parking_prepurchase",
        re.compile(
            r"(?:strongly recommend|recommend)\s+pre-?purchasing[^.]{0,220}parking[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "citypass",
        re.compile(
            r"citypass[^.]{0,220}(?:save|saves)[^.]{0,220}(?:\.|$)",
            re.IGNORECASE,
        ),
    ),
]


def _normalize_text(text: str) -> str:
    value = text or ""
    if any(token in value for token in ("â", "Â", "Ã")):
        try:
            value = value.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
        except Exception:
            pass
    value = value.replace("\u2011", "-")
    return re.sub(r"\s+", " ", value).strip()


def _canonical_host(value: str) -> str:
    host = (value or "").lower().strip()
    return host[4:] if host.startswith("www.") else host


def _candidate_planning_urls(website: str) -> list[str]:
    try:
        homepage_html = _fetch_page_with_fallback(website)
    except Exception:
        return _root_guess_urls(website)
    urls = _extract_candidate_planning_urls_from_html(website, homepage_html)
    if not urls:
        urls = _root_guess_urls(website)
    return urls[:10]


def _root_guess_urls(website: str) -> list[str]:
    parsed = urlparse(website)
    if not parsed.scheme or not parsed.netloc:
        return []
    base_url = f"{parsed.scheme}://{parsed.netloc}/"
    return [urljoin(base_url, guess) for guess in ROOT_PLANNING_GUESSES]


def _should_expand_nested_planning_urls(url: str) -> bool:
    path = urlparse(url).path.lower().rstrip("/")
    if not path:
        return False
    if any(
        token in path
        for token in ("parking", "directions", "accessibility", "hours", "getting-here")
    ):
        return False
    return any(
        token in path
        for token in ("visit", "plan-your-visit", "plan-your-trip", "visitor-information", "faq")
    )


def _fetch_page_with_fallback(url: str) -> str:
    try:
        return fetch_page(url)
    except Exception:
        validated = validate_url(url)
        result = subprocess.run(
            ["curl", "-L", "--max-time", "20", "--silent", "--show-error", validated],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout


def _extract_candidate_planning_urls_from_html(base_url: str, html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    base_host = _canonical_host(urlparse(base_url).netloc)
    weighted_urls: list[tuple[int, str]] = []

    for anchor in soup.select("a[href]"):
        href = anchor.get("href") or ""
        text = _normalize_text(anchor.get_text(" ", strip=True)).lower()
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if _canonical_host(parsed.netloc) != base_host:
            continue
        haystack = f"{absolute.lower()} {text}"
        if any(token in haystack for token in PLANNING_LINK_HINTS):
            score = 0
            if "plan-your-visit" in haystack or "plan a visit" in haystack:
                score += 4
            if "plan-your-trip" in haystack or "plan your trip" in haystack:
                score += 4
            if "getting-here" in haystack or "getting here" in haystack:
                score += 4
            if "parking" in haystack or "directions" in haystack:
                score += 3
            if "hours" in haystack or "faq" in haystack or "accessibility" in haystack:
                score += 2
            if "visit" in haystack:
                score += 1
            weighted_urls.append((score, absolute))

    deduped: list[str] = []
    for _, url in sorted(weighted_urls, key=lambda item: (-item[0], item[1])):
        if url not in deduped:
            deduped.append(url)
    return deduped[:6]


def _extract_planning_note_from_text(text: str) -> Optional[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return None

    snippets: list[str] = []
    for _, pattern in PLANNING_PATTERNS:
        match = pattern.search(normalized)
        if not match:
            continue
        snippet = _normalize_text(match.group(0))
        snippet = re.sub(r"\bSkip to content\b", "", snippet, flags=re.IGNORECASE)
        snippet = re.sub(
            r"\bReservations Home Live Music Private Parties Calendar Reservations\b",
            "",
            snippet,
            flags=re.IGNORECASE,
        )
        snippet = re.sub(r"\[\s*…\s*\]|\[\.\.\.\]", "", snippet, flags=re.IGNORECASE)
        snippet = re.sub(r"\bClick to Enlarge\b", "", snippet, flags=re.IGNORECASE)
        snippet = re.sub(
            r"\bParking and Directions\s*-\s*[^.]{0,120}\b",
            "",
            snippet,
            flags=re.IGNORECASE,
        )
        snippet = _normalize_text(snippet)
        if not snippet:
            continue

        snippet_lower = snippet.lower()
        replaced = False
        keep = True
        for index, existing in enumerate(list(snippets)):
            existing_lower = existing.lower()
            if snippet_lower == existing_lower or snippet_lower in existing_lower:
                keep = False
                break
            if existing_lower in snippet_lower:
                if len(snippet) <= len(existing) + 80:
                    snippets[index] = snippet
                    replaced = True
                else:
                    keep = False
                break
        if keep and not replaced:
            snippets.append(snippet)

    if not snippets:
        return None

    # Keep notes concise and user-facing.
    return " ".join(snippets[:6])[:1200]


HOSPITALITY_VENUE_TYPES = {"bar", "restaurant", "brewery", "nightclub", "cafe"}


def _compose_hospitality_planning_note(note: Optional[str], venue_type: Optional[str]) -> Optional[str]:
    if not note or venue_type not in HOSPITALITY_VENUE_TYPES:
        return note

    value = _normalize_text(note)
    has_21_plus = bool(
        re.search(r"\b21\s*(?:\+|&\s*Up|and\s+up)\b", value, flags=re.IGNORECASE)
    )

    value = re.sub(r"^Open Hours\s+", "Open ", value, flags=re.IGNORECASE)
    value = re.sub(r"\b21\s*&\s*Up\b", "21+", value, flags=re.IGNORECASE)
    value = re.sub(r"\b21\s+and\s+up\b", "21+", value, flags=re.IGNORECASE)
    value = re.sub(r"\b21\+\b\.?", "", value, flags=re.IGNORECASE)

    dress_code_match = re.search(
        r"(?:we politely request[^.]{0,180}(?:attire|dress)[^.]{0,80}|dress code[^.]{0,180})",
        value,
        flags=re.IGNORECASE,
    )
    if dress_code_match:
        dress_note = _normalize_text(dress_code_match.group(0)).rstrip(" .;,")
        if not dress_note:
            return None
        if has_21_plus:
            return f"{dress_note}. 21+."
        return f"{dress_note}."

    value = re.split(
        r"\b(?:In the heart of|Located at|Our address|Address|Find Us|Location|Phone|Follow|Contact Us|Press Contact|General Manager)\b|©|Copyright",
        value,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    value = _normalize_text(value).rstrip(" .;,")
    if not value:
        return None

    useful_keywords = (
        "reservation",
        "walk-in",
        "walk in",
        "patio",
        "seating",
        "parking",
        "valet",
        "deck",
        "cover",
        "dress code",
        "rooftop",
        "after hours",
        "dog-friendly",
        "dog friendly",
        "pet-friendly",
        "pet friendly",
    )
    has_useful_keyword = any(keyword in value.lower() for keyword in useful_keywords)
    looks_like_hours_only = bool(
        re.search(
            r"\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b",
            value,
            flags=re.IGNORECASE,
        )
        or re.search(r"\b\d{1,2}(?::\d{2})?\s*(?:a|p|am|pm)\b", value, flags=re.IGNORECASE)
    )
    looks_like_contact_only = bool(
        re.match(r"^(?:location|find us)\b", value, flags=re.IGNORECASE)
        or re.search(r"\b\d{1,5}\s+\w+", value)
    )
    if not has_useful_keyword and (looks_like_hours_only or looks_like_contact_only) and not has_21_plus:
        return None

    if has_21_plus:
        return f"{value}. 21+."
    if value.endswith("."):
        return value
    return f"{value}."


def _extract_embedded_html_text(html: str) -> str:
    raw = html or ""
    if "\\u003c" not in raw and "\\u003e" not in raw and "\\u0026" not in raw:
        return ""
    def _decode_match(match: re.Match[str]) -> str:
        try:
            return chr(int(match.group(1), 16))
        except Exception:
            return match.group(0)

    decoded = re.sub(r"\\u([0-9a-fA-F]{4})", _decode_match, raw)
    decoded = html_lib.unescape(decoded)
    plain = re.sub(r"<[^>]+>", " ", decoded)
    return _normalize_text(plain)


def _normalize_phone(value: str) -> Optional[str]:
    if not value:
        return None
    match = re.search(
        r"(?:\+?1[-.\s]?)?[\(\[]?(\d{3})[\)\]]?[-.\s]?(\d{3})[-.\s]?(\d{4})\b",
        _normalize_text(value),
    )
    if not match:
        return None
    area, exchange, subscriber = match.groups()
    if exchange == "555":
        return None
    return f"({area}) {exchange}-{subscriber}"


def _extract_meta_description_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    snippets: list[str] = []
    selectors = (
        ('meta[name="description"]', "content"),
        ('meta[property="og:description"]', "content"),
        ('meta[name="twitter:description"]', "content"),
    )
    for selector, attr in selectors:
        tag = soup.select_one(selector)
        if not tag:
            continue
        value = _normalize_text(tag.get(attr, ""))
        if value and value not in snippets:
            snippets.append(value)
    return " ".join(snippets)


def _extract_first_party_phone(text: str) -> Optional[str]:
    normalized = _normalize_text(text)
    labeled_match = re.search(
        r"(?:phone|call|tel)(?:\s*[:\]\[]\s*|\s+)[\(\[]?(\d{3})[\)\]]?[-.\s]?(\d{3})[-.\s]?(\d{4})\b",
        normalized,
        re.IGNORECASE,
    )
    match = labeled_match or re.search(
        r"\b(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b",
        normalized,
    )
    if not match:
        return None
    return _normalize_phone(match.group(0))


def _select_first_party_phone(
    website: str,
    page_texts: list[tuple[str, str]],
    *,
    allow_cross_host_fallback: bool,
) -> Optional[str]:
    base_host = _canonical_host(urlparse(website).netloc)
    same_host_phones: list[str] = []
    cross_host_phones: list[str] = []

    for page_url, page_text in page_texts:
        phone = _extract_first_party_phone(page_text)
        if not phone:
            continue
        page_host = _canonical_host(urlparse(page_url).netloc)
        if page_host == base_host:
            same_host_phones.append(phone)
        else:
            cross_host_phones.append(phone)

    if same_host_phones:
        return Counter(same_host_phones).most_common(1)[0][0]
    if allow_cross_host_fallback and cross_host_phones:
        return Counter(cross_host_phones).most_common(1)[0][0]
    return None


def _maybe_planning_enrich(venue: Dict[str, Any]) -> Dict[str, Any]:
    website = venue.get("website")
    if not website:
        return {}

    candidate_urls = _candidate_planning_urls(website)
    visited_urls: set[str] = set()
    combined_text_parts: list[str] = []
    page_texts: list[tuple[str, str]] = []

    def _add_html_text(page_url: str, html: str) -> None:
        extracted = extract_text_content(html)
        plain = BeautifulSoup(html, "lxml").get_text(" ", strip=True)
        embedded = _extract_embedded_html_text(html)
        meta_description = _extract_meta_description_text(html)
        combined_text_parts.append(extracted)
        combined_text_parts.append(plain)
        if embedded:
            combined_text_parts.append(embedded)
        if meta_description:
            combined_text_parts.append(meta_description)
        page_texts.append((page_url, extracted))
        page_texts.append((page_url, plain))
        if embedded:
            page_texts.append((page_url, embedded))
        if meta_description:
            page_texts.append((page_url, meta_description))

    try:
        homepage_html = _fetch_page_with_fallback(website)
    except Exception:
        homepage_html = None
    if homepage_html:
        visited_urls.add(website)
        _add_html_text(website, homepage_html)

    for url in candidate_urls:
        if url in visited_urls:
            continue
        visited_urls.add(url)
        try:
            html = _fetch_page_with_fallback(url)
        except Exception:
            continue
        _add_html_text(url, html)

        parsed = urlparse(url)
        if _should_expand_nested_planning_urls(url):
            # Some sites put the real logistics one click below a generic visit hub page.
            for nested_url in _extract_candidate_planning_urls_from_html(url, html):
                if nested_url in visited_urls:
                    continue
                visited_urls.add(nested_url)
                try:
                    nested_html = _fetch_page_with_fallback(nested_url)
                except Exception:
                    continue
                _add_html_text(nested_url, nested_html)

        if parsed.path.rstrip("/").endswith("/visit"):
            base_with_slash = url.rstrip("/") + "/"
            for child in VISIT_CHILD_GUESSES:
                guessed_url = urljoin(base_with_slash, child)
                if guessed_url in visited_urls:
                    continue
                visited_urls.add(guessed_url)
                try:
                    guessed_html = _fetch_page_with_fallback(guessed_url)
                except Exception:
                    continue
                _add_html_text(guessed_url, guessed_html)

    combined_text = " ".join(combined_text_parts)
    planning_note = _extract_planning_note_from_text(combined_text)
    planning_note = _compose_hospitality_planning_note(planning_note, venue.get("place_type") or venue.get("venue_type"))
    phone = _select_first_party_phone(
        website,
        page_texts,
        allow_cross_host_fallback=not bool(venue.get("phone")),
    )

    fetched_any_page = bool(page_texts)

    if (
        not planning_note
        and fetched_any_page
        and venue.get("place_type") or venue.get("venue_type") in HOSPITALITY_VENUE_TYPES
        and venue.get("planning_notes")
    ):
        updates: Dict[str, Any] = {
            "planning_notes": None,
            "planning_last_verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if phone and venue.get("phone") != phone:
            updates["phone"] = phone
        return updates

    if not planning_note and not phone:
        return {}

    updates: Dict[str, Any] = {}
    if planning_note:
        updates["planning_notes"] = planning_note
        updates["planning_last_verified_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if phone and venue.get("phone") != phone:
        updates["phone"] = phone
    return updates


def _maybe_website_hours_enrich(venue: Dict[str, Any]) -> Dict[str, Any]:
    if venue.get("hours") and not should_update_hours(venue.get("hours_source"), "website"):
        return {}

    website = venue.get("website")
    if not website:
        return {}

    candidate_urls = [website, *_candidate_planning_urls(website)]
    visited_urls: set[str] = set()

    for url in candidate_urls:
        if not url or url in visited_urls:
            continue
        visited_urls.add(url)
        raw_hours = scrape_hours_from_website(url)
        if not raw_hours:
            continue

        hours, hours_display = prepare_hours_update(
            raw_hours,
            source="website",
            venue_type=venue.get("place_type") or venue.get("venue_type"),
        )
        if not hours:
            continue

        updates: Dict[str, Any] = {
            "hours": hours,
            "hours_source": "website",
            "hours_updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        if hours_display:
            updates["hours_display"] = hours_display
        return updates

    return {}


def _read_slugs_from_file(path: str) -> List[str]:
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]


def _safe_update(client: Any, venue_id: int, updates: Dict[str, Any], dry_run: bool) -> None:
    if not updates:
        return
    if dry_run:
        return
    client.table("places").update(updates).eq("id", venue_id).execute()


def _maybe_geocode(venue: Dict[str, Any]) -> Dict[str, Any]:
    if venue.get("lat") is not None and venue.get("lng") is not None:
        return {}
    address = venue.get("address")
    if not address:
        return {}
    coords = geocode_address(
        address=address,
        city=venue.get("city") or "Atlanta",
        state=venue.get("state") or "GA",
    )
    if not coords:
        return {}
    lat, lng = coords
    return {"lat": lat, "lng": lng}


def _maybe_foursquare_enrich(venue: Dict[str, Any]) -> Dict[str, Any]:
    if not FOURSQUARE_API_KEY:
        return {}

    lat = venue.get("lat") if venue.get("lat") is not None else ATLANTA_LAT
    lng = venue.get("lng") if venue.get("lng") is not None else ATLANTA_LNG
    query_name = venue.get("name") or ""

    search_result = search_foursquare(
        query=query_name,
        lat=float(lat),
        lng=float(lng),
        categories=CATEGORY_MAP.get(venue.get("place_type") or venue.get("venue_type")),
    )
    if not search_result:
        return {}

    updates: Dict[str, Any] = {}
    fsq_id = search_result.get("fsq_place_id") or search_result.get("fsq_id")
    if fsq_id:
        updates["foursquare_id"] = fsq_id

    details = _get_foursquare_details_with_backoff(fsq_id) if fsq_id else None
    payload = details or search_result

    # Hours
    if not venue.get("hours"):
        hours, hours_display = parse_foursquare_hours(payload.get("hours"))
        if hours:
            updates["hours"] = hours
        if hours_display:
            updates["hours_display"] = hours_display

    # Image
    if not venue.get("image_url"):
        photo = parse_foursquare_photo(payload.get("photos"))
        if photo:
            updates["image_url"] = photo

    # Website/phone/instagram
    if not venue.get("website"):
        website = payload.get("website")
        if website:
            updates["website"] = website
    if not venue.get("phone"):
        phone = _normalize_phone(payload.get("tel") or payload.get("nationalPhoneNumber") or "")
        if phone:
            updates["phone"] = phone
    if not venue.get("instagram"):
        social = payload.get("social_media") or {}
        ig = social.get("instagram")
        if ig:
            updates["instagram"] = ig

    # Descriptions
    if not venue.get("short_description"):
        desc = payload.get("description")
        if desc:
            updates["short_description"] = desc[:500]
    if not venue.get("description"):
        short_desc = payload.get("description")
        if short_desc:
            updates["description"] = short_desc[:1000]

    return updates


def _get_foursquare_details_with_backoff(fsq_id: str) -> Optional[Dict[str, Any]]:
    if not fsq_id or not FOURSQUARE_API_KEY:
        return None

    fields = "fsq_place_id,name,location,hours,photos,price,rating,description,tel,website,social_media"
    backoffs = [3, 6, 12]
    for attempt in range(len(backoffs) + 1):
        try:
            response = requests.get(
                f"{FOURSQUARE_API_BASE}/places/{fsq_id}",
                params={"fields": fields},
                headers={
                    "Authorization": f"Bearer {FOURSQUARE_API_KEY}",
                    "Accept": "application/json",
                    "X-Places-Api-Version": FOURSQUARE_API_VERSION,
                },
                timeout=12,
            )
            if response.status_code == 429:
                if attempt < len(backoffs):
                    delay = backoffs[attempt]
                    logger.warning("Foursquare 429 for %s, retrying in %ss", fsq_id, delay)
                    time.sleep(delay)
                    continue
                return None

            response.raise_for_status()
            return response.json()
        except Exception:
            if attempt < len(backoffs):
                delay = backoffs[attempt]
                time.sleep(delay)
                continue
            return None

    return None


def _maybe_parking_enrich(
    venue: Dict[str, Any],
    osm_data: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    existing_parking_note = venue.get("parking_note")
    if existing_parking_note and venue.get("parking_source") == "scraped":
        normalized_existing = _focused_parking_snippet(existing_parking_note)
        if (
            normalized_existing
            and normalized_existing != existing_parking_note
            and is_valid_parking_note(normalized_existing)
        ):
            return {"parking_note": normalized_existing}

    if existing_parking_note and is_valid_parking_note(existing_parking_note):
        return {}

    # Website scraping first
    website = venue.get("website")
    if website:
        parking = extract_parking_info(website)
        if parking:
            updates: Dict[str, Any] = {
                "parking_note": parking.get("parking_note"),
                "parking_type": parking.get("parking_type"),
                "parking_free": parking.get("parking_free"),
                "parking_source": "scraped",
            }
            if parking.get("transit_note"):
                updates["transit_note"] = parking.get("transit_note")
            return updates

    # OSM fallback
    lat = venue.get("lat")
    lng = venue.get("lng")
    if lat is None or lng is None or not osm_data:
        if existing_parking_note:
            return {
                "parking_note": None,
                "parking_type": None,
                "parking_free": None,
                "parking_source": None,
            }
        return {}

    parking = _osm_parking_for_venue(float(lat), float(lng), osm_data)
    if not parking:
        if existing_parking_note:
            return {
                "parking_note": None,
                "parking_type": None,
                "parking_free": None,
                "parking_source": None,
            }
        return {}
    return {
        "parking_note": parking.get("parking_note"),
        "parking_type": parking.get("parking_type"),
        "parking_free": parking.get("parking_free"),
        "parking_source": parking.get("parking_source"),
    }


def _transit_updates(venue: Dict[str, Any]) -> Dict[str, Any]:
    lat = venue.get("lat")
    lng = venue.get("lng")
    if lat is None or lng is None:
        return {}

    marta = compute_nearest_marta(float(lat), float(lng))
    beltline = compute_beltline_proximity(float(lat), float(lng))
    score = compute_transit_score(
        marta=marta,
        beltline=beltline,
        parking_free=venue.get("parking_free"),
        has_parking=bool(venue.get("parking_note")),
    )

    updates: Dict[str, Any] = {"transit_score": score}
    if marta:
        updates["nearest_marta_station"] = marta["nearest_marta_station"]
        updates["marta_walk_minutes"] = marta["marta_walk_minutes"]
        updates["marta_lines"] = marta["marta_lines"]
    if beltline:
        updates["beltline_adjacent"] = True
        updates["beltline_segment"] = beltline["beltline_segment"]
        updates["beltline_walk_minutes"] = beltline["beltline_walk_minutes"]
    return updates


def enrich_slugs(slugs: List[str], dry_run: bool = False) -> Dict[str, int]:
    client = get_client()
    rows = (
        client.table("places")
        .select("*")
        .in_("slug", slugs)
        .execute()
        .data
        or []
    )
    by_slug = {row["slug"]: row for row in rows}

    osm_data: Optional[List[Dict[str, Any]]] = None
    stats = {
        "requested": len(slugs),
        "found": len(rows),
        "updated": 0,
        "missing": 0,
    }

    for slug in slugs:
        venue = by_slug.get(slug)
        if not venue:
            logger.warning("MISSING slug: %s", slug)
            stats["missing"] += 1
            continue

        original = dict(venue)
        merged_updates: Dict[str, Any] = {}

        # 1) geocode
        geo_updates = _maybe_geocode(venue)
        if geo_updates:
            merged_updates.update(geo_updates)
            venue = {**venue, **geo_updates}

        # 2) planning
        planning_updates = _maybe_planning_enrich(venue)
        if planning_updates:
            merged_updates.update(planning_updates)
            venue = {**venue, **planning_updates}

        # 3) first-party website hours
        website_hours_updates = _maybe_website_hours_enrich(venue)
        if website_hours_updates:
            merged_updates.update(website_hours_updates)
            venue = {**venue, **website_hours_updates}

        # 4) foursquare
        fsq_updates = _maybe_foursquare_enrich(venue)
        if fsq_updates:
            merged_updates.update({k: v for k, v in fsq_updates.items() if v is not None})
            venue = {**venue, **fsq_updates}

        # 5) parking
        existing_parking_note = venue.get("parking_note")
        needs_parking_cleanup = False
        if existing_parking_note and venue.get("parking_source") == "scraped":
            normalized_existing = _focused_parking_snippet(existing_parking_note)
            needs_parking_cleanup = bool(
                normalized_existing
                and normalized_existing != existing_parking_note
                and is_valid_parking_note(normalized_existing)
            )

        if (
            existing_parking_note is None
            or not is_valid_parking_note(existing_parking_note)
            or needs_parking_cleanup
        ):
            if osm_data is None:
                osm_data = _fetch_osm_parking()
            parking_updates = _maybe_parking_enrich(venue, osm_data)
            if parking_updates:
                merged_updates.update(parking_updates)
                venue = {**venue, **parking_updates}

        # 6) transit
        transit_updates = _transit_updates(venue)
        # Always update transit fields; they're deterministic
        if transit_updates:
            merged_updates.update(transit_updates)
            venue = {**venue, **transit_updates}

        # Strip no-op updates where value is unchanged
        no_op_keys = [k for k, v in merged_updates.items() if original.get(k) == v]
        for k in no_op_keys:
            merged_updates.pop(k, None)

        if merged_updates:
            logger.info("ENRICH %-32s -> %s", slug, ", ".join(sorted(merged_updates.keys())))
            _safe_update(client, venue["id"], merged_updates, dry_run=dry_run)
            stats["updated"] += 1
        else:
            logger.info("SKIP   %-32s -> no changes", slug)

        # Respect API rate limits (Foursquare details endpoint is strict).
        time.sleep(2.0)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Targeted enrichment for destination slugs")
    parser.add_argument("--slugs", type=str, help="Comma-separated slugs")
    parser.add_argument("--slugs-file", type=str, help="Path to newline-delimited slug file")
    parser.add_argument("--dry-run", action="store_true", help="Preview without DB updates")
    args = parser.parse_args()

    slugs: List[str] = []
    if args.slugs:
        slugs.extend([s.strip() for s in args.slugs.split(",") if s.strip()])
    if args.slugs_file:
        slugs.extend(_read_slugs_from_file(args.slugs_file))
    slugs = list(dict.fromkeys(slugs))

    if not slugs:
        raise SystemExit("No slugs provided. Use --slugs or --slugs-file.")

    logger.info("=" * 72)
    logger.info("Destination Enrichment")
    logger.info("Mode: %s", "DRY RUN" if args.dry_run else "APPLY")
    logger.info("Foursquare key: %s", "available" if FOURSQUARE_API_KEY else "missing")
    logger.info("=" * 72)

    stats = enrich_slugs(slugs=slugs, dry_run=args.dry_run)

    logger.info("")
    logger.info("=" * 72)
    logger.info("Summary")
    logger.info("Requested: %d", stats["requested"])
    logger.info("Found: %d", stats["found"])
    logger.info("Updated: %d", stats["updated"])
    logger.info("Missing: %d", stats["missing"])
    logger.info("=" * 72)


if __name__ == "__main__":
    main()
