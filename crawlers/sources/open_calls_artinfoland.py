"""
Crawler for ArtInfoLand (artinfoland.com/opportunities/) open calls.

ArtInfoLand is an Australia-based international aggregator listing ~410 active
artist opportunities: grants, residencies, fellowships, scholarships, exhibitions,
competitions, and open calls across all disciplines (painting, sculpture,
photography, digital art, performance, dance, music). The site runs on WordPress
with a custom "tayebi" theme.

This is NOT a primary source — ArtInfoLand aggregates calls posted by arts
organizations worldwide — so confidence_tier is "aggregated".

Crawl strategy — two-phase (index + detail), static HTML only:

  Phase 1 — Paginated index:
    Base URL: https://artinfoland.com/opportunities/
    Page N URL: https://artinfoland.com/opportunities/page/{N}/
    Each page lists ~9 calls as <div class="opp-item"> cards.
    Pagination: <link rel="next"> in <head> signals another page exists.
    Safety cap: MAX_PAGES = 60 (site currently ~46 pages).

    Each card contains:
      <a class="text-decoration-none" href="DETAIL_URL">  — direct detail link
        <h3>Title</h3>                                     — title
      </a>
      <div class="fw-bold text-dark">YYYY/MM/DD</div>      — index deadline
      <div class="text-sm text-secondary">Country</div>    — location
      <span class="badge bg-success bg-opacity-10">Free Entry</span>  — fee flag
      <span class="badge">Tag1</span>...                   — discipline tags

  Phase 2 — Detail pages:
    Each detail page has:
      <h1 class="opp-title">Title</h1>             — authoritative title
      JSON-LD <script type="application/ld+json">   — endDate = deadline (YYYY/MM/DD)
      Breadcrumb item [2] from @graph BreadcrumbList — canonical type (Grant/Residency/etc.)
      <a class="btn">Visit Official Website</a>      — external application URL
      Full body text for description and eligibility extraction

    The JSON-LD Event schema on detail pages is the most reliable source for
    deadline (endDate) and type (via breadcrumb). The index-level deadline
    (YYYY/MM/DD) is used for the fast-path expiry check to avoid fetching
    detail pages for expired calls.

Fee extraction:
  - "Free Entry" badge on index card → fee = 0.0
  - "Fee: $N" pattern in detail page text → fee = N (USD only)
  - No badge and no fee text → fee = None (unknown)

Call type mapping (from breadcrumb position 2 URL slug /opp-type/TYPE/):
  grant         → grant
  residency     → residency
  fellowship    → fellowship
  scholarship   → grant (scholarships are a form of grant funding)
  open-call     → submission
  competition   → submission
  exhibition    → exhibition_proposal
  commission    → commission
  award         → grant
  prize         → grant
  (anything else) → inferred from title/description keywords

Rate limiting:
  0.5s between detail page fetches. Index pages have no added delay (fast).
  With ~410 listings, a full run takes roughly 3–4 minutes.

Note on locked listings:
  ArtInfoLand has a membership tier. Some calls are partially locked for
  non-members. The public description (from og:description or visible body text)
  is still extractable and sufficient for our purposes. We do not require login.
"""

import json
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

BASE_URL = "https://artinfoland.com"
INDEX_URL = "https://artinfoland.com/opportunities/"
_PAGE_URL = "https://artinfoland.com/opportunities/page/{page}/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Safety ceiling — site has ~46 pages at ~9 listings/page
MAX_PAGES = 60

# Polite delay between detail page fetches (seconds)
DETAIL_DELAY = 0.5

REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Call type mapping (from ArtInfoLand breadcrumb /opp-type/ slug)
# ---------------------------------------------------------------------------

# Breadcrumb position [2] gives us the canonical type URL like
# https://artinfoland.com/opp-type/grant/
# We extract the slug from that URL.
_BREADCRUMB_TYPE_MAP: dict[str, str] = {
    "grant": "grant",
    "grants": "grant",
    "residency": "residency",
    "residencies": "residency",
    "fellowship": "fellowship",
    "fellowships": "fellowship",
    "scholarship": "grant",  # scholarships are grant-type funding
    "scholarships": "grant",
    "open-call": "submission",
    "open-calls": "submission",
    "competition": "submission",
    "competitions": "submission",
    "exhibition": "exhibition_proposal",
    "exhibitions": "exhibition_proposal",
    "commission": "commission",
    "commissions": "commission",
    "award": "grant",
    "awards": "grant",
    "prize": "grant",
    "prizes": "grant",
}

