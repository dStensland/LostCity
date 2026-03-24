"""
Crawler for CuratorSpace open calls (curatorspace.com/opportunities).

CuratorSpace is a UK-based platform for visual art and curatorial opportunities.
Organizations post their own calls directly — CuratorSpace is the submission
host, not a downstream aggregator — so listings are first-hand but the platform
acts as an aggregator across many orgs. Confidence tier: "aggregated".

All submissions go through CuratorSpace's own platform (artists must create a
free account to apply). The source_url and application_url both point to the
CuratorSpace detail page; there is no external application form unless the
organizer has linked out within their description.

Scope: "international" — CuratorSpace is UK-based, serves EU/UK primarily,
but accepts worldwide submissions and lists opportunities across many countries.

Crawl strategy — two phases, static HTML (no Playwright required):

  Phase 1 — Paginated index:
    Base URL: https://www.curatorspace.com/opportunities
    Page N URL: https://www.curatorspace.com/opportunities/index/page/{N}?orderBy=deadline
    Each page renders 10 <li class="media list-group-item opportunity"> elements.
    Pagination shows all page numbers; last page is detected when the "next »"
    link is disabled. Typically ~10 pages / ~95 active listings.

    Each listing has:
      <a href="/opportunities/detail/{slug}/{id}">  — detail page path
      <h4 class="media-heading">                    — title
      <strong>Deadline: DD/MM/YYYY</strong>          — deadline (index-level)
      <a href="/profiles/OrgName">OrgName</a>        — organizer (may be absent)
      <p class="description">                        — short teaser text

  Phase 2 — Detail pages (one per listing):
    <h2> inside .c-opportunity-details__output      — authoritative title
    <strong>Deadline: DD/MM/YYYY</strong>            — date (same as index)
    <li>Deadline to apply: DD Month YYYY, HH:MM TZ</li>  — human-readable form
    <p class="details"><small><a href="/profiles/...">OrgName</a></small></p>
    <div id="details"> .tab-pane                    — full description (HTML)
    External links in description body              — application_url if present
    No structured fee or eligibility fields; extracted via regex from body text.

Type inference:
  CuratorSpace has no machine-readable type field on the listing card. Call type
  is inferred from title/description keywords. Default is "submission" since the
  vast majority of CuratorSpace opportunities are open calls for exhibition
  submissions.

  Residency keywords: residency, resident artist, studio residency, art colony
  Grant keywords: grant, award, prize, bursary, fund
  Fellowship keywords: fellowship, fellow
  Commission keywords: commission
  Exhibition proposal keywords: exhibition proposal, curatorial proposal

Fee extraction:
  Fees are mentioned inconsistently in free-text descriptions. We scan for
  common fee patterns (e.g. "£20 per artwork", "€40 entry fee") and store the
  raw string in metadata.fee_raw. The fee column is left None — CuratorSpace
  fees are multi-currency and often conditional (e.g. "only if selected").

Rate limiting:
  1.0s between detail page fetches. Index pages are fetched without delay since
  they're fast. With ~95 listings, a full run takes ~2 minutes.
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.curatorspace.com"
INDEX_URL = "https://www.curatorspace.com/opportunities"
# Pages after the first use this pattern; page 1 is just INDEX_URL
_PAGE_URL = "https://www.curatorspace.com/opportunities/index/page/{page}?orderBy=deadline"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Seconds between detail page fetches — CuratorSpace is a small UK nonprofit
_DETAIL_DELAY = 1.0

# Safety cap — raise only if CuratorSpace grows significantly past 200 listings
_MAX_LISTINGS = 300

_REQUEST_TIMEOUT = 30


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": BASE_URL + "/",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("CuratorSpace: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Ensure href is absolute."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# Index page uses DD/MM/YYYY — e.g. "Deadline: 24/03/2026"
_INDEX_DEADLINE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")

# Detail page <li> uses "DD Month YYYY, HH:MM TZ"
# e.g. "Deadline to apply: 24 March 2026, 23:59 GMT"
_DETAIL_DEADLINE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(january|february|march|april|may|june|july|august|september|october|november|december)"
    r"\s+(\d{4})",
    re.I,
)

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


def _parse_index_deadline(text: str) -> Optional[str]:
    """
    Parse a DD/MM/YYYY deadline string into ISO format.

    Returns "YYYY-MM-DD" or None if no match.
    """
    m = _INDEX_DEADLINE_RE.search(text)
    if not m:
        return None
    try:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        datetime(year, month, day)  # validate
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _parse_detail_deadline(text: str) -> Optional[str]:
    """
    Parse a "DD Month YYYY" deadline from detail page body text.

    Returns "YYYY-MM-DD" or None if no match.
    """
    m = _DETAIL_DEADLINE_RE.search(text)
    if not m:
        return None
    try:
        day = int(m.group(1))
        month = _MONTH_MAP.get(m.group(2).lower(), 0)
        year = int(m.group(3))
        if not month:
            return None
        datetime(year, month, day)  # validate
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
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

# Ordered by specificity — first match wins
_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bresidenc(?:y|ies)\b|\bresident\s+artist\b|\bstudio\s+residency\b|\bart\s+colony\b", re.I), "residency"),
    (re.compile(r"\bfellowship\b|\bfellow\b", re.I), "fellowship"),
    (re.compile(r"\bcommission(?:ed|s)?\b", re.I), "commission"),
    (re.compile(r"\bgrant\b|\baward\b|\bprize\b|\bbursary\b|\bfund(?:ing)?\b", re.I), "grant"),
    (re.compile(r"\bexhibition\s+proposal\b|\bcuratorial\s+proposal\b|\bproposal\s+for\s+exhibition\b", re.I), "exhibition_proposal"),
]

_DEFAULT_TYPE = "submission"


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from title and description text.

    Checks title first (higher signal), then description. Falls back to
    "submission" which covers the majority of CuratorSpace listings (open
    calls for artwork submissions, portfolio reviews, exhibition slots).
    """
    combined = f"{title} {description[:500]}"  # description prefix is enough
    for pattern, call_type in _TYPE_RULES:
        if pattern.search(combined):
            return call_type
    return _DEFAULT_TYPE


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------

