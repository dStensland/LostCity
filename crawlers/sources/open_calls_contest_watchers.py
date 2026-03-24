"""
Crawler for Contest Watchers (contestwatchers.com/category/open/).

Contest Watchers is a curated aggregator of creative competitions spanning
visual arts, design, photography, filmmaking, architecture, fashion, industrial
design, interior design, multimedia, sculpture, and more. Approximately 51
currently-open contests across 5 paginated listing pages (12 per page).

The site is WordPress-powered and fully server-rendered — no JavaScript
required.  The WP REST API returns HTTP 401 (authentication required), so we
scrape the HTML directly.

Crawl strategy:
  1. Walk listing pages at /category/open/ and /category/open/page/N/ until
     there is no "next page" link (currently ~5 pages of 12 contests each).
  2. For each article card, extract the title, detail URL, is_free flag, and
     organizer slugs from the article's CSS classes.  No deadline is visible on
     the listing card — skip-on-expiry happens at the detail stage.
  3. Fetch each contest detail page to extract:
       - Canonical title (h1)
       - Deadline from dl.meta-list dt="Deadline" dd (e.g. "27 March 2026")
       - Organizer name(s) from dl.meta-list dt="Organizer(s)" dd
       - Full description from div.entry-content
       - Application URL from the "Visit Official Website" anchor
       - Image URL from og:image meta tag
       - Discipline categories from dl.meta-list dt="Published in" dd
  4. Skip contests whose deadline has already passed.
  5. Insert each contest via insert_open_call().

Detail page field notes:
  - Deadline: "27 March 2026" format — parsed with strptime("%d %B %Y").
    Some contests show "Month YYYY" without a day; we treat these as
    day=1 of that month (conservative — means we don't over-prune).
  - Fee: no structured fee field exists on detail pages. We use the presence
    of the "cw-free-mark" badge on the listing card as a reliable free signal;
    without it we cannot determine the fee, so fee=None.
  - Application URL: the "Visit Official Website" button is present on ~95% of
    listings. If absent, we fall back to the contestwatchers.com detail page
    itself, which always links out.
  - call_type: "submission" for all competition entries. Contest Watchers also
    includes residencies (category-residency class) and grants (category-grant
    class); we map those to "residency" and "grant" respectively. Default is
    "submission".
  - Eligibility: listed as "International" for all calls — this is a global
    competition aggregator.
  - confidence_tier: "aggregated" — Contest Watchers is not a primary source.

Rate limiting:
  - 0.5 s between listing pages; 0.6 s between detail page fetches.

Categories mapped to call_type:
  category-residency → residency
  category-grant     → grant
  everything else    → submission
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_LISTING_URL = "https://www.contestwatchers.com/category/open/"
PAGE_URL_TEMPLATE = "https://www.contestwatchers.com/category/open/page/{}/"

MAX_LISTING_PAGES = 30  # Safety cap — site currently has ~5 pages
LISTING_PAGE_DELAY = 0.5  # seconds between listing pages
DETAIL_PAGE_DELAY = 0.6  # seconds between detail page fetches
REQUEST_TIMEOUT = 30  # seconds

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

SOURCE_KEY = "contest-watchers"

# Months map for detail-page deadline parsing
_MONTH_MAP = {
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

# Disciplines that indicate a non-submission call_type
_RESIDENCY_CATEGORIES = {"residency"}
_GRANT_CATEGORIES = {"grant", "scholarship"}


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
            "Referer": "https://www.contestwatchers.com/",
        }
    )
    return session


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a URL and return raw HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ContestWatchers: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# "27 March 2026" or "27 march 2026"
_FULL_DATE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{4})",
    re.IGNORECASE,
)

# "March 2026" — month + year only (no day)
_MONTH_YEAR_RE = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{4})",
    re.IGNORECASE,
)


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse a Contest Watchers deadline string to ISO YYYY-MM-DD.

    Handles two formats found on detail pages:
      "27 March 2026"  → "2026-03-27"
      "March 2026"     → "2026-03-01"  (day=1 when day is absent)

    Returns None if the text cannot be parsed.
    """
    text = text.strip()
    if not text:
        return None

    # Try full date first
    m = _FULL_DATE_RE.search(text)
    if m:
        day = int(m.group(1))
        month = _MONTH_MAP.get(m.group(2).lower())
        year = int(m.group(3))
        if month:
            try:
                return date(year, month, day).isoformat()
            except ValueError:
                pass

    # Try month + year only (day defaults to 1)
    m = _MONTH_YEAR_RE.search(text)
    if m:
        month = _MONTH_MAP.get(m.group(1).lower())
        year = int(m.group(2))
        if month:
            try:
                return date(year, month, 1).isoformat()
            except ValueError:
                pass

    logger.debug("ContestWatchers: could not parse deadline %r", text)
    return None


