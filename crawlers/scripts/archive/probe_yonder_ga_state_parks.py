#!/usr/bin/env python3
"""
Probe Georgia State Parks provider handles for Yonder weekend anchors.

This is a read-only probe that extracts public ReserveAmerica park handles
from the campground directory page so we can move toward normalized
provider-backed inventory records.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/probe_yonder_ga_state_parks.py
    python3 scripts/probe_yonder_ga_state_parks.py --json
"""

from __future__ import annotations

import argparse
import json
import logging
import re
from dataclasses import asdict, dataclass
from html import unescape

import requests

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

DIRECTORY_URL = (
    "https://gastateparks.reserveamerica.com/camping/georgia/r/"
    "campgroundDirectoryList.do?contractCode=GA"
)
DIRECTORY_PAGE_URLS = [
    DIRECTORY_URL,
    f"{DIRECTORY_URL}&startIdx=25",
]

YONDER_GA_STATE_PARK_TARGETS = {
    "cloudland-canyon": "cloudland-canyon-state-park",
    "vogel-state-park": "vogel-state-park",
    "fort-mountain-state-park": "fort-mountain-state-park",
    "black-rock-mountain": "black-rock-mountain-state-park",
    "chattahoochee-bend-state-park": "chattahoochee-bend-state-park",
    "red-top-mountain-state-park": "red-top-mountain-state-park",
    "hard-labor-creek-state-park": "hard-labor-creek-state-park",
    "fort-yargo-state-park": "fort-yargo-state-park",
    "don-carter-state-park": "don-carter-state-park",
}


@dataclass
class ProviderParkProbe:
    yonder_slug: str
    provider_slug: str
    park_id: str
    details_url: str
    campsite_search_url: str
    unit_option_labels: list[str]


def fetch_directory_html() -> str:
    pages: list[str] = []
    for url in DIRECTORY_PAGE_URLS:
        response = requests.get(
            url,
            timeout=20,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        response.raise_for_status()
        pages.append(response.text)
    return "\n".join(pages)


def extract_probe(provider_slug: str, html: str) -> ProviderParkProbe | None:
    details_pattern = re.compile(
        rf'(/camping/{re.escape(provider_slug)}/r/campgroundDetails\.do\?contractCode=GA&parkId=(\d+))',
        re.IGNORECASE,
    )
    search_pattern = re.compile(
        rf'(/camping/{re.escape(provider_slug)}/r/campsiteSearch\.do\?[^"\']*?contractCode=GA&amp;parkId=(\d+)[^"\']*)',
        re.IGNORECASE,
    )

    details_match = details_pattern.search(html)
    search_match = search_pattern.search(html)

    if not details_match or not search_match:
        return None

    details_href, park_id = details_match.groups()
    search_href, search_park_id = search_match.groups()
    if park_id != search_park_id:
        raise ValueError(
            f"Park id mismatch for {provider_slug}: details={park_id} search={search_park_id}"
        )

    return ProviderParkProbe(
        yonder_slug="",
        provider_slug=provider_slug,
        park_id=park_id,
        details_url=f"https://gastateparks.reserveamerica.com{unescape(details_href)}",
        campsite_search_url=f"https://gastateparks.reserveamerica.com{unescape(search_href)}",
        unit_option_labels=[],
    )


def fetch_html(url: str) -> str:
    response = requests.get(
        url,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    return response.text


def extract_unit_option_labels(search_html: str) -> list[str]:
    option_pattern = re.compile(r"<option\s+value='?(\d+)'?>([^<]+)</option>", re.IGNORECASE)
    keywords = (
        "cabin",
        "cottage",
        "camp",
        "rv",
        "trailer",
        "yurt",
        "backcountry",
        "equestrian",
        "group site",
    )
    labels: list[str] = []

    for _, raw_label in option_pattern.findall(search_html):
        label = unescape(raw_label).strip()
        if not label:
            continue
        label_lower = label.lower()
        if not any(keyword in label_lower for keyword in keywords):
            continue
        if label not in labels:
            labels.append(label)

    return labels


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe Yonder Georgia State Parks handles.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of human-readable output.")
    args = parser.parse_args()

    html = fetch_directory_html()
    results: list[ProviderParkProbe] = []
    missing: list[str] = []

    for yonder_slug, provider_slug in YONDER_GA_STATE_PARK_TARGETS.items():
        probe = extract_probe(provider_slug, html)
        if not probe:
            missing.append(yonder_slug)
            continue
        probe.yonder_slug = yonder_slug
        search_html = fetch_html(probe.campsite_search_url)
        probe.unit_option_labels = extract_unit_option_labels(search_html)
        results.append(probe)

    if args.json:
        print(json.dumps([asdict(item) for item in results], indent=2))
        if missing:
            logger.error("Missing slugs: %s", ", ".join(missing))
        return

    logger.info("Yonder Georgia State Parks provider probe")
    logger.info("Directory pages: %s", ", ".join(DIRECTORY_PAGE_URLS))
    logger.info("Resolved parks: %s/%s", len(results), len(YONDER_GA_STATE_PARK_TARGETS))
    logger.info("")

    for item in results:
        logger.info("%s", item.yonder_slug)
        logger.info("  provider_slug: %s", item.provider_slug)
        logger.info("  park_id: %s", item.park_id)
        logger.info("  details: %s", item.details_url)
        logger.info("  search:  %s", item.campsite_search_url)
        logger.info("  unit options: %s", ", ".join(item.unit_option_labels) or "-")
        logger.info("")

    if missing:
        logger.error("Missing slugs: %s", ", ".join(missing))


if __name__ == "__main__":
    main()
