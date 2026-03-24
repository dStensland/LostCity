"""
Crawler for ArtShow.com juried shows / open calls (artshow.com/juriedshows/).

ArtShow.com is a long-running aggregator for calls-to-artists — juried
exhibitions, online competitions, art fairs, and national/international shows.
Listings are posted by the organizing galleries and arts organizations directly.
Confidence tier: "aggregated".

Page structure — single static HTML page, no pagination, no JavaScript required:

  Base URL: https://www.artshow.com/juriedshows/
  Each listing is a <div class="col-md-3 col-sm-4 listing col-centered"> with:
    data-enddate="M/D/YYYY"           — deadline in M/D/YYYY format (always present)
    <a name="{id}">                   — unique numeric anchor
    <div class="region">              — geographic scope ("International", "National",
                                         "Statewide", "Local")
    <div class="date">
      <span class="month">Mar</span>  — abbreviated month (redundant with data-enddate)
      <span class="num">27</span>     — day number
    </div>
    <h4><span class="OppTitle">       — title
    {body text}                       — description with fee, prize, juror, media info
    <span class="deadline">           — "Deadline: Month DD, YYYY" (human-readable)
    <a href="...">More info</a>       — external application/detail URL (may be absent)

Deadline parsing:
  The data-enddate attribute uses M/D/YYYY (e.g. "3/27/2026"). This is always
  present and is the most reliable deadline source. The human-readable
  <span class="deadline"> is redundant and not needed.

Fee extraction:
  Fees appear inline in free-text: "$18 for 1-2 entries", "$45 for up to 3",
  "$35 entry fee". We extract the first dollar-amount mention as fee_raw.
  The fee column stores the first numeric value found (entry fee for 1 entry).
  "No entry fee" / "free" cases are detected and stored as fee=0.

Prize extraction:
  Prize amounts appear inline. We capture the raw text segment around the
  first prize mention for the metadata field.

Juror extraction:
  "Jurors: Name, Name" or "Juror: Name" patterns captured via regex.

Scope normalization:
  "International Call for Artists" → "international"
  "National Call for Artists"      → "national"
  "Statewide Call for Artists"     → "statewide"
  "Local Call for Artists"         → "local"

Application URL:
  The "More info" link (external) is the application_url when present.
  When absent, the anchor link back to the artshow.com listing is used
  (https://www.artshow.com/juriedshows/index.html#{anchor_id}).

Call type: always "submission" — ArtShow.com exclusively lists juried
  exhibition calls and art competitions.

Rate limiting: single page load only. No delays needed.
"""

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INDEX_URL = "https://www.artshow.com/juriedshows/"
BASE_ANCHOR_URL = "https://www.artshow.com/juriedshows/index.html#{}"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Scope normalization
# ---------------------------------------------------------------------------

_SCOPE_MAP = {
    "international": "international",
    "national": "national",
    "statewide": "statewide",
    "local": "local",
}


def _normalize_scope(region_text: str) -> str:
    """
    Map ArtShow.com region label to a normalized scope string.

    "International Call for Artists" → "international"
    Falls back to "national" if the region text doesn't match.
    """
    lower = region_text.lower()
    for key, val in _SCOPE_MAP.items():
        if key in lower:
            return val
    return "national"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# data-enddate uses M/D/YYYY — e.g. "3/27/2026" or "12/1/2026"
_ENDDATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def _parse_enddate(attr_value: str) -> Optional[str]:
    """
    Parse a data-enddate attribute value into ISO format.

    Input:  "3/27/2026"
    Output: "2026-03-27"
    Returns None if the value doesn't match or is invalid.
    """
    if not attr_value:
        return None
    m = _ENDDATE_RE.match(attr_value.strip())
    if not m:
        return None
    try:
        month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        datetime(year, month, day)  # validate
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
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
# Fee extraction
# ---------------------------------------------------------------------------