def _is_past_deadline(deadline_iso: Optional[str]) -> bool:
    """Return True if the deadline date is strictly in the past."""
    if not deadline_iso:
        return False
    try:
        return date.fromisoformat(deadline_iso) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# call_type inference
# ---------------------------------------------------------------------------


def _infer_call_type(article_classes: list[str]) -> str:
    """
    Derive call_type from article CSS classes on the listing card.

    Contest Watchers encodes categories as class names:
      category-residency → "residency"
      category-grant     → "grant"
      category-scholarship → "grant"
      all others         → "submission"

    This is more reliable than parsing the detail page "Published in" tags
    because the class is always present and machine-readable.
    """
    for cls in article_classes:
        if cls.startswith("category-"):
            slug = cls[len("category-") :]
            if slug in _RESIDENCY_CATEGORIES:
                return "residency"
            if slug in _GRANT_CATEGORIES:
                return "grant"
    return "submission"


# ---------------------------------------------------------------------------
# Listing page parsing
# ---------------------------------------------------------------------------


def _parse_listing_page(html: str) -> list[dict]:
    """
    Extract contest stub data from one listing page.

    Each <article> element encodes most of what we need in its CSS class list:
      - title: h3.entry-title > a text content
      - detail_url: h3.entry-title > a href
      - is_free: presence of span.cw-free-mark
      - call_type: inferred from category-* classes
      - organizer_slugs: organizer-* class values (slug format)

    Returns a list of stub dicts.
    """
    soup = BeautifulSoup(html, "html.parser")
    articles = soup.find_all("article")
    stubs: list[dict] = []

    for article in articles:
        # Title and detail URL
        h3 = article.find("h3", class_="entry-title")
        if not h3:
            continue
        link = h3.find("a", href=True)
        if not link:
            continue

        title = link.get_text(strip=True)
        detail_url = link["href"].strip()
        if not title or not detail_url.startswith("http"):
            continue

        classes = article.get("class", [])

        # Free signal from the listing card badge
        is_free = bool(article.find("span", class_="cw-free-mark"))

        # call_type from category classes
        call_type = _infer_call_type(classes)

        # Organizer slugs (may be multiple)
        organizer_slugs = [
            cls[len("organizer-") :] for cls in classes if cls.startswith("organizer-")
        ]

        # Discipline categories (excluding meta-categories like open/annual/free)
        _SKIP_CATS = {"open", "annual", "biannual", "free", "students-only", "workshop"}
        discipline_cats = [
            cls[len("category-") :]
            for cls in classes
            if cls.startswith("category-") and cls[len("category-") :] not in _SKIP_CATS
        ]

        stubs.append(
            {
                "title": title,
                "detail_url": detail_url,
                "is_free": is_free,
                "call_type": call_type,
                "organizer_slugs": organizer_slugs,
                "discipline_cats": discipline_cats,
            }
        )

    return stubs


def _has_next_page(html: str) -> bool:
    """Return True if there is a 'next page' link in the WP pagination block."""
    soup = BeautifulSoup(html, "html.parser")
    return bool(soup.find("a", class_="next page-numbers"))


