"""
Crawler for Hyperallergic Monthly Opportunities roundup posts.

Source: https://hyperallergic.com/tag/opportunities/

Hyperallergic publishes a monthly roundup post listing 16–27 curated artist
opportunities: residencies, fellowships, grants, open calls, and commissions.
The roundup posts are marked as "featured" on the tag page and have titles
matching "Opportunities in [Month] [Year]" or "X Opportunities for Artists".

Crawl strategy — two phases:

  Phase 1 — Tag page (https://hyperallergic.com/tag/opportunities/):
    Find the most recent featured roundup post. The monthly roundup posts link
    to URLs like /opportunities-march-2026/ and are marked `featured` in the
    article element class list.

  Phase 2 — Roundup post page:
    Each listing is a <p> block with structure:
      <strong>Org – Title</strong><br/>
      Description text.<br/>
      Deadline: Month DD, YYYY | <a href="...">domain.tld</a>

    The <h2> sections divide listings by category (Residencies/Fellowships,
    Open Calls, Grants, etc.) — we map these to call_type.

    Some listings have no explicit deadline (rolling or not stated). Those are
    skipped because we have no way to know if they're still active.

    Some listings link to a Hyperallergic-hosted detail page (sponsored
    content); we follow through to extract the external application URL.

Deadline format: "Month DD, YYYY" or "Month D, YYYY" or "Month D, YYYY (Xpm TZ)".

Confidence tier: "aggregated" — Hyperallergic is curating other orgs' calls.
Eligibility: "National" — all Hyperallergic-listed opportunities are US/international.

HTML structure (verified 2026-03-24):
  Tag page:
    div.gh-feed
      article.gh-card[.featured]  — featured = monthly roundup
        a[href]                   — relative URL to the post
        h3                        — post title

  Roundup post body:
    section.gh-content (or div.gh-content)
      h2[id]                      — section heading, e.g. "Residencies, Workshops, & Fellowships"
      p                           — one <p> per listing (or empty separator)
        strong                    — "Org – Title" or just "Title"
        br + text                 — description
        br + "Deadline: DATE | "
        a[href]                   — application URL (may be a Hyperallergic bit.ly redirect)
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://hyperallergic.com"
TAG_URL = "https://hyperallergic.com/tag/opportunities/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# Delay between tag page and post page fetches
FETCH_DELAY_S = 1.5

# Monthly roundup posts: title matches one of these patterns
_ROUNDUP_TITLE_RE = re.compile(
    r"opportunities\s+in\s+\w+\s+\d{4}"  # "Opportunities in March 2026"
    r"|^\d+\s+opportunities\s+for\s+",    # "25 Opportunities for Artists"
    re.I,
)

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# H2 section heading → call_type
_SECTION_TYPE_MAP: dict[str, str] = {
    "residencies": "residency",
    "workshops": "residency",     # workshops are closest to residency
    "fellowships": "grant",
    "fellowship": "grant",
    "grants": "grant",
    "grant": "grant",
    "open calls": "submission",
    "open call": "submission",
    "calls for entry": "submission",
    "calls for submissions": "submission",
    "commissions": "commission",
    "commission": "commission",
    "prizes": "grant",
    "award": "grant",
    "awards": "grant",
}


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Hyperallergic: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Tag page: find most recent roundup post
# ---------------------------------------------------------------------------


def _find_roundup_post(html: str) -> Optional[str]:
    """
    Parse the /tag/opportunities/ page and return the URL of the most
    recent monthly roundup post.

    Strategy:
      1. Look for featured articles first (roundups are featured on the tag page).
      2. Within featured articles, pick the one whose title matches the roundup
         title pattern ("Opportunities in Month YYYY").
      3. Fall back to any article with a roundup-matching title if none are featured.

    Returns an absolute URL string, or None if not found.
    """
    soup = BeautifulSoup(html, "html.parser")
    feed = soup.find("div", class_="gh-feed")
    if not feed:
        logger.warning("Hyperallergic: gh-feed container not found on tag page")
        return None

    articles = feed.find_all("article", class_="gh-card")
    if not articles:
        logger.warning("Hyperallergic: no article cards found in gh-feed")
        return None

    # Collect candidates: (is_featured, href, title)
    candidates: list[tuple[bool, str, str]] = []
    for article in articles:
        classes = article.get("class", [])
        is_featured = "featured" in classes

        link = article.find("a", href=True)
        if not link:
            continue
        href = link["href"]
        if href.startswith("/"):
            href = BASE_URL + href

        title_el = article.find("h3")
        title = title_el.get_text(strip=True) if title_el else ""

        if _ROUNDUP_TITLE_RE.search(title):
            candidates.append((is_featured, href, title))

    if not candidates:
        # Fallback: check URL slugs for roundup pattern
        for article in articles:
            link = article.find("a", href=True)
            if not link:
                continue
            href = link["href"]
            if re.search(r"/opportunities-\w+-\d{4}/", href):
                classes = article.get("class", [])
                is_featured = "featured" in classes
                title_el = article.find("h3")
                title = title_el.get_text(strip=True) if title_el else href
                candidates.append((is_featured, BASE_URL + href if href.startswith("/") else href, title))

    if not candidates:
        logger.warning("Hyperallergic: no monthly roundup post found on tag page")
        return None

    # Prefer featured, then take first (most recent — feed is reverse-chron)
    candidates.sort(key=lambda x: not x[0])  # featured first
    url = candidates[0][1]
    title = candidates[0][2]
    logger.info("Hyperallergic: found roundup post: %r → %s", title, url)
    return url


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an ISO date from a deadline text fragment.

    Handles:
      "Deadline: May 20, 2026"                → "2026-05-20"
      "Deadline: March 9, 2026"               → "2026-03-09"
      "Deadlines: March 8, 2026 or Rolling"   → "2026-03-08"  (first date wins)
      "Deadline: April 28, 2026 (5pm ET)"     → "2026-04-28"
      Rolling / no date                        → None
    """
    if not text:
        return None

    lower = text.lower()

    # Skip rolling or no-deadline language
    if "rolling" in lower and not re.search(
        r"(january|february|march|april|may|june|july|august|september"
        r"|october|november|december)\s+\d{1,2},?\s+\d{4}",
        text,
        re.I,
    ):
        return None

    # "Month D(D), YYYY" — standard Hyperallergic format
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

    # MM/DD/YYYY
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", text)
    if m:
        month, day, year = m.groups()
        return f"{int(year)}-{int(month):02d}-{int(day):02d}"

    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

