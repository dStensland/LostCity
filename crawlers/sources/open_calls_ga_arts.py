"""
Crawler for Georgia Council for the Arts (GCA) open grant programs.

Source: https://gaarts.org/grants/

GCA is Georgia's state arts agency, administering multiple competitive grant
programs for nonprofits, schools, government entities, and individual artists.

Cloudflare bypass: gaarts.org uses Cloudflare's managed JS challenge.
Playwright (headless and non-headless) fails reliably. `cloudscraper` handles
the JS challenge natively with zero overhead — no browser needed.

Crawl strategy:
  1. Fetch the index page at /grants/ and discover all grant detail page URLs
     from "Learn More" anchors attached to grant h3 cards.
  2. Fetch each detail page and parse: title, description, deadline, application
     URL, eligibility, and award amount metadata.
  3. Skip any call whose deadline has already passed.

HTML observations (verified 2026-03-24):
  - Index: h3 elements per grant card; anchors link to detail URLs.
    Non-grant h3s to skip: "APPLY for a GCA Grant", "FAQ about Grants",
    "GCA Logos", "Grant Review Panels".
  - Detail pages: main content with labels like "Description:",
    "Eligible Applicants:", "Application Deadline:", "Grant Request:".
  - Application links wrapped in Barracuda link protection
    (linkprotect.cudasvc.com). We extract the real URL from the ?a= param.

Confidence tier: "verified" — GCA is the issuing organization.
Eligibility: Georgia-based applicants only.
"""

import logging
import re
import urllib.parse
from datetime import date
from typing import Optional

import cloudscraper
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

INDEX_URL = "https://gaarts.org/grants/"
BASE_URL = "https://gaarts.org"

# H3 text values on the index page that are NOT actual grant programs
_NON_GRANT_H3S = {
    "APPLY for a GCA Grant",
    "FAQ about Grants",
    "GCA Logos",
    "Grant Review Panels",
}

_ORG_NAME = "georgia-council-for-the-arts"
_ELIGIBILITY = "Georgia-based nonprofits, government entities, public libraries, schools, colleges, and universities. Eligibility varies by program."

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _build_scraper() -> cloudscraper.CloudScraper:
    return cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "darwin", "mobile": False}
    )


