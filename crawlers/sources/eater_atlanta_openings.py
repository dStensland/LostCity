"""
Crawler for Eater Atlanta restaurant openings.

Uses Eater's openings RSS feed to capture newly announced restaurant launches.
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_client,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
    update_event,
)
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://atlanta.eater.com"
OPENINGS_FEED_URL = f"{BASE_URL}/rss/openings/index.xml"

AGGREGATE_VENUE_DATA = {
    "name": "Atlanta Restaurant Scene",
    "slug": "atlanta-restaurant-scene",
    "address": None,
    "neighborhood": "Atlanta",
    "city": "Atlanta",
    "state": "GA",
    "zip": None,
    "venue_type": "organization",
    "website": BASE_URL,
}

ROUNDUP_TITLE_MARKERS = (
    "highly anticipated restaurant openings",
    "hottest new restaurants",
    "new restaurants in atlanta",
    "restaurant openings in atlanta",
    "where to eat",
    "best new restaurants",
)
GENERIC_NAME_CANDIDATES = {
    "new restaurant",
    "new restaurants",
    "restaurant",
    "restaurants",
    "new cafe",
    "cafe",
    "new bar",
    "bar",
    "atlanta restaurant",
    "atlanta restaurants",
}
KNOWN_NEIGHBORHOODS = (
    "Atlantic Station",
    "Buckhead",
    "Downtown",
    "Grant Park",
    "Inman Park",
    "Midtown",
    "Old Fourth Ward",
    "Poncey-Highland",
    "Summerhill",
    "Virginia-Highland",
    "West End",
)
NAME_PATTERN = r"[A-Z0-9][A-Za-z0-9&'.\-\u2019]*(?:\s+[A-Z0-9][A-Za-z0-9&'.\-\u2019]*){0,5}"
NAME_PATTERNS = (
    re.compile(rf"\b(?:named|called)\s+(?P<name>{NAME_PATTERN})"),
    re.compile(rf"\b(?:First Look at|Inside)\s+(?P<name>{NAME_PATTERN})(?::|,|$)"),
    re.compile(
        rf"\b(?P<name>{NAME_PATTERN})\s+will\s+"
        r"(?:open|replace|reopen|take over|occupy|launch|debut)"
    ),
    re.compile(rf"\b(?P<name>{NAME_PATTERN})\s+(?:is|are)\s+taking over\b"),
    re.compile(rf"\b(?P<name>{NAME_PATTERN})\s+(?:to|will)\s+reopen\b"),
    re.compile(rf"\b(?P<name>{NAME_PATTERN})\s+(?:[Oo]pens?|[Dd]ebuts?)\s+in\b"),
)
MONTH_NAME_PATTERN = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}$",
    flags=re.IGNORECASE,
)


@dataclass
class ArticleMetadata:
    image_url: Optional[str]
    meta_description: str
    lead_text: str
    emphasized_terms: list[str]


def clean_text(value: str) -> str:
    """Decode entities and normalize whitespace."""
    if not value:
        return ""
    text = html.unescape(value)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_html(value: str) -> str:
    """Strip HTML tags from text snippets."""
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    return clean_text(soup.get_text(" ", strip=True))


def parse_published_date(entry: feedparser.FeedParserDict) -> Optional[str]:
    """Return entry publish date in YYYY-MM-DD format."""
    published = entry.get("published", "")
    try:
        if published:
            dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    published_parsed = entry.get("published_parsed")
    if published_parsed:
        try:
            dt = datetime(
                published_parsed.tm_year,
                published_parsed.tm_mon,
                published_parsed.tm_mday,
            )
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return None

    return None


def extract_image_from_html(html_snippet: str) -> Optional[str]:
    """Extract first image src from an HTML snippet."""
    if not html_snippet:
        return None
    soup = BeautifulSoup(html_snippet, "html.parser")
    img = soup.find("img")
    if not img:
        return None
    src = img.get("src")
    if not src:
        return None
    return src.strip()


def normalize_name_candidate(raw_value: str) -> Optional[str]:
    """Return a cleaned candidate restaurant name or None if too generic."""
    value = clean_text(raw_value).replace("\u2019", "'")
    # Drop accidental prior-sentence carryover (e.g., "Allora. Ikara").
    value = re.sub(r"^[A-Z][A-Za-z]{3,}\.\s+", "", value)
    value = re.sub(r"^[\"'`“”‘’\s\(\)\[\]]+|[\"'`“”‘’\s,.;:!?]+$", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    if not value:
        return None

    words = value.split()
    if len(words) > 6 or len(value) < 2 or len(value) > 72:
        return None

    lowered = value.lower()
    if lowered in GENERIC_NAME_CANDIDATES:
        return None

    if MONTH_NAME_PATTERN.match(value):
        return None

    if lowered.startswith(("a ", "an ")) and any(
        token in lowered for token in ("restaurant", "cafe", "bar", "dining")
    ):
        return None

    if words[-1].lower() in {"team", "restaurant", "restaurants", "space", "opening"}:
        return None

    if not re.search(r"[A-Za-z]", value):
        return None

    return value


def parse_name_candidates(text: str) -> list[str]:
    """Extract candidate venue names from article text."""
    if not text:
        return []
    candidates: list[str] = []
    for pattern in NAME_PATTERNS:
        for match in pattern.finditer(text):
            candidate = normalize_name_candidate(match.group("name"))
            if candidate:
                candidates.append(candidate)
    return candidates


def extract_name_from_url(article_url: str) -> Optional[str]:
    """Extract a fallback venue name from an Eater slug."""
    try:
        last_segment = urlparse(article_url).path.rstrip("/").split("/")[-1]
    except Exception:
        return None

    if not last_segment:
        return None

    marker_patterns = (
        r"-named-([a-z0-9\-]+)",
        r"-called-([a-z0-9\-]+)",
        r"-restaurant-([a-z0-9\-]+)",
        r"-cafe-([a-z0-9\-]+)",
        r"-bar-([a-z0-9\-]+)",
    )
    for marker in marker_patterns:
        match = re.search(marker, last_segment)
        if not match:
            continue
        raw = match.group(1)
        raw = re.split(r"-(?:in|at|for|to)-", raw)[0]
        raw = re.sub(r"-(?:atlanta|georgia)$", "", raw)
        maybe_name = normalize_name_candidate(clean_text(raw.replace("-", " ").title()))
        if maybe_name:
            return maybe_name
    return None


def is_roundup_article(title: str, description: str) -> bool:
    """Detect broad roundup/list stories where a single venue is not appropriate."""
    lowered = title.lower()
    if any(marker in lowered for marker in ROUNDUP_TITLE_MARKERS):
        return True

    if re.match(r"^\d+\s+", lowered) and "restaurant" in lowered:
        return True

    if "openings" in lowered and "atlanta" in lowered and "restaurant" in lowered:
        return True

    # Roundup blurbs often contain multiple semicolon-separated venues.
    if description.count(";") >= 2 and "open" in description.lower():
        return True

    return False


def extract_neighborhood_hint(*text_fragments: str) -> Optional[str]:
    """Extract a known neighborhood/designator from source text."""
    combined = " ".join(fragment for fragment in text_fragments if fragment).lower()
    for neighborhood in KNOWN_NEIGHBORHOODS:
        if neighborhood.lower() in combined:
            return neighborhood
    return None


def fetch_article_metadata(
    url: str,
    session: requests.Session,
    cache: dict[str, ArticleMetadata],
) -> ArticleMetadata:
    """Fetch article metadata used for image and venue inference."""
    if url in cache:
        return cache[url]

    metadata = ArticleMetadata(
        image_url=None,
        meta_description="",
        lead_text="",
        emphasized_terms=[],
    )

    try:
        response = session.get(url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        og = soup.find("meta", attrs={"property": "og:image"})
        if og and og.get("content"):
            metadata.image_url = og["content"].strip()
        if not metadata.image_url:
            tw = soup.find("meta", attrs={"name": "twitter:image"})
            if tw and tw.get("content"):
                metadata.image_url = tw["content"].strip()

        description_meta = soup.find("meta", attrs={"name": "description"})
        if description_meta and description_meta.get("content"):
            metadata.meta_description = clean_text(description_meta["content"])

        article_body = (
            soup.select_one("div.c-entry-content")
            or soup.select_one("div[data-chorus-optimize-field='entry_content']")
            or soup.select_one("article")
        )
        if article_body:
            lead_parts: list[str] = []
            for paragraph in article_body.select("p"):
                paragraph_text = clean_text(paragraph.get_text(" ", strip=True))
                if len(paragraph_text) < 30:
                    continue
                lead_parts.append(paragraph_text)
                if len(lead_parts) >= 2:
                    break
            metadata.lead_text = " ".join(lead_parts)

            for node in article_body.select("strong, b, em"):
                candidate = normalize_name_candidate(node.get_text(" ", strip=True))
                if candidate:
                    metadata.emphasized_terms.append(candidate)
                if len(metadata.emphasized_terms) >= 8:
                    break
    except Exception as e:
        logger.debug(f"Failed to fetch metadata for {url}: {e}")

    cache[url] = metadata
    return metadata


def select_restaurant_name(
    title: str,
    description: str,
    article_url: str,
    article_meta: ArticleMetadata,
) -> Optional[str]:
    """Infer a single restaurant name for venue assignment."""
    if is_roundup_article(title, description):
        return None

    scored_candidates: dict[str, int] = {}

    for emphasized in article_meta.emphasized_terms:
        scored_candidates[emphasized] = max(scored_candidates.get(emphasized, 0), 100)

    text_for_patterns = " ".join(
        chunk
        for chunk in (
            article_meta.meta_description,
            description,
            article_meta.lead_text,
            title,
        )
        if chunk
    )
    for candidate in parse_name_candidates(text_for_patterns):
        bonus = 8 if len(candidate.split()) <= 3 else 0
        scored_candidates[candidate] = max(scored_candidates.get(candidate, 0), 75 + bonus)

    url_candidate = extract_name_from_url(article_url)
    if url_candidate:
        scored_candidates[url_candidate] = max(scored_candidates.get(url_candidate, 0), 60)

    if not scored_candidates:
        return None

    best_name = max(
        scored_candidates.items(),
        key=lambda item: (item[1], len(item[0])),
    )[0]
    return best_name


def build_venue_data(
    title: str,
    description: str,
    article_url: str,
    article_meta: ArticleMetadata,
) -> tuple[dict, bool]:
    """Return venue payload and whether it's a specific restaurant venue."""
    restaurant_name = select_restaurant_name(title, description, article_url, article_meta)
    if not restaurant_name:
        return AGGREGATE_VENUE_DATA, False

    neighborhood = extract_neighborhood_hint(
        title,
        description,
        article_meta.meta_description,
        article_meta.lead_text,
    ) or "Atlanta"

    return {
        "name": restaurant_name,
        "slug": slugify(restaurant_name)[:72],
        "address": None,
        "neighborhood": neighborhood,
        "city": "Atlanta",
        "state": "GA",
        "zip": None,
        "venue_type": "restaurant",
        "website": article_url,
    }, True