# Explicit entry fee patterns — these anchor on fee-specific keywords so we
# don't accidentally pick up prize/award amounts that appear earlier in text.
# Priority order: most specific first.
_EXPLICIT_FEE_RE = re.compile(
    r"(?:"
    # "$N per artwork" / "$N per entry" / "$N per image"
    r"\$\s*(\d+(?:\.\d{2})?)\s+per\s+(?:artwork|entry|image|piece|work|photo)\b"
    r"|"
    # "$N entry fee" / "$N entry" / "$N submission fee"
    r"\$\s*(\d+(?:\.\d{2})?)\s+(?:entry|submission|application)\s*fee?\b"
    r"|"
    # "entry fee: $N" / "entry fee is $N"
    r"(?:entry|submission|application)\s+fee\s*(?:is|of|:|–)?\s*\$\s*(\d+(?:\.\d{2})?)"
    r"|"
    # "$N for N entries" / "$N for up to N"
    r"\$\s*(\d+(?:\.\d{2})?)\s+for\s+(?:\d+|up\s+to\s+\d+)\s+(?:entries|images?|works?|photos?)\b"
    r"|"
    # "non-refundable entry fees are $N"
    r"non-?refundable\s+entry\s+fees?\s+are\s+\$\s*(\d+(?:\.\d{2})?)"
    r")",
    re.I,
)

_FREE_RE = re.compile(
    r"\bno\s+(?:entry|application|submission)\s+fee\b"
    r"|\bfree\s+to\s+(?:apply|enter|submit)\b"
    r"|\bentry\s+is\s+free\b"
    r"|\bno\s+fee\s+to\s+(?:apply|enter|submit)\b",
    re.I,
)


def _extract_fee(body_text: str) -> tuple[Optional[float], Optional[str]]:
    """
    Extract fee information from listing body text.

    Returns (fee_numeric, fee_raw):
      fee_numeric: float (entry fee for 1 work) or 0.0 for free, or None if unknown
      fee_raw: short raw string captured near the match, or "free"

    Strategy: only match explicit entry fee patterns — keyword anchored — so
    prize/award amounts (which typically appear before entry fees in the text)
    are not misidentified as fees. When no explicit fee phrase is found, fee
    is returned as None rather than guessing from raw dollar amounts.
    """
    if _FREE_RE.search(body_text):
        return 0.0, "free"

    m = _EXPLICIT_FEE_RE.search(body_text)
    if not m:
        return None, None

    # Extract the first non-None capture group
    raw_num = next((g for g in m.groups() if g is not None), None)
    if not raw_num:
        return None, None

    try:
        fee_numeric = float(raw_num.replace(",", ""))
    except ValueError:
        return None, None

    # Build fee_raw from the match itself plus trailing context
    match_text = m.group(0)
    end = min(len(body_text), m.end() + 60)
    trailing = body_text[m.end():end]
    # Trim trailing context at the first sentence boundary
    for ch in [".", "\n", ";"]:
        idx = trailing.find(ch)
        if 0 <= idx < 60:
            trailing = trailing[:idx]
            break
    fee_raw = (match_text + trailing).strip()

    return fee_numeric, fee_raw[:100]


# ---------------------------------------------------------------------------
# Prize extraction
# ---------------------------------------------------------------------------

_PRIZE_RE = re.compile(
    r"(?:"
    r"(?:best\s+in\s+show|grand\s+(?:jury\s+)?(?:prize|award)|first\s+place|top\s+prize)"
    r"[^.]{0,60}\$[\d,]+"
    r"|"
    r"\$[\d,]+[^.]{0,60}(?:prize|award|purse|scholarship|honorarium|stipend)"
    r")",
    re.I,
)


def _extract_prize_raw(body_text: str) -> Optional[str]:
    """
    Extract a raw prize/award mention from listing body text.

    Returns the first matched segment (up to 120 chars) or None.
    """
    m = _PRIZE_RE.search(body_text)
    if not m:
        return None
    return m.group(0)[:120].strip()


# ---------------------------------------------------------------------------
# Juror extraction
# ---------------------------------------------------------------------------

# "Juror: Name" or "Jurors: Name, Name" — stop at period, newline, or
# keyword phrases that indicate a new sentence (e.g. "Eligible media")
_JUROR_RE = re.compile(r"[Jj]urors?[:.]?\s+([^.\n]{5,150})")

# Phrases that signal the juror extraction has run past the name(s)
_JUROR_STOP_RE = re.compile(
    r"\beligible\s+media\b|\bentry\s+fee\b|\bopen\s+to\b|\bdeadline\b",
    re.I,
)


