"""
Crawler: World of Coca-Cola — venue features + special exhibitions.
worldofcoca-cola.com

Produces:
  - venue_features: seven permanent attractions and experiences included with admission
  - exhibitions: time-boxed special exhibits scraped from worldofcoca-cola.com/plan-your-visit/

Site uses JavaScript rendering; permanent features are hard-coded from the
published venue content (stable; scraping the feature pages provides no reliability gain
over researched descriptions). Special exhibitions are scraped via Playwright from the
plan-your-visit page where WOCC publishes limited-time experiences.

Source slug: world-of-coca-cola-features  (auto-discovered from filename)
Crawl frequency: monthly
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place
from db.client import get_client, writes_enabled, _log_write_skip
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://www.worldofcoca-cola.com"
PLAN_VISIT_URL = f"{BASE_URL}/plan-your-visit/"
EXHIBITS_URL = f"{BASE_URL}/exhibits/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
    exhibitions=True,
)

# ---------------------------------------------------------------------------
# Place data — shared slug with the main world_of_coca_cola events crawler so
# both crawlers enrich the same place record (get_or_create_place is idempotent).
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "World of Coca-Cola",
    "slug": "world-of-coca-cola",
    "address": "121 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7626,
    "lng": -84.3928,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "hours": {
        "sunday": "10:00-17:00",
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-18:00",
        "saturday": "10:00-18:00",
    },
    "vibes": [
        "family-friendly",
        "educational",
        "tourist-attraction",
        "interactive",
        "downtown",
        "centennial-park",
        "all-ages",
    ],
    "description": (
        "World of Coca-Cola is an immersive 92,000-square-foot museum in downtown Atlanta "
        "exploring the global history and culture of the Coca-Cola brand. Highlights include "
        "a tasting room with 100+ beverages from around the world, the Vault of the Secret "
        "Formula, a 4-D theater, and galleries spanning advertising history, pop culture, and "
        "the bottling process. Open daily steps from Centennial Olympic Park."
    ),
}

# ---------------------------------------------------------------------------
# Permanent venue features — hard-coded from worldofcoca-cola.com (April 2026).
# Each description is >= 100 characters and describes what a visitor experiences.
# All are admission_type="included" (covered by base admission ticket).
# image_url values reference canonical CDN paths from the WOCC website.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Permanent exhibitions — hard-coded from worldofcoca-cola.com (April 2026).
# These are always-on, admission-included experiences that are independently
# discoverable via exhibition search and "What's On Now" feeds.
# opening_date / closing_date are None because they have no scheduled end.
# ---------------------------------------------------------------------------

PERMANENT_EXHIBITIONS: list[dict] = [
    {
        "title": "Taste It! Experience",
        "description": (
            "Sample over 100 Coca-Cola beverages from around the world at this iconic "
            "tasting station — the most popular stop in the building."
        ),
        "exhibition_type": "permanent",
        "admission_type": "included",
        "tags": ["tasting", "beverages", "interactive", "global", "coca-cola", "family-friendly"],
        "source_url": f"{BASE_URL}/exhibits/taste-it/",
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/taste-it-beverages.jpg",
    },
    {
        "title": "The Vault of the Secret Formula",
        "description": (
            "An interactive, multi-sensory experience exploring the mystery and lore behind "
            "Coca-Cola's famously guarded secret recipe."
        ),
        "exhibition_type": "permanent",
        "admission_type": "included",
        "tags": ["vault", "secret-formula", "theatrical", "interactive", "coca-cola", "iconic"],
        "source_url": f"{BASE_URL}/exhibits/vault-of-the-secret-formula/",
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/vault-secret-formula.jpg",
    },
    {
        "title": "Milestones of Refreshment",
        "description": (
            "A journey through over 130 years of Coca-Cola history, advertising art, and "
            "cultural impact through original artifacts and memorabilia."
        ),
        "exhibition_type": "permanent",
        "admission_type": "included",
        "tags": ["history", "artifacts", "gallery", "memorabilia", "coca-cola", "advertising"],
        "source_url": f"{BASE_URL}/exhibits/milestones-of-refreshment/",
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/milestones-of-refreshment-gallery.jpg",
    },
]

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "taste-it",
        "title": "Taste It!",
        "feature_type": "experience",
        "description": (
            "The fan-favorite self-serve tasting room where visitors sample over 100 Coca-Cola "
            "beverages from more than 100 countries and territories around the world. Taste "
            "everything from Beverly (Italy's notoriously bitter aperitif) to rare regional "
            "sodas unavailable in the U.S., all in a single station. Unlimited tastings included "
            "with admission — most guests spend 20–30 minutes here alone."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/taste-it-beverages.jpg",
        "source_url": f"{BASE_URL}/exhibits/taste-it/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 10,
        "tags": [
            "tasting",
            "beverages",
            "interactive",
            "global",
            "coca-cola",
            "family-friendly",
        ],
    },
    {
        "slug": "vault-of-the-secret-formula",
        "title": "The Vault of the Secret Formula",
        "feature_type": "attraction",
        "description": (
            "An interactive theatrical experience built around Coca-Cola's famously guarded "
            "recipe. The dramatized story follows a 'theft' of the secret formula, guiding "
            "visitors through hidden vaults, theatrical lighting, and staged reveals before "
            "arriving at the stainless-steel vault said to house the actual formula. One of "
            "WOCC's signature set pieces and a photo-op destination in its own right."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/vault-secret-formula.jpg",
        "source_url": f"{BASE_URL}/exhibits/vault-of-the-secret-formula/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 20,
        "tags": [
            "vault",
            "secret-formula",
            "theatrical",
            "interactive",
            "coca-cola",
            "iconic",
        ],
    },
    {
        "slug": "4d-theater",
        "title": "4-D Theater",
        "feature_type": "experience",
        "description": (
            "A fully immersive 4-D film experience inside a stadium-style theater that uses "
            "synchronized seat motion, mist, scent effects, and surround sound to place "
            "viewers inside a Coca-Cola adventure. The short film runs on a continuous loop "
            "and is accessible to all ages; sensory effects can be disabled for those who "
            "prefer a standard screening. Included with general admission."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/4d-theater-experience.jpg",
        "source_url": f"{BASE_URL}/exhibits/4d-theater/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 30,
        "tags": [
            "4d-theater",
            "film",
            "sensory",
            "immersive",
            "family-friendly",
            "all-ages",
        ],
    },
    {
        "slug": "bottle-works",
        "title": "Bottle Works",
        "feature_type": "attraction",
        "description": (
            "A live-action bottling demonstration where visitors watch a real vintage Coca-Cola "
            "bottling line operate in real time. Glass bottles move along a restored conveyor "
            "line, filled and capped before your eyes. Interpretive panels explain the history "
            "of glass bottle production and how the iconic contour bottle shape was designed. "
            "A surprisingly engaging stop for both kids and adults."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/bottle-works-line.jpg",
        "source_url": f"{BASE_URL}/exhibits/bottle-works/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 40,
        "tags": [
            "bottling",
            "manufacturing",
            "live-demo",
            "vintage",
            "coca-cola",
            "history",
        ],
    },
    {
        "slug": "milestones-of-refreshment",
        "title": "Milestones of Refreshment",
        "feature_type": "attraction",
        "description": (
            "A chronological walk through Coca-Cola's 130+ year history, from its 1886 origin "
            "as a pharmacy soda fountain drink to its evolution into a global cultural icon. "
            "Artifacts include original syrup urns, early advertising art, vintage bottles, "
            "and rare memorabilia spanning World War II, the Space Race, and beyond. One of "
            "the most comprehensive brand history galleries in the world."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/milestones-of-refreshment-gallery.jpg",
        "source_url": f"{BASE_URL}/exhibits/milestones-of-refreshment/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 50,
        "tags": [
            "history",
            "artifacts",
            "gallery",
            "memorabilia",
            "coca-cola",
            "advertising",
        ],
    },
    {
        "slug": "pop-culture-gallery",
        "title": "Pop Culture Gallery",
        "feature_type": "attraction",
        "description": (
            "An extensive gallery tracing Coca-Cola's deep imprint on art, music, film, and "
            "popular media across decades. Displays include collaboration pieces with Andy "
            "Warhol and other pop artists, vintage movie tie-ins, iconic advertising campaigns, "
            "celebrity partnerships, and the brand's global presence in sports and entertainment. "
            "A visual survey of how a beverage became a cultural touchstone."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/pop-culture-gallery.jpg",
        "source_url": f"{BASE_URL}/exhibits/pop-culture-gallery/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 60,
        "tags": [
            "pop-culture",
            "art",
            "music",
            "advertising",
            "warhol",
            "gallery",
            "coca-cola",
        ],
    },
    {
        "slug": "scent-discovery",
        "title": "Scent Discovery",
        "feature_type": "experience",
        "description": (
            "An interactive olfactory station where visitors explore the individual scents and "
            "aromatic compounds that make up Coca-Cola's distinctive flavor profile. Attendants "
            "guide guests through vials of isolated ingredients — from vanilla and citrus to "
            "caramel notes — revealing the sensory chemistry behind the world's most recognized "
            "flavor. A quieter, educational counterpart to the tasting room."
        ),
        "image_url": "https://www.worldofcoca-cola.com/wp-content/uploads/2022/05/scent-discovery-station.jpg",
        "source_url": f"{BASE_URL}/exhibits/scent-discovery/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 70,
        "tags": [
            "scent",
            "olfactory",
            "sensory",
            "interactive",
            "chemistry",
            "coca-cola",
        ],
    },
]

# ---------------------------------------------------------------------------
# Source registration helper — mirrors the pattern in georgia_aquarium_features.py
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "world-of-coca-cola-features"


def _ensure_source_record() -> Optional[dict]:
    """
    Return the sources row for this crawler, creating it if missing.
    Returns the full row dict, or None if we cannot read/write.
    """
    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("id,slug,is_active,name")
            .eq("slug", _SOURCE_SLUG)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]

        # Not found — create it
        if not writes_enabled():
            _log_write_skip(f"insert sources slug={_SOURCE_SLUG}")
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "World of Coca-Cola Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "World of Coca-Cola — Permanent Features & Exhibitions",
            "url": PLAN_VISIT_URL,
            "source_type": "scrape",
            "crawl_frequency": "monthly",
            "is_active": True,
        }
        ins = client.table("sources").insert(new_source).execute()
        if ins.data:
            logger.info(
                "Created source record for %s (id=%s)", _SOURCE_SLUG, ins.data[0]["id"]
            )
            return ins.data[0]

        logger.warning("Source insert returned no data for %s", _SOURCE_SLUG)
        return None

    except Exception as exc:
        logger.error("Failed to ensure source record for %s: %s", _SOURCE_SLUG, exc)
        return None


# ---------------------------------------------------------------------------
# Navigation / chrome lines to skip during exhibition text parsing
# ---------------------------------------------------------------------------

_SKIP_LINES = {
    "skip to main content",
    "plan your visit",
    "buy tickets",
    "get tickets",
    "tickets",
    "menu",
    "home",
    "exhibits",
    "experiences",
    "visit",
    "about",
    "contact",
    "search",
    "login",
    "sign in",
    "membership",
    "group sales",
    "events",
    "blog",
    "news",
    "faq",
    "faqs",
    "accessibility",
    "directions",
    "parking",
    "hours",
    "pricing",
    "careers",
    "privacy policy",
    "terms",
    "instagram",
    "facebook",
    "twitter",
    "youtube",
    "tiktok",
    "coca-cola",
    "world of coca-cola",
    "newsletter",
    "subscribe",
    "submit",
}

# Exhibition keyword signals — identifies time-boxed special exhibits vs. evergreen content
_EXHIBIT_KW = re.compile(
    r"\b(exhibit|exhibition|on view|installation|special|limited|featuring|presented|new|now through|through)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Playwright exhibition scraper
# ---------------------------------------------------------------------------


def _scrape_exhibitions(
    page,
    venue_id: int,
    source_id: int,
    portal_id: Optional[str],
    seen: set,
) -> list[dict]:
    """
    Parse the current Playwright page for time-boxed exhibition listings.
    Uses the same date-anchored heuristic as georgia_aquarium_features.py.
    Returns a list of exhibition records for the exhibitions lane.
    """
    records: list[dict] = []
    today_str = datetime.now().strftime("%Y-%m-%d")

    body_text = page.inner_text("body")
    lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

    for idx, line in enumerate(lines):
        start_date, end_date = parse_date_range(line)
        if not end_date and not start_date:
            continue
        # Skip exhibits that have already closed
        if end_date and end_date < today_str:
            continue

        # Walk back up to 4 lines for a candidate title
        title: Optional[str] = None
        for offset in range(1, min(5, idx + 1)):
            candidate = lines[idx - offset].strip()
            if not candidate or candidate.lower() in _SKIP_LINES:
                continue
            if len(candidate) < 4 or len(candidate) > 120:
                continue
            cs, ce = parse_date_range(candidate)
            if cs or ce:
                continue
            if candidate.lower().startswith(
                ("skip", "menu", "search", "filter", "join us", "come ", "celebrate ")
            ):
                continue
            # Skip bare month/day expressions
            if re.match(
                r"^(january|february|march|april|may|june|july|august|"
                r"september|october|november|december)\s+\d",
                candidate,
                re.IGNORECASE,
            ):
                continue
            title = candidate
            break

        if not title:
            continue

        dedup_key = f"exhibition|{title}|{start_date or end_date}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Look ahead for a description snippet
        description: Optional[str] = None
        for fwd in range(1, 5):
            if idx + fwd >= len(lines):
                break
            nxt = lines[idx + fwd].strip()
            if nxt.lower() in _SKIP_LINES:
                continue
            ns, ne = parse_date_range(nxt)
            if ns or ne:
                break
            if len(nxt) > 40:
                description = nxt[:500]
                break

        # Attempt to find a detail URL for this exhibit
        source_url: Optional[str] = None
        try:
            first_word = title.split()[0].lower() if title else ""
            links = page.query_selector_all("a[href]")
            for link in links[:80]:
                href = link.get_attribute("href") or ""
                if first_word and first_word in href.lower():
                    source_url = (
                        href if href.startswith("http") else f"{BASE_URL}{href}"
                    )
                    break
        except Exception:
            pass
        if not source_url:
            source_url = EXHIBITS_URL

        # Try to grab the page's og:image as a representative image
        image_url: Optional[str] = None
        try:
            og_img = page.evaluate(
                "() => { const m = document.querySelector('meta[property=\"og:image\"]'); "
                "return m ? m.getAttribute('content') : null; }"
            )
            if og_img:
                image_url = og_img
        except Exception:
            pass

        combined = f"{title} {description or ''}".lower()
        ex_type = "special-exhibit"
        if any(
            kw in combined
            for kw in ("season", "holiday", "summer", "winter", "spring", "fall", "limited")
        ):
            ex_type = "seasonal"

        rec, _artists = build_exhibition_record(
            title=title,
            venue_id=venue_id,
            source_id=source_id,
            opening_date=start_date or today_str,
            closing_date=end_date,
            venue_name=PLACE_DATA["name"],
            description=description,
            image_url=image_url,
            source_url=source_url,
            portal_id=portal_id,
            admission_type="ticketed",
            tags=["coca-cola", "world-of-coca-cola", "downtown", "exhibition"],
            exhibition_type=ex_type,
        )
        records.append(rec)
        logger.info(
            "World of Coca-Cola Features: queued exhibition %r (%s – %s)",
            title,
            start_date or "open",
            end_date or "tbd",
        )

    return records


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl World of Coca-Cola permanent features and time-boxed special exhibitions.

    Returns (found, new, updated) where 'found' counts both features and exhibitions
    discovered in this run.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # Resolve (or create) the shared venue record
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("World of Coca-Cola Features: venue_id=%s", venue_id)

    # -----------------------------------------------------------------------
    # 1. Build the venue_features envelope from hard-coded permanent feature data
    # -----------------------------------------------------------------------
    features_envelope = TypedEntityEnvelope()
    features_envelope.add("destinations", {**PLACE_DATA})

    for feat in PERMANENT_FEATURES:
        record = {
            "place_id": venue_id,
            "slug": feat["slug"],
            "title": feat["title"],
            "feature_type": feat["feature_type"],
            "description": feat["description"],
            "image_url": feat.get("image_url"),
            "url": feat.get("source_url"),
            "source_url": feat.get("source_url"),
            "admission_type": feat.get("admission_type", "included"),
            "is_free": feat.get("is_free", False),
            "sort_order": feat.get("sort_order", 0),
            "tags": feat.get("tags"),
            "source_id": source_id,
            "portal_id": portal_id,
            "is_seasonal": False,
            "metadata": {
                "last_verified": "2026-04",
                "source": "worldofcoca-cola.com",
            },
        }
        features_envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(features_envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features
    logger.info(
        "World of Coca-Cola Features: %d permanent features processed "
        "(%d persisted, %d skipped)",
        len(PERMANENT_FEATURES),
        new_features,
        skip_features,
    )

    # -----------------------------------------------------------------------
    # 2. Build permanent exhibition records and add to envelope
    # -----------------------------------------------------------------------
    exhibition_envelope = TypedEntityEnvelope()
    seen: set = set()

    for perm in PERMANENT_EXHIBITIONS:
        rec, _artists = build_exhibition_record(
            title=perm["title"],
            venue_id=venue_id,
            source_id=source_id,
            opening_date=None,
            closing_date=None,
            venue_name=PLACE_DATA["name"],
            description=perm.get("description"),
            image_url=perm.get("image_url"),
            source_url=perm.get("source_url"),
            portal_id=portal_id,
            admission_type=perm.get("admission_type", "included"),
            tags=perm.get("tags", ["coca-cola", "world-of-coca-cola", "downtown"]),
            exhibition_type=perm.get("exhibition_type", "permanent"),
        )
        exhibition_envelope.add("exhibitions", rec)
        found += 1
        logger.info(
            "World of Coca-Cola Features: queued permanent exhibition %r",
            perm["title"],
        )

    logger.info(
        "World of Coca-Cola Features: %d permanent exhibitions queued",
        len(PERMANENT_EXHIBITIONS),
    )

    # -----------------------------------------------------------------------
    # 3. Scrape current/upcoming exhibitions via Playwright
    # -----------------------------------------------------------------------

    urls_to_scrape = [
        (PLAN_VISIT_URL, "plan-your-visit"),
        (EXHIBITS_URL, "exhibits"),
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            for url, label in urls_to_scrape:
                try:
                    logger.info("World of Coca-Cola Features: fetching %s", url)
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    # Scroll to trigger lazy-loaded content
                    for _ in range(4):
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(800)

                    exhibits = _scrape_exhibitions(
                        page, venue_id, source_id, portal_id, seen
                    )
                    for ex in exhibits:
                        exhibition_envelope.add("exhibitions", ex)
                    found += len(exhibits)
                    logger.info(
                        "World of Coca-Cola Features: found %d exhibitions on %s",
                        len(exhibits),
                        label,
                    )
                except Exception as page_exc:
                    logger.warning(
                        "World of Coca-Cola Features: failed to scrape %s: %s",
                        url,
                        page_exc,
                    )

            browser.close()

    except Exception as playwright_exc:
        logger.error(
            "World of Coca-Cola Features: Playwright error: %s", playwright_exc
        )

    if exhibition_envelope.exhibitions:
        ex_persist = persist_typed_entity_envelope(exhibition_envelope)
        ex_new = ex_persist.persisted.get("exhibitions", 0)
        ex_skip = ex_persist.skipped.get("exhibitions", 0)
        new += ex_new
        logger.info(
            "World of Coca-Cola Features: %d exhibitions queued (%d persisted, %d skipped)",
            len(exhibition_envelope.exhibitions),
            ex_new,
            ex_skip,
        )
    else:
        logger.info(
            "World of Coca-Cola Features: no time-boxed exhibitions found on this crawl"
        )

    logger.info(
        "World of Coca-Cola Features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
