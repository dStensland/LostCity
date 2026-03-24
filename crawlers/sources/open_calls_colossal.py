"""
Crawler for Colossal Monthly Opportunities roundup posts.

Source: https://www.thisiscolossal.com/category/opportunities/

Colossal publishes monthly opportunity roundup posts listing ~25–40 curated
artist opportunities: open calls, grants, fellowships, and residencies. The
posts are titled "Month YYYY Opportunities: Open Calls, Residencies, and
Grants for Artists" and published near the end of the preceding month.

Crawl strategy — two phases:

  Phase 1 — Category page (https://www.thisiscolossal.com/category/opportunities/):
    Find the most recent monthly roundup post. Posts appear as <article> cards
    in the category feed. The most recent one (first in the list) is almost always
    the current month's roundup.

  Phase 2 — Roundup post page:
    The post body (div.entry-content) contains:

    A. Sponsored/featured listings near the top of the post — these appear before
       the first section heading and have a yellow "Featured" badge. We include
       them as regular listings.

    B. Section headings (bold <p> containing just a category label):
         "Open Calls"                → call_type = "submission"
         "Grants"                    → call_type = "grant"
         "Residencies, Fellowships, & More"  → call_type = "residency"

    C. Individual listings — one <p> per listing:
         <strong><a href="...">Title</a></strong>
         <em>(Location/Eligibility)</em>
         <br/>Description text.
         <br/><strong><em>Deadline: Month DD, YYYY.</em></strong>

       Some listings have a yellow "Featured" inline badge (span with
       background-color:#ffdc13) and an extra line "Learn more and submit: URL".
       The application URL is still the first <a> in the paragraph.

    Deadline format: "Month DD, YYYY" embedded in the last <strong><em> or <em>
    of the paragraph, typically preceded by "Deadline:" or "Deadline: X p.m. TZ on".

    Location/eligibility: the <em> tag after the title link, e.g. "(South Dakota)",
    "(International)", "(U.S.)". We store this as metadata.eligibility_raw and
    map it to a scope.

    The last paragraph is a membership CTA — skipped automatically (no deadline + no URL).

HTML structure (verified 2026-03-24):
  Category page:
    article                          — one per post
      a[href]                        — permalink (first link in article)
      h2 or h3                       — post title

  Roundup post body:
    div.entry-content
      p (section heading)            — bold text only, no link, no deadline
      p (listing)                    — has <strong><a href> + <em> deadline
      p (featured listing)           — same + yellow span badge

Confidence tier: "aggregated" — Colossal is curating other orgs' calls.
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

BASE_URL = "https://www.thisiscolossal.com"
CATEGORY_URL = "https://www.thisiscolossal.com/category/opportunities/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

FETCH_DELAY_S = 1.5

# Roundup post title pattern — "Month YYYY Opportunities: ..."
_ROUNDUP_TITLE_RE = re.compile(
    r"\b(january|february|march|april|may|june|july|august|september"
    r"|october|november|december)\s+\d{4}\s+opportunities?\b",
    re.I,
)

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Paragraph text matching a section heading (bold text only, no real listing)
# These paragraphs have no <a> tag and contain only a category label.
_SECTION_HEADING_MAP: list[tuple[str, str]] = [
    ("open call", "submission"),
    ("grant", "grant"),
    ("residenc", "residency"),
    ("fellowship", "residency"),
]

# Eligibility text → scope tag
_SCOPE_MAP: list[tuple[str, str]] = [
    ("international", "international"),
    ("worldwide", "international"),
    ("global", "international"),
    ("u.s.", "national"),
    ("united states", "national"),
    ("national", "national"),
]


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
        logger.warning("Colossal: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Category page: find most recent roundup post
# ---------------------------------------------------------------------------


def _find_roundup_post(html: str) -> Optional[str]:
    """
    Parse the /category/opportunities/ page and return the absolute URL of
    the most recent monthly roundup post.

    Colossal's category page uses standard WordPress <article> cards. The
    first matching article with a roundup title is the most recent post.
    """
    soup = BeautifulSoup(html, "html.parser")
    articles = soup.find_all("article")

    if not articles:
        logger.warning("Colossal: no article cards found on category page")
        return None

    for article in articles:
        # Get title from h2/h3
        heading = article.find(["h2", "h3"])
        title_text = heading.get_text(strip=True) if heading else ""

        if _ROUNDUP_TITLE_RE.search(title_text):
            # Get the permalink — first <a> with full URL
            link = article.find("a", href=True)
            if link:
                href = link["href"]
                if href.startswith("/"):
                    href = BASE_URL + href
                logger.info(
                    "Colossal: found roundup post: %r → %s",
                    title_text[:80],
                    href,
                )
                return href

    logger.warning("Colossal: no monthly roundup post found on category page")
    return None


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an ISO date from a deadline text fragment.

    Handles:
      "Deadline: March 17, 2026."                → "2026-03-17"
      "Deadline: 11:59 p.m. PST on March 17, 2026." → "2026-03-17"
      "Deadline: 12 p.m. EST on March 4, 2026."  → "2026-03-04"
      "Deadline: 11:59 p.m. CST on March 1, 2026." → "2026-03-01"
      Rolling / no date                            → None
    """
    if not text:
        return None

    # "Month D(D), YYYY"
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)[,\s]+(\d{1,2})[,\s]+(\d{4})",
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