def _extract_jurors(body_text: str) -> Optional[str]:
    """
    Extract juror name(s) from listing body text.

    Returns the first matched juror string (trimmed to 120 chars) or None.
    Stops at sentence boundaries and known non-name keyword phrases.
    """
    m = _JUROR_RE.search(body_text)
    if not m:
        return None
    jurors = m.group(1).strip().rstrip(",").strip()
    # Trim at natural boundary (period, semicolon, newline)
    for ch in [".", ";", "\n"]:
        idx = jurors.find(ch)
        if 0 < idx < 120:
            jurors = jurors[:idx].strip()
            break
    # Guard: if the extracted string contains a stop-phrase, discard it
    if _JUROR_STOP_RE.search(jurors):
        return None
    return jurors[:120] if jurors else None


# ---------------------------------------------------------------------------
# Media extraction
# ---------------------------------------------------------------------------

# Common media/medium mentions — capture a short phrase after the keyword
_MEDIA_RE = re.compile(
    r"(?:"
    r"(?:all|any|various)\s+(?:traditional\s+and\s+non-traditional\s+)?(?:media|mediums?)\b"
    r"|(?:2D\s+and\s+3D\s+artists)"
    r"|(?:open\s+to\s+a\s+variety\s+of\s+mediums?)"
    r")",
    re.I,
)

# Explicit medium list — e.g. "paintings, drawings, pottery, sculpture, jewelry"
_MEDIA_LIST_RE = re.compile(
    r"(?:media|medium|mediums?|artwork)\s+(?:may\s+)?include[s]?\s+([^.]{10,200})",
    re.I,
)


def _extract_media(body_text: str) -> Optional[str]:
    """
    Extract eligible media description from listing body text.

    Returns a short string describing accepted media, or None.
    """
    # Check for explicit "all media" phrasing first
    if _MEDIA_RE.search(body_text):
        m = _MEDIA_RE.search(body_text)
        return m.group(0)[:80].strip() if m else None

    # Check for explicit media list
    m = _MEDIA_LIST_RE.search(body_text)
    if m:
        raw = m.group(1).strip()
        # Trim at sentence boundary
        for ch in [".", "\n", ";"]:
            idx = raw.find(ch)
            if 0 < idx < 150:
                raw = raw[:idx].strip()
                break
        return raw[:150] if raw else None

    return None


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
            "Referer": "https://www.artshow.com/",
        }
    )
    return session


