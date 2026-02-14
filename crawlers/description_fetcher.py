"""
Shared utility for extracting event descriptions from web pages.

Three tiers:
1. extract_description_from_html(html) - Core HTML parsing logic
2. fetch_description_from_url(url, session) - requests + BeautifulSoup wrapper
3. fetch_description_playwright(page, url) - For crawlers with Playwright already open

Also: generate_synthetic_description() for fallback when no real description found.
"""

import re
import json
import logging
from typing import Optional

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_LENGTH = 2000


def extract_description_from_html(html: str) -> Optional[str]:
    """Extract a description from raw HTML using multiple strategies.

    Tries in order:
    1. og:description meta tag
    2. meta description tag
    3. JSON-LD description field
    4. Common CSS selectors for event content
    5. First significant <p> tag

    Returns cleaned text truncated to 2000 chars, or None.
    """
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Strategy 1: og:description meta tag
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        text = _clean_text(og_desc["content"])
        if _is_useful_description(text):
            return text[:MAX_DESCRIPTION_LENGTH]

    # Strategy 2: meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        text = _clean_text(meta_desc["content"])
        if _is_useful_description(text):
            return text[:MAX_DESCRIPTION_LENGTH]

    # Strategy 3: JSON-LD description
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            # Handle both single objects and arrays
            items = data if isinstance(data, list) else [data]
            for item in items:
                desc = item.get("description")
                if desc:
                    text = _clean_text(desc)
                    if _is_useful_description(text):
                        return text[:MAX_DESCRIPTION_LENGTH]
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue

    # Strategy 4: Common CSS selectors for event description content
    # Includes selectors for theater CMS platforms (Spektrix, PatronManager,
    # Tessitura, On The Stage) and comedy venue sites
    selectors = [
        # General event selectors
        ".event-description",
        ".event-details",
        ".event-content",
        ".event-info",
        "[class*='description']",
        "[class*='event-detail']",
        # Theater / performing arts CMS
        ".show-description",
        ".production-description",
        ".performance-details",
        ".show-info",
        ".show-content",
        ".production-info",
        ".production-content",
        ".synopsis",
        "[class*='synopsis']",
        "[class*='show-detail']",
        "[class*='production-detail']",
        # Spektrix
        ".SpktxContent",
        ".event-description-text",
        # PatronManager
        ".pm-event-description",
        ".pm-production-description",
        # On The Stage / ShowTix4U
        ".show-about",
        ".event-about",
        # Comedy venue sites
        ".comedian-bio",
        ".artist-bio",
        ".performer-info",
        ".act-description",
        # General CMS
        "article .content",
        ".entry-content",
        ".post-content",
        ".body-text",
        ".page-content",
    ]
    for selector in selectors:
        elems = soup.select(selector)
        for elem in elems:
            text = _clean_text(elem.get_text())
            if _is_useful_description(text):
                return text[:MAX_DESCRIPTION_LENGTH]

    # Strategy 5: Combine multiple <p> tags from main content for richer descriptions
    main = soup.find("main") or soup.find("article") or soup.find("body")
    if main:
        paragraphs = []
        for p in main.find_all("p"):
            text = _clean_text(p.get_text())
            if _is_useful_description(text):
                paragraphs.append(text)
                combined = " ".join(paragraphs)
                if len(combined) >= MAX_DESCRIPTION_LENGTH:
                    return combined[:MAX_DESCRIPTION_LENGTH]
        if paragraphs:
            return " ".join(paragraphs)[:MAX_DESCRIPTION_LENGTH]

    return None


def fetch_description_from_url(url: str, session=None) -> Optional[str]:
    """Fetch a URL and extract description from its HTML.

    Args:
        url: The URL to fetch
        session: Optional httpx.Client or requests.Session for connection reuse

    Returns:
        Extracted description text or None
    """
    if not url:
        return None

    try:
        if session is not None:
            response = session.get(url, timeout=15)
            html = response.text
        else:
            import httpx
            with httpx.Client(
                timeout=15.0,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
                follow_redirects=True,
            ) as client:
                response = client.get(url)
                html = response.text

        return extract_description_from_html(html)

    except Exception as e:
        logger.debug(f"Failed to fetch description from {url}: {e}")
        return None


