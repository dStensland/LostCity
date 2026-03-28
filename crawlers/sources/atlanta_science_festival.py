"""
Atlanta Science Festival crawler.

The festival runs annually in March (2026: March 7–21) with 100+ events
across venues citywide, culminating in the Exploration Expo at Piedmont Park.
Events span universities, libraries, parks, museums, and community spaces.

Data flow:
  1. Fetch the single listing page (/events-2026/) — all events on one page,
     no pagination. Each event card has title, date/time, description snippet,
     audience tags, image, and a link to the event detail page.
  2. Fetch each event detail page concurrently to extract: venue name, street
     address, price, ticket URL, and topic tags.
  3. Per-event venue creation: each event may be at a different venue. We call
     get_or_create_place() per unique (venue_name, address) pair.

Design notes:
  - No Tribe API, no JavaScript rendering — static HTML served by WordPress
    with Enfold theme.
  - All 113 events are on a single listing page (page=2 returns the same content).
  - Some events are cancelled — detected by "cancelled" in description, skipped.
  - Events where the detail page doesn't follow the standard template (e.g.
    custom Expo splash page) fall back to listing-page data with a placeholder
    venue (Atlanta Science Festival organization venue).
  - Uses a thread pool for concurrent detail page fetches with polite delays.
  - Series hint: events running on multiple days (e.g. the Escape Room Trail
    repeating daily) are linked into a festival_program series.
"""

from __future__ import annotations

import html
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://atlantasciencefestival.org"
_LISTING_URL = f"{_BASE_URL}/events-2026/"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

# Concurrent detail page fetches (polite — not hammering the site)
_DETAIL_WORKERS = 5
# Delay between batches of detail page fetches (seconds)
_BATCH_DELAY = 0.5
# Request timeout
_TIMEOUT = 20

# Fallback venue when event detail page doesn't follow standard template
_FESTIVAL_ORG_VENUE: dict = {
    "name": "Atlanta Science Festival",
    "slug": "atlanta-science-festival-org",
    "address": "675 Ponce De Leon Ave NE",
    "neighborhood": "Poncey-Highland",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7730,
    "lng": -84.3658,
    "place_type": "organization",
    "website": "https://atlantasciencefestival.org",
    "vibes": ["educational", "family-friendly"],
}

# ---------------------------------------------------------------------------
# Audience → age inference
# ---------------------------------------------------------------------------

# Maps ASF audience labels to (age_min, age_max, tags)
_AUDIENCE_MAP: dict[str, tuple[Optional[int], Optional[int], list[str]]] = {
    "preschool": (3, 5, ["preschool", "kids", "family-friendly"]),
    "elem. school": (5, 12, ["elementary", "kids", "family-friendly"]),
    "middle school": (11, 14, ["tween", "kids", "family-friendly"]),
    "high school": (14, 18, ["teen"]),
    "families": (None, None, ["family-friendly"]),
    "adults": (18, None, ["adults"]),
}

# Topic slugs → extra LostCity tags
_TOPIC_TAG_MAP: dict[str, list[str]] = {
    "nature & environment": ["outdoor"],
    "the great outdoors": ["outdoor"],
    "astronomy": [],
    "chemistry": [],
    "physics": [],
    "biology": [],
    "medicine & health": ["health"],
    "science & society": [],
    "visual & performing arts": [],
    "mathematics": [],
    "engineering & technology": [],
    "computer science": [],
}

# ---------------------------------------------------------------------------
# Price parsing
# ---------------------------------------------------------------------------

_COST_RANGE_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d{1,2})?)\s*[-–—]\s*\$?\s*([\d,]+(?:\.\d{1,2})?)"
)
_COST_SINGLE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_FREE_RE = re.compile(r"\bfree\b", re.IGNORECASE)