# Regex patterns for common fee mentions in body text
_FEE_RE = re.compile(
    r"(?:"
    r"(?:entry|application|submission|participation)\s+fee\s*[:\-–]?\s*([^\n]{1,80})"
    r"|"
    r"(?:£|€|\$|GBP|EUR|USD)\s*(\d+(?:\.\d{2})?)"
    r")",
    re.I,
)

# Phrases indicating free entry
_FREE_RE = re.compile(r"\bfree\s+to\s+(?:apply|enter|submit)\b|\bno\s+(?:entry|application)\s+fee\b", re.I)


def _extract_fee_raw(body_text: str) -> Optional[str]:
    """
    Extract a raw fee string from the opportunity body text.

    Returns a short description string (e.g. "£20 per artwork") or None.
    We store this in metadata only — no numeric fee column because
    CuratorSpace fees are often conditional ("only if selected"), multi-tier,
    or multi-currency.
    """
    if _FREE_RE.search(body_text):
        return "free"
    m = _FEE_RE.search(body_text)
    if m:
        raw = (m.group(1) or m.group(2) or "").strip().rstrip(".")
        return raw[:100] if raw else None
    return None


# ---------------------------------------------------------------------------
# Eligibility extraction
# ---------------------------------------------------------------------------

_ELIG_RE = re.compile(
    r"(?:"
    r"(?:who\s+can\s+apply|eligibility)\s*[:\-–]\s*"  # requires colon/dash
    r"|open\s+to\s*[:\-–]?\s*"                         # "Open to:" or "Open to "
    r"|this\s+call\s+is\s+open\s+to\s+"               # inline phrase
    r")"
    r"([^\n]{10,300})",
    re.I,
)


def _extract_eligibility(body_text: str) -> Optional[str]:
    """
    Extract an eligibility string from body text.

    Returns the first matching sentence or None.
    """
    m = _ELIG_RE.search(body_text)
    if not m:
        return None
    text = m.group(1).strip()
    # Trim at sentence boundary
    for sep in [".", "\n"]:
        idx = text.find(sep)
        if 0 < idx < 250:
            text = text[:idx].strip()
            break
    return text[:250] if text else None


# ---------------------------------------------------------------------------
# Phase 1: index page parser
# ---------------------------------------------------------------------------


def _parse_last_page(soup: BeautifulSoup) -> int:
    """
    Extract the last page number from the pagination widget.

    The "last page" (»») link's href always contains the last page number.
    Returns 1 if no pagination is found (single page of results).
    """
    pager = soup.find("ul", class_="pagination")
    if not pager:
        return 1
    # The "»" link is always the absolute last <li><a>
    links = pager.find_all("a", href=True)
    if not links:
        return 1
    # "»" link is the last one; its href is /opportunities/index/page/N?orderBy=deadline
    last_href = links[-1]["href"]
    m = re.search(r"/page/(\d+)", last_href)
    if m:
        return int(m.group(1))
    return 1


