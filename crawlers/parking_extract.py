"""
Parking info extraction from venue websites.

Scrapes parking/directions pages for actionable parking details:
- Parking notes (lot locations, prices, tips)
- Parking types (lot, deck, garage, valet, street)
- Free/paid classification
- Transit info (MARTA, BeltLine, bike parking)

Two-step approach:
1. Check homepage for parking keywords
2. Follow links to /directions, /parking, /getting-here, /visit subpages
   (these almost always have richer info)

Used by:
- db.py get_or_create_venue() — auto-extract for new venues
- enrich_parking.py — backfill existing venues
"""

from __future__ import annotations

import re
import logging
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"}
TIMEOUT = 8

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Text blocks containing these are parking-relevant
PARKING_RE = re.compile(
    r"\b("
    r"parking|garage|valet|self[- ]park|free\s+lot|"
    r"street\s+parking|parking\s+deck|parking\s+garage|"
    r"parking\s+lot|parking\s+available|complimentary\s+parking|"
    r"validated?\s*parking|paid\s+parking|metered|flat\s+rate|"
    r"park\s+in\s+the|park\s+at\s+the|where\s+to\s+park|"
    r"parking\s+info|parking\s+map|parking\s+option|"
    r"parking\s+rate|parking\s+fee|parking\s+is"
    r")\b",
    re.IGNORECASE,
)

# Links that likely lead to parking/directions subpages
SUBPAGE_RE = re.compile(
    r"(parking|directions|getting[- ]here|getting[- ]there|"
    r"plan[- ]your[- ]visit|visit[- ]us|how[- ]to[- ]get)",
    re.IGNORECASE,
)