def _parse_price(
    price_text: str,
) -> tuple[Optional[float], Optional[float], bool]:
    """
    Parse an ASF price string into (price_min, price_max, is_free).

    Examples:
      "Price: Free"                          → (0.0, 0.0, True)
      "Price: Free with advance registration"→ (0.0, 0.0, True)
      "Price: $5"                            → (5.0, 5.0, False)
      "Price: $17.50-$35 (sliding scale)"   → (17.50, 35.0, False)
      "" or missing                          → (None, None, False)
    """
    if not price_text:
        return None, None, False

    s = price_text.strip()

    if _FREE_RE.search(s):
        return 0.0, 0.0, True

    m = _COST_RANGE_RE.search(s)
    if m:
        lo = float(m.group(1).replace(",", ""))
        hi = float(m.group(2).replace(",", ""))
        if lo > hi:
            lo, hi = hi, lo
        return lo, hi, hi == 0.0

    m = _COST_SINGLE_RE.search(s)
    if m:
        val = float(m.group(1).replace(",", ""))
        return val, val, val == 0.0

    return None, None, False


# ---------------------------------------------------------------------------
# Date/time parsing
# ---------------------------------------------------------------------------


def _parse_listing_date(
    date_text: str,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse the listing page date cell text into (start_date, end_date, start_time, end_time).

    The listing page format is: "Tuesday, 03/10/2026 - 7:00am  to  7:00pm"
    Returns dates as "YYYY-MM-DD", times as "HH:MM" (24h).
    """
    # Normalise whitespace
    text = re.sub(r"\s+", " ", date_text.strip())

    # Extract date portion: MM/DD/YYYY
    date_m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not date_m:
        return None, None, None, None

    month, day, year = int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3))
    start_date_str = f"{year:04d}-{month:02d}-{day:02d}"

    # Extract times: "7:00am to 7:00pm" or "7:00am – 7:00pm"
    time_m = re.search(
        r"(\d{1,2}:\d{2}\s*[ap]m)\s*(?:to|-|–)\s*(\d{1,2}:\d{2}\s*[ap]m)",
        text,
        re.IGNORECASE,
    )
    start_time_str: Optional[str] = None
    end_time_str: Optional[str] = None

    if time_m:
        start_time_str = _to_24h(time_m.group(1).strip())
        end_time_str = _to_24h(time_m.group(2).strip())

    return start_date_str, None, start_time_str, end_time_str


def _parse_detail_date(
    date_text: str,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Parse the detail page date/time text into (start_date, start_time, end_time).

    Format: "Tuesday, March 10th, 2026\n11:30 am – 12:30 pm"
    """
    text = re.sub(r"\s+", " ", date_text.strip())

    # Month name date: "March 10th, 2026"
    month_names = {
        "january": 1,
        "february": 2,
        "march": 3,
        "april": 4,
        "may": 5,
        "june": 6,
        "july": 7,
        "august": 8,
        "september": 9,
        "october": 10,
        "november": 11,
        "december": 12,
    }
    date_m = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
        text,
        re.IGNORECASE,
    )
    if not date_m:
        return None, None, None

    month = month_names[date_m.group(1).lower()]
    day = int(date_m.group(2))
    year = int(date_m.group(3))
    start_date_str = f"{year:04d}-{month:02d}-{day:02d}"

    # Time: "11:30 am – 12:30 pm"
    time_m = re.search(
        r"(\d{1,2}:\d{2}\s*[ap]m)\s*[-–]\s*(\d{1,2}:\d{2}\s*[ap]m)",
        text,
        re.IGNORECASE,
    )
    start_time_str: Optional[str] = None
    end_time_str: Optional[str] = None
    if time_m:
        start_time_str = _to_24h(time_m.group(1).strip())
        end_time_str = _to_24h(time_m.group(2).strip())

    return start_date_str, start_time_str, end_time_str


def _to_24h(time_str: str) -> Optional[str]:
    """Convert "7:00am" or "11:30 pm" to "07:00" / "23:30"."""
    time_str = time_str.strip().lower().replace(" ", "")
    for fmt in ("%I:%M%p", "%I%p"):
        try:
            t = datetime.strptime(time_str, fmt)
            return t.strftime("%H:%M")
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(raw: str, max_len: int = 800) -> str:
    """Strip HTML tags, decode entities, normalise whitespace."""
    if not raw:
        return ""
    text = html.unescape(raw)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 3].rstrip() + "..."
    return text


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _get(session: requests.Session, url: str, *, retries: int = 3) -> Optional[str]:
    """GET a URL, returning HTML text or None on failure."""
    for attempt in range(1, retries + 1):
        try:
            resp = session.get(url, headers=_HEADERS, timeout=_TIMEOUT)
            if resp.status_code == 404:
                logger.debug("[asf] 404: %s", url)
                return None
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt >= retries:
                logger.warning(
                    "[asf] GET %s failed after %d attempts: %s", url, retries, exc
                )
                return None
            time.sleep(1.5 * attempt)
    return None


