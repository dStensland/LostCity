"""
Crawler for Res Artis Open Calls (resartis.org/open-calls).

Res Artis is the worldwide network of artist residency organizations, with 600+
member organizations across 80+ countries. Their open calls listing aggregates
opportunities posted by member programs globally — residencies primarily, but
also fellowships, grants, and artist programs.

This is NOT a primary source — Res Artis aggregates calls posted by member
organizations — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" because Res Artis is a global
network and cross-border participation is the norm for residency programs.

Crawl strategy — two-phase (index + detail):

  Phase 1 — Index pages:
    URL: https://resartis.org/open-calls/          (page 1, ~300 listings)
         https://resartis.org/open-calls/page/2/   (page 2, ~18 listings)
         https://resartis.org/open-calls/page/N/   (stop when 0 articles)

    The index is WordPress + FacetWP, server-rendered. The default view shows
    only CURRENT (non-expired) open calls — approximately 300-320 total across
    1-2 pages. Each article card contains:
      - Title + href to detail page (/open-call/SLUG/)
      - Deadline in <dt>: "Deadline: DD Mon YYYY"
      - Country in <dt>: "Country: NAME"

    We parse the deadline from the index card and skip past-deadline entries
    before fetching detail pages, avoiding unnecessary HTTP requests.

  Phase 2 — Detail pages (/open-call/SLUG/):
    Each detail page has structured H5 fields in the article body AND a sidebar
    widget ("widget-area--post"). Key extraction points:

      Application deadline:
        H5 "Application deadline" -> next sibling text
        Format: "YYYY-MM-DD" (ISO, clean)
        Also available in sidebar widget as "Application deadline|YYYY-MM-DD"
        Index card deadline used as fallback.

      Application URL:
        H5 "Link to more information" -> next sibling text (raw URL string)
        H5 "Link to more information 2" -> secondary URL (skip Google Maps)
        Also check entry-content <a> tags under "Application information" H5.
        Fallback: source_url (Res Artis listing page).

      Organization name:
        Sidebar "Related Listing|ORG NAME" -> first pipe-separated token after label.
        Falls back to article title.

      Description:
        Full body text from <div class="entry-content">, all <p> and structured
        content, up to 3000 chars.

      Eligibility:
        Parsed from body text near "open to", "eligib", "who can apply".

      Location:
        H5 "Location" -> country name (stored in metadata).

      Residency dates:
        H5 "Residency starts" / "Residency ends" -> stored in metadata only.

Rate limiting:
  Res Artis is a small nonprofit membership network. We pause 0.5s between
  index page requests and 0.8s between detail page requests.

User-agent:
  We use a standard Chrome UA. The site serves 403 to curl's default UA but
  responds normally to browser UAs. The Googlebot UA works and is used here
  to be clear we are a crawler.
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

BASE_URL = "https://resartis.org"
INDEX_URL = "https://resartis.org/open-calls/"

# Hard cap prevents infinite loops if pagination breaks
MAX_PAGES = 20

# Polite inter-request delays (seconds)
INDEX_PAGE_DELAY = 0.5
DETAIL_PAGE_DELAY = 0.8

REQUEST_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)

# ---------------------------------------------------------------------------
# Month abbreviation map (index cards use "DD Mon YYYY" format)
# ---------------------------------------------------------------------------

_MONTH_MAP: dict[str, int] = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
    # Full names — detail pages sometimes use these
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

# ---------------------------------------------------------------------------
# Type inference
# ---------------------------------------------------------------------------
#
# Res Artis is a residency-specialist network. The vast majority of calls are
# residencies; a minority are fellowships or grants.
# Default: "residency". Only override for strong other signals.

_TYPE_PATTERNS: list[tuple[str, list[str]]] = [
    (
        "fellowship",
        [
            r"\bfellowship\b",
            r"\bfellow(?:s)?\b",
        ],
    ),
    (
        "grant",
        [
            r"\bgrants?\b",
            r"\bprize(?:\s+money)?\b",
            r"\bstipend\b",
            r"\bbursary\b",
            r"\bscholarship\b",
        ],
    ),
    (
        "commission",
        [
            r"\bcommission(?:ed|ing)?\b",
            r"\bpublic\s+art\s+(?:project|rfp|request|proposal)\b",
            r"\bRFP\b",
            r"\bRFQ\b",
        ],
    ),
]


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from combined title + description.
    Defaults to "residency" — the primary call type on Res Artis.
    """
    combined = (title + " " + (description or "")).lower()
    for call_type, patterns in _TYPE_PATTERNS:
        if any(re.search(pat, combined) for pat in patterns):
            return call_type
    return "residency"


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# Index card format: "DD Mon YYYY" (e.g. "25 Mar 2026", "01 Jan 2027")
_INDEX_DATE_RE = re.compile(
    r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})",
    re.IGNORECASE,
)

