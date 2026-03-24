"""
Crawler for GraphicCompetitions.com open calls.

GraphicCompetitions is a curated directory of international competitions in
illustration, photography, graphic design, and multi-discipline visual arts.
~100+ active listings across 7 pages.

Structure:
  Index pages: https://graphiccompetitions.com/ and /home/p_N (N=2..7)
  Each page has ~15 <div class="item-info"> containers with:
    - <small>: category link + deadline span + "(deadline)" text
    - <h3><a>: title + detail URL
    - <p>: description snippet
  Detail URLs: //graphiccompetitions.com/{category}/{slug}

  Category → call_type mapping:
    "Photography"           → submission
    "Graphic Design"        → submission
    "Illustration"          → submission
    "Multiple Disciplines"  → submission

  Deadline format: "May 30, 2026" (English month name)

Confidence tier: "aggregated" — curated but third-party aggregator.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

BASE_URL = "https://graphiccompetitions.com"
MAX_PAGES = 15
PAGE_DELAY = 0.5
REQUEST_TIMEOUT = 30

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": _USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return session


def _page_url(page_num: int) -> str:
    if page_num <= 1:
        return BASE_URL + "/"
    return f"{BASE_URL}/home/p_{page_num}"


def _parse_deadline(text: str) -> Optional[str]:
    """Parse 'May 30, 2026' format to YYYY-MM-DD."""
    text = text.strip()
    try:
        dt = datetime.strptime(text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass
    # Try without leading zero: "May 1, 2026"
    try:
        dt = datetime.strptime(text, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _is_past_deadline(deadline: Optional[str]) -> bool:
    if not deadline:
        return False
    try:
        dl = datetime.strptime(deadline, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


def _parse_index_page(html: str) -> list[dict]:
    """Parse one page of GraphicCompetitions listings."""
    soup = BeautifulSoup(html, "html.parser")
    items = soup.find_all("div", class_="item-info")
    listings = []

    for item in items:
        # Title + URL from h3 > a
        h3 = item.find("h3")
        if not h3:
            continue
        link = h3.find("a", href=True)
        if not link:
            continue

        title = link.get_text(strip=True)
        if not title:
            continue

        href = link["href"]
        # URLs use protocol-relative //graphiccompetitions.com/...
        if href.startswith("//"):
            detail_url = "https:" + href
        elif href.startswith("/"):
            detail_url = BASE_URL + href
        else:
            detail_url = href

        # Category from small > a
        small = item.find("small")
        category = ""
        deadline = None
        if small:
            cat_link = small.find("a")
            if cat_link:
                category = cat_link.get_text(strip=True)

            # Deadline from small > span
            deadline_span = small.find("span")
            if deadline_span:
                deadline = _parse_deadline(deadline_span.get_text(strip=True))

        # Description from first <p> that isn't the "Read More" link
        description = ""
        for p in item.find_all("p"):
            if p.get("class") and "view" in p.get("class", []):
                continue
            text = p.get_text(strip=True)
            if text and len(text) > 20:
                description = text
                break

        listings.append({
            "title": title,
            "detail_url": detail_url,
            "category": category,
            "deadline": deadline,
            "description": description,
        })

    return listings


def _has_next_page(html: str) -> bool:
    """Check if pagination has a 'Next' link."""
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a"):
        text = a.get_text(strip=True)
        if "Next" in text:
            href = a.get("href", "")
            if "/home/p_" in href:
                return True
    return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl GraphicCompetitions.com open calls.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    for page_num in range(1, MAX_PAGES + 1):
        url = _page_url(page_num)
        logger.debug("GraphicCompetitions: fetching page %d — %s", page_num, url)

        if page_num > 1:
            time.sleep(PAGE_DELAY)

        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.warning("GraphicCompetitions: failed page %d: %s", page_num, exc)
            break

        html = resp.text
        listings = _parse_index_page(html)

        if not listings:
            logger.info("GraphicCompetitions: page %d — 0 listings, stopping", page_num)
            break

        for listing in listings:
            title = listing["title"]
            deadline = listing["deadline"]
            detail_url = listing["detail_url"]

            if _is_past_deadline(deadline):
                continue

            found += 1

            org_slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]

            call_data = {
                "title": title,
                "description": listing["description"] or None,
                "deadline": deadline,
                "application_url": detail_url,
                "source_url": detail_url,
                "call_type": "submission",
                "eligibility": "International",
                "fee": None,
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": org_slug,
                "metadata": {
                    "source": "graphic-competitions",
                    "category": listing["category"],
                },
            }

            result = insert_open_call(call_data)
            if result:
                new += 1

        if not _has_next_page(html):
            logger.info("GraphicCompetitions: no next page after page %d", page_num)
            break

    logger.info(
        "GraphicCompetitions: crawl complete — %d found, %d new, %d updated",
        found, new, updated,
    )
    return found, new, updated