_RESIDENCY_RE = re.compile(
    r"\bresiden(?:cy|ce|t)\b|\bretreat\b|\bcolony\b|\bin[\s-]residence\b",
    re.I,
)
_GRANT_RE = re.compile(
    r"\bgrant\b|\bfellowship\b|\baward\b|\bprize\b",
    re.I,
)
_SUBMISSION_RE = re.compile(
    r"\bopen\s+call\b|\bcall\s+for\b|\bsubmission\b|\bentry\b|\bcompetition\b",
    re.I,
)
_COMMISSION_RE = re.compile(r"\bcommission\b", re.I)


def _infer_call_type(title: str, description: str, section_type: str) -> str:
    """
    Determine call_type from the title keywords and H2 section context.

    Priority:
      1. Title keyword match (most precise — "fellowship" in title → "grant")
      2. Section type from H2 heading (broad category)
      3. Description keyword match
      4. Default to "grant"

    Title-level keywords override the section heading because the H2 covers
    a combined category (e.g. "Residencies, Workshops, & Fellowships") — the
    individual title is more specific.
    """
    # Title-level override first — most reliable signal
    if _COMMISSION_RE.search(title):
        return "commission"
    if _RESIDENCY_RE.search(title):
        return "residency"
    if _GRANT_RE.search(title):
        return "grant"
    if _SUBMISSION_RE.search(title):
        return "submission"

    # Section heading as fallback
    if section_type:
        return section_type

    # Description keywords as last resort
    if _COMMISSION_RE.search(description):
        return "commission"
    if _RESIDENCY_RE.search(description):
        return "residency"
    if _SUBMISSION_RE.search(description):
        return "submission"
    if _GRANT_RE.search(description):
        return "grant"

    return "grant"


