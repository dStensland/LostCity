"""Shared description extraction helpers for crawler detail pages."""

from __future__ import annotations

import json
import logging
import re
from typing import Iterable, Optional

from bs4 import BeautifulSoup

from description_quality import classify_description

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_LENGTH = 2000

COMMON_DESCRIPTION_SELECTORS = [
    ".event-description",
    ".event-details",
    ".event-content",
    ".event-info",
    "[class*='description']",
    "[class*='event-detail']",
    ".show-description",
    ".production-description",
    ".performance-details",
    ".show-info",
    ".show-content",
    ".production-info",
    ".production-content",
    ".synopsis",
    "[class*='synopsis']",
    "[class*='show-detail']",
    "[class*='production-detail']",
    ".SpktxContent",
    ".event-description-text",
    ".pm-event-description",
    ".pm-production-description",
    ".show-about",
    ".event-about",
    ".comedian-bio",
    ".artist-bio",
    ".performer-info",
    ".act-description",
    "article .content",
    ".entry-content",
    ".post-content",
    ".body-text",
    ".page-content",
]

PARAGRAPH_CONTAINER_SELECTORS = ["main", "article", "body"]


def clean_description_text(text: Optional[str]) -> str:
    """Collapse whitespace and strip leaked markup."""
    if not text:
        return ""
    normalized = re.sub(r"<[^>]+>", " ", str(text))
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def is_useful_description(text: Optional[str]) -> bool:
    """Reject boilerplate, schedule sludge, and institution copy."""
    if not text or len(text) < 20:
        return False

    normalized = clean_description_text(text)
    if not normalized:
        return False
    if classify_description(normalized) != "good":
        return False

    lower = normalized.lower()

    boilerplate = [
        "skip to content",
        "cookie policy",
        "privacy policy",
        "terms of service",
        "sign up for our newsletter",
        "follow us on",
        "all rights reserved",
        "powered by",
        "javascript is required",
        "please enable javascript",
        "loading...",
        "page not found",
        "404",
    ]
    for phrase in boilerplate:
        if lower.startswith(phrase):
            return False

    schedule_noise_terms = [
        "sort shows by",
        "show calendar",
        "calendar view",
        "upcoming shows",
        "buy tickets",
        "more info",
        "view details",
        "load more",
        "filter by",
        "all shows",
    ]
    noise_hits = sum(1 for term in schedule_noise_terms if term in lower)
    if noise_hits >= 3:
        return False

    if lower.count("more info") >= 2 or lower.count("buy tickets") >= 2:
        return False

    date_time_fragments = len(
        re.findall(r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b", lower)
    )
    meridiem_fragments = lower.count(" am") + lower.count(" pm")
    if len(normalized) > 220 and date_time_fragments >= 3 and meridiem_fragments >= 3:
        return False

    tokens = re.findall(r"[a-z0-9]+", lower)
    if len(tokens) >= 80:
        unique_ratio = len(set(tokens)) / len(tokens)
        if unique_ratio < 0.35:
            return False

    return True


def extract_jsonld_description(html: str) -> Optional[str]:
    """Extract the first useful JSON-LD description from raw HTML."""
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            description = clean_description_text(item.get("description"))
            if is_useful_description(description):
                return description[:MAX_DESCRIPTION_LENGTH]
    return None


def _extract_from_selectors(
    soup: BeautifulSoup,
    selectors: Iterable[str],
) -> Optional[str]:
    for selector in selectors:
        for element in soup.select(selector):
            text = clean_description_text(element.get_text(" ", strip=True))
            if is_useful_description(text):
                return text[:MAX_DESCRIPTION_LENGTH]
    return None


def _extract_from_paragraphs(
    soup: BeautifulSoup,
    container_selectors: Iterable[str],
) -> Optional[str]:
    for selector in container_selectors:
        container = soup.select_one(selector)
        if not container:
            continue

        paragraphs: list[str] = []
        for paragraph in container.find_all("p"):
            text = clean_description_text(paragraph.get_text(" ", strip=True))
            if not is_useful_description(text):
                continue
            paragraphs.append(text)
            combined = " ".join(paragraphs)
            if len(combined) >= MAX_DESCRIPTION_LENGTH:
                return combined[:MAX_DESCRIPTION_LENGTH]

        if paragraphs:
            return " ".join(paragraphs)[:MAX_DESCRIPTION_LENGTH]

    return None


def extract_description_from_html(
    html: str,
    *,
    preferred_selectors: Optional[Iterable[str]] = None,
    fallback_selectors: Optional[Iterable[str]] = None,
    paragraph_container_selectors: Optional[Iterable[str]] = None,
) -> Optional[str]:
    """Extract the best grounded description from an event detail page."""
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    if preferred_selectors:
        preferred = _extract_from_selectors(soup, preferred_selectors)
        if preferred:
            return preferred

    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        text = clean_description_text(og_desc["content"])
        if is_useful_description(text):
            return text[:MAX_DESCRIPTION_LENGTH]

    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        text = clean_description_text(meta_desc["content"])
        if is_useful_description(text):
            return text[:MAX_DESCRIPTION_LENGTH]

    jsonld_desc = extract_jsonld_description(html)
    if jsonld_desc:
        return jsonld_desc

    selectors = list(fallback_selectors or COMMON_DESCRIPTION_SELECTORS)
    fallback = _extract_from_selectors(soup, selectors)
    if fallback:
        return fallback

    containers = list(paragraph_container_selectors or PARAGRAPH_CONTAINER_SELECTORS)
    return _extract_from_paragraphs(soup, containers)


def sanitize_description(
    description: Optional[str],
    *,
    leading_patterns: Optional[Iterable[str]] = None,
    stop_markers: Optional[Iterable[str]] = None,
) -> Optional[str]:
    """Strip scaffold text from otherwise real source descriptions."""
    cleaned = clean_description_text(description)
    if not cleaned:
        return None

    for pattern in leading_patterns or ():
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    if stop_markers:
        cleaned = re.split(
            r"\b(?:%s)\b" % "|".join(re.escape(marker) for marker in stop_markers),
            cleaned,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]

    cleaned = clean_description_text(cleaned)
    if not cleaned:
        return None
    return cleaned


def fetch_description_from_url(
    url: str,
    *,
    session=None,
    timeout: float = 15.0,
    preferred_selectors: Optional[Iterable[str]] = None,
    fallback_selectors: Optional[Iterable[str]] = None,
    paragraph_container_selectors: Optional[Iterable[str]] = None,
) -> Optional[str]:
    """Fetch a detail URL and extract the best description from its HTML."""
    if not url:
        return None

    try:
        if session is not None:
            response = session.get(url, timeout=timeout)
            html = response.text
        else:
            import httpx

            with httpx.Client(
                timeout=timeout,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36"
                    )
                },
                follow_redirects=True,
            ) as client:
                response = client.get(url)
                html = response.text

        return extract_description_from_html(
            html,
            preferred_selectors=preferred_selectors,
            fallback_selectors=fallback_selectors,
            paragraph_container_selectors=paragraph_container_selectors,
        )
    except Exception as exc:
        logger.debug(f"Failed to fetch description from {url}: {exc}")
        return None


def fetch_description_playwright(
    page,
    url: str,
    *,
    preferred_selectors: Optional[Iterable[str]] = None,
    fallback_selectors: Optional[Iterable[str]] = None,
    paragraph_container_selectors: Optional[Iterable[str]] = None,
) -> Optional[str]:
    """Fetch a detail URL in Playwright and extract the best description."""
    if not url:
        return None

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)
        html = page.content()
        return extract_description_from_html(
            html,
            preferred_selectors=preferred_selectors,
            fallback_selectors=fallback_selectors,
            paragraph_container_selectors=paragraph_container_selectors,
        )
    except Exception as exc:
        logger.debug(f"Failed to fetch description via Playwright from {url}: {exc}")
        return None


def fetch_detail_html_playwright(page, url: str) -> Optional[str]:
    """Fetch a detail URL in Playwright and return raw HTML."""
    if not url:
        return None

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)
        return page.content()
    except Exception as exc:
        logger.debug(f"Failed to fetch HTML via Playwright from {url}: {exc}")
        return None
