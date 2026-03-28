"""
Crawler for APEX Museum (African American Panoramic Experience).

Historic museum in Sweet Auburn focusing on African American history and culture.

Location: 135 Auburn Ave NE, Atlanta, GA (Sweet Auburn neighborhood)

Historically APEX programs were exposed through Eventbrite, but as of March 9,
2026 the first-party `events-2026` page is a destination shell without
extractable event records and Eventbrite exposes contradictory series state.
This crawler now fails closed and should be treated as event-optional until a
real first-party feed returns.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from typing import Optional

from bs4 import BeautifulSoup

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from date_utils import normalize_iso_date
from db import get_client, get_or_create_place, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope

logger = logging.getLogger(__name__)

BASE_URL = "https://www.apexmuseum.org"
# APEX Museum Eventbrite search results page
EVENTBRITE_SEARCH_URL = "https://www.eventbrite.com/d/ga--atlanta/apex-museum/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    events=True,
    destinations=True,
    destination_details=True,
    venue_features=True,
    venue_specials=True,
)

PLACE_DATA = {
    "name": "APEX Museum",
    "slug": "apex-museum",
    "address": "135 Auburn Ave NE",
    "neighborhood": "Sweet Auburn",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7536,
    "lng": -84.3867,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    # Admission: $7 adult, $5 student/senior, free under 4
    # Hours verified 2026-03-11 against apexmuseum.org
    "hours": {
        "sunday": "13:00-17:00",
        "monday": "closed",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-17:00",
        "saturday": "10:00-17:00",
    },
    "vibes": [
        "historic",
        "educational",
        "cultural",
        "sweet-auburn",
    ],
}


def _build_destination_envelope(venue_id: int) -> TypedEntityEnvelope:
    envelope = TypedEntityEnvelope()
    envelope.add(
        "destination_details",
        {
            "place_id": venue_id,
            "destination_type": "history_museum",
            "commitment_tier": "hour",
            "primary_activity": "black history museum visit",
            "best_seasons": ["spring", "summer", "fall", "winter"],
            "weather_fit_tags": ["indoor", "rainy-day", "heat-day", "family-daytrip"],
            "parking_type": "street",
            "best_time_of_day": "afternoon",
            "practical_notes": (
                "APEX Museum works best as a compact Sweet Auburn cultural stop rather than a full-day outing, "
                "and is easiest to pair with a neighborhood walk or another downtown-family destination. It is strongest "
                "when a family wants a meaningful shorter cultural stop instead of a giant museum day."
            ),
            "accessibility_notes": (
                "Its indoor footprint keeps the visit lower-friction for families than larger museum campuses, "
                "though the surrounding neighborhood plan may still require some city walking. That makes it better as a stackable stop than as the only activity in the day."
            ),
            "family_suitability": "yes",
            "reservation_required": False,
            "permit_required": False,
            "fee_note": "Admission is modestly priced, with free entry for very young children.",
            "source_url": BASE_URL,
            "metadata": {
                "source_type": "family_destination_enrichment",
                "place_type": "history_museum",
                "city": "atlanta",
            },
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "sweet-auburn-black-history-anchor",
            "title": "Sweet Auburn Black history anchor",
            "feature_type": "amenity",
            "description": "APEX gives families a compact, place-based Black history stop in one of Atlanta's most important historic neighborhoods.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 10,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "compact-history-museum-stop",
            "title": "Compact history museum stop",
            "feature_type": "amenity",
            "description": "The museum's smaller footprint makes it easier to fit into a shorter family culture outing than a larger all-campus museum day.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 20,
        },
    )
    envelope.add(
        "venue_features",
        {
            "place_id": venue_id,
            "slug": "stackable-sweet-auburn-cultural-stop",
            "title": "Stackable Sweet Auburn cultural stop",
            "feature_type": "amenity",
            "description": "APEX works especially well as a shorter family culture stop that can be paired with a Sweet Auburn walk or another downtown destination.",
            "url": BASE_URL,
            "is_free": False,
            "sort_order": 30,
        },
    )
    envelope.add(
        "venue_specials",
        {
            "place_id": venue_id,
            "slug": "children-under-4-free-admission",
            "title": "Children under 4 free admission",
            "description": "APEX keeps the visit materially easier for families with very young kids by offering free admission for children under 4.",
            "price_note": "Children under 4 are free.",
            "is_free": True,
            "source_url": BASE_URL,
            "category": "admission",
        },
    )
    return envelope


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine event category based on title and description."""
    title_lower = title.lower()
    description_lower = description.lower() if description else ""
    combined = f"{title_lower} {description_lower}"

    tags = ["museum", "apex-museum", "sweet-auburn", "educational"]

    # Black History Month events (February)
    if "black history" in combined or "african american history" in combined:
        tags.append("black-history-month")

    # Music events (tribute series, concerts)
    if any(w in combined for w in ["tribute", "concert", "music", "live music", "performance", "jazz", "soul", "blues", "r&b", "gospel"]):
        tags.extend(["live-music"])
        return "music", "concert", tags

    # Art exhibitions
    if any(w in combined for w in ["exhibition", "exhibit", "art show", "gallery", "artist"]):
        return "museums", "exhibition", tags

    # Educational programs
    if any(w in combined for w in ["lecture", "talk", "speaker", "discussion", "panel", "workshop"]):
        return "learning", "lecture", tags

    # Community events
    if any(w in combined for w in ["community", "celebration", "festival", "gathering"]):
        tags.append("community")
        return "community", "cultural", tags

    # Family events
    if any(w in combined for w in ["family", "children", "kids"]):
        tags.append("family-friendly")
        return "family", "educational", tags

    # Default to community/cultural for museum events
    return "community", "cultural", tags