def _is_past_deadline(deadline_str: str) -> bool:
    """Return True if the deadline date has already passed."""
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Section heading detection
# ---------------------------------------------------------------------------


def _is_section_heading(p_tag: Tag) -> Optional[str]:
    """
    Check if a <p> tag is a section heading (category label only).

    Colossal uses paragraphs with bold-only text (no link, no deadline) as
    section dividers: "Open Calls", "Grants", "Residencies, Fellowships, & More".

    Returns the call_type string if it's a heading, or None if it's a listing.
    """
    # Section headings have no <a> tag
    if p_tag.find("a", href=True):
        return None

    text = p_tag.get_text(strip=True)
    if not text or len(text) > 80:
        return None

    # Must have bold/strong formatting (section headings are visually distinct)
    if not p_tag.find(["strong", "b"]):
        return None

    lower = text.lower()
    for keyword, call_type in _SECTION_HEADING_MAP:
        if keyword in lower:
            return call_type

    return None


# ---------------------------------------------------------------------------
# Eligibility / scope extraction
# ---------------------------------------------------------------------------


def _extract_scope(eligibility_raw: str) -> str:
    """Map an eligibility text like '(International)' or '(U.S.)' to a scope tag."""
    lower = eligibility_raw.lower()
    for keyword, scope in _SCOPE_MAP:
        if keyword in lower:
            return scope
    # Location-specific (e.g. "South Dakota", "Chicago") → national scope
    return "national"


# ---------------------------------------------------------------------------
# Per-paragraph listing parser
# ---------------------------------------------------------------------------


def _parse_listing(p_tag: Tag, section_type: str) -> Optional[dict]:
    """
    Parse a single listing <p> block.

    Expected structure:
      <p>
        <strong><a href="URL">Title</a></strong>
        <em>(Location/Eligibility)</em>
        <br/>Description text.<br/>
        <strong><em>Deadline: Month DD, YYYY.</em></strong>
      </p>

    Featured listings add a yellow-badge span and a "Learn more: URL" line
    before the deadline — we ignore the badge, use the first <a> as the URL.

    Returns None if the paragraph doesn't have required fields (title, URL,
    deadline), or if it's a CTA/boilerplate paragraph.
    """
    # Must have an <a> with href for the application URL
    links = p_tag.find_all("a", href=True)
    if not links:
        return None

    # First external link is the application URL; title is its text
    application_url: Optional[str] = None
    title = ""
    for a in links:
        href = a["href"]
        if href.startswith("mailto:"):
            continue
        # Skip newsletter/colossal-internal links in the first paragraph
        if "thisiscolossal.com/newsletter" in href:
            continue
        application_url = href
        # Use separator=" " so inline elements (em, strong inside a) join with
        # a space rather than running together: "Glen Arbor Arts Center:American Tree"
        title = re.sub(r"\s+", " ", a.get_text(separator=" ", strip=True)).strip()
        break

    if not application_url or not title or len(title) < 5:
        return None

    # Get full paragraph text
    full_text = p_tag.get_text(separator="\n", strip=True)

    # Skip boilerplate / CTA paragraphs
    if "become a colossal member" in full_text.lower():
        return None
    if "every month, we share opportunities" in full_text.lower():
        return None
    if len(full_text) < 30:
        return None

    # --- Deadline ---
    deadline: Optional[str] = None
    deadline_raw = ""

    # Colossal puts deadline in the last <strong><em> or <em> of the listing
    # Search all em/strong elements for a "Deadline:" line
    for el in reversed(p_tag.find_all(["em", "strong"])):
        el_text = el.get_text(separator=" ", strip=True)
        if re.search(r"deadline", el_text, re.I):
            parsed = _parse_deadline(el_text)
            if parsed:
                deadline = parsed
                deadline_raw = el_text
                break

    # Fallback: scan each line of full_text for deadline signal
    if not deadline:
        for line in full_text.splitlines():
            if re.search(r"deadline", line, re.I):
                parsed = _parse_deadline(line)
                if parsed:
                    deadline = parsed
                    deadline_raw = line.strip()
                    break

    # --- Eligibility: <em> tag right after the title that looks like "(Location)" ---
    eligibility_raw = ""
    strong = p_tag.find("strong")
    if strong:
        # Look for <em> immediately after the <strong> title block
        next_sib = strong.next_sibling
        while next_sib and hasattr(next_sib, "name") and next_sib.name in (None, "span"):
            next_sib = next_sib.next_sibling
        if next_sib and hasattr(next_sib, "name") and next_sib.name == "em":
            em_text = next_sib.get_text(strip=True)
            if em_text.startswith("(") and em_text.endswith(")"):
                eligibility_raw = em_text.strip("()")

    # --- Description: full text minus deadline line and title line ---
    description_lines = []
    for line in full_text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line == title:
            continue
        if eligibility_raw and f"({eligibility_raw})" == line:
            continue
        if deadline_raw and deadline_raw in line:
            continue
        # Skip "Learn more and submit:" lines (featured listing extra line)
        if re.match(r"learn more and submit\s*:", line, re.I):
            continue
        # Skip "Featured" badge text
        if line.lower() == "featured":
            continue
        description_lines.append(line)

    description = " ".join(description_lines).strip()
    description = re.sub(r"\s+", " ", description)
    if len(description) > 2000:
        description = description[:2000]

    return {
        "title": title,
        "application_url": application_url,
        "description": description or None,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "eligibility_raw": eligibility_raw,
        "section_type": section_type,
    }


