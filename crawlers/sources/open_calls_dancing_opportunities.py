"""
Crawler for Dancing Opportunities dance open calls (dancingopportunities.com).

Dancing Opportunities is the world's largest aggregator of dance open calls,
auditions, and residencies. It is a WordPress site using the Extra/Divi theme.

Crawl strategy — WordPress REST API (single-phase, no detail page fetches):

  The site exposes a standard WordPress REST API at /wp-json/wp/v2/posts.
  Each API response includes full post content, so no per-post detail fetch
  is required. The pagination visits all available pages per category until
  the API signals no more results (page > X-WP-TotalPages).

  Categories crawled:
    auditions   (cat_id=5)  — casting calls, company auditions
    open-calls  (cat_id=623)— choreography/performance open calls
    residencies (cat_id=11) — artist residencies

  Per-post extraction from the content field:
    Deadline  — regex scan for "Deadline for applications:" (and variants)
                Returns the LATEST future deadline found (some posts list
                multiple application periods).
    App URL   — first external link in the post content not belonging to
                dancingopportunities.com or social media domains.
                Falls back to the post's own page URL.
    Org name  — scraped from the post's "For further information, please
                visit ..." pattern or inferred from the application URL host.

Date formats seen in the wild (all are free-text, regexed):
  "March 28, 2026"
  "April 6th"              — no year; year inferred from post date
  "26th March @ 5pm"
  "March 30th, 2026"
  "Until May 3 2026"
  "Three application periods: The first deadline is March 27th ..."

Category → call_type mapping:
  auditions   → "submission"  (dancers submit themselves)
  open-calls  → "submission"
  residencies → "residency"

Confidence tier: "aggregated" — Dancing Opportunities is an aggregator, not
  the issuing organisation.
Eligibility: "International" — the site explicitly covers international
  opportunities, and each post confirms the geography in the content.

Rate limiting: 0.5s between API page fetches (not between posts — each API
  call returns up to 100 posts).

Past-deadline filtering: posts whose LATEST future deadline is in the past
  are skipped. Posts with NO parseable deadline are included (open-ended calls
  are common in the dance world — e.g. "ongoing" residencies).
"""

import html as html_module
import logging
import re
import time
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://dancingopportunities.com"
API_BASE = f"{BASE_URL}/wp-json/wp/v2/posts"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30
PAGE_DELAY_S = 0.5   # delay between API page fetches
POSTS_PER_PAGE = 100  # WordPress REST API max is 100

# Posts published more than this many days ago with no parseable deadline are
# skipped — the call is assumed closed/expired. The site keeps old posts live
# indefinitely, so without a recency cutoff we'd ingest 2016-era listings.
NO_DEADLINE_MAX_AGE_DAYS = 365

# Stop paginating a category when ALL posts on a page are older than this.
# Since the API returns posts newest-first, once we hit an all-stale page we
# can stop rather than fetching more historical pages.
PAGINATION_CUTOFF_DAYS = 400

# Category ID → (slug, call_type)
CATEGORIES: list[tuple[int, str, str]] = [
    (5,   "auditions",   "submission"),
    (623, "open-calls",  "submission"),
    (11,  "residencies", "residency"),
]

# Social/CDN/aggregator domains to skip when extracting application_url
_SKIP_DOMAINS = {
    "dancingopportunities.com",
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "youtube.com",
    "vimeo.com",
    "linkedin.com",
    "tiktok.com",
    "t.co",
    "bit.ly",
    "google.com",
    "docs.google.com",  # keep forms.gle (Google Forms)
    "pinterest.com",
    "snapchat.com",
    "soundcloud.com",
}

# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


# ---------------------------------------------------------------------------
# API pagination
# ---------------------------------------------------------------------------


