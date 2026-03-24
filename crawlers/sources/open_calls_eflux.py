"""
Crawler for e-flux announcements filtered to open calls, residencies,
grants, and fellowships.

e-flux (e-flux.com) is the most widely read art world communication
platform globally. Their announcements section includes a substantial
volume of artist opportunity postings: open calls, residency programs,
PhD / MFA calls for applications, fellowships, grants, commissions, and
prizes. These are posted by institutions and organizations directly and
represent high-quality, international opportunities.

This crawler targets the "Call for applications", "Fellowship", and
"Grants" categories on e-flux announcements, which collectively cover
~430+ active opportunities. All calls carry `scope = "international"`.
Confidence tier: "aggregated" (e-flux is an announcements aggregator
for the posting institutions, not the primary source).

Crawl strategy — two-phase:
  Phase 1 (index): Call the e-flux Next.js server action for category-
  filtered announcements. This action powers the on-page "Load more"
  button and is the same mechanism the browser uses. It returns JSON
  with `items` (announcement objects) and `hasMore`.

  Server action details:
    POST https://www.e-flux.com/announcements/
    Next-Action: 30dcbe3736552afa54f6ccc653bc77bee33436a3
    Content-Type: text/plain;charset=UTF-8
    Accept: text/x-component
    Body: JSON array [searchParams, searchTypes, page]

  Response format (RSC text/x-component):
    0:["$@1", ...]                — framework header line (ignored)
    1:{"items":[...], "hasMore":bool}  — the data we want

  Item fields used from index:
    id         — numeric ID (used to build source_url)
    url        — relative path e.g. "/announcements/123456/title-slug"
    title      — raw HTML-ish title (strip tags)
    date       — publish date ISO string (NOT deadline)
    clients    — [{id, name}] — the posting organization(s)
    list       — which sub-service (efAnnouncementAnnouncements, aeAnnouncements, etc.)

  Phase 2 (detail): For each candidate listing, fetch the detail page
  to extract:
    - Full description (div.article__body)
    - Application deadline (regex scan of body text)
    - call_type (inferred from sidebar categories + title keywords)
    - apply URL (first relevant external link in body)

Filtering:
  We skip announcement items that are clearly exhibition PRs (only
  "Education" / "Contemporary Art" categories, no call/residency/
  grant/fellowship/prize category, no call-type keywords in title).
  The page-level category filter ("Call for applications" etc.) already
  provides significant pre-filtering, so this is a secondary check.

Type mapping (from sidebar categories + title keywords):
  "residency" / "residenc" / "retreat" / "artist-in-residence" → residency
  "fellowship" → grant
  "grant" / "prize" / "award" → grant
  "commission" → commission
  default → submission

Rate limiting:
  Detail page fetches are spaced 1.5s apart. The server action calls
  are spaced 1.0s apart. e-flux is a major institution and we are
  respectful crawlers.
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

BASE_URL = "https://www.e-flux.com"
ANNOUNCEMENTS_URL = "https://www.e-flux.com/announcements/"

# Next.js server action ID for filtered announcements (category-based load-more).
# This is the client component's server action bound to the announcements list.
# Verified 2026-03-24 against the live site JS bundle:
#   app/education/announcements/page-cc6953ce0908bb16.js
#   const r = (0,s.$)("30dcbe3736552afa54f6ccc653bc77bee33436a3")
# This action signature: r(searchParams, searchTypes, page) -> {items, hasMore}
_SERVER_ACTION_ID = "30dcbe3736552afa54f6ccc653bc77bee33436a3"

# Categories to crawl — these are the e-flux taxonomy categories we care about.
# Each produces its own pagination run, then we deduplicate.
_TARGET_CATEGORIES = [
    "Call for applications",
    "Fellowship",
    "Grants",
]

# e-flux list types that appear in announcements. All are valid to include.
# "aaAnnouncements" = Art Agenda sub-service
# "aeAnnouncements" = Education sub-service
# "efAnnouncementAnnouncements" = main e-flux announcements
# "efArchitectureAnnouncements" = e-flux architecture
# "efTvAnnouncements" = e-flux TV
_SEARCH_TYPES = [
    "announcement",
    "aaannouncement",
    "aeannouncement",
    "arannouncement",
    "tvannouncement",
]

# Safety page cap per category (each page is ~30-120 items)
_MAX_PAGES = 15

# Polite delay between server action calls (seconds)
_ACTION_DELAY = 1.0

# Polite delay between detail page fetches (seconds)
_DETAIL_DELAY = 1.5

# Detail page fetch timeout
_FETCH_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Employment posting detection — these appear in "Call for applications" but
# are job/staff vacancies, not artist opportunities.
_JOB_POSTING_RE = re.compile(
    r"\b(?:executive\s+director|program\s+(?:manager|director|officer|coordinator)|"
    r"curator\s+(?:position|vacancy|role|search)|chief\s+(?:executive|curator)|"
    r"seeking\s+(?:a\s+)?(?:executive|director|curator|manager|coordinator|intern)|"
    r"(?:job|position|vacancy|employment)\s+(?:opening|opportunity|posting)|"
    r"(?:now\s+)?hiring|executive\s+search|staff\s+(?:position|opening)|"
    r"internship\s+program\b)",
    re.I,
)

# Domains to skip when extracting apply URLs (social, e-flux own domain, CDNs)
_SKIP_DOMAINS = {
    "e-flux.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "laika.bar",
    "linkedin.com",
    "vimeo.com",
    "b-cdn.net",
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Strip HTML tags from titles
_HTML_TAG_RE = re.compile(r"<[^>]+>")

# Deadline extraction — ordered by specificity, stops at first match.
# We try to capture "Month D, YYYY" or "D Month YYYY" or "MM/DD/YYYY" etc.
_DEADLINE_PATTERNS = [
    # "deadline: Month D, YYYY" or "due date: D Month YYYY"
    re.compile(
        r"(?:application\s+)?deadline\s*:?\s*"
        r"(\w+ \d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4}|\d{1,2}/\d{1,2}/\d{2,4})",
        re.I,
    ),
    # "due by / apply by / submit by: Month D, YYYY"
    re.compile(
        r"(?:due\s+by|apply\s+by|submit\s+by|closing\s+date)\s*:?\s*"
        r"(\w+ \d{1,2},?\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})",
        re.I,
    ),
    # "open [now] through Month D, YYYY" (common format)
    re.compile(
        r"open\s+(?:now\s+)?through\s+(\w+ \d{1,2},?\s+\d{4})",
        re.I,
    ),
    # "through Month D, YYYY"
    re.compile(
        r"(?:^|\s)through\s+(\w+ \d{1,2},?\s+\d{4})",
        re.I,
    ),
    # "Application period: Month D–D, YYYY" — take the end date
    re.compile(
        r"application\s+period\s*:?\s*\w+\s+\d{1,2}[–\-]\s*(\d{1,2},?\s+\d{4})",
        re.I,
    ),
    # "by Month D, YYYY" (looser but useful fallback)
    re.compile(
        r"(?:submit|apply|entries?)\s+by\s+(\w+\s+\d{1,2},?\s+\d{4})",
        re.I,
    ),
    # "until Month D, YYYY"
    re.compile(
        r"until\s+(\w+ \d{1,2},?\s+\d{4})",
        re.I,
    ),
]

# Call type inference — checked against body text + sidebar categories
_RESIDENCY_RE = re.compile(
    r"\bresiden(?:cy|ce|t)\b|\bretreat\b|\bartist[\s-]in[\s-]residence\b|\bair\b|\bstudio\s+program\b",
    re.I,
)
_GRANT_RE = re.compile(
    r"\bgrant\b|\bfellowship\b|\baward\b|\bprize\b|\bstipend\b|\bscholarship\b",
    re.I,
)
_COMMISSION_RE = re.compile(r"\bcommission\b", re.I)

# Month name → number map for date parsing
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


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": BASE_URL + "/",
        }
    )
    return session


def _call_server_action(
    session: requests.Session,
    category: str,
    page: int,
) -> Optional[dict]:
    """
    Call the e-flux RSC server action that powers the 'Load more' button.

    Returns parsed JSON dict with 'items' and 'hasMore', or None on failure.
    """
    import json

    try:
        resp = session.post(
            ANNOUNCEMENTS_URL,
            headers={
                "Next-Action": _SERVER_ACTION_ID,
                "Content-Type": "text/plain;charset=UTF-8",
                "Accept": "text/x-component",
            },
            data=json.dumps(
                [
                    {"c": category, "order": "newest"},
                    _SEARCH_TYPES,
                    page,
                ]
            ),
            timeout=_FETCH_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning(
            "e-flux: server action failed (cat=%r, page=%d): %s",
            category,
            page,
            exc,
        )
        return None

    # RSC response format: the data section starts with "1:" and the JSON
    # may span multiple "lines" (the RSC streaming format uses newlines as
    # chunk boundaries, but large responses continue across lines).
    # We locate the "1:" token and parse everything following it as JSON.
    #
    # IMPORTANT: decode from bytes explicitly. requests defaults the encoding
    # to ISO-8859-1 for text/x-component (no charset in Content-Type), which
    # mangles accented characters in org names. e-flux serves UTF-8.
    text = resp.content.decode("utf-8", errors="replace")
    idx = text.find("1:")
    if idx < 0:
        logger.warning(
            "e-flux: unexpected server action response format (cat=%r, page=%d)",
            category,
            page,
        )
        return None

    try:
        return json.loads(text[idx + 2 :])
    except ValueError as exc:
        logger.warning(
            "e-flux: failed to parse server action JSON (cat=%r, page=%d): %s",
            category,
            page,
            exc,
        )
        return None


def _fetch_detail(session: requests.Session, url: str) -> Optional[str]:
    """Fetch a detail page and return HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=_FETCH_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("e-flux: failed to fetch detail %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Index phase helpers
# ---------------------------------------------------------------------------


def _collect_category_ids(
    session: requests.Session,
    category: str,
) -> list[dict]:
    """
    Paginate through all pages of one category, collecting raw item dicts.
    Stops when hasMore=False or page cap is reached.
    """
    items: list[dict] = []
    for page in range(1, _MAX_PAGES + 1):
        if page > 1:
            time.sleep(_ACTION_DELAY)

        data = _call_server_action(session, category, page)
        if not data:
            logger.warning(
                "e-flux: no data returned for cat=%r page=%d — stopping",
                category,
                page,
            )
            break

        page_items = data.get("items") or []
        items.extend(page_items)

        logger.debug(
            "e-flux: cat=%r page=%d — %d items (hasMore=%s)",
            category,
            page,
            len(page_items),
            data.get("hasMore"),
        )

        if not page_items or not data.get("hasMore"):
            break

    logger.info("e-flux: cat=%r — %d total items collected", category, len(items))
    return items


# ---------------------------------------------------------------------------
# Detail page parsing
# ---------------------------------------------------------------------------


def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    cleaned = _HTML_TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def _parse_date_string(raw: str) -> Optional[str]:
    """
    Parse a date string extracted from body text into 'YYYY-MM-DD'.

    Handles:
      "Month D, YYYY"  e.g. "March 31, 2026"
      "D Month YYYY"   e.g. "31 March 2026"
      "MM/DD/YYYY"     e.g. "03/31/2026"
      "MM/DD/YY"       e.g. "03/31/26"
      Partial "D, YYYY" from application period end dates (month inherited)
    """
    if not raw:
        return None
    raw = raw.strip().rstrip(",")

    # "Month D, YYYY" or "Month D YYYY"
    m = re.match(r"^(\w+)\s+(\d{1,2}),?\s+(\d{4})$", raw)
    if m:
        month_name, day, year = m.groups()
        month = _MONTH_MAP.get(month_name.lower())
        if month:
            try:
                return date(int(year), month, int(day)).isoformat()
            except ValueError:
                pass

    # "D Month YYYY"
    m = re.match(r"^(\d{1,2})\s+(\w+)\s+(\d{4})$", raw)
    if m:
        day, month_name, year = m.groups()
        month = _MONTH_MAP.get(month_name.lower())
        if month:
            try:
                return date(int(year), month, int(day)).isoformat()
            except ValueError:
                pass

    # "MM/DD/YYYY"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        mo, day, year = m.groups()
        try:
            return date(int(year), int(mo), int(day)).isoformat()
        except ValueError:
            pass

    # "MM/DD/YY"
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2})$", raw)
    if m:
        mo, day, yr = m.groups()
        try:
            return date(int(yr) + 2000, int(mo), int(day)).isoformat()
        except ValueError:
            pass

    # "D, YYYY" (partial — end of application period range like "31, 2026")
    m = re.match(r"^(\d{1,2}),?\s+(\d{4})$", raw)
    if m:
        day, year = m.groups()
        # We don't have the month — return None rather than guess
        logger.debug("e-flux: ambiguous partial date %r — skipping", raw)
        return None

    logger.debug("e-flux: could not parse date string %r", raw)
    return None