def _fetch(scraper: cloudscraper.CloudScraper, url: str) -> Optional[str]:
    """Fetch a page, returning HTML or None on failure."""
    try:
        r = scraper.get(url, timeout=30)
        r.raise_for_status()
        if "Just a moment" in r.text or "cf_chl" in r.text:
            logger.warning("GCAGrants: Cloudflare challenge not bypassed for %s", url)
            return None
        return r.text
    except Exception as exc:
        logger.warning("GCAGrants: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------


def _resolve_application_url(href: str) -> str:
    """Extract the real URL from a Barracuda link protection wrapper."""
    if "linkprotect.cudasvc.com" in href:
        m = re.search(r"[?&]a=([^&]+)", href)
        if m:
            return urllib.parse.unquote(m.group(1))
    return href


# ---------------------------------------------------------------------------
# Index page: discover grant detail URLs
# ---------------------------------------------------------------------------


def _discover_grant_urls(index_html: str) -> list[tuple[str, str]]:
    """Parse the index page and return (title, url) pairs for each grant program."""
    soup = BeautifulSoup(index_html, "html.parser")
    results: list[tuple[str, str]] = []

    for h3 in soup.find_all("h3"):
        title = h3.get_text(strip=True)
        if not title or title in _NON_GRANT_H3S:
            continue

        card = h3.parent
        detail_url: Optional[str] = None
        for a in card.find_all("a", href=True):
            href = a["href"]
            if (
                href.startswith("https://gaarts.org/grants/")
                and href != INDEX_URL
                and "grant-faqs" not in href
                and "gca-logo" not in href
                and "grant-review" not in href
            ):
                detail_url = href
                break

        if detail_url:
            results.append((title, detail_url))

    logger.info("GCAGrants: discovered %d grant programs on index page", len(results))
    return results


# ---------------------------------------------------------------------------
# Detail page parsing
# ---------------------------------------------------------------------------

_MONTH_PATTERN = (
    r"(?:January|February|March|April|May|June|July|August|September"
    r"|October|November|December)"
)
_DATE_PATTERN = rf"({_MONTH_PATTERN}\s+\d{{1,2}},?\s*\d{{4}})"

_EXPLICIT_DEADLINE_RE = re.compile(
    rf"(?:Application\s+)?Deadline\s*:?\s*"
    rf"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?"
    rf"{_DATE_PATTERN}",
    re.I,
)
_SUBMITTED_BY_RE = re.compile(
    rf"(?:must\s+be\s+submitted|submit(?:ted)?\s+by)\s+"
    rf"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+)?"
    rf"{_DATE_PATTERN}",
    re.I,
)
_NEXT_DEADLINE_RE = re.compile(
    rf"Next\s+Deadline\s*:.*?{_DATE_PATTERN}",
    re.I | re.DOTALL,
)
_GRANT_REQUEST_RE = re.compile(
    r"Grant\s+Request\s*:?\s*(.{5,60}?)(?:\n|Minimum|Eligible|Match|$)",
    re.I,
)


def _parse_date_string(date_str: str) -> Optional[str]:
    """Convert 'Month D, YYYY' → 'YYYY-MM-DD'."""
    m = re.search(
        rf"({_MONTH_PATTERN})\s+(\d{{1,2}}),?\s*(\d{{4}})",
        date_str, re.I,
    )
    if not m:
        return None
    month_num = _MONTH_MAP.get(m.group(1).lower())
    if not month_num:
        return None
    return f"{m.group(3)}-{month_num:02d}-{int(m.group(2)):02d}"


def _parse_deadline(page_text: str) -> Optional[str]:
    for pattern in (_EXPLICIT_DEADLINE_RE, _SUBMITTED_BY_RE, _NEXT_DEADLINE_RE):
        m = pattern.search(page_text)
        if m:
            return _parse_date_string(m.group(1))
    return None


def _parse_application_url(soup: BeautifulSoup) -> str:
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        href = a["href"]
        if any(kw in text for kw in ["apply", "application", "submit"]) and href:
            if href.startswith("http"):
                return _resolve_application_url(href)
            if href.startswith("/"):
                return BASE_URL + href
    return "https://gaarts.org/apply/"


def _parse_description(main_text: str, title: str) -> str:
    desc_start = re.search(r"Description\s*:", main_text, re.I)
    if desc_start:
        text = main_text[desc_start.start():]
    else:
        text = main_text.replace(title, "", 1).strip()

    for marker in ["Want to stay up to date", "Sign up for our newsletter",
                    "Subscribe", "Follow Us"]:
        idx = text.find(marker)
        if idx > 0:
            text = text[:idx]

    return text.strip()[:2000]


def _parse_grant_detail(html: str, detail_url: str, index_title: str) -> Optional[dict]:
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else index_title
    if not title:
        title = index_title

    main = soup.find("main") or soup.find("article") or soup.body
    main_text = main.get_text(separator=" ", strip=True) if main else ""

    grant_request_m = _GRANT_REQUEST_RE.search(main_text)
    grant_request = grant_request_m.group(1).strip().rstrip(".") if grant_request_m else None

    return {
        "title": title,
        "description": _parse_description(main_text, title),
        "deadline": _parse_deadline(main_text),
        "application_url": _parse_application_url(soup),
        "metadata": {"grant_request": grant_request, "detail_url": detail_url},
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Council for the Arts grant listings.

    Uses cloudscraper to bypass Cloudflare's JS challenge (no browser needed).
    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    scraper = _build_scraper()

    logger.info("GCAGrants: fetching index page %s", INDEX_URL)
    index_html = _fetch(scraper, INDEX_URL)
    if not index_html:
        logger.error("GCAGrants: failed to fetch index page")
        return 0, 0, 0

    grant_entries = _discover_grant_urls(index_html)
    if not grant_entries:
        logger.warning("GCAGrants: no grant programs found on index page")
        return 0, 0, 0

    for index_title, detail_url in grant_entries:
        detail_html = _fetch(scraper, detail_url)
        if not detail_html:
            logger.warning("GCAGrants: skipping %s — could not fetch", detail_url)
            continue

        call_raw = _parse_grant_detail(detail_html, detail_url, index_title)
        if not call_raw:
            continue

        found += 1

        deadline_iso = call_raw.get("deadline")
        if deadline_iso:
            try:
                if date.fromisoformat(deadline_iso) < today:
                    logger.debug(
                        "GCAGrants: skipping '%s' — deadline %s past",
                        call_raw["title"], deadline_iso,
                    )
                    continue
            except ValueError:
                pass

        call_data: dict = {
            "title": call_raw["title"],
            "description": call_raw.get("description"),
            "deadline": call_raw.get("deadline"),
            "application_url": call_raw["application_url"],
            "source_url": detail_url,
            "call_type": "grant",
            "eligibility": _ELIGIBILITY,
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "verified",
            "_org_name": _ORG_NAME,
            "metadata": call_raw.get("metadata") or {},
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    logger.info("GCAGrants: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
