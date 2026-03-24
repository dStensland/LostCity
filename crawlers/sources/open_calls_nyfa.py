"""
Crawler for NYFA Source (New York Foundation for the Arts) open calls.

NYFA Source is one of the most widely used national aggregators for artist
opportunities: grants, residencies, fellowships, open calls, competitions,
commissions, and exhibition proposals. It is NOT a primary source — it
aggregates calls posted by arts organizations — so confidence_tier is
"aggregated".

Crawl strategy:
  Two-phase approach:

  Phase 1 — List collection via public REST API (no Playwright needed):
    GET https://api.nyfa.org/api/client/listing/opportunities
        ?page=N&pageSize=21&...

    Returns JSON: { listings: [...], featuredListings: [...],
                    totalListingCount: N, numberOfPages: N }

    Each listing contains: listingId, title, organization, opportunityType,
    city, state, country, isFeatured, postOnString.

  Phase 2 — Detail fetch via Playwright (JS-rendered):
    https://www.nyfa.org/opportunities/opportunity-info?id={listingId}

    The page is a WordPress site with a React/vanilla-JS frontend that loads
    the detail content from the same REST API and renders it into:
      .CRMItemWrapper            — main detail container
      .itemConditions            — location + type + disciplines
      .itemInfo.userContentText  — description + "How to apply" sections
      .itemSmallInfoTitle        — "Application Deadline" + "Application Fee"

Opportunity type mapping (from NYFA's taxonomy → our call_type):
  Keep:
    Audition               → submission
    Award/Fellowship       → grant
    Call for Entry/Open Call → submission
    Competition            → submission
    Grant                  → grant
    Residency/Artist Colony → residency

  Skip:
    Job                    — employment listings, not art opportunities
    Internship             — employment listings
    Professional Development — services/coaching, not opportunities for artists
    Workshop/Class         — educational services, not opportunities
    Services for Artists   — commercial listings, not opportunities

Pagination:
  The API returns up to 21 items per page. We iterate through all pages.
  Featured listings are included in the regular listing set on each page;
  the API also returns a separate `featuredListings` array on page 1 only.
  We deduplicate by listingId to avoid double-counting featured items.

Rate limiting:
  We add a short delay between detail fetches to be a courteous crawler.

Cloudflare:
  nyfa.org uses a Cloudflare managed challenge on detail pages. Reusing a
  single browser context across sequential navigations triggers the challenge
  on pages 2+. We work around this by allocating one fresh browser context per
  detail page (sharing the same browser process), which behaves like a new
  user visit and clears the CF fingerprint check reliably.
"""

import asyncio
import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LIST_API_URL = "https://api.nyfa.org/api/client/listing/opportunities"
DETAIL_URL_TEMPLATE = "https://www.nyfa.org/opportunities/opportunity-info?id={}"
SOURCE_URL = "https://www.nyfa.org/opportunities/"

PAGE_SIZE = 21
# Delay in seconds between detail page fetches (be polite to NYFA's servers)
DETAIL_FETCH_DELAY = 1.5
# Max pages to crawl per run — NYFA board fluctuates around 80-120 listings
MAX_PAGES = 10

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Opportunity types we skip — employment, commercial services, or education
_SKIP_TYPES = frozenset({
    "job",
    "internship",
    "professional development",
    "workshop/class",
    "services for artists",
    "degree program",
})

# NYFA type label → our call_type
# Unlisted types fall through to a "submission" default in _classify_type().
_TYPE_MAP = {
    "audition": "submission",
    "award/fellowship": "grant",
    "call for entry/open call": "submission",
    "competition": "submission",
    "grant": "grant",
    "residency/artist colony": "residency",
    # NYFA occasionally uses discipline names as type labels (e.g. "Photography/Video")
    # when the listing is a residency or fellowship. Treat as submission; the title
    # and description will make the actual nature clear on the Arts portal.
    "photography/video": "submission",
    "film/video": "submission",
    "music": "submission",
    "dance": "submission",
    "theatre": "submission",
    "literature": "submission",
    "multidisciplinary": "submission",
}

# Month name → int for deadline parsing
_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------------------------------------------------------------------------
# Type helpers
# ---------------------------------------------------------------------------


