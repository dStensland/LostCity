"""
Crawler for Atlanta Botanical Garden — permanent features and curated exhibitions.

Produces:
  - venue_features: permanent gardens and attractions at the Midtown campus
  - exhibitions: time-boxed exhibitions and seasonal events parsed from atlantabg.org

The existing `atlanta_botanical` crawler handles the full Tribe Events API calendar
(day-to-day events, camps, programs). This crawler is the dedicated seeder for:
  1. Permanent garden features that don't change — Fuqua Orchid Center, Canopy Walk, etc.
  2. Current and upcoming major exhibitions parsed live from the events-exhibitions page.

Source slug: atlanta-botanical-garden-features
Crawl frequency: monthly (features don't change; exhibitions update seasonally)
"""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_place, upsert_venue_feature, insert_exhibition

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
_REQUEST_TIMEOUT = 20
_FETCH_DELAY_S = 1.0

BASE_URL = "https://atlantabg.org"
EVENTS_EXHIBITIONS_URL = f"{BASE_URL}/events-exhibitions/"

# ---------------------------------------------------------------------------
# Place data
# ---------------------------------------------------------------------------

PLACE_DATA: dict = {
    "name": "Atlanta Botanical Garden",
    "slug": "atlanta-botanical-garden",
    "address": "1345 Piedmont Ave NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "lat": 33.7900,
    "lng": -84.3731,
    "place_type": "garden",
    "spot_type": "garden",
    "website": BASE_URL,
    "vibes": ["family-friendly", "outdoor-seating", "all-ages"],
    "description": (
        "Atlanta Botanical Garden is a 30-acre urban oasis in Midtown Atlanta "
        "featuring world-class plant collections, the Kendeda Canopy Walk, the Fuqua "
        "Orchid Center, the Japanese Garden, and major seasonal exhibitions including "
        "Orchid Daze, Garden Lights Holiday Nights, and Niki in the Garden."
    ),
}

# ---------------------------------------------------------------------------
# Permanent features — hard-coded with live-verified descriptions and images
# ---------------------------------------------------------------------------

# Images sourced from og:image on each feature's dedicated page on atlantabg.org.
# Descriptions drawn from each page's content (verified April 2026).

