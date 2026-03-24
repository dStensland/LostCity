"""
Crawler for Artwork Archive's public opportunities board.

URL: https://www.artworkarchive.com/call-for-entry

Artwork Archive is a portfolio/inventory management platform for artists that
also runs a public listing board for open calls, exhibitions, residencies,
grants, and competitions. Organizations pay to list their calls on the
platform; artists can apply directly or through Artwork Archive's own
submission system. Because Artwork Archive is an aggregator (not the issuing
organization), confidence_tier is "aggregated".

Crawl strategy — two phases (static HTML via cloudscraper):

  Phase 1 — Index pages (/call-for-entry?page=N):
    Each page shows up to 20 listings in two variants:
      • opportunity-container-featured — rich inline metadata (org, deadline,
        type, eligibility, fee, location, categories, description snippet).
        No detail fetch needed.
      • opportunity-container-basic — sparse: title, deadline, short blurb
        only. Requires a detail fetch for full metadata.

    Per listing, we extract from the index:
      - Title (h2)
      - Deadline (opportunity-date <p>, or Submission Deadline in info-list)
      - Organization (opportunity-info-list li for "Organization:")
      - Type (opportunity-info-list li for "Type:")
      - Eligibility (opportunity-info-list li for "Eligibility:")
      - Entry Fee (opportunity-info-list li for "Entry Fee:")
      - Description snippet (external_link_security <section>)
      - Detail URL (View button href="/call-for-entry/slug")

  Phase 2 — Detail pages (one per basic listing):
    Fetches /call-for-entry/{slug} for:
      - Full description (external_link_security section)
      - Organization name (opportunity-info-list)
      - Type, Eligibility, Entry Fee (opportunity-info-list)
      - Application URL (external-opportunity-links section:
          "Apply" and "Learn More" links)

Pagination:
  The pagination widget on page 1 reveals the highest page number. We
  iterate pages 1..max_page, stopping early if a page returns 0 containers.

Type mapping:
  Exhibition          → submission
  Competition         → submission
  Art fair            → submission
  Public Art & Proposals → commission
  Grants & Fellowships → grant
  Residency           → residency
  Other               → submission   (catch-all)

Fee parsing:
  Entry Fee text is free-form (e.g. "There is a $10 entry fee, per piece...").
  We extract the first dollar amount. "No fee", "free", "$0" → 0.0.
  If the fee text mentions a dollar amount we can't parse → None (unknown).

Rate limiting:
  cloudscraper handles TLS fingerprinting for Cloudflare bypass.
  We add a 1-second delay between detail fetches to be polite.
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

BASE_URL = "https://www.artworkarchive.com"
INDEX_URL = "https://www.artworkarchive.com/call-for-entry"

# Conservative page ceiling — site currently has ~9 pages of 20 listings each
MAX_PAGES = 30

# Polite delay between detail page fetches (seconds)
DETAIL_FETCH_DELAY = 1.0

# Artwork Archive type label → our call_type.
# None means skip (not an artist opportunity).
_TYPE_MAP: dict[str, Optional[str]] = {
    "exhibition": "submission",
    "competition": "submission",
    "art fair": "submission",
    "public art & proposals": "commission",
    "grants & fellowships": "grant",
    "residency": "residency",
    "other": "submission",
    # Catch any new types as submission rather than silently dropping them
}

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
}


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _make_session() -> cloudscraper.CloudScraper:
    """Create a cloudscraper session that handles Cloudflare managed challenges."""
    session = cloudscraper.create_scraper(
        browser={
            "browser": "chrome",
            "platform": "darwin",
            "desktop": True,
        }
    )
    session.headers.update(
        {
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.artworkarchive.com/",
        }
    )
    return session


def _fetch(session: cloudscraper.CloudScraper, url: str) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        # Sanity check: if Cloudflare challenge slipped through, the title
        # will still say "Just a moment..." — detect and bail.
        if "Just a moment" in resp.text[:500]:
            logger.warning(
                "ArtworkArchive: Cloudflare challenge not resolved for %s", url
            )
            return None
        return resp.text
    except Exception as exc:
        logger.warning("ArtworkArchive: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_date(text: str) -> Optional[str]:
    """
    Parse a date from Artwork Archive's display format into 'YYYY-MM-DD'.

    Handles:
      "March 25, 2026"      → "2026-03-25"
      "April  4, 2026"      → "2026-04-04"  (extra space is fine)
      "2026-03-25"          → "2026-03-25"  (ISO passthrough)
    """
    if not text:
        return None

    text = text.strip()

    # ISO format passthrough
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    # "Month D(D), YYYY" (with optional extra whitespace)
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

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

# Matches dollar amounts like $10, $25.00, $5.50
_DOLLAR_RE = re.compile(r"\$\s*(\d+(?:\.\d{1,2})?)")

# Substring phrases that unambiguously mean "no fee"
_FREE_SUBSTRINGS = (
    "no fee",
    "no application fee",
    "no entry fee",
    "no application fees",
    "there is no fee",
    "no fees",
    "free to enter",
    "free to apply",
    "no cost",
)

# Exact-match (normalized) strings that mean free
_FREE_EXACT = frozenset({"free", "none", "0", "$0.00", "$0"})


def _parse_fee(fee_text: str) -> Optional[float]:
    """
    Extract the numeric application fee from free-form text.

    Returns:
      0.0    — unambiguously free
      float  — the dollar amount (first one found)
      None   — fee mentioned but amount unknown or non-USD
    """
    if not fee_text:
        return None

    normalized = fee_text.strip().lower()

    # Exact-match check (avoids "$0" matching inside "$10")
    if normalized in _FREE_EXACT:
        return 0.0

    # Substring check for unambiguous "no fee" phrases
    if any(phrase in normalized for phrase in _FREE_SUBSTRINGS):
        return 0.0

    # Extract the first dollar amount
    m = _DOLLAR_RE.search(fee_text)
    if m:
        amount = float(m.group(1))
        # "$0" as an amount (already handled above, but belt-and-suspenders)
        if amount == 0.0:
            return 0.0
        try:
            return amount
        except (TypeError, ValueError):
            pass

    return None


# ---------------------------------------------------------------------------
# Type classification
# ---------------------------------------------------------------------------


def _classify_type(raw_type: str) -> Optional[str]:
    """
    Map an Artwork Archive type label to our call_type.
    Returns None only if we explicitly decide to skip (currently unused —
    all AA types are artist opportunities, unlike some other boards).
    Unknown types fall back to 'submission'.
    """
    normalized = raw_type.strip().lower()
    result = _TYPE_MAP.get(normalized)
    if result is None:
        logger.debug(
            "ArtworkArchive: unknown type %r — treating as submission", raw_type
        )
        return "submission"
    return result


# ---------------------------------------------------------------------------
# Info-list key extractor
# ---------------------------------------------------------------------------


def _extract_info_list(info_list_el) -> dict[str, str]:
    """
    Parse a <ul class="opportunity-info-list"> into a dict of {key: value}.

    Example input:
      <li><span class="opportunity-list-title">Organization:</span> Gallery 86</li>
    Returns:
      {"Organization": "Gallery 86"}
    """
    result: dict[str, str] = {}
    if not info_list_el:
        return result
    for li in info_list_el.find_all("li"):
        key_el = li.find("span", class_="opportunity-list-title")
        if not key_el:
            continue
        key = key_el.get_text(strip=True).rstrip(":").strip()
        # Value = everything in the <li> excluding the key span
        key_text = key_el.get_text()
        full_text = li.get_text()
        value = full_text.replace(key_text, "", 1).strip()
        if key and value:
            result[key] = value
    return result


# ---------------------------------------------------------------------------
# Pagination helper
# ---------------------------------------------------------------------------


def _get_max_page(soup: BeautifulSoup) -> int:
    """
    Extract the highest page number from the pagination widget.

    The pagination looks like:
      <ul class="pagination">
        <li><a href="/call-for-entry?page=9">9</a></li>
      </ul>

    Returns the max page number, or 1 if not found.
    """
    pagination = soup.find("ul", class_="pagination")
    if not pagination:
        return 1

    max_page = 1
    for a in pagination.find_all("a", href=re.compile(r"page=(\d+)")):
        m = re.search(r"page=(\d+)", a.get("href", ""))
        if m:
            page_num = int(m.group(1))
            max_page = max(max_page, page_num)

    return max_page


# ---------------------------------------------------------------------------
# Application URL extractor from detail pages
# ---------------------------------------------------------------------------


def _extract_application_url_from_detail(soup: BeautifulSoup, detail_url: str) -> str:
    """
    Extract the best available application URL from a detail page.

    Priority:
      1. "Apply" link in the external-opportunity-links section
      2. "Learn More" link in the external-opportunity-links section
      3. Detail page URL itself (always valid as last resort)
    """
    ext_links = soup.find(class_="external-opportunity-links")
    if ext_links:
        for a in ext_links.find_all("a", href=True):
            href = a["href"]
            text = a.get_text(strip=True).lower()
            if not href.startswith("http"):
                continue
            if "apply" in text:
                return href
        # Second pass for "Learn More" if no Apply link
        for a in ext_links.find_all("a", href=True):
            href = a["href"]
            if href.startswith("http"):
                return href

    return detail_url


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> tuple[list[dict], int]:
    """
    Parse one index listing page.

    Returns:
      (listings, max_page)
      listings — list of partial listing dicts; max_page from pagination.
    """
    soup = BeautifulSoup(html, "html.parser")
    containers = soup.find_all("div", class_=re.compile(r"opportunity-container-"))

    listings: list[dict] = []
    for container in containers:
        classes = container.get("class", [])
        is_featured = "opportunity-container-featured" in classes

        # Title
        h2 = container.find("h2")
        title = h2.get_text(strip=True) if h2 else ""
        if not title:
            continue

        # Deadline from opportunity-date paragraph
        date_el = container.find("p", class_="opportunity-date")
        deadline_raw = ""
        if date_el:
            # Strip "X days left" span text
            days_span = date_el.find("span", class_="days-left")
            if days_span:
                days_span.extract()
            deadline_raw = date_el.get_text(strip=True)

        # Detail URL (View button)
        view_link = container.find(
            "a",
            class_="button",
            href=re.compile(r"^/call-for-entry/"),
        )
        detail_url = (
            BASE_URL + view_link["href"]
            if view_link and view_link.get("href")
            else None
        )
        if not detail_url:
            logger.debug("ArtworkArchive: no detail URL for %r — skipping", title[:60])
            continue

        # Description snippet
        ext_section = container.find("section", class_="external_link_security")
        description_snippet = ""
        if ext_section:
            description_snippet = ext_section.get_text(separator=" ", strip=True)

        listing: dict = {
            "title": title,
            "deadline_raw": deadline_raw,
            "detail_url": detail_url,
            "is_featured": is_featured,
            "description_snippet": description_snippet,
        }

        # For featured containers, extract rich inline metadata
        if is_featured:
            info_list_el = container.find("ul", class_="opportunity-info-list")
            info = _extract_info_list(info_list_el)

            # Override deadline from info-list if more precise
            if not deadline_raw and "Submission Deadline" in info:
                deadline_raw = info["Submission Deadline"]
                listing["deadline_raw"] = deadline_raw

            listing["org_name"] = info.get("Organization", "")
            listing["raw_type"] = info.get("Type", "")
            listing["eligibility"] = info.get("Eligibility", "")
            # Fee: prefer structured "Entry Fee" field; fall back to description
            # snippet (many free calls say "No application fees." in their blurb)
            fee_text = info.get("Entry Fee", "")
            if not fee_text and description_snippet:
                fee_text = description_snippet
            listing["fee_text"] = fee_text
            listing["location"] = info.get("Location", "")

        listings.append(listing)

    max_page = _get_max_page(soup)
    return listings, max_page


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, detail_url: str) -> dict:
    """
    Parse a detail page for a basic (sparse) listing.

    Returns a dict with keys matching the listing dict schema:
      org_name, raw_type, eligibility, fee_text, location,
      description, application_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # Info list
    info_list_el = soup.find("ul", class_="opportunity-info-list")
    info = _extract_info_list(info_list_el)

    # Description — the external_link_security section has the full text
    description = ""
    ext_section = soup.find("section", class_="external_link_security")
    if ext_section:
        description = ext_section.get_text(separator="\n", strip=True)
        if len(description) > 2000:
            description = description[:1997] + "..."

    # Application URL
    application_url = _extract_application_url_from_detail(soup, detail_url)

    return {
        "org_name": info.get("Organization", ""),
        "raw_type": info.get("Type", ""),
        "eligibility": info.get("Eligibility", ""),
        "fee_text": info.get("Entry Fee", ""),
        "location": info.get("Location", ""),
        "description": description or None,
        "application_url": application_url,
    }


