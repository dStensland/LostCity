"""
Crawler for The Bakery ATL open calls.

The Bakery ATL is an Atlanta-based arts organization that publishes
active open calls on a single static Squarespace page:
  https://thebakeryatlanta.com/open-calls

HTML structure: each call lives in a `.fe-block-*` section container.
Within each block, the call has a heading (h2 or h3) for the title,
one or more paragraphs for the description, and optionally a Google
Form link for the application URL and a deadline date in the body text.

Observed calls (as of 2026-03-23):
  - Call for Artwork
  - Call for Collage Artists
  - Call for Models
  - Call for Volunteers
  - Call for Workshops
  - Call for Artists (directory)

Only one of the six has a deadline (March 30, 2026). All are linked to
Google Forms for application.
"""

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

SOURCE_URL = "https://thebakeryatlanta.com/open-calls"
ORG_NAME = "The Bakery ATL"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Bakery ATL: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date / type helpers
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract a deadline date from free text and return 'YYYY-MM-DD', or None.

    Handles patterns such as:
      'Deadline: March 30, 2026'
      'Applications close March 30, 2026'
      'March 30, 2026'
    """
    if not text:
        return None
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{year}-{month_num:02d}-{int(day):02d}"
    return None


def _is_past_deadline(deadline: Optional[str]) -> bool:
    """Return True if deadline is set and is strictly in the past."""
    if not deadline:
        return False
    try:
        dl = date.fromisoformat(deadline)
        return dl < date.today()
    except ValueError:
        return False


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from combined title + description text.

    Types: submission, residency, grant, commission, exhibition_proposal
    """
    combined = (title + " " + description).lower()
    if any(w in combined for w in ["residency", "resident", "in residence"]):
        return "residency"
    if any(w in combined for w in ["grant", "fellowship", "prize", "award", "funding"]):
        return "grant"
    if "commission" in combined:
        return "commission"
    if "proposal" in combined:
        return "exhibition_proposal"
    return "submission"


def _looks_like_call_title(text: str) -> bool:
    lowered = (text or "").strip().lower()
    if not lowered or lowered.startswith("open calls from"):
        return False
    return any(
        kw in lowered
        for kw in ["call for", "submission", "artists", "volunteers", "models", "workshop"]
    )


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_calls(html: str) -> list[dict]:
    """
    Parse all open call blocks from the Bakery ATL open calls page.

    Squarespace renders each content block with a class that starts with
    'fe-block-'. Within that block we look for:
      - A heading (h2 or h3) for the title
      - Paragraph text for description and deadline
      - A Google Form link for the application URL
    """
    soup = BeautifulSoup(html, "html.parser")

    # Each content section is a div whose class list includes 'fe-block-*'
    # We also search inside <section> and plain content wrappers as fallback.
    blocks = soup.find_all(
        "div",
        class_=lambda c: c and any(cls.startswith("fe-block-") for cls in c),
    )

    # Squarespace sometimes nests content differently — collect all headings
    # that look like "Call for ..." and use them as anchors.
    if not blocks:
        logger.debug("Bakery ATL: no fe-block divs found, falling back to heading scan")
        return _parse_calls_by_headings(soup)

    calls: list[dict] = []

    for block in blocks:
        heading = block.find(["h2", "h3"])
        if not heading:
            continue

        title = heading.get_text(strip=True)
        if not title:
            continue

        # Skip blocks that are clearly not open calls (navigation, footer, etc.)
        title_lower = title.lower()
        if not _looks_like_call_title(title_lower):
            continue

        # Collect all paragraph text within the block
        paragraphs = block.find_all("p")
        desc_parts: list[str] = []
        deadline_raw: Optional[str] = None

        for p in paragraphs:
            text = p.get_text(" ", strip=True)
            if not text:
                continue
            # Check for deadline signal in this paragraph
            if deadline_raw is None and re.search(
                r"deadline|close[sd]?|due|by\s+\w+\s+\d", text, re.I
            ):
                candidate = _parse_deadline(text)
                if candidate:
                    deadline_raw = candidate
            desc_parts.append(text)

        description = " ".join(desc_parts).strip()

        # Also scan full block text for any date if not found in paragraphs
        if deadline_raw is None:
            deadline_raw = _parse_deadline(block.get_text(" ", strip=True))

        # Find Google Form application link anywhere in the block
        application_url: Optional[str] = None
        for a in block.find_all("a", href=True):
            href = a["href"]
            if "docs.google.com/forms" in href or "forms.gle" in href:
                application_url = href
                break

        # Fall back to the source page if no form link found
        if not application_url:
            application_url = SOURCE_URL

        calls.append({
            "title": title,
            "description": description[:2000] if description else None,
            "deadline": deadline_raw,
            "application_url": application_url,
            "call_type": _infer_call_type(title, description),
            "source_url": SOURCE_URL,
        })

    logger.debug("Bakery ATL: parsed %d calls from fe-block divs", len(calls))
    return calls or _parse_calls_by_headings(soup)