def _classify_type(opp_type_raw: str) -> Optional[str]:
    """
    Map a raw NYFA opportunity type string to our call_type, or return None
    to signal that this listing should be skipped.
    """
    normalized = opp_type_raw.strip().lower()
    if normalized in _SKIP_TYPES:
        return None
    return _TYPE_MAP.get(normalized, "submission")  # default: treat as submission


# ---------------------------------------------------------------------------
# Date / fee parsers
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse a deadline string into 'YYYY-MM-DD'.

    Handles:
      "04/09/2026"          — MM/DD/YYYY (from itemSmallInfoTitle sibling)
      "March 25, 2026"      — Month D, YYYY
      "2026-03-25"          — already ISO
    Returns None if unparseable.
    """
    if not text:
        return None
    text = text.strip()

    # MM/DD/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if m:
        month, day, year = m.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # ISO already
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})$", text)
    if m:
        return text

    # Month D, YYYY  or  Month D YYYY
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
    """
    Extract a dollar amount from an Application Fee string.

    '$35.00 for up to 3 entries' → 35.0
    '$25'                         → 25.0
    Returns None if no dollar amount found.
    """
    if not text:
        return None
    m = re.search(r"\$\s*(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed (compared to today)."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Phase 1 — Listing API
# ---------------------------------------------------------------------------


def _fetch_listings_page(session: requests.Session, page: int) -> Optional[dict]:
    """
    Fetch one page of listings from the NYFA API.
    Returns the parsed JSON or None on failure.
    """
    params = {
        "q": "",
        "location": "",
        "noFeeApplication": "",
        "opportunityType": "",
        "opportunityDiscipline": "",
        "oppRemoteType": "",
        "page": page,
        "pageSize": PAGE_SIZE,
    }
    try:
        resp = session.get(LIST_API_URL, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning("NYFA: failed to fetch listings page %d: %s", page, exc)
        return None


def _collect_all_listing_ids(session: requests.Session) -> list[dict]:
    """
    Iterate through all API pages and return a deduplicated list of
    listing dicts with keys: listingId, title, organization, opportunityType,
    city, state, country.
    """
    seen_ids: set[str] = set()
    all_listings: list[dict] = []

    for page_num in range(1, MAX_PAGES + 1):
        data = _fetch_listings_page(session, page_num)
        if not data:
            logger.warning("NYFA: empty response for page %d, stopping", page_num)
            break

        # Page 1 includes featured listings separately; merge them
        page_listings: list[dict] = list(data.get("listings", []))
        if page_num == 1:
            for featured in data.get("featuredListings", []):
                lid = featured.get("listingId")
                if lid and lid not in seen_ids:
                    page_listings.insert(0, featured)

        added = 0
        for listing in page_listings:
            lid = listing.get("listingId")
            if not lid or lid in seen_ids:
                continue
            seen_ids.add(lid)
            all_listings.append(listing)
            added += 1

        total_pages = data.get("numberOfPages", 1)
        logger.debug(
            "NYFA: page %d/%d — %d new listings (total so far: %d)",
            page_num, total_pages, added, len(all_listings),
        )

        if page_num >= total_pages:
            break

    logger.info("NYFA: collected %d unique listing IDs", len(all_listings))
    return all_listings


# ---------------------------------------------------------------------------
# Phase 2 — Detail parsing (Playwright)
# ---------------------------------------------------------------------------


def _parse_detail_html(html: str, listing_id: str) -> dict:
    """
    Parse the rendered detail page HTML and extract all available fields.

    Returns a dict with keys:
      description, deadline, fee, application_url, disciplines, location
    """
    result: dict = {
        "description": None,
        "deadline": None,
        "fee": None,
        "application_url": None,
        "disciplines": None,
        "location": None,
    }

    soup = BeautifulSoup(html, "html.parser")
    crm = soup.find(class_="CRMItemWrapper")
    if not crm:
        logger.debug("NYFA: no CRMItemWrapper found for listing %s", listing_id)
        return result

    # --- Location, type, disciplines from itemConditions ---
    conditions = crm.find(class_="itemConditions")
    if conditions:
        cond_lines = conditions.find_all(class_="conditionLine")
        for line in cond_lines:
            text = line.get_text(separator=" ", strip=True)
            classes = " ".join(line.get("class", []))
            if "globe" in classes:
                result["location"] = text or None
            elif "list" in classes:
                # "Opportunity Disciplines: Drawing, Painting, ..."
                m = re.search(r"Disciplines?:\s*(.+)", text, re.I)
                if m:
                    result["disciplines"] = m.group(1).strip()

    # --- Structured metadata: deadline + fee from itemSmallInfoTitle ---
    for title_el in crm.find_all(class_="itemSmallInfoTitle"):
        label = title_el.get_text(strip=True).lower()
        sibling = title_el.find_next_sibling()
        if not sibling:
            continue
        value = sibling.get_text(strip=True)

        if "deadline" in label:
            result["deadline"] = _parse_deadline(value)
        elif "fee" in label:
            result["fee"] = _parse_fee(value)

    # --- Description from itemInfo sections ---
    item_info = crm.find(class_="itemInfo")
    if item_info:
        desc_parts: list[str] = []
        in_description_section = False

        for child in item_info.children:
            if not hasattr(child, "name") or not child.name:
                continue
            child_classes = " ".join(child.get("class", []))

            if "itemInfoTitle" in child_classes:
                section_name = child.get_text(strip=True).lower()
                in_description_section = "description" in section_name
                continue

            if "itemSmallInfoTitle" in child_classes:
                # Stop capturing at the metadata block
                break

            if in_description_section:
                text = child.get_text(separator=" ", strip=True)
                if text:
                    desc_parts.append(text)

        if desc_parts:
            description = " ".join(desc_parts).strip()
            result["description"] = description[:3000] if description else None

    # --- Application URL ---
    # Priority order:
    #   1. <a href> links in the "How to apply" section (not nyfa.org, not mailto)
    #   2. Plain-text URLs in the "How to apply" section (some listings paste URLs
    #      as text rather than hyperlinks, e.g. callforentry.org links)
    #   3. <a href> links in the Description section (fallback)
    #   4. NYFA detail page URL (last resort — always works as a reference)
    _URL_RE = re.compile(r"https?://[^\s,)>\"']+")

    apply_href_links: list[str] = []
    apply_text_links: list[str] = []
    desc_href_links: list[str] = []

    item_info = crm.find(class_="itemInfo")
    if item_info:
        in_apply = False
        in_desc = False
        for child in item_info.children:
            if not hasattr(child, "name") or not child.name:
                continue
            child_classes = " ".join(child.get("class", []))

            if "itemInfoTitle" in child_classes:
                section = child.get_text(strip=True).lower()
                in_apply = "how to apply" in section
                in_desc = "description" in section
                continue

            if "itemSmallInfoTitle" in child_classes:
                break  # Reached metadata block, stop

            if in_apply:
                # Collect <a href> links
                for a in child.find_all("a", href=True):
                    href = a["href"]
                    if href.startswith("http") and "nyfa.org" not in href:
                        apply_href_links.append(href)
                # Also collect plain-text URLs
                text = child.get_text(separator=" ", strip=True)
                for match in _URL_RE.findall(text):
                    if "nyfa.org" not in match:
                        apply_text_links.append(match.rstrip(".,"))

            elif in_desc:
                for a in child.find_all("a", href=True):
                    href = a["href"]
                    if href.startswith("http") and "nyfa.org" not in href:
                        desc_href_links.append(href)

    # Pick best application URL
    if apply_href_links:
        result["application_url"] = apply_href_links[0]
    elif apply_text_links:
        result["application_url"] = apply_text_links[0]
    elif desc_href_links:
        result["application_url"] = desc_href_links[0]
    else:
        # Last resort: the NYFA detail page URL is always a valid reference
        result["application_url"] = DETAIL_URL_TEMPLATE.format(listing_id)

    return result


async def _fetch_one_detail(
    browser,
    listing_id: str,
) -> dict:
    """
    Fetch and parse a single NYFA detail page.

    Uses a fresh browser context per request. This is necessary because
    nyfa.org's Cloudflare protection fingerprints browser context state —
    reusing the same context across sequential navigations triggers the
    managed challenge on page 2+, blocking content delivery. A fresh context
    per page behaves like a new user visit and clears the challenge reliably.
    """
    url = DETAIL_URL_TEMPLATE.format(listing_id)
    ctx = await browser.new_context(
        user_agent=USER_AGENT,
        extra_http_headers={
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        page = await ctx.new_page()
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        # Cloudflare managed challenge resolves within ~5s; then content renders.
        # wait_for_selector with 15s covers both the CF resolution window and
        # the subsequent JS rendering of the CRMItemWrapper.
        try:
            await page.wait_for_selector(".CRMItemWrapper", timeout=15000)
        except Exception:
            logger.debug(
                "NYFA: .CRMItemWrapper not found for %s — listing may be"
                " expired or removed",
                listing_id,
            )
        html = await page.content()
        return _parse_detail_html(html, listing_id)
    except Exception as exc:
        logger.warning("NYFA: failed to fetch detail for %s: %s", listing_id, exc)
        return {}
    finally:
        await ctx.close()


async def _fetch_detail_pages(
    listing_ids: list[str],
) -> dict[str, dict]:
    """
    Fetch all detail pages using a single shared Playwright browser instance
    with one fresh browser context per page.

    Returns a mapping of listingId → parsed detail dict.
    """
    results: dict[str, dict] = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )

        for i, listing_id in enumerate(listing_ids):
            results[listing_id] = await _fetch_one_detail(browser, listing_id)

            if i < len(listing_ids) - 1:
                await asyncio.sleep(DETAIL_FETCH_DELAY)

        await browser.close()

    return results


def _run_detail_fetches(listing_ids: list[str]) -> dict[str, dict]:
    """Synchronous wrapper around the async detail fetch."""
    return asyncio.run(_fetch_detail_pages(listing_ids))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl NYFA Source open calls board.

    Strategy:
      1. Collect all listing IDs + basic metadata via the public REST API.
      2. Filter out skip-types (jobs, workshops, professional development).
      3. Fetch detail pages for remaining listings via Playwright.
      4. Skip past-deadline calls.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    # Phase 1: collect listings from the API
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Referer": "https://www.nyfa.org/",
        "Origin": "https://www.nyfa.org",
    })

    all_listings = _collect_all_listing_ids(session)
    if not all_listings:
        logger.warning("NYFA: no listings collected from API, aborting")
        return 0, 0, 0

    # Filter to actionable types before fetching detail pages
    actionable: list[dict] = []
    skipped_type = 0
    for listing in all_listings:
        raw_type = listing.get("opportunityType", "")
        call_type = _classify_type(raw_type)
        if call_type is None:
            skipped_type += 1
            logger.debug(
                "NYFA: skipping '%s' (type=%s)", listing.get("title", "")[:60], raw_type
            )
            continue
        listing["_call_type"] = call_type
        actionable.append(listing)

    logger.info(
        "NYFA: %d listings total — %d actionable, %d skipped (non-artist type)",
        len(all_listings), len(actionable), skipped_type,
    )

    if not actionable:
        return 0, 0, 0

    # Phase 2: fetch detail pages
    listing_ids = [item["listingId"] for item in actionable]
    logger.info("NYFA: fetching %d detail pages via Playwright…", len(listing_ids))
    details = _run_detail_fetches(listing_ids)

    # Phase 3: build and insert open calls
    for listing in actionable:
        listing_id = listing["listingId"]
        detail = details.get(listing_id, {})

        title = listing.get("title", "").strip()
        if not title:
            continue

        deadline = detail.get("deadline")

        # Skip past-deadline calls
        if _is_past_deadline(deadline):
            logger.debug(
                "NYFA: skipping '%s' — deadline %s already passed", title[:60], deadline
            )
            continue

        found += 1

        # Build location string from API fields (more reliable than parsed HTML)
        location_parts = [
            p for p in [listing.get("city"), listing.get("state"), listing.get("country")]
            if p
        ]
        location = ", ".join(location_parts) if location_parts else detail.get("location")

        call_type = listing["_call_type"]
        application_url = (
            detail.get("application_url")
            or DETAIL_URL_TEMPLATE.format(listing_id)
        )
        source_url = DETAIL_URL_TEMPLATE.format(listing_id)

        call_data: dict = {
            "title": title,
            "description": detail.get("description"),
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": "National",  # NYFA Source is US-national by default
            "fee": detail.get("fee"),
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": listing.get("organization", "nyfa"),
            "metadata": {
                "listing_id": listing_id,
                "organization": listing.get("organization"),
                "opportunity_type": listing.get("opportunityType"),
                "disciplines": detail.get("disciplines"),
                "location": location,
                "is_featured": listing.get("isFeatured", False),
                "posted_on": listing.get("postOnString"),
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    logger.info(
        "NYFA: %d found (skipped past-deadline), %d new, %d updated",
        found, new, updated,
    )
    return found, new, updated
