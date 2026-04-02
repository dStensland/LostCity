"""
Crawler for Georgia Harm Reduction Coalition (gaharmreduction.org).

The Georgia Harm Reduction Coalition (GHRC) is a statewide organization dedicated
to promoting harm reduction strategies and providing services to people who use drugs
and their communities.

Site uses WordPress with server-rendered HTML event listings.
"""

from __future__ import annotations

from datetime import datetime
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from sources._tribe_events_html_base import (
    HtmlTribeConfig,
    crawl_html_tribe,
    parse_date_from_text,
    parse_time_from_text,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://georgiaharmreduction.org"
EVENTS_URL = f"{BASE_URL}/programs-services/training-services/"

PLACE_DATA = {
    "name": "Georgia Harm Reduction Coalition",
    "slug": "georgia-harm-reduction-coalition",
    "address": "230 Peachtree St NW, Suite 1700",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7590,
    "lng": -84.3880,
    "place_type": "organization",
    "spot_type": "organization",
    "website": BASE_URL,
}


def categorize_event(title: str, description: str) -> tuple[str, Optional[str], list[str]]:
    text = f"{title} {description}".lower()
    tags = ["harm-reduction", "community-health"]

    if any(
        kw in text
        for kw in [
            "naloxone",
            "narcan",
            "overdose prevention",
            "overdose response",
            "opioid reversal",
        ]
    ):
        tags.extend(["naloxone", "substance-abuse", "education"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "syringe",
            "needle exchange",
            "harm reduction supplies",
            "safer injection",
        ]
    ):
        tags.extend(["syringe-services", "substance-abuse"])
        return "wellness", "health_program", tags

    if any(
        kw in text
        for kw in [
            "outreach",
            "community event",
            "awareness",
            "advocacy",
            "community education",
        ]
    ):
        tags.extend(["outreach", "advocacy", "community"])
        return "community", "outreach", tags

    if any(
        kw in text
        for kw in [
            "training",
            "workshop",
            "seminar",
            "class",
            "education",
            "learn",
            "certification",
        ]
    ):
        tags.extend(["education", "workshop"])
        return "learning", "workshop", tags

    if any(
        kw in text
        for kw in [
            "support group",
            "peer support",
            "recovery support",
            "group meeting",
        ]
    ):
        tags.extend(["support-group", "substance-abuse"])
        return "wellness", "support_group", tags

    tags.append("education")
    return "community", "educational", tags


def _find_gahrc_containers(soup: BeautifulSoup) -> list:
    containers = soup.find_all("article", class_=re.compile(r"tribe-events|post-\d+"))
    if containers:
        return containers
    return soup.find_all("div", class_="tribe-event-schedule-details")


def _parse_gahrc_container(container, events_url: str) -> Optional[dict]:
    title_elem = container.find(["h2", "h3"], class_=re.compile(r"entry-title|tribe-events-list-event-title"))
    if not title_elem:
        title_elem = container.find("a", class_="tribe-event-url")
    if not title_elem:
        return None

    link_elem = title_elem.find("a") if getattr(title_elem, "name", None) != "a" else title_elem
    if not link_elem:
        return None

    title = link_elem.get_text(strip=True)
    event_url = link_elem.get("href", events_url)
    if not title:
        return None

    desc_elem = container.find(
        ["div", "p"],
        class_=re.compile(r"entry-content|tribe-events-list-event-description|excerpt"),
    )
    description = None
    if desc_elem:
        desc_text = desc_elem.get_text(" ", strip=True)
        desc_text = re.sub(r"\s*Read More\s*$", "", desc_text)
        description = desc_text if len(desc_text) > 10 else None

    date_elem = container.find(["time", "span"], class_=re.compile(r"tribe-event-date|published"))
    if not date_elem:
        return None

    start_date = None
    if date_elem.has_attr("datetime"):
        datetime_str = date_elem["datetime"]
        try:
            dt = datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
            start_date = dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    if not start_date:
        start_date = parse_date_from_text(date_elem.get_text(strip=True))
    if not start_date:
        return None

    start_time = None
    time_elem = container.find("span", class_=re.compile(r"tribe-event-time"))
    if time_elem:
        start_time = parse_time_from_text(time_elem.get_text(strip=True))

    return {
        "title": title,
        "event_url": event_url,
        "description": description,
        "start_date": start_date,
        "start_time": start_time,
        "end_time": None,
    }


_CONFIG = HtmlTribeConfig(
    events_url=EVENTS_URL,
    place_data=PLACE_DATA,
    categorize_event=categorize_event,
    container_finder=_find_gahrc_containers,
    container_parser=_parse_gahrc_container,
    free_markers=("free", "no cost", "no charge", "complimentary"),
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_html_tribe(source, _CONFIG)