PERMANENT_FEATURES: list[dict] = [
    {
        "slug": "fuqua-orchid-center",
        "title": "Fuqua Orchid Center",
        "feature_type": "attraction",
        "description": (
            "The Fuqua Orchid Center houses one of the largest orchid collections in the "
            "United States, showcasing more than 200 genera and 2,000 species from around "
            "the world. The center also displays tropical plants including bromeliads and "
            "carnivorous Nepenthes. The centerpiece of the annual Orchid Daze exhibition, "
            "the collection is open year-round and included with garden admission."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2019/01/OD_Home_Photo.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/fuqua-orchid-center/",
        "is_free": False,
        "sort_order": 10,
        "tags": ["orchid", "indoor", "tropical", "collection"],
    },
    {
        "slug": "kendeda-canopy-walk",
        "title": "Kendeda Canopy Walk",
        "feature_type": "attraction",
        "description": (
            "The Kendeda Canopy Walk is the largest tree canopy-level walkway of its kind "
            "in the United States. Soaring 40 feet in the air with a 12-foot-wide serpentine "
            "bridge, it gives visitors a bird's-eye view of Storza Woods while linking the "
            "formal gardens to 15 additional acres of hardwood forest. Opened in 2010, the "
            "steel suspension structure was designed by architects Jova/Daniels/Busby."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/Canopy_Walk_Tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/kendeda-canopy-walk/",
        "is_free": False,
        "sort_order": 20,
        "tags": ["canopy-walk", "outdoor", "aerial", "nature"],
    },
    {
        "slug": "storza-woods",
        "title": "Storza Woods",
        "feature_type": "attraction",
        "description": (
            "Storza Woods constitutes 10 of the Garden's 30 acres and is one of the few "
            "remaining secondary-growth mature hardwood forests in the City of Atlanta. "
            "Accessible from the forest floor and via the Kendeda Canopy Walk, the woodland "
            "contains several distinct garden rooms including the Glade Garden, Bowl Garden, "
            "Channel Garden, Boardwalk and Beechwood Overlook, Azalea Walk, and Camellia Walk."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/StorzaWoods_tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/storza-woods/",
        "is_free": False,
        "sort_order": 30,
        "tags": ["forest", "outdoor", "woodland", "nature"],
    },
    {
        "slug": "japanese-garden",
        "title": "Japanese Garden",
        "feature_type": "attraction",
        "description": (
            "No garden room in Atlanta Botanical Garden has a richer history than the "
            "Japanese Garden. In the 1960s, the Atlanta Bonsai Society started a Japanese "
            "Garden on the site — long before the botanical garden was established — largely "
            "consisting of bonsai plants within Piedmont Park. In 1980 the newly founded "
            "Garden restored the site with traditional Japanese design elements, creating "
            "one of the most serene spots on the Midtown campus."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/JapaneseGarden_tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/japanese-garden/",
        "is_free": False,
        "sort_order": 40,
        "tags": ["japanese", "outdoor", "serene", "bonsai"],
    },
    {
        "slug": "cascades-garden",
        "title": "Cascades Garden",
        "feature_type": "attraction",
        "description": (
            "The Cascades Garden is one of the Garden's most tranquil and sunniest spots, "
            "built on what was formerly a steep entry road. A series of pools carries water "
            "cascading from one to the next, flanked by hardy tropicals including bananas and "
            "cannas. An arbored pavilion provides a quiet seating area for reflection. The "
            "garden also serves as the setting for the Earth Goddess permanent sculpture and "
            "is accessible from the Kendeda Canopy Walk."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/Cascades_Tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/cascades-garden/",
        "is_free": False,
        "sort_order": 50,
        "tags": ["water", "outdoor", "tropical", "sculpture"],
    },
    {
        "slug": "earth-goddess",
        "title": "Earth Goddess",
        "feature_type": "attraction",
        "description": (
            "Earth Goddess is a 25-foot permanent living sculpture at the focal point of the "
            "Cascades Garden. Originally the highlight of the 2013–14 Imaginary Worlds "
            "exhibition, the figure was created by Mosaïcultures Internationales de Montréal "
            "and entered the Garden's permanent collection after the exhibition closed. Her "
            "flowing form is planted with thousands of flowers and trailing plants, and her "
            "outstretched hand spills a continuous stream of water."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/Earth_Goddess__Media_Sml.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/earth-goddess/",
        "is_free": False,
        "sort_order": 60,
        "tags": ["sculpture", "outdoor", "living-art", "landmark"],
    },
    {
        "slug": "edible-garden",
        "title": "Edible Garden",
        "feature_type": "attraction",
        "description": (
            "The Edible Garden demonstrates that fruits and vegetables make beautiful "
            "landscape plants in addition to nourishing cultures across the world. Built "
            "on the site of the Garden's former asphalt parking lot after the SAGE Parking "
            "Facility opened, the Edible Garden features three distinct garden rooms: the "
            "Vegetable Amphitheater, the Green Wall, and the Outdoor Kitchen — home to "
            "the Garden's culinary demonstration programming."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/EdibleGarden_Tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/edible-garden/",
        "is_free": False,
        "sort_order": 70,
        "tags": ["edible", "outdoor", "food", "educational"],
    },
    {
        "slug": "childrens-garden",
        "title": "Children's Garden",
        "feature_type": "experience",
        "description": (
            "The Children's Garden at Atlanta Botanical Garden is designed specifically for "
            "young visitors, offering hands-on learning experiences, themed play spaces, and "
            "interactive horticultural exhibits. The space hosts weekly family programs "
            "including Garden Playtime and Storybook Time that are complimentary with garden "
            "admission. It is one of Atlanta's premier nature-based destinations for families "
            "with children of all ages."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2020/01/GVLCG_web.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/childrens-garden/",
        "is_free": False,
        "sort_order": 80,
        "tags": ["kids", "family-friendly", "interactive", "educational"],
    },
    {
        "slug": "skyline-garden",
        "title": "Skyline Garden",
        "feature_type": "attraction",
        "description": (
            "Opened in 2017, the Skyline Garden offers a modern contrast to the Garden's "
            "other display spaces. The 1.5-acre garden extends from the Rock Garden near "
            "the southeastern side of the Great Lawn to the rear of the Fuqua Orchid Center, "
            "overlooking Piedmont Park. It seamlessly displays plants from opposite ends of "
            "the horticultural spectrum, with nearby features including the Anne Cox Chambers "
            "Flower Walk providing elevated views of Midtown Atlanta."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2018/09/SkylineGarden_Tout.jpg",
        "admission_type": "included",
        "source_url": f"{BASE_URL}/gardens-plants/skyline-garden/",
        "is_free": False,
        "sort_order": 90,
        "tags": ["rooftop", "outdoor", "modern", "views"],
    },
]

# ---------------------------------------------------------------------------
# Known seasonal / curated exhibitions
# These are supplemental to what the Tribe API returns in the main crawler.
# We hard-code the major signature exhibitions here for reliability, then
# also attempt a live parse from the events-exhibitions page.
# ---------------------------------------------------------------------------

# Each dict matches the fields expected by insert_exhibition().
# _venue_name is used for slug generation and is popped by insert_exhibition().
_STATIC_EXHIBITIONS: list[dict] = [
    {
        "title": "Niki in the Garden",
        "opening_date": "2026-05-09",
        "closing_date": "2026-09-06",
        "exhibition_type": "installation",
        "description": (
            "In celebration of the Garden's 50th anniversary, Atlanta Botanical Garden "
            "presents an encore of artist Niki de Saint Phalle's monumental sculptures "
            "that debuted at the Garden 20 years ago. The bold, colorful sculptures are "
            "dramatically lit at night during Cocktails in the Garden events, and "
            "distributed throughout the grounds for visitors to discover on their walk."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2025/12/niki-tout.jpg",
        "source_url": f"{BASE_URL}/events-exhibitions/niki-in-the-garden/",
        "admission_type": "ticketed",
        "tags": ["sculpture", "installation", "outdoor", "anniversary"],
        "is_active": True,
    },
    {
        "title": "Garden Lights, Holiday Nights",
        "opening_date": "2026-11-14",
        "closing_date": "2027-01-10",
        "exhibition_type": "seasonal",
        "description": (
            "Garden Lights, Holiday Nights presented by Invesco QQQ transforms Atlanta "
            "Botanical Garden into a winter wonderland of hand-crafted light sculptures, "
            "illuminated plant displays, and festive seasonal programming. The event won "
            "ABC-TV's The Great Christmas Light Fight Heavyweights Edition in 2023. "
            "It is one of Atlanta's premier holiday experiences and sells out well in advance; "
            "timed-entry tickets are required."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2023/09/GLHN_Premium_tout_2023-1.jpg",
        "source_url": f"{BASE_URL}/events-exhibitions/garden-lights-holiday-nights/",
        "admission_type": "ticketed",
        "tags": ["holiday", "lights", "seasonal", "family-friendly", "ticketed"],
        "is_active": True,
    },
    {
        "title": "Cocktails in the Garden",
        "opening_date": "2026-05-14",
        "closing_date": "2026-09-24",
        "exhibition_type": "seasonal",
        "description": (
            "Every Thursday evening from May through September, Atlanta Botanical Garden's "
            "popular after-hours event series blooms with lighted views of Niki in the "
            "Garden sculptures. Guests can purchase specialty cocktails, enjoy live music, "
            "lawn games, and more while exploring the illuminated garden from 5 to 9 p.m. "
            "Included with garden admission; cocktails and some experiences are additional."
        ),
        "image_url": "https://atlantabg.org/wp-content/uploads/2019/04/Cocktails-04-1398.jpg",
        "source_url": f"{BASE_URL}/events-exhibitions/cocktails-in-the-garden/",
        "admission_type": "included",
        "tags": ["cocktails", "adults", "date-night", "seasonal", "after-hours"],
        "is_active": True,
    },
]

# ---------------------------------------------------------------------------
# Live exhibition parsing helpers
# ---------------------------------------------------------------------------

# Month abbreviation → zero-padded month number
_MONTH_MAP: dict[str, str] = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

# Regex: "April 12" / "Apr. 12" / "April 12, 2026"
_DATE_WORD_RE = re.compile(
    r"(?P<month>[A-Za-z]+\.?)\s+(?P<day>\d{1,2})(?:,\s*(?P<year>\d{4}))?",
    re.IGNORECASE,
)

_KNOWN_EXHIBITION_TITLES = {
    "orchid daze",
    "garden lights",
    "niki in the garden",
    "cocktails in the garden",
    "atlanta super blooms",
    "atlanta blooms",
}


def _parse_word_date(month_str: str, day_str: str, year_str: Optional[str]) -> Optional[str]:
    """Convert 'April', '12', '2026' -> '2026-04-12'. Returns None on failure."""
    key = month_str.lower().rstrip(".")[:3]
    month_num = _MONTH_MAP.get(key)
    if not month_num:
        return None
    year = year_str or "2026"
    try:
        day = int(day_str)
        return f"{year}-{month_num}-{day:02d}"
    except ValueError:
        return None


def _parse_date_range_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract (opening_date, closing_date) from strings like:
      'Feb. 14 – April 12'
      'May 9 - Sept. 6'
      'November – January'
      'March – April'
    Returns (None, None) on failure.
    """
    # Normalize dashes
    text = re.sub(r"[–—]", "-", text)

    # Find all word-date matches in order
    matches = list(_DATE_WORD_RE.finditer(text))
    if len(matches) >= 2:
        m1, m2 = matches[0], matches[1]
        d1 = _parse_word_date(m1.group("month"), m1.group("day"), m1.group("year"))
        d2 = _parse_word_date(m2.group("month"), m2.group("day"), m2.group("year"))
        return d1, d2

    return None, None


def _fetch_live_exhibitions(
    session: requests.Session,
    place_id: int,
    source_id: int,
    venue_name: str,
) -> list[dict]:
    """
    Parse major exhibitions from the Atlanta Botanical Garden events-exhibitions page.
    Returns a list of exhibition dicts ready for insert_exhibition().
    """
    try:
        resp = session.get(EVENTS_EXHIBITIONS_URL, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("ABG features: failed to fetch events page: %s", exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results: list[dict] = []
    seen_titles: set[str] = set()

    # The page uses <h2>/<h3> headings with date text nearby in the same parent element.
    for heading_tag in ["h2", "h3"]:
        for h in soup.find_all(heading_tag):
            title = h.get_text(strip=True)
            if not title or len(title) < 5:
                continue

            title_lower = title.lower()

            # Skip non-exhibition headings
            skip_patterns = [
                "private events", "family programs", "knowledge blooms",
                "upcoming events", "events", "exhibitions", "rentals",
                "your visit", "plan your",
            ]
            if any(p in title_lower for p in skip_patterns):
                continue

            # Only process headings that look like exhibitions (have dates nearby)
            parent = h.parent
            if not parent:
                continue
            context_text = parent.get_text(" ", strip=True)

            # Must have a date range to qualify
            opening_date, closing_date = _parse_date_range_from_text(context_text)
            if not opening_date or not closing_date:
                continue

            # Deduplicate by normalized title
            norm_title = re.sub(r"\s+", " ", title.strip().lower())
            if norm_title in seen_titles:
                continue
            seen_titles.add(norm_title)

            # Don't re-insert exhibitions we've hard-coded in _STATIC_EXHIBITIONS
            # (they'll be handled via the static list with richer descriptions)
            if any(known in norm_title for known in _KNOWN_EXHIBITION_TITLES):
                logger.debug("ABG features: skipping known exhibition %r (static list handles it)", title)
                continue

            # Get the Learn More link if present
            link = parent.find("a", href=True)
            source_url = link["href"] if link else EVENTS_EXHIBITIONS_URL
            if source_url.startswith("/"):
                source_url = f"{BASE_URL}{source_url}"

            # Determine exhibition type from title/context keywords
            combined = f"{title_lower} {context_text.lower()}"
            if any(kw in combined for kw in ["sculpture", "artist", "installation", "art"]):
                ex_type = "installation"
            elif any(kw in combined for kw in ["bloom", "flower", "seasonal", "spring", "fall", "holiday"]):
                ex_type = "seasonal"
            else:
                ex_type = "special-exhibit"

            # Attempt to get og:image from the detail page
            image_url: Optional[str] = None
            if source_url and source_url != EVENTS_EXHIBITIONS_URL:
                try:
                    time.sleep(_FETCH_DELAY_S)
                    detail_resp = session.get(source_url, timeout=_REQUEST_TIMEOUT)
                    detail_resp.raise_for_status()
                    detail_soup = BeautifulSoup(detail_resp.text, "html.parser")
                    og_img = detail_soup.find("meta", property="og:image")
                    if og_img and og_img.get("content"):
                        image_url = og_img["content"].strip()
                except Exception as img_exc:
                    logger.debug("ABG features: image fetch failed for %r: %s", source_url, img_exc)

            # Build description from context (strip title and date prefix)
            raw_desc = re.sub(re.escape(title), "", context_text, flags=re.IGNORECASE)
            raw_desc = re.sub(r"^\s*[A-Za-z]+\.?\s+\d+\s*[-–]\s*[A-Za-z]+\.?\s+\d+[,\s]*:?", "", raw_desc).strip()
            raw_desc = re.sub(r"\s+", " ", raw_desc).strip()
            desc = raw_desc[:500] if raw_desc else f"{title} at Atlanta Botanical Garden."

            results.append({
                "title": title,
                "place_id": place_id,
                "source_id": source_id,
                "_venue_name": venue_name,
                "opening_date": opening_date,
                "closing_date": closing_date,
                "exhibition_type": ex_type,
                "description": desc,
                "image_url": image_url,
                "source_url": source_url,
                "admission_type": "ticketed",
                "is_active": True,
                "tags": ["garden", "exhibition"],
            })
            logger.debug(
                "ABG features: parsed live exhibition %r (%s – %s)",
                title, opening_date, closing_date,
            )

    return results


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Botanical Garden permanent features and exhibitions.

    Returns (found, new, updated) counts. 'found' = features + exhibitions attempted.
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})

    # Resolve place_id for Midtown campus
    try:
        place_id = get_or_create_place(PLACE_DATA)
    except Exception as exc:
        logger.error("ABG features: failed to resolve place_id: %s", exc)
        return 0, 0, 0

    venue_name = PLACE_DATA["name"]
    logger.info("ABG features: seeding %d permanent features", len(PERMANENT_FEATURES))

    # ------------------------------------------------------------------
    # 1. Upsert permanent venue features
    # ------------------------------------------------------------------
    for feature in PERMANENT_FEATURES:
        found += 1
        feature_data = dict(feature)
        feature_data["source_id"] = source_id

        # Validate description length (>= 100 chars required)
        desc = feature_data.get("description", "")
        if len(desc) < 100:
            logger.warning(
                "ABG features: feature %r description too short (%d chars), skipping",
                feature_data["title"],
                len(desc),
            )
            continue

        if not feature_data.get("image_url"):
            logger.warning(
                "ABG features: feature %r has no image_url", feature_data["title"]
            )

        try:
            result = upsert_venue_feature(place_id, feature_data)
            if result:
                new += 1
                logger.info(
                    "ABG features: upserted feature %r (id=%s)",
                    feature_data["title"],
                    result,
                )
        except Exception as exc:
            logger.error(
                "ABG features: failed to upsert feature %r: %s",
                feature_data["title"],
                exc,
            )

    # ------------------------------------------------------------------
    # 2. Insert static curated exhibitions
    # ------------------------------------------------------------------
    logger.info("ABG features: inserting %d static exhibitions", len(_STATIC_EXHIBITIONS))
    for ex in _STATIC_EXHIBITIONS:
        found += 1
        ex_data = dict(ex)
        ex_data["place_id"] = place_id
        ex_data["source_id"] = source_id
        ex_data["_venue_name"] = venue_name

        try:
            result = insert_exhibition(ex_data)
            if result:
                new += 1
                logger.info(
                    "ABG features: inserted exhibition %r (id=%s)",
                    ex_data["title"],
                    result,
                )
        except Exception as exc:
            logger.error(
                "ABG features: failed to insert exhibition %r: %s",
                ex_data["title"],
                exc,
            )

    # ------------------------------------------------------------------
    # 3. Parse live exhibitions from the events-exhibitions page
    # ------------------------------------------------------------------
    logger.info("ABG features: parsing live exhibitions from %s", EVENTS_EXHIBITIONS_URL)
    try:
        live_exhibitions = _fetch_live_exhibitions(session, place_id, source_id, venue_name)
        logger.info("ABG features: found %d live exhibitions beyond static list", len(live_exhibitions))

        for ex in live_exhibitions:
            found += 1
            try:
                result = insert_exhibition(ex)
                if result:
                    new += 1
                    logger.info(
                        "ABG features: inserted live exhibition %r (id=%s)",
                        ex["title"],
                        result,
                    )
            except Exception as exc:
                logger.error(
                    "ABG features: failed to insert live exhibition %r: %s",
                    ex["title"],
                    exc,
                )
    except Exception as exc:
        logger.error("ABG features: live exhibition parse failed: %s", exc)

    logger.info(
        "ABG features crawl complete: %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