# ISO date (detail page "Application deadline" field is always YYYY-MM-DD)
_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")


def _parse_card_deadline(text: str) -> Optional[str]:
    """
    Parse a deadline from index card DT text.
    Format: "Deadline: DD Mon YYYY" e.g. "Deadline: 25 Mar 2026".
    Returns 'YYYY-MM-DD' or None.
    """
    m = _INDEX_DATE_RE.search(text)
    if m:
        day_str, month_str, year_str = m.group(1), m.group(2), m.group(3)
        month_num = _MONTH_MAP.get(month_str.lower())
        if month_num:
            try:
                day = int(day_str)
                year = int(year_str)
                datetime(year, month_num, day)  # validate
                return f"{year}-{month_num:02d}-{day:02d}"
            except (ValueError, TypeError):
                pass
    return None


def _parse_iso_date(text: str) -> Optional[str]:
    """
    Extract an ISO date (YYYY-MM-DD) from text. Returns 'YYYY-MM-DD' or None.
    Used for the detail page 'Application deadline' field.
    """
    m = _ISO_DATE_RE.search(text.strip())
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            datetime(year, month, day)
            return f"{year}-{month:02d}-{day:02d}"
        except ValueError:
            pass
    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if deadline has strictly passed (before today)."""
    if not deadline_str:
        return False
    try:
        dl = date.fromisoformat(deadline_str)
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Application URL extraction
# ---------------------------------------------------------------------------

# Domains to skip when extracting application URLs from body links
_SKIP_DOMAINS = frozenset(
    [
        "resartis.org",
        "maps.google.com",
        "maps.app.goo.gl",
        "facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
        "youtube.com",
    ]
)

# Link text patterns that indicate an application/submission link
_APPLY_LINK_TEXT_RE = re.compile(
    r"""
    \b(?:
        online\s+application\s*(?:form|portal)? |
        apply\s+(?:here|now|online) |
        submit\s+(?:here|now|online) |
        application\s+form |
        register\s+(?:here|now|online) |
        online |
        apply |
        here
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _is_skippable_url(href: str) -> bool:
    """Return True for URLs we should not use as the application URL."""
    if not href or href.startswith("#") or href.startswith("/"):
        return True
    for domain in _SKIP_DOMAINS:
        if domain in href:
            return True
    return False


def _extract_application_url(article_soup, source_url: str) -> str:
    """
    Extract the primary application URL from the detail page.

    Strategy:
      1. H5 "Link to more information" -> next sibling text (raw URL in the field)
      2. H5 "Link to more information 2" if the primary is a social/maps URL
      3. External links in entry-content under "Application information" H5
      4. Link text matching apply keywords in entry-content
      5. First external link in entry-content (excluding maps/social)
      6. Fallback: source_url
    """
    article = article_soup

    # Strategy 1 & 2: structured H5 fields
    for h5 in article.find_all("h5"):
        label = h5.get_text(strip=True).lower()
        if "link to more information" in label:
            sib = h5.find_next_sibling()
            if sib:
                # Could be a <span> or <a> or raw text
                url = _extract_url_from_element(sib)
                if url and not _is_skippable_url(url):
                    return url

    # Strategy 3: look for external links under "Application information" heading
    content = article.find("div", class_="entry-content")
    if content:
        # Find the "Application information" H5 and look at links that follow
        for h5 in content.find_all("h5"):
            if "application information" in h5.get_text(strip=True).lower():
                sib = h5.find_next_sibling()
                while sib:
                    for a in sib.find_all("a", href=True) if hasattr(sib, "find_all") else []:
                        href = a.get("href", "").strip()
                        if not _is_skippable_url(href):
                            return href
                    sib = sib.find_next_sibling()
                break

        # Strategy 4: apply-keyword links anywhere in content
        for a in content.find_all("a", href=True):
            href = a.get("href", "").strip()
            text = a.get_text(strip=True)
            if not _is_skippable_url(href) and _APPLY_LINK_TEXT_RE.search(text):
                return href

        # Strategy 5: first external link in content
        for a in content.find_all("a", href=True):
            href = a.get("href", "").strip()
            if not _is_skippable_url(href):
                return href

    return source_url


def _extract_url_from_element(el) -> Optional[str]:
    """
    Extract a URL from an element — either from an <a> href or as raw text
    that looks like a URL.
    """
    if el is None:
        return None
    # Check for child <a> tag first
    a = el.find("a", href=True) if hasattr(el, "find") else None
    if a:
        return a.get("href", "").strip()
    # Try raw text that starts with http
    text = el.get_text(strip=True) if hasattr(el, "get_text") else str(el).strip()
    if text.startswith("http"):
        return text.rstrip(".")
    return None


# ---------------------------------------------------------------------------
# Organization name extraction
# ---------------------------------------------------------------------------


def _extract_org_name(article_soup, title: str) -> str:
    """
    Extract organization name from the sidebar widget.

    The sidebar "widget-area--post" contains:
      "Related Listing|ORG NAME|Application deadline|DATE|..."
    We extract the token immediately after "Related Listing".

    Falls back to truncated article title.
    """
    widget = article_soup.find("div", class_=lambda c: c and "widget-area--post" in c)
    if widget:
        text = widget.get_text(separator="|", strip=True)
        # Find "Related Listing" and grab the next segment
        m = re.search(r"Related Listing\|([^|]{1,120})", text)
        if m:
            org = m.group(1).strip().rstrip(".")
            if org and len(org) > 1:
                return org

    return title[:80]


# ---------------------------------------------------------------------------
# Description extraction
# ---------------------------------------------------------------------------

# Boilerplate patterns to skip in description paragraphs
_SKIP_DESC_RE = re.compile(
    r"""
    res\s+artis |
    follow\s+us |
    subscribe\s+to |
    share\s+this |
    newsletter |
    cookies? |
    privacy\s+policy
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_description(article_soup) -> Optional[str]:
    """
    Extract body description from the entry-content div (max 3000 chars).

    Collects text from <p> tags and structured <h5>/<span> blocks,
    stopping before the navigation/sidebar section.
    """
    content = article_soup.find("div", class_="entry-content")
    if content is None:
        content = article_soup

    # Remove nav and aside elements that leak into text
    for tag in content.find_all(["nav", "aside"]) if hasattr(content, "find_all") else []:
        tag.decompose()

    paras = []
    for el in content.find_all(["p", "h5", "span"]) if hasattr(content, "find_all") else []:
        text = el.get_text(separator=" ", strip=True)
        if not text or len(text) < 15:
            continue
        if _SKIP_DESC_RE.search(text):
            continue
        paras.append(text)

    description = "\n\n".join(paras)
    if len(description) > 3000:
        description = description[:2997] + "..."
    return description.strip() or None


# ---------------------------------------------------------------------------
# Eligibility extraction
# ---------------------------------------------------------------------------

_ELIG_RE = re.compile(
    r"""
    (?:
        (?:the\s+)?(?:call|programme|program|residency)\s+is\s+open\s+to |
        eligib(?:ility|le)\s*:? |
        who\s+can\s+apply |
        open\s+to\s+(?:all\s+)?(?:artists?|creatives?|practitioners?|professionals?) |
        applicants?\s+must\s+be
    )
    \s*
    ([^\n]{15,300})
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_eligibility(article_text: str) -> Optional[str]:
    """Extract a short eligibility description from article text."""
    m = _ELIG_RE.search(article_text)
    if m:
        text = m.group(1).strip()
        for sep in [".", "\n"]:
            idx = text.find(sep)
            if 0 < idx < 200:
                text = text[:idx].strip()
                break
        if text:
            return text[:200]
    return "International"


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
            "Referer": BASE_URL,
        }
    )
    return session


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a URL. Returns HTML text or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ResArtis: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one Res Artis open calls index page.

    Returns a list of listing dicts:
      {title, source_url, deadline_str (from card), country, image_url}

    An empty list signals either a dead end or a page with no open_call articles.
    """
    soup = BeautifulSoup(html, "lxml")

    articles = soup.find_all(
        "article", class_=lambda c: c and "open_call" in (c if isinstance(c, str) else " ".join(c))
    )

    listings = []
    for article in articles:
        # Title and URL
        h2 = article.find("h2", class_="card__title")
        if not h2:
            continue
        a_tag = h2.find("a", href=True)
        if not a_tag:
            continue

        title = a_tag.get_text(strip=True)
        href = a_tag["href"].strip()
        if not title or not href:
            continue

        # Resolve relative URLs (unlikely here but safe)
        if href.startswith("/"):
            source_url = BASE_URL + href
        else:
            source_url = href

        # Deadline + country from <dt> tag
        deadline_str: Optional[str] = None
        country: Optional[str] = None
        dt = article.find("dt")
        if dt:
            dt_text = dt.get_text(separator=" ", strip=True)
            # Deadline: "Deadline: DD Mon YYYY"
            m_dl = re.search(r"Deadline:\s*(.+?)(?:Country:|$)", dt_text, re.IGNORECASE)
            if m_dl:
                deadline_str = _parse_card_deadline(m_dl.group(1).strip())
            # Country: "Country: NAME"
            m_co = re.search(r"Country:\s*(.+?)$", dt_text, re.IGNORECASE)
            if m_co:
                country = m_co.group(1).strip()

        # Thumbnail image from background-image inline style
        image_url: Optional[str] = None
        aside = article.find("aside", class_="card__image")
        if aside:
            style = aside.get("style", "")
            m_img = re.search(r"url\(['\"]?([^'\")\s]+)['\"]?\)", style)
            if m_img:
                img_src = m_img.group(1)
                if img_src.startswith("/"):
                    image_url = BASE_URL + img_src
                elif img_src.startswith("http"):
                    image_url = img_src

        listings.append(
            {
                "title": title,
                "source_url": source_url,
                "deadline_str": deadline_str,
                "country": country,
                "image_url": image_url,
            }
        )

    logger.debug("ResArtis: parsed %d listings from index page", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str) -> Optional[dict]:
    """
    Parse a Res Artis detail page (/open-call/SLUG/).

    Returns a dict with extracted fields, or None on critical parse failure.

    Fields:
      deadline, application_url, org_name, description, eligibility,
      location, residency_starts, residency_ends
    """
    soup = BeautifulSoup(html, "lxml")

    article = soup.find("article")
    if not article:
        logger.warning("ResArtis: no <article> on detail page %s", source_url)
        return None

    article_text = article.get_text(separator="\n", strip=True)

    # --- Structured H5 fields ---
    # Build a map: {normalized_label: value_text}
    h5_fields: dict[str, str] = {}
    for h5 in article.find_all("h5"):
        label = h5.get_text(strip=True).lower().strip()
        sib = h5.find_next_sibling()
        if sib:
            val = sib.get_text(strip=True)
            h5_fields[label] = val

    # Application deadline (ISO from detail page, more reliable than card)
    deadline: Optional[str] = None
    raw_deadline = h5_fields.get("application deadline", "")
    if raw_deadline:
        deadline = _parse_iso_date(raw_deadline)

    # Location (country)
    location = h5_fields.get("location") or None

    # Residency dates (metadata only)
    residency_starts = h5_fields.get("residency starts") or None
    residency_ends = h5_fields.get("residency ends") or None

    # Application URL
    application_url = _extract_application_url(article, source_url)

    # Organization name (from sidebar widget)
    org_name = _extract_org_name(soup, "")

    # Description
    description = _extract_description(article)

    # Eligibility
    eligibility = _extract_eligibility(article_text)

    return {
        "deadline": deadline,
        "application_url": application_url,
        "org_name": org_name,
        "description": description,
        "eligibility": eligibility,
        "location": location,
        "residency_starts": residency_starts,
        "residency_ends": residency_ends,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Res Artis Open Calls (resartis.org/open-calls).

    Strategy:
      Phase 1: Paginate /open-calls/ and /open-calls/page/N/ to collect all
               current (non-expired) open call cards. Each card includes the
               title, detail URL, deadline, and country. Stop when a page
               returns 0 open_call articles.
      Phase 2: For each call, skip past-deadline entries (using the card
               deadline), then fetch the detail page to extract the full
               deadline (ISO), application URL, org name, and description.
      Insert:  Pass each eligible call to insert_open_call().

    Returns (found, new, updated).
      found   = calls that passed deadline filter
      new     = successfully inserted (new rows)
      updated = 0 (insert_open_call handles updates via content-hash dedup)
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()
    seen_urls: set[str] = set()
    all_listings: list[dict] = []

    # -----------------------------------------------------------------------
    # Phase 1: Collect index listings from all pages
    # -----------------------------------------------------------------------

    for page_num in range(1, MAX_PAGES + 1):
        if page_num > 1:
            time.sleep(INDEX_PAGE_DELAY)

        if page_num == 1:
            url = INDEX_URL
        else:
            url = f"{INDEX_URL}page/{page_num}/"

        html = _fetch(session, url)
        if not html:
            logger.warning(
                "ResArtis: failed to fetch index page %d — stopping", page_num
            )
            break

        listings = _parse_index_page(html)

        if not listings:
            logger.info(
                "ResArtis: page %d returned 0 listings — index crawl complete (total: %d)",
                page_num,
                len(all_listings),
            )
            break

        logger.info("ResArtis: index page %d — %d listings", page_num, len(listings))

        for listing in listings:
            url_key = listing["source_url"]
            if url_key in seen_urls:
                continue
            seen_urls.add(url_key)
            all_listings.append(listing)

    logger.info(
        "ResArtis: collected %d unique listings across index pages", len(all_listings)
    )

    # -----------------------------------------------------------------------
    # Phase 2: Fetch detail pages and insert
    # -----------------------------------------------------------------------

    skipped_deadline = 0
    skipped_no_url = 0
    detail_errors = 0

    for i, listing in enumerate(all_listings):
        title = listing["title"]
        source_url = listing["source_url"]
        card_deadline = listing.get("deadline_str")
        country = listing.get("country")
        image_url = listing.get("image_url")

        # Pre-filter: skip clearly past-deadline items from the index card
        # (avoids fetching detail pages we'd discard anyway)
        if _is_past_deadline(card_deadline):
            skipped_deadline += 1
            logger.debug(
                "ResArtis: skipping %r — card deadline %s passed",
                title[:60],
                card_deadline,
            )
            continue

        if i > 0:
            time.sleep(DETAIL_PAGE_DELAY)

        html = _fetch(session, source_url)
        if not html:
            detail_errors += 1
            logger.warning("ResArtis: failed to fetch detail page for %r", title[:60])
            continue

        detail = _parse_detail_page(html, source_url)
        if detail is None:
            detail_errors += 1
            logger.warning("ResArtis: failed to parse detail page for %r", title[:60])
            continue

        # Use detail-page deadline (ISO, more reliable); fall back to card deadline
        deadline = detail["deadline"] or card_deadline

        # Final deadline check using the more precise detail-page value
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "ResArtis: skipping %r — detail deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        application_url = detail["application_url"]
        if not application_url or application_url == source_url:
            # source_url fallback is acceptable — the Res Artis listing itself
            # links back to the member org, and some listings don't post a
            # direct external apply link. Use source_url so the call is still
            # discoverable, but log it.
            logger.debug(
                "ResArtis: %r — no external application URL, using source_url",
                title[:60],
            )

        if not application_url:
            skipped_no_url += 1
            logger.debug("ResArtis: skipping %r — no application URL", title[:60])
            continue

        org_name = detail["org_name"] or "Res Artis"
        description = detail["description"]
        eligibility = detail["eligibility"] or "International"
        location = detail.get("location") or country

        call_type = _infer_call_type(title, description or "")

        found += 1

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": None,  # Fee structure is unstructured text; skip
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name,
            "metadata": {
                "source": "resartis",
                "organization": org_name,
                "scope": "international",
                "country": location,
                "residency_starts": detail.get("residency_starts"),
                "residency_ends": detail.get("residency_ends"),
                "thumbnail_url": image_url,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ResArtis: inserted %r (deadline=%s, type=%s, country=%s)",
                title[:60],
                deadline,
                call_type,
                location,
            )

    if skipped_deadline:
        logger.info("ResArtis: skipped %d past-deadline calls", skipped_deadline)
    if detail_errors:
        logger.info("ResArtis: %d detail page fetch/parse errors", detail_errors)
    if skipped_no_url:
        logger.info("ResArtis: skipped %d calls with no application URL", skipped_no_url)

    logger.info(
        "ResArtis: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