def _is_last_page(soup: BeautifulSoup, current_page: int) -> bool:
    """
    Return True when we're on the last results page.

    Detected by the "next page (>)" link being disabled or the active page
    matching the last page number.
    """
    pager = soup.find("ul", class_="pagination")
    if not pager:
        return True
    # ">" (next page) li becomes disabled on the last page
    for li in pager.find_all("li"):
        a = li.find("a")
        if a and a.get_text(strip=True) == ">":
            if "disabled" in " ".join(li.get("class", [])):
                return True
    # Fallback: active page == last page number
    last = _parse_last_page(soup)
    return current_page >= last


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one page of the CuratorSpace opportunities index.

    Returns a list of dicts with keys:
      detail_url, title, index_deadline, org_name, teaser
    """
    soup = BeautifulSoup(html, "html.parser")
    items = soup.find_all("li", class_="media list-group-item opportunity")
    listings: list[dict] = []

    for item in items:
        # --- Detail URL (first <a> with /opportunities/detail/ path) ---
        link = item.find("a", href=lambda h: h and "/opportunities/detail/" in h)
        if not link:
            continue
        detail_url = _resolve_url(link["href"])

        # --- Title ---
        h4 = item.find("h4", class_="media-heading")
        title = h4.get_text(strip=True) if h4 else ""
        if not title:
            continue

        # --- Index-level deadline (DD/MM/YYYY) ---
        strong = item.find("strong")
        index_deadline = _parse_index_deadline(strong.get_text(strip=True)) if strong else None

        # --- Organizer (may not have a /profiles/ link) ---
        org_link = item.find("a", href=lambda h: h and "/profiles/" in h)
        org_name = org_link.get_text(strip=True) if org_link else ""

        # --- Short teaser description ---
        teaser = item.find("p", class_="description")
        teaser_text = teaser.get_text(strip=True) if teaser else ""

        listings.append(
            {
                "detail_url": detail_url,
                "title": title,
                "index_deadline": index_deadline,
                "org_name": org_name,
                "teaser": teaser_text,
            }
        )

    return listings


# ---------------------------------------------------------------------------
# Phase 2: detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str) -> dict:
    """
    Parse a CuratorSpace opportunity detail page.

    Returns a dict with keys:
      title, deadline, description, application_url, org_name, fee_raw,
      eligibility
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Title (authoritative; may differ from index heading) ---
    output_div = soup.find("div", class_="c-opportunity-details__output")
    h2 = output_div.find("h2") if output_div else soup.find("h2")
    title = h2.get_text(strip=True) if h2 else ""

    # --- Deadline ---
    # Prefer the <li> "Deadline to apply: DD Month YYYY" (human-readable, precise)
    # Fall back to the <strong>Deadline: DD/MM/YYYY</strong> in the output div
    deadline: Optional[str] = None
    for li in soup.find_all("li"):
        txt = li.get_text(strip=True)
        if txt.lower().startswith("deadline to apply"):
            deadline = _parse_detail_deadline(txt)
            break
    if not deadline and output_div:
        strong = output_div.find("strong")
        if strong:
            deadline = _parse_index_deadline(strong.get_text(strip=True))

    # --- Organizer ---
    org_name = ""
    details_p = output_div.find("p", class_="details") if output_div else None
    if details_p:
        org_link = details_p.find("a", href=lambda h: h and "/profiles/" in h)
        if org_link:
            org_name = org_link.get_text(strip=True)
    if not org_name and details_p:
        # Sometimes org name is plain text without a profile link
        org_name = details_p.get_text(strip=True).strip()

    # --- Full description from the #details tab ---
    desc_div = soup.find("div", id="details")
    description: Optional[str] = None
    if desc_div:
        raw = desc_div.get_text(separator="\n", strip=True)
        if raw:
            description = raw[:3000] if len(raw) > 3000 else raw

    body_text = description or ""

    # --- Application URL ---
    # CuratorSpace submissions go through their platform by default.
    # Some organizers link out to an external site within the description body.
    # We prefer external URLs if present; otherwise use the CuratorSpace detail page.
    application_url = source_url
    if desc_div:
        for a in desc_div.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http") and "curatorspace.com" not in href:
                application_url = href
                break

    # --- Fee raw string ---
    fee_raw = _extract_fee_raw(body_text)

    # --- Eligibility ---
    eligibility = _extract_eligibility(body_text)

    return {
        "title": title,
        "deadline": deadline,
        "description": description,
        "application_url": application_url,
        "org_name": org_name,
        "fee_raw": fee_raw,
        "eligibility": eligibility,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the CuratorSpace open calls listing.

    Strategy:
      1. Page through the opportunities index (10 listings/page, sorted by
         deadline ascending). Collect all active listings' detail URLs.
      2. Skip any listing whose index-level deadline has already passed
         (fast path — avoids fetching expired detail pages).
      3. Fetch each detail page for full description, authoritative deadline,
         application URL, organizer name, fee mentions, and eligibility.
      4. Infer call_type from title + description keywords.
      5. Insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # -----------------------------------------------------------------------
    # Phase 1: collect all listings from the paginated index
    # -----------------------------------------------------------------------
    all_listings: list[dict] = []
    page = 1

    while True:
        url = INDEX_URL if page == 1 else _PAGE_URL.format(page=page)
        logger.debug("CuratorSpace: fetching index page %d — %s", page, url)

        html = _fetch(url, session)
        if not html:
            logger.error("CuratorSpace: failed to fetch index page %d — stopping", page)
            break

        soup = BeautifulSoup(html, "html.parser")
        page_listings = _parse_index_page(html)
        all_listings.extend(page_listings)
        logger.debug("CuratorSpace: page %d — %d listings", page, len(page_listings))

        if not page_listings or _is_last_page(soup, page):
            break

        if len(all_listings) >= _MAX_LISTINGS:
            logger.warning(
                "CuratorSpace: hit safety cap of %d listings at page %d",
                _MAX_LISTINGS,
                page,
            )
            break

        page += 1

    logger.info("CuratorSpace: %d total listings found across %d pages", len(all_listings), page)

    if not all_listings:
        logger.warning(
            "CuratorSpace: no listings found — check if site structure has changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert
    # -----------------------------------------------------------------------
    skipped_deadline = 0

    for i, listing in enumerate(all_listings):
        title = listing["title"]
        detail_url = listing["detail_url"]
        index_deadline = listing["index_deadline"]
        org_name = listing["org_name"]
        teaser = listing["teaser"]

        # Fast-path deadline check from index data before paying for a detail fetch
        if _is_past_deadline(index_deadline):
            skipped_deadline += 1
            logger.debug(
                "CuratorSpace: skipping %r — index deadline %s passed",
                title[:60],
                index_deadline,
            )
            continue

        # Polite delay before every detail fetch (skip for first request)
        if i > 0:
            time.sleep(_DETAIL_DELAY)

        detail_html = _fetch(detail_url, session)
        if not detail_html:
            logger.warning(
                "CuratorSpace: could not fetch detail page for %r — skipping", title[:60]
            )
            continue

        detail = _parse_detail_page(detail_html, detail_url)

        # Authoritative deadline from detail page; fall back to index value
        deadline = detail["deadline"] or index_deadline

        # Post-fetch deadline guard
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "CuratorSpace: skipping %r — detail deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        # Use detail title if richer; fall back to index title
        final_title = detail["title"] or title
        final_org = detail["org_name"] or org_name or "curatorspace"

        # Use teaser as description fallback when detail body is empty
        description = detail["description"] or teaser or None

        call_type = _infer_call_type(final_title, description or "")

        eligibility = detail["eligibility"]
        # Many CuratorSpace calls are explicitly worldwide — set a default
        if not eligibility:
            eligibility = "International — open worldwide unless stated otherwise"

        application_url = detail["application_url"]
        fee_raw = detail["fee_raw"]

        # Org slug for dedup key generation
        org_slug = re.sub(r"[^a-z0-9]+", "-", final_org.lower()).strip("-")[:40]

        call_data: dict = {
            "title": final_title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": None,  # No structured numeric fee — conditional/multi-currency
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": {
                "source": "curatorspace",
                "organization": final_org,
                "scope": "international",
                "fee_raw": fee_raw,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "CuratorSpace: inserted/updated %r (deadline=%s, type=%s, org=%s)",
                final_title[:60],
                deadline,
                call_type,
                final_org[:40],
            )

    if skipped_deadline:
        logger.info("CuratorSpace: skipped %d past-deadline listings", skipped_deadline)

    logger.info(
        "CuratorSpace: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