# ---------------------------------------------------------------------------
# Section type from H2 heading
# ---------------------------------------------------------------------------


def _section_type_from_heading(heading_text: str) -> str:
    """
    Map an H2 section heading to a call_type string.

    e.g. "Residencies, Workshops, & Fellowships" → "residency"
         "Open Calls & Commissions" → "submission"
         "Grants & Awards" → "grant"
    """
    lower = heading_text.lower()
    # Check mapping keys in priority order: more specific terms first
    for keyword, call_type in _SECTION_TYPE_MAP.items():
        if keyword in lower:
            return call_type
    return ""


# ---------------------------------------------------------------------------
# Roundup post parser
# ---------------------------------------------------------------------------


def _extract_application_url(p_tag: Tag) -> Optional[str]:
    """
    Extract the application URL from a listing <p> tag.

    The application URL is the last <a> tag in the paragraph — typically after
    the "Deadline: DATE | " text. Hyperallergic often uses bit.ly redirects
    or direct links to the application page.

    We also handle Hyperallergic-hosted detail pages (e.g. hyperallergic.com/XXXXX/)
    by preferring external links over internal ones.
    """
    links = p_tag.find_all("a", href=True)
    if not links:
        return None

    external_links = [
        a for a in links
        if a["href"].startswith("http") and "hyperallergic.com" not in a["href"]
    ]

    if external_links:
        # Last external link is almost always the application URL
        return external_links[-1]["href"]

    # Fall back to the last link overall (might be an internal Hyperallergic detail page)
    last_link = links[-1]
    href = last_link["href"]
    if href.startswith("/"):
        href = BASE_URL + href
    return href if href else None


def _parse_listing_paragraph(p_tag: Tag, section_type: str) -> Optional[dict]:
    """
    Parse a single listing <p> block into a raw listing dict.

    Expected structure:
      <p>
        <strong>Org Name – Title</strong>
        <br/>Description text.<br/>
        Deadline: May 20, 2026 | <a href="...">domain.tld</a>
      </p>

    Returns None if the paragraph doesn't look like a listing (no <strong>,
    no deadline, no URL).
    """
    # Must have a <strong> for the title
    strong = p_tag.find("strong")
    if not strong:
        return None

    raw_title = strong.get_text(strip=True)
    if not raw_title or len(raw_title) < 5:
        return None

    # Split "Org Name – Title" or "Org Name - Title"
    # Common separators: " – ", " - ", " — "
    org_name = ""
    title = raw_title
    sep_match = re.search(r"\s[–—-]\s", raw_title)
    if sep_match:
        org_name = raw_title[: sep_match.start()].strip()
        title = raw_title[sep_match.end() :].strip()

    if not title:
        title = raw_title
        org_name = ""

    # Get full paragraph text (for deadline extraction)
    full_text = p_tag.get_text(separator="\n", strip=True)

    # Extract deadline: look for "Deadline:" or "Deadlines:" line
    deadline: Optional[str] = None
    deadline_raw = ""
    for line in full_text.splitlines():
        if re.match(r"deadlines?\s*:", line, re.I):
            deadline_raw = line.strip()
            deadline = _parse_deadline(line)
            break

    # Extract application URL
    application_url = _extract_application_url(p_tag)
    if not application_url:
        return None

    # Extract description: text between the strong title and the deadline line
    # We collect all text nodes / <br> separated segments after the strong tag
    desc_parts: list[str] = []
    for content in strong.next_siblings:
        if hasattr(content, "name"):
            if content.name == "br":
                continue
            if content.name == "a":
                # Don't include link text in description
                break
            text = content.get_text(strip=True)
        else:
            # NavigableString
            text = str(content).strip()

        if not text:
            continue
        # Stop when we hit the deadline line
        if re.match(r"deadlines?\s*:", text, re.I):
            break
        desc_parts.append(text)

    description = " ".join(desc_parts).strip()
    description = re.sub(r"\s+", " ", description)

    return {
        "title": title,
        "org_name": org_name,
        "description": description[:2000] if description else None,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "application_url": application_url,
        "section_type": section_type,
    }


