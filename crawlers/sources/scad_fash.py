"""
Crawler for SCAD FASH Museum of Fashion + Film (scadfash.org).

Fashion and film museum in Midtown Atlanta operated by SCAD.

Primary path: Playwright against live events/exhibitions pages.
Fallback path: official SCAD catalog PDF for destination intelligence when
Cloudflare blocks runtime access to the live site.
"""

from __future__ import annotations

from io import BytesIO
import re
import logging
from datetime import datetime
from typing import Optional

import requests
from playwright.sync_api import sync_playwright

from db import (
    get_client,
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
    writes_enabled,
)
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from utils import (
    extract_images_from_page, extract_event_links, find_event_url,
    enrich_event_record, parse_date_range,
)

try:
    from pypdf import PdfReader

    HAS_PYPDF = True
except Exception:
    PdfReader = None
    HAS_PYPDF = False

logger = logging.getLogger(__name__)

BASE_URL = "https://scadfash.org"
EVENTS_URL = f"{BASE_URL}/events"
EXHIBITIONS_URL = f"{BASE_URL}/exhibitions"
CATALOG_URL = "https://www.scad.edu/sites/default/files/PDF/scad-2025-2026-accessible-catalog.pdf"
CATALOG_SOURCE_NOTE = "Official SCAD 2025-2026 catalog PDF fallback"

CATALOG_SHORT_DESCRIPTION = (
    "SCAD FASH Museum of Fashion + Film celebrates fashion as a universal "
    "language and film as an immersive medium, connecting visitors with "
    "internationally renowned designers, filmmakers, and photographers."
)
CATALOG_DESCRIPTION = (
    "Official SCAD catalog copy describes SCAD FASH Museum of Fashion + Film "
    "as a destination for exhibitions, films, and events that explore the "
    "legacies of fashion history and inspire contemporary creative work."
)
CATALOG_EXHIBITION_CANDIDATES = [
    "Christian Dior: Jardins Rêvés",
    "Campbell Addy: The Stillness of Elegance",
    "Jeanne Lanvin: Haute Couture Heritage",
    "Sandy Powell’s Dressing the Part: Costume Design for Film",
    "Imane Ayissi: From Africa to the World",
    "Manish Arora: Life Is Beautiful",
    "Entering Modernity: 1920s Fashion from the Parodi Costume Collection",
    "Cristóbal Balenciaga: Master of Tailoring",
    "The Blonds: Glamour, Fashion, Fantasy",
    "Julien Fournié: Haute Couture Un Point C’est Tout!",
    "Madame Grès: The Art of Draping",
    "Isabel Toledo: A Love Letter",
    "Ruth E. Carter: Afrofuturism in Costume Design",
    "Robert Wun: Between Reality and Fantasy",
]

VENUE_DATA = {
    "name": "SCAD FASH Museum of Fashion + Film",
    "slug": "scad-fash",
    "address": "1600 Peachtree St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "museum",
    "spot_type": "museum",
    "lat": 33.7926,
    "lng": -84.3862,
    "website": BASE_URL,
    # Description sourced from official SCAD catalog (CATALOG_SHORT_DESCRIPTION constant).
    # og:image is extracted dynamically when the live site is reachable (not Cloudflare-blocked).
    "description": CATALOG_SHORT_DESCRIPTION,
    # Hours verified 2026-03-11 from scadfash.org/visit
    "hours": {
        "monday": "closed",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    # Admission: typically $15 adult, $10 student/senior
    "vibes": ["fashion", "cultural", "art", "midtown"],
}

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destination_details=True,
    venue_features=True,
)


def _is_cloudflare_challenge_text(text: str) -> bool:
    """Detect Cloudflare interstitials so blocked pages don't read as zero inventory."""
    normalized = (text or "").lower()
    return (
        "just a moment" in normalized
        or "enable javascript and cookies to continue" in normalized
        or "attention required" in normalized
        or "cloudflare" in normalized
    )


