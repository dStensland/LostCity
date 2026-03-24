"""
Crawler for Burnaway's monthly Call for Artists roundups.

Burnaway (burnaway.org) is an Atlanta-based art publication covering the
American South. Each month they publish a "Call for Artists" post listing
residencies, grants, exhibition submissions, fellowships, and commissions —
primarily for Southern artists but including national and online opportunities.

The index page at /daily/call-for-artists/ links to individual monthly posts.
Each monthly post contains entries separated by <hr> elements. Each entry
has a title (with an apply link), location, deadline, and description.

We scrape the two most recent monthly posts so we capture both current-month
calls and any still-active calls from the previous month.
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, NavigableString

from db import insert_open_call, get_portal_id_by_slug

logger = logging.getLogger(__name__)

INDEX_URL = "https://burnaway.org/daily/call-for-artists/"
SOURCE_NAME = "Burnaway Open Calls"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

# How many recent monthly posts to scrape. Two covers current month + prior
# month so recently-posted calls from last month aren't dropped.
POSTS_TO_SCRAPE = 2

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

_MONTHS = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}

# "March 9, 2026" or "March 9" or "9 March 2026"
_DATE_RE = re.compile(
    r"(?:(?P<month_name>[A-Za-z]+)\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(?P<year>\d{4}))?)"
    r"|(?:(?P<day2>\d{1,2})(?:st|nd|rd|th)?\s+(?P<month_name2>[A-Za-z]+)(?:,?\s*(?P<year2>\d{4}))?)",
    re.IGNORECASE,
)

_DEADLINE_RE = re.compile(r"Deadline:\s*(.+)", re.IGNORECASE)
_FEE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)\s+(?:application|entry|submission)\s+fee", re.IGNORECASE)


def _parse_deadline(raw: str) -> Optional[str]:
    """Parse a deadline string to YYYY-MM-DD. Returns None if unparseable."""
    m = _DATE_RE.search(raw)
    if not m:
        return None

    month_name = m.group("month_name") or m.group("month_name2")
    day_str = m.group("day") or m.group("day2")
    year_str = m.group("year") or m.group("year2")

    if not month_name or not day_str:
        return None

    month = _MONTHS.get(month_name.lower())
    if not month:
        return None

    day = int(day_str)
    year = int(year_str) if year_str else date.today().year

    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

# Checked against the title first (high specificity), then against full text.
_TITLE_TYPE_KEYWORDS: list[tuple[str, str]] = [
    ("residenc", "residency"),   # matches "residency", "residencies"
    ("resident", "residency"),
    ("fellowship", "grant"),
    ("fellow", "grant"),
    ("grant", "grant"),
    ("prize", "grant"),
    ("commission", "commission"),
    ("mural", "commission"),
    ("public art", "commission"),
    ("call for entries", "submission"),
    ("call for submissions", "submission"),
    ("call for works", "submission"),
    ("call for artist", "submission"),
    ("open call", "submission"),
    ("exhibition", "exhibition_proposal"),
    ("exhibit", "exhibition_proposal"),
    ("proposal", "exhibition_proposal"),
]

# Checked against full text (title + description) when title match fails.
_FULL_TEXT_TYPE_KEYWORDS: list[tuple[str, str]] = [
    ("residenc", "residency"),   # matches "residency", "residencies"
    ("resident", "residency"),
    ("fellowship", "grant"),
    ("fellow", "grant"),
    ("grant", "grant"),
    ("prize", "grant"),
    ("commission", "commission"),
    ("mural", "commission"),
    ("public art", "commission"),
    ("juried exhibition", "exhibition_proposal"),
    ("juried show", "exhibition_proposal"),
    ("open exhibition", "exhibition_proposal"),
    ("group exhibition", "exhibition_proposal"),
    ("exhibition", "exhibition_proposal"),
    ("exhibit", "exhibition_proposal"),
    ("gallery", "exhibition_proposal"),
    ("proposal", "exhibition_proposal"),
    ("award", "grant"),
    ("submit", "submission"),
]


def _infer_call_type(title: str, description: str) -> str:
    """Infer call_type from title + description text."""
    title_lower = title.lower()
    for keyword, call_type in _TITLE_TYPE_KEYWORDS:
        if keyword in title_lower:
            return call_type

    full_text = f"{title} {description}".lower()
    for keyword, call_type in _FULL_TEXT_TYPE_KEYWORDS:
        if keyword in full_text:
            return call_type

    return "submission"


# ---------------------------------------------------------------------------
# HTML fetching
# ---------------------------------------------------------------------------

def _fetch_soup(url: str) -> BeautifulSoup:
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


# ---------------------------------------------------------------------------
# Index page parsing — find monthly post URLs
# ---------------------------------------------------------------------------

def _get_monthly_post_urls(n: int = POSTS_TO_SCRAPE) -> list[str]:
    """Fetch the index page and return up to n most recent monthly post URLs."""
    soup = _fetch_soup(INDEX_URL)

    urls: list[str] = []
    seen: set[str] = set()

    for a in soup.select("h2.entry-title a, h3.entry-title a"):
        href = a.get("href", "").strip()
        if not href or href in seen:
            continue
        # Monthly posts look like /daily/call(s)-for-artists-month-year/
        if re.search(r"/daily/calls?-for-artists-\w+-\d{4}/", href):
            seen.add(href)
            urls.append(href)
            if len(urls) >= n:
                break

    logger.debug("%s: found %s monthly post URLs", SOURCE_NAME, len(urls))
    return urls


# ---------------------------------------------------------------------------
# Monthly post parsing — extract individual call entries
# ---------------------------------------------------------------------------

def _split_into_sections(content_div) -> list[list]:
    """Split entry-content into per-call sections delimited by <hr> tags."""
    sections: list[list] = []
    current: list = []
    for child in content_div.children:
        tag_name = getattr(child, "name", None)
        if tag_name == "hr":
            if current:
                sections.append(current)
            current = []
        elif not isinstance(child, NavigableString) or child.strip():
            current.append(child)
    if current:
        sections.append(current)
    return sections


def _extract_calls_from_post(post_url: str) -> list[dict]:
    """Scrape a monthly post and return a list of raw call dicts."""
    soup = _fetch_soup(post_url)

    article = soup.find("article")
    if not article:
        logger.warning("%s: no article element in %s", SOURCE_NAME, post_url)
        return []

    content = article.find("div", class_="entry-content")
    if not content:
        logger.warning("%s: no entry-content in %s", SOURCE_NAME, post_url)
        return []

    sections = _split_into_sections(content)
    calls: list[dict] = []

    for section_nodes in sections:
        call = _parse_section(section_nodes, source_url=post_url)
        if call:
            calls.append(call)

    logger.debug("%s: extracted %s calls from %s", SOURCE_NAME, len(calls), post_url)
    return calls


def _parse_section(nodes: list, source_url: str) -> Optional[dict]:
    """
    Parse a single HR-delimited section into a call dict.

    Each section's first non-figure <p> contains:
      Line 1: Title (often as a link)
      Line 2: Location
      Line 3: Deadline: <date>

    Subsequent <p> elements are the description.
    The .post-btn <a> holds the canonical apply URL.
    """
    header_p = None
    desc_parts: list[str] = []
    apply_url: Optional[str] = None
    fee_text: Optional[str] = None

    for node in nodes:
        if not hasattr(node, "name") or not node.name:
            continue

        if node.name == "figure":
            # Skip hero images at the top of the post
            continue

        if node.name == "p" and header_p is None:
            # First <p> is the header: title, location, deadline
            header_p = node
            continue

        if node.name == "p":
            text = node.get_text(" ", strip=True)
            if not text:
                continue
            # Detect fee paragraphs
            if re.search(r"application fee|entry fee|submission fee", text, re.IGNORECASE):
                fee_text = text
            else:
                desc_parts.append(text)
            continue

        if node.name == "div":
            # Find apply button
            btn = node.select_one(".post-btn a, .wp-block-button a")
            if btn:
                href = btn.get("href", "").strip()
                if href:
                    apply_url = href

    if not header_p:
        return None

    # Parse header paragraph lines (separated by <br> tags)
    lines = [line.strip() for line in header_p.get_text("\n").split("\n") if line.strip()]
    if not lines:
        return None

    title = lines[0]
    if not title:
        return None

    # Title link may hold the apply URL (used as fallback if no Apply button)
    title_link = header_p.find("a")
    title_apply_href = title_link.get("href", "").strip() if title_link else None

    # Use the title's own href as title if the text diverges (link text = title)
    if title_link:
        link_text = title_link.get_text(strip=True)
        if link_text:
            title = link_text

    # Canonical apply URL: prefer the explicit Apply button, fall back to title link
    final_apply_url = apply_url or title_apply_href
    if not final_apply_url:
        logger.debug("%s: skipping %r — no apply URL", SOURCE_NAME, title[:60])
        return None

    # Deadline
    deadline: Optional[str] = None
    for line in lines:
        m = _DEADLINE_RE.search(line)
        if m:
            deadline = _parse_deadline(m.group(1))
            break

    # Location (line 2 if it looks like a place, not a deadline)
    location: Optional[str] = None
    for line in lines[1:]:
        if _DEADLINE_RE.search(line):
            break
        location = line

    # Description: join desc_parts
    description = " ".join(desc_parts).strip() or None

    # Fee
    fee: Optional[float] = None
    if fee_text:
        m = _FEE_RE.search(fee_text)
        if m:
            try:
                fee = float(m.group(1).replace(",", ""))
            except ValueError:
                pass

    # Call type from title + description
    call_type = _infer_call_type(title, description or "")

    # Eligibility — look for location as a signal (online = broader)
    eligibility: Optional[str] = None
    if location:
        loc_lower = location.lower()
        if "online" in loc_lower or "nationwide" in loc_lower or "national" in loc_lower:
            eligibility = "Open to artists nationwide"
        elif "south" in loc_lower or "southeast" in loc_lower:
            eligibility = "Open to artists in the American South"

    # Org name for slug generation — extract from title heuristics
    org_name = _extract_org_name(title)

    return {
        "title": title,
        "application_url": final_apply_url,
        "source_url": source_url,
        "deadline": deadline,
        "call_type": call_type,
        "description": description,
        "eligibility": eligibility,
        "fee": fee,
        "_org_name": org_name,
        "confidence_tier": "verified",
        "tags": _build_tags(call_type, location),
        "metadata": {
            "location": location,
            "source": "burnaway",
        },
    }


def _extract_org_name(title: str) -> str:
    """
    Extract a short org name from the call title for slug generation.

    Examples:
      "Fall 2026 Residencies at the Peter Bullough Foundation" -> "peter-bullough-foundation"
      "Artlab Editorial Fellowship" -> "artlab"
      "South Arts Southern Prize and State Fellowships" -> "south-arts"
    """
    # "... at the X" pattern
    at_match = re.search(r"\bat\s+(?:the\s+)?(.+)$", title, re.IGNORECASE)
    if at_match:
        org = at_match.group(1).strip()
        # Trim after commas or extra conjunctions
        org = re.split(r",|\bwith\b|\band\b", org)[0].strip()
        return org

    # Strip leading call-type noise words
    cleaned = re.sub(
        r"^(?:call for(?:\s+artist)?\s+(?:entries|submissions|proposals|works)?:?\s*|"
        r"open call:?\s*|"
        r"(?:fall|spring|summer|winter)\s+\d{4}\s+)",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()

    # Use first few words as org slug base
    words = cleaned.split()[:4]
    return " ".join(words)


def _build_tags(call_type: str, location: Optional[str]) -> list[str]:
    tags = ["open-call", call_type]
    if location:
        loc_lower = location.lower()
        if "atlanta" in loc_lower or "georgia" in loc_lower:
            tags.append("atlanta")
            tags.append("georgia")
        elif "south" in loc_lower:
            tags.append("american-south")
        if "online" in loc_lower:
            tags.append("online")
    return tags


# ---------------------------------------------------------------------------
# Main crawl function
# ---------------------------------------------------------------------------

def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Burnaway's call-for-artists posts and insert open calls.

    Returns (found, new, updated).
    """
    source_id: int = source["id"]
    portal_id: Optional[str] = source.get("owner_portal_id")

    # Resolve portal_id from slug if not on source record
    if not portal_id:
        portal_id = get_portal_id_by_slug("arts-atlanta")

    monthly_urls = _get_monthly_post_urls(POSTS_TO_SCRAPE)
    if not monthly_urls:
        logger.warning("%s: no monthly post URLs found on index page", SOURCE_NAME)
        return 0, 0, 0

    today = date.today()
    found = new = updated = 0

    for post_url in monthly_urls:
        try:
            raw_calls = _extract_calls_from_post(post_url)
        except Exception as exc:
            logger.error("%s: failed to fetch %s — %s", SOURCE_NAME, post_url, exc)
            continue

        for call in raw_calls:
            # Skip calls whose deadline has already passed
            if call.get("deadline"):
                try:
                    deadline_dt = datetime.strptime(call["deadline"], "%Y-%m-%d").date()
                    if deadline_dt < today:
                        logger.debug(
                            "%s: skipping past deadline %r (%s)",
                            SOURCE_NAME,
                            call["title"][:50],
                            call["deadline"],
                        )
                        continue
                except ValueError:
                    pass

            call["source_id"] = source_id
            if portal_id:
                call["portal_id"] = portal_id

            result_id = insert_open_call(call)
            found += 1
            if result_id:
                new += 1
            else:
                updated += 1

    logger.info(
        "%s: crawl complete — %s found, %s new, %s updated",
        SOURCE_NAME,
        found,
        new,
        updated,
    )
    return found, new, updated
