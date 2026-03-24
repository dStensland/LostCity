"""
Crawler for Burnaway open calls — Southeast arts publication monthly roundups.

Burnaway publishes monthly "Call for Artists" roundup articles at:
  https://burnaway.org/daily/call-for-artists/

Each article lists 10-20 individual artist opportunities (submissions, residencies,
grants, commissions). This crawler fetches the index page to discover recent articles,
then parses each article's individual call listings.

HTML structure per call (three variants observed):
  Pattern A: <a><strong>TITLE</strong></a><strong>LOCATION\\nDeadline: DATE</strong>
  Pattern B: <strong><a>TITLE</a>LOCATION\\nDeadline: DATE</strong>
  Pattern C: <strong><a>TITLE</a></strong><strong>LOCATION</strong><strong>Deadline: DATE</strong>

Calls are separated by <hr> elements within the article body. Each call has an
"Apply" button (wp-block-button) containing the direct application URL.
"""

import copy
import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

INDEX_URL = "https://burnaway.org/daily/call-for-artists/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# Only crawl articles from the last N pages of the index (each page has ~9 articles)
MAX_INDEX_PAGES = 2

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Burnaway: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Index page — discover article URLs
# ---------------------------------------------------------------------------


def _collect_article_urls(session: requests.Session) -> list[str]:
    """Scrape the index pages and return article URLs (most-recent first)."""
    urls: list[str] = []

    for page_num in range(1, MAX_INDEX_PAGES + 1):
        page_url = INDEX_URL if page_num == 1 else f"{INDEX_URL}page/{page_num}/"
        html = _fetch(page_url, session)
        if not html:
            break

        soup = BeautifulSoup(html, "html.parser")
        articles = soup.find_all("article")
        page_urls: list[str] = []
        for art in articles:
            link = art.find("a", href=True)
            if link and "burnaway.org/daily/" in link["href"]:
                href = link["href"]
                if href not in urls and href not in page_urls:
                    page_urls.append(href)

        if not page_urls:
            break
        urls.extend(page_urls)

        # Check for "Older posts" link to continue pagination
        older = soup.find("a", string=re.compile(r"older posts", re.I))
        if not older:
            break

    logger.debug("Burnaway: discovered %d article URLs across %d index page(s)", len(urls), page_num)
    return urls


# ---------------------------------------------------------------------------
# Date / fee / type helpers
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """Convert 'March 4, 2026' → '2026-03-04'."""
    if not text:
        return None
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        text, re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{year}-{month_num:02d}-{int(day):02d}"
    return None