def _normalize_catalog_text(text: str) -> str:
    value = (text or "").replace("\u00a0", " ").replace("\u2011", "-")
    return re.sub(r"\s+", " ", value).strip()


def _extract_between(text: str, start_marker: str, end_marker: str) -> str:
    start_idx = text.find(start_marker)
    if start_idx < 0:
        return ""
    start_idx += len(start_marker)
    if not end_marker:
        return text[start_idx:].strip()
    end_idx = text.find(end_marker, start_idx)
    if end_idx < 0:
        return text[start_idx:].strip()
    return text[start_idx:end_idx].strip()


def _extract_catalog_recent_examples(section_text: str, limit: int = 5) -> list[str]:
    normalized = _normalize_catalog_text(section_text).lower()
    examples: list[str] = []
    for title in CATALOG_EXHIBITION_CANDIDATES:
        if title.lower() in normalized:
            examples.append(title)
        if len(examples) >= limit:
            break
    return examples


def _extract_catalog_destination_fields_from_text(catalog_text: str) -> Optional[dict]:
    normalized = _normalize_catalog_text(catalog_text)
    fash_section = _extract_between(
        normalized,
        "SCAD FASH MUSEUMS",
        "SCAD FASH exhibitions like",
    )
    if not fash_section:
        return None

    recent_section = _extract_between(
        fash_section,
        "RECENT SCAD FASH EXHIBITIONS",
        "",
    )
    examples = _extract_catalog_recent_examples(recent_section)

    planning_note = (
        "Official SCAD 2025-2026 catalog describes SCAD FASH as a museum for "
        "fashion and film with exhibitions, films, and events tied to fashion "
        "history and contemporary design."
    )
    if examples:
        planning_note += (
            " Recent exhibitions highlighted by SCAD include "
            + ", ".join(examples[:-1])
            + ("," if len(examples) > 2 else "")
            + (" and " + examples[-1] if len(examples) > 1 else examples[0])
            + "."
        )
    planning_note += (
        " Live SCAD event and exhibition pages are currently Cloudflare-blocked "
        "from the crawler runtime, so this venue is treated as destination-first "
        "until a fetchable public calendar is available."
    )

    return {
        "website": BASE_URL,
        "short_description": CATALOG_SHORT_DESCRIPTION,
        "description": CATALOG_DESCRIPTION,
        "planning_notes": planning_note,
        "recent_exhibition_examples": examples,
    }


def _fetch_catalog_destination_fields() -> Optional[dict]:
    if not HAS_PYPDF:
        logger.warning("pypdf not installed; SCAD catalog fallback unavailable")
        return None

    try:
        response = requests.get(CATALOG_URL, timeout=45)
        response.raise_for_status()
        reader = PdfReader(BytesIO(response.content))
        pages: list[str] = []
        for page in reader.pages[37:41]:
            try:
                pages.append(page.extract_text() or "")
            except Exception:
                continue
        return _extract_catalog_destination_fields_from_text("\n".join(pages))
    except Exception as exc:
        logger.warning("Failed to fetch SCAD catalog PDF fallback: %s", exc)
        return None


def _build_catalog_destination_envelope(venue_id: int, updates: dict) -> TypedEntityEnvelope:
    """Project SCAD catalog fallback data into shared destination-richness lanes."""
    examples = updates.get("recent_exhibition_examples") or []
    envelope = TypedEntityEnvelope()

    envelope.add(
        "destination_details",
        {
            "venue_id": venue_id,
            "destination_type": "museum",
            "commitment_tier": "halfday",
            "primary_activity": "fashion and film exhibitions",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-friendly", "cold-weather"],
            "practical_notes": updates.get("planning_notes"),
            "source_url": CATALOG_URL,
            "metadata": {
                "source_note": CATALOG_SOURCE_NOTE,
                "recent_exhibition_examples": examples,
            },
        },
    )

    feature_description = (
        "SCAD describes the museum as a destination for fashion and film exhibitions "
        "that connect visitors with internationally renowned designers, filmmakers, "
        "and photographers."
    )
    if examples:
        feature_description += " Recent highlighted exhibitions include " + ", ".join(examples) + "."

    envelope.add(
        "venue_features",
        {
            "venue_id": venue_id,
            "slug": "rotating-fashion-and-film-exhibitions",
            "title": "Rotating fashion and film exhibitions",
            "feature_type": "experience",
            "description": feature_description,
            "url": CATALOG_URL,
            "sort_order": 10,
        },
    )

    return envelope