# ---------------------------------------------------------------------------
# Roundup post parser
# ---------------------------------------------------------------------------


def _parse_roundup_post(html: str, post_url: str) -> list[dict]:
    """
    Parse the roundup post HTML and return a list of raw listing dicts.

    Walks through div.entry-content paragraphs. Section heading <p> tags
    (bold text only, no link) update the current call_type. All other <p>
    tags with a link and a parseable deadline are treated as listings.

    Featured sponsored listings appear before the first section heading and
    default to "grant" or the type inferred from their title keywords.
    """
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find("div", class_="entry-content")
    if not content:
        logger.warning("Colossal: div.entry-content not found in post %s", post_url)
        return []

    listings: list[dict] = []
    current_section_type = "submission"  # default before first section heading

    for element in content.find_all("p"):
        # Check if this is a section heading paragraph
        heading_type = _is_section_heading(element)
        if heading_type is not None:
            current_section_type = heading_type
            logger.debug(
                "Colossal: section heading → type %r",
                current_section_type,
            )
            continue

        listing = _parse_listing(element, current_section_type)
        if listing:
            listings.append(listing)

    logger.info(
        "Colossal: parsed %d raw listings from %s",
        len(listings),
        post_url,
    )
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Colossal monthly opportunities roundup post.

    Strategy:
      1. Fetch the /category/opportunities/ page.
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
    category_html = _fetch(CATEGORY_URL, session)
    if not category_html:
        logger.error("Colossal: failed to fetch category page — aborting")
        return 0, 0, 0

    post_url = _find_roundup_post(category_html)
    if not post_url:
        logger.error("Colossal: no roundup post found — aborting")
        return 0, 0, 0

    time.sleep(FETCH_DELAY_S)

    # Phase 2: fetch and parse the roundup post
    post_html = _fetch(post_url, session)
    if not post_html:
        logger.error("Colossal: failed to fetch post %s — aborting", post_url)
        return 0, 0, 0

    raw_listings = _parse_roundup_post(post_html, post_url)
    if not raw_listings:
        logger.warning(
            "Colossal: no listings parsed from %s — check page structure",
            post_url,
        )
        return 0, 0, 0

    skipped_deadline = 0
    skipped_no_deadline = 0
    skipped_no_url = 0

    for listing in raw_listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("Colossal: skipping %r — no application URL", title[:60])
            continue

        deadline = listing.get("deadline")
        if not deadline:
            skipped_no_deadline += 1
            logger.debug(
                "Colossal: skipping %r — no parseable deadline (raw: %r)",
                title[:60],
                listing.get("deadline_raw", ""),
            )
            continue

        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Colossal: skipping %r — deadline %s already passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        section_type = listing.get("section_type", "submission")
        eligibility_raw = listing.get("eligibility_raw", "")
        description = listing.get("description") or ""
        scope = _extract_scope(eligibility_raw) if eligibility_raw else "national"

        call_data: dict = {
            "title": title,
            "description": description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": post_url,
            "call_type": section_type,
            "eligibility": "National" if scope == "national" else "International",
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": "colossal",
            "metadata": {
                "organization": "Colossal",
                "eligibility_raw": eligibility_raw,
                "section_type": section_type,
                "deadline_raw": listing.get("deadline_raw"),
                "roundup_post": post_url,
                "scope": scope,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Colossal: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                section_type,
            )

    if skipped_deadline:
        logger.info("Colossal: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_deadline:
        logger.info(
            "Colossal: skipped %d listings with no parseable deadline",
            skipped_no_deadline,
        )
    if skipped_no_url:
        logger.info("Colossal: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "Colossal: %d found (non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
