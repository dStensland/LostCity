#!/usr/bin/env python3
"""
Hydrate organization profiles from their websites.

Targets all organizations associated with a portal (default: atlanta),
fetches the org website, and fills missing fields such as:
  - description
  - logo_url
  - website (if missing)
  - instagram, facebook, twitter
  - email, phone

Usage:
  python hydrate_organizations_web.py --portal atlanta --limit 100
  python hydrate_organizations_web.py --portal atlanta --dry-run
  python hydrate_organizations_web.py --portal atlanta --overwrite
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from db import get_client, get_portal_id_by_slug
from description_fetcher import extract_description_from_html

# Load .env from repo root
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

ORG_TYPES = {
    "Organization",
    "LocalBusiness",
    "PerformingGroup",
    "PerformingArtsTheater",
    "NonprofitOrganization",
    "EducationalOrganization",
    "MusicGroup",
    "SportsOrganization",
    "TheaterGroup",
    "ArtsOrganization",
    "DanceGroup",
}


def normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if not re.match(r"^https?://", url):
        url = "https://" + url
    return url


def root_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def extract_jsonld(soup: BeautifulSoup) -> dict:
    data: dict = {}
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            raw = script.string or ""
            if not raw.strip():
                continue
            payload = json.loads(raw)
        except Exception:
            continue

        items: list = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            if "@graph" in payload and isinstance(payload["@graph"], list):
                items = payload["@graph"]
            else:
                items = [payload]

        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type")
            types: set[str] = set()
            if isinstance(item_type, list):
                types.update(item_type)
            elif isinstance(item_type, str):
                types.add(item_type)
            if types and not (types & ORG_TYPES):
                continue

            for key in ("description", "logo", "url", "email", "telephone", "sameAs", "name"):
                if key in item and item[key]:
                    data.setdefault(key, item[key])
    return data


def extract_meta(soup: BeautifulSoup) -> dict:
    def meta_content(*selectors: tuple[str, str]) -> Optional[str]:
        for attr, value in selectors:
            tag = soup.find("meta", attrs={attr: value})
            if tag and tag.get("content"):
                return tag["content"].strip()
        return None

    return {
        "description": meta_content(("property", "og:description"), ("name", "description")),
        "image": meta_content(("property", "og:image"), ("name", "twitter:image")),
    }


def extract_links(soup: BeautifulSoup) -> list[str]:
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href:
            links.append(href)
    return links


def extract_socials(links: Iterable[str]) -> dict:
    socials = {"instagram": None, "facebook": None, "twitter": None}

    patterns = {
        "instagram": re.compile(r"https?://(www\.)?instagram\.com/[^/?#]+", re.I),
        "facebook": re.compile(r"https?://(www\.)?facebook\.com/[^/?#]+", re.I),
        "twitter": re.compile(r"https?://(www\.)?(twitter|x)\.com/[^/?#]+", re.I),
    }

    for link in links:
        for key, pattern in patterns.items():
            if socials[key]:
                continue
            match = pattern.search(link)
            if match:
                socials[key] = match.group(0)

    return socials


def extract_email_phone(links: Iterable[str], text: str) -> tuple[Optional[str], Optional[str]]:
    email = None
    phone = None

    for link in links:
        if link.startswith("mailto:") and not email:
            email = link.replace("mailto:", "").split("?")[0].strip()
        if link.startswith("tel:") and not phone:
            phone = link.replace("tel:", "").strip()

    if not email:
        match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
        if match:
            email = match.group(0)

    if not phone:
        match = re.search(r"\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", text)
        if match:
            phone = match.group(0)

    return email, phone


def select_logo(meta_image: Optional[str], jsonld_logo: Optional[str]) -> Optional[str]:
    for candidate in [jsonld_logo, meta_image]:
        if candidate and not candidate.startswith("data:"):
            return candidate
    return None


def fetch_org_page(url: str) -> Optional[str]:
    try:
        with httpx.Client(
            timeout=20.0,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        ) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.text
    except Exception as e:
        logger.info(f"  - fetch failed: {e}")
        return None


def _fetch_org_ids_from_events(
    portal_id: Optional[str],
    city: Optional[str],
    limit: int = 10000,
) -> list[str]:
    client = get_client()
    org_ids: set[str] = set()

    query = (
        client.table("events")
        .select("organization_id, venues!inner(city)")
        .not_.is_("organization_id", "null")
    )

    if portal_id:
        query = query.eq("portal_id", portal_id)
    else:
        query = query.is_("portal_id", "null")
        if city:
            query = query.eq("venues.city", city)

    result = query.limit(limit).execute()
    for row in result.data or []:
        if row.get("organization_id"):
            org_ids.add(row["organization_id"])

    return list(org_ids)


def _fetch_org_ids_from_city(city: str, limit: int = 10000) -> list[str]:
    client = get_client()
    org_ids: set[str] = set()

    result = (
        client.table("organizations")
        .select("id")
        .ilike("city", f"%{city}%")
        .limit(limit)
        .execute()
    )
    for row in result.data or []:
        if row.get("id"):
            org_ids.add(row["id"])
    return list(org_ids)


def get_org_ids_for_portal(portal_id: str, include_public: bool = True, city: Optional[str] = None) -> list[str]:
    client = get_client()
    org_ids: set[str] = set()

    for org_id in _fetch_org_ids_from_events(portal_id=portal_id, city=None):
        org_ids.add(org_id)
    if include_public:
        for org_id in _fetch_org_ids_from_events(portal_id=None, city=city):
            org_ids.add(org_id)
    if city:
        for org_id in _fetch_org_ids_from_city(city):
            org_ids.add(org_id)

    return sorted(org_ids)


def chunked(items: list, size: int) -> Iterable[list]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def hydrate_orgs(
    portal_slug: str,
    limit: Optional[int],
    dry_run: bool,
    overwrite: bool,
    include_public: bool,
    sleep_s: float,
    city: Optional[str],
) -> None:
    client = get_client()
    portal_id = get_portal_id_by_slug(portal_slug)
    if not portal_id:
        logger.error(f"Portal not found: {portal_slug}")
        return

    org_ids = get_org_ids_for_portal(portal_id, include_public=include_public, city=city)
    if limit:
        org_ids = org_ids[:limit]

    if not org_ids:
        logger.info("No organizations found for portal.")
        return

    logger.info(f"Found {len(org_ids)} organizations to hydrate.")

    total_updated = 0

    for batch in chunked(org_ids, 200):
        orgs = (
            client.table("organizations")
            .select("id, name, website, events_url, description, logo_url, instagram, facebook, twitter, email, phone")
            .in_("id", batch)
            .execute()
        ).data or []

        for org in orgs:
            name = org.get("name")
            website = org.get("website")
            events_url = org.get("events_url")

            target_url = normalize_url(website) or normalize_url(events_url)
            if not target_url:
                logger.info(f"- {name}: no website")
                continue

            logger.info(f"- {name}: {target_url}")
            html = fetch_org_page(target_url)
            if not html:
                continue

            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text(" ", strip=True)

            jsonld = extract_jsonld(soup)
            meta = extract_meta(soup)
            links = extract_links(soup)
            socials = extract_socials(links + (jsonld.get("sameAs", []) if isinstance(jsonld.get("sameAs"), list) else []))

            description = extract_description_from_html(html)
            if not description and isinstance(jsonld.get("description"), str):
                description = jsonld.get("description")

            logo = select_logo(meta.get("image"), jsonld.get("logo") if isinstance(jsonld.get("logo"), str) else None)
            if logo and logo.startswith("/"):
                logo = urljoin(target_url, logo)

            email, phone = extract_email_phone(links, text)

            updates: dict = {}

            if overwrite or not org.get("website"):
                website_candidate = normalize_url(jsonld.get("url") if isinstance(jsonld.get("url"), str) else None) or normalize_url(website) or normalize_url(events_url)
                if website_candidate:
                    updates["website"] = root_url(website_candidate)

            if description and (overwrite or not org.get("description")):
                updates["description"] = description[:500]

            if logo and (overwrite or not org.get("logo_url")):
                updates["logo_url"] = logo

            if socials.get("instagram") and (overwrite or not org.get("instagram")):
                updates["instagram"] = socials["instagram"]

            if socials.get("facebook") and (overwrite or not org.get("facebook")):
                updates["facebook"] = socials["facebook"]

            if socials.get("twitter") and (overwrite or not org.get("twitter")):
                updates["twitter"] = socials["twitter"]

            if email and (overwrite or not org.get("email")):
                updates["email"] = email

            if phone and (overwrite or not org.get("phone")):
                updates["phone"] = phone

            if updates:
                if dry_run:
                    logger.info(f"  updates: {updates}")
                else:
                    client.table("organizations").update(updates).eq("id", org["id"]).execute()
                total_updated += 1

            if sleep_s > 0:
                time.sleep(sleep_s)

    logger.info(f"Done. Updated {total_updated} organizations.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Hydrate organization data from websites.")
    parser.add_argument("--portal", default="atlanta", help="Portal slug (default: atlanta)")
    parser.add_argument("--limit", type=int, default=None, help="Max orgs to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview updates without writing")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing values")
    parser.add_argument("--no-public", action="store_true", help="Exclude public events from org selection")
    parser.add_argument("--city", default="Atlanta", help="City filter for public events/orgs (default: Atlanta)")
    parser.add_argument("--sleep", type=float, default=0.3, help="Sleep between requests (seconds)")
    args = parser.parse_args()

    hydrate_orgs(
        portal_slug=args.portal,
        limit=args.limit,
        dry_run=args.dry_run,
        overwrite=args.overwrite,
        include_public=not args.no_public,
        sleep_s=args.sleep,
        city=args.city,
    )


if __name__ == "__main__":
    main()