# ---------------------------------------------------------------------------
# Listing page parser
# ---------------------------------------------------------------------------


def _parse_listing(html_text: str) -> list[dict]:
    """
    Parse the ASF listing page into a list of raw event dicts.

    Each dict has:
      title, source_url (relative), start_date, start_time, end_time,
      description_snippet, audiences, image_url
    """
    soup = BeautifulSoup(html_text, "html.parser")
    events: list[dict] = []

    # All event containers
    containers = soup.find_all("div", class_=re.compile(r"row event-container"))

    for container in containers:
        # The event info block
        info_div = container.find("div", class_=re.compile(r"\bevent\b"))
        if not info_div:
            continue

        # Title and URL
        h3 = info_div.find("h3")
        if not h3:
            continue
        a_tag = h3.find("a")
        if not a_tag:
            continue

        title_raw = a_tag.get_text(strip=True)
        title = html.unescape(title_raw)
        relative_url = a_tag.get("href", "").strip()
        if not relative_url or not title:
            continue

        source_url = (
            relative_url
            if relative_url.startswith("http")
            else f"{_BASE_URL}{relative_url}"
        )

        # Date/time
        date_p = info_div.find("p", class_="date")
        start_date_str, _, start_time_str, end_time_str = (None, None, None, None)
        if date_p:
            date_text = date_p.get_text(" ", strip=True)
            start_date_str, _, start_time_str, end_time_str = _parse_listing_date(
                date_text
            )

        if not start_date_str:
            logger.debug("[asf] Could not parse date for %r — skipping", title)
            continue

        # Skip past events
        try:
            if datetime.strptime(start_date_str, "%Y-%m-%d").date() < date.today():
                continue
        except ValueError:
            continue

        # Description snippet (first <p> after the date p)
        desc_snippet = ""
        for p in info_div.find_all("p"):
            if "date" in p.get("class", []):
                continue
            if "audience" in p.get("class", []):
                continue
            text = p.get_text(" ", strip=True)
            if text:
                desc_snippet = text
                break

        # Audience labels
        audience_p = info_div.find("p", class_="audience")
        audiences: list[str] = []
        if audience_p:
            for a in audience_p.find_all("a"):
                label = a.get_text(strip=True).lower()
                if label:
                    audiences.append(label)

        # Image
        img_tag = container.find("img", class_="avia_image")
        image_url: Optional[str] = None
        if img_tag and img_tag.get("src"):
            src = img_tag["src"]
            if src.startswith("//"):
                src = f"https:{src}"
            image_url = src

        events.append(
            {
                "title": title,
                "source_url": source_url,
                "start_date": start_date_str,
                "start_time": start_time_str,
                "end_time": end_time_str,
                "description_snippet": desc_snippet,
                "audiences": audiences,
                "image_url": image_url,
            }
        )

    logger.info("[asf] Listing page parsed: %d events", len(events))
    return events


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail(html_text: str) -> dict:
    """
    Parse an ASF event detail page, returning supplemental data:
      venue_name, venue_type_label, venue_address, venue_city, venue_state,
      venue_zip, start_date (refined), start_time (refined), end_time (refined),
      price_text, ticket_url, topics
    """
    result: dict = {}
    soup = BeautifulSoup(html_text, "html.parser")

    # The sidebar section contains Date/Time, Venue, Price, Ticket Link, Topic
    sidebar = soup.find("section", id="sidebarEvents")
    if not sidebar:
        return result

    text_div = sidebar.find("div", class_="avia_textblock")
    if not text_div:
        return result

    # ---- Walk h3 headers, accumulating child nodes per section -------------
    # We use a two-pass approach: collect all h3 positions + trailing siblings,
    # then process each section by name.
    sections: dict[str, list] = {}  # section_name → list of child elements
    current: Optional[str] = None
    for elem in text_div.children:
        name = getattr(elem, "name", None)
        if name == "h3":
            current = elem.get_text(strip=True).lower()
            sections[current] = []
        elif current is not None:
            sections[current].append(elem)

    # ---- Process each known section ----------------------------------------
    # Date and Time
    dt_nodes = sections.get("date and time", [])
    if dt_nodes:
        dt_text = _nodes_to_text(dt_nodes)
        start_date, start_time, end_time = _parse_detail_date(dt_text)
        if start_date:
            result["start_date"] = start_date
        if start_time:
            result["start_time"] = start_time
        if end_time:
            result["end_time"] = end_time

    # Venue — use <br>-aware line splitting
    venue_nodes = sections.get("venue", [])
    if venue_nodes:
        _parse_venue_nodes(venue_nodes, result)

    # Price
    price_nodes = sections.get("price", [])
    if price_nodes:
        result["price_text"] = _nodes_to_text(price_nodes)

    # Ticket Link — find the href
    ticket_nodes = sections.get("ticket link", [])
    for node in ticket_nodes:
        node_tag = getattr(node, "name", None)
        if node_tag == "a" and node.get("href"):
            result["ticket_url"] = node["href"]
            break
        elif node_tag in ("p", "strong"):
            a = node.find("a")
            if a and isinstance(a, object) and hasattr(a, "get") and a.get("href"):
                result["ticket_url"] = a["href"]
                break

    # Topic
    topic_nodes = sections.get("topic", [])
    if topic_nodes:
        topic_text = _nodes_to_text(topic_nodes)
        result["topics"] = [
            t.strip().lower() for t in topic_text.split(",") if t.strip()
        ]

    # Fallback ticket link from sidebar anchors
    if "ticket_url" not in result:
        for a in sidebar.find_all("a"):
            href = a.get("href", "")
            label = a.get_text(strip=True).lower()
            if (
                href
                and not href.startswith("#")
                and ("ticket" in label or "register" in label or "get" in label)
            ):
                result["ticket_url"] = href
                break

    return result