def _parse_roundup_post(html: str, post_url: str) -> list[dict]:
    """
    Parse the roundup post HTML and return a list of raw listing dicts.

    Walks through the post content section, tracking the current H2 section
    (which determines call_type), and parses each <p> block as a listing.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Find the post body — Ghost CMS uses section.gh-content or div.gh-content
    content = soup.find("section", class_="gh-content")
    if not content:
        content = soup.find("div", class_="gh-content")
    if not content:
        # Fall back to article tag body
        article = soup.find("article")
        content = article if article else soup

    listings: list[dict] = []
    current_section_type = ""

    for element in content.find_all(["h2", "p"]):
        if element.name == "h2":
            # Update current section type from heading
            heading_text = element.get_text(strip=True)
            current_section_type = _section_type_from_heading(heading_text)
            logger.debug(
                "Hyperallergic: section heading %r → type %r",
                heading_text[:60],
                current_section_type,
            )
            continue

        if element.name == "p":
            # Skip CTA and membership paragraphs
            text = element.get_text(strip=True)
            if not text or len(text) < 20:
                continue
            if "hyperallergic member" in text.lower():
                continue
            if "subscribe" in text.lower() and "sign up" in text.lower():
                continue

            listing = _parse_listing_paragraph(element, current_section_type)
            if listing:
                listings.append(listing)

    logger.info(
        "Hyperallergic: parsed %d raw listings from %s", len(listings), post_url
    )
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Hyperallergic monthly opportunities roundup post.

    Strategy:
      1. Fetch the /tag/opportunities/ page.
      2. Find the most recent monthly roundup post URL.
      3. Fetch that post and parse individual listings.
      4. Skip past-deadline listings.
      5. Insert/update each listing via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    # Phase 1: find the roundup post
    tag_html = _fetch(TAG_URL, session)
    if not tag_html:
        logger.error("Hyperallergic: failed to fetch tag page — aborting")
        return 0, 0, 0

    post_url = _find_roundup_post(tag_html)
    if not post_url:
        logger.error("Hyperallergic: no roundup post found — aborting")
        return 0, 0, 0

    time.sleep(FETCH_DELAY_S)

    # Phase 2: fetch and parse the roundup post
    post_html = _fetch(post_url, session)
    if not post_html:
        logger.error("Hyperallergic: failed to fetch post %s — aborting", post_url)
        return 0, 0, 0

    raw_listings = _parse_roundup_post(post_html, post_url)
    if not raw_listings:
        logger.warning(
            "Hyperallergic: no listings parsed from %s — check page structure",
            post_url,
        )
        return 0, 0, 0

    skipped_deadline = 0
    skipped_no_url = 0
    skipped_no_deadline = 0

    for listing in raw_listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("Hyperallergic: skipping %r — no application URL", title[:60])
            continue

        deadline = listing.get("deadline")
        if not deadline:
            # Hyperallergic listings without a parseable deadline are often
            # "rolling" or have unusual format — skip to avoid stale data
            skipped_no_deadline += 1
            logger.debug(
                "Hyperallergic: skipping %r — no parseable deadline (raw: %r)",
                title[:60],
                listing.get("deadline_raw", ""),
            )
            continue

        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Hyperallergic: skipping %r — deadline %s already passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        org_name = listing.get("org_name", "").strip()
        description = listing.get("description") or ""
        section_type = listing.get("section_type", "")
        call_type = _infer_call_type(title, description, section_type)

        # Prefix org name into description if not already present
        full_description = description
        if org_name and description and org_name.lower() not in description.lower()[:80]:
            full_description = f"{org_name}: {description}"

        call_data: dict = {
            "title": title,
            "description": full_description[:2000] if full_description else None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": post_url,
            "call_type": call_type,
            "eligibility": "National",
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name or "hyperallergic",
            "metadata": {
                "organization": org_name,
                "section_type": section_type,
                "deadline_raw": listing.get("deadline_raw"),
                "roundup_post": post_url,
                "scope": "national",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Hyperallergic: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("Hyperallergic: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_deadline:
        logger.info(
            "Hyperallergic: skipped %d listings with no parseable deadline",
            skipped_no_deadline,
        )
    if skipped_no_url:
        logger.info("Hyperallergic: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "Hyperallergic: %d found (non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
