#!/usr/bin/env python3
"""
Extract normalized Georgia State Parks inventory summaries for Yonder anchors.

This is the first provider-backed inventory extraction pass for Yonder weekend
destinations. It does not write to the database. It emits dated unit-type
summaries and sample site rows for the Yonder Georgia State Park subset.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/extract_yonder_ga_state_park_inventory.py
    python3 scripts/extract_yonder_ga_state_park_inventory.py --json
    python3 scripts/extract_yonder_ga_state_park_inventory.py --arrival 03/20/2026 --nights 2
"""

from __future__ import annotations

import argparse
import json
import logging
import re
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from html import unescape

import requests
from bs4 import BeautifulSoup

from probe_yonder_ga_state_parks import DIRECTORY_PAGE_URLS, YONDER_GA_STATE_PARK_TARGETS, extract_probe

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def get_next_weekend_arrival(reference: date | None = None) -> str:
    today = reference or date.today()
    days_until_friday = (4 - today.weekday()) % 7
    arrival = today + timedelta(days=days_until_friday)
    return arrival.strftime("%m/%d/%Y")


@dataclass
class SiteTypeSummary:
    raw_label: str
    normalized_unit_type: str
    visible_count: int


@dataclass
class SampleSiteRow:
    site_label: str
    loop: str | None
    site_type_label: str
    normalized_unit_type: str
    max_people: str | None
    equipment_or_driveway: str | None
    availability_label: str | None
    detail_url: str | None
    detail_status: str | None = None
    nightly_rate: str | None = None
    weekly_rate: str | None = None


@dataclass
class ParkInventorySnapshot:
    yonder_slug: str
    provider_slug: str
    park_id: str
    arrival_date: str
    nights: int
    total_results: int | None
    unit_type_summaries: list[SiteTypeSummary]
    normalized_records: list["NormalizedInventoryRecord"]
    sample_sites: list[SampleSiteRow]


@dataclass
class NormalizedInventoryRecord:
    destination_slug: str
    provider_slug: str
    park_id: str
    arrival_date: str
    nights: int
    unit_type: str
    raw_labels: list[str]
    visible_inventory_count: int
    sample_detail_status: str | None
    sample_nightly_rate: str | None
    sample_weekly_rate: str | None