def _nodes_to_text(nodes: list) -> str:
    """Flatten a list of BS4 nodes to plain text (space-separated)."""
    parts: list[str] = []
    for node in nodes:
        if hasattr(node, "get_text"):
            text = node.get_text(" ", strip=True)
        else:
            text = str(node).strip()
        if text:
            parts.append(text)
    return " ".join(parts).strip()


def _parse_venue_nodes(nodes: list, result: dict) -> None:
    """
    Parse the venue section nodes into structured venue fields.

    The sidebar venue HTML (after the <h3>Venue</h3>) looks like:

        <p>Indoor Event</p>
        Mason Mill Park
        <br>1400 McConnell Drive
        <br>Decatur, GA 30033
        <br><strong><a href="#parkingInfo">Parking</a></strong>

    We use <br> tags as line separators to get clean individual lines:
      line 0: venue name (after stripping type label from <p>)
      line 1: street address (starts with a number)
      line 2: City, ST ZIP
      remaining lines: navigation links (ignored)
    """
    # Collect <br>-separated lines by substituting <br> with a newline sentinel
    # then flatten the remaining nodes
    lines: list[str] = []
    current_line_parts: list[str] = []

    # First element is typically the <p>Indoor Event</p> type label
    venue_type_label = ""

    for node in nodes:
        tag_name = getattr(node, "name", None)
        if tag_name == "p":
            text = node.get_text(strip=True)
            # The type label paragraph
            if re.match(
                r"^(Indoor\s*&?\s*Outdoor\s*Event|Indoor\s*Event|Outdoor\s*Event)$",
                text,
                re.IGNORECASE,
            ):
                venue_type_label = text
            else:
                current_line_parts.append(text)
        elif tag_name == "br":
            # Line break — flush current line and start a new one
            line = " ".join(current_line_parts).strip()
            if line:
                lines.append(line)
            current_line_parts = []
        elif tag_name in ("strong", "a"):
            # Navigation links (Parking, Transportation, Accessibility) — skip
            text = node.get_text(strip=True)
            nav_pattern = re.compile(
                r"^(Parking|Transportation|Accessibility)$", re.IGNORECASE
            )
            if not nav_pattern.match(text):
                current_line_parts.append(text)
        elif tag_name is None:
            # NavigableString
            text = str(node).strip()
            if text:
                current_line_parts.append(text)
        else:
            text = node.get_text(" ", strip=True)
            if text:
                current_line_parts.append(text)

    # Flush final line
    line = " ".join(current_line_parts).strip()
    if line:
        lines.append(line)

    result["venue_type_label"] = venue_type_label

    # Filter out navigation-only lines
    _NAV_RE = re.compile(r"^(Parking|Transportation|Accessibility)$", re.IGNORECASE)
    lines = [ln for ln in lines if not _NAV_RE.match(ln.strip())]

    if not lines:
        result["venue_name"] = "Atlanta Science Festival"
        return

    # Line parsing: venue name, street address, City ST ZIP
    # Find the street address line (starts with digits)
    addr_idx: Optional[int] = None
    for i, line in enumerate(lines):
        if re.match(r"^\d+\s+\w", line):
            addr_idx = i
            break

    if addr_idx is not None:
        # Everything before the address line = venue name
        result["venue_name"] = (
            " ".join(lines[:addr_idx]).strip() or "Atlanta Science Festival"
        )
        result["venue_address"] = lines[addr_idx].strip().rstrip(".")
        # Next line = City, ST ZIP
        city_line = lines[addr_idx + 1] if addr_idx + 1 < len(lines) else ""
    else:
        # No address line found — everything is venue name
        result["venue_name"] = " ".join(lines).strip() or "Atlanta Science Festival"
        result["venue_address"] = ""
        city_line = ""

    # Parse City, ST ZIP
    if city_line:
        city_m = re.match(r"([A-Za-z ]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)", city_line)
        if city_m:
            result["venue_city"] = city_m.group(1).strip()
            result["venue_state"] = city_m.group(2).strip()
            result["venue_zip"] = city_m.group(3).strip()