# ---------------------------------------------------------------------------
# Detail page parsing
# ---------------------------------------------------------------------------

# dt text → normalized key for our parsing logic
_DT_KEY_MAP = {
    "deadline": "deadline",
    "organizer(s)": "organizers",
    "organizer": "organizers",
    "published in": "published_in",
}


def _extract_meta_list(soup: BeautifulSoup) -> dict[str, str]:
    """
    Parse all dl.meta-list definition lists on the page.

    Returns a dict mapping normalized dt text → raw dd text.
    Multiple dl blocks are merged; later values do NOT override earlier ones
    so that the primary (first) Deadline field wins.
    """
    result: dict[str, str] = {}
    for dl in soup.find_all("dl", class_="meta-list"):
        dts = dl.find_all("dt")
        for dt in dts:
            raw_key = dt.get_text(strip=True).lower()
            key = _DT_KEY_MAP.get(raw_key, raw_key)
            if key in result:
                continue  # first occurrence wins
            dd = dt.find_next_sibling("dd")
            if dd:
                result[key] = dd.get_text(strip=True)
    return result


def _parse_detail_page(html: str, source_url: str) -> dict:
    """
    Extract full contest data from a detail page.

    Returns a dict with:
      title           — canonical title from h1
      description     — body text from div.entry-content (up to 3000 chars)
      deadline        — ISO date string or None
      application_url — organizer's URL or contestwatchers.com page as fallback
      image_url       — og:image URL or None
      organizers      — human-readable organizer name string
      published_in    — raw "Published in" category text
    """
    soup = BeautifulSoup(html, "html.parser")

    # Canonical title
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else ""

    # Structured metadata from dl.meta-list blocks
    meta = _extract_meta_list(soup)

    # Deadline
    deadline_raw = meta.get("deadline", "")
    # Strip trailing context like "[ 2+ days remaining ]"
    deadline_clean = re.sub(r"\[.*?\]", "", deadline_raw).strip()
    deadline = _parse_deadline(deadline_clean)

    # Organizers
    organizers = meta.get("organizers", "").strip()

    # Application URL: "Visit Official Website" anchor
    application_url = source_url  # fallback to CW page
    visit_link = soup.find(
        "a", string=re.compile(r"Visit Official Website", re.IGNORECASE)
    )
    if visit_link and visit_link.get("href", "").startswith("http"):
        application_url = visit_link["href"].strip()

    # Description: entry-content, stripped of navigation/sidebar noise
    description: Optional[str] = None
    content_div = soup.find("div", class_="entry-content")
    if content_div:
        # Remove script/style tags but keep paragraphs and lists
        for tag in content_div.find_all(["script", "style"]):
            tag.decompose()
        text = content_div.get_text(separator="\n", strip=True)
        text = text.strip()
        if text:
            description = text[:3000]

    # og:image
    og_img = soup.find("meta", property="og:image")
    image_url = og_img.get("content", "").strip() if og_img else None
    if image_url == "":
        image_url = None

    # Published in (discipline categories)
    published_in = meta.get("published in", "").strip()

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "image_url": image_url,
        "organizers": organizers,
        "published_in": published_in,
    }


# ---------------------------------------------------------------------------
# Organizer name helper
# ---------------------------------------------------------------------------


