"""
Crawler for Terminal West calendar.

Uses the venue's structured events feed from the calendar page to avoid
misclassifying supporting acts as primary event titles.
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime
from html import unescape
from typing import Any, Optional
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_client,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash
from description_fetcher import fetch_detail_html_playwright
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig

logger = logging.getLogger(__name__)

BASE_URL = "https://terminalwestatl.com"
CALENDAR_URL = f"{BASE_URL}/calendar/"
DEFAULT_FEED_URL = "https://aegwebprod.blob.core.windows.net/json/events/211/events.json"
REQUEST_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

PLACE_DATA = {
    "name": "Terminal West",
    "slug": "terminal-west",
    "address": "887 W Marietta St NW Suite J",
    "neighborhood": "West Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30318",
    "lat": 33.7816,
    "lng": -84.4156,
    "place_type": "music_venue",
    "website": BASE_URL,
}


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = unescape(str(value))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_event_datetime(value: Any) -> tuple[Optional[str], Optional[str]]:
    raw = _clean_text(value)
    if not raw:
        return None, None

    candidates = [
        raw,
        raw.replace("Z", "+00:00") if raw.endswith("Z") else raw,
    ]
    formats = ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S")

    for candidate in candidates:
        for fmt in formats:
            try:
                dt = datetime.strptime(candidate, fmt)
                return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
            except ValueError:
                continue

    return None, None


def _format_time_label(time_24: Optional[str]) -> Optional[str]:
    if not time_24:
        return None
    raw = str(time_24).strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def _extract_calendar_feed_url(page) -> str:
    feed_url = page.eval_on_selector(
        '[data-file*="events.json"]', 'el => el?.getAttribute("data-file") || ""'
    )
    feed_url = _clean_text(feed_url)
    if feed_url:
        return urljoin(CALENDAR_URL, feed_url)

    html = page.content()
    match = re.search(r'data-file="([^"]*events\.json)"', html)
    if match:
        return urljoin(CALENDAR_URL, unescape(match.group(1)))

    logger.warning("Terminal West: calendar feed URL not found in page markup, using default")
    return DEFAULT_FEED_URL


def _fetch_events_payload(feed_url: str) -> list[dict[str, Any]]:
    payload: Any = []
    last_exc: Exception | None = None
    for attempt in range(1, 4):
        try:
            request = Request(feed_url, headers={"User-Agent": REQUEST_USER_AGENT})
            with urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:  # noqa: BLE001 - source fetch retry guard
            last_exc = exc
            if attempt >= 3:
                raise
            time.sleep(1.5 * attempt)

    if last_exc:
        logger.debug("Terminal West feed fetch recovered after retry: %s", last_exc)

    if isinstance(payload, dict):
        events = payload.get("events") or []
    elif isinstance(payload, list):
        events = payload
    else:
        events = []

    if not isinstance(events, list):
        return []
    return [e for e in events if isinstance(e, dict)]


def _extract_primary_title(event_payload: dict[str, Any]) -> str:
    title = event_payload.get("title") or {}
    if not isinstance(title, dict):
        title = {}

    candidates = [
        title.get("headlinersText"),
        title.get("eventTitleText"),
        title.get("headliners"),
        title.get("eventTitle"),
        title.get("supportingText"),
    ]

    for candidate in candidates:
        cleaned = _clean_text(candidate)
        if cleaned:
            return cleaned
    return ""


def _split_supporting_acts(supporting_text: str) -> list[str]:
    raw = _clean_text(supporting_text)
    if not raw:
        return []

    normalized = re.sub(r"(?i)^w(?:ith|/)\s*", "", raw).strip()
    if not normalized:
        return []

    parts = re.split(r"\s*\|\s*|\s*,\s*", normalized)
    seen: set[str] = set()
    output: list[str] = []
    for part in parts:
        name = _clean_text(part)
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(name)
    return output


def _extract_best_image(event_payload: dict[str, Any]) -> Optional[str]:
    def choose(media_block: Any) -> Optional[str]:
        if not isinstance(media_block, dict):
            return None

        best_url: Optional[str] = None
        best_area = -1
        for item in media_block.values():
            if not isinstance(item, dict):
                continue
            url = _clean_text(item.get("file_name"))
            if not url or "defaults" in url:
                continue
            try:
                width = int(float(item.get("width") or 0))
                height = int(float(item.get("height") or 0))
            except (TypeError, ValueError):
                width, height = 0, 0
            area = width * height
            if area >= best_area:
                best_area = area
                best_url = url
        return best_url

    return choose(event_payload.get("media")) or choose(event_payload.get("relatedMedia"))


def _build_structured_artists(headliner: str, supporting: list[str]) -> list[dict[str, Any]]:
    artists: list[dict[str, Any]] = []
    if headliner:
        artists.append(
            {
                "name": headliner,
                "role": "headliner",
                "billing_order": 1,
                "is_headliner": True,
            }
        )

    for idx, name in enumerate(supporting, start=2):
        artists.append(
            {
                "name": name,
                "role": "support",
                "billing_order": idx,
                "is_headliner": False,
            }
        )

    return artists


def _normalize_title_key(title: str) -> str:
    text = _clean_text(title).lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"^(the|a|an)\s+", "", text)
    text = re.sub(r"[^a-z0-9\s]", "", text)
    return text.strip()


def _should_enrich_from_detail(event_record: dict[str, Any]) -> bool:
    desc_len = len(_clean_text(event_record.get("description")))
    has_image = bool(event_record.get("image_url"))
    has_ticket = bool(event_record.get("ticket_url"))
    has_price_signal = (
        event_record.get("price_min") is not None
        or event_record.get("price_note")
        or event_record.get("is_free") is not None
    )
    return desc_len < 220 or not has_image or not has_ticket or not has_price_signal


def _enrich_from_detail_if_needed(
    *,
    detail_page,
    detail_url: str,
    event_record: dict[str, Any],
    detail_config: DetailConfig,
) -> bool:
    if not detail_url or not detail_url.startswith("http"):
        return False
    if not _should_enrich_from_detail(event_record):
        return False

    html = fetch_detail_html_playwright(detail_page, detail_url)
    if not html:
        return False

    fields = enrich_from_detail(html, detail_url, "Terminal West", detail_config)
    if not fields:
        return False

    existing_desc = _clean_text(event_record.get("description"))
    enriched_desc = _clean_text(fields.get("description"))
    if enriched_desc and len(enriched_desc) > len(existing_desc):
        event_record["description"] = enriched_desc

    if fields.get("ticket_url") and not event_record.get("ticket_url"):
        event_record["ticket_url"] = fields["ticket_url"]
    if fields.get("image_url") and not event_record.get("image_url"):
        event_record["image_url"] = fields["image_url"]
    if fields.get("price_min") is not None and event_record.get("price_min") is None:
        event_record["price_min"] = fields["price_min"]
    if fields.get("price_max") is not None and event_record.get("price_max") is None:
        event_record["price_max"] = fields["price_max"]
    if fields.get("price_note") and not event_record.get("price_note"):
        event_record["price_note"] = fields["price_note"]
    if fields.get("is_free") is not None:
        event_record["is_free"] = fields["is_free"]

    return True


def _find_existing_event_by_terminal_event_id(source_id: int, event_id: str) -> Optional[dict[str, Any]]:
    rows = _find_events_by_terminal_event_id(source_id, event_id)
    if not rows:
        return None
    rows.sort(key=lambda row: (row.get("is_active") is not True, row.get("id") or 0))
    return rows[0]


def _find_events_by_terminal_event_id(source_id: int, event_id: str) -> list[dict[str, Any]]:
    if not event_id:
        return []

    client = get_client()
    token = f"event_id={event_id}"
    rows_by_id: dict[int, dict[str, Any]] = {}

    # Primary match: detail URL source link.
    result = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .ilike("source_url", f"%{token}%")
        .limit(5)
        .execute()
    )
    for row in result.data or []:
        row_id = row.get("id")
        if row_id is not None:
            rows_by_id[int(row_id)] = row

    # Fallback: AXS ticket URL contains the same event id.
    result = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .ilike("ticket_url", f"%/events/{event_id}/%")
        .limit(5)
        .execute()
    )
    for row in result.data or []:
        row_id = row.get("id")
        if row_id is not None:
            rows_by_id[int(row_id)] = row

    return list(rows_by_id.values())


def _deactivate_duplicate_event_id_rows(rows: list[dict[str, Any]], keep_id: int) -> None:
    for row in rows:
        row_id = row.get("id")
        if row_id is None or int(row_id) == keep_id:
            continue
        if row.get("is_active") is False:
            continue
        update_event(int(row_id), {"is_active": False})


def _find_existing_event_in_slot(
    *,
    source_id: int,
    venue_id: int,
    start_date: str,
    start_time: Optional[str],
) -> Optional[dict[str, Any]]:
    client = get_client()
    query = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("place_id", venue_id)
        .eq("start_date", start_date)
    )
    if start_time:
        query = query.eq("start_time", start_time)
    else:
        query = query.is_("start_time", "null")

    rows = query.limit(10).execute().data or []
    if not rows:
        return None

    rows.sort(key=lambda row: (row.get("is_active") is not True, row.get("id") or 0))
    return rows[0]


def _find_title_conflict_in_slot(
    *,
    source_id: int,
    venue_id: int,
    start_date: str,
    start_time: Optional[str],
    normalized_title: str,
    exclude_event_id: int,
) -> Optional[dict[str, Any]]:
    if not normalized_title:
        return None

    client = get_client()
    query = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("place_id", venue_id)
        .eq("start_date", start_date)
    )
    if start_time:
        query = query.eq("start_time", start_time)
    else:
        query = query.is_("start_time", "null")

    rows = query.limit(10).execute().data or []
    for row in rows:
        if row.get("id") == exclude_event_id:
            continue
        if _normalize_title_key(row.get("title") or "") == normalized_title:
            return row
    return None


def build_terminal_west_description(
    *,
    title: str,
    base_description: Optional[str],
    start_date: str,
    start_time: Optional[str],
    source_url: str,
    supporting_acts: list[str],
    tour_name: Optional[str],
    presented_by: Optional[str],
    age_restriction: Optional[str],
) -> str:
    desc = _clean_text(base_description)
    parts: list[str] = []

    if desc and len(desc) >= 140:
        parts.append(desc if desc.endswith(".") else f"{desc}.")
    elif desc:
        parts.append(desc if desc.endswith(".") else f"{desc}.")

    if not parts:
        parts.append(f"{title} is a live music performance at Terminal West.")

    if tour_name:
        parts.append(f"Tour: {tour_name}.")

    if supporting_acts:
        support_text = ", ".join(supporting_acts)
        parts.append(f"Supporting acts: {support_text}.")

    if presented_by:
        parts.append(f"Presented by {presented_by}.")

    parts.append("Location: Terminal West, West Midtown, Atlanta, GA.")

    if age_restriction:
        parts.append(f"Age policy: {age_restriction}.")

    time_label = _format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if source_url:
        parts.append(
            f"Check the official listing for lineup updates, age policy, and ticket availability ({source_url})."
        )

    return " ".join(parts)[:1500]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Terminal West events using the structured calendar JSON feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=REQUEST_USER_AGENT,
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            def goto_with_retry(
                target_url: str,
                *,
                attempts: int = 3,
                timeout_ms: int = 45000,
                wait_until: str = "domcontentloaded",
            ) -> None:
                last_exc: Exception | None = None
                for attempt in range(1, attempts + 1):
                    try:
                        page.goto(target_url, wait_until=wait_until, timeout=timeout_ms)
                        return
                    except Exception as exc:  # noqa: BLE001 - crawler retry guard
                        last_exc = exc
                        if attempt >= attempts:
                            raise
                        page.wait_for_timeout(1500 * attempt)
                if last_exc:
                    raise last_exc

            logger.info(f"Fetching Terminal West calendar: {CALENDAR_URL}")
            goto_with_retry(CALENDAR_URL, attempts=3, timeout_ms=45000)
            page.wait_for_timeout(3000)

            feed_url = _extract_calendar_feed_url(page)
            logger.info(f"Terminal West events feed: {feed_url}")
            payload_events = _fetch_events_payload(feed_url)
            if not payload_events:
                raise RuntimeError("Terminal West events feed returned no events")

            venue_id = get_or_create_place(PLACE_DATA)

            detail_page = context.new_page()
            detail_config = DetailConfig(use_llm=False)
            detail_fetches = 0
            detail_fetch_limit = 40

            for payload_event in payload_events:
                if payload_event.get("is_active") is False:
                    continue

                event_id = _clean_text(payload_event.get("eventId"))
                title = _extract_primary_title(payload_event)
                start_date, start_time = _parse_event_datetime(
                    payload_event.get("eventDateTimeISO") or payload_event.get("eventDateTime")
                )

                if not title or not start_date:
                    continue

                title_block = payload_event.get("title") or {}
                if not isinstance(title_block, dict):
                    title_block = {}

                supporting_acts = _split_supporting_acts(title_block.get("supportingText"))
                tour_name = _clean_text(title_block.get("tour"))
                presented_by = _clean_text(title_block.get("presentedByText"))
                age_restriction = _clean_text(payload_event.get("age"))

                detail_url = (
                    f"{BASE_URL}/events/detail?event_id={event_id}" if event_id else CALENDAR_URL
                )

                ticketing = payload_event.get("ticketing") or {}
                if not isinstance(ticketing, dict):
                    ticketing = {}

                ticket_url = _clean_text(ticketing.get("eventUrl") or ticketing.get("url")) or None
                if ticket_url and not ticket_url.startswith("http"):
                    ticket_url = urljoin(BASE_URL, ticket_url)

                ticket_status = _clean_text(ticketing.get("status"))
                status_lower = ticket_status.lower() if ticket_status else ""
                price_note = (
                    ticket_status
                    if status_lower and status_lower not in {"tickets", "buy tickets", "get tickets"}
                    else None
                )

                if "free" in status_lower:
                    is_free = True
                elif status_lower in {"tickets", "buy tickets", "get tickets", "sold out"}:
                    is_free = False
                else:
                    is_free = None

                description = _clean_text(payload_event.get("description") or payload_event.get("bio")) or None
                image_url = _extract_best_image(payload_event)

                hash_key = f"{start_date}|{start_time}" if start_time else start_date
                content_hash = generate_content_hash(title, PLACE_DATA["name"], hash_key)
                event_record: dict[str, Any] = {
                    "source_id": source_id,
                    "place_id": venue_id,
                    "title": title,
                    "description": description,
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "music",
                    "subcategory": "concert",
                    "tags": ["music", "concert", "terminal-west"],
                    "price_min": None,
                    "price_max": None,
                    "price_note": price_note,
                    "is_free": is_free,
                    "source_url": detail_url,
                    "ticket_url": ticket_url,
                    "image_url": image_url,
                    "raw_text": json.dumps(
                        {
                            "event_id": event_id,
                            "tour": tour_name,
                            "supporting_acts": supporting_acts,
                            "ticket_status": ticket_status,
                        }
                    )[:1800],
                    "extraction_confidence": 0.94,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                parsed_artists = _build_structured_artists(title, supporting_acts)
                if parsed_artists:
                    event_record["_parsed_artists"] = parsed_artists

                if detail_fetches < detail_fetch_limit:
                    did_enrich = _enrich_from_detail_if_needed(
                        detail_page=detail_page,
                        detail_url=detail_url,
                        event_record=event_record,
                        detail_config=detail_config,
                    )
                    if did_enrich:
                        detail_fetches += 1

                event_record["description"] = build_terminal_west_description(
                    title=event_record["title"],
                    base_description=event_record.get("description"),
                    start_date=event_record["start_date"],
                    start_time=event_record.get("start_time"),
                    source_url=event_record.get("source_url") or BASE_URL,
                    supporting_acts=supporting_acts,
                    tour_name=tour_name,
                    presented_by=presented_by,
                    age_restriction=age_restriction,
                )

                events_found += 1

                event_id_rows = (
                    _find_events_by_terminal_event_id(source_id, event_id)
                    if event_id
                    else []
                )
                existing = None
                if event_id_rows:
                    desired_title_key = _normalize_title_key(title)
                    matching = [
                        row
                        for row in event_id_rows
                        if _normalize_title_key(row.get("title") or "") == desired_title_key
                    ]
                    candidate_rows = matching or event_id_rows
                    candidate_rows.sort(
                        key=lambda row: (row.get("is_active") is not True, row.get("id") or 0)
                    )
                    existing = candidate_rows[0]
                if not existing:
                    existing = _find_existing_event_in_slot(
                        source_id=source_id,
                        venue_id=venue_id,
                        start_date=start_date,
                        start_time=start_time,
                    )
                if not existing:
                    maybe_hash_match = find_event_by_hash(content_hash)
                    if maybe_hash_match and maybe_hash_match.get("source_id") == source_id:
                        existing = maybe_hash_match

                if existing:
                    changed = smart_update_existing_event(existing, event_record)
                    canonical_id = int(existing["id"])

                    forced_updates: dict[str, Any] = {}
                    desired_title = event_record["title"]
                    if (existing.get("title") or "").strip() != desired_title:
                        conflict = _find_title_conflict_in_slot(
                            source_id=source_id,
                            venue_id=venue_id,
                            start_date=start_date,
                            start_time=start_time,
                            normalized_title=_normalize_title_key(desired_title),
                            exclude_event_id=existing["id"],
                        )
                        if conflict:
                            # Existing duplicate already owns this normalized slot title.
                            # Promote the duplicate to canonical with current metadata,
                            # then retire this support-act row.
                            smart_update_existing_event(conflict, event_record)
                            conflict_updates: dict[str, Any] = {
                                "title": desired_title,
                                "content_hash": content_hash,
                                "source_url": event_record["source_url"],
                            }
                            if event_record.get("ticket_url"):
                                conflict_updates["ticket_url"] = event_record["ticket_url"]
                            update_event(conflict["id"], conflict_updates)
                            canonical_id = int(conflict["id"])
                            if existing.get("is_active") is not False:
                                update_event(existing["id"], {"is_active": False})
                            changed = True
                        else:
                            forced_updates["title"] = desired_title
                    if existing.get("content_hash") != content_hash:
                        forced_updates["content_hash"] = content_hash
                    if existing.get("source_url") != event_record["source_url"]:
                        forced_updates["source_url"] = event_record["source_url"]
                    if event_record.get("ticket_url") and existing.get("ticket_url") != event_record.get("ticket_url"):
                        forced_updates["ticket_url"] = event_record["ticket_url"]

                    if forced_updates:
                        update_event(existing["id"], forced_updates)
                        changed = True

                    if event_id_rows:
                        _deactivate_duplicate_event_id_rows(event_id_rows, keep_id=canonical_id)

                    if changed:
                        events_updated += 1
                    continue

                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(f"Added: {event_record['title']} on {event_record['start_date']}")
                except Exception as e:
                    logger.error(f"Failed to insert: {event_record['title']}: {e}")

            detail_page.close()
            browser.close()

        logger.info(
            f"Terminal West crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Terminal West: {e}")
        raise

    return events_found, events_new, events_updated