# ---------------------------------------------------------------------------
# Venue creation
# ---------------------------------------------------------------------------

# Cache of (venue_name_lower, address_lower) → venue_id to avoid redundant DB calls
_venue_cache: dict[tuple[str, str], int] = {}


def _get_or_create_event_venue(
    venue_name: str,
    venue_address: str,
    venue_city: str,
    venue_state: str,
    venue_zip: str,
    is_outdoor: bool,
) -> int:
    """
    Get or create a venue record for an ASF event.

    Returns venue_id.
    """
    cache_key = (venue_name.lower(), venue_address.lower())
    if cache_key in _venue_cache:
        return _venue_cache[cache_key]

    slug = re.sub(r"[^a-z0-9]+", "-", venue_name.lower()).strip("-")
    # Append city abbreviation to reduce slug collisions
    if venue_city:
        city_slug = re.sub(r"[^a-z0-9]+", "-", venue_city.lower()).strip("-")
        slug = f"{slug}-{city_slug}"

    # Determine venue_type from name heuristics
    venue_type = _infer_venue_type(venue_name, is_outdoor)

    place_data: dict = {
        "name": venue_name,
        "slug": slug,
        "address": venue_address or "",
        "city": venue_city or "Atlanta",
        "state": venue_state or "GA",
        "zip": venue_zip or "",
        "place_type": venue_type,
        "website": None,
        "neighborhood": None,  # Will be resolved by geo enrichment
        "vibes": ["educational", "family-friendly"],
    }

    venue_id = get_or_create_place(place_data)
    _venue_cache[cache_key] = venue_id
    return venue_id


def _infer_venue_type(venue_name: str, is_outdoor: bool) -> str:
    """Infer venue_type from name keywords."""
    lower = venue_name.lower()
    if is_outdoor or any(
        w in lower for w in ["park", "trail", "garden", "greenway", "beltline"]
    ):
        return "park"
    if any(
        w in lower
        for w in [
            "university",
            "college",
            "tech",
            "emory",
            "gsu",
            "gtech",
            "kennesaw",
            "spelman",
            "morehouse",
            "clark",
        ]
    ):
        return "university"
    if "library" in lower:
        return "library"
    if any(w in lower for w in ["museum", "aquarium", "zoo"]):
        return "museum"
    if any(w in lower for w in ["theater", "theatre", "stage"]):
        return "theater"
    if any(w in lower for w in ["brewery", "brewing"]):
        return "brewery"
    if any(w in lower for w in ["school", "academy", "middle", "high school"]):
        return "institution"
    if any(w in lower for w in ["church", "cathedral", "chapel"]):
        return "church"
    if any(w in lower for w in ["community center", "rec center", "recreation"]):
        return "community_center"
    if any(w in lower for w in ["gallery"]):
        return "gallery"
    return "venue"