def _primary_organizer(organizer_slugs: list[str], organizers_text: str) -> str:
    """
    Return the best available organizer name for slug generation.

    Priority:
      1. organizers_text from detail page (human-readable, first listed)
      2. First organizer slug from listing card (already hyphen-separated)
      3. Fallback: SOURCE_KEY
    """
    if organizers_text:
        # Take first organizer when multiple are listed (comma or slash separated)
        primary = re.split(r"[,/]", organizers_text)[0].strip()
        if primary:
            return primary

    if organizer_slugs:
        # Convert slug back to readable: "communication-arts" → "communication-arts"
        # (we keep it slug-form; slug generation in db.open_calls handles the rest)
        return organizer_slugs[0]

    return SOURCE_KEY


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Contest Watchers open calls.

    Strategy:
      1. Walk listing pages at /category/open/ until no "next page" link.
      2. Collect contest stubs (title, URL, free flag, call_type).
      3. For each stub, fetch the detail page to get deadline, description,
         organizer, and application URL.
      4. Skip if deadline has already passed.
      5. Insert via insert_open_call().

    Returns (found, new, updated).
      found   = contests that passed the deadline filter
      new     = successfully inserted new rows
      updated = currently 0 (insert_open_call handles dedup transparently)
    """
    source_id: int = source["id"]
    found = new = updated = 0
    seen_urls: set[str] = set()

    session = _make_session()

    for page_num in range(1, MAX_LISTING_PAGES + 1):
        if page_num == 1:
            listing_url = BASE_LISTING_URL
        else:
            listing_url = PAGE_URL_TEMPLATE.format(page_num)

        if page_num > 1:
            time.sleep(LISTING_PAGE_DELAY)

        listing_html = _fetch(session, listing_url)
        if not listing_html:
            logger.warning(
                "ContestWatchers: failed to fetch listing page %d — stopping",
                page_num,
            )
            break

        stubs = _parse_listing_page(listing_html)
        if not stubs:
            logger.info(
                "ContestWatchers: page %d returned 0 articles — done",
                page_num,
            )
            break

        logger.debug(
            "ContestWatchers: listing page %d — %d articles",
            page_num,
            len(stubs),
        )

        for stub in stubs:
            detail_url = stub["detail_url"]

            # Guard against duplicates within a single run
            if detail_url in seen_urls:
                continue
            seen_urls.add(detail_url)

            # Fetch detail page
            time.sleep(DETAIL_PAGE_DELAY)
            detail_html = _fetch(session, detail_url)
            if not detail_html:
                logger.warning(
                    "ContestWatchers: failed to fetch detail page %s — skipping",
                    detail_url,
                )
                continue

            detail = _parse_detail_page(detail_html, detail_url)

            # Use canonical title from detail page; fall back to listing card title
            title = detail["title"] or stub["title"]
            if not title:
                logger.debug("ContestWatchers: skipping — no title at %s", detail_url)
                continue

            # Deadline check — skip past-deadline contests
            deadline = detail["deadline"]
            if _is_past_deadline(deadline):
                logger.debug(
                    "ContestWatchers: skipping expired contest — deadline %s — %s",
                    deadline,
                    title[:60],
                )
                continue

            # Application URL must exist
            application_url = detail["application_url"]
            if not application_url:
                application_url = detail_url  # always valid

            # Fee: only 0.0 when the listing card explicitly marks it free
            fee: Optional[float] = 0.0 if stub["is_free"] else None

            # call_type from listing card class inference
            call_type = stub["call_type"]

            # Organizer for slug generation
            org_name = _primary_organizer(stub["organizer_slugs"], detail["organizers"])

            found += 1
            call_data = {
                "title": title,
                "description": detail["description"],
                "deadline": deadline,
                "application_url": application_url,
                "source_url": detail_url,
                "call_type": call_type,
                "eligibility": "International",
                "fee": fee,
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": org_name,
                "metadata": {
                    "source": SOURCE_KEY,
                    "organizers": detail["organizers"],
                    "organizer_slugs": stub["organizer_slugs"],
                    "disciplines": stub["discipline_cats"],
                    "published_in": detail["published_in"],
                    "is_free": stub["is_free"],
                    "image_url": detail["image_url"],
                    "scope": "international",
                },
            }

            result = insert_open_call(call_data)
            if result:
                new += 1

        # Stop when there is no next-page pagination link
        if not _has_next_page(listing_html):
            logger.info(
                "ContestWatchers: no next-page link on listing page %d — done",
                page_num,
            )
            break

    logger.info(
        "ContestWatchers: crawl complete — %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
