"""
Discovery-phase extraction from list pages using selectors.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from bs4 import BeautifulSoup
from dateutil import parser as dateparser

from extractors.selectors import extract_from_element
from pipeline.models import DiscoveryConfig, SelectorSet

logger = logging.getLogger(__name__)


def _parse_date(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    try:
        dt = dateparser.parse(text, fuzzy=True, default=datetime.now())
        if not dt:
            return None

        # If no explicit year and parsed date is in the past, roll to next year
        has_year = bool(re.search(r"\b(19|20)\d{2}\b", text))
        if not has_year:
            today = datetime.now().date()
            if dt.date() < today:
                dt = dt.replace(year=dt.year + 1)

        return dt.date().isoformat()
    except Exception:
        return None


def _parse_time(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    try:
        # Prefer the first time if a range is provided
        match = re.search(r"(\d{1,2}):?(\d{2})?\s*(AM|PM)", text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            minute = int(minute or 0)
            if period.upper() == "PM" and hour != 12:
                hour += 12
            elif period.upper() == "AM" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute:02d}"

        dt = dateparser.parse(text, fuzzy=True, default=datetime.now())
        if not dt:
            return None
        return dt.strftime("%H:%M")
    except Exception:
        return None


def _extract_fields(card, fields: SelectorSet) -> dict:
    data: dict = {}
    for field, spec in fields.model_dump().items():
        if not spec:
            continue
        value = extract_from_element(card, spec)
        if value:
            data[field] = value
    return data


def discover_from_list(html: str, config: DiscoveryConfig) -> list[dict]:
    """Extract event seeds from a list page."""
    if not html or not config.event_card:
        return []

    soup = BeautifulSoup(html, "lxml")
    cards = soup.select(config.event_card)
    if not cards:
        return []

    seeds: list[dict] = []
    for card in cards:
        data = _extract_fields(card, config.fields)
        if not data.get("title"):
            continue

        date_text = data.get("date")
        time_text = data.get("time")

        seed = {
            "title": data.get("title"),
            "start_date": _parse_date(date_text),
            "start_time": _parse_time(time_text),
            "detail_url": data.get("detail_url"),
            "ticket_url": data.get("ticket_url"),
            "image_url": data.get("image_url"),
            "raw_date": date_text,
            "raw_time": time_text,
        }

        seeds.append(seed)

    return seeds