# ---------------------------------------------------------------------------
# Tag / category inference
# ---------------------------------------------------------------------------


def _build_tags_and_category(
    audiences: list[str],
    topics: list[str],
    title: str,
    description: str,
    is_free: bool,
    is_outdoor: bool,
) -> tuple[str, list[str]]:
    """
    Derive (category, tags) for an ASF event.

    All ASF events are educational/family STEM events, so the default category
    is "family" (since the festival explicitly targets family attendance).
    Events with adult-only audience get "learning" instead.
    """
    tags: list[str] = ["stem", "educational", "hands-on", "science-festival"]
    audiences_lower = [a.lower() for a in audiences]

    # Audience-derived tags and age range hints
    has_kids = any(
        a in audiences_lower
        for a in [
            "families",
            "preschool",
            "elem. school",
            "middle school",
            "high school",
        ]
    )
    adults_only = audiences_lower == ["adults"] or (
        audiences_lower and all(a == "adults" for a in audiences_lower)
    )

    if has_kids:
        if "family-friendly" not in tags:
            tags.append("family-friendly")
        if "kids" not in tags:
            tags.append("kids")
    if "preschool" in audiences_lower:
        tags.append("preschool")
    if "elem. school" in audiences_lower:
        tags.append("elementary")
    if "middle school" in audiences_lower:
        tags.append("tween")
    if "high school" in audiences_lower:
        tags.append("teen")
    if "adults" in audiences_lower:
        tags.append("adults")

    if is_free:
        tags.append("free")
    if is_outdoor:
        tags.append("outdoor")

    # Topic-derived tags
    for topic in topics:
        extra = _TOPIC_TAG_MAP.get(topic, [])
        for t in extra:
            if t not in tags:
                tags.append(t)

    # Keyword scan for "sold out" / "rsvp"
    combined = f"{title} {description}".lower()
    if re.search(r"\bsold\s*out\b", combined):
        tags.append("sold-out")
    if re.search(
        r"\b(register|rsvp|registration required|advance registration)\b", combined
    ):
        tags.append("rsvp-required")

    # Category: most ASF events skew family but adult panels/talks → learning
    if adults_only:
        category = "learning"
    else:
        category = "family"

    # Override: talks, panels, lectures → learning even if family-targeted
    if re.search(r"\b(lecture|talk|panel|symposium|presentation|seminar)\b", combined):
        category = "learning"
    # Override: performances → community
    if re.search(r"\b(performance|concert|show|play|musical)\b", combined):
        category = "community"

    # Deduplicate tags preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            deduped.append(t)

    return category, deduped


# ---------------------------------------------------------------------------
# Age range extraction
# ---------------------------------------------------------------------------

_AGE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"ages?\s+(\d+)\s*[-–to]+\s*(\d+)", re.IGNORECASE), "range"),
    (re.compile(r"ages?\s+(\d+)\s*(?:\+|and\s+(?:up|older))", re.IGNORECASE), "min"),
    (re.compile(r"(\d+)\s+and\s+up", re.IGNORECASE), "min"),
    (re.compile(r"ages?\s+(\d+)(?!\s*[-–\d])", re.IGNORECASE), "single"),
    (
        re.compile(
            r"(?:for\s+)?(?:children|kids?)\s*\(?(\d+)\s*[-–]\s*(\d+)\)?", re.IGNORECASE
        ),
        "range",
    ),
    (re.compile(r"\(\s*ages?\s+(\d+)\s*[-–]\s*(\d+)\s*\)", re.IGNORECASE), "range"),
]