def _parse_fee(text: str) -> Optional[float]:
    """Extract dollar amount from fee note, e.g. '$25 application fee' → 25.0."""
    if not text:
        return None
    m = re.search(r"\$(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


def _infer_call_type(title: str, desc: str) -> str:
    """Infer call_type from combined title + description text."""
    combined = (title + " " + desc).lower()
    if any(w in combined for w in ["residency", "resident", "in residence"]):
        return "residency"
    if any(w in combined for w in ["grant", "fellowship", "prize", "award", "funding"]):
        return "grant"
    if "commission" in combined:
        return "commission"
    if "proposal" in combined:
        return "exhibition_proposal"
    return "submission"


# ---------------------------------------------------------------------------
# Article-level parser
# ---------------------------------------------------------------------------


def _parse_header_p(p) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Parse a header <p> element into (title, location, deadline_str, app_link).

    Three HTML patterns observed in the wild:

    Pattern A — link wraps only the title strong; location+deadline in second strong:
        <p>
          <a href="..."><strong>TITLE</strong></a>
          <strong>LOCATION\\nDeadline: DATE</strong>
        </p>

    Pattern B — one big strong wraps everything, link is inside:
        <p>
          <strong>
            <a href="...">TITLE</a>
            LOCATION\\nDeadline: DATE
          </strong>
        </p>

    Pattern C — three separate strongs:
        <p>
          <strong><a href="...">TITLE</a></strong>
          <strong>LOCATION</strong>
          <strong>Deadline: DATE</strong>
        </p>
    """
    strongs = p.find_all("strong")
    if not strongs:
        return None, None, None, None

    link_el = p.find("a", href=True)
    title = link_el.get_text(strip=True) if link_el else None
    app_link = link_el["href"] if link_el else None

    location: Optional[str] = None
    deadline_str: Optional[str] = None

    if len(strongs) == 1:
        # Pattern B: one strong, link inside
        s = strongs[0]
        # Clone the strong and remove the <a> to isolate location+deadline text
        s_clone = copy.copy(s)
        for a in s_clone.find_all("a"):
            a.decompose()
        remainder = s_clone.get_text(separator="\n", strip=False).strip()
        parts = re.split(r"Deadline:", remainder, maxsplit=1, flags=re.I)
        location = parts[0].strip().rstrip(",").strip() or None
        deadline_str = parts[1].strip() if len(parts) > 1 else None

    elif len(strongs) == 2:
        # Pattern A: first strong = title, second = "LOCATION\nDeadline: DATE"
        second_text = strongs[1].get_text(separator="\n", strip=False).strip()
        parts = re.split(r"Deadline:", second_text, maxsplit=1, flags=re.I)
        location = parts[0].strip().rstrip(",").strip() or None
        deadline_str = parts[1].strip() if len(parts) > 1 else None

    else:
        # Pattern C: separate strongs for title, location, and deadline
        for s in strongs:
            s_text = s.get_text(strip=True)
            if s_text == title:
                continue
            if re.search(r"Deadline:", s_text, re.I):
                dl_m = re.search(
                    r"((?:January|February|March|April|May|June|July|August"
                    r"|September|October|November|December)\s+\d{1,2},?\s*\d{4})",
                    s_text, re.I,
                )
                if dl_m:
                    deadline_str = dl_m.group(1)
            elif s_text and not location:
                location = s_text

    # Clean up newlines in location
    if location:
        location = re.sub(r"\s+", " ", location).strip()

    return title, location, deadline_str, app_link


def _parse_article(html: str, article_url: str) -> list[dict]:
    """Parse all call listings from a single Burnaway article page."""
    soup = BeautifulSoup(html, "html.parser")

    content = soup.find(class_=lambda x: x and "entry-content" in str(x) if x else False)
    if not content:
        logger.warning("Burnaway: no entry-content found in %s", article_url)
        return []

    # Split content on <hr> elements — each segment is one call
    segments: list[list] = []
    current: list = []
    for child in content.children:
        if hasattr(child, "name"):
            if child.name == "hr":
                if current:
                    segments.append(current)
                    current = []
            else:
                current.append(child)
    if current:
        segments.append(current)

    calls: list[dict] = []

    for seg in segments:
        title: Optional[str] = None
        location: Optional[str] = None
        deadline_str: Optional[str] = None
        app_url: Optional[str] = None
        desc_parts: list[str] = []
        fee_text: Optional[str] = None
        header_done = False

        for el in seg:
            if not hasattr(el, "name") or el.name is None:
                continue

            if el.name == "p":
                if not header_done:
                    strongs = el.find_all("strong")
                    # Header paragraphs always have <strong> elements and typically
                    # contain a "Deadline:" pattern — but we also parse on any <strong>
                    # with a link to avoid missing calls with unusual deadline phrasing.
                    if strongs:
                        t, loc, dl, link = _parse_header_p(el)
                        if t:
                            title = re.sub(r"\s+", " ", t).strip()
                            location = loc
                            deadline_str = dl
                            # Prefer the Apply button URL; keep header link as fallback
                            if not app_url and link:
                                app_url = link
                            header_done = True
                            continue

                if header_done:
                    plain = el.get_text(strip=True)
                    if not plain:
                        continue
                    em = el.find("em")
                    if em and ("fee" in plain.lower() or "$" in plain):
                        fee_text = plain
                    else:
                        desc_parts.append(plain)

            elif el.name == "div":
                # Apply button (wp-block-button)
                btn = el.find(
                    "a",
                    class_=lambda x: x and "wp-block-button__link" in str(x) if x else False,
                )
                if not btn:
                    btn_div = el.find("div", class_="wp-block-button")
                    if btn_div:
                        btn = btn_div.find("a", href=True)
                if btn and btn.get("href"):
                    app_url = btn["href"]

        if not title:
            continue

        description = " ".join(desc_parts).strip()

        calls.append({
            "title": title,
            "location": location,  # metadata only, not stored as a DB column
            "deadline": _parse_deadline(deadline_str),
            "application_url": app_url or article_url,
            "description": description[:2000] if description else None,
            "fee": _parse_fee(fee_text),
            "call_type": _infer_call_type(title, description),
            "source_url": article_url,
        })

    logger.debug("Burnaway: parsed %d calls from %s", len(calls), article_url)
    return calls


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Burnaway open calls index + individual article pages.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1. Discover article URLs from the index
    article_urls = _collect_article_urls(session)
    if not article_urls:
        logger.warning("Burnaway: no article URLs discovered from index")
        return 0, 0, 0

    # 2. Parse each article
    for article_url in article_urls:
        html = _fetch(article_url, session)
        if not html:
            continue

        calls = _parse_article(html, article_url)

        for call in calls:
            found += 1
            location_note = call.pop("location", None)  # not a DB column

            call_data = {
                "title": call["title"],
                "application_url": call["application_url"],
                "deadline": call.get("deadline"),
                "call_type": call["call_type"],
                "description": call.get("description"),
                "eligibility": None,
                "fee": call.get("fee"),
                "source_url": call["source_url"],
                "source_id": source_id,
                "confidence_tier": "verified",  # Burnaway is a trusted editorial source
                "_org_name": "burnaway",
                # Store location in metadata for future use
                "metadata": {"location": location_note} if location_note else {},
            }

            result = insert_open_call(call_data)
            if result:
                new += 1

    logger.info("Burnaway: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