def parse_eventbrite_jsonld(page) -> list[dict]:
    """Extract event data from Eventbrite JSON-LD structured data."""
    events = []

    scripts = page.query_selector_all('script[type="application/ld+json"]')
    for script in scripts:
        try:
            content = script.inner_html()
            data = json.loads(content)

            if isinstance(data, dict) and data.get("@type") == "Event":
                events.append(data)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "Event":
                        events.append(item)
        except (json.JSONDecodeError, Exception):
            continue

    return events


def _normalize_eventbrite_url(url: str) -> str:
    """Strip Eventbrite tracking params so dedupe uses a stable detail URL."""
    return url.split("?", 1)[0]


def _extract_eventbrite_context(html: str) -> Optional[dict]:
    """Extract Eventbrite's embedded app context JSON from page HTML."""
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script"):
        content = script.string or script.get_text() or ""
        if '"pageProps"' not in content or '"basicInfo"' not in content:
            continue
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            continue

        context = data.get("props", {}).get("pageProps", {}).get("context")
        if isinstance(context, dict) and isinstance(context.get("basicInfo"), dict):
            return context

    return None


def _parse_iso_local_datetime(value: Optional[str]) -> tuple[Optional[str], Optional[str], Optional[datetime]]:
    """Parse Eventbrite local ISO timestamps into date/time strings."""
    if not value:
        return None, None, None

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None, None, None

    return parsed.strftime("%Y-%m-%d"), parsed.strftime("%H:%M"), parsed


def _extract_recurrence_rule(*texts: str) -> Optional[str]:
    """Extract a simple human recurrence hint from summary/description text."""
    for text in texts:
        if not text:
            continue
        match = re.search(r"\b(every other\s+[A-Za-z]+|every\s+[A-Za-z]+)\b", text, re.IGNORECASE)
        if match:
            return match.group(1).strip().title()
    return None


def _extract_context_description(context: dict) -> Optional[str]:
    """Build a plain-text description from Eventbrite summary and rich text."""
    basic = context.get("basicInfo", {})
    parts: list[str] = []

    summary = basic.get("summary")
    if summary:
        parts.append(summary.strip())

    modules = context.get("structuredContent", {}).get("modules", [])
    for module in modules:
        if module.get("type") != "text":
            continue
        html = module.get("text") or ""
        text = BeautifulSoup(html, "html.parser").get_text("\n")
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if text and text not in parts:
            parts.append(text)
            break

    if not parts:
        return None

    return "\n\n".join(parts)


