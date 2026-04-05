"""
Generic festival schedule crawler.

Utility script that extracts individual program sessions from a festival's
schedule page and inserts them as events linked to the festival via series.

Supports multiple extraction strategies:
  1. JSON-LD (@type: Event) — best quality, structured data
  2. WordPress "The Events Calendar" plugin markup
  3. HTML table schedule grids (common for conventions)
  4. LLM extraction fallback for unstructured schedules

Usage:
    python crawl_festival_schedule.py --slug dragon-con --url https://www.dragoncon.org/schedule/
    python crawl_festival_schedule.py --slug dragon-con --url ... --dry-run
    python crawl_festival_schedule.py --slug atlanta-pride --url ... --render-js
    python crawl_festival_schedule.py --slug georgia-renaissance-festival --url ... --use-llm
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from config import get_config
from db import (
    get_client,
    get_or_create_place,
    get_source_by_slug,
    get_venue_by_slug,
    insert_event,
    find_event_by_hash,
)
from dedupe import generate_content_hash
from utils import setup_logging, slugify, is_likely_non_event_image

logger = logging.getLogger(__name__)

_UNKNOWN_VENUE_MARKERS = {
    "unknown venue",
    "unknown",
    "tba",
    "to be announced",
    "n/a",
    "none",
    "off campus in atl",
}

_PLACEHOLDER_PAGE_MARKERS = (
    "available soon",
    "stay tuned",
    "check back soon",
    "details soon",
    "details, a date, and more",
)

_FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH = (
    Path(__file__).resolve().parent / "config" / "festival_llm_provider_overrides.json"
)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


class SessionData:
    """A single extracted festival session/event."""

    def __init__(
        self,
        title: str,
        start_date: str,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        description: Optional[str] = None,
        venue_name: Optional[str] = None,
        venue_address: Optional[str] = None,
        venue_city: Optional[str] = None,
        venue_state: Optional[str] = None,
        venue_postal_code: Optional[str] = None,
        venue_website: Optional[str] = None,
        category: Optional[str] = None,
        image_url: Optional[str] = None,
        source_url: Optional[str] = None,
        is_all_day: bool = False,
        tags: Optional[list[str]] = None,
        artists: Optional[list[str]] = None,
        program_track: Optional[str] = None,
        ticket_url: Optional[str] = None,
    ):
        self.title = title
        self.start_date = start_date
        self.start_time = start_time
        self.end_time = end_time
        self.description = description
        self.venue_name = venue_name
        self.venue_address = venue_address
        self.venue_city = venue_city
        self.venue_state = venue_state
        self.venue_postal_code = venue_postal_code
        self.venue_website = venue_website
        self.category = category or "community"
        self.image_url = image_url
        self.source_url = source_url
        self.is_all_day = is_all_day
        self.tags = tags or []
        self.artists = artists or []
        self.program_track = program_track
        self.ticket_url = ticket_url

    def __repr__(self) -> str:
        return f"Session({self.title!r}, {self.start_date}, {self.start_time})"


_PAGE_SUMMARY_CACHE: dict[str, Optional[str]] = {}


def _normalize_image_url(image_url: Optional[str], base_url: str) -> Optional[str]:
    """Normalize and quality-filter an image URL."""
    if not image_url:
        return None
    normalized = str(image_url).strip()
    if not normalized:
        return None

    if normalized.startswith("//"):
        normalized = "https:" + normalized
    elif not normalized.startswith("http"):
        normalized = urljoin(base_url, normalized)

    if is_likely_non_event_image(normalized):
        return None
    return normalized


def _clean_description_text(value: Optional[str], max_len: int = 500) -> Optional[str]:
    normalized = re.sub(r"\s+", " ", (value or "").strip())
    if not normalized:
        return None
    return normalized[:max_len]


def _extract_meta_description(html: str) -> Optional[str]:
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")
    for attrs in (
        {"name": "description"},
        {"property": "og:description"},
        {"name": "twitter:description"},
    ):
        meta = soup.find("meta", attrs=attrs)
        if not meta:
            continue
        content = _clean_description_text(meta.get("content"), max_len=600)
        if content and len(content) >= 80:
            return content

    for selector in ("main p", "article p", ".entry-content p", ".content p", "body p"):
        paragraph = soup.select_one(selector)
        if not paragraph:
            continue
        text = _clean_description_text(paragraph.get_text(" ", strip=True), max_len=600)
        if text and len(text) >= 80:
            return text
    return None


def _pick_best_image_url(image_field, base_url: str) -> Optional[str]:
    """Pick the first usable image URL from JSON-LD image payloads."""
    candidates: list[str] = []

    if isinstance(image_field, str):
        candidates.append(image_field)
    elif isinstance(image_field, dict):
        for key in ("url", "contentUrl", "thumbnailUrl"):
            value = image_field.get(key)
            if isinstance(value, str) and value:
                candidates.append(value)
    elif isinstance(image_field, list):
        for item in image_field:
            if isinstance(item, str):
                candidates.append(item)
            elif isinstance(item, dict):
                for key in ("url", "contentUrl", "thumbnailUrl"):
                    value = item.get(key)
                    if isinstance(value, str) and value:
                        candidates.append(value)

    for candidate in candidates:
        normalized = _normalize_image_url(candidate, base_url)
        if normalized:
            return normalized
    return None


# ---------------------------------------------------------------------------
# Page fetching
# ---------------------------------------------------------------------------


def fetch_html(url: str, render_js: bool = False) -> str:
    """Fetch HTML from a URL. Optionally uses Playwright for JS-rendered pages."""
    if render_js:
        return _fetch_with_playwright(url)
    return _fetch_with_requests(url)


def _get_page_summary(url: Optional[str], render_js: bool = False) -> Optional[str]:
    normalized_url = (url or "").strip()
    if not normalized_url:
        return None

    cache_key = f"{int(render_js)}:{normalized_url}"
    if cache_key in _PAGE_SUMMARY_CACHE:
        return _PAGE_SUMMARY_CACHE[cache_key]

    try:
        html = fetch_html(normalized_url, render_js=render_js)
    except Exception as exc:
        logger.debug("Summary hydration failed for %s: %s", normalized_url, exc)
        _PAGE_SUMMARY_CACHE[cache_key] = None
        return None

    summary = _extract_meta_description(html)
    _PAGE_SUMMARY_CACHE[cache_key] = summary
    return summary


def _fetch_with_requests(url: str) -> str:
    cfg = get_config()
    headers = {
        "User-Agent": cfg.crawler.user_agent,
        # Keep decoding predictable for parser/LLM input.
        "Accept-Encoding": "gzip, deflate",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=cfg.crawler.request_timeout)
    except requests.exceptions.SSLError as exc:
        logger.warning("requests TLS failed for %s, falling back to curl: %s", url, exc)
        return _fetch_with_curl(url, headers, timeout=cfg.crawler.request_timeout)
    resp.raise_for_status()
    if (resp.headers.get("content-encoding") or "").lower() == "br":
        return _decode_brotli_response(resp)
    return resp.text


def _fetch_with_curl(url: str, headers: dict[str, str], timeout: int) -> str:
    """Fallback HTML fetch via curl for sites incompatible with local TLS bindings."""
    curl_bin = shutil.which("curl")
    if not curl_bin:
        raise RuntimeError(f"curl is not available for TLS fallback: {url}")

    cmd = [
        curl_bin,
        "-L",
        "--silent",
        "--show-error",
        "--compressed",
        "--max-time",
        str(timeout),
    ]
    user_agent = headers.get("User-Agent")
    if user_agent:
        cmd.extend(["-A", user_agent])
    accept_encoding = headers.get("Accept-Encoding")
    if accept_encoding:
        cmd.extend(["-H", f"Accept-Encoding: {accept_encoding}"])
    cmd.append(url)

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return proc.stdout.decode("utf-8", errors="replace")


def _decode_brotli_response(resp: requests.Response) -> str:
    """Decode brotli-compressed response bytes with optional local decoders."""
    raw = resp.content

    for module_name in ("brotli", "brotlicffi"):
        try:
            decoder = __import__(module_name)
            decoded = decoder.decompress(raw)
            return decoded.decode(resp.encoding or "utf-8", errors="replace")
        except Exception:
            continue

    brotli_bin = shutil.which("brotli")
    if brotli_bin:
        try:
            proc = subprocess.run(
                [brotli_bin, "-d", "-c"],
                input=raw,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            )
            return proc.stdout.decode(resp.encoding or "utf-8", errors="replace")
        except Exception as exc:
            logger.debug("brotli CLI decode failed for %s: %s", resp.url, exc)

    logger.warning("Brotli content received but no decoder available for %s", resp.url)
    return resp.text


def _fetch_with_playwright(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Scroll to load lazy content
        for _ in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(800)

        html = page.content()
        browser.close()
        return html


# ---------------------------------------------------------------------------
# Extraction strategies
# ---------------------------------------------------------------------------


def extract_sessions_jsonld(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from JSON-LD @type: Event blocks."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        # Handle both single objects and arrays
        items = data if isinstance(data, list) else [data]

        # Also handle @graph wrapper
        for item in items:
            if isinstance(item, dict) and "@graph" in item:
                items.extend(item["@graph"])

        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type", "")
            # Accept Event, MusicEvent, TheaterEvent, etc.
            if "Event" not in str(item_type):
                continue

            session = _parse_jsonld_event(item, base_url)
            if session:
                sessions.append(session)

    logger.info(f"JSON-LD: extracted {len(sessions)} sessions")
    return sessions


def _parse_jsonld_event(item: dict, base_url: str) -> Optional[SessionData]:
    """Parse a single JSON-LD Event object into a SessionData."""
    title = item.get("name", "").strip()
    if not title:
        return None

    # Parse dates
    start_str = item.get("startDate", "")
    start_date, start_time = _parse_iso_datetime(start_str)
    if not start_date:
        return None

    end_str = item.get("endDate", "")
    _, end_time = _parse_iso_datetime(end_str)

    # Venue
    location = item.get("location", {})
    venue_name = None
    venue_address = None
    venue_city = None
    venue_state = None
    venue_postal_code = None
    venue_website = None
    if isinstance(location, dict):
        venue_name = location.get("name")
        venue_website = location.get("sameAs") or location.get("url")
        address = location.get("address") or {}
        if isinstance(address, dict):
            venue_address = address.get("streetAddress")
            venue_city = address.get("addressLocality")
            venue_state = address.get("addressRegion")
            venue_postal_code = address.get("postalCode")
    elif isinstance(location, str):
        venue_name = location

    # Description
    description = item.get("description", "")
    if description:
        description = description[:1000]

    # Image
    image_url = _pick_best_image_url(item.get("image"), base_url)

    # URL
    source_url = item.get("url")
    if source_url and not source_url.startswith("http"):
        source_url = urljoin(base_url, source_url)

    return SessionData(
        title=title,
        start_date=start_date,
        start_time=start_time,
        end_time=end_time,
        description=description,
        venue_name=venue_name,
        venue_address=venue_address,
        venue_city=venue_city,
        venue_state=venue_state,
        venue_postal_code=venue_postal_code,
        venue_website=venue_website,
        image_url=image_url,
        source_url=source_url,
    )


def extract_sessions_wp_events_calendar(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from WordPress 'The Events Calendar' plugin markup."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    # TEC uses .tribe-events-calendar-list__event-row or .tribe_events class
    selectors = [
        ".tribe-events-calendar-list__event-row",
        ".tribe-events-pro-week-grid__event",
        ".tribe_events .type-tribe_events",
        "article.tribe_events",
        ".tribe-common-g-row",
    ]

    for selector in selectors:
        events = soup.select(selector)
        if events:
            logger.info(
                f"WP Events Calendar: matched {len(events)} items via {selector}"
            )
            for el in events:
                session = _parse_wp_event_element(el, base_url)
                if session:
                    sessions.append(session)
            break

    if not sessions:
        # Try the single-event page pattern
        single = soup.select_one(".tribe-events-single")
        if single:
            session = _parse_wp_event_element(single, base_url)
            if session:
                sessions.append(session)

    logger.info(f"WP Events Calendar: extracted {len(sessions)} sessions")
    return sessions


def _parse_clock_time(value: str) -> Optional[str]:
    """Parse 12-hour time token (e.g. '10:05am') into 24-hour HH:MM."""
    if not value:
        return None
    cleaned = re.sub(r"\s+", "", value.strip().lower())
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?(am|pm)$", cleaned)
    if not m:
        return None

    hour = int(m.group(1))
    minute = int(m.group(2) or "00")
    period = m.group(3)

    if period == "am":
        hour = 0 if hour == 12 else hour
    else:
        hour = 12 if hour == 12 else hour + 12

    return f"{hour:02d}:{minute:02d}"


def _parse_atl_science_festival_date_block(
    value: str,
) -> tuple[Optional[str], Optional[str], Optional[str], bool]:
    """
    Parse ASF list date text like:
      'Saturday, 03/07/2026 - 10:00am to 2:00pm'
    into (start_date, start_time, end_time, is_all_day).
    """
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text:
        return None, None, None, False

    date_match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not date_match:
        return None, None, None, False

    month = int(date_match.group(1))
    day = int(date_match.group(2))
    year = int(date_match.group(3))
    start_date = f"{year:04d}-{month:02d}-{day:02d}"

    if "all day" in text.lower():
        return start_date, None, None, True

    time_tokens = re.findall(
        r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))", text, flags=re.IGNORECASE
    )
    if not time_tokens:
        return start_date, None, None, False

    start_time = _parse_clock_time(time_tokens[0])
    end_time = _parse_clock_time(time_tokens[1]) if len(time_tokens) > 1 else None
    return start_date, start_time, end_time, False


def extract_sessions_atl_science_festival_grid(
    html: str, base_url: str
) -> list[SessionData]:
    """
    Extract sessions from Atlanta Science Festival's events grid (`.event-container` cards).
    """
    soup = BeautifulSoup(html, "lxml")
    sessions: list[SessionData] = []
    seen: set[tuple[str, str, Optional[str], str]] = set()

    containers = soup.select(".event-container")
    if not containers:
        return []

    for container in containers:
        info = container.select_one(".event .info") or container.select_one(".info")
        if not info:
            continue

        title_link = info.select_one("h3 a")
        date_el = info.select_one("p.date")
        if not title_link or not date_el:
            continue

        title = title_link.get_text(" ", strip=True)
        if not title:
            continue

        date_text = date_el.get_text(" ", strip=True)
        start_date, start_time, end_time, is_all_day = (
            _parse_atl_science_festival_date_block(date_text)
        )
        if not start_date:
            continue

        href = (title_link.get("href") or "").strip()
        source_url = urljoin(base_url, href) if href else base_url

        desc_parts: list[str] = []
        for p in info.select("p"):
            classes = {c.lower() for c in (p.get("class") or [])}
            if "date" in classes or "audience" in classes:
                continue
            text = p.get_text(" ", strip=True)
            if text:
                desc_parts.append(text)
        description = " ".join(desc_parts)[:2000] if desc_parts else None

        tags = ["science-festival"]
        for audience in info.select("p.audience a"):
            audience_tag = slugify(audience.get_text(" ", strip=True))
            if audience_tag:
                tags.append(f"audience-{audience_tag}")
        tags = list(dict.fromkeys(tags))

        image_url = None
        img = container.select_one(".image img")
        if img:
            src = img.get("src") or img.get("data-src")
            if not src:
                srcset = img.get("srcset")
                if srcset:
                    src = srcset.split(",")[0].strip().split(" ")[0]
            image_url = _normalize_image_url(src, base_url)

        detail_payload = _extract_atl_science_festival_detail_payload(source_url)
        if detail_payload.get("description") and (
            not description
            or len(detail_payload["description"]) > len(description)
            or "[..]" in description
        ):
            description = detail_payload["description"]

        venue_name = detail_payload.get("venue_name")
        ticket_url = detail_payload.get("ticket_url")
        if detail_payload.get("image_url"):
            image_url = detail_payload["image_url"]

        dedupe_key = (title.lower(), start_date, start_time, source_url)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        sessions.append(
            SessionData(
                title=title,
                start_date=start_date,
                start_time=start_time,
                end_time=end_time,
                description=description,
                venue_name=venue_name,
                category="community",
                image_url=image_url,
                source_url=source_url,
                is_all_day=is_all_day,
                tags=tags,
                ticket_url=ticket_url,
            )
        )

    # Defensive: only accept this strategy when the page clearly looks like ASF's event grid.
    if len(sessions) < 5:
        return []

    logger.info("Atlanta Science Festival grid: extracted %s sessions", len(sessions))
    return sessions


def _asf_normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _extract_asf_labeled_block(container: Tag, label: str) -> str:
    target = label.strip().lower()
    for h3 in container.find_all("h3"):
        heading = _asf_normalize_text(h3.get_text(" ", strip=True)).lower()
        if heading != target:
            continue

        parts: list[str] = []
        for sibling in h3.next_siblings:
            if isinstance(sibling, Tag) and sibling.name == "h3":
                break
            if isinstance(sibling, Tag):
                text = sibling.get_text("\n", strip=True)
            else:
                text = str(sibling)
            normalized = _asf_normalize_text(text)
            if normalized:
                parts.append(normalized)
        return "\n".join(parts)
    return ""


def _extract_asf_ticket_url(container: Tag) -> Optional[str]:
    for h3 in container.find_all("h3"):
        heading = _asf_normalize_text(h3.get_text(" ", strip=True)).lower()
        if heading != "ticket link":
            continue
        for sibling in h3.next_siblings:
            if isinstance(sibling, Tag) and sibling.name == "h3":
                break
            if not isinstance(sibling, Tag):
                continue
            link = sibling.find("a", href=True)
            if link:
                href = (link.get("href") or "").strip()
                if href:
                    return href
    return None


def _extract_asf_venue_name(raw_venue_block: str) -> Optional[str]:
    if not raw_venue_block:
        return None

    lines: list[str] = []
    for chunk in re.split(r"[\n\r]+", raw_venue_block):
        normalized = _asf_normalize_text(chunk)
        if not normalized:
            continue
        for part in normalized.split("|"):
            candidate = _asf_normalize_text(part)
            if candidate:
                lines.append(candidate)

    skip_values = {
        "indoor event",
        "outdoor event",
        "indoor/outdoor event",
        "indoor outdoor event",
        "virtual event",
        "virtual",
        "tba",
        "to be announced",
        "unknown venue",
    }

    for line in lines:
        lowered = line.lower()
        if lowered in skip_values:
            continue
        if re.match(r"^\d{1,5}\s", line):
            continue
        if len(line) < 3:
            continue
        return line
    return None


def _extract_asf_description_from_detail(soup: BeautifulSoup) -> Optional[str]:
    skip_tokens = (
        "sign up for our newsletter",
        "interested in subscribing to our mailing list",
        "register for event",
        "all events",
        "date and time venue audience",
    )

    for block in soup.select(".entry-content-wrapper .avia_textblock"):
        text = _asf_normalize_text(block.get_text(" ", strip=True))
        if len(text) < 120:
            continue
        lowered = text.lower()
        if any(token in lowered for token in skip_tokens):
            continue
        return text[:2500]

    return None


def _extract_atl_science_festival_detail_payload(
    source_url: Optional[str],
) -> dict[str, Optional[str]]:
    payload: dict[str, Optional[str]] = {
        "description": None,
        "venue_name": None,
        "ticket_url": None,
        "image_url": None,
    }
    if not source_url or "atlantasciencefestival.org/events-2026/" not in source_url:
        return payload

    try:
        detail_html = fetch_html(source_url, render_js=False)
    except Exception as exc:
        logger.debug("ASF detail hydration failed for %s: %s", source_url, exc)
        return payload

    soup = BeautifulSoup(detail_html, "lxml")

    description = _extract_asf_description_from_detail(soup)
    if description:
        payload["description"] = description

    sidebar = soup.select_one("#sidebarEvents .avia_textblock")
    if sidebar:
        venue_block = _extract_asf_labeled_block(sidebar, "Venue")
        venue_name = _extract_asf_venue_name(venue_block)
        if venue_name:
            payload["venue_name"] = venue_name

        ticket_url = _extract_asf_ticket_url(sidebar)
        if ticket_url:
            payload["ticket_url"] = ticket_url

    event_image = soup.select_one(".event-image img")
    if event_image:
        img_src = event_image.get("src") or event_image.get("data-src")
        if img_src:
            payload["image_url"] = _normalize_image_url(img_src, source_url)

    return payload


def _parse_wp_event_element(el: Tag, base_url: str) -> Optional[SessionData]:
    """Parse a single WordPress Events Calendar element."""
    # Title
    title_el = el.select_one(
        ".tribe-events-calendar-list__event-title a, "
        ".tribe-event-url a, "
        "h2 a, h3 a, .tribe-events-list-event-title a"
    )
    title = title_el.get_text(strip=True) if title_el else None
    if not title:
        title_el = el.select_one("h2, h3, .tribe-events-calendar-list__event-title")
        title = title_el.get_text(strip=True) if title_el else None
    if not title:
        return None

    # URL
    source_url = None
    if title_el and title_el.name == "a":
        source_url = title_el.get("href")
    elif title_el:
        a = title_el.find("a")
        if a:
            source_url = a.get("href")
    if source_url and not source_url.startswith("http"):
        source_url = urljoin(base_url, source_url)

    # Date/time from datetime attribute
    time_el = el.select_one(
        "time[datetime], .tribe-events-schedule time, abbr.tribe-events-abbr"
    )
    start_date = None
    start_time = None
    if time_el:
        dt_str = time_el.get("datetime") or time_el.get("title") or ""
        start_date, start_time = _parse_iso_datetime(dt_str)

    # Fallback: parse from text
    if not start_date:
        date_el = el.select_one(
            ".tribe-events-calendar-list__event-datetime, "
            ".tribe-event-schedule-details, "
            ".tribe-events-schedule"
        )
        if date_el:
            start_date, start_time = _parse_human_datetime(date_el.get_text(strip=True))

    if not start_date:
        return None

    # Description
    desc_el = el.select_one(
        ".tribe-events-calendar-list__event-description p, "
        ".tribe-events-list-event-description p, "
        ".tribe-events-content p"
    )
    description = desc_el.get_text(strip=True) if desc_el else None

    # Venue
    venue_el = el.select_one(
        ".tribe-events-calendar-list__event-venue, " ".tribe-venue a, " ".tribe-venue"
    )
    venue_name = venue_el.get_text(strip=True) if venue_el else None

    # Image
    img = el.select_one("img")
    image_url = None
    if img:
        src = img.get("src") or img.get("data-src")
        if not src:
            srcset = img.get("srcset")
            if srcset:
                src = srcset.split(",")[0].strip().split(" ")[0]
        image_url = _normalize_image_url(src, base_url)

    return SessionData(
        title=title,
        start_date=start_date,
        start_time=start_time,
        description=description,
        venue_name=venue_name,
        image_url=image_url,
        source_url=source_url,
    )


def extract_sessions_html_table(html: str, base_url: str) -> list[SessionData]:
    """Extract sessions from HTML table schedule grids (common for conventions)."""
    soup = BeautifulSoup(html, "lxml")
    sessions = []

    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        # Try to identify header row
        headers = []
        header_row = rows[0]
        for th in header_row.find_all(["th", "td"]):
            headers.append(th.get_text(strip=True).lower())

        if not headers:
            continue

        # Look for time/title/room columns
        time_col = _find_column(headers, ["time", "start", "when", "schedule"])
        title_col = _find_column(
            headers, ["title", "session", "event", "panel", "name", "description"]
        )
        room_col = _find_column(
            headers, ["room", "location", "venue", "stage", "track"]
        )
        date_col = _find_column(headers, ["date", "day"])

        if title_col is None:
            continue

        current_date = None
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) <= title_col:
                continue

            title = cells[title_col].get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # Date
            if date_col is not None and len(cells) > date_col:
                date_text = cells[date_col].get_text(strip=True)
                parsed_date, _ = _parse_human_datetime(date_text)
                if parsed_date:
                    current_date = parsed_date

            if not current_date:
                continue

            # Time
            start_time = None
            end_time = None
            if time_col is not None and len(cells) > time_col:
                time_text = cells[time_col].get_text(strip=True)
                start_time, end_time = _parse_time_range(time_text)

            # Room/venue
            venue_name = None
            program_track = None
            if room_col is not None and len(cells) > room_col:
                room_text = cells[room_col].get_text(strip=True)
                venue_name = room_text
                program_track = room_text

            sessions.append(
                SessionData(
                    title=title,
                    start_date=current_date,
                    start_time=start_time,
                    end_time=end_time,
                    venue_name=venue_name,
                    program_track=program_track,
                    source_url=base_url,
                )
            )

    logger.info(f"HTML table: extracted {len(sessions)} sessions")
    return sessions


def _parse_time_range_text(value: str) -> tuple[Optional[str], Optional[str]]:
    """Parse loose schedule text containing one or two 12-hour time tokens."""
    tokens = re.findall(
        r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
        value or "",
        flags=re.IGNORECASE,
    )
    if not tokens:
        return None, None
    start_time = _parse_clock_time(tokens[0])
    end_time = _parse_clock_time(tokens[1]) if len(tokens) > 1 else None
    return start_time, end_time


def _parse_month_day_range_text(value: str) -> list[str]:
    """Parse a month day-range block like 'June 5-7, 2026' into ISO dates."""
    text = re.sub(r"\s+", " ", (value or "").strip())
    if not text:
        return []

    match = re.search(
        r"\b([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})\b",
        text,
        re.IGNORECASE,
    )
    if not match:
        return []

    month = MONTH_MAP.get(match.group(1).lower())
    start_day = int(match.group(2))
    end_day = int(match.group(3))
    year = int(match.group(4))
    if not month or end_day < start_day:
        return []

    try:
        return [
            date(year, month, day_value).isoformat()
            for day_value in range(start_day, end_day + 1)
        ]
    except ValueError:
        return []


def extract_sessions_collect_a_con_page(html: str, base_url: str) -> list[SessionData]:
    """Extract Atlanta fall daily hours from the official Collect-A-Con page."""
    normalized_url = (base_url or "").rstrip("/")
    if normalized_url not in {
        "https://collectaconusa.com/atlanta-2",
        "https://collectaconusa.com/atlanta-2/",
    }:
        return []

    soup = BeautifulSoup(html, "lxml")
    page_text = soup.get_text(" ", strip=True)

    range_match = re.search(
        r"September\s+(\d{1,2}),\s*(\d{4})\s+\d{2}:\d{2}:\d{2}",
        page_text,
        re.IGNORECASE,
    )
    if not range_match:
        return []

    start_day = int(range_match.group(1))
    year = int(range_match.group(2))
    saturday_date = date(year, 9, start_day).isoformat()
    sunday_date = date(year, 9, start_day + 1).isoformat()

    saturday_match = re.search(
        r"Saturday:\s*(\d{1,2}(?::\d{2})?\s*[ap]m)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*[ap]m)",
        page_text,
        re.IGNORECASE,
    )
    sunday_match = re.search(
        r"Sunday:\s*(\d{1,2}(?::\d{2})?\s*[ap]m)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*[ap]m)",
        page_text,
        re.IGNORECASE,
    )
    if not saturday_match or not sunday_match:
        return []

    saturday_start = _parse_clock_time(saturday_match.group(1))
    saturday_end = _parse_clock_time(saturday_match.group(2))
    sunday_start = _parse_clock_time(sunday_match.group(1))
    sunday_end = _parse_clock_time(sunday_match.group(2))
    if not saturday_start or not saturday_end or not sunday_start or not sunday_end:
        return []

    venue_match = re.search(
        r"Venue\s+Georgia World Congress (?:Convention )?Center\s+Hall A1\s+285 Andrew Young International Blvd NW,\s*Atlanta,\s*GA\s*(\d{5})",
        page_text,
        re.IGNORECASE,
    )
    if not venue_match:
        return []

    ticket_url = None
    for link in soup.select("a[href]"):
        href = (link.get("href") or "").strip()
        if "universe.com/events/collect-a-con-atlanta-2-ga-tickets" in href:
            ticket_url = href
            break

    image_url = None
    for image in soup.select("img[src]"):
        alt = (image.get("alt") or "").strip().lower()
        src = image.get("src")
        if "atlanta 2 2026" in alt and src:
            image_url = _normalize_image_url(src, normalized_url)
            break

    sessions = [
        SessionData(
            title="Collect-A-Con Atlanta (Fall)",
            start_date=saturday_date,
            start_time=saturday_start,
            end_time=saturday_end,
            venue_name="Georgia World Congress Center",
            venue_address="285 Andrew Young International Blvd NW",
            venue_city="Atlanta",
            venue_state="GA",
            venue_postal_code=venue_match.group(1),
            description=(
                "Collect-A-Con brings trading cards, anime merch, comic books, vintage toys, "
                "video games, celebrity guests, cosplay, and vendor tables to Atlanta."
            ),
            category="community",
            image_url=image_url,
            source_url=normalized_url,
            tags=[
                "collectibles",
                "trading-cards",
                "pop-culture",
                "shopping",
                "cosplay",
            ],
            ticket_url=ticket_url,
        ),
        SessionData(
            title="Collect-A-Con Atlanta (Fall)",
            start_date=sunday_date,
            start_time=sunday_start,
            end_time=sunday_end,
            venue_name="Georgia World Congress Center",
            venue_address="285 Andrew Young International Blvd NW",
            venue_city="Atlanta",
            venue_state="GA",
            venue_postal_code=venue_match.group(1),
            description=(
                "Collect-A-Con brings trading cards, anime merch, comic books, vintage toys, "
                "video games, celebrity guests, cosplay, and vendor tables to Atlanta."
            ),
            category="community",
            image_url=image_url,
            source_url=normalized_url,
            tags=[
                "collectibles",
                "trading-cards",
                "pop-culture",
                "shopping",
                "cosplay",
            ],
            ticket_url=ticket_url,
        ),
    ]

    logger.info("Collect-A-Con page: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_blade_show_schedule(html: str, base_url: str) -> list[SessionData]:
    """Extract daily public admission hours for Blade Show from official pages."""
    normalized_url = (base_url or "").rstrip("/")
    if "bladeshow.com/show-info" not in normalized_url:
        return []

    try:
        home_html = fetch_html("https://www.bladeshow.com/home/", render_js=False)
    except Exception as exc:
        logger.warning("Blade Show home page fetch failed: %s", exc)
        return []

    home_text = BeautifulSoup(home_html, "lxml").get_text(" ", strip=True)
    event_dates = _parse_month_day_range_text(home_text)
    if len(event_dates) < 3:
        return []

    day_dates = {
        "friday": event_dates[0],
        "saturday": event_dates[1],
        "sunday": event_dates[2],
    }

    venue_name = "Cobb Galleria Centre"
    venue_address = "2 Galleria Pkwy SE"
    venue_city = "Atlanta"
    venue_state = "GA"
    venue_postal_code = "30339"

    try:
        travel_html = fetch_html("https://www.bladeshow.com/travel/", render_js=False)
        travel_text = BeautifulSoup(travel_html, "lxml").get_text("\n", strip=True)
        address_match = re.search(
            r"Cobb Convention Center Atlanta\s+2 Galleria Pkwy SE\s+Atlanta,\s*GA\s*(30339)?",
            travel_text,
            re.IGNORECASE,
        )
        if not address_match:
            address_match = re.search(
                r"Cobb Convention Center Atlanta\s+2 Galleria Parkway Southeast\s+Atlanta,\s*GA\s*(30339)?",
                travel_text,
                re.IGNORECASE,
            )
        if address_match:
            venue_postal_code = address_match.group(1) or venue_postal_code
    except Exception as exc:
        logger.debug("Blade Show travel page fetch failed: %s", exc)

    page_text = BeautifulSoup(html, "lxml").get_text("\n", strip=True)
    sessions: list[SessionData] = []
    for day_name in ("Friday", "Saturday", "Sunday"):
        match = re.search(
            rf"\b{day_name}:\s*(\d{{1,2}}(?::\d{{2}})?\s*(?:AM|PM))\s*-\s*(\d{{1,2}}(?::\d{{2}})?\s*(?:AM|PM))\b",
            page_text,
            re.IGNORECASE,
        )
        if not match:
            continue

        start_time = _parse_clock_time(match.group(1))
        end_time = _parse_clock_time(match.group(2))
        start_date = day_dates.get(day_name.lower())
        if not start_date or not start_time:
            continue

        sessions.append(
            SessionData(
                title="Blade Show",
                start_date=start_date,
                start_time=start_time,
                end_time=end_time,
                venue_name=venue_name,
                venue_address=venue_address,
                venue_city=venue_city,
                venue_state=venue_state,
                venue_postal_code=venue_postal_code,
                source_url=normalized_url,
                ticket_url="https://www.bladeshow.com/buy-tickets/",
            )
        )

    logger.info("Blade Show schedule: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_conjuration_homepage(
    html: str, base_url: str
) -> list[SessionData]:
    """Extract the annual CONjuration event from the official homepage."""
    normalized_url = (base_url or "").rstrip("/")
    if normalized_url not in {
        "https://www.conjurationcon.com",
        "https://conjurationcon.com",
    }:
        return []

    soup = BeautifulSoup(html, "lxml")
    page_text = soup.get_text(" ", strip=True)

    range_match = re.search(
        r"\b(?:Nov(?:ember)?)[\s.]+(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})\b",
        page_text,
        re.IGNORECASE,
    )
    if not range_match:
        range_match = re.search(
            r"\bNovember\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(\d{4})\b",
            page_text,
            re.IGNORECASE,
        )
    if not range_match:
        return []

    start_day = int(range_match.group(1))
    end_day = int(range_match.group(2))
    year = int(range_match.group(3))
    if end_day < start_day:
        return []

    start_date = date(year, 11, start_day).isoformat()
    description = None
    desc_match = re.search(
        r"Prepare to be Immersed.*?At CONjuration,.*?(?=Learn More|Ticket Details|Book Your Room)",
        page_text,
        re.IGNORECASE,
    )
    if desc_match:
        description = re.sub(r"\s+", " ", desc_match.group(0)).strip()[:2000]
    else:
        alt_match = re.search(
            r"At CONjuration,.*?(?=Learn More|Ticket Details|Book Your Room|$)",
            page_text,
            re.IGNORECASE,
        )
        if alt_match:
            description = re.sub(r"\s+", " ", alt_match.group(0)).strip()[:2000]

    venue_name = "Sonesta Gwinnett Place Atlanta"
    venue_address = "1775 Pleasant Hill Rd"
    venue_city = "Duluth"
    venue_state = "GA"
    venue_postal_code = "30096"

    try:
        hotel_html = fetch_html("https://www.conjurationcon.com/hotel/", render_js=True)
        hotel_text = BeautifulSoup(hotel_html, "lxml").get_text(" ", strip=True)
        hotel_match = re.search(
            r"Sonesta Gwinnett Place\s*1775 Pleasant Hill Rd\.?\s*Duluth,\s*GA\s*(30096)",
            hotel_text,
            re.IGNORECASE,
        )
        if hotel_match:
            venue_postal_code = hotel_match.group(1)
    except Exception as exc:
        logger.debug("CONjuration hotel page fetch failed: %s", exc)

    sessions = [
        SessionData(
            title="CONjuration 2026",
            start_date=start_date,
            description=description,
            venue_name=venue_name,
            venue_address=venue_address,
            venue_city=venue_city,
            venue_state=venue_state,
            venue_postal_code=venue_postal_code,
            source_url=normalized_url,
        )
    ]
    logger.info("CONjuration homepage: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_toylanta_schedule(html: str, base_url: str) -> list[SessionData]:
    """Extract public Toylanta floor hours and public after-hours swap from the schedule page."""
    normalized_url = (base_url or "").rstrip("/")
    if "toylanta.net/schedule" not in normalized_url:
        return []

    soup = BeautifulSoup(html, "lxml")
    page_text = soup.get_text("\n", strip=True)
    if "Gas South Convention Center" not in page_text or "2026" not in page_text:
        return []

    venue_name = "Gas South Convention Center"
    venue_address = "6400 Sugarloaf Pkwy"
    venue_city = "Duluth"
    venue_state = "GA"
    venue_postal_code = "30097"

    schedules = [
        (
            "friday",
            r"FRIDAY\s+27TH\s+MARCH\s+2026.*?6:00 PM\s*[–-]\s*8:00 PM:\s*SHOW FLOOR\(S\) OPEN FOR GENERAL ADMISSION",
            "2026-03-27",
            "18:00",
            "20:00",
            "Toylanta",
            "Public general admission hours for Toylanta at Gas South Convention Center, including access to the show floor and convention programming.",
        ),
        (
            "saturday",
            r"SATURDAY\s+28TH\s+MARCH\s+2026.*?10:00 AM\s*[–-]\s*6:00 PM:\s*SHOW FLOOR\(S\) OPEN FOR GENERAL ADMISSION",
            "2026-03-28",
            "10:00",
            "18:00",
            "Toylanta",
            "Public general admission hours for Toylanta at Gas South Convention Center, including access to the show floor and convention programming.",
        ),
        (
            "sunday",
            r"SUNDAY\s+29TH\s+MARCH\s+2026.*?10:30 AM\s*[–-]\s*4:30 PM:\s*SHOW FLOOR\(S\) OPEN FOR GENERAL ADMISSION",
            "2026-03-29",
            "10:30",
            "16:30",
            "Toylanta",
            "Public general admission hours for Toylanta at Gas South Convention Center, including access to the show floor and convention programming.",
        ),
    ]

    sessions: list[SessionData] = []
    for (
        _day_key,
        pattern,
        start_date,
        start_time,
        end_time,
        title,
        description,
    ) in schedules:
        if not re.search(pattern, page_text, re.IGNORECASE | re.DOTALL):
            continue
        sessions.append(
            SessionData(
                title=title,
                start_date=start_date,
                start_time=start_time,
                end_time=end_time,
                description=description,
                venue_name=venue_name,
                venue_address=venue_address,
                venue_city=venue_city,
                venue_state=venue_state,
                venue_postal_code=venue_postal_code,
                source_url=normalized_url,
                ticket_url="https://www.toylanta.net/tickets",
            )
        )

    swap_match = re.search(
        r"7:30 PM\s*[–-]\s*10:00 PM:\s*TOYLANTA Lobby Swap",
        page_text,
        re.IGNORECASE,
    )
    if swap_match:
        sessions.append(
            SessionData(
                title="Toylanta Lobby Swap",
                start_date="2026-03-28",
                start_time="19:30",
                end_time="22:00",
                description=(
                    "Toylanta's Saturday evening lobby swap, a public after-hours meetup for collectors "
                    "and attendees at Gas South Convention Center."
                ),
                venue_name=venue_name,
                venue_address=venue_address,
                venue_city=venue_city,
                venue_state=venue_state,
                venue_postal_code=venue_postal_code,
                source_url=normalized_url,
                ticket_url="https://www.toylanta.net/tickets",
            )
        )

    logger.info("Toylanta schedule: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_southeastern_stamp_expo_homepage(
    html: str, base_url: str
) -> list[SessionData]:
    """Extract daily public hours from the current Southeastern Stamp Expo homepage."""
    normalized_url = (base_url or "").rstrip("/")
    if normalized_url not in {"http://www.sefsc.org", "http://sefsc.org"}:
        return []

    soup = BeautifulSoup(html, "lxml")
    page_text = soup.get_text(" ", strip=True)
    range_match = re.search(
        r"January\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})",
        page_text,
        re.IGNORECASE,
    )
    if not range_match:
        return []

    start_day = int(range_match.group(1))
    end_day = int(range_match.group(2))
    year = int(range_match.group(3))
    if end_day < start_day:
        return []

    friday_hours = re.search(
        r"10\s*am\s*-\s*5:30\s*pm\s*Friday\s*&\s*Saturday,\s*10\s*am\s*-\s*3\s*pm\s*Sunday",
        page_text,
        re.IGNORECASE,
    )
    if not friday_hours:
        return []

    venue_name = "Hilton Atlanta Northeast"
    venue_address = "5993 Peachtree Industrial Boulevard"
    venue_city = "Peachtree Corners"
    venue_state = "GA"
    venue_postal_code = "30092"

    sessions = [
        SessionData(
            title="Southeastern Stamp Expo",
            start_date=date(year, 1, start_day).isoformat(),
            start_time="10:00",
            end_time="17:30",
            venue_name=venue_name,
            venue_address=venue_address,
            venue_city=venue_city,
            venue_state=venue_state,
            venue_postal_code=venue_postal_code,
            source_url=normalized_url,
        ),
        SessionData(
            title="Southeastern Stamp Expo",
            start_date=date(year, 1, start_day + 1).isoformat(),
            start_time="10:00",
            end_time="17:30",
            venue_name=venue_name,
            venue_address=venue_address,
            venue_city=venue_city,
            venue_state=venue_state,
            venue_postal_code=venue_postal_code,
            source_url=normalized_url,
        ),
        SessionData(
            title="Southeastern Stamp Expo",
            start_date=date(year, 1, end_day).isoformat(),
            start_time="10:00",
            end_time="15:00",
            venue_name=venue_name,
            venue_address=venue_address,
            venue_city=venue_city,
            venue_state=venue_state,
            venue_postal_code=venue_postal_code,
            source_url=normalized_url,
        ),
    ]

    logger.info(
        "Southeastern Stamp Expo homepage: extracted %s sessions", len(sessions)
    )
    return sessions


def extract_sessions_atlanta_pen_show_schedule(
    html: str, base_url: str
) -> list[SessionData]:
    """Extract public schedule items from the Atlanta Pen Show page."""
    normalized_url = (base_url or "").rstrip("/")
    if "atlpenshow.com/pages/show-schedule" not in normalized_url:
        return []

    soup = BeautifulSoup(html, "lxml")
    page_text = soup.get_text(" ", strip=True)
    year_match = re.search(r"Atlanta Pen Show\s+(\d{4})", page_text, re.IGNORECASE)
    range_match = re.search(
        r"March\s+(\d{1,2})\s*[-–]\s*(\d{1,2})",
        page_text,
        re.IGNORECASE,
    )
    if not year_match or not range_match:
        return []

    year = int(year_match.group(1))
    start_day = int(range_match.group(1))
    end_day = int(range_match.group(2))
    if end_day < start_day:
        return []

    day_dates = {
        "friday": date(year, 3, start_day).isoformat(),
        "saturday": date(year, 3, start_day + 1).isoformat(),
        "sunday": date(year, 3, end_day).isoformat(),
    }
    venue_name = "Sonesta Atlanta Northwest Galleria"
    sessions: list[SessionData] = []

    hours_table = soup.select_one("table.hours-table")
    if hours_table:
        for row in hours_table.select("tbody tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            day_name = cells[0].get_text(" ", strip=True).lower()
            start_date = day_dates.get(day_name)
            if not start_date:
                continue
            start_time, end_time = _parse_time_range_text(
                cells[2].get_text(" ", strip=True)
            )
            if not start_time:
                continue
            sessions.append(
                SessionData(
                    title="Atlanta Pen Show",
                    start_date=start_date,
                    start_time=start_time,
                    end_time=end_time,
                    venue_name=venue_name,
                    source_url=normalized_url,
                )
            )

    special_titles = {
        "pen show after dark": "Pen Show After Dark",
        "pen show door prize giveaway": "Pen Show Door Prize Giveaway",
    }
    for li in soup.select("div.schedule-day li"):
        text = re.sub(r"\s+", " ", li.get_text(" ", strip=True))
        lowered = text.lower()
        matched = next((k for k in special_titles if k in lowered), None)
        if not matched:
            continue
        day_key = "saturday" if "after dark" in matched else "sunday"
        start_date = day_dates.get(day_key)
        start_time, end_time = _parse_time_range_text(text)
        if not start_date or not start_time:
            continue
        sessions.append(
            SessionData(
                title=special_titles[matched],
                start_date=start_date,
                start_time=start_time,
                end_time=end_time,
                venue_name=venue_name,
                source_url=normalized_url,
            )
        )

    logger.info("Atlanta Pen Show schedule: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_ipms_event_page(html: str, base_url: str) -> list[SessionData]:
    """Extract a single event from an IPMS event detail page."""
    normalized_url = (base_url or "").rstrip("/")
    if "ipmsusa.org/event/" not in normalized_url:
        return []

    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h2.page-header")
    date_block = soup.select_one(".field-name-field-event-date")
    venue_name_el = soup.select_one(".field-name-field-event-location-name .field-item")
    address_block = soup.select_one(".field-name-field-event-location .field-item")

    title = title_el.get_text(" ", strip=True) if title_el else None
    if not title or not date_block:
        return []

    start_span = date_block.select_one(".date-display-start")
    end_span = date_block.select_one(".date-display-end")
    start_date = start_time = end_time = None
    if start_span:
        start_date, start_time = _parse_iso_datetime(
            start_span.get("content") or start_span.get_text(" ", strip=True)
        )
    if end_span:
        _, end_time = _parse_iso_datetime(
            end_span.get("content") or end_span.get_text(" ", strip=True)
        )
    if not start_date:
        return []

    venue_name = venue_name_el.get_text(" ", strip=True) if venue_name_el else None
    venue_address = None
    venue_city = None
    venue_state = None
    venue_postal_code = None
    if address_block:
        street = address_block.select_one(".thoroughfare")
        locality = address_block.select_one(".locality")
        state = address_block.select_one(".state")
        postal = address_block.select_one(".postal-code")
        venue_address = street.get_text(" ", strip=True) if street else None
        venue_city = locality.get_text(" ", strip=True) if locality else None
        venue_state = state.get_text(" ", strip=True) if state else None
        venue_postal_code = postal.get_text(" ", strip=True) if postal else None

    website_link = soup.select_one(".field-name-field-event-website a")
    venue_website = website_link.get("href") if website_link else None

    sessions = [
        SessionData(
            title=title,
            start_date=start_date,
            start_time=start_time,
            end_time=end_time,
            venue_name=venue_name,
            venue_address=venue_address,
            venue_city=venue_city,
            venue_state=venue_state,
            venue_postal_code=venue_postal_code,
            venue_website=venue_website,
            source_url=normalized_url,
        )
    ]
    logger.info("IPMS event page: extracted %s sessions", len(sessions))
    return sessions


def extract_sessions_llm(html: str, url: str, festival_name: str) -> list[SessionData]:
    """Fall back to LLM extraction for unstructured schedule pages."""
    from extract import extract_events

    events = extract_events(html, url, festival_name)
    sessions = []
    for ev in events:
        sessions.append(
            SessionData(
                title=ev.title,
                start_date=ev.start_date,
                start_time=ev.start_time,
                end_time=ev.end_time,
                description=ev.description,
                venue_name=ev.venue.name if ev.venue else None,
                category=ev.category,
                image_url=ev.image_url,
                source_url=ev.detail_url or url,
                is_all_day=ev.is_all_day,
                tags=ev.tags,
                artists=ev.artists,
            )
        )

    logger.info(f"LLM extraction: extracted {len(sessions)} sessions")
    return sessions


def _load_provider_overrides() -> dict[str, str]:
    if not _FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH.exists():
        return {}

    try:
        payload = json.loads(_FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH.read_text())
    except Exception as exc:
        logger.warning(
            "Unable to parse provider override file %s: %s",
            _FESTIVAL_LLM_PROVIDER_OVERRIDES_PATH,
            exc,
        )
        return {}

    raw = payload.get("providers_by_slug", {}) if isinstance(payload, dict) else {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for slug, provider in raw.items():
        if isinstance(slug, str) and isinstance(provider, str):
            out[slug.strip().lower()] = provider.strip().lower()
    return out


def _resolve_llm_provider_for_slug(
    slug: str, override_provider: Optional[str]
) -> Optional[str]:
    if override_provider:
        return override_provider.strip().lower()
    overrides = _load_provider_overrides()
    return overrides.get((slug or "").strip().lower())


def _extract_sessions_llm_with_provider(
    html: str,
    url: str,
    festival_name: str,
    slug: str,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> list[SessionData]:
    """Run LLM extraction with optional per-source provider override."""
    from extract import extract_events

    provider = _resolve_llm_provider_for_slug(slug, llm_provider)
    events = extract_events(
        html,
        url,
        festival_name,
        llm_provider=provider,
        llm_model=llm_model,
    )
    sessions = []
    for ev in events:
        sessions.append(
            SessionData(
                title=ev.title,
                start_date=ev.start_date,
                start_time=ev.start_time,
                end_time=ev.end_time,
                description=ev.description,
                venue_name=ev.venue.name if ev.venue else None,
                category=ev.category,
                image_url=ev.image_url,
                source_url=ev.detail_url or url,
                is_all_day=ev.is_all_day,
                tags=ev.tags,
                artists=ev.artists,
            )
        )

    if provider:
        logger.info("LLM extraction provider for %s: %s", slug, provider)
    logger.info(f"LLM extraction: extracted {len(sessions)} sessions")
    return sessions


def _is_unknown_venue(venue_name: Optional[str]) -> bool:
    if not venue_name:
        return True
    normalized = venue_name.strip().lower()
    if normalized in _UNKNOWN_VENUE_MARKERS:
        return True
    # Treat bare city/state strings as too weak to create a venue record.
    return bool(re.fullmatch(r"[a-z .'-]+,\s*[a-z]{2}", normalized))


def _is_generic_title(title: str, festival_name: str) -> bool:
    normalized_title = (title or "").strip().lower()
    normalized_festival = (festival_name or "").strip().lower()
    if not normalized_title:
        return True
    if normalized_festival and normalized_title == normalized_festival:
        return True
    # Same title with only year suffix variation.
    return bool(
        normalized_festival
        and re.sub(r"\s+\d{4}$", "", normalized_title)
        == re.sub(r"\s+\d{4}$", "", normalized_festival)
    )


_GENERIC_FESTIVAL_PROGRAM_MARKERS = (
    "after hours",
    "lobby swap",
    "general admission",
    "show floor",
    "daily hours",
)


def _build_festival_program_series_title(
    session: SessionData, festival_name: str
) -> str:
    """Collapse generic schedule buckets into the parent festival program series."""
    if session.program_track:
        return session.program_track

    title = (session.title or "").strip()
    if not title:
        return festival_name

    normalized = title.lower()
    if _is_generic_title(title, festival_name):
        return festival_name
    if any(marker in normalized for marker in _GENERIC_FESTIVAL_PROGRAM_MARKERS):
        return festival_name

    return title


def _parse_session_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _normalize_page_text(page_text: Optional[str]) -> str:
    if not page_text:
        return ""
    return re.sub(r"\s+", " ", page_text).strip().lower()


def _page_has_placeholder_language(page_text: Optional[str]) -> bool:
    normalized = _normalize_page_text(page_text)
    return any(marker in normalized for marker in _PLACEHOLDER_PAGE_MARKERS)


def _page_mentions_specific_date(
    page_text: Optional[str], session_date: Optional[date]
) -> bool:
    if session_date is None:
        return False

    normalized = _normalize_page_text(page_text)
    if not normalized:
        return False

    month_full = session_date.strftime("%B").lower()
    month_short = session_date.strftime("%b").lower()
    year = str(session_date.year)
    day = str(session_date.day)
    ordinal_day_patterns = [
        rf"\b{month_full}\s+{day}(?:st|nd|rd|th)?\b",
        rf"\b{month_short}\.?\s+{day}(?:st|nd|rd|th)?\b",
        rf"\b{day}(?:st|nd|rd|th)?\s+of\s+{month_full}\b",
    ]
    has_month_day = any(
        re.search(pattern, normalized) for pattern in ordinal_day_patterns
    )
    return has_month_day and year in normalized


def _apply_llm_quality_gate(
    sessions: list[SessionData],
    festival_name: str,
    today: Optional[date] = None,
    page_text: Optional[str] = None,
) -> tuple[list[SessionData], list[str]]:
    """Drop low-signal LLM sessions that are likely hallucinated placeholders."""
    if not sessions:
        return sessions, []

    now = today or date.today()
    reasons: list[str] = []
    kept: list[SessionData] = []

    for session in sessions:
        session_date = _parse_session_date(session.start_date)
        if session_date is None:
            reasons.append(f"drop:{session.title}:invalid_date")
            continue
        if session_date < now:
            reasons.append(f"drop:{session.title}:past_date")
            continue
        if len((session.title or "").strip()) < 4:
            reasons.append(f"drop:{session.title}:short_title")
            continue
        kept.append(session)

    if not kept:
        reasons.append("batch_reject:no_valid_sessions_after_row_filter")
        return [], reasons

    if len(kept) == 1:
        only = kept[0]
        only_date = _parse_session_date(only.start_date)
        jan_first = bool(only_date and only_date.month == 1 and only_date.day == 1)
        has_specific_date_evidence = _page_mentions_specific_date(page_text, only_date)
        has_placeholder_language = _page_has_placeholder_language(page_text)
        low_signal_singleton = not only.start_time and (
            has_placeholder_language
            or jan_first
            or (
                not has_specific_date_evidence
                and (
                    _is_unknown_venue(only.venue_name)
                    or _is_generic_title(only.title, festival_name)
                )
            )
        )
        if low_signal_singleton:
            reasons.append("batch_reject:singleton_low_signal")
            return [], reasons

    unknown_venue_count = sum(
        1 for session in kept if _is_unknown_venue(session.venue_name)
    )
    missing_time_count = sum(1 for session in kept if not session.start_time)
    has_any_specific_date_evidence = any(
        _page_mentions_specific_date(page_text, _parse_session_date(session.start_date))
        for session in kept
    )
    if (
        len(kept) <= 2
        and missing_time_count == len(kept)
        and unknown_venue_count == len(kept)
        and not has_any_specific_date_evidence
    ):
        reasons.append("batch_reject:tiny_batch_all_tba_unknown_venue")
        return [], reasons

    return kept, reasons


# ---------------------------------------------------------------------------
# Date/time parsing helpers
# ---------------------------------------------------------------------------


def _parse_iso_datetime(dt_str: str) -> tuple[Optional[str], Optional[str]]:
    """Parse an ISO 8601 datetime string into (date, time) or (date, None)."""
    if not dt_str:
        return None, None

    value = dt_str.strip()

    # Native ISO parser handles timezone offsets and fractional seconds.
    try:
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except ValueError:
        pass

    # Try ISO date with timezone (strip tz)
    m = re.search(r"(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})", value)
    if m:
        return m.group(1), m.group(2)

    # Date only
    m = re.search(r"(\d{4}-\d{2}-\d{2})", value)
    if m:
        return m.group(1), None

    return None, None


MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def _parse_human_datetime(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse human-readable date text like 'March 15, 2026' or 'Sat, Mar 15'."""
    if not text:
        return None, None

    text = text.strip()

    # Parse first explicit time token, if present.
    time_value = None
    time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", text, re.IGNORECASE)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or "00")
        period = time_match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        time_value = f"{hour:02d}:{minute:02d}"

    # "March 15, 2026" or "Mar 15, 2026"
    m = re.search(
        r"(\w+)\s+(\d{1,2}),?\s*(\d{4})",
        text,
    )
    if m:
        month_str = m.group(1).lower()
        day = int(m.group(2))
        year = int(m.group(3))
        month = MONTH_MAP.get(month_str)
        if month:
            return f"{year:04d}-{month:02d}-{day:02d}", time_value

    # "March 15" (assume current/next year)
    m = re.search(r"(\w+)\s+(\d{1,2})(?!\d)", text)
    if m:
        month_str = m.group(1).lower()
        day = int(m.group(2))
        month = MONTH_MAP.get(month_str)
        if month:
            year = datetime.now().year
            # If the date has passed, use next year
            candidate = datetime(year, month, day)
            if candidate < datetime.now() - timedelta(days=30):
                year += 1
            return f"{year:04d}-{month:02d}-{day:02d}", time_value

    # "2026-03-15"
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return m.group(0), time_value

    return None, None


