"""
Crawler for TransArtists Open Calls (transartists.org/en/transartists-calls).

TransArtists is the world's largest artist residency database, operated by
DutchCulture (the Dutch center for international cooperation in the arts).
It lists ~480 active open calls across 80+ countries, primarily residencies.

This is NOT a primary source — TransArtists aggregates calls posted by arts
organizations globally — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" because TransArtists is a
Dutch organization with global reach and cross-border participation is the
norm even for single-country residencies (e.g. Dutch artists applying abroad).

Crawl strategy — two-phase (index + detail):

  Phase 1 — Index pages:
    URL: https://www.transartists.org/en/transartists-calls?page=N
    Drupal server-rendered HTML. Each page lists 10 calls in a
    <div class="view-news"> table. Each row contains:
      - A thumbnail image
      - <h2><a href="/en/news/SLUG">Title</a></h2>
      - A truncated description (2-3 paragraphs with "read more" link)

    Pagination: ?page=0 through ?page=48 (zero-indexed, ~490 calls total).
    Stop when a page returns 0 rows or there is no rel="next" link.

  Phase 2 — Detail pages (/en/news/SLUG):
    Each detail page contains the full description, deadline, and application
    URL. Key extraction points:

      Deadline:
        The deadline appears in paragraph text in one of these patterns:
          "The deadline for applying is\nDATE"
          "The deadline for applications is\nDATE"
          "The application deadline is\nDATE"
          "Deadline: DATE" / "Deadline:\nDATE"
          "Applications must be sent by\nDATE"
        DATE format: "D Month YYYY" (e.g. "1 May 2026", "30 March 2026")
        or "D. Month YYYY" (German-adjacent format from some hosts).
        Some entries have no parseable deadline — we include them with
        deadline=None rather than skip them.

      Application URL:
        The apply link is usually an <a> in the body text with text like
        "online", "online application form", "here", "apply", or is
        the primary external link in the article.
        We search for a link whose text or context matches apply keywords.
        Fallback: the source_url (TransArtists listing page).

      Description:
        Full body text up to 3000 chars, collected from all <p> tags in
        the main article body.

      Posted date:
        <time datetime="ISO"> — used for metadata only, not as deadline.

Rate limiting:
  TransArtists is a small nonprofit platform (DutchCulture). We pause 1.0s
  between page requests. Detail pages: 0.5s delay.

SSL notes:
  transartists.org has had intermittent SSL certificate issues. We disable
  SSL verification (verify=False) and suppress urllib3 InsecureRequestWarning.
"""

import logging
import re
import time
import warnings
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

# Suppress SSL warnings since we intentionally use verify=False
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.transartists.org"
INDEX_URL = "https://www.transartists.org/en/transartists-calls"

# Zero-indexed pages. Site currently has ~49 pages (?page=0 through ?page=48).
# Hard cap prevents infinite loops if pagination metadata is ever missing.
MAX_PAGES = 60

# Polite inter-page delay (seconds) — DutchCulture is a small arts nonprofit
INDEX_PAGE_DELAY = 1.0
DETAIL_PAGE_DELAY = 0.5

# Timeout for individual HTTP requests
REQUEST_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ---------------------------------------------------------------------------
# Month name -> number (covers English only; TransArtists publishes in EN)
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
    # Abbreviated forms sometimes appear in body text
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# ---------------------------------------------------------------------------
# Type inference
# ---------------------------------------------------------------------------
#
# TransArtists is a residency-specialist platform. The vast majority of calls
# (~95%) are residencies; a minority are fellowships or grants.
# We default to "residency" and only override for strong other signals.

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
    # residency is the strong default for this platform — no catch-all
]


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from combined title + description.
    Defaults to "residency" — the primary call type on TransArtists.
    """
    combined = (title + " " + (description or "")).lower()
    for call_type, patterns in _TYPE_PATTERNS:
        if any(re.search(pat, combined) for pat in patterns):
            return call_type
    return "residency"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# Patterns that introduce the deadline — checked against the text block
# formed by concatenating all paragraph text (with newlines preserved).
_DEADLINE_INTRO_RE = re.compile(
    r"""
    (?:
        the\s+deadline\s+for\s+(?:applying|applications)\s+is |
        the\s+application\s+deadline\s+is |
        deadline\s+for\s+(?:applications?|registration|submissions?)\s*:? |
        applications?\s+must\s+be\s+(?:sent|submitted|received)\s+by |
        deadline\s*:\s*
    )
    \s*
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Matches a date in "D Month YYYY" or "D. Month YYYY" or "D/MM/YYYY" formats
_DATE_PATTERN_RE = re.compile(
    r"""
    (\d{1,2})          # day
    \.?\s+
    ([A-Za-z]+)        # month name
    \s+
    (\d{4})            # year
    """,
    re.VERBOSE,
)

