"""
Heuristic extraction for event detail pages.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from description_fetcher import extract_description_from_html
from extractors.lineup import split_lineup_text

logger = logging.getLogger(__name__)


def _find_ticket_url(soup: BeautifulSoup) -> Optional[str]:
    ticket_keywords = [
        "tickets", "ticket", "buy", "purchase", "register", "rsvp", "reserve"
    ]
    for a in soup.find_all("a"):
        text = (a.get_text() or "").strip().lower()
        href = a.get("href")
        if not href:
            continue
        if any(kw in text for kw in ticket_keywords):
            return href.strip()
    return None


def _find_image_url(soup: BeautifulSoup) -> Optional[str]:
    # Prefer obvious hero/event images first
    selectors = [
        "img.event-image",
        "img.event__image",
        ".event-hero img",
        ".event-image img",
        ".hero img",
        "img[class*='event']",
    ]
    for selector in selectors:
        img = soup.select_one(selector)
        if img and img.get("src"):
            return img["src"].strip()

    # Fallback to the first reasonably sized image
    for img in soup.find_all("img"):
        src = img.get("src")
        if not src:
            continue
        width = img.get("width") or ""
        height = img.get("height") or ""
        if width and height:
            try:
                if int(width) < 200 or int(height) < 200:
                    continue
            except ValueError:
                pass
        return src.strip()
    return None


def _find_price_note(text: str) -> Optional[str]:
    if not text:
        return None
    match = re.search(r"\$\s?\d{1,4}(?:\.\d{2})?", text)
    if match:
        return match.group(0)
    return None


def _find_lineup_text(soup: BeautifulSoup) -> Optional[str]:
    selectors = [
        ".lineup",
        ".line-up",
        ".artist-list",
        ".artists",
        ".performers",
        ".support",
        ".supporting",
        ".openers",
        ".opening",
        "[class*='lineup']",
        "[id*='lineup']",
        "[class*='performer']",
        "[id*='performer']",
    ]
    for selector in selectors:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text(" ", strip=True)
            if text and len(text) < 300:
                return text
    return None


def extract_heuristic_fields(html: str) -> dict:
    """Extract description, ticket_url, image_url, price_note from HTML."""
    if not html:
        return {}

    soup = BeautifulSoup(html, "lxml")
    result: dict = {}

    description = extract_description_from_html(html)
    if description:
        result["description"] = description

    ticket_url = _find_ticket_url(soup)
    if ticket_url:
        result["ticket_url"] = ticket_url

    image_url = _find_image_url(soup)
    if image_url:
        result["image_url"] = image_url

    lineup_text = _find_lineup_text(soup)
    if lineup_text:
        artists = split_lineup_text(lineup_text)
        if artists:
            result["artists"] = artists

    # Optional lightweight price note
    text = soup.get_text(" ", strip=True)
    price_note = _find_price_note(text)
    if price_note:
        result["price_note"] = price_note

    if text and "free" in text.lower():
        result["is_free"] = True

    return result