def _parse_age_range(
    text: str, audiences: list[str]
) -> tuple[Optional[int], Optional[int]]:
    """Extract age_min/age_max from event text + audience labels."""
    # Try pattern-based extraction first
    if text:
        for pattern, kind in _AGE_PATTERNS:
            m = pattern.search(text)
            if m:
                if kind == "range":
                    return int(m.group(1)), int(m.group(2))
                elif kind == "min":
                    return int(m.group(1)), None
                elif kind == "single":
                    a = int(m.group(1))
                    return a, a

    # Fall back to audience label inference
    audiences_lower = [a.lower() for a in audiences]
    if not audiences_lower:
        return None, None

    # Determine bounds from the audience set
    min_age: Optional[int] = None
    max_age: Optional[int] = None

    for aud in audiences_lower:
        bounds = _AUDIENCE_MAP.get(aud)
        if not bounds:
            continue
        aud_min, aud_max, _ = bounds
        if aud_min is not None:
            min_age = aud_min if min_age is None else min(min_age, aud_min)
        if aud_max is not None:
            max_age = aud_max if max_age is None else max(max_age, aud_max)

    # Adults-only: 18+
    if audiences_lower == ["adults"]:
        return 18, None

    return min_age, max_age


# ---------------------------------------------------------------------------
# Duplicate / cancelled detection
# ---------------------------------------------------------------------------

_CANCEL_RE = re.compile(r"\b(cancelled|canceled|postponed)\b", re.IGNORECASE)


def _is_cancelled(title: str, description: str) -> bool:
    return bool(_CANCEL_RE.search(title) or _CANCEL_RE.search(description))


# ---------------------------------------------------------------------------
# Detail page fetch worker
# ---------------------------------------------------------------------------


def _fetch_detail(args: tuple[requests.Session, str]) -> tuple[str, dict]:
    """Worker: fetch and parse one detail page. Returns (source_url, detail_dict)."""
    session, url = args
    html_text = _get(session, url)
    if not html_text:
        return url, {}
    return url, _parse_detail(html_text)