# Also try ISO / numeric fallbacks: YYYY-MM-DD
_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")


def _parse_date_string(text: str) -> Optional[str]:
    """
    Parse a date from free text. Returns 'YYYY-MM-DD' or None.

    Tries these formats in order:
      1. "D Month YYYY" (e.g. "1 May 2026", "30 March 2026")
      2. "D. Month YYYY" (some German-adjacent hosts)
      3. "YYYY-MM-DD" (ISO date in text)
    """
    m = _DATE_PATTERN_RE.search(text)
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

    m2 = _ISO_DATE_RE.search(text)
    if m2:
        year, month, day = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        try:
            datetime(year, month, day)
            return f"{year}-{month:02d}-{day:02d}"
        except ValueError:
            pass

    return None


def _extract_deadline(article_text: str) -> Optional[str]:
    """
    Extract the application deadline from article body text.

    Searches for a deadline-introducing phrase followed by a date.
    Returns 'YYYY-MM-DD' or None if not found.

    Strategy: split text on the deadline intro pattern, then search for
    a date in the fragment immediately following the intro.
    """
    # Split on the intro pattern and grab what comes after
    parts = _DEADLINE_INTRO_RE.split(article_text, maxsplit=1)
    if len(parts) >= 2:
        # Take the 200 chars following the intro
        after = parts[-1][:200]
        parsed = _parse_date_string(after)
        if parsed:
            return parsed

    # Fallback: scan all lines for a date that follows "deadline" on the same
    # or next line. Handles "Deadline:\n1 April 2026." patterns.
    lines = article_text.split("\n")
    for i, line in enumerate(lines):
        if re.search(r"deadline|apply\s+by|applications?\s+(?:due|close)", line, re.I):
            # Check this line and the next two
            fragment = "\n".join(lines[i : i + 3])
            parsed = _parse_date_string(fragment)
            if parsed:
                return parsed

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