def _apply_catalog_destination_fallback(venue_id: int) -> bool:
    updates = _fetch_catalog_destination_fields()
    if not updates:
        return False

    client = get_client()
    current_res = (
        client.table("venues")
        .select("website,description,short_description,planning_notes")
        .eq("id", venue_id)
        .limit(1)
        .execute()
    )
    current = current_res.data[0] if current_res.data else {}

    merged_updates: dict[str, str] = {}
    if (current.get("website") or "").startswith("http://") or not current.get("website"):
        merged_updates["website"] = updates["website"]
    if not current.get("short_description"):
        merged_updates["short_description"] = updates["short_description"]
    if not current.get("description"):
        merged_updates["description"] = updates["description"]

    existing_planning = (current.get("planning_notes") or "").strip()
    if not existing_planning or CATALOG_SOURCE_NOTE.lower() in existing_planning.lower():
        merged_updates["planning_notes"] = (
            f"{updates['planning_notes']} Source: {CATALOG_SOURCE_NOTE}."
        )
        merged_updates["planning_last_verified_at"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    venue_updated = False
    if not merged_updates:
        logger.info("SCAD FASH catalog fallback found no missing venue fields to update")
    elif not writes_enabled():
        logger.info("SCAD FASH catalog fallback would update venue %s with %s", venue_id, sorted(merged_updates))
        venue_updated = True
    else:
        client.table("venues").update(merged_updates).eq("id", venue_id).execute()
        logger.info("SCAD FASH catalog fallback updated venue %s with %s", venue_id, sorted(merged_updates))
        venue_updated = True

    typed_result = persist_typed_entity_envelope(
        _build_catalog_destination_envelope(venue_id, updates)
    )
    typed_persisted = any(typed_result.persisted.values())
    if typed_persisted:
        logger.info(
            "SCAD FASH catalog fallback persisted destination richness: %s",
            typed_result.persisted,
        )
    elif typed_result.skipped:
        logger.warning(
            "SCAD FASH catalog fallback skipped destination richness: %s",
            typed_result.skipped,
        )

    return venue_updated or typed_persisted


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats.
    Examples: 'February 15', 'Feb 15, 2026', 'March 3'
    """
    date_text = date_text.strip()
    now = datetime.now()
    year = now.year

    # Try "February 15, 2026" format
    try:
        dt = datetime.strptime(date_text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "February 15" format
    try:
        dt = datetime.strptime(date_text, "%B %d")
        dt = dt.replace(year=year)
        if dt.date() < now.date():
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try "Feb 15" format
    try:
        dt = datetime.strptime(date_text, "%b %d")
        dt = dt.replace(year=year)
        if dt.date() < now.date():
            dt = dt.replace(year=year + 1)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    return None


def parse_time(time_text: str) -> Optional[str]:
    """Parse time from formats like '6:00 PM', '2 PM', '10:30 AM'."""
    if not time_text:
        return None

    time_text = time_text.strip()

    # Pattern: "6:00 PM" or "6 PM"
    match = re.search(
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
        time_text,
        re.IGNORECASE
    )
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return f"{hour:02d}:{minute:02d}"

    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category, subcategory, and tags based on event content."""
    text = f"{title} {description}".lower()
    tags = ["fashion", "film", "museum", "design", "midtown"]

    if any(w in text for w in ["exhibition", "exhibit", "opening", "gallery"]):
        return "museums", "exhibition", tags + ["exhibition"]
    if any(w in text for w in ["film", "screening", "movie"]):
        return "film", "screening", tags + ["screening"]
    if any(w in text for w in ["fashion show", "runway"]):
        return "museums", "fashion", tags + ["fashion-show"]
    if any(w in text for w in ["workshop", "class", "studio"]):
        return "museums", "workshop", tags + ["workshop", "class"]
    if any(w in text for w in ["tour", "gallery tour"]):
        return "museums", "tour", tags + ["tour"]
    if any(w in text for w in ["lecture", "talk", "discussion", "panel"]):
        return "education", "lecture", tags + ["lecture", "education"]
    if any(w in text for w in ["reception", "opening reception", "gala"]):
        return "museums", "reception", tags + ["reception", "social"]

    return "museums", "exhibition", tags


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SCAD FASH Museum events using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # ----------------------------------------------------------------
            # 0. Homepage — extract og:image for venue record (best-effort;
            #    Cloudflare may block, which is fine — we fall back to catalog).
            # ----------------------------------------------------------------
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                home_title = page.title() or ""
                home_body = page.inner_text("body")
                if not _is_cloudflare_challenge_text(f"{home_title}\n{home_body}"):
                    og_image = page.evaluate(
                        "() => { const m = document.querySelector('meta[property=\"og:image\"]'); return m ? m.content : null; }"
                    )
                    og_desc = page.evaluate(
                        "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                        "|| document.querySelector('meta[name=\"description\"]'); return m ? m.content : null; }"
                    )
                    if og_image:
                        VENUE_DATA["image_url"] = og_image
                        logger.debug("SCAD FASH: og:image = %s", og_image)
                    if og_desc:
                        VENUE_DATA["description"] = og_desc
                        logger.debug("SCAD FASH: og:description captured")
                else:
                    logger.debug("SCAD FASH: homepage is Cloudflare-blocked; using catalog description")
            except Exception as _meta_exc:
                logger.debug("SCAD FASH: could not extract og meta from homepage: %s", _meta_exc)

            venue_id = get_or_create_venue(VENUE_DATA)
            blocked_urls: list[str] = []

            # Try both events and exhibitions pages
            for url in [EVENTS_URL, EXHIBITIONS_URL]:
                logger.info(f"Fetching SCAD FASH: {url}")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(5000)
                except Exception as e:
                    logger.warning(f"Failed to load {url}: {e}, skipping")
                    continue

                page_title = page.title() or ""
                body_text = page.inner_text("body")
                if _is_cloudflare_challenge_text(f"{page_title}\n{body_text}"):
                    blocked_urls.append(url)
                    logger.warning(
                        "SCAD FASH blocked by Cloudflare challenge at %s; "
                        "treat as source-access failure, not empty feed",
                        url,
                    )
                    continue

                # Extract images from page
                image_map = extract_images_from_page(page)

                # Scroll to load all content
                for _ in range(5):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(1500)

                # Get page text
                lines = [line.strip() for line in body_text.split("\n") if line.strip()]

                # Skip navigation items
                skip_items = [
                    "skip to main",
                    "menu",
                    "home",
                    "about",
                    "exhibitions",
                    "events",
                    "visit",
                    "shop",
                    "support",
                    "calendar",
                    "upcoming",
                    "current",
                    "past",
                    "view all",
                    "learn more",
                ]

                i = 0
                seen_events = set()

                while i < len(lines):
                    line = lines[i]
                    line_lower = line.lower()

                    # Skip nav/UI items
                    if line_lower in skip_items or len(line) < 3:
                        i += 1
                        continue

                    # Look for date patterns
                    date_match = re.match(
                        r"^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?$",
                        line,
                        re.IGNORECASE,
                    )

                    if date_match:
                        start_date = parse_date(line)
                        if not start_date:
                            i += 1
                            continue

                        # Look for title and time in surrounding lines
                        title = None
                        start_time = None
                        description = None

                        # Check previous lines for title
                        for offset in [-2, -1]:
                            idx = i + offset
                            if idx >= 0:
                                potential_title = lines[idx].strip()
                                if len(potential_title) > 5 and potential_title.lower() not in skip_items:
                                    if not re.match(r"^(January|February|March)", potential_title, re.IGNORECASE):
                                        title = potential_title
                                        break

                        # Check next lines for time and description
                        for offset in [1, 2, 3, 4]:
                            idx = i + offset
                            if idx < len(lines):
                                check_line = lines[idx].strip()

                                # Check for time
                                if not start_time:
                                    time_result = parse_time(check_line)
                                    if time_result:
                                        start_time = time_result
                                        continue

                                # Check for description
                                if not description and len(check_line) > 30:
                                    if not re.match(r"^(more info|learn more|register|buy tickets|rsvp)", check_line.lower()):
                                        description = check_line[:500]

                        if not title:
                            i += 1
                            continue

                        # Check for duplicates
                        event_key = f"{title}|{start_date}"
                        if event_key in seen_events:
                            i += 1
                            continue
                        seen_events.add(event_key)

                        events_found += 1

                        # Generate content hash
                        content_hash = generate_content_hash(
                            title, "SCAD FASH Museum", start_date
                        )

                        # Check for existing

                        # Determine category
                        category, subcategory, tags = determine_category(title, description or "")

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": start_date,
                            "start_time": start_time,
                            "end_date": None,
                            "end_time": None,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": None,
                            "source_url": url,
                            "ticket_url": url,
                            "image_url": image_map.get(title),
                            "raw_text": f"{title} - {start_date}",
                            "extraction_confidence": 0.83,
                            "is_recurring": False,
                            "recurrence_rule": None,
                            "content_hash": content_hash,
                        }

                        # Enrich from detail page
                        enrich_event_record(event_record, source_name="SCAD FASH Museum")

                        # Determine is_free if still unknown
                        if event_record.get("is_free") is None:
                            desc_lower = (event_record.get("description") or "").lower()
                            title_lower = title.lower()
                            combined = f"{title_lower} {desc_lower}"
                            if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                                event_record["is_free"] = True
                                event_record["price_min"] = event_record.get("price_min") or 0
                                event_record["price_max"] = event_record.get("price_max") or 0
                            else:
                                event_record["is_free"] = False

                        # Extract end_date from date range patterns
                        range_text = f"{title} {event_record.get('description') or ''}"
                        _, range_end = parse_date_range(range_text)
                        if range_end:
                            event_record["end_date"] = range_end

                        # Detect exhibits
                        _exhibit_kw = ["exhibit", "exhibition", "on view", "collection", "installation"]
                        _check = f"{title} {event_record.get('description') or ''}".lower()
                        if any(kw in _check for kw in _exhibit_kw):
                            event_record["content_kind"] = "exhibit"
                            event_record["is_all_day"] = True
                            event_record["start_time"] = None

                        existing = find_event_by_hash(content_hash)
                        if existing:
                            smart_update_existing_event(existing, event_record)
                            events_updated += 1
                            i += 1
                            continue

                        try:
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {start_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                    i += 1

            browser.close()

            if events_found == 0 and blocked_urls:
                fallback_applied = _apply_catalog_destination_fallback(venue_id)
                logger.warning(
                    "SCAD FASH produced no events because source access is blocked for %s",
                    blocked_urls,
                )
                if fallback_applied:
                    logger.info(
                        "SCAD FASH used official catalog PDF fallback for destination intelligence"
                    )

        logger.info(
            f"SCAD FASH Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl SCAD FASH Museum: {e}")
        raise

    return events_found, events_new, events_updated