def _fetch_api_page(
    session: requests.Session,
    category_id: int,
    page: int,
) -> tuple[list[dict], int]:
    """
    Fetch one page of posts from the WordPress REST API.

    Returns (posts, total_pages).
    posts is an empty list on error.
    total_pages is 0 on error or when the header is absent.
    """
    params = {
        "categories": category_id,
        "per_page": POSTS_PER_PAGE,
        "page": page,
        "_fields": "id,title,link,excerpt,content,date",
    }
    try:
        resp = session.get(API_BASE, params=params, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 400 and page > 1:
            # WordPress returns 400 when page > total pages
            return [], 0
        resp.raise_for_status()
        total_pages = int(resp.headers.get("X-WP-TotalPages", 0))
        return resp.json(), total_pages
    except requests.RequestException as exc:
        logger.warning(
            "DancingOpportunities: category %d page %d fetch error — %s",
            category_id,
            page,
            exc,
        )
        return [], 0


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# Month name → int
_MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# "March 28, 2026" / "March 30th, 2026" / "28 March 2026" / "Until May 3 2026"
_DATE_RE_NAMED = re.compile(
    r"(?P<month>[A-Za-z]{3,9})\s+(?P<day>\d{1,2})(?:st|nd|rd|th)?,?\s+(?P<year>\d{4})"
    r"|"
    r"(?P<day2>\d{1,2})(?:st|nd|rd|th)?\s+(?P<month2>[A-Za-z]{3,9}),?\s+(?P<year2>\d{4})"
    r"|"
    r"(?P<day3>\d{1,2})(?:st|nd|rd|th)?\s+(?P<month3>[A-Za-z]{3,9})\s+@"  # "26th March @"
)

# "2026-03-28" ISO dates (rare but possible in structured posts)
_DATE_RE_ISO = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")


def _extract_year_from_context(post_date_str: str) -> int:
    """
    Return the year to use when the deadline lacks a year.

    Uses the post publication year. If the post was published in Dec and
    the deadline month appears to be Jan-Mar, assume next year.
    """
    try:
        pub_year = int(post_date_str[:4])
        # If published late in the year, deadlines in early months may be next
        # year — handled downstream when we compare the parsed date to today.
        return pub_year
    except (ValueError, IndexError):
        return date.today().year


def _parse_named_date(text: str, fallback_year: int) -> Optional[str]:
    """
    Parse a date from free-text containing a month name.

    Returns "YYYY-MM-DD" or None.
    """
    for m in _DATE_RE_NAMED.finditer(text):
        g = m.groupdict()
        # Pattern 1: Month DD, YYYY
        if g.get("month") and g.get("day") and g.get("year"):
            month_key = g["month"].lower()[:3]
            month = _MONTH_MAP.get(month_key) or _MONTH_MAP.get(g["month"].lower())
            if not month:
                continue
            try:
                day = int(g["day"])
                year = int(g["year"])
                date(year, month, day)  # validate
                return f"{year}-{month:02d}-{day:02d}"
            except ValueError:
                continue
        # Pattern 2: DD Month YYYY
        if g.get("day2") and g.get("month2") and g.get("year2"):
            month_key = g["month2"].lower()[:3]
            month = _MONTH_MAP.get(month_key) or _MONTH_MAP.get(g["month2"].lower())
            if not month:
                continue
            try:
                day = int(g["day2"])
                year = int(g["year2"])
                date(year, month, day)
                return f"{year}-{month:02d}-{day:02d}"
            except ValueError:
                continue
        # Pattern 3: "26th March @" — no year, use fallback
        if g.get("day3") and g.get("month3"):
            month_key = g["month3"].lower()[:3]
            month = _MONTH_MAP.get(month_key) or _MONTH_MAP.get(g["month3"].lower())
            if not month:
                continue
            try:
                day = int(g["day3"])
                year = fallback_year
                date(year, month, day)
                return f"{year}-{month:02d}-{day:02d}"
            except ValueError:
                continue
    return None


def _parse_date_fragment(text: str, fallback_year: int) -> Optional[str]:
    """
    Try to parse a date out of a text fragment (the value after "Deadline:").

    Also handles "Month DDth" (no year) → year from post date.
    Handles "April 6th" (no year).
    """
    # Try ISO first
    iso = _DATE_RE_ISO.search(text)
    if iso:
        y, mo, d = int(iso.group(1)), int(iso.group(2)), int(iso.group(3))
        try:
            date(y, mo, d)
            return f"{y}-{mo:02d}-{d:02d}"
        except ValueError:
            pass

    # Named month with year
    result = _parse_named_date(text, fallback_year)
    if result:
        return result

    # "Month DDth" with no year — e.g. "April 6th"
    no_year_re = re.compile(
        r"([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?"
        r"|"
        r"(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})"
    )
    for m in no_year_re.finditer(text):
        g = m.groups()
        if g[0] and g[1]:
            month_key = g[0].lower()[:3]
            month = _MONTH_MAP.get(month_key)
            if month:
                try:
                    day = int(g[1])
                    year = fallback_year
                    date(year, month, day)
                    return f"{year}-{month:02d}-{day:02d}"
                except ValueError:
                    pass
        if g[2] and g[3]:
            month_key = g[3].lower()[:3]
            month = _MONTH_MAP.get(month_key)
            if month:
                try:
                    day = int(g[2])
                    year = fallback_year
                    date(year, month, day)
                    return f"{year}-{month:02d}-{day:02d}"
                except ValueError:
                    pass
    return None


# Deadline label patterns (case-insensitive)
_DEADLINE_LABEL_RE = re.compile(
    r"(?:deadline(?:\s+for\s+applications?)?|applications?\s+due|apply\s+by|submit\s+by)"
    r"\s*:?\s*",
    re.I,
)


def _extract_deadlines(text: str, post_date: str) -> list[str]:
    """
    Extract all deadline dates from post content text.

    Returns a list of "YYYY-MM-DD" strings (may be empty).
    Multiple deadlines are common ("Three application periods...").
    """
    fallback_year = _extract_year_from_context(post_date)
    deadlines: list[str] = []
    seen: set[str] = set()

    # Strategy 1: find "Deadline[...]:" labels and parse the following text
    for m in _DEADLINE_LABEL_RE.finditer(text):
        fragment = text[m.end():m.end() + 120]
        parsed = _parse_date_fragment(fragment, fallback_year)
        if parsed and parsed not in seen:
            seen.add(parsed)
            deadlines.append(parsed)

    # Strategy 2: "Until Month DD YYYY" / "Until May 3 2026"
    until_re = re.compile(r"\buntil\s+([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*(?:\d{4})?)", re.I)
    for m in until_re.finditer(text):
        parsed = _parse_date_fragment(m.group(1), fallback_year)
        if parsed and parsed not in seen:
            seen.add(parsed)
            deadlines.append(parsed)

    return deadlines


def _pick_deadline(deadlines: list[str]) -> Optional[str]:
    """
    From a list of YYYY-MM-DD deadline strings, pick the best one to store.

    Strategy:
    - Prefer the LATEST future deadline (for multi-period calls, the last
      deadline is when the call is truly closed).
    - If all are past, return the latest one anyway (the caller will skip
      past-deadline calls for single-deadline posts, but for multi-period
      calls the call may still be worth recording for the next cycle).
    - Returns None if the list is empty.
    """
    if not deadlines:
        return None
    today = date.today().isoformat()
    future = [d for d in deadlines if d >= today]
    return max(future) if future else max(deadlines)


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline (YYYY-MM-DD) has already passed."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


def _post_age_days(post_date: str) -> int:
    """
    Return how many days ago a post was published.

    post_date is in ISO 8601 format: "2026-03-22T19:40:07".
    Returns a large number (99999) if unparseable.
    """
    try:
        pub = date.fromisoformat(post_date[:10])
        return (date.today() - pub).days
    except (ValueError, IndexError):
        return 99999


# ---------------------------------------------------------------------------
# Application URL extraction
# ---------------------------------------------------------------------------


def _is_skippable_domain(url: str) -> bool:
    """Return True if the URL belongs to a social/aggregator domain to skip."""
    try:
        host = urlparse(url).netloc.lstrip("www.").lower()
    except Exception:
        return True
    for skip in _SKIP_DOMAINS:
        if host == skip or host.endswith("." + skip):
            return True
    return False


def _extract_application_url(soup: BeautifulSoup, post_link: str) -> str:
    """
    Return the best application URL for a post.

    Preference order:
    1. Any link whose anchor text contains "apply", "form", "register",
       "submit", or "application" — these are explicit CTA links.
    2. First external link that isn't a social/skip domain.
    3. The post's own URL (dancingopportunities.com page) as fallback.
    """
    # Priority: explicit application/CTA links
    cta_keywords = re.compile(r"\b(apply|form|register|submit|application|audition link)\b", re.I)
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("http"):
            continue
        if _is_skippable_domain(href):
            continue
        anchor_text = a.get_text(strip=True)
        if cta_keywords.search(anchor_text) or cta_keywords.search(href):
            return href

    # Fallback: first non-skip external link
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("http"):
            continue
        if _is_skippable_domain(href):
            continue
        return href

    # Final fallback: the post's own URL
    return post_link


# ---------------------------------------------------------------------------
# Org name extraction
# ---------------------------------------------------------------------------


_GENERIC_DOMAIN_STEMS = {
    "form", "forms", "docs", "mail", "email", "apply", "submit",
    "app", "web", "www", "bit", "t", "go", "link", "info",
}


def _extract_org_name(soup: BeautifulSoup, post_link: str, title: str) -> str:
    """
    Extract a short org name for slug generation.

    Tries:
    1. Domain stem of the application URL — skipped if it's a generic form
       host (jotform.com → "jotform", but "form" from form.jotform is too
       generic; forms.gle → "forms" is also generic).
    2. Title keyword heuristic as fallback.
    """
    app_url = _extract_application_url(soup, post_link)
    if app_url and "dancingopportunities.com" not in app_url:
        try:
            host = urlparse(app_url).netloc.lstrip("www.").lower()
            # Use the primary domain name (second-to-last label if TLD is last)
            parts = host.split(".")
            stem = parts[-2] if len(parts) >= 2 else parts[0]
            if stem and stem not in _GENERIC_DOMAIN_STEMS and len(stem) > 2:
                return stem[:30]
        except Exception:
            pass

    # Title fallback — strip common noise words
    words = re.sub(r"[^\w\s]", " ", title).split()
    stop = {"call", "for", "open", "the", "a", "an", "in", "of", "and", "to", "at"}
    useful = [w.lower() for w in words if w.lower() not in stop and len(w) > 2]
    return "-".join(useful[:3]) or "dance-opp"


# ---------------------------------------------------------------------------
# Post parser
# ---------------------------------------------------------------------------


def _parse_post(post: dict, call_type: str, source_id: int) -> Optional[dict]:
    """
    Parse one WordPress REST API post into an open_call dict.

    Returns None if required fields are missing.
    """
    # Title (HTML-encoded in the REST API)
    raw_title = post.get("title", {}).get("rendered", "")
    title = html_module.unescape(raw_title).strip()
    if not title:
        return None

    post_link = post.get("link", "").strip()
    post_date = post.get("date", "")  # "2026-03-22T19:40:07"

    # Full content → BeautifulSoup
    content_html = post.get("content", {}).get("rendered", "")
    soup = BeautifulSoup(content_html, "html.parser")
    content_text = soup.get_text(separator=" ", strip=True)

    # Description — clean whitespace from content text, cap at 3000 chars
    description: Optional[str] = None
    cleaned = re.sub(r"\s{2,}", " ", content_text).strip()
    # Strip trailing boilerplate ("For more dance AUDITIONS, visit ...")
    cleaned = re.sub(
        r"\s*For more dance\s+\w+\s*,?\s*visit\s+https?://\S+\s*$",
        "",
        cleaned,
        flags=re.I,
    ).strip()
    if len(cleaned) > 30:
        description = cleaned[:3000]

    # Deadline extraction
    deadlines = _extract_deadlines(content_text, post_date)
    deadline = _pick_deadline(deadlines)

    # Application URL
    application_url = _extract_application_url(soup, post_link)

    # Org name for slug
    org_name = _extract_org_name(soup, post_link, title)

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": post_link,
        "call_type": call_type,
        "eligibility": "International",
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": org_name,
        "metadata": {
            "source": "dancing_opportunities",
            "wp_post_id": post.get("id"),
            "post_date": post_date,
        },
    }