def _extract_context_image(context: dict) -> Optional[str]:
    """Return the largest Eventbrite gallery image when present."""
    for image in context.get("gallery", {}).get("images", []):
        if image.get("url"):
            return image["url"]
    return None


def _parse_eventbrite_context_event(
    context: dict,
    *,
    detail_url: str,
    today: Optional[date] = None,
) -> tuple[Optional[dict], Optional[dict], Optional[str]]:
    """Parse Eventbrite context payload into an event record and optional series hint."""
    basic = context.get("basicInfo", {})
    if not basic.get("name"):
        return None, None, "missing_title"

    ref_today = today or date.today()
    sales_status = context.get("salesStatus", {}) or {}
    message_code = sales_status.get("messageCode")
    next_session = context.get("goodToKnow", {}).get("highlights", {}).get("nextAvailableSession")

    if message_code == "event_cancelled":
        if next_session:
            return None, None, "cancelled_series_with_next_session"
        return None, None, "cancelled"

    start_date, start_time, start_dt = _parse_iso_local_datetime(next_session)
    is_recurring = bool(next_session)

    if start_dt is None:
        start_date, start_time, start_dt = _parse_iso_local_datetime(
            basic.get("startDate", {}).get("local")
        )
        is_recurring = bool(basic.get("isSeries"))

    normalized_start_date = normalize_iso_date(start_date, today=ref_today) if start_date else None
    if not normalized_start_date:
        return None, None, "invalid_start_date"

    if start_dt and start_dt.date() < ref_today:
        return None, None, "past_event"

    description = _extract_context_description(context) or f"{basic['name']} at APEX Museum"
    image_url = _extract_context_image(context)
    recurrence_rule = _extract_recurrence_rule(
        basic.get("summary", ""),
        description,
    )

    category, subcategory, tags = determine_category(basic["name"], description)

    event_record = {
        "title": basic["name"],
        "description": description[:1000] if description else None,
        "start_date": normalized_start_date,
        "start_time": start_time,
        "end_date": None,
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": sales_status.get("message"),
        "is_free": bool(basic.get("isFree")),
        "source_url": detail_url,
        "ticket_url": basic.get("url") or detail_url,
        "image_url": image_url,
        "raw_text": f"{basic['name']} - {description[:200] if description else ''}",
        "extraction_confidence": 0.82,
        "is_recurring": is_recurring,
        "recurrence_rule": recurrence_rule,
    }

    series_hint = None
    if is_recurring:
        series_hint = {
            "series_type": "recurring_show",
            "series_title": basic["name"],
            "description": description[:500] if description else None,
        }
        if image_url:
            series_hint["image_url"] = image_url

    return event_record, series_hint, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl APEX Museum events from Eventbrite when usable records still exist."""
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

            venue_id = get_or_create_place(PLACE_DATA)
            persist_typed_entity_envelope(_build_destination_envelope(venue_id))

            # Enrich venue with og:image and og:description from APEX homepage on first pass
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
                og_image = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:image\"]'); "
                    "return m ? m.getAttribute('content') : null; }"
                )
                og_desc = page.evaluate(
                    "() => { const m = document.querySelector('meta[property=\"og:description\"]') "
                    "|| document.querySelector('meta[name=\"description\"]'); "
                    "return m ? m.getAttribute('content') : null; }"
                )
                venue_update: dict = {}
                if og_image:
                    venue_update["image_url"] = og_image
                if og_desc:
                    venue_update["description"] = og_desc[:500]
                if venue_update:
                    get_client().table("places").update(venue_update).eq(
                        "id", venue_id
                    ).execute()
                    logger.info("APEX Museum: enriched venue from homepage og: metadata")
            except Exception as enrich_exc:
                logger.warning("APEX Museum: homepage enrichment failed: %s", enrich_exc)

            logger.info(f"Fetching APEX Museum events from Eventbrite: {EVENTBRITE_SEARCH_URL}")

            try:
                page.goto(EVENTBRITE_SEARCH_URL, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)

                # Find event links that mention APEX Museum
                event_links = page.query_selector_all('a[href*="/e/"]')
                apex_event_urls = set()

                for link in event_links:
                    href = link.get_attribute("href") or ""
                    text = link.inner_text().lower()

                    # Only get APEX Museum specific events
                    if "apex-museum" in href or "apex museum" in text:
                        # Normalize URL
                        if "?" in href:
                            href = href.split("?")[0]
                        apex_event_urls.add(href)

                logger.info(f"Found {len(apex_event_urls)} unique APEX Museum event URLs")
                if not apex_event_urls:
                    logger.warning(
                        "APEX Museum Eventbrite search returned no usable event URLs; "
                        "current first-party events page appears destination-first."
                    )

                # Visit each event page and extract JSON-LD data
                skipped_reasons: dict[str, int] = {}
                for event_url in apex_event_urls:
                    try:
                        event_url = _normalize_eventbrite_url(event_url)
                        logger.info(f"Fetching event: {event_url}")
                        page.goto(event_url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_timeout(2000)

                        event_records: list[tuple[dict, Optional[dict]]] = []
                        context = _extract_eventbrite_context(page.content())
                        if context:
                            parsed_record, series_hint, skip_reason = _parse_eventbrite_context_event(
                                context,
                                detail_url=event_url,
                            )
                            if parsed_record:
                                event_records.append((parsed_record, series_hint))
                            else:
                                if skip_reason:
                                    skipped_reasons[skip_reason] = skipped_reasons.get(skip_reason, 0) + 1
                                logger.warning(
                                    "Skipping APEX Eventbrite page %s: %s",
                                    event_url,
                                    skip_reason or "unknown_reason",
                                )
                        else:
                            logger.debug("No Eventbrite context payload found for %s", event_url)

                        # Fallback for older Eventbrite pages that still expose Event JSON-LD.
                        if not event_records:
                            jsonld_events = parse_eventbrite_jsonld(page)

                            for event_data in jsonld_events:
                                try:
                                    title = event_data.get("name", "")
                                    if not title:
                                        continue

                                    # Parse dates
                                    start_date_str = event_data.get("startDate", "")
                                    end_date_str = event_data.get("endDate", "")

                                    if not start_date_str:
                                        continue

                                    # Parse ISO datetime
                                    try:
                                        start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))
                                        start_date = start_dt.strftime("%Y-%m-%d")
                                        start_time = start_dt.strftime("%H:%M")
                                    except ValueError:
                                        continue

                                    end_date = None
                                    end_time = None
                                    if end_date_str:
                                        try:
                                            end_dt = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
                                            end_date = end_dt.strftime("%Y-%m-%d")
                                            end_time = end_dt.strftime("%H:%M")
                                        except ValueError:
                                            pass

                                    # For recurring events, check if end date is in the future
                                    is_recurring = False
                                    try:
                                        start_dt_check = datetime.strptime(start_date, "%Y-%m-%d").date()
                                        end_dt_check = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else start_dt_check
                                        today = datetime.now().date()

                                        # If start is past but end is future, it's an ongoing recurring event
                                        if start_dt_check < today and end_dt_check >= today:
                                            is_recurring = True
                                            # Use today as the "start" since recurring events are ongoing
                                            start_date = today.strftime("%Y-%m-%d")
                                            logger.info(f"Recurring event detected: {title} (ongoing until {end_date})")
                                        elif end_dt_check < today:
                                            logger.debug(f"Skipping past event: {title}")
                                            continue
                                    except ValueError:
                                        pass

                                    # Get description
                                    description = event_data.get("description", "")
                                    if not description:
                                        description = f"{title} at APEX Museum"

                                    # Get image
                                    image_url = event_data.get("image")
                                    if isinstance(image_url, list):
                                        image_url = image_url[0] if image_url else None

                                    # Check for sold out status
                                    is_sold_out = False
                                    offers = event_data.get("offers", [])
                                    if isinstance(offers, list):
                                        # Check if ALL offers are sold out
                                        if offers and all(
                                            offer.get("availability") == "SoldOut"
                                            for offer in offers
                                            if isinstance(offer, dict)
                                        ):
                                            is_sold_out = True
                                    elif isinstance(offers, dict):
                                        is_sold_out = offers.get("availability") == "SoldOut"

                                    # Extract pricing
                                    is_free = False
                                    price_min = None
                                    price_max = None

                                    if isinstance(offers, list):
                                        prices = []
                                        for offer in offers:
                                            if isinstance(offer, dict):
                                                if offer.get("@type") == "AggregateOffer":
                                                    low = offer.get("lowPrice")
                                                    high = offer.get("highPrice")
                                                    if low is not None:
                                                        prices.append(float(low))
                                                    if high is not None:
                                                        prices.append(float(high))
                                                else:
                                                    price = offer.get("price")
                                                    if price is not None:
                                                        prices.append(float(price))

                                        if prices:
                                            price_min = min(prices)
                                            price_max = max(prices)
                                            is_free = price_min == 0

                                    # Determine category and tags
                                    category, subcategory, tags = determine_category(title, description)

                                    # Add sold-out tag if applicable
                                    if is_sold_out:
                                        tags.append("sold-out")

                                    # Build series_hint for recurring events
                                    series_hint = None
                                    if is_recurring:
                                        series_hint = {
                                            "series_type": "recurring_show",
                                            "series_title": title,
                                            "description": description[:500] if description else None,
                                        }
                                        if image_url:
                                            series_hint["image_url"] = image_url

                                    event_records.append(
                                        (
                                            {
                                                "title": title,
                                                "description": description[:1000] if description else None,
                                                "start_date": start_date,
                                                "start_time": start_time,
                                                "end_date": end_date,
                                                "end_time": end_time,
                                                "is_all_day": False,
                                                "category": category,
                                                "subcategory": subcategory,
                                                "tags": tags,
                                                "price_min": price_min,
                                                "price_max": price_max,
                                                "price_note": "Sold Out" if is_sold_out else None,
                                                "is_free": is_free,
                                                "source_url": event_url,
                                                "ticket_url": event_url,
                                                "image_url": image_url,
                                                "raw_text": f"{title} - {description[:200] if description else ''}",
                                                "extraction_confidence": 0.9,
                                                "is_recurring": is_recurring,
                                                "recurrence_rule": "Every Thursday" if is_recurring else None,
                                            },
                                            series_hint,
                                        )
                                    )
                                except Exception as e:
                                    logger.error(f"Error processing JSON-LD event: {e}")
                                    continue

                        for event_record, series_hint in event_records:
                            try:
                                events_found += 1

                                # Generate content hash
                                content_hash = generate_content_hash(
                                    event_record["title"],
                                    "APEX Museum",
                                    event_record["start_date"],
                                )
                                event_record["source_id"] = source_id
                                event_record["venue_id"] = venue_id
                                event_record["content_hash"] = content_hash

                                existing = find_event_by_hash(content_hash)
                                if existing:
                                    smart_update_existing_event(existing, event_record)
                                    events_updated += 1
                                    continue

                                try:
                                    insert_event(event_record, series_hint=series_hint)
                                    events_new += 1
                                    logger.info(
                                        "Added: %s on %s",
                                        event_record["title"],
                                        event_record["start_date"],
                                    )
                                except Exception as e:
                                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

                            except Exception as e:
                                logger.error(f"Error processing Eventbrite event: {e}")
                                continue

                    except PlaywrightTimeout:
                        logger.warning(f"Timeout loading event page: {event_url}")
                    except Exception as e:
                        logger.error(f"Error fetching event page {event_url}: {e}")

            except PlaywrightTimeout:
                logger.error("Timeout loading Eventbrite search page")
            except Exception as e:
                logger.error(f"Error fetching from Eventbrite: {e}")

            browser.close()

            if events_found == 0 and skipped_reasons:
                logger.warning(
                    "APEX Museum produced no events from Eventbrite; skip reasons=%s. "
                    "Treat source as destination-first until upstream event data stabilizes.",
                    skipped_reasons,
                )

        logger.info(
            f"APEX Museum crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl APEX Museum: {e}")
        raise

    return events_found, events_new, events_updated