# Link text patterns that indicate an application/submission link
_APPLY_LINK_TEXT_RE = re.compile(
    r"""
    \b(?:
        online\s+application\s*(?:form|portal)? |
        apply\s+(?:here|now|online) |
        submit\s+(?:here|now|online|your\s+application) |
        application\s+form |
        register\s+(?:here|now|online) |
        online |
        apply |
        here
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Surrounding text keywords that indicate we're near the apply section
_APPLY_CONTEXT_RE = re.compile(
    r"""
    (?:
        apply | application | submit | deadline | register | online
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_application_url(article_soup, source_url: str) -> str:
    """
    Extract the primary application/apply link from the article body.

    Strategy:
      1. Look for <a> tags whose link text matches apply keywords.
      2. Look for <a> tags that are external (not transartists.org) and
         appear near deadline/apply context in the text.
      3. Fallback: the first external link in the article body.
      4. Last resort: source_url.

    Excludes:
      - transartists.org internal links (navigation, share, etc.)
      - Cloud CDN/Cloudflare email protection links
      - Anchor-only hrefs (#...)
      - Social media links (facebook, instagram, twitter, linkedin)
    """
    body = article_soup.find("div", class_="field--name-body") or article_soup.find(
        "div", class_=lambda c: c and "field-paragraph-body" in c
    )
    if body is None:
        # Fall back to full article for link search
        body = article_soup

    all_links: list[tuple[str, str]] = []  # (href, link_text)
    for a in body.find_all("a", href=True):
        href = a["href"].strip()
        text = a.get_text(strip=True)

        # Skip internal and invalid hrefs
        if not href or href.startswith("#"):
            continue
        if "transartists.org" in href or href.startswith("/"):
            continue
        if "/cdn-cgi/" in href:
            continue
        if any(
            domain in href
            for domain in [
                "facebook.com",
                "instagram.com",
                "twitter.com",
                "linkedin.com",
            ]
        ):
            continue

        all_links.append((href, text))

    if not all_links:
        return source_url

    # Priority 1: link text matches apply keywords
    for href, text in all_links:
        if _APPLY_LINK_TEXT_RE.search(text):
            return href

    # Priority 2: external link that appears near apply-context text
    # Get the full text of the body to check context
    full_text = (body or article_soup).get_text(separator=" ")
    for href, text in all_links:
        # Find the link in context by looking for the surrounding text
        link_pos = full_text.lower().find(text.lower())
        if link_pos >= 0:
            context = full_text[max(0, link_pos - 100) : link_pos + 100]
            if _APPLY_CONTEXT_RE.search(context):
                return href

    # Priority 3: first external link
    return all_links[0][0]


# ---------------------------------------------------------------------------
# Description extraction
# ---------------------------------------------------------------------------


def _extract_description(article_soup) -> Optional[str]:
    """
    Extract the full article body as a clean text description (max 3000 chars).

    Collects all <p> tags from the main content div, skipping boilerplate
    (share prompts, "Did you find this useful", social media blurbs, etc.).
    """
    # Prefer the field-paragraph-body div, fall back to full article
    body = None
    for selector in [
        ("div", {"class": lambda c: c and "field--name-field-paragraph-body" in c}),
        ("div", {"class": lambda c: c and "field--name-body" in c}),
        ("div", {"class": lambda c: c and "node__content" in c}),
    ]:
        body = article_soup.find(*selector)
        if body:
            break

    if body is None:
        body = article_soup

    # Skip-phrases: boilerplate footers present on many articles
    _SKIP_RE = re.compile(
        r"""
        did\s+you\s+find\s+this |
        share\s+this\s+page |
        follow\s+us |
        subscribe\s+to\s+our |
        transartists\s+newsletter |
        facebook\.com |
        instagram\.com
        """,
        re.IGNORECASE | re.VERBOSE,
    )

    paras = []
    for p in body.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        if not text or len(text) < 20:
            continue
        if _SKIP_RE.search(text):
            continue
        paras.append(text)

    description = "\n\n".join(paras)
    if len(description) > 3000:
        description = description[:2997] + "..."
    return description.strip() or None


# ---------------------------------------------------------------------------
# Organization name extraction
# ---------------------------------------------------------------------------


def _extract_org_name(article_soup, title: str) -> str:
    """
    Extract the organization name from the article.

    TransArtists articles have an "Authors" field that renders as
    "AuthorsCourtesy of ORG NAME" (label + value concatenated). We strip
    the label and any "Courtesy of" prefix to get the clean org name.

    Falls back to the article title if neither field yields a useful name.
    """
    # Preferred: field--name-field-authors contains "Courtesy of ORG NAME"
    authors_div = article_soup.find(
        "div", class_=lambda c: c and "field--name-field-authors" in c
    )
    if authors_div:
        # Strip the "Authors" label text first
        label = authors_div.find(class_="field__label")
        if label:
            label.decompose()
        raw = authors_div.get_text(strip=True)
        # Strip "Courtesy of " prefix
        raw = re.sub(r"(?i)^courtesy\s+of\s*", "", raw).strip()
        if raw and len(raw) < 120:
            return raw

    # Fallback: use the article title truncated
    return title[:80]


# ---------------------------------------------------------------------------
# Eligibility extraction
# ---------------------------------------------------------------------------

_ELIG_RE = re.compile(
    r"""
    (?:
        (?:the\s+)?call\s+is\s+open\s+to\s*:? |
        (?:the\s+)?(?:programme|program|residency)\s+is\s+open\s+to |
        eligib(?:ility|le)\s*:? |
        who\s+can\s+apply |
        open\s+to |
        applicants?\s+must\s+be
    )
    \s*
    ([^\n]{15,300})
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _extract_eligibility(article_text: str) -> Optional[str]:
    """Extract a short eligibility description from the article text."""
    m = _ELIG_RE.search(article_text)
    if m:
        text = m.group(1).strip()
        # Trim at sentence end
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
            "Referer": INDEX_URL,
        }
    )
    return session


def _fetch(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a URL with SSL verification disabled. Returns HTML or None."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, verify=False)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("TransArtists: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> tuple[list[dict], bool]:
    """
    Parse one TransArtists calls listing page.

    Returns:
      (listings, has_next)
        listings: list of {title, source_url, image_url} dicts
        has_next: True if a rel="next" or "Next" page link was found
    """
    soup = BeautifulSoup(html, "html.parser")

    # The calls listing is in a view-news block rendered as a table
    view_news = soup.find("div", class_=lambda c: c and "view-news" in c)
    if not view_news:
        logger.debug("TransArtists: no view-news div on page")
        return [], False

    listings = []
    for row in view_news.find_all("tr"):
        # Title + source URL
        h2 = row.find("h2")
        if not h2:
            continue
        a_tag = h2.find("a", href=True)
        if not a_tag:
            continue

        title = a_tag.get_text(strip=True)
        href = a_tag["href"]
        if not title or not href:
            continue

        # Resolve relative URL
        if href.startswith("/"):
            source_url = BASE_URL + href
        else:
            source_url = href

        # Thumbnail image (index-page preview)
        image_url = None
        img = row.find("img")
        if img and img.get("src"):
            src = img["src"]
            if src.startswith("/"):
                image_url = BASE_URL + src
            elif src.startswith("http"):
                image_url = src

        listings.append(
            {
                "title": title,
                "source_url": source_url,
                "image_url": image_url,
            }
        )

    # Detect next page: look for pager link with rel="next" or "next" text
    has_next = 'rel="next"' in html or "rel='next'" in html
    if not has_next:
        pager = soup.find(class_="pager")
        if pager:
            # Check for a "Next" link
            next_link = pager.find("a", class_=lambda c: c and "pager__item--next" in c)
            if next_link:
                has_next = True
            else:
                # Generic check: does pager text contain "Next"?
                has_next = bool(pager.find("a", string=re.compile(r"next", re.I)))

    logger.debug(
        "TransArtists: parsed %d listings from index page (has_next=%s)",
        len(listings),
        has_next,
    )
    return listings, has_next


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, source_url: str) -> Optional[dict]:
    """
    Parse a TransArtists detail page (/en/news/SLUG).

    Returns a dict with extracted fields, or None on critical parse failure.

    Fields returned:
      deadline, description, application_url, org_name, eligibility,
      posted_datetime (ISO string, metadata only)
    """
    soup = BeautifulSoup(html, "html.parser")

    article = soup.find("article")
    if not article:
        logger.warning("TransArtists: no <article> on detail page %s", source_url)
        return None

    # Full text for regex-based extraction
    article_text = article.get_text(separator="\n", strip=True)

    # Posted date (for metadata; NOT the deadline)
    posted_dt = None
    time_tag = article.find("time", datetime=True)
    if time_tag:
        posted_dt = time_tag.get("datetime")  # ISO 8601

    # Deadline
    deadline = _extract_deadline(article_text)

    # Description
    description = _extract_description(article)

    # Application URL
    application_url = _extract_application_url(article, source_url)

    # Organization name
    org_name = _extract_org_name(article, "")

    # Eligibility
    eligibility = _extract_eligibility(article_text)

    return {
        "deadline": deadline,
        "description": description,
        "application_url": application_url,
        "org_name": org_name,
        "eligibility": eligibility,
        "posted_datetime": posted_dt,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl TransArtists Open Calls.

    Strategy:
      Phase 1: Fetch all index pages (?page=0 through ?page=N) to collect
               call titles and detail page URLs. 10 calls per page.
      Phase 2: For each call, fetch the detail page to extract deadline,
               description, and application URL.
      Filter:  Skip calls with deadlines that have already passed.
      Insert:  Pass each eligible call to insert_open_call().

    Returns (found, new, updated).
      found   = calls that passed deadline filter (eligible to insert)
      new     = successfully inserted (new rows)
      updated = 0 (insert_open_call handles updates via content-hash dedup)
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()
    seen_urls: set[str] = set()

    # -----------------------------------------------------------------------
    # Phase 1: Collect index listings from all pages
    # -----------------------------------------------------------------------

    all_listings: list[dict] = []

    for page_num in range(MAX_PAGES):
        if page_num > 0:
            time.sleep(INDEX_PAGE_DELAY)

        url = INDEX_URL if page_num == 0 else f"{INDEX_URL}?page={page_num}"
        html = _fetch(session, url)
        if not html:
            logger.warning(
                "TransArtists: failed to fetch index page %d — stopping", page_num
            )
            break

        listings, has_next = _parse_index_page(html)

        if not listings:
            logger.info(
                "TransArtists: page %d returned 0 listings — index crawl complete",
                page_num,
            )
            break

        logger.info(
            "TransArtists: index page %d — %d listings (has_next=%s)",
            page_num,
            len(listings),
            has_next,
        )

        for listing in listings:
            url = listing["source_url"]
            if url in seen_urls:
                continue
            seen_urls.add(url)
            all_listings.append(listing)

        if not has_next:
            logger.info(
                "TransArtists: no next-page link after page %d — index crawl done",
                page_num,
            )
            break

    logger.info(
        "TransArtists: collected %d unique listings across index pages",
        len(all_listings),
    )

    # -----------------------------------------------------------------------
    # Phase 2: Fetch detail pages and insert
    # -----------------------------------------------------------------------

    skipped_deadline = 0
    skipped_no_url = 0
    detail_errors = 0

    for i, listing in enumerate(all_listings):
        if i > 0:
            time.sleep(DETAIL_PAGE_DELAY)

        source_url = listing["source_url"]
        title = listing["title"]

        html = _fetch(session, source_url)
        if not html:
            detail_errors += 1
            logger.warning(
                "TransArtists: failed to fetch detail page for %r", title[:60]
            )
            continue

        detail = _parse_detail_page(html, source_url)
        if detail is None:
            detail_errors += 1
            logger.warning(
                "TransArtists: failed to parse detail page for %r", title[:60]
            )
            continue

        deadline = detail["deadline"]
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "TransArtists: skipping %r — deadline %s passed", title[:60], deadline
            )
            continue

        application_url = detail["application_url"]
        if not application_url:
            skipped_no_url += 1
            logger.debug("TransArtists: skipping %r — no application URL", title[:60])
            continue

        org_name = detail["org_name"] or "transartists"
        description = detail["description"]
        eligibility = detail["eligibility"] or "International"

        call_type = _infer_call_type(title, description or "")

        # Image URL: prefer the detail page (may have a higher-res image).
        # The index-page thumbnail is only 119x119; we keep it in metadata
        # for fallback but don't use it as the primary image_url since the
        # open_calls schema doesn't have that column.
        image_url_thumb = listing.get("image_url")

        found += 1

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": None,  # TransArtists does not publish structured fee data
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name,
            "metadata": {
                "source": "transartists",
                "organization": org_name,
                "scope": "international",
                "posted_datetime": detail.get("posted_datetime"),
                "thumbnail_url": image_url_thumb,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "TransArtists: inserted %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("TransArtists: skipped %d past-deadline calls", skipped_deadline)
    if detail_errors:
        logger.info("TransArtists: %d detail page fetch/parse errors", detail_errors)
    if skipped_no_url:
        logger.info(
            "TransArtists: skipped %d calls with no application URL", skipped_no_url
        )

    logger.info(
        "TransArtists: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