def fetch_description_playwright(page, url: str) -> Optional[str]:
    """Fetch a URL using an already-open Playwright page and extract description.

    Args:
        page: Playwright Page object (already open in a browser context)
        url: The URL to navigate to

    Returns:
        Extracted description text or None
    """
    if not url:
        return None

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)
        html = page.content()
        return extract_description_from_html(html)

    except Exception as e:
        logger.debug(f"Failed to fetch description via Playwright from {url}: {e}")
        return None


def fetch_detail_html_playwright(page, url: str) -> Optional[str]:
    """Fetch a URL using an already-open Playwright page and return HTML."""
    if not url:
        return None

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)
        return page.content()
    except Exception as e:
        logger.debug(f"Failed to fetch HTML via Playwright from {url}: {e}")
        return None


def _generate_music_description(
    venue_name: Optional[str],
    artists: Optional[list[dict]],
) -> str:
    """Build a lineup-based description for music events."""
    if not artists:
        if venue_name:
            return f"Live music at {venue_name}."
        return "Live music performance."

    headliner = artists[0]
    support = artists[1:]
    name = headliner.get("name", "")
    genres = headliner.get("genres")

    base = f"Live music at {venue_name}" if venue_name else "Live music"
    if genres:
        desc = f"{base} featuring {name} ({', '.join(genres[:3])})."
    else:
        desc = f"{base} featuring {name}."

    if support:
        names = [s.get("name") for s in support if s.get("name")]
        if names:
            desc += f" With {', '.join(names)}."

    return desc


def generate_synthetic_description(
    title: str,
    venue_name: Optional[str] = None,
    category: Optional[str] = None,
    artists: Optional[list[dict]] = None,
) -> str:
    """Generate a basic synthetic description when no real one is available.

    Uses title, venue name, and category to produce a one-line description.
    For music events, pass `artists` (list of dicts with name/genres) for
    lineup-based descriptions instead of generic "Live music at X."
    """
    title = (title or "").strip()
    venue = (venue_name or "").strip()
    cat = (category or "").strip().lower()

    # Category-specific templates
    if cat == "music":
        return _generate_music_description(venue or None, artists)

    if cat == "comedy":
        if venue:
            return f"Comedy show at {venue}."
        return "Comedy show."

    if cat == "theater" or cat == "theatre":
        if venue:
            return f"Theater performance at {venue}."
        return "Theater performance."

    if cat == "film":
        if venue:
            return f"Film screening at {venue}."
        return "Film screening."

    if cat == "sports":
        if venue:
            return f"Sporting event at {venue}."
        return "Sporting event."

    if cat == "arts":
        # Check for class/workshop keywords in title
        title_lower = title.lower()
        if any(kw in title_lower for kw in ["paint", "sip", "canvas"]):
            if venue:
                return f"Paint and sip class at {venue}. BYOB welcome."
            return "Paint and sip class. BYOB welcome."
        if any(kw in title_lower for kw in ["workshop", "class", "lesson"]):
            if venue:
                return f"Creative workshop at {venue}."
            return "Creative workshop."
        if venue:
            return f"Arts event at {venue}."
        return "Arts event."

    if cat == "food":
        if venue:
            return f"Food & drink event at {venue}."
        return "Food & drink event."

    if cat == "fitness":
        if venue:
            return f"Fitness class at {venue}."
        return "Fitness class."

    # Generic fallback
    if venue:
        return f"Event at {venue}."
    return f"{title}." if title else "Event."


def _clean_text(text: str) -> str:
    """Clean extracted text: collapse whitespace, strip HTML artifacts."""
    if not text:
        return ""
    # Remove HTML tags that might have leaked
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_useful_description(text: str) -> bool:
    """Check if extracted text is a useful description (not nav/boilerplate)."""
    if not text or len(text) < 20:
        return False

    lower = text.lower()

    # Reject common boilerplate
    boilerplate = [
        "skip to content",
        "cookie policy",
        "privacy policy",
        "terms of service",
        "sign up for our newsletter",
        "follow us on",
        "all rights reserved",
        "powered by",
        "javascript is required",
        "please enable javascript",
        "loading...",
        "page not found",
        "404",
    ]
    for bp in boilerplate:
        if lower.startswith(bp):
            return False

    return True
