"""
Crawler for Re-Title.com artist opportunities (re-title.com/opportunities/).

Re-Title is a UK-based international contemporary art listing platform that
has curated open calls, residencies, commissions, grants, fellowships, and
prizes for artists and curators since 2007. It hand-selects ~50-100 active
listings at any time from organizations worldwide.

It is NOT the primary source for any listing — it aggregates calls posted
by arts organizations globally — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" since Re-Title is UK-based
with global coverage and serves the "National & International" section of
the Arts portal Open Calls board.

---------------------------------------------------------------------------
Site technical context
---------------------------------------------------------------------------

Re-Title is a WordPress site behind Cloudflare's bot-management layer.
The Cloudflare configuration is aggressive (IP-level blocking for automated
clients). We use cloudscraper to handle TLS fingerprinting challenges.

If the scrape is blocked (403 / Cloudflare interstitial), crawl() logs a
warning and returns (0, 0, 0) rather than erroring — the scheduler will
retry on the next weekly run.

---------------------------------------------------------------------------
Page structure — index (re-title.com/opportunities/)
---------------------------------------------------------------------------

WordPress archive page. Each listing is rendered as an <article> element:

  <article id="post-NNNN" class="post-NNNN opportunity type-opportunity ...">
    <header class="entry-header">
      <h2 class="entry-title">
        <a href="/opportunities/SLUG/">TITLE</a>
      </h2>
    </header>

    <div class="entry-content">
      <!-- Type badge — one of: Open Call, Residency, Commission,
           Grant, Fellowship, Award, Prize -->
      <p class="opportunity-type">TYPE</p>

      <!-- Short description / teaser paragraph -->
      <p>DESCRIPTION SNIPPET...</p>

      <!-- Structured metadata list -->
      <ul class="opportunity-meta">
        <li><strong>Organisation:</strong> ORG NAME</li>
        <li><strong>Location:</strong> COUNTRY / REGION</li>
        <li><strong>Deadline:</strong> DD Month YYYY</li>
        <li><strong>Fee:</strong> FEE TEXT</li>    <!-- optional -->
        <li><strong>Eligibility:</strong> TEXT</li> <!-- optional -->
      </ul>
    </div>

    <footer class="entry-footer">
      <a href="/opportunities/SLUG/" class="more-link">More Info &rarr;</a>
    </footer>
  </article>

Pagination: WordPress uses /opportunities/page/2/ etc. when more than one
page of results exists. We detect the "next page" link to know when to stop.

---------------------------------------------------------------------------
Page structure — detail page (/opportunities/SLUG/)
---------------------------------------------------------------------------

Used only for listings where the index card is missing key fields (deadline
or org name). The detail page typically repeats the same metadata list with
the addition of a direct "Apply" link:

  <ul class="opportunity-meta">
    <li><strong>Organisation:</strong> ORG NAME</li>
    <li><strong>Location:</strong> COUNTRY</li>
    <li><strong>Deadline:</strong> DD Month YYYY</li>
    <li><strong>Fee:</strong> None / £XX / FREE</li>
    <li><strong>Eligibility:</strong> TEXT</li>
    <li><strong>Website:</strong> <a href="URL">URL</a></li>
  </ul>

  <!-- Full description paragraphs: -->
  <div class="entry-content">
    <p>Full body text...</p>
    ...
  </div>

  <!-- Direct apply link (external) -->
  <a href="EXTERNAL_URL" class="apply-button" ...>Apply Now</a>
  <!-- or sometimes within the body text: -->
  <a href="EXTERNAL_URL" class="button">Apply / More Info</a>

---------------------------------------------------------------------------
Type mapping (Re-Title labels → our call_type)
---------------------------------------------------------------------------

  "Open Call"   → submission
  "Residency"   → residency
  "Commission"  → commission
  "Grant"       → grant
  "Fellowship"  → fellowship
  "Award"       → grant
  "Prize"       → grant
  "Job"         → skip  (employment; not artist opportunities)

  Unknown labels fall back to "submission".

---------------------------------------------------------------------------
Deadline format
---------------------------------------------------------------------------

  Display: "31 March 2026"  →  "2026-03-31"
           "March 31, 2026" →  "2026-03-31"   (US-style occasionally used)
           "31/03/2026"     →  "2026-03-31"   (slash fallback)

---------------------------------------------------------------------------
Fee handling
---------------------------------------------------------------------------

  "None" / "N/A" / "Free" / "No fee" → fee = 0.0
  "£20" / "€35" / "$10"              → fee = float amount; stored in metadata.fee_raw
  Compound / conditional text         → fee = None; raw text in metadata.fee_raw
  Field absent from index card        → fee = None

  The fee column stores None when a numeric value cannot be reliably extracted
  (multi-currency, conditional amounts). metadata.fee_raw always stores the
  raw string for human review.

---------------------------------------------------------------------------
Rate limiting
---------------------------------------------------------------------------

  Re-Title is a small editorial platform. We pause 1.5s between detail-page
  fetches. Index pages do not require delays (typically 1-3 pages total).
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import cloudscraper
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.re-title.com"
INDEX_URL = "https://www.re-title.com/opportunities/"
_PAGE_URL = "https://www.re-title.com/opportunities/page/{page}/"

# Polite delay between detail-page requests (seconds)
_DETAIL_DELAY = 1.5

# Safety ceiling — raise only if Re-Title grows substantially past ~150 listings
_MAX_PAGES = 10
_MAX_LISTINGS = 200

_REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Type mapping
# ---------------------------------------------------------------------------

_TYPE_MAP: dict[str, Optional[str]] = {
    "open call": "submission",
    "residency": "residency",
    "commission": "commission",
    "grant": "grant",
    "fellowship": "fellowship",
    "award": "grant",
    "prize": "grant",
    "bursary": "grant",
    "competition": "submission",
    "exhibition": "submission",
    # Skip employment listings — not artist opportunities
    "job": None,
}


def _classify_type(raw_label: str) -> Optional[str]:
    """
    Map a Re-Title type label to our call_type.

    Returns None to skip (e.g. "Job"). Unknown labels fall back to
    "submission" (safest default for unrecognized art-opportunity labels).
    """
    normalized = raw_label.strip().lower()
    if normalized in _TYPE_MAP:
        result = _TYPE_MAP[normalized]
        if result is None:
            logger.debug("Re-Title: skipping type %r", raw_label)
        return result
    # Unknown label — log and default to submission
    logger.debug("Re-Title: unknown type %r — treating as submission", raw_label)
    return "submission"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

_MONTH_MAP: dict[str, int] = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    # Abbreviated month names
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# "31 March 2026" or "31 March, 2026"
_DEADLINE_DMY = re.compile(
    r"(\d{1,2})\s+"
    r"(january|february|march|april|may|june|july|august|september|"
    r"october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)"
    r",?\s+(\d{4})",
    re.I,
)

# "March 31, 2026" or "March 31 2026"
_DEADLINE_MDY = re.compile(
    r"(january|february|march|april|may|june|july|august|september|"
    r"october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)"
    r"\s+(\d{1,2}),?\s+(\d{4})",
    re.I,
)

# "31/03/2026" or "31-03-2026"
_DEADLINE_SLASH = re.compile(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})")


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse a deadline from Re-Title display text into 'YYYY-MM-DD'.

    Tries three formats in priority order:
      1. "DD Month YYYY"  (most common on Re-Title)
      2. "Month DD, YYYY" (occasional US format)
      3. "DD/MM/YYYY"     (slash fallback)

    Returns an ISO date string or None if no parseable date is found.
    """
    if not text:
        return None

    # Format 1: "31 March 2026"
    m = _DEADLINE_DMY.search(text)
    if m:
        try:
            day = int(m.group(1))
            month = _MONTH_MAP.get(m.group(2).lower(), 0)
            year = int(m.group(3))
            if month and 2020 <= year <= 2040:
                datetime(year, month, day)  # validate
                return f"{year}-{month:02d}-{day:02d}"
        except (ValueError, TypeError):
            pass

    # Format 2: "March 31, 2026"
    m = _DEADLINE_MDY.search(text)
    if m:
        try:
            month = _MONTH_MAP.get(m.group(1).lower(), 0)
            day = int(m.group(2))
            year = int(m.group(3))
            if month and 2020 <= year <= 2040:
                datetime(year, month, day)  # validate
                return f"{year}-{month:02d}-{day:02d}"
        except (ValueError, TypeError):
            pass

    # Format 3: "31/03/2026" — assume DD/MM/YYYY (UK convention)
    m = _DEADLINE_SLASH.search(text)
    if m:
        try:
            day, month_num, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if 2020 <= year <= 2040:
                datetime(year, month_num, day)  # validate
                return f"{year}-{month_num:02d}-{day:02d}"
        except (ValueError, TypeError):
            pass

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
# Fee parsing
# ---------------------------------------------------------------------------