# ---------------------------------------------------------------------------
# Main crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Atlanta Science Festival event listing and persist to DB.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Ensure the fallback org venue exists upfront
    try:
        fallback_venue_id = get_or_create_place(_FESTIVAL_ORG_VENUE)
    except Exception as exc:
        logger.error("[asf] Could not create fallback venue: %s", exc)
        fallback_venue_id = None

    # ---- Step 1: Fetch and parse the listing page -------------------------
    http_session = requests.Session()
    listing_html = _get(http_session, _LISTING_URL)
    if not listing_html:
        logger.error("[asf] Failed to fetch listing page %s", _LISTING_URL)
        return 0, 0, 0

    raw_events = _parse_listing(listing_html)
    if not raw_events:
        logger.warning("[asf] No events found on listing page")
        return 0, 0, 0

    logger.info("[asf] Found %d events on listing page", len(raw_events))

    # ---- Step 2: Fetch detail pages concurrently --------------------------
    detail_map: dict[str, dict] = {}
    fetch_args = [(http_session, ev["source_url"]) for ev in raw_events]

    # Process in batches to be polite
    batch_size = _DETAIL_WORKERS * 3
    for batch_start in range(0, len(fetch_args), batch_size):
        batch = fetch_args[batch_start : batch_start + batch_size]
        with ThreadPoolExecutor(max_workers=_DETAIL_WORKERS) as pool:
            futures = {pool.submit(_fetch_detail, arg): arg[1] for arg in batch}
            for future in as_completed(futures):
                url = futures[future]
                try:
                    src_url, detail = future.result()
                    detail_map[src_url] = detail
                except Exception as exc:
                    logger.warning("[asf] Detail fetch error for %s: %s", url, exc)
                    detail_map[url] = {}
        if batch_start + batch_size < len(fetch_args):
            time.sleep(_BATCH_DELAY)

    logger.info("[asf] Detail pages fetched: %d", len(detail_map))

    # ---- Step 3: Build and persist event records --------------------------
    for raw in raw_events:
        source_url = raw["source_url"]
        title = raw["title"]
        detail = detail_map.get(source_url, {})

        # Description: prefer the listing snippet (it's the complete intro
        # paragraph); the detail page body is much longer raw HTML.
        description = raw["description_snippet"]
        if not description:
            description = ""

        # Skip cancelled events
        if _is_cancelled(title, description):
            logger.debug("[asf] Skipping cancelled event: %s", title)
            continue

        # Date/time: prefer detail page (cleaner format)
        start_date = detail.get("start_date") or raw["start_date"]
        start_time = detail.get("start_time") or raw["start_time"]
        end_time = detail.get("end_time") or raw["end_time"]

        if not start_date:
            logger.debug("[asf] No start_date for %r — skipping", title)
            continue

        # Skip past events (belt-and-suspenders — listing parser already does this)
        try:
            if datetime.strptime(start_date, "%Y-%m-%d").date() < date.today():
                continue
        except ValueError:
            continue

        # Venue
        venue_name = detail.get("venue_name", "")
        venue_address = detail.get("venue_address", "")
        venue_city = detail.get("venue_city", "Atlanta")
        venue_state = detail.get("venue_state", "GA")
        venue_zip = detail.get("venue_zip", "")
        type_label = detail.get("venue_type_label", "").lower()
        is_outdoor = "outdoor" in type_label

        if venue_name and venue_address:
            try:
                venue_id = _get_or_create_event_venue(
                    venue_name,
                    venue_address,
                    venue_city,
                    venue_state,
                    venue_zip,
                    is_outdoor,
                )
            except Exception as exc:
                logger.warning(
                    "[asf] Venue creation failed for %r (%s): %s — using fallback",
                    venue_name,
                    source_url,
                    exc,
                )
                venue_id = fallback_venue_id
        elif venue_name:
            # Venue name but no address — still create with partial data
            try:
                venue_id = _get_or_create_event_venue(
                    venue_name, "", venue_city, venue_state, venue_zip, is_outdoor
                )
            except Exception as exc:
                logger.warning(
                    "[asf] Partial venue creation failed for %r: %s", venue_name, exc
                )
                venue_id = fallback_venue_id
        else:
            venue_id = fallback_venue_id

        if venue_id is None:
            logger.warning("[asf] No venue_id for %r — skipping", title)
            continue

        # Price
        price_text = detail.get("price_text", "")
        price_min, price_max, is_free = _parse_price(price_text)

        # If description says "free" and no price yet
        if is_free is False and _FREE_RE.search(description):
            price_min, price_max, is_free = 0.0, 0.0, True

        # Ticket URL
        ticket_url = detail.get("ticket_url") or source_url

        # Topics
        topics = detail.get("topics", [])

        # Image
        image_url = raw.get("image_url")

        # Audiences
        audiences = raw.get("audiences", [])

        # Age range
        combined_text = f"{title} {description}"
        age_min, age_max = _parse_age_range(combined_text, audiences)

        # Tags and category
        category, tags = _build_tags_and_category(
            audiences, topics, title, description, is_free, is_outdoor
        )

        # Series hint: events sharing the same title on different dates
        # (the Escape Room Trail runs each day of the festival)
        series_hint: Optional[dict] = None
        is_recurring = False

        # Content hash
        # Include venue_name in hash to distinguish same-title events at different venues
        hash_venue = venue_name or _FESTIVAL_ORG_VENUE["name"]
        hash_key = start_date
        if start_time:
            hash_key = f"{start_date}|{start_time}"
        content_hash = generate_content_hash(title, hash_venue, hash_key)

        record: dict = {
            "source_id": source_id,
            "place_id": venue_id,
            "title": title,
            "description": description if description else None,
            "start_date": start_date,
            "end_date": None,
            "start_time": start_time,
            "end_time": end_time,
            "is_all_day": False,
            "category": category,
            "tags": tags,
            "is_free": is_free,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": None,
            "source_url": source_url,
            "ticket_url": ticket_url,
            "image_url": image_url,
            "raw_text": f"{title} | science festival | {', '.join(topics)}",
            "extraction_confidence": 0.88,
            "is_recurring": is_recurring,
            "content_hash": content_hash,
        }

        if age_min is not None:
            record["age_min"] = age_min
        if age_max is not None:
            record["age_max"] = age_max

        events_found += 1

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, record)
            events_updated += 1
        else:
            try:
                insert_event(record, series_hint=series_hint)
                events_new += 1
                logger.debug(
                    "[asf] Added: %s on %s @ %s", title, start_date, hash_venue
                )
            except Exception as exc:
                logger.error("[asf] Failed to insert %r: %s", title, exc)

    logger.info(
        "[asf] Crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
