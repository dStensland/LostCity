"""
Crawler for Artist Communities Alliance (ACA) open calls directory.

URL: https://artistcommunities.org/directory/open-calls

ACA is the national membership organization for artist residency programs —
300+ member organizations including MacDowell, Yaddo, Hambidge, Ragdale, and
hundreds of smaller programs. Their open calls directory is the single most
comprehensive listing of residency opportunities in the US, typically showing
80-100 active calls at any time.

Because ACA aggregates calls from many member organizations (not just its own
programs), confidence_tier is "aggregated". The directory is updated by member
organizations directly via ACA's Drupal 10 platform.

Crawl strategy — two phases, static HTML (no JavaScript rendering needed):

  Phase 1 — Index page (https://artistcommunities.org/directory/open-calls):
    A single HTML <table> lists all active open calls. All future-deadline
    calls appear on one page (no pagination needed). Each <tr> has four <td>:
      Col 0: "OrgName | CallTitle" — org name as plain text before the pipe,
             call title as <a href="/directory/open-calls/{slug}">
      Col 1: "view" link (duplicate of col 0 href — ignored)
      Col 2: <time datetime="YYYY-MM-DDTHH:MM:SSZ"> — deadline (UTC noon)
      Col 3: "State, Country" — residency location (may be empty)

    ACA only shows future-deadline calls on this page; past entries are
    removed. We add an explicit deadline guard anyway for safety.

  Phase 2 — Detail pages (one per call):
    Each detail page is a Drupal node with rich structured fields:
      .field--name-field-oc-residency-description   — full description
      .field--name-field-deadline time              — deadline (authoritative)
      .field--name-field-application-url a          — application URL
      .field--name-field-discipline .field__item    — list of disciplines
      .field--name-field-stage-of-career            — career stage
      .field--name-field-country-of-residence       — residence eligibility
      .field--name-field-additional-eligibility     — extra eligibility text
      .field--name-field-application-fee            — fee amount + currency
      .field--name-field-associated-residency a     — org directory link

    Application URL priority:
      1. .field--name-field-application-url a[href] (external application)
      2. Source URL (detail page — always a valid canonical fallback)

Rate limiting:
  ACA is a nonprofit with limited infrastructure. We add a 1.5s delay between
  detail page fetches. With ~90 calls, a full run takes ~2.5 minutes.
  The crawler should run weekly — ACA adds new calls regularly.

Scope and metadata:
  metadata.scope = "national" for US-located programs,
                   "international" for programs outside the US.
  Disciplines, career stage, and residence eligibility are captured in the
  eligibility string and in metadata.disciplines for future filtering.

Confidence tier: "aggregated" — ACA lists calls on behalf of member programs.
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

BASE_URL = "https://artistcommunities.org"
INDEX_URL = "https://artistcommunities.org/directory/open-calls"

# Polite delay between detail page fetches (seconds)
_FETCH_DELAY = 1.5

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# Safety cap — the directory shows ~90 calls. Raise only if ACA grows.
_MAX_LISTINGS = 300


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
    """Fetch a URL and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ACA: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Ensure href is absolute."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Deadline helpers
# ---------------------------------------------------------------------------


def _parse_deadline_iso(dt_str: str) -> Optional[str]:
    """
    Extract YYYY-MM-DD from an ISO 8601 datetime string.

    ACA stores deadlines as UTC noon: e.g. "2026-04-01T12:00:00Z".
    We take the date portion — UTC noon is unambiguous for any US timezone.
    """
    if not dt_str:
        return None
    m = re.match(r"(\d{4}-\d{2}-\d{2})", dt_str)
    return m.group(1) if m else None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Phase 1: index page parser
# ---------------------------------------------------------------------------