def find_event_by_source_url(source_id: int, source_url: str) -> Optional[dict]:
    """Find an existing row from this source by the canonical article URL."""
    try:
        client = get_client()
        result = (
            client.table("events")
            .select("*")
            .eq("source_id", source_id)
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
    except Exception as e:
        logger.debug("Source URL lookup failed for %s: %s", source_url, e)
    return None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Eater Atlanta openings RSS feed."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    aggregate_venue_id = get_or_create_venue(AGGREGATE_VENUE_DATA)
    venue_id_cache: dict[str, int] = {AGGREGATE_VENUE_DATA["slug"]: aggregate_venue_id}
    feed = feedparser.parse(OPENINGS_FEED_URL)

    if feed.bozo:
        logger.warning(f"Eater openings feed parse warning: {feed.bozo_exception}")

    entries = feed.entries or []
    logger.info(f"Eater openings feed returned {len(entries)} entries")

    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"})
    article_cache: dict[str, ArticleMetadata] = {}

    for entry in entries:
        try:
            title = clean_text(entry.get("title", ""))
            article_url = entry.get("link")
            start_date = parse_published_date(entry)

            if not title or not article_url or not start_date:
                continue

            summary_html = entry.get("summary", "")
            description = clean_html(summary_html)
            article_meta = fetch_article_metadata(article_url, session=session, cache=article_cache)

            image_url = extract_image_from_html(summary_html)
            if not image_url:
                image_url = article_meta.image_url

            venue_data, is_specific_venue = build_venue_data(
                title=title,
                description=description,
                article_url=article_url,
                article_meta=article_meta,
            )
            venue_slug = venue_data["slug"]
            if venue_slug in venue_id_cache:
                venue_id = venue_id_cache[venue_slug]
            else:
                venue_id = get_or_create_venue(venue_data)
                venue_id_cache[venue_slug] = venue_id

            events_found += 1

            # Keep the historical hash seed stable so old rows are updated in place.
            content_hash = generate_content_hash(title, AGGREGATE_VENUE_DATA["name"], start_date)
            existing = find_event_by_hash(content_hash) or find_event_by_source_url(source_id, article_url)

            tags = ["eater-atlanta", "restaurant-opening", "food", "opening"]
            for tag in entry.get("tags", []):
                term = clean_text(tag.get("term", "")).lower()
                if term:
                    tags.append(term.replace(" ", "-"))
            if not is_specific_venue:
                tags.append("opening-roundup")

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description or "Restaurant opening update from Eater Atlanta.",
                "start_date": start_date,
                "start_time": None,
                "end_date": None,
                "end_time": None,
                "is_all_day": True,
                "category": "food_drink",
                "subcategory": "restaurant-opening",
                "tags": list(dict.fromkeys(tags)),
                "price_min": None,
                "price_max": None,
                "price_note": None,
                "is_free": True,
                "source_url": article_url,
                "ticket_url": None,
                "image_url": image_url,
                "raw_text": description[:1000] if description else None,
                "extraction_confidence": 0.86 if is_specific_venue else 0.8,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            if existing:
                direct_updates: dict[str, object] = {}
                if existing.get("venue_id") != venue_id:
                    direct_updates["venue_id"] = venue_id
                if existing.get("content_hash") != content_hash:
                    direct_updates["content_hash"] = content_hash
                if direct_updates:
                    update_event(existing["id"], direct_updates)
                    existing = {**existing, **direct_updates}
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            insert_event(event_record)
            events_new += 1
            logger.info(f"Added Eater opening: {title}")

        except Exception as e:
            logger.error(f"Failed to process Eater entry: {e}", exc_info=True)
            continue

    logger.info(
        "Eater openings crawl complete: %s found, %s new, %s updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
