"""
Fernbank Museum of Natural History — permanent venue features + special exhibitions.

This crawler produces two entity types:

  venue_features  — seven permanent exhibits and experiences that define the
                    museum (A Walk Through Time in Georgia, NatureQuest, etc.).
                    Data is hard-coded from fernbankmuseum.org (verified April 2026)
                    to avoid JS-heavy scraping that would break on site redesigns.

  exhibitions     — time-boxed special exhibits discovered by scraping the
                    /exhibits/ page via Playwright.

Both entity types are emitted via TypedEntityEnvelope and persisted by the
shared entity_persistence layer.

Source slug: fernbank-museum-features   (auto-derived from filename)
Crawl frequency: monthly
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place
from db.client import get_client
from entity_lanes import SourceEntityCapabilities, TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope
from exhibition_utils import build_exhibition_record
from utils import parse_date_range

logger = logging.getLogger(__name__)

BASE_URL = "https://fernbankmuseum.org"
EXHIBITS_URL = f"{BASE_URL}/exhibits/"
VISIT_URL = f"{BASE_URL}/visiting/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
    exhibitions=True,
)

# ---------------------------------------------------------------------------
# Place data — Fernbank Museum of Natural History, Druid Hills
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Fernbank Museum of Natural History",
    "slug": "fernbank-museum-of-natural-history",
    "address": "767 Clifton Rd NE",
    "neighborhood": "Druid Hills",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    "lat": 33.7741,
    "lng": -84.3280,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "hours": {
        "monday": "10:00-17:00",
        "tuesday": "10:00-17:00",
        "wednesday": "10:00-17:00",
        "thursday": "10:00-17:00",
        "friday": "10:00-21:00",
        "saturday": "10:00-17:00",
        "sunday": "12:00-17:00",
    },
    "vibes": [
        "family-friendly",
        "educational",
        "nature",
        "museum",
        "all-ages",
        "druid-hills",
        "dinosaurs",
    ],
    "description": (
        "Fernbank Museum of Natural History is one of the largest natural history museums "
        "in the southeastern United States, set on 75 acres of old-growth Piedmont forest "
        "in Druid Hills. Home to the world's largest dinosaurs, a 65-acre urban forest, "
        "and an IMAX-style Giant Screen Theater."
    ),
}

# ---------------------------------------------------------------------------
# Permanent venue features — hard-coded from fernbankmuseum.org (April 2026).
# Each description is >= 100 characters and written for discovery context.
# admission_type="included" means these come with base admission.
# Giant Screen Theater is "ticketed" (separate add-on ticket).
# ---------------------------------------------------------------------------

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "walk-through-time-in-georgia",
        "title": "A Walk Through Time in Georgia",
        "feature_type": "attraction",
        "description": (
            "The largest permanent natural history exhibition in the world, spanning 15 billion years "
            "of Earth's history in a single sweeping narrative. The gallery traces the formation of "
            "the universe, the emergence of life, and the geological story of Georgia itself, "
            "anchored by the Fernbank Giant — the world's largest dinosaurs — in the soaring "
            "atrium: a pair of titanosaurs that still hold the record for largest animals ever "
            "to walk the Earth."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/walk-through-time-georgia-hero.jpg",
        "source_url": f"{BASE_URL}/exhibits/a-walk-through-time-in-georgia/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 10,
        "tags": [
            "dinosaurs",
            "natural-history",
            "geology",
            "georgia-history",
            "permanent",
            "flagship",
            "titanosaur",
        ],
    },
    {
        "slug": "fernbank-naturequest",
        "title": "Fernbank NatureQuest",
        "feature_type": "experience",
        "description": (
            "An immersive children's nature discovery area where kids can climb, splash, dig, "
            "and explore replicated Georgia outdoor habitats — from mountain streams to coastal "
            "marshes. Designed for ages 2–12, NatureQuest uses hands-on discovery to connect "
            "children with the natural environments of the Southeast."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/naturequest-kids-hero.jpg",
        "source_url": f"{BASE_URL}/exhibits/fernbank-naturequest/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 20,
        "tags": [
            "children",
            "family-friendly",
            "interactive",
            "hands-on",
            "toddler-friendly",
            "nature",
            "georgia-habitats",
        ],
    },
    {
        "slug": "fernbank-forest",
        "title": "Fernbank Forest",
        "feature_type": "attraction",
        "description": (
            "A 65-acre old-growth Piedmont forest preserved within the museum grounds — one of "
            "the largest remaining stands of mature Piedmont forest in any American city. "
            "Two miles of walking trails wind through ancient hardwoods, past seasonal wildflowers, "
            "and alongside a stream ecosystem that has remained essentially undisturbed for centuries."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/fernbank-forest-trail-hero.jpg",
        "source_url": f"{BASE_URL}/fernbank-forest/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 30,
        "tags": [
            "forest",
            "trails",
            "old-growth",
            "outdoor",
            "piedmont",
            "nature-walk",
            "trees",
        ],
    },
    {
        "slug": "giant-screen-theater",
        "title": "The Giant Screen Theater",
        "feature_type": "experience",
        "description": (
            "Fernbank's five-story IMAX-style Giant Screen Theater presents nature and science "
            "documentary films on one of the largest screens in the Southeast. The 430-seat "
            "theater runs multiple daily screenings of large-format films, from deep ocean "
            "expeditions to space exploration. Separate ticket required; not included with "
            "general museum admission."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/giant-screen-theater-hero.jpg",
        "source_url": f"{BASE_URL}/giant-screen-theater/",
        "admission_type": "ticketed",
        "is_free": False,
        "sort_order": 40,
        "tags": [
            "imax",
            "giant-screen",
            "film",
            "documentary",
            "theater",
            "5-story",
            "add-on",
        ],
    },
    {
        "slug": "wildwoods",
        "title": "WildWoods",
        "feature_type": "experience",
        "description": (
            "An outdoor nature adventure area at Fernbank featuring treehouses, climbing "
            "structures, balance logs, and discovery stations set within the museum's forested "
            "grounds. WildWoods invites children and families to engage physically with the "
            "natural environment and explore wildlife habitats through play and exploration."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/wildwoods-outdoor-adventure-hero.jpg",
        "source_url": f"{BASE_URL}/wildwoods/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 50,
        "tags": [
            "outdoor",
            "climbing",
            "treehouse",
            "children",
            "play",
            "family-friendly",
            "adventure",
        ],
    },
    {
        "slug": "star-gallery",
        "title": "Star Gallery",
        "feature_type": "attraction",
        "description": (
            "The Star Gallery at Fernbank explores astronomy and space science through exhibits "
            "on stellar evolution, the solar system, and humanity's place in the cosmos. "
            "Interactive displays and scale models help visitors understand the vast timescales "
            "and distances that define our universe, connecting space science to the museum's "
            "broader 15-billion-year narrative of natural history."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/star-gallery-astronomy-hero.jpg",
        "source_url": f"{BASE_URL}/exhibits/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 60,
        "tags": [
            "astronomy",
            "space",
            "solar-system",
            "stars",
            "science",
            "educational",
        ],
    },
    {
        "slug": "world-of-shells",
        "title": "World of Shells",
        "feature_type": "collection",
        "description": (
            "One of the largest public shell collections in the Southeast, the World of Shells "
            "gallery showcases thousands of specimens from marine, freshwater, and land "
            "mollusks collected from across the globe. The display ranges from microscopic "
            "shells to giant clams, tracing the incredible diversity of mollusks and their "
            "ecological roles in ocean and freshwater ecosystems."
        ),
        "image_url": "https://fernbankmuseum.org/wp-content/uploads/world-of-shells-collection-hero.jpg",
        "source_url": f"{BASE_URL}/exhibits/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 70,
        "tags": [
            "shells",
            "mollusks",
            "marine",
            "collection",
            "natural-history",
            "specimens",
        ],
    },
]

# ---------------------------------------------------------------------------
# Source registration helper
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "fernbank-museum-features"


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
        from db.client import writes_enabled, _log_write_skip

        if not writes_enabled():
            _log_write_skip(f"insert sources slug={_SOURCE_SLUG}")
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "Fernbank Museum Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "Fernbank Museum of Natural History — Features & Exhibitions",
            "url": EXHIBITS_URL,
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
# Exhibition scraping via Playwright
# ---------------------------------------------------------------------------

# Nav/chrome fragments to skip when parsing body text
_SKIP_LINES = {
    "skip to main content", "home", "visit", "exhibits", "plan your visit",
    "tickets", "buy tickets", "membership", "become a member", "give", "donate",
    "events", "groups", "education", "about", "contact", "search", "login",
    "shop", "rentals", "host an event", "privacy policy", "terms of use",
    "facebook", "instagram", "twitter", "youtube", "tiktok",
    "get directions", "hours & admission", "accessibility", "parking",
    "current exhibits", "upcoming exhibits", "past exhibits", "learn more",
    "explore", "see all", "more info", "read more", "find out more",
    "sign up", "subscribe", "newsletter", "social media",
    "fernbank museum of natural history", "fernbankmuseum.org",
}


def _scrape_exhibitions(
    page,
    venue_id: int,
    source_id: int,
    portal_id: Optional[str],
    seen: set,
) -> list[dict]:
    """
    Parse the current Playwright page for time-boxed exhibition listings.
    Returns a list of exhibition records suitable for the exhibitions lane.
    """
    records: list[dict] = []
    today_str = datetime.now().strftime("%Y-%m-%d")

    body_text = page.inner_text("body")
    lines = [ln.strip() for ln in body_text.split("\n") if ln.strip()]

    for idx, line in enumerate(lines):
        start_date, end_date = parse_date_range(line)
        if not end_date and not start_date:
            continue
        # Skip exhibitions that have already closed
        if end_date and end_date < today_str:
            continue

        # Walk back up to 5 lines for a candidate title
        title: Optional[str] = None
        for offset in range(1, min(6, idx + 1)):
            candidate = lines[idx - offset].strip()
            if not candidate or candidate.lower() in _SKIP_LINES:
                continue
            if len(candidate) < 4 or len(candidate) > 120:
                continue
            # Skip if the candidate is itself a date range
            cs, ce = parse_date_range(candidate)
            if cs or ce:
                continue
            # Skip pure navigation / marketing fragments
            if candidate.lower().startswith(
                ("skip", "menu", "search", "filter", "join us", "come ", "explore all")
            ):
                continue
            # Skip lines that are themselves month-day expressions
            if re.match(
                r"^(january|february|march|april|may|june|july|august|september|"
                r"october|november|december)\s+\d",
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
        for fwd in range(1, 6):
            if idx + fwd >= len(lines):
                break
            nxt = lines[idx + fwd].strip()
            if nxt.lower() in _SKIP_LINES:
                continue
            # Don't consume the next date range as a description
            ns, ne = parse_date_range(nxt)
            if ns or ne:
                break
            if len(nxt) > 40:
                description = nxt[:500]
                break

        # Determine exhibition_type
        combined = f"{title} {description or ''}".lower()
        ex_type = "special-exhibit"
        if any(
            kw in combined
            for kw in ("season", "holiday", "summer", "winter", "spring", "fall", "annual")
        ):
            ex_type = "seasonal"

        # Try to find a detail URL for this exhibit
        source_url: Optional[str] = None
        try:
            first_word = title.split()[0].lower() if title else ""
            links = page.query_selector_all("a[href]")
            for link in links[:100]:
                href = link.get_attribute("href") or ""
                if first_word and first_word in href.lower() and "exhibit" in href.lower():
                    source_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                    break
        except Exception:
            pass
        if not source_url:
            source_url = EXHIBITS_URL

        # Try to find the OG image for this page
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

        rec, artists = build_exhibition_record(
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
            tags=["fernbank", "natural-history", "druid-hills", "exhibition"],
            exhibition_type=ex_type,
        )
        records.append(rec)
        logger.info(
            "Fernbank Museum Features: queued exhibition %r (%s – %s)",
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
    Crawl Fernbank Museum permanent features + current special exhibitions.

    Returns (found, new, updated) where found counts both entity types.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # Resolve (or create) the venue record
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Fernbank Museum Features: venue_id=%s", venue_id)

    # -----------------------------------------------------------------------
    # 1. Upsert permanent venue_features via TypedEntityEnvelope
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
                "source": "fernbankmuseum.org",
            },
        }
        features_envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(features_envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features
    logger.info(
        "Fernbank Museum Features: %d permanent features processed (%d persisted, %d skipped)",
        len(PERMANENT_FEATURES),
        new_features,
        skip_features,
    )

    # -----------------------------------------------------------------------
    # 2. Scrape current/upcoming exhibitions via Playwright
    # -----------------------------------------------------------------------
    exhibition_envelope = TypedEntityEnvelope()
    seen: set = set()

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

            for url, label in [
                (EXHIBITS_URL, "exhibits"),
                (VISIT_URL, "visiting"),
            ]:
                try:
                    logger.info("Fernbank Museum Features: fetching %s", url)
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
                        "Fernbank Museum Features: found %d exhibitions on %s",
                        len(exhibits),
                        label,
                    )
                except Exception as page_exc:
                    logger.warning(
                        "Fernbank Museum Features: failed to scrape %s: %s", url, page_exc
                    )

            browser.close()

    except Exception as playwright_exc:
        logger.error(
            "Fernbank Museum Features: Playwright error: %s", playwright_exc
        )

    if exhibition_envelope.exhibitions:
        ex_persist = persist_typed_entity_envelope(exhibition_envelope)
        ex_new = ex_persist.persisted.get("exhibitions", 0)
        ex_skip = ex_persist.skipped.get("exhibitions", 0)
        new += ex_new
        logger.info(
            "Fernbank Museum Features: %d exhibitions queued (%d persisted, %d skipped)",
            len(exhibition_envelope.exhibitions),
            ex_new,
            ex_skip,
        )
    else:
        logger.info(
            "Fernbank Museum Features: no time-boxed exhibitions found on live site "
            "(site may not list dates or may be JS-gated beyond current scrape depth)"
        )

    logger.info(
        "Fernbank Museum Features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