# ---------------------------------------------------------------------------
# Build call_data for insert
# ---------------------------------------------------------------------------


def _build_call_data(listing: dict, source_id: int) -> Optional[dict]:
    """
    Build the call_data dict for insert_open_call() from a merged listing.

    Returns None if the listing should be skipped (past deadline, no URL, etc.)
    """
    title = listing.get("title", "").strip()
    if not title:
        return None

    detail_url = listing.get("detail_url", "")
    if not detail_url:
        return None

    # Deadline
    deadline = _parse_date(listing.get("deadline_raw", ""))
    if _is_past_deadline(deadline):
        logger.debug(
            "ArtworkArchive: skipping %r — deadline %s already passed",
            title[:60],
            deadline,
        )
        return None

    # Type
    raw_type = listing.get("raw_type", "") or "Other"
    call_type = _classify_type(raw_type)
    if call_type is None:
        logger.debug(
            "ArtworkArchive: skipping %r (type=%r — not an artist opportunity)",
            title[:60],
            raw_type,
        )
        return None

    # Organization
    org_name = (listing.get("org_name") or "").strip() or "Artwork Archive"

    # Application URL — prefer the explicit one from detail; fall back to detail_url
    application_url = (listing.get("application_url") or "").strip() or detail_url

    # Fee
    fee = _parse_fee(listing.get("fee_text", "") or "")

    # Eligibility
    eligibility = (listing.get("eligibility") or "International").strip()

    # Description
    description = (
        listing.get("description") or listing.get("description_snippet") or None
    )
    if description:
        description = description[:2000]

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": detail_url,
        "call_type": call_type,
        "eligibility": eligibility,
        "fee": fee,
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": org_name,
        "metadata": {
            "source": "artwork_archive",
            "organization": org_name,
            "raw_type": raw_type,
            "location": listing.get("location", ""),
            "fee_text": listing.get("fee_text", ""),
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Artwork Archive's open calls board.

    Strategy:
      1. Fetch page 1 to determine total page count from pagination widget.
      2. Iterate pages 1..N extracting all listings.
      3. For featured listings: use inline metadata, no detail fetch needed.
      4. For basic listings: fetch the detail page for org, type, eligibility,
         fee, full description, and application URL.
      5. Skip past-deadline calls.
      6. Insert or update each call via insert_open_call().

    Returns (found, new, updated).

      found   = calls that passed deadline + type filters (eligible to insert)
      new     = successfully inserted (new rows)
      updated = 0 (update is transparent inside insert_open_call via hash dedup)
    """
    source_id = source["id"]
    found = new = updated = 0
    seen_urls: set[str] = set()

    session = _make_session()

    # --- Page 1: discover total page count ---
    html = _fetch(session, INDEX_URL)
    if not html:
        logger.error("ArtworkArchive: failed to fetch page 1 — aborting")
        return 0, 0, 0

    first_page_listings, total_pages = _parse_index_page(html)
    if total_pages == 0:
        logger.warning(
            "ArtworkArchive: could not determine total pages from page 1 pagination"
        )
        total_pages = MAX_PAGES

    total_pages = min(total_pages, MAX_PAGES)
    logger.info("ArtworkArchive: %d total pages to crawl", total_pages)

    # --- Iterate all pages ---
    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            page_listings = first_page_listings
        else:
            time.sleep(DETAIL_FETCH_DELAY)
            page_url = f"{INDEX_URL}?page={page_num}"
            html = _fetch(session, page_url)
            if not html:
                logger.warning(
                    "ArtworkArchive: failed to fetch page %d — skipping", page_num
                )
                continue
            page_listings, _ = _parse_index_page(html)

        if not page_listings:
            logger.info(
                "ArtworkArchive: page %d returned 0 listings — stopping early",
                page_num,
            )
            break

        logger.debug(
            "ArtworkArchive: page %d/%d — %d listings",
            page_num,
            total_pages,
            len(page_listings),
        )

        for listing in page_listings:
            detail_url = listing.get("detail_url", "")

            # Deduplicate within a single crawl run
            if detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)

            # For basic listings, fetch the detail page to fill in metadata
            if not listing.get("is_featured"):
                time.sleep(DETAIL_FETCH_DELAY)
                detail_html = _fetch(session, detail_url)
                if detail_html:
                    detail = _parse_detail_page(detail_html, detail_url)
                    # Merge detail data into listing (detail takes precedence)
                    for key in (
                        "org_name",
                        "raw_type",
                        "eligibility",
                        "fee_text",
                        "location",
                        "description",
                        "application_url",
                    ):
                        if detail.get(key):
                            listing[key] = detail[key]
                else:
                    logger.warning(
                        "ArtworkArchive: could not fetch detail for %r",
                        listing.get("title", "")[:60],
                    )

            call_data = _build_call_data(listing, source_id)
            if call_data is None:
                continue

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1

    logger.info(
        "ArtworkArchive: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
