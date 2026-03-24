"""
Crawler for InfoDesigners.eu (infodesigners.eu/latest-competitions).

InfoDesigners.eu is the largest multi-discipline design competition aggregator,
covering ~70-110 active competitions across 17 categories: graphic, industrial,
product, UX, interior, fashion, architecture, digital, animation, art, photo,
film, video, music, writing, idea, free, and student.

Crawl strategy — two phases, static HTML (no Playwright required):

  Phase 1 — Paginated listing index:
    URL pattern: https://www.infodesigners.eu/latest-competitions/{N}
    Pages 1-N, typically 17 pages, each rendering 7-8 competition cards.
    Each card has a JSON-LD Event block containing:
      - name          — competition title
      - startDate     — date posted (ISO YYYY-MM-DD)
      - endDate       — submission deadline (ISO YYYY-MM-DD; "1970-01-01" = no deadline)
      - description   — short summary
      - image         — competition banner image URL
      - mainEntityOfPage — canonical detail page URL (/competitions/{slug})
      - sameAs        — official competition website URL
    Pagination stops when a page returns 0 Event JSON-LD blocks, or returns
    exclusively historical entries (endDate < today or endDate == 1970-01-01).
    Safety cap: 25 pages maximum.

  Phase 2 — Detail pages (one per active competition):
    URL: https://www.infodesigners.eu/competitions/{slug}
    Parsed with BeautifulSoup to extract:
      - Organizer name    — itemprop="sourceOrganization" > itemprop="name"
      - Application URL   — <a class="submitcontest"> inside itemprop="sameAs" paragraph
        (the official site link; falls back to sameAs from JSON-LD if absent)
      - Fee info          — <div class="intorno"> whose <h3><mark> contains "Entry fees"
        The text is kept as fee_raw in metadata; the fee column is set to 0.0
        when the text contains "no entry fee" or "free", otherwise left None.

  Important structural notes (verified 2026-03-24):
    - The listing page JSON-LD is authoritative for dates. The detail page has
      no Event JSON-LD block (only WebSite and Organization schemas).
    - endDate = "1970-01-01" means the entry is a winners-announcement, not an
      active call. Skip these.
    - Pages 15-17 contain historical winners announcements (2018-2024). The
      crawler detects them via endDate and stops paginating early when an entire
      page is historical.
    - The "sameAs" field in JSON-LD is the official website; the submitcontest
      link on the detail page is the direct application/submission URL. These
      are sometimes the same URL, sometimes different.
    - Fee parsing is text-only: "no entry fee", "free", "There is no entry fee"
      → fee=0.0; dollar amounts are captured as fee_raw only (multi-tier pricing
      is common; a single numeric fee would misrepresent it).

Rate limiting: 0.5s between all page fetches (listing and detail pages).
Max concurrent detail fetches: sequential only. With 70-110 active competitions,
a full run takes approximately 1-2 minutes.

Confidence tier: "aggregated" — InfoDesigners is an aggregator, not the issuing org.
Eligibility: "International" — all competitions on this site are open internationally.
call_type: "submission" — design competition entries (the predominant type).
"""

import json
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

BASE_URL = "https://www.infodesigners.eu"
_LISTING_URL = "https://www.infodesigners.eu/latest-competitions/{page}"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Delay between ALL HTTP fetches (listing pages + detail pages)
_FETCH_DELAY = 0.5

# Safety cap on listing pages (site currently has ~17)
_MAX_PAGES = 25

# Safety cap on total competitions processed
_MAX_COMPETITIONS = 200

_REQUEST_TIMEOUT = 30

# Sentinel used by InfoDesigners to indicate "no deadline" (winners posts)
_NO_DEADLINE_SENTINEL = "1970-01-01"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": BASE_URL + "/",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("InfoDesigners: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------


def _is_past(date_iso: str) -> bool:
    """Return True if the ISO date string is in the past or is the sentinel."""
    if not date_iso or date_iso == _NO_DEADLINE_SENTINEL:
        return True
    try:
        return date.fromisoformat(date_iso) < date.today()
    except ValueError:
        return False


def _is_sentinel(date_iso: str) -> bool:
    """Return True for the 1970-01-01 winners-post sentinel."""
    return date_iso == _NO_DEADLINE_SENTINEL


# ---------------------------------------------------------------------------
# Phase 1: listing page parser (JSON-LD extraction)
# ---------------------------------------------------------------------------