def _fetch_index(session: requests.Session) -> Optional[str]:
    """Fetch the ArtShow.com juried shows page. Returns HTML or None on failure."""
    try:
        resp = session.get(INDEX_URL, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.error("ArtShow: failed to fetch index page: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Listing parser
# ---------------------------------------------------------------------------


def _parse_listing(div) -> Optional[dict]:
    """
    Parse a single listing <div class="... listing ..."> element.

    Returns a dict with all extracted fields, or None if the listing is
    missing required fields (title, deadline, anchor ID).
    """
    # --- Anchor ID (used to build the artshow.com permalink) ---
    anchor = div.find("a", {"name": True})
    anchor_id = anchor["name"].strip() if anchor else ""

    # --- Deadline from data-enddate attribute ---
    deadline = _parse_enddate(div.get("data-enddate", ""))
    if not deadline:
        # Fallback: parse from the human-readable span
        dl_span = div.find("span", class_="deadline")
        if dl_span:
            # "Deadline: March 27, 2026"
            dl_text = dl_span.get_text(strip=True)
            try:
                dt = datetime.strptime(
                    dl_text.replace("Deadline:", "").strip(), "%B %d, %Y"
                )
                deadline = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

    # --- Geographic scope ---
    region_div = div.find("div", class_="region")
    scope = "national"
    if region_div:
        scope = _normalize_scope(region_div.get_text(separator=" ", strip=True))

    # --- Title ---
    title_span = div.find("span", class_="OppTitle")
    if title_span:
        title = title_span.get_text(strip=True)
    else:
        h4 = div.find("h4")
        title = h4.get_text(strip=True) if h4 else ""

    if not title:
        return None

    # --- External "More info" / application URL ---
    # Look for the "More info" link (external, not artshow.com, not social)
    application_url: Optional[str] = None
    for a in div.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            continue
        if any(skip in href for skip in ("artshow.com", "facebook.com", "twitter.com")):
            continue
        if "mailto:" in href:
            continue
        application_url = href
        break

    # Fallback: artshow.com anchor permalink
    if not application_url:
        if anchor_id:
            application_url = BASE_ANCHOR_URL.format(anchor_id)
        else:
            application_url = INDEX_URL

    # --- Source URL always points to the artshow.com anchor ---
    source_url = BASE_ANCHOR_URL.format(anchor_id) if anchor_id else INDEX_URL

    # --- Body text for extraction (excludes share buttons, region, date div) ---
    # Remove non-content divs before extracting body text
    body_div = BeautifulSoup(str(div), "html.parser")
    for noise in body_div.find_all(class_=["share-buttons", "date", "region"]):
        noise.decompose()
    for noise in body_div.find_all("span", class_="deadline"):
        noise.decompose()
    body_text = body_div.get_text(separator=" ", strip=True)

    # --- Fee ---
    fee_numeric, fee_raw = _extract_fee(body_text)

    # --- Prize ---
    prize_raw = _extract_prize_raw(body_text)

    # --- Jurors ---
    jurors = _extract_jurors(body_text)

    # --- Eligible media ---
    media = _extract_media(body_text)

    # --- Description: clean body text, capped at 1500 chars ---
    description = body_text[:1500] if body_text else None

    # --- Organizer: first external non-social link text (gallery/org name) ---
    org_name = ""
    for a in div.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            continue
        if any(skip in href for skip in ("artshow.com", "facebook.com", "twitter.com")):
            continue
        if "mailto:" in href:
            continue
        text = a.get_text(strip=True)
        if text and text.lower() not in ("more info", "website", "apply", "here"):
            org_name = text
            break

    return {
        "title": title,
        "deadline": deadline,
        "scope": scope,
        "application_url": application_url,
        "source_url": source_url,
        "description": description,
        "fee": fee_numeric,
        "fee_raw": fee_raw,
        "prize_raw": prize_raw,
        "jurors": jurors,
        "media": media,
        "org_name": org_name,
        "anchor_id": anchor_id,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the ArtShow.com juried shows listing.

    Strategy:
      1. Fetch the single static HTML page.
      2. Parse each listing div for title, deadline, scope, fee, prize,
         jurors, eligible media, and application URL.
      3. Skip listings whose deadline has already passed.
      4. Insert or update via insert_open_call().

    All listings are call_type="submission" — ArtShow.com exclusively lists
    juried exhibition calls and art competitions.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    skipped_deadline = 0

    session = _make_session()

    # Fetch the single index page
    html = _fetch_index(session)
    if not html:
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")

    # All listings share the "listing" class alongside Bootstrap grid classes
    listing_divs = soup.find_all(
        "div", class_=lambda c: c and "listing" in c.split()
    )

    if not listing_divs:
        logger.warning(
            "ArtShow: no listing divs found — page structure may have changed"
        )
        return 0, 0, 0

    logger.info("ArtShow: found %d listing divs on the page", len(listing_divs))

    for div in listing_divs:
        parsed = _parse_listing(div)
        if not parsed:
            logger.debug("ArtShow: skipping unparseable listing div")
            continue

        title = parsed["title"]
        deadline = parsed["deadline"]

        # Skip past-deadline listings
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "ArtShow: skipping %r — deadline %s passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        # Build org slug for dedup key
        org_slug = re.sub(r"[^a-z0-9]+", "-", parsed["org_name"].lower()).strip("-")
        org_slug = org_slug[:40] if org_slug else "artshow"

        metadata: dict = {
            "source": "artshow",
            "scope": parsed["scope"],
        }
        if parsed["fee_raw"]:
            metadata["fee_raw"] = parsed["fee_raw"]
        if parsed["prize_raw"]:
            metadata["prize_raw"] = parsed["prize_raw"]
        if parsed["jurors"]:
            metadata["jurors"] = parsed["jurors"]
        if parsed["media"]:
            metadata["eligible_media"] = parsed["media"]
        if parsed["org_name"]:
            metadata["organization"] = parsed["org_name"]

        call_data: dict = {
            "title": title,
            "description": parsed["description"],
            "deadline": deadline,
            "application_url": parsed["application_url"],
            "source_url": parsed["source_url"],
            "call_type": "submission",
            "eligibility": parsed["scope"],
            "fee": parsed["fee"],
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": metadata,
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ArtShow: inserted/updated %r (deadline=%s, scope=%s, fee=%s)",
                title[:60],
                deadline,
                parsed["scope"],
                parsed["fee"],
            )

    if skipped_deadline:
        logger.info("ArtShow: skipped %d past-deadline listings", skipped_deadline)

    logger.info(
        "ArtShow: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
