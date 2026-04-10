"""
Crawler: Zoo Atlanta — venue features + seasonal exhibitions
zooatlanta.org

Produces:
  - venue_features: permanent animal habitats and attractions included with admission
  - exhibitions: time-boxed seasonal events (Brew at the Zoo, Wild Lights, Boo at the Zoo, etc.)

Site uses JavaScript rendering; we fetch the events page with Playwright for exhibitions
and hard-code the known permanent features (the zoo's habitat layout is stable and
well-documented; scraping it would require deep JS traversal with no reliability gain).

Source slug: zoo-atlanta-features  (auto-discovered from filename)
Crawl frequency: monthly
"""

from __future__ import annotations

import logging
import re
from datetime import date
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_place
from db.places import upsert_venue_feature
from db.exhibitions import insert_exhibition
from entity_lanes import SourceEntityCapabilities

logger = logging.getLogger(__name__)

BASE_URL = "https://zooatlanta.org"
EVENTS_URL = f"{BASE_URL}/visit/events/"

SOURCE_ENTITY_CAPABILITIES = SourceEntityCapabilities(
    destinations=True,
    venue_features=True,
    exhibitions=True,
)

PLACE_DATA = {
    "name": "Zoo Atlanta",
    "slug": "zoo-atlanta",
    "address": "800 Cherokee Ave SE",
    "neighborhood": "Grant Park",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30315",
    "lat": 33.7328,
    "lng": -84.3696,
    "place_type": "zoo",
    "spot_type": "zoo",
    "website": BASE_URL,
    "hours": {
        "monday": "09:00-17:00",
        "tuesday": "09:00-17:00",
        "wednesday": "09:00-17:00",
        "thursday": "09:00-17:00",
        "friday": "09:00-17:00",
        "saturday": "09:00-17:00",
        "sunday": "09:00-17:00",
    },
    "vibes": [
        "family-friendly",
        "outdoor",
        "animals",
        "nature",
        "educational",
        "all-ages",
    ],
    "description": (
        "Zoo Atlanta is home to more than 1,500 animals representing over 220 species, "
        "set within historic Grant Park. Giant pandas, western lowland gorillas, and "
        "immersive natural habitats make it one of the South's premier family destinations."
    ),
}

# ---------------------------------------------------------------------------
# Permanent venue features — hard-coded from zoo's published habitat map.
# Each description is >=100 chars and describes what a visitor actually experiences.
# admission_type="included" means these come with the base admission ticket.
# ---------------------------------------------------------------------------

_PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "african-savanna",
        "title": "African Savanna",
        "feature_type": "attraction",
        "description": (
            "Walk the open African Savanna habitat where giraffes, zebras, and ostriches roam a "
            "sweeping grassland setting. Seasonal giraffe feeding encounters let visitors "
            "connect up-close with the herd from a dedicated platform."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/2022/10/giraffe-feeding-hero.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/african-savanna/",
        "sort_order": 10,
        "tags": ["giraffes", "zebras", "africa", "savanna", "family-friendly"],
    },
    {
        "slug": "ford-african-rain-forest",
        "title": "Ford African Rain Forest",
        "feature_type": "attraction",
        "description": (
            "The Ford African Rain Forest houses one of the largest groups of western lowland "
            "gorillas in North America, including multiple family troops across lush naturalistic "
            "habitat islands. Interpretive panels trace gorilla social behavior and conservation "
            "work in Central Africa."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/gorillas-rain-forest.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/ford-african-rain-forest/",
        "sort_order": 20,
        "tags": ["gorillas", "great-apes", "africa", "rain-forest", "conservation"],
    },
    {
        "slug": "the-living-treehouse",
        "title": "The Living Treehouse",
        "feature_type": "attraction",
        "description": (
            "The Living Treehouse is home to Sumatran orangutans and siamangs, who navigate "
            "elevated rope systems and forested climbing structures that mimic the rainforest "
            "canopy. The habitat also features multi-species mixed exhibits with gibbons and "
            "other Southeast Asian species."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/orangutan-treehouse.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/the-living-treehouse/",
        "sort_order": 30,
        "tags": ["orangutans", "gibbons", "siamangs", "apes", "southeast-asia"],
    },
    {
        "slug": "scaly-slimy-spectacular",
        "title": "Scaly Slimy Spectacular",
        "feature_type": "attraction",
        "description": (
            "Scaly Slimy Spectacular is Zoo Atlanta's immersive reptile and amphibian house "
            "featuring Komodo dragons, Burmese pythons, rare salamanders, and dozens of other "
            "cold-blooded species in climate-controlled naturalistic terrariums. One of the "
            "largest reptile collections in any North American zoo."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/scaly-slimy-spectacular.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/scaly-slimy-spectacular/",
        "sort_order": 40,
        "tags": ["reptiles", "amphibians", "komodo-dragon", "snakes", "indoor"],
    },
    {
        "slug": "african-plains",
        "title": "African Plains",
        "feature_type": "attraction",
        "description": (
            "The African Plains section spans multiple connected habitats housing African "
            "elephants, white rhinos, meerkats, and a mix of plains species. The elephant "
            "habitat includes a large outdoor yard and a dedicated barn with keeper-narrated "
            "feeding demonstrations offered on most days."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/elephants-african-plains.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/african-plains/",
        "sort_order": 50,
        "tags": ["elephants", "rhinos", "meerkats", "africa", "plains"],
    },
    {
        "slug": "giant-panda-experience",
        "title": "Giant Panda Experience",
        "feature_type": "attraction",
        "description": (
            "Zoo Atlanta has been home to giant pandas since 1999 and remains one of only "
            "four zoos in the United States with a resident panda pair. The indoor-outdoor "
            "habitat features enrichment areas, bamboo feeding stations, and viewing windows "
            "for close observation. Check current panda status at zooatlanta.org before visiting."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/giant-panda-zoo-atlanta.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/giant-panda-experience/",
        "sort_order": 60,
        "tags": ["giant-panda", "china", "endangered", "conservation", "iconic"],
    },
    {
        "slug": "outback-station",
        "title": "Outback Station",
        "feature_type": "attraction",
        "description": (
            "Outback Station brings Australian wildlife to Grant Park, with resident red kangaroos "
            "and wallabies in a walk-through kangaroo habitat — one of the zoo's most interactive "
            "areas. The section also includes wombats, kookaburras, and a collection of Australian "
            "reptiles and birds."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/kangaroos-outback-station.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/outback-station/",
        "sort_order": 70,
        "tags": ["kangaroos", "wallabies", "australia", "walk-through", "interactive"],
    },
    {
        "slug": "kidzone",
        "title": "KIDZone",
        "feature_type": "attraction",
        "description": (
            "KIDZone is the zoo's dedicated children's area, built around smaller animals, "
            "hands-on learning stations, and play structures sized for toddlers and elementary-age "
            "kids. Resident animals include guinea pigs, small reptiles, and domestic farm animals, "
            "with keeper encounters and touch opportunities scheduled throughout the day."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/kidzone-children-area.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/animals-habitats/kidzone/",
        "sort_order": 80,
        "tags": ["children", "toddlers", "hands-on", "play", "family-friendly", "farm-animals"],
    },
    {
        "slug": "traders-alley-train",
        "title": "Trader's Alley Zoo Train",
        "feature_type": "experience",
        "description": (
            "The Trader's Alley Zoo Train loops through a scenic section of Zoo Atlanta on a "
            "narrated ride that runs on most operating days. A favorite for families with young "
            "children, the train offers a rest-and-ride break mid-zoo without leaving the grounds. "
            "Separate ticket or add-on required; check at the gate for current pricing."
        ),
        "image_url": "https://zooatlanta.org/wp-content/uploads/zoo-train-traders-alley.jpg",
        "admission_type": "add_on",
        "price_note": "Separate add-on ticket required",
        "source_url": f"{BASE_URL}/visit/",
        "sort_order": 90,
        "tags": ["train-ride", "children", "family", "rest-stop", "add-on"],
    },
]

# ---------------------------------------------------------------------------
# Known seasonal events — used as a seed when live scraping fails.
# These recur annually; exact dates must be fetched from the live site.
# ---------------------------------------------------------------------------

_SEASONAL_EXHIBITION_SEEDS: list[dict] = [
    {
        "title": "Brew at the Zoo",
        "description": (
            "Brew at the Zoo is Zoo Atlanta's adults-only evening event (21+) featuring craft "
            "beer and cider tastings from dozens of Georgia and regional breweries, set among "
            "the animal habitats after regular zoo hours. Live music and food vendors round out "
            "the evening. Ticket required; sells out annually."
        ),
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "tags": ["brew-at-the-zoo", "adults-only", "21+", "craft-beer", "evening-event", "zoo-atlanta"],
        "source_url": f"{BASE_URL}/visit/events/",
    },
    {
        "title": "Boo at the Zoo",
        "description": (
            "Boo at the Zoo transforms Zoo Atlanta into a Halloween family destination on select "
            "October evenings. Kids trick-or-treat at themed stations throughout the zoo, watch "
            "live entertainment, and enjoy seasonal décor. Included with general admission on "
            "designated Boo at the Zoo dates."
        ),
        "exhibition_type": "seasonal",
        "admission_type": "included",
        "tags": ["boo-at-the-zoo", "halloween", "trick-or-treat", "family", "october", "zoo-atlanta"],
        "source_url": f"{BASE_URL}/visit/events/",
    },
    {
        "title": "Wild Lights",
        "description": (
            "Wild Lights is Zoo Atlanta's winter holiday lights experience, held on select evenings "
            "from late November through December. Thousands of animal-shaped light sculptures and "
            "illuminated pathways transform the zoo grounds after dark. Separate ticket required; "
            "one of Atlanta's most-attended holiday events."
        ),
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "tags": ["wild-lights", "holiday-lights", "winter", "december", "family", "zoo-atlanta"],
        "source_url": f"{BASE_URL}/visit/events/",
    },
]

# ---------------------------------------------------------------------------
# Seasonal keyword detection for live-scraped events
# ---------------------------------------------------------------------------

_SEASONAL_KEYWORDS = {
    "brew", "boo", "wild lights", "illuminights", "holiday", "halloween",
    "festival", "nights", "after dark", "evening", "gala", "run", "5k",
}


def _is_seasonal_event(title: str) -> bool:
    tl = title.lower()
    return any(kw in tl for kw in _SEASONAL_KEYWORDS)


# ---------------------------------------------------------------------------
# Playwright scrape: attempt to fetch current seasonal events from events page
# ---------------------------------------------------------------------------

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_zoo_date(text: str) -> Optional[str]:
    """Parse date from Zoo Atlanta card format: 'Month Day, Year' or 'Month Day'."""
    text = text.strip()
    today = date.today()

    # Pattern: Month Day, Year
    m = re.match(r"(\w+)\s+(\d{1,2}),?\s+(\d{4})", text)
    if m:
        month_name, day, year = m.group(1).lower(), int(m.group(2)), int(m.group(3))
        month = _MONTHS.get(month_name)
        if month:
            return f"{year}-{month:02d}-{day:02d}"

    # Pattern: Month Day (no year — assume current or next year)
    m = re.match(r"(\w+)\s+(\d{1,2})$", text)
    if m:
        month_name, day = m.group(1).lower(), int(m.group(2))
        month = _MONTHS.get(month_name)
        if month:
            year = today.year
            try:
                candidate = date(year, month, day)
                if candidate < today:
                    candidate = date(year + 1, month, day)
                return candidate.isoformat()
            except ValueError:
                pass

    return None


def _scrape_live_events(source_id: int, venue_id: int, portal_id: Optional[str]) -> list[dict]:
    """
    Attempt Playwright scrape of Zoo Atlanta events page.
    Returns a list of exhibition records ready for insert_exhibition().
    Falls back to empty list on any error — caller applies seed data.
    """
    records: list[dict] = []
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
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            for _ in range(5):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(800)

            cards = page.query_selector_all("div.event.card")
            logger.info("Zoo Atlanta features: found %d event cards on events page", len(cards))

            for card in cards:
                try:
                    title_el = card.query_selector(".front .container h3[role='heading']")
                    if not title_el:
                        continue
                    title = title_el.inner_text().strip()
                    if not title or len(title) < 3:
                        continue

                    # Only route seasonal-style events to exhibitions
                    if not _is_seasonal_event(title):
                        continue

                    date_el = card.query_selector(".front .container em")
                    date_text = date_el.inner_text().strip() if date_el else ""
                    opening_date = _parse_zoo_date(date_text) if date_text else None

                    # Try to pick up a closing date from date_text with a dash range
                    closing_date: Optional[str] = None
                    range_m = re.search(
                        r"(\w+)\s+(\d{1,2})\s*[-–]\s*(?:(\w+)\s+)?(\d{1,2}),?\s*(\d{4})?",
                        date_text,
                    )
                    if range_m:
                        end_month_name = (range_m.group(3) or range_m.group(1)).lower()
                        end_day = int(range_m.group(4))
                        year_str = range_m.group(5)
                        year = int(year_str) if year_str else date.today().year
                        end_month = _MONTHS.get(end_month_name)
                        if end_month:
                            try:
                                closing_date = date(year, end_month, end_day).isoformat()
                            except ValueError:
                                pass

                    # Description from back of card
                    desc_els = card.query_selector_all(".back .back-content p")
                    description: Optional[str] = None
                    if len(desc_els) > 1:
                        description = desc_els[1].inner_text().strip() or None

                    # Image
                    image_url: Optional[str] = None
                    img_el = card.query_selector("div.featured-image[role='img']")
                    if img_el:
                        style = img_el.get_attribute("style") or ""
                        url_m = re.search(r'url\(["\']?(.*?)["\']?\)', style)
                        if url_m:
                            raw_url = url_m.group(1)
                            image_url = (
                                BASE_URL + raw_url if raw_url.startswith("/") else raw_url
                            )

                    # Source URL from "Read More" link
                    source_url = EVENTS_URL
                    link_el = card.query_selector("a.read-more")
                    if link_el:
                        href = link_el.get_attribute("href") or ""
                        if href.startswith("http"):
                            source_url = href
                        elif href.startswith("/"):
                            source_url = BASE_URL + href

                    record: dict = {
                        "title": title,
                        "place_id": venue_id,
                        "source_id": source_id,
                        "opening_date": opening_date,
                        "closing_date": closing_date,
                        "exhibition_type": "seasonal",
                        "admission_type": "ticketed",
                        "is_active": True,
                        "_venue_name": "Zoo Atlanta",
                        "source_url": source_url,
                        "tags": ["zoo-atlanta", "grant-park", "seasonal"],
                    }
                    if description:
                        record["description"] = description
                    if image_url:
                        record["image_url"] = image_url
                    if portal_id:
                        record["portal_id"] = portal_id

                    records.append(record)
                    logger.debug("Zoo Atlanta features: queued exhibition %r (%s)", title, opening_date)

                except Exception as card_exc:
                    logger.debug("Zoo Atlanta features: error parsing card: %s", card_exc)

            browser.close()

    except Exception as exc:
        logger.warning("Zoo Atlanta features: Playwright scrape failed: %s", exc)

    return records


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Zoo Atlanta permanent features and seasonal exhibitions.

    Returns (found, new, updated) counting both venue_features and exhibitions.
    """
    source_id = source["id"]
    portal_id = source.get("portal_id")
    found = new = updated = 0

    # 1. Resolve venue
    venue_id = get_or_create_place(PLACE_DATA)
    logger.info("Zoo Atlanta features: venue_id=%s", venue_id)

    # 2. Upsert permanent venue_features
    for feature in _PERMANENT_FEATURES:
        found += 1
        feat_data = {
            **feature,
            "source_id": source_id,
        }
        if portal_id:
            feat_data["portal_id"] = portal_id
        result = upsert_venue_feature(venue_id, feat_data)
        if result:
            new += 1
            logger.debug("Zoo Atlanta features: upserted feature %r (id=%s)", feature["title"], result)

    # 3. Scrape live events page for current seasonal exhibitions
    live_exhibitions = _scrape_live_events(source_id, venue_id, portal_id)

    # 4. If no live exhibitions scraped, fall back to seed data without dates
    #    (they serve as stubs until the next successful scrape fills in dates)
    if not live_exhibitions:
        logger.info(
            "Zoo Atlanta features: no live exhibitions scraped, using %d seed stubs",
            len(_SEASONAL_EXHIBITION_SEEDS),
        )
        today_iso = date.today().isoformat()
        for seed in _SEASONAL_EXHIBITION_SEEDS:
            live_exhibitions.append({
                "title": seed["title"],
                "place_id": venue_id,
                "source_id": source_id,
                "opening_date": None,
                "closing_date": None,
                "exhibition_type": seed["exhibition_type"],
                "admission_type": seed["admission_type"],
                "description": seed["description"],
                "source_url": seed["source_url"],
                "tags": seed["tags"],
                "_venue_name": "Zoo Atlanta",
                "is_active": True,
                "metadata": {"seed_data": True, "seed_loaded": today_iso},
            })
            if portal_id:
                live_exhibitions[-1]["portal_id"] = portal_id

    # 5. Insert / update exhibitions
    for ex in live_exhibitions:
        found += 1
        ex_id = insert_exhibition(ex)
        if ex_id:
            new += 1
            logger.info(
                "Zoo Atlanta features: inserted/updated exhibition %r (id=%s)",
                ex.get("title"),
                ex_id,
            )

    logger.info(
        "Zoo Atlanta features crawl complete: %d found, %d new/updated", found, new
    )
    return found, new, updated