# "£20", "€35", "$10", "GBP 25", "USD 15", "EUR 40"
_AMOUNT_RE = re.compile(r"(?:£|€|\$|GBP\s*|EUR\s*|USD\s*)(\d+(?:\.\d{1,2})?)", re.I)

# Unambiguous "no fee" phrases
_FREE_RE = re.compile(
    r"\b(?:free|no\s+fee|no\s+cost|none|n/a|0\.00|no\s+entry\s+fee|"
    r"no\s+application\s+fee|free\s+to\s+(?:apply|enter|submit))\b",
    re.I,
)


def _parse_fee(fee_text: str) -> tuple[Optional[float], Optional[str]]:
    """
    Parse a Re-Title fee field into (numeric_fee, raw_string).

    Returns:
      (0.0,  "free")     — clearly free
      (amount, raw)      — numeric fee extracted
      (None, raw)        — fee mentioned but not reliably parseable
      (None, None)       — no fee info
    """
    if not fee_text:
        return None, None

    raw = fee_text.strip()

    if _FREE_RE.search(raw):
        return 0.0, "free"

    m = _AMOUNT_RE.search(raw)
    if m:
        try:
            amount = float(m.group(1))
            return amount, raw[:100]
        except (ValueError, TypeError):
            pass

    # Has text but no parseable amount
    return None, raw[:100]


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------

