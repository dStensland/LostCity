"""
Crawler for ArtCallEntry.com open calls and artist opportunities.

Source: https://artcallentry.com/

ArtCallEntry.com is a free, publicly accessible aggregator of artist
opportunities: competitions, juried exhibitions, fairs, residencies,
workshops, RFP/public art, and online-only calls. As of 2026-03-24 it
lists ~960 active calls across 7 paginated pages (~141 listings/page).

HTML structure (verified 2026-03-24):
  Listing pages: https://artcallentry.com/?page=N
    div.masonry-container
      article.post.portfolio-2.post-grid   — one card per call
        div.post-content
          header.entry-header
            h1.entry-title
              a[href="/calls/<slug>"]       — relative detail URL
              span.label                    — "{N} Days" or "Today"
            h6 a[href="/calls/type/<type>"] — category

    ul.pagination                           — {N} pages, next link has rel="next"

  Detail pages: https://artcallentry.com/calls/<slug>
    article.post
      div.post-content
        header.entry-header
          h6 a[href]                         — category
          h1.entry-title
            a[href="<apply_url>"]            — external application URL
        div.entry-content
          table.table
            tr: "Entry Dates" | "DEADLINE, TIME - OPEN_DATE, TIME N Days Left"
            tr: "Entry Fee?"  | label (Yes / No)
            tr: "Contact Information" | name, email, state, country
          div.row
            h4 "Description"
            p ...                            — one or more description paragraphs
        div.decoration
          a.btn[href="<apply_url>"]          — canonical apply link

Date format on detail page: "M/D/YY, H:MM AM/PM - M/D/YY, H:MM AM/PM"
  The FIRST date is the deadline; the SECOND is the open date.
  Both use 2-digit years (e.g. "26" → 2026, "27" → 2027).

Category → call_type mapping:
  competitions-contests    → submission
  juried-calls-exhibitions → exhibition_proposal
  fairs-festivals          → submission
  residencies              → residency
  workshops                → residency (closest available type)
  rfp-public-art           → commission
  online-only              → submission
  other                    → submission

Fee: the detail page shows "Entry Fee? Yes/No" — we store "Yes" as fee=None
(amount unknown) and "No" as fee="Free".

Eligibility: inferred from the country field in Contact Information. If the
country is "--Non US State--" (their US placeholder) or a US state code, we
use "National". Any other country gets "International".

Confidence tier: "aggregated" — ArtCallEntry is a listing board, not the
issuing organization.

Rate limiting: 0.5s delay between pages, 0.75s between detail fetches.
Detail fetch: only done when the listing is not expired (badge check on
listing page is used to pre-filter before detail fetches).
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

BASE_URL = "https://artcallentry.com"
LISTING_URL = "https://artcallentry.com/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

PAGE_DELAY_S = 0.5  # between listing pages
DETAIL_DELAY_S = 0.75  # between detail page fetches

# Category slug → call_type
_TYPE_MAP: dict[str, str] = {
    "competitions-contests": "submission",
    "juried-calls-exhibitions": "exhibition_proposal",
    "fairs-festivals": "submission",
    "residencies": "residency",
    "workshops": "residency",
    "rfp-public-art": "commission",
    "online-only": "submission",
    "other": "submission",
}

# US non-state strings ArtCallEntry uses when the venue is in the US
_US_STATE_TOKENS = {"--non us state--", "--select state--", ""}


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[bytes]:
    """Return raw response bytes or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("ArtCallEntry: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# Entry Dates cell text: "3/26/26, 11:59 PM - 2/16/26, 12:01 AM 2 Days Left"
_ENTRY_DATES_RE = re.compile(
    r"(\d{1,2})/(\d{1,2})/(\d{2})"  # first date = deadline: M/D/YY
)


def _parse_deadline(dates_text: str) -> Optional[str]:
    """
    Extract the deadline date (first M/D/YY) from the "Entry Dates" cell.

    Returns an ISO date string "YYYY-MM-DD", or None if unparseable.
    """
    m = _ENTRY_DATES_RE.search(dates_text)
    if not m:
        return None
    month, day, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # 2-digit year: ArtCallEntry currently posts calls for 2025–2027
    year = 2000 + yy
    try:
        datetime(year, month, day)  # validate
    except ValueError:
        return None
    return f"{year}-{month:02d}-{day:02d}"


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed (strictly before today)."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Category / call_type
# ---------------------------------------------------------------------------


def _category_to_call_type(category_href: str) -> str:
    """
    Map a category link href like "/calls/type/juried-calls-exhibitions" to
    a call_type string.
    """
    # Extract the slug after /type/
    m = re.search(r"/calls/type/([^/?#]+)", category_href)
    if m:
        slug = m.group(1).lower()
        return _TYPE_MAP.get(slug, "submission")
    return "submission"


# ---------------------------------------------------------------------------
# Eligibility inference
# ---------------------------------------------------------------------------


def _infer_eligibility(country_text: str, description: str) -> str:
    """
    Determine eligibility scope.

    Logic:
      1. If country_text is empty or matches US placeholders → National
      2. Any other country value → International
      3. Override: "international" / "worldwide" in description → International
         "United States" / "U.S." / "US artists" in description → National
    """
    country_lower = country_text.strip().lower()
    if country_lower in _US_STATE_TOKENS or country_lower.startswith("united states"):
        base = "National"
    elif country_lower:
        base = "International"
    else:
        base = "National"

    desc_lower = description.lower()
    if any(
        kw in desc_lower
        for kw in ("international", "worldwide", "global", "open to all")
    ):
        return "International"
    if any(
        kw in desc_lower
        for kw in ("united states only", "us only", "u.s. only", "american artists")
    ):
        return "National"

    return base


# ---------------------------------------------------------------------------
# Listing page parser
# ---------------------------------------------------------------------------


def _parse_listing_page(html_bytes: bytes) -> tuple[list[dict], Optional[str]]:
    """
    Parse a listing page (homepage or ?page=N).

    Returns:
      - List of raw listing dicts: {slug, title, category_href, badge_text}
      - Next-page URL (absolute) or None if on the last page
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    listings: list[dict] = []

    for article in soup.select("article.post"):
        # Title and detail link
        title_el = article.select_one(".entry-title a")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        href = title_el.get("href", "")
        if not href:
            continue
        if not href.startswith("http"):
            href = BASE_URL + href

        # Category
        cat_link = article.select_one("h6 a")
        category_href = cat_link.get("href", "") if cat_link else ""

        # Days-remaining badge — text like "7 Days", "Today", "2 Days"
        badge = article.select_one("span.label")
        badge_text = badge.get_text(strip=True) if badge else ""

        listings.append(
            {
                "title": title,
                "url": href,
                "category_href": category_href,
                "badge_text": badge_text,
            }
        )

    # Find next page link
    next_url: Optional[str] = None
    next_link = soup.select_one("ul.pagination li.next a[rel='next']")
    if not next_link:
        # Fallback: find the "next >" link
        for a in soup.select("ul.pagination li a"):
            if "next" in a.get_text(strip=True).lower():
                href_next = a.get("href", "")
                if href_next and href_next != "#":
                    next_url = (
                        BASE_URL + href_next if href_next.startswith("/") else href_next
                    )
                break
    else:
        href_next = next_link.get("href", "")
        if href_next:
            next_url = BASE_URL + href_next if href_next.startswith("/") else href_next

    return listings, next_url


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html_bytes: bytes, detail_url: str) -> Optional[dict]:
    """
    Parse a call detail page at https://artcallentry.com/calls/<slug>.

    Returns a dict with:
      deadline, application_url, description, fee (0.0=free/None=unknown),
      eligibility, category_href, country
    Or None if essential fields are missing (no application URL).
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    main = soup.select_one(".col-md-8")
    if not main:
        main = soup

    # Category from h6
    cat_link = main.select_one("h6 a")
    category_href = cat_link.get("href", "") if cat_link else ""

    # Application URL — prefer the "Apply for Call" button; fallback to h1 link
    apply_btn = main.select_one("div.decoration a.btn")
    if apply_btn:
        application_url = apply_btn.get("href", "").strip()
    else:
        h1_link = main.select_one("h1.entry-title a")
        application_url = h1_link.get("href", "").strip() if h1_link else ""

    if not application_url or application_url.startswith("/"):
        # Internal link — use the detail page itself as application URL
        application_url = detail_url

    # Table: Entry Dates, Entry Fee, Contact Information
    deadline_str: Optional[str] = None
    fee_str: Optional[float] = None
    country_text = ""

    table = main.select_one("table.table")
    if table:
        for row in table.select("tr"):
            th = row.find("th")
            td = row.find("td")
            if not th:
                continue
            label = th.get_text(separator=" ", strip=True).lower()

            if "entry dates" in label and td:
                dates_text = td.get_text(separator=" ", strip=True)
                deadline_str = _parse_deadline(dates_text)

            elif "entry fee" in label and td:
                fee_label = td.find("span", class_="label")
                if fee_label:
                    fee_raw = fee_label.get_text(strip=True).lower()
                    if fee_raw == "no":
                        fee_str = 0.0  # explicitly free
                    else:
                        fee_str = None  # "Yes" — fee exists but amount unknown
                else:
                    fee_str = None

            elif "contact information" in label:
                # Country is in the th cell (odd layout — contact info is in th, not td)
                th_text = th.get_text(separator="\n", strip=True)
                lines = [ln.strip() for ln in th_text.splitlines() if ln.strip()]
                # Country is typically the last non-empty line
                if lines:
                    country_text = lines[-1]

    # Description: collect all <p> tags under the description div.row
    desc_parts: list[str] = []
    desc_container = main.select_one("div.row")
    if desc_container:
        h4 = desc_container.find("h4")
        if h4:
            # Collect <p> siblings after the h4
            for sibling in h4.find_next_siblings("p"):
                text = sibling.get_text(separator=" ", strip=True)
                if text:
                    desc_parts.append(text)

    description = "\n\n".join(desc_parts).strip()
    description = re.sub(r"\n{3,}", "\n\n", description)  # collapse excess newlines
    description = description[:3000] if description else ""

    if not application_url:
        logger.debug("ArtCallEntry: no application URL on %s", detail_url)
        return None

    eligibility = _infer_eligibility(country_text, description)

    return {
        "deadline": deadline_str,
        "application_url": application_url,
        "description": description or None,
        "fee": fee_str,
        "eligibility": eligibility,
        "category_href": category_href,
        "country": country_text,
    }


# ---------------------------------------------------------------------------
# Badge pre-filter (skip obviously expired before detail fetches)
# ---------------------------------------------------------------------------


def _badge_suggests_expired(badge_text: str) -> bool:
    """
    Return True if the listing badge clearly indicates the deadline has passed.

    ArtCallEntry only shows calls with deadlines in the future on its listing
    pages — expired calls are removed from the listing automatically.  This
    filter is a safety net for edge cases (e.g. "0 Days", empty badge).
    """
    if not badge_text:
        return False  # no badge = deadline may be unknown, fetch anyway
    lower = badge_text.lower()
    # Explicit "0 days" — deadline is today or just passed
    if re.match(r"^0\s*days?$", lower):
        return True
    return False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtCallEntry.com and insert/update open calls.

    Strategy:
      1. Walk all listing pages (?page=1…N), collecting card metadata.
      2. For each card, fetch its detail page.
      3. Skip calls whose deadline has already passed.
      4. Insert/update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    # -----------------------------------------------------------------------
    # Phase 1: collect all listing cards across all pages
    # -----------------------------------------------------------------------
    all_cards: list[dict] = []
    current_url: Optional[str] = LISTING_URL
    page_num = 0

    while current_url:
        page_num += 1
        logger.info(
            "ArtCallEntry: fetching listing page %d — %s", page_num, current_url
        )

        html_bytes = _fetch(current_url, session)
        if not html_bytes:
            logger.error(
                "ArtCallEntry: failed to fetch listing page %d — stopping pagination",
                page_num,
            )
            break

        page_cards, next_url = _parse_listing_page(html_bytes)
        logger.debug(
            "ArtCallEntry: page %d — %d cards, next=%s",
            page_num,
            len(page_cards),
            next_url,
        )
        all_cards.extend(page_cards)
        current_url = next_url

        if current_url:
            time.sleep(PAGE_DELAY_S)

    logger.info(
        "ArtCallEntry: collected %d listing cards across %d pages",
        len(all_cards),
        page_num,
    )

    if not all_cards:
        logger.warning("ArtCallEntry: no cards found — check site structure")
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert/update
    # -----------------------------------------------------------------------
    skipped_expired = 0
    skipped_no_url = 0
    skipped_no_deadline = 0
    detail_errors = 0

    for idx, card in enumerate(all_cards):
        title = card["title"]
        detail_url = card["url"]
        badge_text = card.get("badge_text", "")

        # Pre-filter: skip cards where badge indicates expiry
        if _badge_suggests_expired(badge_text):
            skipped_expired += 1
            logger.debug(
                "ArtCallEntry: skipping %r — badge %r suggests expired",
                title[:60],
                badge_text,
            )
            continue

        # Rate limit before detail fetch (not on the first one)
        if idx > 0:
            time.sleep(DETAIL_DELAY_S)

        detail_bytes = _fetch(detail_url, session)
        if not detail_bytes:
            detail_errors += 1
            logger.warning(
                "ArtCallEntry: failed to fetch detail page for %r", title[:60]
            )
            continue

        detail = _parse_detail_page(detail_bytes, detail_url)
        if not detail:
            skipped_no_url += 1
            continue

        # Use category from detail page (more reliable than listing card)
        category_href = detail.get("category_href") or card.get("category_href", "")
        call_type = _category_to_call_type(category_href)

        deadline = detail.get("deadline")

        # Skip past-deadline calls
        if _is_past_deadline(deadline):
            skipped_expired += 1
            logger.debug(
                "ArtCallEntry: skipping %r — deadline %s is in the past",
                title[:60],
                deadline,
            )
            continue

        application_url = detail.get("application_url", "")
        if not application_url:
            skipped_no_url += 1
            continue

        found += 1

        description = detail.get("description") or ""
        fee = detail.get("fee")
        eligibility = detail.get("eligibility", "International")
        country = detail.get("country", "")

        # Derive a slug-friendly org name from the detail URL slug
        url_slug = detail_url.rstrip("/").split("/")[-1]
        # Remove trailing dashes and numeric suffixes to get an org-ish name
        org_slug = re.sub(r"-\d+$", "", url_slug).lower()[:50]

        call_data: dict = {
            "title": title,
            "description": description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug or "artcallentry",
            "metadata": {
                "source": "artcallentry",
                "category_href": category_href,
                "country": country,
                "badge": badge_text,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ArtCallEntry: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_expired:
        logger.info(
            "ArtCallEntry: skipped %d expired/soon-expired calls", skipped_expired
        )
    if skipped_no_url:
        logger.info(
            "ArtCallEntry: skipped %d calls with no application URL", skipped_no_url
        )
    if skipped_no_deadline:
        logger.info(
            "ArtCallEntry: skipped %d calls with no parseable deadline",
            skipped_no_deadline,
        )
    if detail_errors:
        logger.warning("ArtCallEntry: %d detail page fetch errors", detail_errors)

    logger.info(
        "ArtCallEntry: %d found (non-expired), %d new/updated inserted",
        found,
        new,
    )
    return found, new, updated