def fetch_html(url: str) -> str:
    response = requests.get(
        url,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    return response.text


def fetch_probe_map() -> dict[str, tuple[str, str, str]]:
    html = "\n".join(fetch_html(url) for url in DIRECTORY_PAGE_URLS)
    probe_map: dict[str, tuple[str, str, str]] = {}

    for yonder_slug, provider_slug in YONDER_GA_STATE_PARK_TARGETS.items():
        probe = extract_probe(provider_slug, html)
        if not probe:
            raise ValueError(f"Could not resolve provider handle for {yonder_slug}")
        probe_map[yonder_slug] = (
            probe.provider_slug,
            probe.park_id,
            probe.campsite_search_url,
        )

    return probe_map


def normalize_unit_type(label: str) -> str:
    lowered = label.lower()
    if "cottage" in lowered or "cabin" in lowered:
        return "cabin"
    if "yurt" in lowered:
        return "yurt"
    if "rv" in lowered or "trailer" in lowered:
        return "rv_site"
    if "backcountry" in lowered:
        return "backcountry_site"
    if "tent" in lowered or "camp" in lowered or "campsite" in lowered:
        return "tent_site"
    if "group lodge" in lowered:
        return "group_lodge"
    if "group shelter" in lowered or "picnic shelter" in lowered or "group site" in lowered:
        return "group_site"
    if "equestrian" in lowered:
        return "equestrian_site"
    return "other"


def parse_total_results(soup: BeautifulSoup) -> int | None:
    container = soup.select_one("#csiterst")
    if not container:
        return None
    text = " ".join(container.get_text(" ", strip=True).split())
    match = re.search(r"Campsite Search Results:\s+\d+\s*-\s*\d+\s+of\s+(\d+)", text)
    if not match:
        return None
    return int(match.group(1))


def parse_unit_type_summaries(soup: BeautifulSoup) -> list[SiteTypeSummary]:
    summaries: list[SiteTypeSummary] = []

    for node in soup.select(".site_type_item_redesigned"):
        text = " ".join(node.get_text(" ", strip=True).split())
        if not text or text.startswith("ALL "):
            continue
        match = re.match(r"(.+?)\s+\((\d+)\)$", text)
        if not match:
            continue
        raw_label = match.group(1).strip()
        visible_count = int(match.group(2))
        summaries.append(
            SiteTypeSummary(
                raw_label=raw_label,
                normalized_unit_type=normalize_unit_type(raw_label),
                visible_count=visible_count,
            )
        )

    return summaries


def parse_site_cards(soup: BeautifulSoup, limit: int) -> list[SampleSiteRow]:
    cards = [
        card
        for card in soup.select("#shoppingitems > .br")
        if "hdr" not in (card.get("class") or [])
    ]
    parsed_rows: list[SampleSiteRow] = []

    for card in cards:
        cells = card.find_all("div", recursive=False)
        if len(cells) < 7:
            continue

        site_label = " ".join(cells[0].get_text(" ", strip=True).split())
        site_label = re.sub(r"^Map\s+", "", site_label).strip()
        loop = " ".join(cells[1].get_text(" ", strip=True).split()) or None
        site_type_label = " ".join(cells[2].get_text(" ", strip=True).split())
        max_people = " ".join(cells[3].get_text(" ", strip=True).split()) or None
        equipment_or_driveway = " ".join(cells[4].get_text(" ", strip=True).split()) or None
        availability_label = " ".join(cells[6].get_text(" ", strip=True).split()) or None
        detail_link = cells[6].find("a")
        detail_url = None
        if detail_link and detail_link.get("href"):
            detail_url = f"https://gastateparks.reserveamerica.com{unescape(detail_link['href'])}"

        parsed_rows.append(
            SampleSiteRow(
                site_label=site_label,
                loop=loop,
                site_type_label=site_type_label,
                normalized_unit_type=normalize_unit_type(site_type_label),
                max_people=max_people,
                equipment_or_driveway=equipment_or_driveway,
                availability_label=availability_label,
                detail_url=detail_url,
            )
        )

    sample_rows: list[SampleSiteRow] = []
    seen_unit_types: set[str] = set()
    for row in parsed_rows:
        if row.normalized_unit_type not in seen_unit_types:
            sample_rows.append(row)
            seen_unit_types.add(row.normalized_unit_type)
        if len(sample_rows) >= limit:
            return sample_rows

    for row in parsed_rows:
        if row in sample_rows:
            continue
        sample_rows.append(row)
        if len(sample_rows) >= limit:
            break

    return sample_rows


def parse_price_value(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r"\$([\d,]+(?:\.\d{2})?)", value)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def fetch_site_detail_pricing(
    detail_url: str,
    arrival_date: str,
    nights: int,
) -> tuple[str | None, str | None, str | None]:
    get_response = requests.get(
        detail_url,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    get_response.raise_for_status()
    soup = BeautifulSoup(get_response.text, "html.parser")
    form = soup.find("form", {"id": "booksiteform"})
    if not form:
        return None, None, None

    payload: dict[str, str] = {}
    for input_node in form.find_all("input"):
        name = input_node.get("name")
        if not name:
            continue
        payload[name] = input_node.get("value", "")

    payload["arvdate"] = arrival_date
    payload["arrivaldate"] = arrival_date
    payload["lengthOfStay"] = str(nights)
    payload["dateChosen"] = "true"

    post_response = requests.post(
        detail_url,
        data=payload,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0", "Referer": detail_url},
    )
    post_response.raise_for_status()
    priced_soup = BeautifulSoup(post_response.text, "html.parser")

    status_wrapper = priced_soup.select_one(".sdformwrapper")
    status_text = (
        " ".join(status_wrapper.get_text(" ", strip=True).split())
        if status_wrapper
        else ""
    )
    detail_status = None
    if "Book these Dates" in status_text:
        detail_status = "bookable"
    elif "Create Availability Notification" in status_text:
        detail_status = "notify_only"
    elif "Check Availability" in status_text:
        detail_status = "check_availability"

    rate_values = priced_soup.select(".ftcItemVals .notranslate")
    nightly_rate = None
    weekly_rate = None
    if rate_values:
        if len(rate_values) >= 1:
            nightly_rate = " ".join(rate_values[0].get_text(" ", strip=True).split()) or None
        if len(rate_values) >= 2:
            weekly_rate = " ".join(rate_values[1].get_text(" ", strip=True).split()) or None

    return detail_status, nightly_rate, weekly_rate


def build_normalized_records(
    yonder_slug: str,
    provider_slug: str,
    park_id: str,
    arrival_date: str,
    nights: int,
    unit_type_summaries: list[SiteTypeSummary],
    sample_sites: list[SampleSiteRow],
) -> list[NormalizedInventoryRecord]:
    summary_groups: dict[str, list[SiteTypeSummary]] = {}
    for summary in unit_type_summaries:
        summary_groups.setdefault(summary.normalized_unit_type, []).append(summary)

    sample_groups: dict[str, list[SampleSiteRow]] = {}
    for site in sample_sites:
        sample_groups.setdefault(site.normalized_unit_type, []).append(site)

    normalized_records: list[NormalizedInventoryRecord] = []
    for unit_type in sorted(summary_groups):
        summaries = summary_groups[unit_type]
        samples = sample_groups.get(unit_type, [])

        best_sample = None
        best_sample_price = None
        for sample in samples:
            price_value = parse_price_value(sample.nightly_rate)
            if price_value is None:
                continue
            if best_sample_price is None or price_value < best_sample_price:
                best_sample = sample
                best_sample_price = price_value

        if best_sample is None and samples:
            best_sample = samples[0]

        normalized_records.append(
            NormalizedInventoryRecord(
                destination_slug=yonder_slug,
                provider_slug=provider_slug,
                park_id=park_id,
                arrival_date=arrival_date,
                nights=nights,
                unit_type=unit_type,
                raw_labels=[summary.raw_label for summary in summaries],
                visible_inventory_count=sum(summary.visible_count for summary in summaries),
                sample_detail_status=best_sample.detail_status if best_sample else None,
                sample_nightly_rate=best_sample.nightly_rate if best_sample else None,
                sample_weekly_rate=best_sample.weekly_rate if best_sample else None,
            )
        )

    return normalized_records


def fetch_inventory_snapshot(
    yonder_slug: str,
    provider_slug: str,
    park_id: str,
    arrival_date: str,
    nights: int,
    sample_limit: int,
    detail_limit: int,
) -> ParkInventorySnapshot:
    params = {
        "site": "all",
        "type": "9",
        "minimal": "no",
        "search": "site",
        "criteria": "new",
        "book-sites": "new",
        "contractCode": "GA",
        "parkId": park_id,
        "campingDate": arrival_date,
        "lengthOfStay": str(nights),
        "siteTypeFilter": "ALL",
    }
    url = f"https://gastateparks.reserveamerica.com/camping/{provider_slug}/r/campsiteSearch.do"
    response = requests.get(
        url,
        params=params,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()
    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    unit_type_summaries = parse_unit_type_summaries(soup)
    sample_sites = parse_site_cards(soup, sample_limit)
    detail_enriched = 0
    for site in sample_sites:
        if detail_enriched >= detail_limit:
            break
        if not site.detail_url:
            continue
        detail_status, nightly_rate, weekly_rate = fetch_site_detail_pricing(
            site.detail_url,
            arrival_date=arrival_date,
            nights=nights,
        )
        site.detail_status = detail_status
        site.nightly_rate = nightly_rate
        site.weekly_rate = weekly_rate
        detail_enriched += 1

    normalized_records = build_normalized_records(
        yonder_slug=yonder_slug,
        provider_slug=provider_slug,
        park_id=park_id,
        arrival_date=arrival_date,
        nights=nights,
        unit_type_summaries=unit_type_summaries,
        sample_sites=sample_sites,
    )

    return ParkInventorySnapshot(
        yonder_slug=yonder_slug,
        provider_slug=provider_slug,
        park_id=park_id,
        arrival_date=arrival_date,
        nights=nights,
        total_results=parse_total_results(soup),
        unit_type_summaries=unit_type_summaries,
        normalized_records=normalized_records,
        sample_sites=sample_sites,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Yonder Georgia State Park inventory summaries.")
    parser.add_argument(
        "--arrival",
        default=get_next_weekend_arrival(),
        help="Arrival date in MM/DD/YYYY format.",
    )
    parser.add_argument("--nights", type=int, default=2, help="Length of stay in nights.")
    parser.add_argument("--sample-limit", type=int, default=5, help="Number of sample site rows per park.")
    parser.add_argument("--detail-limit", type=int, default=2, help="Number of sample site rows per park to enrich with detail-page pricing.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    args = parser.parse_args()

    probe_map = fetch_probe_map()
    snapshots: list[ParkInventorySnapshot] = []

    for yonder_slug, (provider_slug, park_id, _) in probe_map.items():
        snapshots.append(
            fetch_inventory_snapshot(
                yonder_slug=yonder_slug,
                provider_slug=provider_slug,
                park_id=park_id,
                arrival_date=args.arrival,
                nights=args.nights,
                sample_limit=args.sample_limit,
                detail_limit=args.detail_limit,
            )
        )

    if args.json:
        print(json.dumps([asdict(snapshot) for snapshot in snapshots], indent=2))
        return

    logger.info("Yonder Georgia State Park inventory extraction")
    logger.info("Arrival: %s", args.arrival)
    logger.info("Nights: %s", args.nights)
    logger.info("")

    for snapshot in snapshots:
        logger.info("%s", snapshot.yonder_slug)
        logger.info("  provider_slug: %s", snapshot.provider_slug)
        logger.info("  park_id: %s", snapshot.park_id)
        logger.info("  total_results: %s", snapshot.total_results if snapshot.total_results is not None else "-")
        logger.info("  unit_types:")
        for summary in snapshot.unit_type_summaries:
            logger.info(
                "    - %s | %s | %s",
                summary.raw_label,
                summary.normalized_unit_type,
                summary.visible_count,
            )
        logger.info("  normalized_records:")
        for record in snapshot.normalized_records:
            logger.info(
                "    - %s | labels=%s | visible=%s | status=%s | nightly=%s | weekly=%s",
                record.unit_type,
                ", ".join(record.raw_labels),
                record.visible_inventory_count,
                record.sample_detail_status or "-",
                record.sample_nightly_rate or "-",
                record.sample_weekly_rate or "-",
            )
        logger.info("  sample_sites:")
        for site in snapshot.sample_sites:
            logger.info(
                "    - %s | %s | %s | people=%s | equip=%s | availability=%s",
                site.site_label,
                site.site_type_label,
                site.normalized_unit_type,
                site.max_people or "-",
                site.equipment_or_driveway or "-",
                site.availability_label or "-",
            )
            if site.detail_status or site.nightly_rate or site.weekly_rate:
                logger.info(
                    "      detail: status=%s | nightly=%s | weekly=%s",
                    site.detail_status or "-",
                    site.nightly_rate or "-",
                    site.weekly_rate or "-",
                )
        logger.info("")

    normalized_counter: dict[str, set[str]] = {}
    for snapshot in snapshots:
        for summary in snapshot.unit_type_summaries:
            normalized_counter.setdefault(summary.normalized_unit_type, set()).add(
                snapshot.yonder_slug
            )

    logger.info("Normalized unit categories observed")
    for normalized_unit_type in sorted(normalized_counter):
        logger.info(
            "  %s: %s parks",
            normalized_unit_type,
            len(normalized_counter[normalized_unit_type]),
        )


if __name__ == "__main__":
    main()
