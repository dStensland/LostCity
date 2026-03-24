"""
Crawler for Wooloo.org artist opportunities open calls board.

Wooloo.org (wooloo.org) is an international community platform dedicated
to helping artists discover opportunities: open calls, residencies, grants,
competitions, and exhibitions. It skews heavily toward European and
international calls posted by arts organizations worldwide.

It is NOT a primary source — it aggregates calls posted by organizations
— so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" since Wooloo has a
predominantly European / global coverage and serves the
"National & International" section of the Arts portal Open Calls board.

---------------------------------------------------------------------------
Crawl strategy — AJAX endpoint, static HTML fragments, no Playwright:
---------------------------------------------------------------------------

  Wooloo.org uses jQuery AJAX to populate the listing page. The fragment
  endpoint is accessible via a direct GET (no session cookie required):

    GET https://www.wooloo.org/ajax/search_results_home.php
        ?p=PAGE&s=homefeatured&st=&so=&l=10&pagination=true

  The response is an HTML fragment containing listing cards and a
  pagination bar. There are up to 16 pages; each page contains:
    - 1 "featured" (promoted) listing that rotates across pages
    - 9-10 "most recent" listings that are constant across all pages
    - 2 sign-up CTA cards (opportunityid="0") — skipped

  Strategy to maximize unique coverage without login:
    1. Fetch all 16 pages of the `homefeatured` AJAX endpoint.
    2. Track seen `opportunityid` values — include a listing only once.
    3. Skip cards with opportunityid="0" (sign-up CTAs).
    4. For each unique opportunity, fetch the detail page
       /r.php?d=i&oid=NNNN to get the full description, fee, host, and
       location metadata.
    5. Resolve the application URL by following the /r/NNNN redirect
       (HEAD request) to get the external apply link.

---------------------------------------------------------------------------
HTML structure — index card (inside the AJAX fragment):
---------------------------------------------------------------------------

  <div class="c_title" opportunityid="422697" ...>
    <a href="/r.php?d=i&oid=422697" ...>
      <span class="truncated">TITLE</span>
    </a>
  </div>

  Metadata rows:
    <div ... color: #666666;">Type</div>
    <div ... font-weight: 500;">Exhibition, Online Exhibition</div>
    ...similar pairs for Category, Posted, Status, Deadline...

  Short teaser (snippet of description):
    <div style="float: left; font-size: 12px; font-weight: 500; ...">
      TEASER TEXT
    </div>

---------------------------------------------------------------------------
HTML structure — detail page (/r.php?d=i&oid=NNNN):
---------------------------------------------------------------------------

  Sidebar metadata pairs (class="opportunity_card_head" + "opportunity_card_detail"):
    Type | Deadline | Application Fee | Host | Location | Status

  Full description in #test4 <div>:
    <div id="test4">FULL DESCRIPTION TEXT (may contain <br />, no class)</div>

  Application button:
    <a href="/r/NNNN" class="... btn red darken-4" ...>APPLY NOW</a>

---------------------------------------------------------------------------
Type mapping (Wooloo types → our call_type):
---------------------------------------------------------------------------

  "Residency"                      → residency
  "Residency, Open Studio"         → residency  (multi-value, check substring)
  "Commission"                     → commission
  "Exhibition"                     → submission
  "Online Exhibition"              → submission
  "Competition"                    → submission
  "Grant"                          → grant
  "Award"                          → grant
  "Prize"                          → grant
  "Fellowship"                     → fellowship
  "Open Studio"                    → submission
  "Publication"                    → submission
  "Other"                          → submission  (fallback)

  Types are comma-separated in the card; the FIRST recognized type wins.
  Unknown types fall back to "submission".

---------------------------------------------------------------------------
Fee handling:
---------------------------------------------------------------------------

  The detail page has a structured "Application Fee" field. Values seen:
    "$45"         → fee=45.0, fee_raw="$45"
    "Free"        → fee=0.0,  fee_raw="free"
    ""  (absent)  → fee=None, fee_raw=None

  We parse the leading currency amount with a regex. Multi-fee listings
  (e.g. "$25/$15 members") store the lower number and the raw string.

---------------------------------------------------------------------------
Deadline parsing:
---------------------------------------------------------------------------

  Index card:  "December  31, 2050" (padded with spaces)
  Detail page: "April     22, 2026" (same padded format)

  Parsed with strptime("%B %d, %Y") after collapsing whitespace.
  Past-deadline calls are skipped before insertion.

---------------------------------------------------------------------------
Pagination / coverage:
---------------------------------------------------------------------------

  The 9 constant "most recent" items appear on every page. The featured
  (promoted) item rotates: there are ~8 unique featured IDs across 16 pages.
  Total unique coverage without login: ~17 items per crawl.

  Wooloo's full catalog is gated behind registration. This crawler captures
  the public-facing layer only. Unlike ArtRabbit (which exposes its full ~70
  listings without auth), Wooloo exposes only ~17. If login credentials are
  ever configured, the crawl logic can be extended to authenticate and sweep
  the full catalog.
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

BASE_URL = "https://www.wooloo.org"
AJAX_URL = f"{BASE_URL}/ajax/search_results_home.php"
DETAIL_URL_TMPL = f"{BASE_URL}/r.php?d=i&oid={{oid}}"
APPLY_REDIRECT_TMPL = f"{BASE_URL}/r/{{oid}}"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 20

# Number of index pages to iterate (pagination shows up to 16)
MAX_PAGES = 16

# Polite inter-request delay (seconds)
INTER_REQUEST_DELAY = 0.8

# ---------------------------------------------------------------------------
# Type mapping
# ---------------------------------------------------------------------------

# Wooloo types are comma-separated; we check each token in priority order.
_TYPE_MAP: dict[str, str] = {
    "residency": "residency",
    "open studio": "submission",
    "commission": "commission",
    "exhibition": "submission",
    "online exhibition": "submission",
    "competition": "submission",
    "grant": "grant",
    "award": "grant",
    "prize": "grant",
    "fellowship": "fellowship",
    "publication": "submission",
    "other": "submission",
}


def _classify_type(raw_type: str) -> str:
    """
    Map a Wooloo type string (possibly comma-separated) to our call_type.

    Tries each comma-separated token in order; returns the first match.
    Falls back to "submission" for unknown tokens.
    """
    for token in (t.strip().lower() for t in raw_type.split(",")):
        if token in _TYPE_MAP:
            return _TYPE_MAP[token]
    logger.debug("Wooloo: unknown type %r — defaulting to submission", raw_type)
    return "submission"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# Wooloo deadline text: "December  31, 2050" — extra spaces between month and day
_DEADLINE_COLLAPSE_RE = re.compile(r"\s+")


def _parse_deadline(raw: str) -> Optional[str]:
    """
    Parse a Wooloo deadline string like "April     22, 2026" into ISO "YYYY-MM-DD".

    Returns None if unparseable.
    """
    cleaned = _DEADLINE_COLLAPSE_RE.sub(" ", raw.strip())
    if not cleaned or cleaned.lower() in ("n/a", "none", "open"):
        return None
    try:
        dt = datetime.strptime(cleaned, "%B %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        logger.debug("Wooloo: could not parse deadline %r", raw)
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------

# Matches leading currency amount, e.g. "$45", "€30", "£20", "25"
_FEE_AMOUNT_RE = re.compile(r"[\$€£]?\s*(\d+(?:\.\d+)?)")


def _parse_fee(raw: str) -> tuple[Optional[float], Optional[str]]:
    """
    Parse a Wooloo fee string into (fee_float, fee_raw).

    Returns (0.0, "free") for free listings, (None, raw) for strings we
    can't parse to a single number, (amount, raw) for clear numeric fees.
    """
    stripped = raw.strip()
    if not stripped:
        return None, None
    if re.search(r"\bfree\b", stripped, re.I):
        return 0.0, "free"
    # For multi-tier fees like "$25/$15 members", take the smaller amount
    amounts = _FEE_AMOUNT_RE.findall(stripped)
    if amounts:
        fee_val = min(float(a) for a in amounts)
        return fee_val, stripped[:80]
    return None, stripped[:80]


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"{BASE_URL}/searchindex",
        }
    )
    return session


def _fetch(url: str, session: requests.Session, method: str = "GET") -> Optional[str]:
    """Fetch a URL and return its HTML/text body, or None on failure."""
    try:
        if method == "HEAD":
            resp = session.head(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
            resp.raise_for_status()
            return resp.url  # final URL after redirects
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Wooloo: failed to fetch %s: %s", url, exc)
        return None


def _resolve_apply_url(oid: str, session: requests.Session) -> Optional[str]:
    """
    Follow the /r/NNNN redirect to get the real external application URL.

    Returns the final URL after redirects, or None if the request fails.
    We use a HEAD request to avoid downloading the full target page.
    """
    redirect_url = APPLY_REDIRECT_TMPL.format(oid=oid)
    try:
        resp = session.head(
            redirect_url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        final_url = resp.url
        # If we ended up back on wooloo.org, the redirect didn't work
        if "wooloo.org" in final_url:
            return None
        return final_url
    except requests.RequestException as exc:
        logger.debug("Wooloo: redirect fetch failed for oid=%s: %s", oid, exc)
        return None


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _extract_label_value_pairs(soup: BeautifulSoup) -> dict[str, str]:
    """
    Extract label→value pairs from the Wooloo detail/card layout.

    Labels are in divs with color: #666666 or class opportunity_card_head;
    their next sibling div contains the value.

    Returns a dict like {"Type": "Exhibition", "Deadline": "April 22, 2026", ...}.
    """
    pairs: dict[str, str] = {}

    # Detail page uses opportunity_card_head / opportunity_card_detail classes
    for head in soup.find_all(class_="opportunity_card_head"):
        label = head.get_text(strip=True)
        detail = head.find_next_sibling(class_="opportunity_card_detail")
        if detail:
            pairs[label] = detail.get_text(strip=True)

    # Index card uses inline style color:#666666 labels
    if not pairs:
        for div in soup.find_all("div", style=True):
            style = div.get("style", "")
            if "color: #666666" in style or "color:#666666" in style:
                label = div.get_text(strip=True)
                val_div = div.find_next_sibling("div")
                if val_div:
                    pairs[label] = val_div.get_text(strip=True)

    return pairs


def _parse_index_card(card_div) -> Optional[dict]:
    """
    Parse a listing card from the index page fragment.

    Returns a dict with keys: oid, title, source_url, raw_type, deadline,
    teaser, or None if the card is a CTA (oid=0) or missing required data.
    """
    title_div = card_div.find(class_="c_title")
    if title_div is None:
        return None

    oid = title_div.get("opportunityid", "0").strip()
    if not oid or oid == "0":
        return None  # sign-up CTA cards

    a_tag = title_div.find("a", href=True)
    if not a_tag:
        return None
    title = a_tag.get_text(strip=True)
    if not title:
        return None

    source_url = f"{BASE_URL}/r.php?d=i&oid={oid}"

    # Extract metadata pairs from this card
    pairs = _extract_label_value_pairs(card_div)

    raw_type = pairs.get("Type", "")
    raw_deadline = pairs.get("Deadline", "")
    raw_status = pairs.get("Status", "")

    # Skip closed listings immediately
    if raw_status and "closed" in raw_status.lower():
        logger.debug("Wooloo: skipping %r — status is closed", title[:60])
        return None

    deadline = _parse_deadline(raw_deadline) if raw_deadline else None

    # Extract teaser text (the short description snippet on the card)
    # It's the last standalone <div> with font-size:12px; font-weight:500
    teaser = ""
    # Find the last such div after the metadata block
    all_text_divs = card_div.find_all(
        "div",
        style=lambda s: s and "font-size: 12px" in s and "font-weight: 500" in s and "width: 80px" not in s,
    )
    if all_text_divs:
        teaser = all_text_divs[-1].get_text(strip=True)

    return {
        "oid": oid,
        "title": title,
        "source_url": source_url,
        "raw_type": raw_type,
        "deadline": deadline,
        "teaser": teaser,
    }


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse the AJAX fragment HTML and return a list of raw listing dicts.

    Each dict has keys from _parse_index_card. Skips CTA cards (oid=0).
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []

    # Each listing is in a .card element
    for card in soup.find_all(class_="card"):
        parsed = _parse_index_card(card)
        if parsed is not None:
            results.append(parsed)

    return results


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, oid: str) -> dict:
    """
    Parse a Wooloo detail page (/r.php?d=i&oid=NNNN).

    Returns a dict with keys: description, raw_type, deadline, raw_fee,
    host, location, raw_status.  Any missing field is an empty string.
    """
    soup = BeautifulSoup(html, "html.parser")
    result: dict = {
        "description": "",
        "raw_type": "",
        "deadline": None,
        "raw_fee": "",
        "host": "",
        "location": "",
        "raw_status": "",
    }

    # Sidebar metadata pairs
    pairs = _extract_label_value_pairs(soup)
    result["raw_type"] = pairs.get("Type", "")
    result["raw_status"] = pairs.get("Status", "")
    result["host"] = pairs.get("Host", "")
    result["location"] = pairs.get("Location", "")
    result["raw_fee"] = pairs.get("Application Fee", "")

    raw_deadline = pairs.get("Deadline", "")
    result["deadline"] = _parse_deadline(raw_deadline) if raw_deadline else None

    # Full description is in div#test4
    desc_div = soup.find("div", id="test4")
    if desc_div:
        # Replace <br/> with newlines before extracting text
        for br in desc_div.find_all("br"):
            br.replace_with("\n")
        description = desc_div.get_text(separator="\n", strip=True)
        if len(description) > 2000:
            description = description[:1997] + "..."
        result["description"] = description

    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Wooloo.org opportunities listing.

    Strategy:
      1. Iterate all 16 pages of the homefeatured AJAX endpoint (GET).
      2. Parse listing cards; track seen opportunity IDs to avoid duplicates.
      3. Skip past-deadline and closed listings.
      4. For each unique open opportunity, fetch its detail page for the
         full description, fee, host, and location metadata.
      5. Follow /r/NNNN to resolve the real external application URL.
      6. Insert via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _build_session()

    seen_oids: set[str] = set()
    all_listings: list[dict] = []

    # --- Phase 1: Collect unique listing stubs from all index pages ---
    for page in range(1, MAX_PAGES + 1):
        params = {
            "p": page,
            "s": "homefeatured",
            "st": "",
            "so": "",
            "l": "10",
            "pagination": "true",
        }
        # Build query string manually for a clean GET URL
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{AJAX_URL}?{qs}"

        html = _fetch(url, session)
        if not html:
            logger.warning("Wooloo: failed to fetch index page %d, stopping", page)
            break

        cards = _parse_index_page(html)
        new_this_page = 0
        for card in cards:
            oid = card["oid"]
            if oid in seen_oids:
                continue
            seen_oids.add(oid)
            all_listings.append(card)
            new_this_page += 1

        logger.debug(
            "Wooloo: page %d — %d cards, %d new unique (total=%d)",
            page,
            len(cards),
            new_this_page,
            len(all_listings),
        )

        time.sleep(INTER_REQUEST_DELAY)

    if not all_listings:
        logger.warning("Wooloo: no listings found — check if page structure changed")
        return 0, 0, 0

    logger.info("Wooloo: %d unique listings collected from index", len(all_listings))

    # --- Phase 2: Enrich each listing with detail-page data and insert ---
    skipped_deadline = 0
    skipped_closed = 0
    skipped_no_url = 0

    for stub in all_listings:
        oid = stub["oid"]
        title = stub["title"]
        source_url = stub["source_url"]

        # Quick deadline check from index stub (avoids unnecessary detail fetch)
        if stub.get("deadline") and _is_past_deadline(stub["deadline"]):
            skipped_deadline += 1
            logger.debug(
                "Wooloo: skipping %r — index deadline %s passed",
                title[:60],
                stub["deadline"],
            )
            continue

        # Fetch detail page
        detail_url = DETAIL_URL_TMPL.format(oid=oid)
        detail_html = _fetch(detail_url, session)
        time.sleep(INTER_REQUEST_DELAY)

        if detail_html:
            detail = _parse_detail_page(detail_html, oid)
        else:
            # Fall back to stub data only
            detail = {
                "description": stub.get("teaser") or None,
                "raw_type": stub.get("raw_type", ""),
                "deadline": stub.get("deadline"),
                "raw_fee": "",
                "host": "",
                "location": "",
                "raw_status": "",
            }

        # Status check from detail page
        raw_status = detail.get("raw_status", "")
        if raw_status and "closed" in raw_status.lower():
            skipped_closed += 1
            logger.debug("Wooloo: skipping %r — detail status closed", title[:60])
            continue

        # Authoritative deadline from detail page
        deadline = detail.get("deadline") or stub.get("deadline")
        if deadline and _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Wooloo: skipping %r — deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        # Resolve external application URL
        application_url = _resolve_apply_url(oid, session)
        time.sleep(INTER_REQUEST_DELAY)
        if not application_url:
            # Fall back to the Wooloo detail page itself as the source_url
            application_url = source_url
            skipped_no_url += 1
            logger.debug(
                "Wooloo: could not resolve external apply URL for oid=%s — using detail page",
                oid,
            )

        found += 1

        # Type classification (prefer detail page type, fall back to index)
        raw_type = detail.get("raw_type") or stub.get("raw_type", "")
        call_type = _classify_type(raw_type)

        # Host / org name
        host = detail.get("host", "").strip()
        org_name = host or "wooloo"

        # Description
        description = detail.get("description") or stub.get("teaser") or None
        if description and host and host.lower() not in description.lower()[:120]:
            description = f"{host}: {description}"

        # Fee
        raw_fee = detail.get("raw_fee", "").strip()
        fee_val, fee_raw = _parse_fee(raw_fee) if raw_fee else (None, None)

        # Location
        location = detail.get("location", "").strip()

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": "International",
            "fee": fee_val,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name,
            "metadata": {
                "organization": host,
                "location": location,
                "raw_type": raw_type,
                "fee_raw": fee_raw,
                "wooloo_oid": oid,
                "scope": "international",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Wooloo: inserted/updated %r (oid=%s, deadline=%s, type=%s)",
                title[:60],
                oid,
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("Wooloo: skipped %d past-deadline listings", skipped_deadline)
    if skipped_closed:
        logger.info("Wooloo: skipped %d closed listings", skipped_closed)
    if skipped_no_url:
        logger.info(
            "Wooloo: %d listings used detail page URL (external apply not resolved)",
            skipped_no_url,
        )

    logger.info(
        "Wooloo: %d found (open, non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