_FEE_LABEL_RE = re.compile(r"\bfee\s*:", re.I)
_ELIG_LABEL_RE = re.compile(r"\beligibility\s*:", re.I)


# ---------------------------------------------------------------------------
# Eligibility extraction from body text
# ---------------------------------------------------------------------------

_ELIG_BODY_RE = re.compile(
    r"(?:eligibility|who\s+can\s+apply|open\s+to)\s*[:\-–]\s*([^\n]{10,300})",
    re.I,
)


def _extract_eligibility_text(body_text: str) -> Optional[str]:
    """Extract eligibility from free-form body text (fallback when meta list missing)."""
    m = _ELIG_BODY_RE.search(body_text)
    if not m:
        return None
    text = m.group(1).strip()
    for sep in (".", "\n"):
        idx = text.find(sep)
        if 0 < idx < 250:
            text = text[:idx].strip()
            break
    return text[:250] if text else None


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _make_session() -> cloudscraper.CloudScraper:
    """
    Create a cloudscraper session configured for Cloudflare bypass.

    Re-Title uses Cloudflare's bot-management layer. cloudscraper handles
    TLS fingerprinting and JS challenge solving. If Re-Title's CF config
    goes beyond what cloudscraper handles (e.g. Turnstile), crawl() will
    detect the interstitial title and return early.
    """
    session = cloudscraper.create_scraper(
        browser={
            "browser": "chrome",
            "platform": "darwin",
            "desktop": True,
        }
    )
    session.headers.update(
        {
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": BASE_URL + "/",
        }
    )
    return session


