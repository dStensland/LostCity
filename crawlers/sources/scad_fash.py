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
    get_or_create_place,
    writes_enabled,
)
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import extract_images_from_page

try:
    from pypdf import PdfReader

    HAS_PYPDF = True
except Exception:
    PdfReader = None
    HAS_PYPDF = False

logger = logging.getLogger(__name__)

BASE_URL = "https://www.scadfash.org"
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

PLACE_DATA = {
    "name": "SCAD FASH Museum of Fashion + Film",
    "slug": "scad-fash",
    "address": "1600 Peachtree St NW",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "place_type": "museum",
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
    exhibitions=True,
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
            "place_id": venue_id,
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
            "place_id": venue_id,
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
        client.table("places")
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
        client.table("places").update(merged_updates).eq("id", venue_id).execute()
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


def _normalize_month_abbrev(text: str) -> str:
    """Normalize abbreviated months with trailing periods (SEPT. -> Sep, OCT. -> Oct)."""
    abbrevs = {
        "JAN.": "Jan", "FEB.": "Feb", "MAR.": "Mar", "APR.": "Apr",
        "MAY.": "May", "JUN.": "Jun", "JUL.": "Jul", "AUG.": "Aug",
        "SEPT.": "Sep", "SEP.": "Sep", "OCT.": "Oct", "NOV.": "Nov", "DEC.": "Dec",
    }
    for abbrev, replacement in abbrevs.items():
        text = re.sub(re.escape(abbrev), replacement, text, flags=re.IGNORECASE)
    return text


def parse_date(date_text: str) -> Optional[str]:
    """
    Parse date from various formats used by scadfash.org.
    Examples: 'April 16, 2026', 'OCT. 15, 2025', 'MARCH 14', 'Sept. 7, 2025'
    """
    date_text = _normalize_month_abbrev(date_text.strip())
    now = datetime.now()
    year = now.year

    # Try "Month DD, YYYY" — full or abbreviated month
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            dt = datetime.strptime(date_text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Try "Month DD" without year — assume current year, advance if past
    for fmt in ("%B %d", "%b %d"):
        try:
            dt = datetime.strptime(date_text, fmt)
            dt = dt.replace(year=year)
            if dt.date() < now.date():
                dt = dt.replace(year=year + 1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def parse_exhibition_date_range(range_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date range string like 'APRIL 16, 2026 - AUG. 23, 2026'
    or 'MARCH 14 - SEPT. 7, 2025'.
    Returns (start_date, end_date) as YYYY-MM-DD strings.
    """
    normalized = _normalize_month_abbrev(range_text.strip())
    # Split on dash surrounded by optional spaces; avoid splitting on hyphens in month names
    parts = re.split(r"\s*[-\u2013\u2014]\s*", normalized, maxsplit=1)
    if len(parts) != 2:
        return None, None

    start_raw, end_raw = parts[0].strip(), parts[1].strip()

    # If start has no year but end does, carry the year over to start
    start_has_year = bool(re.search(r"\d{4}", start_raw))
    end_has_year = bool(re.search(r"\d{4}", end_raw))
    if not start_has_year and end_has_year:
        year_match = re.search(r"\d{4}", end_raw)
        if year_match:
            start_raw = f"{start_raw}, {year_match.group()}"

    return parse_date(start_raw), parse_date(end_raw)


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


def _parse_exhibition_links(page) -> list[dict]:
    """
    Extract exhibition records from scadfash.org/exhibitions by querying
    anchor elements that link to individual exhibition pages.

    The page structure is: each exhibition is an <a href="/exhibitions/slug">
    whose text content contains the title and a date range (in either order).
    Example link texts:
        "APRIL 16, 2026 - AUG. 23, 2026\n'DIOR: CRAFTING FASHION'"
        "'ANDRÉ LEON TALLEY: STYLE IS FOREVER'\nOCT. 15, 2025 - MARCH 1, 2026"
    """
    date_range_pattern = re.compile(
        r"^(?:"
        r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\.?\s+\d{1,2}(?:,\s*\d{4})?)"
        r"\s*[-\u2013\u2014]\s*"
        r"(?:"
        r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
        r"Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        r"\.?\s+\d{1,2}(?:,\s*\d{4})?)"
        r"$",
        re.IGNORECASE,
    )

    links = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('a[href*="/exhibitions/"]')).map(a => ({
            href: a.href,
            text: a.innerText.trim(),
        }));
    }""")

    results = []
    for link in links:
        href = link.get("href", "")
        raw_text = link.get("text", "").strip()
        if not raw_text or not href:
            continue

        # Split on newline to separate the two data elements
        parts = [p.strip() for p in raw_text.split("\n") if p.strip()]
        if not parts:
            continue

        title = None
        date_range_str = None

        for part in parts:
            if date_range_pattern.match(part):
                date_range_str = part
            elif len(part) > 3:
                title = part.strip("'\"").strip()

        if not title or not date_range_str:
            # Fallback: if only one part, it might be title-only (no date in link text)
            continue

        start_date, end_date = parse_exhibition_date_range(date_range_str)
        if not start_date:
            logger.debug("SCAD FASH: could not parse date range %r for %r", date_range_str, title)
            continue

        results.append({
            "title": title,
            "start_date": start_date,
            "end_date": end_date,
            "source_url": href,
            "date_range_raw": date_range_str,
        })

    return results


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl SCAD FASH Museum exhibitions using Playwright."""
    source_id = source["id"]
    portal_id = source.get("portal_id")
    events_found = 0
    events_new = 0
    events_updated = 0
    exhibition_envelope = TypedEntityEnvelope()
    today = datetime.now().date()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # ----------------------------------------------------------------
            # 0. Homepage — extract og:image and meta description for venue.
            # ----------------------------------------------------------------
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
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
                        PLACE_DATA["image_url"] = og_image
                        logger.debug("SCAD FASH: og:image = %s", og_image)
                    if og_desc:
                        PLACE_DATA["description"] = og_desc
                        logger.debug("SCAD FASH: og:description captured")
                else:
                    logger.debug("SCAD FASH: homepage is Cloudflare-blocked; using catalog description")
            except Exception as _meta_exc:
                logger.debug("SCAD FASH: could not extract og meta from homepage: %s", _meta_exc)

            venue_id = get_or_create_place(PLACE_DATA)

            # ----------------------------------------------------------------
            # 1. Exhibitions page — parse via anchor elements.
            # ----------------------------------------------------------------
            logger.info("Fetching SCAD FASH exhibitions: %s", EXHIBITIONS_URL)
            try:
                page.goto(EXHIBITIONS_URL, wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(3000)
                for _ in range(3):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(800)
            except Exception as e:
                logger.warning("SCAD FASH: failed to load exhibitions page: %s", e)
                browser.close()
                return events_found, events_new, events_updated

            page_title = page.title() or ""
            body_text = page.inner_text("body")
            if _is_cloudflare_challenge_text(f"{page_title}\n{body_text}"):
                logger.warning(
                    "SCAD FASH blocked by Cloudflare at %s; applying catalog fallback",
                    EXHIBITIONS_URL,
                )
                _apply_catalog_destination_fallback(venue_id)
                browser.close()
                return events_found, events_new, events_updated

            # Extract images from listing page for image_map lookup
            image_map = extract_images_from_page(page)

            raw_exhibitions = _parse_exhibition_links(page)
            logger.info("SCAD FASH: found %d exhibition links on listings page", len(raw_exhibitions))

            # ----------------------------------------------------------------
            # 2. For each exhibition, optionally visit detail page for richer
            #    description and image, then build exhibition record.
            # ----------------------------------------------------------------
            seen_titles: set[str] = set()
            for ex in raw_exhibitions:
                title = ex["title"]
                start_date = ex["start_date"]
                end_date = ex["end_date"]
                detail_url = ex["source_url"]

                # Skip past exhibitions — closing date already passed
                if end_date and end_date < today.strftime("%Y-%m-%d"):
                    logger.debug("SCAD FASH: skipping past exhibition %r (closed %s)", title, end_date)
                    continue

                if title in seen_titles:
                    continue
                seen_titles.add(title)

                events_found += 1

                # Fetch detail page for description and image
                description = None
                detail_image = None
                try:
                    page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(1500)
                    detail_body = page.inner_text("body")
                    detail_image = page.evaluate(
                        "() => { const m = document.querySelector('meta[property=\"og:image\"]'); return m ? m.content : null; }"
                    )
                    # Extract description: long paragraphs after the title/date block
                    detail_lines = [l.strip() for l in detail_body.split("\n") if l.strip()]
                    skip_until = False
                    for dl in detail_lines:
                        # Skip navigation and header lines
                        if dl.upper() in (title.upper(), ex["date_range_raw"].upper()):
                            skip_until = True
                            continue
                        if skip_until and len(dl) > 80 and not re.match(
                            r"^(CONTACT|HOURS|SOCIAL|SUPPORT|LOCATION|SCAD\s)", dl, re.IGNORECASE
                        ):
                            description = dl[:800]
                            break
                except Exception as _det_exc:
                    logger.debug("SCAD FASH: detail page fetch failed for %r: %s", title, _det_exc)

                image_url = detail_image or image_map.get(title)
                category, subcategory, tags = determine_category(title, description or "")

                ex_record, ex_artists = build_exhibition_record(
                    title=title,
                    venue_id=venue_id,
                    source_id=source_id,
                    opening_date=start_date,
                    closing_date=end_date,
                    venue_name=PLACE_DATA["name"],
                    description=description,
                    image_url=image_url,
                    source_url=detail_url,
                    portal_id=portal_id,
                    admission_type="ticketed",
                    tags=["fashion", "film", "museum", "design", "midtown", "exhibition"],
                )
                if ex_artists:
                    ex_record["artists"] = ex_artists
                exhibition_envelope.add("exhibitions", ex_record)
                events_new += 1
                logger.info("SCAD FASH: queued exhibition %r (%s – %s)", title, start_date, end_date or "?")

            browser.close()

            if exhibition_envelope.exhibitions:
                persist_result = persist_typed_entity_envelope(exhibition_envelope)
                skipped = persist_result.skipped.get("exhibitions", 0)
                if skipped:
                    logger.warning("SCAD FASH: skipped %d exhibition rows", skipped)

        logger.info(
            "SCAD FASH Museum crawl complete: %d found, %d new, %d updated",
            events_found, events_new, events_updated,
        )

    except Exception as e:
        logger.error("Failed to crawl SCAD FASH Museum: %s", e)
        raise

    return events_found, events_new, events_updated
