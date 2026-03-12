"""
Crawler for ThriftCon Atlanta.

Official source:
- The official Atlanta landing page publishes the venue, date, and public hours
  for the current cycle. This source should stay inactive until a future cycle
  is published.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SOURCE_URL = "https://tickets.thriftcon.co/landing/thriftcon-atlanta"
USER_AGENT = "Mozilla/5.0 (compatible; LostCityBot/1.0)"


def parse_official_page(html: str, today: date | None = None) -> dict:
    """Parse the current official ThriftCon Atlanta page."""
    today = today or datetime.now().date()
    page_text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

    title_match = re.search(r"ThriftCon Atlanta (\d{4})", page_text, re.IGNORECASE)
    stamp_match = re.search(r"(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})", page_text)
    hours_match = re.search(r"Saturday,\s*([A-Za-z]+\s+\d{1,2})\s*\|\s*(\d{1,2}am\s*-\s*\d{1,2}pm)", page_text, re.IGNORECASE)
    venue_match = re.search(r"ThriftCon Atlanta \d{4}\s+GICC\s+Saturday,", page_text, re.IGNORECASE)

    if not title_match or not stamp_match or not hours_match or not venue_match:
        raise ValueError("ThriftCon Atlanta page did not expose expected official details")

    year, month, day = map(int, stamp_match.groups()[:3])
    event_date = date(year, month, day)
    if event_date < today:
        raise ValueError("ThriftCon Atlanta official page only exposes a past-dated cycle")

    return {
        "title": f"ThriftCon Atlanta {title_match.group(1)}",
        "start_date": event_date.isoformat(),
        "venue_name": "Georgia International Convention Center",
        "hours": hours_match.group(2),
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Keep this source inactive until a future cycle is published."""
    response = requests.get(
        SOURCE_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    parse_official_page(response.text)
    raise ValueError("ThriftCon Atlanta source should remain inactive until the official page publishes a future cycle")