def _parse_time_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse a time range like '7:00 PM - 9:00 PM' into (start, end)."""
    times = re.findall(r"(\d{1,2}):(\d{2})\s*(am|pm)", text, re.IGNORECASE)
    if not times:
        return None, None

    results = []
    for hour_str, minute_str, period in times:
        hour = int(hour_str)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        results.append(f"{hour:02d}:{minute_str}")

    start = results[0] if results else None
    end = results[1] if len(results) > 1 else None
    return start, end


def _find_column(headers: list[str], keywords: list[str]) -> Optional[int]:
    """Find the column index whose header matches any of the given keywords."""
    for i, header in enumerate(headers):
        for keyword in keywords:
            if keyword in header:
                return i
    return None


# ---------------------------------------------------------------------------
# Venue resolution
# ---------------------------------------------------------------------------


def resolve_session_venue(
    session: SessionData,
    festival_slug: str,
    festival_name: Optional[str] = None,
    default_venue_id: Optional[int] = None,
) -> Optional[int]:
    """Map a session's venue name to an existing venue ID, or use the festival's default."""
    if session.venue_name and not _is_unknown_venue(session.venue_name):
        venue_slug = slugify(session.venue_name)
        existing = get_venue_by_slug(venue_slug)
        if existing:
            return existing["id"]

    if default_venue_id:
        return default_venue_id

    if session.venue_name and not _is_unknown_venue(session.venue_name):
        place_data = {
            "name": session.venue_name,
            "slug": slugify(session.venue_name),
            "address": session.venue_address,
            "city": session.venue_city or "Atlanta",
            "state": session.venue_state or "GA",
            "zip": session.venue_postal_code,
            "website": session.venue_website,
        }
        venue_id = get_or_create_place(place_data)
        if isinstance(venue_id, int) and venue_id > 0:
            return venue_id
        return None

    return None


def _find_existing_festival_session(
    source_id: int,
    title: str,
    start_date: str,
    start_time: Optional[str],
    source_url: Optional[str],
) -> Optional[dict]:
    """Find an existing same-source session by stable logical key."""
    client = get_client()
    query = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("title", title)
        .eq("start_date", start_date)
    )

    if start_time:
        query = query.eq("start_time", start_time)
    else:
        query = query.is_("start_time", "null")

    rows = query.execute().data or []
    if source_url:
        exact_source_rows = [row for row in rows if row.get("source_url") == source_url]
        if exact_source_rows:
            rows = exact_source_rows
    if not rows:
        return None

    rows.sort(
        key=lambda row: (
            row.get("canonical_event_id") is not None,
            row.get("is_active") is not True,
            int(row.get("id") or 0),
        )
    )
    return rows[0]


def _session_label(session: SessionData) -> str:
    combined = " ".join(
        part
        for part in [
            session.title,
            session.program_track,
            session.venue_name,
            " ".join(session.tags),
        ]
        if part
    ).lower()

    if "registration" in combined or "check-in" in combined:
        return "registration window"
    if "network" in combined or "meetup" in combined:
        return "networking meetup"
    if "party" in combined:
        return "festival party"
    if "workshop" in combined:
        return "festival workshop"
    if "panel" in combined:
        return "festival panel"
    if "screening" in combined or session.category == "film":
        return "festival screening"
    if session.category == "music":
        return "festival music session"
    if session.category == "comedy":
        return "festival comedy set"
    if session.category == "words":
        return "festival spoken-word session"
    return "festival session"


def _build_factual_festival_session_description(
    session: SessionData,
    festival_name: str,
) -> Optional[str]:
    existing = _clean_description_text(session.description)
    if existing and len(existing) >= 100:
        return existing

    page_summary = None
    if session.source_url and (not existing or len(existing) < 100):
        candidate_summary = _get_page_summary(session.source_url, render_js=False)
        if candidate_summary and (
            not existing or len(candidate_summary) > len(existing)
        ):
            page_summary = candidate_summary

    title = (session.title or "").strip()
    festival = (festival_name or "").strip() or "the festival"
    label = _session_label(session)
    formatted_start_time = None
    if session.start_time:
        start_text = str(session.start_time).strip()
        time_match = re.match(r"^(\d{1,2}:\d{2})(?::\d{2})?$", start_text)
        formatted_start_time = time_match.group(1) if time_match else start_text

    if title and title.lower() == festival.lower():
        lead = f"{festival} is part of the published {festival} schedule."
    elif title:
        lead = f"{title} is a {label} during {festival}."
    else:
        lead = f"This is a {label} during {festival}."

    parts = [lead]
    if session.venue_name:
        parts.append(f"Location: {session.venue_name}.")
    if session.program_track and session.program_track != session.venue_name:
        parts.append(f"Track: {session.program_track}.")
    if formatted_start_time and not session.is_all_day:
        parts.append(f"Scheduled start: {formatted_start_time}.")
    if page_summary:
        parts.append(page_summary)
    if existing and not page_summary and len(existing) >= 40:
        parts.append(existing)

    return _clean_description_text(" ".join(parts))


def _extract_page_year(html: str, fallback_year: Optional[int] = None) -> int:
    fallback = fallback_year or datetime.utcnow().year
    soup = BeautifulSoup(html, "lxml")

    candidates: list[str] = []
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    if title:
        candidates.append(title)

    for attrs in (
        {"property": "og:title"},
        {"name": "twitter:title"},
        {"name": "description"},
        {"property": "og:description"},
    ):
        meta = soup.find("meta", attrs=attrs)
        if meta and meta.get("content"):
            candidates.append(str(meta["content"]))

    for text in candidates:
        years = [int(match) for match in re.findall(r"\b(20\d{2})\b", text)]
        if years:
            return max(years)
    return fallback


def _parse_month_day_tab_label(label: str, year: int) -> Optional[str]:
    cleaned = re.sub(r"\s+", " ", (label or "").strip())
    if not cleaned:
        return None
    for fmt in ("%b %d %Y", "%B %d %Y"):
        try:
            return datetime.strptime(f"{cleaned} {year}", fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def extract_sessions_tabbed_button_schedule(
    html: str, base_url: str
) -> list[SessionData]:
    """Extract sessions from tabbed Radix/React schedules like Render ATL."""
    soup = BeautifulSoup(html, "lxml")
    tabs = soup.find_all(attrs={"role": "tab"})
    if not tabs:
        return []

    year = _extract_page_year(html)
    sessions: list[SessionData] = []

    for tab in tabs:
        tab_label = tab.get_text(" ", strip=True)
        start_date = _parse_month_day_tab_label(tab_label, year)
        panel_id = tab.get("aria-controls")
        if not start_date or not panel_id:
            continue

        panel = soup.find(id=panel_id)
        if not panel:
            continue

        for row in panel.find_all(attrs={"role": "button"}):
            cols = row.find_all("div", recursive=False)
            if len(cols) < 3:
                continue

            time_text = cols[0].get_text(" ", strip=True)
            title = cols[1].get_text(" ", strip=True)
            venue_name = cols[2].get_text(" ", strip=True)
            if not title or len(title) < 3:
                continue

            start_time, end_time = (None, None)
            if "tbd" not in time_text.lower():
                start_time, end_time = _parse_time_range_text(time_text)

            program_track = None
            if len(cols) >= 4:
                program_track = cols[3].get_text(" ", strip=True) or None

            title_lower = title.lower()
            if "registration opens" in title_lower:
                continue

            sessions.append(
                SessionData(
                    title=title,
                    start_date=start_date,
                    start_time=start_time,
                    end_time=end_time,
                    venue_name=venue_name or None,
                    program_track=program_track,
                    source_url=base_url,
                )
            )

    logger.info(f"Tabbed button schedule: extracted {len(sessions)} sessions")
    return sessions


# ---------------------------------------------------------------------------
# Session insertion
# ---------------------------------------------------------------------------


def insert_sessions(
    sessions: list[SessionData],
    festival_slug: str,
    festival_name: str,
    source_id: int,
    default_venue_id: Optional[int] = None,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """Batch insert sessions with dedup. Returns (found, new, skipped)."""
    found = len(sessions)
    new = 0
    skipped = 0

    for session in sessions:
        # Resolve venue name
        hash_scope = session.source_url or festival_name
        hash_title = session.title
        # Festival programs can repeat with identical title/date at different times.
        if session.start_time:
            hash_title = f"{hash_title} {session.start_time}"
        content_hash = generate_content_hash(hash_title, hash_scope, session.start_date)

        existing = find_event_by_hash(content_hash)
        if existing and existing.get("canonical_event_id") is not None:
            existing = None
        if not existing:
            existing = _find_existing_festival_session(
                source_id=source_id,
                title=session.title,
                start_date=session.start_date,
                start_time=session.start_time,
                source_url=session.source_url,
            )

        if dry_run:
            if existing:
                logger.info(
                    f"[DRY RUN] Would update existing: {session.title} | "
                    f"{session.start_date} {session.start_time or '??:??'}"
                )
                skipped += 1
                continue
            logger.info(
                f"[DRY RUN] Would insert: {session.title} | "
                f"{session.start_date} {session.start_time or '??:??'} | "
                f"venue={session.venue_name or 'default'} | "
                f"category={session.category}"
            )
            new += 1
            continue

        try:
            venue_id = resolve_session_venue(
                session,
                festival_slug,
                festival_name=festival_name,
                default_venue_id=default_venue_id,
            )
        except ValueError as e:
            logger.warning(f"Skipping session (no venue): {e}")
            skipped += 1
            continue

        # Build series hint for festival program linking
        series_hint = {
            "series_type": "festival_program",
            "series_title": _build_festival_program_series_title(
                session, festival_name
            ),
            "festival_name": festival_name,
        }

        description = _build_factual_festival_session_description(
            session, festival_name
        )

        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": session.title,
            "description": description,
            "start_date": session.start_date,
            "start_time": session.start_time,
            "end_date": None,
            "end_time": session.end_time,
            "is_all_day": session.is_all_day,
            "category": session.category,
            "tags": session.tags,
            "is_free": False,
            "source_url": session.source_url,
            "ticket_url": session.ticket_url,
            "image_url": session.image_url,
            "content_hash": content_hash,
            "is_recurring": False,
        }

        try:
            insert_event(event_record, series_hint=series_hint)
            if existing:
                skipped += 1
                logger.info(
                    "Updated existing festival session via insert pipeline: %s on %s",
                    session.title,
                    session.start_date,
                )
            else:
                new += 1
                logger.info(f"Added: {session.title} on {session.start_date}")
        except Exception as e:
            logger.error(f"Failed to insert {session.title}: {e}")
            skipped += 1

    return found, new, skipped


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------


def crawl_festival_schedule(
    slug: str,
    url: str,
    render_js: bool = False,
    use_llm: bool = False,
    dry_run: bool = False,
    llm_provider: Optional[str] = None,
    llm_model: Optional[str] = None,
) -> tuple[int, int, int]:
    """
    Crawl a festival schedule page and insert sessions.

    Args:
        slug: Festival source slug (must exist in sources table)
        url: Schedule page URL
        render_js: Use Playwright for JS-rendered pages
        use_llm: Force LLM extraction instead of structured parsing
        dry_run: Log what would be inserted without writing to DB
        llm_provider: Optional provider override ("openai" | "anthropic")
        llm_model: Optional model override for the selected provider

    Returns:
        (sessions_found, sessions_new, sessions_skipped)
    """
    # Look up source
    source = get_source_by_slug(slug)
    if not source:
        logger.error(f"Source not found: {slug}")
        sys.exit(1)

    source_id = source["id"]
    festival_name = source.get("name", slug)

    # Resolve default venue from source (if the festival has a "home" venue)
    default_venue_id = source.get("venue_id")

    logger.info(f"Crawling festival schedule: {festival_name} ({slug})")
    logger.info(f"URL: {url}")
    logger.info(f"Options: render_js={render_js}, use_llm={use_llm}, dry_run={dry_run}")

    # Fetch page
    html = fetch_html(url, render_js=render_js)
    logger.info(f"Fetched {len(html):,} bytes")

    # Extract sessions using available strategies
    sessions: list[SessionData] = []
    used_llm = False

    if use_llm:
        used_llm = True
        sessions = _extract_sessions_llm_with_provider(
            html=html,
            url=url,
            festival_name=festival_name,
            slug=slug,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
    else:
        # Try strategies in order of quality
        sessions = extract_sessions_conjuration_homepage(html, url)

        if not sessions:
            sessions = extract_sessions_jsonld(html, url)

        if not sessions:
            sessions = extract_sessions_wp_events_calendar(html, url)

        if not sessions:
            sessions = extract_sessions_atl_science_festival_grid(html, url)

        if not sessions:
            sessions = extract_sessions_html_table(html, url)

        if not sessions:
            sessions = extract_sessions_tabbed_button_schedule(html, url)

        if not sessions:
            sessions = extract_sessions_collect_a_con_page(html, url)

        if not sessions:
            sessions = extract_sessions_blade_show_schedule(html, url)

        if not sessions:
            sessions = extract_sessions_toylanta_schedule(html, url)

        if not sessions:
            sessions = extract_sessions_southeastern_stamp_expo_homepage(html, url)

        if not sessions:
            sessions = extract_sessions_atlanta_pen_show_schedule(html, url)

        if not sessions:
            sessions = extract_sessions_ipms_event_page(html, url)

        if not sessions:
            logger.info("No structured data found, falling back to LLM extraction")
            used_llm = True
            sessions = _extract_sessions_llm_with_provider(
                html=html,
                url=url,
                festival_name=festival_name,
                slug=slug,
                llm_provider=llm_provider,
                llm_model=llm_model,
            )

    if used_llm and sessions:
        page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
        sessions, gate_reasons = _apply_llm_quality_gate(
            sessions,
            festival_name,
            page_text=page_text,
        )
        if gate_reasons:
            logger.info("LLM quality gate (%s): %s", slug, "; ".join(gate_reasons))

    if not sessions:
        logger.warning(f"No sessions extracted from {url}")
        return 0, 0, 0

    logger.info(f"Extracted {len(sessions)} sessions from {url}")

    # Insert sessions
    found, new, skipped = insert_sessions(
        sessions,
        festival_slug=slug,
        festival_name=festival_name,
        source_id=source_id,
        default_venue_id=default_venue_id,
        dry_run=dry_run,
    )

    logger.info(
        f"Festival schedule crawl complete: {found} found, {new} new, {skipped} skipped"
    )
    return found, new, skipped


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Crawl a festival schedule page for program sessions"
    )
    parser.add_argument("--slug", required=True, help="Festival source slug")
    parser.add_argument("--url", required=True, help="Schedule page URL")
    parser.add_argument(
        "--render-js", action="store_true", help="Use Playwright for JS rendering"
    )
    parser.add_argument("--use-llm", action="store_true", help="Force LLM extraction")
    parser.add_argument(
        "--llm-provider",
        choices=["openai", "anthropic"],
        help="Override LLM provider for this run",
    )
    parser.add_argument(
        "--llm-model", help="Override model name for the selected provider"
    )
    parser.add_argument("--dry-run", action="store_true", help="Log without inserting")
    parser.add_argument("--verbose", action="store_true", help="Enable debug logging")

    args = parser.parse_args()

    setup_logging()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    crawl_festival_schedule(
        slug=args.slug,
        url=args.url,
        render_js=args.render_js,
        use_llm=args.use_llm,
        dry_run=args.dry_run,
        llm_provider=args.llm_provider,
        llm_model=args.llm_model,
    )


if __name__ == "__main__":
    main()
