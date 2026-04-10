"""
Georgia Aquarium — permanent gallery features + special exhibitions.

This companion crawler to ``georgia_aquarium.py`` focuses on two entity types:

  venue_features  — the seven permanent galleries/experiences that define the
                    aquarium (Ocean Voyager, Tropical Diver, etc.).  These are
                    static and updated monthly; the data is researched from
                    georgiaaquarium.org and hard-coded here to avoid JS-heavy
                    scraping that would break on every site redesign.

  exhibitions     — time-boxed special exhibits and seasonal experiences
                    discovered by scraping /animal-experiences/ and the main
                    site via Playwright.

Both entity types are emitted via TypedEntityEnvelope and persisted by the
shared entity_persistence layer.

Source slug: georgia-aquarium-features
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

BASE_URL = "https://www.georgiaaquarium.org"
EXHIBITS_URL = f"{BASE_URL}/animal-experiences/"
EVENTS_URL = f"{BASE_URL}/event-calendar/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
    exhibitions=True,
)

# ---------------------------------------------------------------------------
# Place data — shared slug with the main georgia_aquarium crawler so both
# crawlers enrich the same place record (get_or_create_place is idempotent).
# ---------------------------------------------------------------------------

PLACE_DATA = {
    "name": "Georgia Aquarium",
    "slug": "georgia-aquarium",
    "address": "225 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "lat": 33.7634,
    "lng": -84.3951,
    "place_type": "museum",
    "spot_type": "museum",
    "website": BASE_URL,
    "hours": {
        "sunday": "10:00-21:00",
        "monday": "10:00-21:00",
        "tuesday": "10:00-21:00",
        "wednesday": "10:00-21:00",
        "thursday": "10:00-21:00",
        "friday": "10:00-21:00",
        "saturday": "10:00-21:00",
    },
    "vibes": [
        "family-friendly",
        "tourist-attraction",
        "interactive",
        "educational",
        "downtown",
    ],
}

# ---------------------------------------------------------------------------
# Permanent gallery definitions
# Researched from georgiaaquarium.org/animal-experiences/ (April 2026).
# Descriptions are >= 100 characters and written for discovery context.
# image_url values are canonical OG/CDN images from the aquarium's own pages.
# ---------------------------------------------------------------------------

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "ocean-voyager",
        "title": "Ocean Voyager",
        "feature_type": "attraction",
        "description": (
            "The world's largest aquatic exhibit, home to whale sharks, manta rays, "
            "thousands of fish, and a 100-foot underwater tunnel that puts you face-to-face "
            "with open-ocean giants. Diving and snorkeling experiences available for certified divers."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/ocean-voyager-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/ocean-voyager/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 10,
        "tags": ["whale-shark", "manta-ray", "ocean", "tunnel", "flagship"],
    },
    {
        "slug": "tropical-diver",
        "title": "Tropical Diver",
        "feature_type": "attraction",
        "description": (
            "A vibrant coral reef habitat packed with lionfish, sea turtles, zebra sharks, "
            "and thousands of tropical reef species. The gallery recreates the Indo-Pacific reef "
            "ecosystem in one of North America's largest coral displays."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/tropical-diver-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/tropical-diver/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 20,
        "tags": ["coral-reef", "tropical-fish", "sea-turtle", "reef"],
    },
    {
        "slug": "southern-company-river-scout",
        "title": "Southern Company River Scout",
        "feature_type": "attraction",
        "description": (
            "An immersive freshwater journey through river habitats from the Amazon to the "
            "Congo and Southeast Asia, featuring piranhas, electric eels, alligator gar, "
            "Asian small-clawed otters, and the bizarre-looking Asian arowana."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/river-scout-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/river-scout/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 30,
        "tags": ["freshwater", "amazon", "piranha", "otter", "gar"],
    },
    {
        "slug": "cold-water-quest",
        "title": "Cold Water Quest",
        "feature_type": "attraction",
        "description": (
            "Home to African black-footed penguins, Southern sea otters, beluga whales, "
            "Japanese spider crabs, and California sea lions. The gallery spans cold-water "
            "ecosystems from the Pacific Coast to sub-Antarctic shores."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/cold-water-quest-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/cold-water-quest/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 40,
        "tags": ["penguin", "sea-otter", "beluga", "cold-water"],
    },
    {
        "slug": "dolphin-coast",
        "title": "Dolphin Coast",
        "feature_type": "attraction",
        "description": (
            "Georgia Aquarium's expansive habitat for Indo-Pacific bottlenose dolphins "
            "features daily presentations that showcase natural behaviors, conservation "
            "education, and the athleticism of one of the ocean's most intelligent mammals."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/dolphin-coast-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/dolphin-coast/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 50,
        "tags": ["dolphin", "bottlenose", "presentation", "marine-mammal"],
    },
    {
        "slug": "atandt-dolphin-tales",
        "title": "AT&T Dolphin Tales",
        "feature_type": "experience",
        "description": (
            "A live 4D theater and dolphin presentation experience set inside a 2,000-seat "
            "stadium-style venue, blending live animal behaviors with theatrical storytelling "
            "about ocean conservation. Presentations run multiple times daily."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/dolphin-tales-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/dolphin-tales/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 60,
        "tags": ["dolphin", "theater", "4d", "show", "family"],
    },
    {
        "slug": "aquanaut-adventure",
        "title": "Aquanaut Adventure: A Discovery Zone",
        "feature_type": "experience",
        "description": (
            "An interactive hands-on discovery zone designed for younger visitors, featuring "
            "touch tanks with horseshoe crabs and sea urchins, crawl-through tunnels, "
            "submarine exploration themes, and age-appropriate marine science exhibits."
        ),
        "image_url": "https://www.georgiaaquarium.org/wp-content/uploads/2023/04/aquanaut-hero.jpg",
        "source_url": f"{BASE_URL}/animal-experiences/aquanaut-adventure/",
        "admission_type": "included",
        "is_free": False,
        "sort_order": 70,
        "tags": ["kids", "touch-tank", "interactive", "family", "toddler-friendly"],
    },
]

# ---------------------------------------------------------------------------
# Source registration helper
# ---------------------------------------------------------------------------

_SOURCE_SLUG = "georgia-aquarium-features"


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
            # Return a minimal stub so dry-run can proceed
            return {
                "id": -1,
                "slug": _SOURCE_SLUG,
                "is_active": True,
                "name": "Georgia Aquarium Features",
            }

        new_source = {
            "slug": _SOURCE_SLUG,
            "name": "Georgia Aquarium — Galleries & Exhibitions",
            "url": EXHIBITS_URL,
            "source_type": "scrape",
            "crawl_frequency": "monthly",
            "is_active": True,
        }
        ins = client.table("sources").insert(new_source).execute()
        if ins.data:
            logger.info("Created source record for %s (id=%s)", _SOURCE_SLUG, ins.data[0]["id"])
            return ins.data[0]

        logger.warning("Source insert returned no data for %s", _SOURCE_SLUG)
        return None

    except Exception as exc:
        logger.error("Failed to ensure source record for %s: %s", _SOURCE_SLUG, exc)
        return None


# ---------------------------------------------------------------------------
# Exhibition scraping via Playwright
# ---------------------------------------------------------------------------

# Exhibition keyword signals that indicate a time-boxed special exhibit
_EXHIBIT_KW = re.compile(
    r"\b(exhibit|exhibition|on view|installation|season|special|limited|present[s]?|featuring)\b",
    re.IGNORECASE,
)

# Nav/chrome lines to skip when parsing body text
_SKIP_LINES = {
    "skip to main content", "open today", "live cams", "search",
    "recommended searches", "aqua pass reservations", "presentation reservations",
    "tickets & pricing", "login", "visit", "buy tickets", "membership",
    "special offers", "hotel packages", "citypass", "group tickets",
    "gift certificates", "visitor guide", "directions & parking",
    "aquarium map", "dining", "accessibility", "faqs", "animals",
    "events", "events calendar", "seasonal activities", "host a private event",
    "programs", "support", "more", "plan your visit", "today's hours",
    "clear filters", "all events", "family events", "adults-only events",
    "conventions", "education program events", "camps", "viewing",
    "view event information", "explore event", "let's stay in touch",
    "submit", "about us", "information", "tickets", "resources",
    "privacy policy", "terms & conditions", "chat with us",
    "home", "animal experiences", "exhibits", "get tickets",
    "annual passes", "group sales", "education", "dive programs",
    "encounter programs", "behind the scenes", "swim with sharks",
    "swim with whale sharks", "contact us", "careers", "press room",
    "conservation", "research", "blog", "newsroom", "instagram",
    "facebook", "twitter", "youtube", "tiktok",
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

    # Try to extract exhibition cards: look for date ranges that bound a title
    for idx, line in enumerate(lines):
        start_date, end_date = parse_date_range(line)
        if not end_date and not start_date:
            continue
        # Skip exhibitions already closed
        if end_date and end_date < today_str:
            continue

        # Walk back up to 4 lines for a candidate title
        title: Optional[str] = None
        for offset in range(1, min(5, idx + 1)):
            candidate = lines[idx - offset].strip()
            if not candidate or candidate.lower() in _SKIP_LINES:
                continue
            if len(candidate) < 4:
                continue
            # Reject titles that are too long (likely description text, not titles)
            if len(candidate) > 120:
                continue
            # Skip if it is itself a date range
            cs, ce = parse_date_range(candidate)
            if cs or ce:
                continue
            # Skip pure navigation fragments
            if candidate.lower().startswith(("skip", "menu", "search", "filter")):
                continue
            # Skip lines that look like marketing copy / description fragments
            if candidate.lower().startswith(("guests are", "campers will", "join us", "come ", "celebrate ")):
                continue
            # Skip lines that are themselves date expressions (e.g. "June 22–June 26")
            if re.match(
                r"^(january|february|march|april|may|june|july|august|september|october|november|december)"
                r"\s+\d",
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
            # Avoid consuming the next date range as a description
            ns, ne = parse_date_range(nxt)
            if ns or ne:
                break
            if len(nxt) > 40:
                description = nxt[:500]
                break

        # Determine exhibition_type from title/description signal
        combined = f"{title} {description or ''}".lower()
        ex_type = "special-exhibit"
        if any(kw in combined for kw in ("season", "holiday", "summer", "winter", "spring", "fall")):
            ex_type = "seasonal"

        # Attempt to find a detail URL for this exhibit
        source_url: Optional[str] = None
        try:
            # Look for a link containing words from the title
            first_word = title.split()[0].lower() if title else ""
            links = page.query_selector_all("a[href]")
            for link in links[:80]:
                href = link.get_attribute("href") or ""
                if first_word and first_word in href.lower():
                    source_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                    break
        except Exception:
            pass
        if not source_url:
            source_url = EXHIBITS_URL

        # Try to find a representative image
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
            tags=["aquarium", "georgia-aquarium", "downtown", "exhibition"],
            exhibition_type=ex_type,
        )
        records.append(rec)
        logger.info(
            "Queued exhibition: %r (%s – %s)",
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
    Crawl Georgia Aquarium permanent features + current exhibitions.

    Returns (found, new, updated) where "found" counts both features and
    exhibitions discovered in this run.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")

    found = 0
    new = 0
    updated = 0

    # Resolve (or create) the venue record
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Georgia Aquarium Features: venue_id=%s", venue_id)

    # -----------------------------------------------------------------------
    # 1. Build the venue_features envelope from hard-coded gallery data
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
                "source": "georgiaaquarium.org/animal-experiences/",
            },
        }
        features_envelope.add("venue_features", record)
        found += 1

    persist_result = persist_typed_entity_envelope(features_envelope)
    new_features = persist_result.persisted.get("venue_features", 0)
    skip_features = persist_result.skipped.get("venue_features", 0)
    new += new_features
    logger.info(
        "Georgia Aquarium Features: %d permanent features processed (%d persisted, %d skipped)",
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

            # Scrape exhibits page
            for url, label in [
                (EXHIBITS_URL, "animal-experiences"),
                (EVENTS_URL, "event-calendar"),
            ]:
                try:
                    logger.info("Georgia Aquarium Features: fetching %s", url)
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    # Scroll to trigger lazy-load
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
                        "Georgia Aquarium Features: found %d exhibitions on %s",
                        len(exhibits),
                        label,
                    )
                except Exception as page_exc:
                    logger.warning(
                        "Georgia Aquarium Features: failed to scrape %s: %s", url, page_exc
                    )

            browser.close()

    except Exception as playwright_exc:
        logger.error(
            "Georgia Aquarium Features: Playwright error: %s", playwright_exc
        )

    if exhibition_envelope.exhibitions:
        ex_persist = persist_typed_entity_envelope(exhibition_envelope)
        ex_new = ex_persist.persisted.get("exhibitions", 0)
        ex_skip = ex_persist.skipped.get("exhibitions", 0)
        new += ex_new
        logger.info(
            "Georgia Aquarium Features: %d exhibitions queued (%d persisted, %d skipped)",
            len(exhibition_envelope.exhibitions),
            ex_new,
            ex_skip,
        )

    logger.info(
        "Georgia Aquarium Features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