# Keyword-based type inference for fallback
_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"\bresidenc(?:y|ies)\b|\bresident\s+artist\b|\bart\s+colony\b", re.I
        ),
        "residency",
    ),
    (re.compile(r"\bfellowship\b|\bfellow\b", re.I), "fellowship"),
    (
        re.compile(
            r"\bcommission(?:ed|s|ing)?\b|\bRFP\b|\bRFQ\b|\bpublic\s+art\s+(?:project|proposal)\b",
            re.I,
        ),
        "commission",
    ),
    (
        re.compile(
            r"\bgrant\b|\baward\b|\bprize\b|\bbursary\b|\bscholarship\b|\bstipend\b|\bfund(?:ing)?\b",
            re.I,
        ),
        "grant",
    ),
    (
        re.compile(
            r"\bexhibition\s+proposal\b|\bcuratorial\s+proposal\b|\bopen\s+call\s+for\s+(?:exhibition|curator)",
            re.I,
        ),
        "exhibition_proposal",
    ),
]

_DEFAULT_TYPE = "submission"


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from title + description keywords.
    Used when breadcrumb type is absent or unknown.
    """
    combined = f"{title} {description[:500]}"
    for pattern, call_type in _TYPE_RULES:
        if pattern.search(combined):
            return call_type
    return _DEFAULT_TYPE


def _classify_type_from_breadcrumb(breadcrumb_url: Optional[str]) -> Optional[str]:
    """
    Extract call_type from an /opp-type/ breadcrumb URL.

    e.g. "https://artinfoland.com/opp-type/grant/" → "grant"

    Returns None if the URL doesn't match or the slug is unknown.
    """
    if not breadcrumb_url:
        return None
    m = re.search(r"/opp-type/([^/]+)/?", breadcrumb_url)
    if not m:
        return None
    slug = m.group(1).lower()
    return _BREADCRUMB_TYPE_MAP.get(slug)


# ---------------------------------------------------------------------------
# Deadline helpers
# ---------------------------------------------------------------------------

# Index card deadline format: YYYY/MM/DD
_INDEX_DEADLINE_RE = re.compile(r"(\d{4})/(\d{2})/(\d{2})")


def _parse_index_deadline(text: str) -> Optional[str]:
    """Parse YYYY/MM/DD into ISO YYYY-MM-DD, or None."""
    m = _INDEX_DEADLINE_RE.search(text)
    if not m:
        return None
    try:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        datetime(year, month, day)  # validate
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_str:
        return False
    try:
        dl = date.fromisoformat(deadline_str)
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": INDEX_URL,
        }
    )
    return session


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch URL, return HTML text or None on error."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ArtInfoLand: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Phase 1: index page parsing
# ---------------------------------------------------------------------------


def _has_next_page(soup: BeautifulSoup) -> bool:
    """Check if a next page exists via <link rel='next'> in <head>."""
    link = soup.find("link", rel="next")
    return link is not None and bool(link.get("href"))


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one ArtInfoLand opportunities listing page.

    Returns a list of dicts with keys:
      detail_url, title, index_deadline, is_free, tags
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    for card in soup.find_all("div", class_="opp-item"):
        # --- Detail URL and title from the <a class="text-decoration-none"> ---
        link_a = card.find("a", class_="text-decoration-none")
        if not link_a:
            continue
        detail_url = link_a.get("href", "").strip()
        if not detail_url or "artinfoland.com" not in detail_url:
            continue
        # Strip login-redirect URLs (should already be direct via text-decoration-none)
        if "art-admin-panel" in detail_url:
            continue

        h3 = link_a.find("h3")
        title = h3.get_text(strip=True) if h3 else link_a.get_text(strip=True)
        if not title:
            continue

        # --- Index-level deadline (YYYY/MM/DD in a fw-bold div) ---
        index_deadline: Optional[str] = None
        for div in card.find_all("div", class_=True):
            cls_str = " ".join(div.get("class", []))
            if "fw-bold" in cls_str and "text-dark" in cls_str:
                text = div.get_text(strip=True)
                parsed = _parse_index_deadline(text)
                if parsed:
                    index_deadline = parsed
                    break

        # --- Fee: "Free Entry" badge indicates no application fee ---
        is_free = any("Free Entry" in span.get_text() for span in card.find_all("span"))

        # --- Discipline/keyword tags ---
        tags: list[str] = []
        for span in card.find_all("span", class_="badge"):
            tag_text = span.get_text(strip=True)
            if tag_text and tag_text != "Free Entry" and "Fee:" not in tag_text:
                tags.append(tag_text)

        listings.append(
            {
                "detail_url": detail_url,
                "title": title,
                "index_deadline": index_deadline,
                "is_free": is_free,
                "tags": tags,
            }
        )

    return listings


# ---------------------------------------------------------------------------
# Phase 2: detail page parsing
# ---------------------------------------------------------------------------


def _extract_json_ld_event(soup: BeautifulSoup) -> dict:
    """
    Extract the Event JSON-LD from the detail page.

    Returns a dict with whatever fields are present, empty dict on failure.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except (ValueError, TypeError):
            continue
        if isinstance(data, dict) and data.get("@type") == "Event":
            return data
    return {}