def _parse_calls_by_headings(soup: BeautifulSoup) -> list[dict]:
    """
    Fallback parser: scan for h2/h3 headings that look like open calls,
    then collect sibling content until the next heading.
    """
    calls: list[dict] = []
    text_blocks = soup.select("div.sqs-html-content")
    current: Optional[dict] = None

    def finalize_current() -> None:
        nonlocal current
        if not current:
            return
        description = " ".join(current["desc_parts"]).strip()
        calls.append(
            {
                "title": current["title"],
                "description": description[:2000] if description else None,
                "deadline": current["deadline"],
                "application_url": current["application_url"] or SOURCE_URL,
                "call_type": _infer_call_type(current["title"], description),
                "source_url": SOURCE_URL,
            }
        )
        current = None

    for block in text_blocks:
        heading = block.find(["h1", "h2", "h3"])
        heading_text = heading.get_text(" ", strip=True) if heading else ""

        if _looks_like_call_title(heading_text):
            finalize_current()
            current = {
                "title": heading_text,
                "desc_parts": [],
                "deadline": None,
                "application_url": None,
            }
            continue

        if current is None:
            continue

        text = block.get_text(" ", strip=True)
        if not text or text.upper() in {"VISIT US", "SUPPORT", "CONNECT", "WORK WITH US", "ATLANTA ART RESOURCES"}:
            continue

        if current["deadline"] is None:
            deadline = _parse_deadline(text)
            if deadline:
                current["deadline"] = deadline

        for a in block.find_all("a", href=True):
            href = a["href"]
            if "docs.google.com/forms" in href or "forms.gle" in href:
                current["application_url"] = href
                break

        if text != ".":
            current["desc_parts"].append(text)

    finalize_current()
    logger.debug("Bakery ATL: parsed %d calls from heading scan", len(calls))
    return calls


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Bakery ATL open calls page.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    html = _fetch(SOURCE_URL, session)
    if not html:
        logger.warning("Bakery ATL: could not fetch %s", SOURCE_URL)
        return 0, 0, 0

    calls = _parse_calls(html)
    if not calls:
        logger.warning("Bakery ATL: no calls parsed from page — site structure may have changed")
        return 0, 0, 0

    for call in calls:
        # Skip calls whose deadline has already passed
        if _is_past_deadline(call.get("deadline")):
            logger.debug(
                "Bakery ATL: skipping past-deadline call %r (deadline=%s)",
                call["title"],
                call["deadline"],
            )
            continue

        found += 1

        call_data = {
            "title": call["title"],
            "application_url": call["application_url"],
            "deadline": call.get("deadline"),
            "call_type": call["call_type"],
            "description": call.get("description"),
            "eligibility": None,
            "fee": None,
            "source_url": call["source_url"],
            "source_id": source_id,
            "confidence_tier": "verified",
            "_org_name": ORG_NAME,
            "metadata": {},
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    logger.info(
        "Bakery ATL: %d found (active), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