def _fetch(session: cloudscraper.CloudScraper, url: str) -> Optional[str]:
    """
    Fetch a URL and return its HTML text, or None on failure / Cloudflare block.

    Detects both HTTP 4xx/5xx and Cloudflare interstitials that slip through
    with 200 status (e.g. "Just a moment..." / "Attention Required!" pages).
    """
    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        if resp.status_code == 403:
            logger.warning(
                "Re-Title: Cloudflare blocked request to %s (403) — "
                "IP may be flagged; will retry next scheduled run",
                url,
            )
            return None
        resp.raise_for_status()
        html = resp.text
        # Detect Cloudflare challenge pages that return 200
        page_title_lower = html[:1000].lower()
        if (
            "just a moment" in page_title_lower
            or "attention required" in page_title_lower
        ):
            logger.warning(
                "Re-Title: Cloudflare interstitial detected for %s — "
                "cloudscraper did not resolve the challenge",
                url,
            )
            return None
        return html
    except Exception as exc:
        logger.warning("Re-Title: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Resolve a potentially relative URL to an absolute one."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Metadata list parser
# ---------------------------------------------------------------------------


def _parse_meta_list(container) -> dict[str, str]:
    """
    Parse a Re-Title <ul class="opportunity-meta"> into {label: value}.

    The list uses <li><strong>Label:</strong> Value</li> structure.
    Also handles inline <li>Label: Value</li> without a <strong> wrapper.

    Returns a dict with normalized lowercase keys:
      "organisation", "location", "deadline", "fee", "eligibility", "website"
    """
    result: dict[str, str] = {}
    if not container:
        return result

    ul = container.find("ul", class_=re.compile(r"opportunity.?meta", re.I))
    if not ul:
        # Some detail pages use a <div class="opportunity-meta"> wrapper
        ul = container.find(class_=re.compile(r"opportunity.?meta", re.I))
    if not ul:
        return result

    for li in ul.find_all("li"):
        strong = li.find("strong")
        if strong:
            key = strong.get_text(strip=True).rstrip(":").lower()
            # Value = full li text minus the <strong> text
            full = li.get_text(separator=" ", strip=True)
            key_text = strong.get_text(strip=True)
            value = full.replace(key_text, "", 1).strip().lstrip(":").strip()
        else:
            raw = li.get_text(strip=True)
            if ":" not in raw:
                continue
            key, _, value = raw.partition(":")
            key = key.strip().lower()
            value = value.strip()

        if key and value:
            result[key] = value

    return result


# ---------------------------------------------------------------------------
# Application URL extraction
# ---------------------------------------------------------------------------

_APPLY_TEXT_RE = re.compile(
    r"^(?:apply|apply\s+now|apply\s+here|submit|more\s+info|website|external\s+link)$",
    re.I,
)


def _extract_apply_url(soup: BeautifulSoup, source_url: str) -> str:
    """
    Extract the external application URL from a Re-Title detail page.

    Priority:
      1. <a class="apply-button"> or <a class="button"> with apply/external text
      2. "Website:" value in the opportunity-meta list (often the apply target)
      3. Any external link in the entry-content body with apply-like text
      4. Fallback: the Re-Title detail page URL itself (source_url)

    Re-Title's "more-link" (.more-link) points back to the same listing page
    and is explicitly excluded.
    """
    content = soup.find(class_=re.compile(r"entry.?content", re.I))
    if not content:
        content = soup

    # Priority 1: dedicated apply/button link
    for a in content.find_all("a", href=True):
        cls = " ".join(a.get("class", []))
        href = a.get("href", "")
        if not href.startswith("http"):
            continue
        if "more-link" in cls:
            continue
        if "apply" in cls.lower() or "button" in cls.lower():
            text = a.get_text(strip=True)
            if _APPLY_TEXT_RE.match(text) or "apply" in text.lower():
                return href

    # Priority 2: any external link with apply-like text
    for a in content.find_all("a", href=True):
        href = a.get("href", "")
        if not href.startswith("http"):
            continue
        if "more-link" in " ".join(a.get("class", [])):
            continue
        if "re-title.com" in href:
            continue
        text = a.get_text(strip=True)
        if _APPLY_TEXT_RE.match(text) or any(
            kw in text.lower() for kw in ("apply", "submit", "more info", "website")
        ):
            return href

    # Priority 3: "Website:" field from meta list
    meta = _parse_meta_list(content)
    if meta.get("website"):
        website_el = content.find(string=re.compile(r"Website", re.I))
        if website_el:
            parent_li = website_el.find_parent("li")
            if parent_li:
                link = parent_li.find("a", href=True)
                if link and link["href"].startswith("http"):
                    return link["href"]

    return source_url


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one page of the Re-Title opportunities index.

    Returns a list of partial listing dicts with keys:
      title, source_url, raw_type, index_meta
      (index_meta is a dict of the meta fields extracted from the card)

    These are partial because detail pages may be needed for full description
    and application URL on listings where the index card is sparse.
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    # Re-Title renders each opportunity as a WordPress <article> element.
    # The class varies but always includes 'opportunity' as a type class.
    articles = soup.find_all("article", class_=re.compile(r"\bopportunity\b"))

    if not articles:
        # Fallback: some WordPress themes wrap in <div class="post type-opportunity">
        articles = soup.find_all(
            lambda tag: tag.name in ("article", "div")
            and "type-opportunity" in " ".join(tag.get("class", []))
        )

    for article in articles:
        # --- Title + source URL ---
        header = article.find(class_=re.compile(r"entry.?title", re.I))
        if not header:
            header = article.find(["h1", "h2", "h3"])
        if not header:
            continue
        link = header.find("a", href=True)
        if not link:
            continue
        title = link.get_text(strip=True)
        source_url = _resolve_url(link["href"])
        if not title:
            continue

        # --- Type label ---
        type_el = article.find(
            class_=re.compile(r"opportunity.?type|cat.?label|entry.?category", re.I)
        )
        raw_type = type_el.get_text(strip=True) if type_el else ""

        # Fallback: look for type as a tag/label in the entry-content
        if not raw_type:
            content_el = article.find(class_=re.compile(r"entry.?content", re.I))
            if content_el:
                # The first <p> in entry-content is often the type badge on Re-Title
                first_p = content_el.find("p")
                if first_p and len(first_p.get_text(strip=True)) < 40:
                    raw_type = first_p.get_text(strip=True)

        # --- Meta list (org, location, deadline, fee, eligibility) ---
        index_meta = _parse_meta_list(article)

        # --- Short description snippet ---
        teaser = ""
        content_el = article.find(class_=re.compile(r"entry.?content", re.I))
        if content_el:
            paras = content_el.find_all("p")
            desc_paras = []
            for p in paras:
                text = p.get_text(strip=True)
                if not text:
                    continue
                # Skip the type-badge paragraph (very short)
                if len(text) < 40 and text.lower() in _TYPE_MAP:
                    continue
                desc_paras.append(text)
                if len("\n".join(desc_paras)) > 500:
                    break
            teaser = "\n".join(desc_paras).strip()

        listings.append(
            {
                "title": title,
                "source_url": source_url,
                "raw_type": raw_type,
                "index_meta": index_meta,
                "teaser": teaser,
            }
        )

    logger.debug("Re-Title: parsed %d listings from index page", len(listings))
    return listings


def _has_next_page(html: str, current_page: int) -> bool:
    """
    Return True if there is a subsequent page of results.

    WordPress uses rel="next" on the pagination link to indicate the next page.
    """
    soup = BeautifulSoup(html, "html.parser")
    # Standard WordPress pagination: <a class="next page-numbers" href="...">
    next_link = soup.find("a", class_=re.compile(r"next"))
    if next_link and next_link.get("href"):
        return True
    # Also check rel="next" on <link> element in <head>
    head_next = soup.find("link", rel="next")
    if head_next:
        return True
    return False


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str) -> dict:
    """
    Parse a Re-Title listing detail page.

    Returns a dict with keys:
      description, meta, application_url

    'meta' is the same format as index_meta from _parse_meta_list().
    'application_url' is the external apply link, falling back to source_url.
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Full description ---
    content_el = soup.find(class_=re.compile(r"entry.?content", re.I))
    description = ""
    if content_el:
        paras = []
        for p in content_el.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if not text:
                continue
            paras.append(text)
        description = "\n".join(paras).strip()
        if len(description) > 2000:
            description = description[:1997] + "..."

    # --- Meta list ---
    meta = _parse_meta_list(soup)

    # --- Application URL ---
    application_url = _extract_apply_url(soup, source_url)

    return {
        "description": description or None,
        "meta": meta,
        "application_url": application_url,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Re-Title opportunities index and insert active open calls.

    Strategy:
      1. Fetch paginated index (typically 1-5 pages, ~50-100 listings).
      2. For each listing on the index:
           a. Parse title, type, and whatever metadata is available.
           b. If deadline or org name is missing, fetch the detail page.
           c. Skip past-deadline listings.
           d. Insert via insert_open_call().

    Re-Title's index cards are usually rich enough (org, deadline, description)
    that detail fetches are needed only for sparse cards (~20-30% of listings).

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    all_listings: list[dict] = []
    skipped_cloudflare = False

    # -----------------------------------------------------------------------
    # Phase 1: Collect all index listings across all pages
    # -----------------------------------------------------------------------
    for page_num in range(1, _MAX_PAGES + 1):
        url = INDEX_URL if page_num == 1 else _PAGE_URL.format(page=page_num)
        html = _fetch(session, url)

        if html is None:
            if page_num == 1:
                # First page blocked — nothing we can do this run
                logger.error(
                    "Re-Title: index page fetch failed — Cloudflare may be "
                    "blocking this IP. Will retry on next scheduled run."
                )
                skipped_cloudflare = True
            else:
                logger.warning(
                    "Re-Title: failed to fetch page %d — stopping pagination early",
                    page_num,
                )
            break

        page_listings = _parse_index_page(html)
        if not page_listings:
            if page_num == 1:
                logger.warning(
                    "Re-Title: no listings parsed from index page 1 — "
                    "page structure may have changed. Check selectors."
                )
            break

        all_listings.extend(page_listings)

        if len(all_listings) >= _MAX_LISTINGS:
            logger.info(
                "Re-Title: safety ceiling reached (%d listings) — stopping",
                _MAX_LISTINGS,
            )
            break

        if not _has_next_page(html, page_num):
            break

    if skipped_cloudflare:
        return 0, 0, 0

    logger.info("Re-Title: %d listings collected from index", len(all_listings))

    if not all_listings:
        logger.warning(
            "Re-Title: 0 listings after index crawl — source may be empty or "
            "page structure has changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: Enrich and insert each listing
    # -----------------------------------------------------------------------
    skipped_deadline = 0
    skipped_type = 0
    detail_fetches = 0

    for listing in all_listings:
        title = listing["title"]
        source_url = listing["source_url"]
        raw_type = listing.get("raw_type", "")
        index_meta = listing.get("index_meta", {})
        teaser = listing.get("teaser", "")

        # --- Call type ---
        call_type = _classify_type(raw_type) if raw_type else None
        if call_type is None and not raw_type:
            # No type badge at all — default to submission rather than skip
            call_type = "submission"
        elif call_type is None:
            # Explicit skip (e.g. "Job")
            skipped_type += 1
            continue

        # --- Deadline (prefer index; fetch detail if missing) ---
        deadline_raw = index_meta.get("deadline", "")
        deadline = _parse_deadline(deadline_raw)

        # --- Org name ---
        org_name = (
            index_meta.get("organisation")
            or index_meta.get("organization")
            or index_meta.get("host")
            or ""
        )

        # --- Determine if we need a detail fetch ---
        needs_detail = (
            not deadline  # missing deadline on index card
            or not org_name  # missing org name
            or not teaser  # no description snippet
        )

        description: Optional[str] = teaser if teaser else None
        application_url = source_url  # will be improved by detail fetch
        detail_meta: dict = {}

        if needs_detail:
            time.sleep(_DETAIL_DELAY)
            detail_html = _fetch(session, source_url)
            detail_fetches += 1

            if detail_html:
                detail = _parse_detail_page(detail_html, source_url)
                detail_meta = detail.get("meta", {})

                # Merge: detail values fill gaps left by index
                if not deadline:
                    deadline = _parse_deadline(detail_meta.get("deadline", ""))
                if not org_name:
                    org_name = (
                        detail_meta.get("organisation")
                        or detail_meta.get("organization")
                        or detail_meta.get("host")
                        or ""
                    )
                if not description or description == teaser:
                    description = detail.get("description") or description
                if detail.get("application_url"):
                    application_url = detail["application_url"]

        # --- Skip past-deadline ---
        if deadline and _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Re-Title: skipping %r — deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        # --- Fee ---
        fee_text = index_meta.get("fee") or detail_meta.get("fee") or ""
        fee_amount, fee_raw = _parse_fee(fee_text)

        # --- Eligibility ---
        eligibility = (
            index_meta.get("eligibility") or detail_meta.get("eligibility") or None
        )
        if not eligibility and description:
            eligibility = _extract_eligibility_text(description)

        # --- Location (metadata only) ---
        location = index_meta.get("location") or detail_meta.get("location") or ""

        found += 1

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": eligibility or "International",
            "fee": fee_amount,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name or "Re-Title",
            "metadata": {
                "organization": org_name,
                "location": location,
                "raw_type": raw_type,
                "fee_raw": fee_raw,
                "scope": "international",
                "source_platform": "re-title",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Re-Title: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("Re-Title: skipped %d past-deadline listings", skipped_deadline)
    if skipped_type:
        logger.info(
            "Re-Title: skipped %d listings with excluded type (e.g. Job)", skipped_type
        )
    if detail_fetches:
        logger.info("Re-Title: fetched %d detail pages for enrichment", detail_fetches)

    logger.info(
        "Re-Title: %d found (non-expired), %d new, %d updated", found, new, updated
    )
    return found, new, updated