def _extract_breadcrumb_type_url(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract the /opp-type/ URL from the breadcrumb JSON-LD.

    The breadcrumb's item[2] (0-indexed) is the opportunity type category page.
    Returns the URL string or None.
    """
    for script in soup.find_all("script", type="application/ld+json"):
        if not script.string:
            continue
        try:
            data = json.loads(script.string)
        except (ValueError, TypeError):
            continue

        # Rank Math may embed @graph or a plain BreadcrumbList
        if isinstance(data, dict):
            graph = data.get("@graph")
            if graph:
                for node in graph:
                    if isinstance(node, dict) and node.get("@type") == "BreadcrumbList":
                        items = node.get("itemListElement", [])
                        # Position 3 (1-indexed) is the type page
                        if len(items) >= 3:
                            type_item = items[2]
                            return type_item.get("item", {}).get("@id")
            elif data.get("@type") == "BreadcrumbList":
                items = data.get("itemListElement", [])
                if len(items) >= 3:
                    type_item = items[2]
                    return type_item.get("item", {}).get("@id")
    return None


def _extract_application_url(soup: BeautifulSoup, source_url: str) -> str:
    """
    Extract the best application URL from a detail page.

    Priority:
      1. "Visit Official Website" button — the canonical external apply link
      2. Any external <a> in the main body whose text contains apply keywords
      3. First external link in body (excluding social media)
      4. Fallback: source_url (ArtInfoLand detail page)

    Excludes social media links and internal artinfoland.com links.
    """
    _SOCIAL_DOMAINS = {
        "twitter.com",
        "instagram.com",
        "facebook.com",
        "linkedin.com",
        "youtube.com",
    }
    _APPLY_TEXT_RE = re.compile(
        r"\b(?:visit\s+official\s+website|apply\s+(?:here|now|online)|application\s+form|"
        r"submit\s+(?:here|online|now)|official\s+website|apply)\b",
        re.I,
    )

    # Collect all qualifying external links from the body
    main = soup.find("main") or soup
    candidates: list[tuple[str, str]] = []  # (href, link_text)

    for a in main.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href.startswith("http"):
            continue
        if "artinfoland.com" in href:
            continue
        if any(domain in href for domain in _SOCIAL_DOMAINS):
            continue
        if "/art-admin-panel/" in href:
            continue
        text = a.get_text(strip=True)
        candidates.append((href, text))

    if not candidates:
        return source_url

    # Priority 1: "Visit Official Website" or similar apply-text buttons
    for href, text in candidates:
        if _APPLY_TEXT_RE.search(text):
            return href

    # Priority 2: first remaining external link
    return candidates[0][0]


def _extract_description(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract the full opportunity description from the detail page.

    ArtInfoLand structures description in paragraphs within the main content
    area. Some calls are partially locked (blurred), but the visible text is
    still extractable and usable.
    """
    main = soup.find("main") or soup.find("body") or soup

    # Skip boilerplate sections we know about
    _SKIP_RE = re.compile(
        r"^(?:sign\s+in|sign\s+up|home|opportunities|organize|art\s+events|"
        r"magazine|membership|submit\s+open\s+call|more\s+opportunities|"
        r"follow\s+us|subscribe|newsletter|all\s+rights\s+reserved|"
        r"artinfoland\.com)",
        re.I,
    )

    paras = []
    for p in main.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        if not text or len(text) < 30:
            continue
        if _SKIP_RE.match(text):
            continue
        paras.append(text)

    description = "\n\n".join(paras)
    if len(description) > 3000:
        description = description[:2997] + "..."
    return description.strip() or None


_ELIG_RE = re.compile(
    r"""
    (?:
        eligibility\s*[:\-–] |
        who\s+can\s+apply\s*[:\-–]? |
        who\s+is\s+eligible\s*[:\-–]? |
        open\s+to\s*[:\-–]? |
        (?:the\s+)?(?:call|programme|program|residency)\s+is\s+open\s+to |
        applicants?\s+must\s+be
    )
    \s*
    ([^\n]{15,300})
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_eligibility(body_text: str) -> Optional[str]:
    """Extract a short eligibility string from the body text."""
    m = _ELIG_RE.search(body_text)
    if not m:
        return None
    text = m.group(1).strip()
    for sep in [".", "\n"]:
        idx = text.find(sep)
        if 0 < idx < 250:
            text = text[:idx].strip()
            break
    return text[:250] if text else None


_FEE_NUMERIC_RE = re.compile(
    r"Fee\s*[:\-–]?\s*\$\s*(\d+(?:\.\d{2})?)"
    r"|Fee\s*[:\-–]?\s*USD\s*(\d+(?:\.\d{2})?)"
    r"|entry\s+fee\s*[:\-–]?\s*\$\s*(\d+(?:\.\d{2})?)",
    re.I,
)


def _extract_fee(soup: BeautifulSoup, is_free_from_index: bool) -> Optional[float]:
    """
    Determine the application fee.

    - is_free_from_index=True → 0.0 (confirmed free at index level)
    - "Fee: $N" or "Fee: USD N" pattern in page text → N (USD only)
    - Otherwise → None (unknown / multi-currency / conditional)
    """
    if is_free_from_index:
        return 0.0

    # Check page text for a USD fee amount
    page_text = soup.get_text(separator=" ", strip=True)
    m = _FEE_NUMERIC_RE.search(page_text)
    if m:
        raw = m.group(1) or m.group(2) or m.group(3)
        if raw:
            try:
                return float(raw)
            except (TypeError, ValueError):
                pass

    return None


def _parse_detail_page(html: str, source_url: str, is_free_from_index: bool) -> dict:
    """
    Parse a single ArtInfoLand opportunity detail page.

    Returns a dict with:
      title, deadline, call_type_url, description, application_url,
      eligibility, fee, location, keywords
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Title (authoritative) ---
    h1 = soup.find("h1", class_="opp-title")
    title = h1.get_text(strip=True) if h1 else ""

    # --- JSON-LD Event (deadline + location + keywords) ---
    event_ld = _extract_json_ld_event(soup)
    deadline: Optional[str] = None
    end_date_raw = event_ld.get("endDate", "")
    if end_date_raw:
        deadline = _parse_index_deadline(str(end_date_raw))

    location_name: str = ""
    loc = event_ld.get("location")
    if isinstance(loc, dict):
        location_name = loc.get("name") or loc.get("address") or ""
    keywords_str: str = event_ld.get("keywords", "")

    # --- Call type from breadcrumb ---
    type_url = _extract_breadcrumb_type_url(soup)

    # --- Application URL ---
    application_url = _extract_application_url(soup, source_url)

    # --- Description ---
    description = _extract_description(soup)

    # --- Eligibility ---
    body_text = soup.get_text(separator="\n", strip=True)
    eligibility = _extract_eligibility(body_text)

    # --- Fee ---
    fee = _extract_fee(soup, is_free_from_index)

    return {
        "title": title,
        "deadline": deadline,
        "call_type_url": type_url,
        "description": description,
        "application_url": application_url,
        "eligibility": eligibility,
        "fee": fee,
        "location_name": location_name,
        "keywords": keywords_str,
    }


# ---------------------------------------------------------------------------
# Org name extraction from URL slug
# ---------------------------------------------------------------------------


def _org_slug_from_url(detail_url: str) -> str:
    """
    Derive a short org slug from the opportunity's URL slug for dedup keying.

    e.g. "https://artinfoland.com/opportunities/anna-polke-foundation-scholarships-2026/"
         → "anna-polke-foundation"  (first 3 hyphen-parts)
    """
    m = re.search(r"/opportunities/([^/]+)/?$", detail_url)
    if not m:
        return "artinfoland"
    slug = m.group(1)
    # Take first 3 dash-separated parts as org identifier
    parts = slug.split("-")
    org_parts = parts[:3] if len(parts) >= 3 else parts
    return "-".join(org_parts)[:40]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtInfoLand open calls listing.

    Strategy:
      Phase 1: Page through the opportunities index (9 listings/page) collecting
               all active listing cards. Use the index-level deadline for a fast
               expired-call filter before paying for detail fetches.
      Phase 2: Fetch each detail page for authoritative deadline, full description,
               application URL, and call type from breadcrumb.
      Filter:  Skip calls whose deadline has passed (checked at both phases).
      Insert:  Pass each eligible call to insert_open_call().

    Returns (found, new, updated).
      found   = calls that passed deadline filter and were eligible to insert
      new     = successfully inserted/updated rows returned by insert_open_call()
      updated = always 0 (insert_open_call handles content-hash dedup transparently)
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()
    seen_urls: set[str] = set()

    # -----------------------------------------------------------------------
    # Phase 1: Collect all listings from index pages
    # -----------------------------------------------------------------------

    all_listings: list[dict] = []
    page = 1

    while page <= MAX_PAGES:
        url = INDEX_URL if page == 1 else _PAGE_URL.format(page=page)
        logger.debug("ArtInfoLand: fetching index page %d — %s", page, url)

        html = _fetch(session, url)
        if not html:
            logger.error("ArtInfoLand: failed to fetch index page %d — stopping", page)
            break

        soup = BeautifulSoup(html, "html.parser")
        listings = _parse_index_page(html)

        if not listings:
            logger.info(
                "ArtInfoLand: page %d returned 0 listings — index crawl complete",
                page,
            )
            break

        for listing in listings:
            url_key = listing["detail_url"]
            if url_key in seen_urls:
                continue
            seen_urls.add(url_key)
            all_listings.append(listing)

        logger.debug(
            "ArtInfoLand: index page %d — %d listings (total so far: %d)",
            page,
            len(listings),
            len(all_listings),
        )

        if not _has_next_page(soup):
            logger.info(
                "ArtInfoLand: no next-page link after page %d — index crawl done",
                page,
            )
            break

        page += 1

    logger.info("ArtInfoLand: collected %d unique listings", len(all_listings))

    if not all_listings:
        logger.warning(
            "ArtInfoLand: no listings found — check if site structure has changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: Fetch detail pages and insert
    # -----------------------------------------------------------------------

    skipped_deadline = 0
    skipped_no_title = 0
    detail_errors = 0

    for i, listing in enumerate(all_listings):
        detail_url = listing["detail_url"]
        index_title = listing["title"]
        index_deadline = listing["index_deadline"]
        is_free = listing["is_free"]
        tags = listing["tags"]

        # Fast-path expiry check: skip detail fetch for already-expired calls
        if _is_past_deadline(index_deadline):
            skipped_deadline += 1
            logger.debug(
                "ArtInfoLand: skipping %r — index deadline %s passed",
                index_title[:60],
                index_deadline,
            )
            continue

        # Polite delay between detail fetches
        if i > 0:
            time.sleep(DETAIL_DELAY)

        detail_html = _fetch(session, detail_url)
        if not detail_html:
            detail_errors += 1
            logger.warning(
                "ArtInfoLand: could not fetch detail page for %r — skipping",
                index_title[:60],
            )
            continue

        detail = _parse_detail_page(detail_html, detail_url, is_free)

        # Use detail title if we got one, fall back to index title
        final_title = detail.get("title") or index_title
        if not final_title:
            skipped_no_title += 1
            logger.debug("ArtInfoLand: skipping %s — no title", detail_url)
            continue

        # Deadline: prefer the detail page value (from JSON-LD), fall back to index
        deadline = detail.get("deadline") or index_deadline

        # Post-fetch deadline guard (detail may have corrected a date)
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "ArtInfoLand: skipping %r — detail deadline %s passed",
                final_title[:60],
                deadline,
            )
            continue

        # Call type: prefer breadcrumb classification
        call_type_url = detail.get("call_type_url")
        call_type = _classify_type_from_breadcrumb(call_type_url)
        if not call_type:
            # Fall back to keyword inference from title + description
            call_type = _infer_call_type(
                final_title, detail.get("description") or " ".join(tags)
            )

        # Eligibility: prefer extracted text, fall back to "International"
        eligibility = detail.get("eligibility") or "International"

        # Application URL
        application_url = detail.get("application_url") or detail_url

        # Org slug for dedup key (derived from URL structure)
        org_slug = _org_slug_from_url(detail_url)

        # Location metadata
        location_name = detail.get("location_name", "")
        keywords = detail.get("keywords", "")

        found += 1

        call_data: dict = {
            "title": final_title,
            "description": detail.get("description"),
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": detail.get("fee"),
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": {
                "source": "artinfoland",
                "scope": "international",
                "location": location_name,
                "keywords": keywords,
                "tags": tags,
                "is_free": is_free,
                "breadcrumb_type_url": call_type_url,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ArtInfoLand: inserted %r (deadline=%s, type=%s)",
                final_title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("ArtInfoLand: skipped %d past-deadline listings", skipped_deadline)
    if detail_errors:
        logger.info("ArtInfoLand: %d detail page fetch errors", detail_errors)
    if skipped_no_title:
        logger.info("ArtInfoLand: skipped %d listings with no title", skipped_no_title)

    logger.info(
        "ArtInfoLand: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