# ---------------------------------------------------------------------------
# Category crawler
# ---------------------------------------------------------------------------


def _crawl_category(
    session: requests.Session,
    category_id: int,
    category_slug: str,
    call_type: str,
    source_id: int,
) -> tuple[int, int, int]:
    """
    Crawl one Dancing Opportunities category via the WordPress REST API.

    Returns (found, new, updated) for this category.
    """
    found = new = updated = 0
    skipped_past = 0
    page = 1
    total_pages: Optional[int] = None

    logger.info(
        "DancingOpportunities: starting category '%s' (cat_id=%d, type=%s)",
        category_slug,
        category_id,
        call_type,
    )

    while True:
        if page > 1:
            time.sleep(PAGE_DELAY_S)

        posts, tp = _fetch_api_page(session, category_id, page)
        if total_pages is None and tp:
            total_pages = tp
            logger.info(
                "DancingOpportunities: '%s' — %d pages to fetch",
                category_slug,
                total_pages,
            )

        if not posts:
            logger.info(
                "DancingOpportunities: '%s' page %d returned 0 posts — done",
                category_slug,
                page,
            )
            break

        logger.debug(
            "DancingOpportunities: '%s' page %d/%s — %d posts",
            category_slug,
            page,
            total_pages or "?",
            len(posts),
        )

        # Check if all posts on this page are older than the pagination cutoff.
        # Posts are sorted newest-first, so if the NEWEST post on this page is
        # already too old, all remaining pages will be older still.
        page_ages = [_post_age_days(p.get("date", "")) for p in posts]
        if page_ages and min(page_ages) > PAGINATION_CUTOFF_DAYS:
            logger.info(
                "DancingOpportunities: '%s' page %d — all posts >%d days old, stopping",
                category_slug,
                page,
                PAGINATION_CUTOFF_DAYS,
            )
            break

        for post in posts:
            post_date = post.get("date", "")
            age_days = _post_age_days(post_date)

            call_data = _parse_post(post, call_type, source_id)
            if call_data is None:
                continue

            deadline = call_data.get("deadline")

            # Skip calls whose deadline is already past.
            if deadline and _is_past_deadline(deadline):
                skipped_past += 1
                logger.debug(
                    "DancingOpportunities: skipping %r — deadline %s is past",
                    call_data["title"][:60],
                    deadline,
                )
                continue

            # Skip old posts with no parseable deadline — they are almost
            # certainly expired calls the site never unpublished.
            if not deadline and age_days > NO_DEADLINE_MAX_AGE_DAYS:
                skipped_past += 1
                logger.debug(
                    "DancingOpportunities: skipping %r — %d days old, no deadline",
                    call_data["title"][:60],
                    age_days,
                )
                continue

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1
                logger.debug(
                    "DancingOpportunities: inserted/updated %r (deadline=%s, type=%s)",
                    call_data["title"][:60],
                    deadline,
                    call_type,
                )

        if total_pages is not None and page >= total_pages:
            break

        # Safety: if we got fewer posts than requested, we're at the last page
        if len(posts) < POSTS_PER_PAGE:
            break

        page += 1

    if skipped_past:
        logger.info(
            "DancingOpportunities: '%s' — skipped %d past-deadline posts",
            category_slug,
            skipped_past,
        )

    logger.info(
        "DancingOpportunities: '%s' done — %d found, %d new/updated",
        category_slug,
        found,
        new,
    )
    return found, new, updated


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Dancing Opportunities open calls, auditions, and residencies.

    Strategy:
      1. For each of three categories (auditions, open-calls, residencies),
         paginate the WordPress REST API at /wp-json/wp/v2/posts.
      2. Each API response carries full post content — no detail page fetches.
      3. Extract deadline, application URL, and description from the content.
      4. Skip posts whose deadline is in the past.
      5. Posts with no parseable deadline are included (rolling/open calls).
      6. Insert/update via insert_open_call().

    Returns (total_found, total_new, total_updated).
    """
    source_id = source["id"]
    total_found = total_new = total_updated = 0

    session = _make_session()

    for category_id, category_slug, call_type in CATEGORIES:
        found, new, updated = _crawl_category(
            session,
            category_id,
            category_slug,
            call_type,
            source_id,
        )
        total_found += found
        total_new += new
        total_updated += updated

    logger.info(
        "DancingOpportunities: crawl complete — %d found, %d new/updated across %d categories",
        total_found,
        total_new,
        len(CATEGORIES),
    )
    return total_found, total_new, total_updated