def _parse_jsonld_events(html: str) -> list[dict]:
    """
    Extract all Event JSON-LD blocks from a listing page.

    Returns a list of dicts directly from the parsed JSON-LD. May contain
    malformed blocks (caught and skipped individually).
    """
    raw_blocks = re.findall(
        r'<script\s+type="application/ld\+json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    events: list[dict] = []
    for raw in raw_blocks:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # Some blocks have unescaped control characters — skip silently
            continue
        if isinstance(data, dict) and data.get("@type") == "Event":
            events.append(data)
    return events


def _parse_listing_page(html: str) -> list[dict]:
    """
    Parse a single listing page and return competition stubs.

    Each stub has:
      title, deadline, description, image_url, detail_url, official_url
    """
    jsonld_events = _parse_jsonld_events(html)
    stubs: list[dict] = []

    for ev in jsonld_events:
        title = (ev.get("name") or "").strip()
        if not title:
            continue

        deadline = (ev.get("endDate") or "").strip()
        description = (ev.get("description") or "").strip()
        image_url = (ev.get("image") or "").strip()

        # mainEntityOfPage is the canonical /competitions/{slug} URL
        detail_url = ev.get("mainEntityOfPage") or ""
        if isinstance(detail_url, dict):
            detail_url = detail_url.get("@id") or ""
        detail_url = detail_url.strip()

        # sameAs is the official competition site (the application target)
        official_url = ev.get("sameAs") or ""
        if isinstance(official_url, list):
            official_url = official_url[0] if official_url else ""
        official_url = official_url.strip()

        stubs.append(
            {
                "title": title,
                "deadline": deadline,
                "description": description,
                "image_url": image_url,
                "detail_url": detail_url,
                "official_url": official_url,
            }
        )

    return stubs


# ---------------------------------------------------------------------------
# Phase 2: detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str) -> dict:
    """
    Parse a competition detail page to extract organizer, fee info, and
    the direct application URL.

    Returns a dict with:
      org_name, application_url, fee, fee_raw, description_long
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Organizer ---
    # <span itemprop="sourceOrganization" ...> <span itemprop="name">OrgName</span>
    org_name = ""
    org_span = soup.find(attrs={"itemprop": "sourceOrganization"})
    if org_span:
        name_span = org_span.find(attrs={"itemprop": "name"})
        if name_span:
            org_name = name_span.get_text(strip=True)

    # --- Application URL ---
    # The "Visit Official Website" button: <a class="submitcontest" href="...">
    # inside <p itemprop="sameAs">
    application_url = ""
    samas_p = soup.find("p", attrs={"itemprop": "sameAs"})
    if samas_p:
        submit_link = samas_p.find("a", class_="submitcontest", href=True)
        if submit_link:
            application_url = submit_link["href"].strip()

    # --- Fee info ---
    # Sections are <div class="intorno"> with <h3><mark>Label</mark></h3> + <p>
    fee: Optional[float] = None
    fee_raw: Optional[str] = None

    for intorno in soup.find_all("div", class_="intorno"):
        h3 = intorno.find("h3")
        if not h3:
            continue
        label = h3.get_text(strip=True).lower()
        if "entry fee" not in label:
            continue
        # Found the fee section
        fee_text = intorno.get_text(separator=" ", strip=True)
        # Strip the heading from the text
        for heading in ("Entry fees:", "Entry fee:", "Entry Fees:", "Entry Fee:"):
            fee_text = fee_text.replace(heading, "").strip()

        fee_raw = fee_text[:400] if fee_text else None

        # Detect free entry — require explicit "no entry fee" or "free to enter/submit/apply".
        # Do NOT match "submit 1 photo for free (10 USD for each additional)" — those are
        # paid competitions with a free introductory tier.
        if re.search(
            r"\bno\s+entry\s+fees?\b"
            r"|\bno\s+fee\b"
            r"|\bfree\s+to\s+(?:enter|submit|apply)\b"
            r"|\bthere\s+is\s+no\s+entry\s+fee\b"
            r"|\bentry\s+is\s+free\b",
            fee_text,
            re.I,
        ):
            fee = 0.0

        break  # Only one fee section per page

    # --- Extended description ---
    # The full description is in <p itemprop="text"> within <div class="intorno">
    # that has the "Short description" header, OR directly as <p itemprop="text">.
    description_long: Optional[str] = None
    desc_parts: list[str] = []
    for p in soup.find_all("p", attrs={"itemprop": "text"}):
        txt = p.get_text(separator=" ", strip=True)
        if txt:
            desc_parts.append(txt)
    if desc_parts:
        description_long = " ".join(desc_parts)
        description_long = re.sub(r"\s+", " ", description_long).strip()
        description_long = description_long[:3000] if description_long else None

    return {
        "org_name": org_name,
        "application_url": application_url,
        "fee": fee,
        "fee_raw": fee_raw,
        "description_long": description_long,
    }


# ---------------------------------------------------------------------------
# Organizer slug helper
# ---------------------------------------------------------------------------


def _org_slug(org_name: str, title: str) -> str:
    """
    Produce a slug for the _org_name field used in open_call slug generation.
    Uses org_name when available; falls back to a token from the title.
    """
    raw = org_name.strip() if org_name.strip() else title.split()[0]
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")[:40]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl InfoDesigners.eu competition listings.

    Strategy:
      1. Paginate through /latest-competitions/{N} collecting competition stubs
         from JSON-LD Event blocks. Stop when a page has no active competitions
         (all entries are historical/winners posts with endDate 1970-01-01 or
         past deadlines), or when no Event blocks appear at all.
      2. Skip stubs with past or sentinel deadlines — these are historical results,
         not active calls.
      3. Fetch each competition's detail page for organizer name, application URL,
         and fee information.
      4. Insert via insert_open_call() with call_type="submission",
         confidence_tier="aggregated", eligibility="International".

    Returns (found, new, updated).
    """
    source_id = source.get("id")
    found = new = updated = 0

    session = _make_session()

    # -----------------------------------------------------------------------
    # Phase 1: collect all active competition stubs from paginated listing
    # -----------------------------------------------------------------------
    all_stubs: list[dict] = []
    consecutive_empty_pages = 0

    for page_num in range(1, _MAX_PAGES + 1):
        url = _LISTING_URL.format(page=page_num)
        logger.debug("InfoDesigners: fetching listing page %d — %s", page_num, url)

        if page_num > 1:
            time.sleep(_FETCH_DELAY)

        html = _fetch(url, session)
        if not html:
            logger.warning(
                "InfoDesigners: failed to fetch page %d — stopping pagination", page_num
            )
            break

        stubs = _parse_listing_page(html)

        if not stubs:
            # No Event JSON-LD at all on this page — past the end of the listing
            logger.debug(
                "InfoDesigners: page %d returned no events — stopping pagination",
                page_num,
            )
            break

        # Filter out historical entries (sentinel deadline or past deadline)
        active_stubs = [
            s
            for s in stubs
            if not _is_sentinel(s["deadline"]) and not _is_past(s["deadline"])
        ]

        logger.debug(
            "InfoDesigners: page %d — %d events total, %d active",
            page_num,
            len(stubs),
            len(active_stubs),
        )

        if not active_stubs:
            # Entire page is historical — we've scrolled past all live competitions
            consecutive_empty_pages += 1
            if consecutive_empty_pages >= 2:
                logger.debug(
                    "InfoDesigners: %d consecutive pages with no active competitions "
                    "— stopping pagination",
                    consecutive_empty_pages,
                )
                break
        else:
            consecutive_empty_pages = 0
            all_stubs.extend(active_stubs)

        if len(all_stubs) >= _MAX_COMPETITIONS:
            logger.warning(
                "InfoDesigners: hit safety cap of %d competitions at page %d",
                _MAX_COMPETITIONS,
                page_num,
            )
            break

    logger.info(
        "InfoDesigners: %d active competitions found across listing pages",
        len(all_stubs),
    )

    if not all_stubs:
        logger.warning(
            "InfoDesigners: no active competitions found — check if site structure changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert
    # -----------------------------------------------------------------------
    for i, stub in enumerate(all_stubs):
        title = stub["title"]
        deadline = stub["deadline"]
        listing_description = stub["description"]
        image_url = stub.get("image_url") or None
        detail_url = stub["detail_url"]
        official_url = stub["official_url"]

        if not detail_url:
            logger.debug(
                "InfoDesigners: no detail_url for %r — using official_url", title[:60]
            )

        # Polite delay before each detail fetch
        time.sleep(_FETCH_DELAY)

        detail: dict = {}

        if detail_url:
            detail_html = _fetch(detail_url, session)
            if detail_html:
                detail = _parse_detail_page(detail_html)
            else:
                logger.warning(
                    "InfoDesigners: could not fetch detail page for %r — using listing data only",
                    title[:60],
                )

        # Resolve application URL: prefer the submitcontest button, fall back to sameAs
        application_url = detail.get("application_url") or official_url or detail_url
        if not application_url:
            logger.debug(
                "InfoDesigners: no application_url for %r — skipping", title[:60]
            )
            continue

        # Prefer the longer description from the detail page when available
        description = detail.get("description_long") or listing_description or None
        if description:
            description = description[:3000]

        org_name = detail.get("org_name") or ""
        fee = detail.get("fee")
        fee_raw = detail.get("fee_raw")

        found += 1

        org_name_slug = _org_slug(org_name, title)

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline if not _is_sentinel(deadline) else None,
            "application_url": application_url,
            "source_url": detail_url or official_url,
            "call_type": "submission",
            "eligibility": "International",
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name_slug,
            "metadata": {
                "source": "infodesigners",
                "organizer": org_name,
                "official_url": official_url,
                "image_url": image_url,
                "fee_raw": fee_raw,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "InfoDesigners: inserted/updated %r (deadline=%s, org=%s, fee=%s)",
                title[:60],
                deadline,
                org_name[:40] if org_name else "unknown",
                "free" if fee == 0.0 else (fee_raw[:40] if fee_raw else "unknown"),
            )

    logger.info(
        "InfoDesigners: crawl complete — %d found (active), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