def _extract_deadline(body_text: str) -> Optional[str]:
    """
    Scan body text for deadline mentions.
    Returns ISO 'YYYY-MM-DD' or None.
    """
    for pattern in _DEADLINE_PATTERNS:
        m = pattern.search(body_text)
        if m:
            raw = m.group(1)
            parsed = _parse_date_string(raw)
            if parsed:
                logger.debug("e-flux: deadline extracted: %r → %s", raw, parsed)
                return parsed
    return None


def _is_past_deadline(deadline: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline:
        return False
    try:
        return date.fromisoformat(deadline) < date.today()
    except ValueError:
        return False


def _infer_call_type(sidebar_categories: list[str], title: str, body_text: str) -> str:
    """
    Determine call_type from sidebar categories, title, and body text.

    Priority:
    1. Sidebar categories (authoritative)
    2. Title / body keywords

    Returns: "residency" | "grant" | "commission" | "submission"
    """
    combined = " ".join(sidebar_categories + [title, body_text[:500]])

    if _RESIDENCY_RE.search(combined):
        return "residency"
    if _COMMISSION_RE.search(combined):
        return "commission"
    if _GRANT_RE.search(combined):
        return "grant"
    return "submission"


def _extract_apply_url(soup: BeautifulSoup, source_url: str) -> Optional[str]:
    """
    Find the best application URL from the detail page.

    Priority:
    1. Links with 'apply' text or href pattern
    2. First external link that isn't social media or e-flux itself
    3. Fall back to source_url (the e-flux page itself)
    """
    # Collect all external links
    external = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith("http"):
            continue
        # Check if it's a known skip domain
        try:
            from urllib.parse import urlparse

            domain = urlparse(href).netloc.lower().lstrip("www.")
        except Exception:
            continue
        if any(domain.endswith(skip) for skip in _SKIP_DOMAINS):
            continue
        link_text = a.get_text(strip=True).lower()
        external.append((href, link_text))

    if not external:
        return source_url

    # Prefer links with 'apply' in text or href
    for href, text in external:
        if "apply" in text or "apply" in href.lower() or "application" in href.lower():
            return href

    # First remaining external link
    return external[0][0]


def _parse_detail_page(
    html: str,
    item: dict,
    source_url: str,
) -> Optional[dict]:
    """
    Parse a detail page and return a call_data dict ready for insert_open_call(),
    or None if the listing should be skipped.
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Description ---
    body_el = soup.find("div", class_="article__body")
    if not body_el:
        logger.debug("e-flux: no article__body found on %s", source_url)
        return None

    # Keep full_body_text for deadline extraction (deadlines can appear late in
    # the text, beyond the 3000-char description truncation point).
    full_body_text = body_el.get_text(separator=" ", strip=True)
    full_body_text = re.sub(r"\s+", " ", full_body_text).strip()

    # Truncated version stored as the description field
    description = full_body_text[:3000] if full_body_text else None

    # --- Sidebar categories ---
    sidebar_categories: list[str] = []
    for a in soup.find_all("a", href=re.compile(r"/search\?c")):
        cat = a.get_text(strip=True)
        if cat:
            sidebar_categories.append(cat)

    # --- Skip non-opportunity listings ---
    # If the only sidebar category is purely thematic (no call/grant/
    # residency/fellowship marker) AND the title has no relevant keywords,
    # this is a regular exhibition announcement that happens to have been
    # tagged with a broad category we're filtering on.
    title = _strip_html(item.get("title") or "").strip()
    if not title:
        return None

    # Skip job/employment postings — they appear in "Call for applications"
    # but are staff vacancies, not artist opportunities.
    if _JOB_POSTING_RE.search(title):
        logger.debug("e-flux: skipping %r — appears to be a job posting", title[:60])
        return None

    call_type_signals = sidebar_categories + [title] + [full_body_text[:500]]
    combined_signal = " ".join(call_type_signals).lower()

    # Must contain at least one opportunity keyword to be a valid open call
    _OPPORTUNITY_RE = re.compile(
        r"\b(?:call|residenc|fellowship|grant|award|prize|commission|"
        r"stipend|scholarship|opportunit|apply|application|submit|deadline)\b",
        re.I,
    )
    if not _OPPORTUNITY_RE.search(combined_signal):
        logger.debug("e-flux: skipping %r — no opportunity keywords found", title[:60])
        return None

    # --- Deadline (run against full body text, not truncated description) ---
    deadline = _extract_deadline(full_body_text)

    # --- Call type ---
    call_type = _infer_call_type(sidebar_categories, title, description or "")

    # --- Apply URL ---
    application_url = _extract_apply_url(soup, source_url)

    # --- Organization ---
    clients = item.get("clients") or []
    org_name = clients[0]["name"] if clients else "e-flux"

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": source_url,
        "call_type": call_type,
        "eligibility": "International",
        "fee": None,  # e-flux listings do not consistently carry fee info
        "_org_name": org_name,
        "confidence_tier": "aggregated",
        "metadata": {
            "source": "eflux",
            "eflux_id": item.get("id"),
            "eflux_list": item.get("list"),
            "organization": org_name,
            "sidebar_categories": sidebar_categories,
            "publish_date": item.get("date"),
            "scope": "international",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl e-flux announcements for open calls, residencies, grants, and
    fellowships.

    Strategy:
      1. For each target category, call the server action to collect all
         listing items (paginating until hasMore=False).
      2. Deduplicate across categories by e-flux announcement ID.
      3. For each candidate, fetch the detail page to extract description,
         deadline, call_type, and application URL.
      4. Skip listings without opportunity keywords or with past deadlines.
      5. Insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    seen_eflux_ids: set[int] = set()

    session = _make_session()

    # Phase 1: collect all candidate listings across target categories
    all_items: list[dict] = []
    for category in _TARGET_CATEGORIES:
        cat_items = _collect_category_ids(session, category)
        for item in cat_items:
            eflux_id = item.get("id")
            if eflux_id and eflux_id in seen_eflux_ids:
                continue
            if eflux_id:
                seen_eflux_ids.add(eflux_id)
            all_items.append(item)

    logger.info(
        "e-flux: %d unique candidate listings collected across %d categories",
        len(all_items),
        len(_TARGET_CATEGORIES),
    )

    if not all_items:
        logger.warning("e-flux: no candidates collected — check site structure")
        return 0, 0, 0

    # Phase 2: fetch detail pages and process
    skipped_no_body = 0
    skipped_no_opportunity = 0
    skipped_past_deadline = 0
    skipped_no_url = 0

    for item in all_items:
        relative_url = item.get("url", "")
        if not relative_url:
            skipped_no_url += 1
            continue

        source_url = BASE_URL + relative_url

        time.sleep(_DETAIL_DELAY)

        html = _fetch_detail(session, source_url)
        if not html:
            skipped_no_body += 1
            continue

        call_data = _parse_detail_page(html, item, source_url)
        if call_data is None:
            skipped_no_opportunity += 1
            continue

        # Skip past-deadline calls
        deadline = call_data.get("deadline")
        if _is_past_deadline(deadline):
            skipped_past_deadline += 1
            logger.debug(
                "e-flux: skipping %r — deadline %s already passed",
                call_data.get("title", "")[:60],
                deadline,
            )
            continue

        call_data["source_id"] = source_id
        found += 1

        result = insert_open_call(call_data)
        if result:
            new += 1

    if skipped_no_body:
        logger.info(
            "e-flux: %d items skipped — detail page fetch failed", skipped_no_body
        )
    if skipped_no_opportunity:
        logger.info(
            "e-flux: %d items skipped — no opportunity keywords", skipped_no_opportunity
        )
    if skipped_past_deadline:
        logger.info("e-flux: %d items skipped — past deadline", skipped_past_deadline)
    if skipped_no_url:
        logger.info("e-flux: %d items skipped — no URL", skipped_no_url)

    logger.info(
        "e-flux: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