# Transit keywords worth capturing separately
TRANSIT_RE = re.compile(
    r"\b(beltline|marta|bike\s+parking|transit|bus\s+\d+)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _fetch_soup(url: str) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed soup, or None on failure."""
    try:
        resp = requests.get(
            url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True
        )
        if resp.status_code != 200:
            return None
        return BeautifulSoup(resp.text, "html.parser")
    except Exception:
        return None


def _find_parking_subpage(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Find the best link to a parking/directions subpage."""
    best_link = None
    best_score = 0
    base_domain = base_url.split("/")[2]

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        combined = f"{href.lower()} {text}"

        if not SUBPAGE_RE.search(combined):
            continue

        full_url = urljoin(base_url, href)
        # Only follow same-domain links
        if not full_url.startswith("http") or base_domain not in full_url:
            continue
        # Skip if it resolves back to homepage
        if full_url.rstrip("/") == base_url.rstrip("/"):
            continue

        score = 0
        if "parking" in combined:
            score += 10
        if "direction" in combined:
            score += 5
        if "getting" in combined:
            score += 5
        if "visit" in combined:
            score += 3

        if score > best_score:
            best_score = score
            best_link = full_url

    return best_link


def _extract_parking_texts(soup: BeautifulSoup) -> list[str]:
    """Extract parking-relevant text blocks from a parsed page."""
    # Remove noise elements
    for tag in soup(["script", "style", "nav", "iframe", "noscript"]):
        tag.decompose()

    texts: list[str] = []
    seen: set[str] = set()

    for tag in soup.find_all(
        ["p", "li", "div", "span", "td", "h2", "h3", "h4", "section", "article"]
    ):
        text = tag.get_text(separator=" ", strip=True)

        if len(text) < 25 or len(text) > 1200:
            continue
        if not PARKING_RE.search(text):
            continue

        # Deduplicate: keep the longer of overlapping texts
        is_dup = False
        for existing in list(seen):
            if text in existing or existing in text:
                if len(text) > len(existing):
                    seen.discard(existing)
                    texts = [t for t in texts if t != existing]
                else:
                    is_dup = True
                break

        if not is_dup:
            seen.add(text)
            texts.append(text)

    return texts


def _score_text(text: str) -> int:
    """Score a parking text block by how actionable/useful it is."""
    score = 0
    lower = text.lower()

    # Pricing is high value
    if re.search(r"\$\d+", text):
        score += 10
    if "free" in lower and "parking" in lower:
        score += 8
    if "complimentary" in lower and "parking" in lower:
        score += 8

    # Specific facility references
    if re.search(r"\b(deck|lot|garage|structure|facility)\b", lower):
        score += 5

    # Spatial/directional info
    if re.search(r"(behind|across|adjacent|next to|block from|walk|located)", lower):
        score += 5

    # Operational details
    if re.search(r"(card only|cash|open|close|hour|rate)", lower):
        score += 3
    if "valet" in lower:
        score += 3

    # Transit bonus
    if TRANSIT_RE.search(text):
        score += 4

    # Penalize short/nav-like text
    word_count = len(text.split())
    if word_count < 6:
        score -= 8
    if word_count < 10:
        score -= 3
    if text.count("|") > 2 or text.count(" \u00b7 ") > 2:
        score -= 5

    return score


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_parking_info(url: str) -> Optional[dict]:
    """
    Extract parking information from a venue website.

    Makes 1-2 HTTP requests (homepage + optional subpage).

    Returns dict with:
        parking_note:       str  — best parking text
        parking_source_url: str  — URL where info was found
        parking_free:       bool | None — True/False/unknown
        parking_type:       list[str] — lot, deck, garage, valet, street
        transit_note:       str | None — BeltLine/MARTA/bike info
    Returns None if no useful parking info found.
    """
    soup = _fetch_soup(url)
    if not soup:
        return None

    # Always check for a subpage
    subpage = _find_parking_subpage(soup, url)

    # Collect texts from both pages, prefer subpage results
    homepage_texts = _extract_parking_texts(soup)
    subpage_texts: list[str] = []
    source_url = url

    if subpage:
        sub_soup = _fetch_soup(subpage)
        if sub_soup:
            subpage_texts = _extract_parking_texts(sub_soup)

    # Prefer subpage if it has results
    if subpage_texts:
        texts = subpage_texts
        source_url = subpage
    elif homepage_texts:
        texts = homepage_texts
    else:
        return None

    # Score and pick best text
    scored = [(t, _score_text(t)) for t in texts]
    scored.sort(key=lambda x: x[1], reverse=True)

    if scored[0][1] < 3:
        return None

    best_text = scored[0][0]
    all_text = " ".join(texts).lower()

    # Infer free/paid
    parking_free: Optional[bool] = None
    if re.search(
        r"free\s+parking|complimentary\s+parking|no\s+charge|free\s+lot", all_text
    ):
        parking_free = True
    elif re.search(r"\$\d+|paid\s+parking|\bfee\b", all_text):
        parking_free = False

    # Infer parking types
    parking_types: list[str] = []
    if re.search(r"\b(surface\s+lot|parking\s+lot|\blot\b)", all_text):
        parking_types.append("lot")
    if re.search(r"\b(deck|multi.storey|structure|parking\s+facility)\b", all_text):
        parking_types.append("deck")
    if re.search(r"\bgarage\b", all_text):
        parking_types.append("garage")
    if "valet" in all_text:
        parking_types.append("valet")
    if "street" in all_text and "parking" in all_text:
        parking_types.append("street")
    if not parking_types:
        parking_types.append("available")

    # Extract transit note if present
    transit_note: Optional[str] = None
    for t in texts:
        if TRANSIT_RE.search(t) and len(t) > 30:
            transit_note = t[:500]
            break

    # Trim best text to reasonable length
    if len(best_text) > 500:
        cut = best_text[:500].rfind(".")
        if cut > 200:
            best_text = best_text[: cut + 1]
        else:
            best_text = best_text[:500] + "..."

    return {
        "parking_note": best_text,
        "parking_source_url": source_url,
        "parking_free": parking_free,
        "parking_type": parking_types,
        "transit_note": transit_note,
    }