def _parse_index(html: str) -> list[dict]:
    """
    Parse the ACA open calls index page.

    Returns a list of dicts (one per active call) with keys:
      href, title, org_name, deadline, location
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        logger.warning(
            "ACA: could not find listings table on index page — site may have changed"
        )
        return []

    listings: list[dict] = []

    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 3:
            continue  # Skip any rows without enough columns

        # --- Cell 0: "OrgName  |  CallTitle" with an anchor ---
        cell0 = cells[0]
        # Normalize non-breaking spaces and zero-width chars
        full_text = re.sub(
            r"[\xa0\u200b\s]+", " ", cell0.get_text(separator=" ")
        ).strip()

        a = cell0.find("a", href=True)
        if not a:
            continue
        href = a["href"]
        title = re.sub(r"[\xa0\u200b\s]+", " ", a.get_text()).strip()
        if not title:
            continue

        # Org name is everything before " | "
        org_name = ""
        if " | " in full_text:
            org_name = full_text.split(" | ", 1)[0].strip()

        # --- Cell 2: deadline <time datetime="..."> ---
        time_el = cells[2].find("time") if len(cells) > 2 else None
        deadline = _parse_deadline_iso(time_el.get("datetime", "")) if time_el else None

        # --- Cell 3: residency location (may be empty) ---
        location = cells[3].get_text(strip=True) if len(cells) > 3 else ""

        listings.append(
            {
                "href": href,
                "title": title,
                "org_name": org_name,
                "deadline": deadline,
                "location": location,
            }
        )

    logger.debug("ACA: parsed %d listings from index page", len(listings))
    return listings[:_MAX_LISTINGS]


# ---------------------------------------------------------------------------
# Phase 2: detail page parser
# ---------------------------------------------------------------------------


def _get_field_text(soup: BeautifulSoup, css_class: str) -> str:
    """
    Extract clean text from a Drupal field element, stripping the field label.

    Pass the full class fragment, e.g. 'field--name-field-stage-of-career'.
    """
    el = soup.select_one(f".{css_class}")
    if not el:
        return ""
    # Decompose the label element so it doesn't pollute the text
    label = el.select_one(".field__label")
    if label:
        label.decompose()
    return el.get_text(separator=" ", strip=True)


def _parse_disciplines(soup: BeautifulSoup) -> list[str]:
    """Return list of discipline strings from the discipline field."""
    disc_field = soup.select_one(".field--name-field-discipline")
    if not disc_field:
        return []
    return [
        item.get_text(strip=True)
        for item in disc_field.select(".field__item")
        if item.get_text(strip=True)
    ]


def _parse_fee(soup: BeautifulSoup) -> Optional[float]:
    """
    Extract application fee amount from the fee field.

    The Drupal paragraph renders as:
      "Application Fee {amount} {Currency Name} ({CODE})"

    Returns:
      0.0 if fee is zero (free to apply)
      float amount if USD and > 0
      None if fee exists but currency is non-USD (can't convert)
    """
    fee_field = soup.select_one(".field--name-field-application-fee")
    if not fee_field:
        return None

    text = fee_field.get_text(separator=" ", strip=True)
    m = re.search(r"Application Fee\s+([\d.,]+)", text)
    if not m:
        return None

    try:
        amount = float(m.group(1).replace(",", ""))
    except ValueError:
        return None

    if amount == 0.0:
        return 0.0  # Free regardless of currency

    # Return the amount only if it's USD; otherwise signal "fee exists, unknown USD value"
    if "US Dollar" in text or "(USD)" in text:
        return amount

    return None  # Non-USD fee present; callers should treat as "fee unknown"


def _parse_application_url(soup: BeautifulSoup, source_url: str) -> str:
    """
    Extract the best available application URL.

    Priority:
      1. Explicit application-url field link (direct application form)
      2. Source URL (detail page — always a valid canonical reference)
    """
    app_field = soup.select_one(".field--name-field-application-url")
    if app_field:
        a = app_field.find("a", href=True)
        if a and a["href"].startswith("http"):
            return a["href"]
        # Some entries store the URL as plain text rather than an <a> tag
        text = app_field.get_text(strip=True)
        url_m = re.search(r"https?://\S+", text)
        if url_m:
            # Strip trailing punctuation that may be part of surrounding text
            return url_m.group(0).rstrip(".,)")

    return source_url


def _build_eligibility(soup: BeautifulSoup) -> Optional[str]:
    """
    Compose an eligibility string from structured fields:
      - Country of residence requirement
      - Career stage
      - Additional eligibility text

    Returns None if no eligibility information is available.
    """
    parts: list[str] = []

    country_text = _get_field_text(soup, "field--name-field-country-of-residence")
    if country_text:
        parts.append(country_text)

    stage_text = _get_field_text(soup, "field--name-field-stage-of-career")
    if stage_text:
        parts.append(stage_text)

    # Additional eligibility field has its own label — decompose it first
    extra_field = soup.select_one(".field--name-field-additional-eligibility")
    if extra_field:
        label = extra_field.select_one(".field__label")
        if label:
            label.decompose()
        extra_text = extra_field.get_text(separator=" ", strip=True).strip()
        if extra_text:
            parts.append(extra_text)

    return " | ".join(parts) if parts else None


def _parse_detail(html: str, source_url: str) -> dict:
    """
    Parse an ACA open call detail page.

    Returns a dict with keys:
      description, deadline, application_url, disciplines, fee,
      eligibility, org_residency_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # --- Description ---
    desc_el = soup.select_one(".field--name-field-oc-residency-description")
    description: Optional[str] = None
    if desc_el:
        raw = desc_el.get_text(separator="\n", strip=True)
        if len(raw) > 3000:
            raw = raw[:2997] + "..."
        description = raw or None

    # --- Deadline (detail is authoritative over the index value) ---
    deadline_time = soup.select_one(".field--name-field-deadline time")
    deadline: Optional[str] = None
    if deadline_time:
        deadline = _parse_deadline_iso(deadline_time.get("datetime", ""))

    # --- Application URL ---
    application_url = _parse_application_url(soup, source_url)

    # --- Disciplines ---
    disciplines = _parse_disciplines(soup)

    # --- Fee ---
    fee = _parse_fee(soup)

    # --- Eligibility ---
    eligibility = _build_eligibility(soup)

    # --- Associated residency program (org directory link) ---
    assoc_field = soup.select_one(".field--name-field-associated-residency")
    org_residency_url: Optional[str] = None
    if assoc_field:
        a = assoc_field.find("a", href=True)
        if a:
            org_residency_url = _resolve_url(a["href"])

    return {
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "disciplines": disciplines,
        "fee": fee,
        "eligibility": eligibility,
        "org_residency_url": org_residency_url,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Artist Communities Alliance open calls directory.

    Strategy:
      1. Parse the single-page index table to get all active listings
         (title, org name, deadline, location, detail URL).
      2. Skip any listing whose deadline has already passed (ACA keeps the
         list current but we add an explicit guard at both the index and
         detail stages).
      3. Fetch each call's detail page for full description, authoritative
         deadline, application URL, disciplines, fee, and eligibility.
      4. Insert or update via insert_open_call().

    scope:
      "national"      — programs physically located in the United States
      "international" — programs outside the US (ACA has global members)

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # --- Phase 1: index page ---
    index_html = _fetch(INDEX_URL, session)
    if not index_html:
        logger.error("ACA: failed to fetch index page — aborting")
        return 0, 0, 0

    listings = _parse_index(index_html)
    if not listings:
        logger.warning("ACA: no listings found on index page")
        return 0, 0, 0

    logger.info("ACA: found %d listings on index page", len(listings))

    # --- Phase 2: detail pages ---
    skipped_past = 0

    for i, listing in enumerate(listings):
        href = listing["href"]
        detail_url = _resolve_url(href)
        title = listing["title"]
        org_name = listing["org_name"]
        location = listing["location"]
        index_deadline = listing["deadline"]

        # Fast-path deadline check from index data before paying for a detail fetch
        if _is_past_deadline(index_deadline):
            logger.debug(
                "ACA: skipping %r — index deadline %s already passed",
                title[:60],
                index_deadline,
            )
            skipped_past += 1
            continue

        # Polite delay — skip before the very first request
        if i > 0:
            time.sleep(_FETCH_DELAY)

        detail_html = _fetch(detail_url, session)
        if not detail_html:
            logger.warning(
                "ACA: could not fetch detail page for %r — skipping", title[:60]
            )
            continue

        detail = _parse_detail(detail_html, detail_url)

        # Authoritative deadline from detail page; fall back to index value
        deadline = detail["deadline"] or index_deadline

        # Post-fetch deadline guard (detail page deadline is more precise)
        if _is_past_deadline(deadline):
            logger.debug(
                "ACA: skipping %r — detail deadline %s already passed",
                title[:60],
                deadline,
            )
            skipped_past += 1
            continue

        found += 1

        # Slug-friendly org identifier for the dedup key
        # ACA org names can be long; normalize and truncate
        org_slug = re.sub(r"[^a-z0-9]+", "-", (org_name or "aca").lower()).strip("-")[
            :40
        ]

        # Scope: US-located = "national"; everything else = "international"
        scope = "national"
        if location and "United States" not in location:
            scope = "international"

        metadata: dict = {
            "source": "artist-communities-alliance",
            "organization": org_name,
            "location": location,
            "disciplines": detail["disciplines"],
            "org_residency_url": detail["org_residency_url"],
            "scope": scope,
        }

        call_data: dict = {
            "title": title,
            "description": detail["description"],
            "deadline": deadline,
            "application_url": detail["application_url"],
            "source_url": detail_url,
            "call_type": "residency",
            "eligibility": detail["eligibility"],
            "fee": detail["fee"],
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": metadata,
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ACA: inserted/updated %r (deadline=%s, org=%s, scope=%s)",
                title[:60],
                deadline,
                org_name[:40],
                scope,
            )

    if skipped_past:
        logger.info("ACA: skipped %d past-deadline listings", skipped_past)

    logger.info(
        "ACA: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
