"""
Shared crawler helpers for MyRec program catalogs.

MyRec exposes a server-rendered listing page of program groups plus program detail
pages that contain a structured activity/session table. This base module focuses on
that stable HTML contract so family-program sources can share one parser shape.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

REQUEST_DELAY = 0.5
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

_DATE_RANGE_RE = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})\s*-\s*(\d{1,2}/\d{1,2}/\d{4})")
_TIME_RANGE_RE = re.compile(
    r"(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)",
    re.IGNORECASE,
)
_PRICE_RE = re.compile(r"\$([0-9]+(?:\.[0-9]{2})?)")
_AGE_RANGE_RE = re.compile(r"(\d+)y\s*-\s*(\d+)y", re.IGNORECASE)
_AGE_PLUS_RE = re.compile(r"(\d+)y(?:\s*\+|\s*and\s*up)", re.IGNORECASE)
_AGE_UNDER_RE = re.compile(r"(\d+)y(?:\s+\d+m)?\s+and\s+under", re.IGNORECASE)
_AGE_SINGLE_RE = re.compile(r"(\d+)y", re.IGNORECASE)
_REGISTER_LINK_TEXT_RE = re.compile(
    r"register|sign\s*up|enroll|book|consult|apply", re.IGNORECASE
)
_FAMILY_SIGNAL_RE = re.compile(
    r"\byouth\b|\bkids?\b|\bchild(?:ren)?\b|\bfamily\b|\bcamp\b|\bpreschool\b|\bteen\b|\btween\b",
    re.IGNORECASE,
)
_ADULT_SIGNAL_RE = re.compile(
    r"\badult\b|\b18y\s*and\s*up\b|\b18\+\b|\b21\+\b", re.IGNORECASE
)

_SPORT_KEYWORDS = {
    "baseball",
    "basketball",
    "cheer",
    "dive",
    "diving",
    "flag football",
    "football",
    "lacrosse",
    "running",
    "soccer",
    "softball",
    "speed training",
    "sports",
    "swim",
    "tennis",
    "volleyball",
    "wrestling",
}
_ARTS_KEYWORDS = {
    "art",
    "dance",
    "drama",
    "music",
    "theater",
    "theatre",
    "acting",
    "drawing",
    "painting",
}
_STEM_KEYWORDS = {
    "steam",
    "stem",
    "robot",
    "coding",
    "science",
    "math",
    "engineering",
    "chess",
}


def _get_soup(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    try:
        response = session.get(url, timeout=20)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("[myrec] Failed to fetch %s: %s", url, exc)
        return None
    return BeautifulSoup(response.text, "html.parser")


def _clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _parse_mmddyyyy(raw: str) -> Optional[str]:
    raw = _clean_text(raw)
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%m/%d/%Y").strftime("%Y-%m-%d")
    except ValueError:
        return None


def _parse_clock_time(raw: str) -> Optional[str]:
    raw = _clean_text(raw).upper()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%I:%M %p").strftime("%H:%M")
    except ValueError:
        return None


def _age_band_tags(age_min: Optional[int], age_max: Optional[int]) -> list[str]:
    if age_min is None and age_max is None:
        return []

    floor = age_min if age_min is not None else 0
    ceiling = age_max if age_max is not None else 18
    if floor >= 18:
        return []
    tags: list[str] = []
    if floor <= 5 and ceiling >= 3:
        tags.append("preschool")
    if floor <= 12 and ceiling >= 5:
        tags.append("elementary")
    if floor <= 13 and ceiling >= 10:
        tags.append("tween")
    if 13 <= ceiling <= 18 or 13 <= floor < 18:
        tags.append("teen")
    return tags


def _parse_age_range(age_text: str) -> tuple[Optional[int], Optional[int], list[str]]:
    text = _clean_text(age_text)
    if not text or text.upper() == "N/A":
        return None, None, []

    match = _AGE_RANGE_RE.search(text)
    if match:
        age_min = int(match.group(1))
        age_max = int(match.group(2))
        return age_min, age_max, _age_band_tags(age_min, age_max)

    match = _AGE_PLUS_RE.search(text)
    if match:
        age_min = int(match.group(1))
        return age_min, None, _age_band_tags(age_min, 18)

    match = _AGE_UNDER_RE.search(text)
    if match:
        age_max = int(match.group(1))
        return None, age_max, _age_band_tags(0, age_max)

    match = _AGE_SINGLE_RE.search(text)
    if match:
        age = int(match.group(1))
        return age, age, _age_band_tags(age, age)

    return None, None, []


def _parse_price_text(price_text: str) -> tuple[Optional[float], Optional[float], bool]:
    amounts = [float(match) for match in _PRICE_RE.findall(price_text or "")]
    if not amounts:
        return None, None, False
    price_min = min(amounts)
    price_max = max(amounts)
    return price_min, price_max, price_max == 0.0


def _extract_query_param(url: Optional[str], key: str) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get(key)
    if not values:
        return None
    return values[0]


def _unwrap_redirect_url(url: str) -> str:
    parsed = urlparse(url)
    if "linkprotect.cudasvc.com" not in parsed.netloc.lower():
        return url
    wrapped = parse_qs(parsed.query).get("a")
    if not wrapped:
        return url
    return unquote(wrapped[0])


def _extract_external_registration_url(
    description_node: Optional[Tag],
    base_url: str,
) -> Optional[str]:
    if description_node is None:
        return None

    base_host = urlparse(base_url).netloc.lower()
    preferred_links: list[str] = []
    fallback_links: list[str] = []
    for link in description_node.find_all("a", href=True):
        href = _unwrap_redirect_url(urljoin(base_url, link["href"]))
        parsed = urlparse(href)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc.lower() != base_host:
            text = _clean_text(link.get_text(" ", strip=True))
            if _REGISTER_LINK_TEXT_RE.search(text) or _REGISTER_LINK_TEXT_RE.search(
                href
            ):
                preferred_links.append(href)
            else:
                fallback_links.append(href)
    if preferred_links:
        return preferred_links[0]
    if fallback_links:
        return fallback_links[0]
    return None


def _parse_listing_page(html: str, page_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    programs: list[dict] = []
    seen_urls: set[str] = set()

    for category in soup.select(".category"):
        category_name_node = category.select_one(".category-name")
        category_name = _clean_text(
            category_name_node.get_text(" ", strip=True) if category_name_node else ""
        )
        for link in category.select('a[href*="program_details.aspx?ProgramID="]'):
            detail_url = urljoin(page_url, link.get("href", ""))
            if not detail_url or detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)
            programs.append(
                {
                    "category_name": category_name,
                    "program_name": _clean_text(link.get_text(" ", strip=True)),
                    "detail_url": detail_url,
                }
            )

    return programs


def _parse_datetime_cell(date_cell: Tag, base_url: str) -> dict:
    raw_text = _clean_text(date_cell.get_text(" ", strip=True))
    date_match = _DATE_RANGE_RE.search(raw_text)
    time_match = _TIME_RANGE_RE.search(raw_text)

    start_date = _parse_mmddyyyy(date_match.group(1)) if date_match else None
    end_date = _parse_mmddyyyy(date_match.group(2)) if date_match else None
    start_time = _parse_clock_time(time_match.group(1)) if time_match else None
    end_time = _parse_clock_time(time_match.group(2)) if time_match else None

    facility_link = date_cell.find(
        "a", href=lambda href: href and "facilities/details.aspx" in href
    )
    facility_name = (
        _clean_text(facility_link.get_text(" ", strip=True)) if facility_link else None
    )
    facility_url = urljoin(base_url, facility_link["href"]) if facility_link else None

    return {
        "start_date": start_date,
        "end_date": end_date,
        "start_time": start_time,
        "end_time": end_time,
        "facility_name": facility_name,
        "facility_url": facility_url,
        "date_time_text": raw_text,
    }


def _parse_session_rows(table: Optional[Tag], base_url: str) -> list[dict]:
    if table is None:
        return []

    sessions: list[dict] = []
    current_activity_anchor_id: Optional[str] = None

    for row in table.select("tbody tr"):
        classes = set(row.get("class") or [])
        if "spc" in classes:
            anchor = row.find("a", attrs={"name": True})
            current_activity_anchor_id = anchor.get("name") if anchor else None
            continue

        if "center" not in classes or "nobord" not in classes:
            continue

        register_cell = row.find("td", attrs={"data-title": "Register"})
        activity_cell = row.find("td", attrs={"data-title": "Activity"})
        ages_cell = row.find("td", attrs={"data-title": "Ages"})
        grades_cell = row.find("td", attrs={"data-title": "Grades"})
        days_cell = row.find("td", attrs={"data-title": "Days"})
        date_cell = row.find("td", attrs={"data-title": "Date/Time"})
        fees_cell = row.find("td", attrs={"data-title": "Fees"})

        if not all([activity_cell, date_cell, fees_cell]):
            continue

        register_link = register_cell.find("a", href=True) if register_cell else None
        register_text = (
            _clean_text(register_cell.get_text(" ", strip=True))
            if register_cell
            else ""
        )
        registration_url = (
            urljoin(base_url, register_link["href"]) if register_link else None
        )

        activity_title = _clean_text(activity_cell.get_text(" ", strip=True))
        age_text = _clean_text(ages_cell.get_text(" ", strip=True)) if ages_cell else ""
        grade_text = (
            _clean_text(grades_cell.get_text(" ", strip=True)) if grades_cell else ""
        )
        days_text = (
            _clean_text(days_cell.get_text(" ", strip=True)) if days_cell else ""
        )
        fee_text = _clean_text(fees_cell.get_text(" ", strip=True))

        date_parts = _parse_datetime_cell(date_cell, base_url)

        note_row = row.find_next_sibling("tr")
        note_text = ""
        if note_row and "notes" in (note_row.get("class") or []):
            note_text = _clean_text(note_row.get_text(" ", strip=True))

        activity_id = (
            _extract_query_param(registration_url, "aID")
            or _extract_query_param(date_parts.get("facility_url"), "ActivityID")
            or current_activity_anchor_id
        )

        sessions.append(
            {
                "activity_id": activity_id,
                "activity_title": activity_title,
                "age_text": age_text,
                "grade_text": grade_text,
                "days_text": days_text,
                "register_text": register_text,
                "registration_url": registration_url,
                "fee_text": fee_text,
                "note_text": note_text,
                **date_parts,
            }
        )

    return sessions


def _parse_program_detail(html: str, detail_url: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    description_node = soup.select_one("#Content_lblDescription")
    table = soup.select_one("#no-more-tables")
    program_name_node = soup.select_one("#Content_lblProgramName")

    return {
        "program_name": _clean_text(
            program_name_node.get_text(" ", strip=True) if program_name_node else ""
        ),
        "description_text": _clean_text(
            description_node.get_text(" ", strip=True) if description_node else ""
        ),
        "external_registration_url": _extract_external_registration_url(
            description_node, base_url
        ),
        "sessions": _parse_session_rows(table, base_url),
        "detail_url": detail_url,
    }


def _infer_class_category(category_name: str, title: str) -> str:
    combined = f"{category_name} {title}".lower()
    if any(keyword in combined for keyword in _SPORT_KEYWORDS):
        return "sports"
    if any(keyword in combined for keyword in _ARTS_KEYWORDS):
        return "arts"
    if any(keyword in combined for keyword in _STEM_KEYWORDS):
        return "education"
    return "mixed"


def _infer_subcategory(category_name: str, title: str) -> str:
    combined = f"{category_name} {title}".lower()
    if "camp" in combined:
        return "camp"
    if "care" in combined:
        return "care"
    return "class"


def _build_tags(
    category_name: str,
    title: str,
    register_text: str,
    age_tags: list[str],
) -> list[str]:
    combined = f"{category_name} {title}".lower()
    tags: list[str] = []
    if age_tags or _FAMILY_SIGNAL_RE.search(combined):
        tags.extend(["kids", "family-friendly"])
    if "no registration required" not in register_text.lower():
        tags.append("rsvp-required")
    if "camp" in combined:
        tags.append("seasonal")
    if any(keyword in combined for keyword in _STEM_KEYWORDS):
        tags.extend(["educational", "education"])
    if any(keyword in combined for keyword in _ARTS_KEYWORDS):
        tags.append("arts")
    if any(keyword in combined for keyword in _SPORT_KEYWORDS):
        tags.append("sports")
    tags.extend(age_tags)
    return sorted({tag for tag in tags if tag})


def _build_title(session_title: str, venue_name: str) -> str:
    if not session_title:
        return venue_name
    lower_title = session_title.lower()
    lower_venue = venue_name.lower()
    if lower_venue in lower_title:
        return session_title
    return f"{session_title} at {venue_name}"


def _build_description(program_description: str, session: dict) -> Optional[str]:
    parts: list[str] = []
    if program_description:
        parts.append(program_description)
    meta_parts: list[str] = []
    if session.get("age_text") and session["age_text"].upper() != "N/A":
        meta_parts.append(f"Ages: {session['age_text']}")
    if session.get("grade_text") and session["grade_text"].upper() != "N/A":
        meta_parts.append(f"Grades: {session['grade_text']}")
    if session.get("days_text") and session["days_text"].upper() != "N/A":
        meta_parts.append(f"Days: {session['days_text']}")
    if session.get("fee_text"):
        meta_parts.append(f"Fees: {session['fee_text']}")
    if session.get("facility_name"):
        meta_parts.append(f"Location: {session['facility_name']}")
    if meta_parts:
        parts.append(" ".join(meta_parts))
    if session.get("note_text"):
        parts.append(session["note_text"])

    description = _clean_text(" ".join(parts))
    return description[:1000] if description else None


def _choose_ticket_url(
    session: dict,
    external_registration_url: Optional[str],
    detail_url: str,
) -> str:
    register_text = (session.get("register_text") or "").lower()
    registration_url = session.get("registration_url")

    if (
        any(
            token in register_text
            for token in [
                "register at",
                "register through",
                "consult",
                "click",
            ]
        )
        and external_registration_url
    ):
        return external_registration_url
    if registration_url:
        return registration_url
    if external_registration_url:
        return external_registration_url
    return detail_url


def _resolve_venue_data(config: dict, facility_name: Optional[str]) -> dict:
    default_venue = dict(config["venue"])
    facility_overrides = config.get("facility_overrides") or {}
    if not facility_name:
        return default_venue

    override = facility_overrides.get(facility_name.lower().strip())
    if override:
        return dict(override)
    return default_venue


def is_family_relevant_session(
    category_name: str,
    program_name: str,
    program_description: str,
    session: dict,
    age_min: Optional[int],
    age_max: Optional[int],
) -> bool:
    combined = " ".join(
        [
            category_name,
            program_name,
            program_description,
            session.get("activity_title") or "",
            session.get("register_text") or "",
            session.get("age_text") or "",
        ]
    )

    if age_min is not None and age_min >= 18:
        return False
    if age_max is not None and age_max < 18:
        return True
    if age_min is not None and age_min < 18:
        return True
    if _ADULT_SIGNAL_RE.search(combined):
        return False
    return bool(_FAMILY_SIGNAL_RE.search(combined))


def _build_event_record(
    *,
    source_id: int,
    venue_id: int,
    venue_name: str,
    category_name: str,
    program_detail: dict,
    session: dict,
) -> dict:
    age_min, age_max, age_tags = _parse_age_range(session.get("age_text") or "")
    price_min, price_max, is_free = _parse_price_text(session.get("fee_text") or "")

    title = _build_title(session["activity_title"], venue_name)
    hash_key = (
        session.get("start_date")
        or session.get("activity_id")
        or session.get("date_time_text")
    )
    if session.get("activity_id"):
        hash_key = f"{hash_key}|{session['activity_id']}"
    content_hash = generate_content_hash(title, venue_name, hash_key)

    record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": _build_description(program_detail["description_text"], session),
        "start_date": session["start_date"],
        "start_time": session.get("start_time"),
        "end_date": session.get("end_date"),
        "end_time": session.get("end_time"),
        "is_all_day": not (
            bool(session.get("start_time")) or bool(session.get("end_time"))
        ),
        "category": "programs",
        "subcategory": _infer_subcategory(category_name, session["activity_title"]),
        "tags": _build_tags(
            category_name,
            session["activity_title"],
            session.get("register_text") or "",
            age_tags,
        ),
        "price_min": price_min,
        "price_max": price_max,
        "price_note": session.get("fee_text") or None,
        "is_free": is_free,
        "source_url": program_detail["detail_url"],
        "ticket_url": _choose_ticket_url(
            session,
            program_detail.get("external_registration_url"),
            program_detail["detail_url"],
        ),
        "image_url": None,
        "raw_text": " | ".join(
            part
            for part in [
                program_detail["program_name"],
                session.get("activity_title"),
                category_name,
                session.get("age_text"),
                session.get("grade_text"),
                session.get("days_text"),
                session.get("date_time_text"),
                session.get("fee_text"),
                session.get("register_text"),
            ]
            if part
        ),
        "extraction_confidence": 0.92,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
        "is_class": True,
        "class_category": _infer_class_category(
            category_name, session["activity_title"]
        ),
    }
    if age_min is not None:
        record["age_min"] = age_min
    if age_max is not None:
        record["age_max"] = age_max
    return record


def crawl_myrec(source: dict, config: dict) -> tuple[int, int, int]:
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    base_url = config["base_url"].rstrip("/")
    listing_url = config["activities_url"]

    listing_soup = _get_soup(listing_url, session)
    if listing_soup is None:
        return 0, 0, 0

    programs = _parse_listing_page(str(listing_soup), listing_url)
    if not programs:
        logger.warning("[myrec] No program detail links found for %s", listing_url)
        return 0, 0, 0

    venue_cache: dict[str, int] = {}
    default_venue_data = dict(config["venue"])
    default_venue_id = get_or_create_venue(default_venue_data)
    venue_cache[default_venue_data["name"].lower().strip()] = default_venue_id

    events_found = 0
    events_new = 0
    events_updated = 0
    today = datetime.now().date()

    for program in programs:
        time.sleep(REQUEST_DELAY)
        detail_soup = _get_soup(program["detail_url"], session)
        if detail_soup is None:
            continue

        detail = _parse_program_detail(
            str(detail_soup), program["detail_url"], base_url
        )
        if not detail["sessions"]:
            logger.debug("[myrec] No session rows for %s", program["detail_url"])
            continue

        for session_row in detail["sessions"]:
            start_date = session_row.get("start_date")
            if not start_date:
                continue

            age_min, age_max, _ = _parse_age_range(session_row.get("age_text") or "")
            include_predicate = config.get("include_session")
            if include_predicate and not include_predicate(
                program,
                detail,
                session_row,
                age_min,
                age_max,
            ):
                continue

            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                continue

            end_date = session_row.get("end_date")
            if end_date:
                try:
                    if datetime.strptime(end_date, "%Y-%m-%d").date() < today:
                        continue
                except ValueError:
                    pass
            elif start_dt < today:
                continue

            facility_name = session_row.get("facility_name")
            venue_data = _resolve_venue_data(config, facility_name)
            venue_key = (facility_name or venue_data["name"]).lower().strip()
            if venue_key not in venue_cache:
                venue_cache[venue_key] = get_or_create_venue(venue_data)

            venue_name = venue_data["name"]
            event_record = _build_event_record(
                source_id=source["id"],
                venue_id=venue_cache[venue_key],
                venue_name=venue_name,
                category_name=program["category_name"],
                program_detail=detail,
                session=session_row,
            )

            events_found += 1
            existing = find_event_by_hash(event_record["content_hash"])
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record)
                events_new += 1
            except Exception as exc:
                logger.error(
                    "[myrec] Failed to insert %s from %s: %s",
                    event_record["title"],
                    source.get("slug"),
                    exc,
                )

    logger.info(
        "[myrec] %s complete: %d found, %d new, %d updated",
        source.get("slug"),
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
