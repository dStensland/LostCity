"""
Crawler for ZAPP (zapplication.org) open calls.

ZAPP is the dominant application management and jurying platform for art fairs
and craft shows in the United States — roughly analogous to CaFE/EntryThingy
but for outdoor/indoor art festivals rather than gallery-format exhibitions.
Hundreds of events use ZAPP as their sole application channel, making it a
high-value aggregator for the Arts portal's open calls feed.

Confidence tier: "aggregated" — ZAPP is the submission platform itself, not a
downstream re-poster, but the variety of event organizers means the platform
acts as an aggregator across many orgs.

All event types map to "submission" — artists apply to exhibit/sell at the
fair, not to publish work or enter a competition. Booth selection is the
outcome.

Data source — REST API (no Playwright required):
  Base URL: https://api.zapplication.org
  Key endpoint: GET /v1.1/events
  Authentication: X-Api-Key header (public key embedded in the Vue.js frontend
    bundle at /zapp-pack/participating-events.*.bundle.js — this is intentional
    per the frontend architecture; no auth is required to browse events).

  Parameters that matter:
    max-results=9999   — returns the full catalog in one call (~971 events)
    order=application_deadline  — sorts ascending by deadline
    invite_only=0      — skip invite-only events (private fairs)
    favorites=0        — not logged in, skip favorites flag

  Response shape:
    { "data": [ {...event}, ... ], "num-events": 971 }

  Key list fields:
    event_id, event_name, licensee_name (org), application_deadline,
    early_bird_deadline, event_start, event_end, event_location,
    event_city, event_state, event_region, is_juried, jury_fee_regular_price,
    jury_fee_early_price, booth_fee_price, booth_fee_desc, invite_only

  Detail endpoint: GET /v1.1/events/{event_id}
    Adds: event_short_description, event_description (HTML), event_website_url,
    event_logo, min_booth_fee, max_booth_fee, event_email, event_contact_name

  We do NOT hit the detail endpoint by default — all fields needed to build a
  useful open call record are present on the list endpoint. The detail
  endpoint is rate-limited per-request and would require ~500 fetches for
  future events. The short description field in the list response is absent,
  so we use event_name + location context as the description baseline.

  Source/application URL:
    https://www.zapplication.org/event-info.php?ID={event_id}
    This is the canonical public-facing artist page for each event and also
    hosts the "Apply Now" button (requires a ZAPP account to proceed).

Rate limiting:
  The bulk fetch is a single API call — no per-item delay needed. We add
  a brief 0.5s delay between the list call and any detail fetches if we
  ever enable them in the future.

Scope: US-focused (ZAPP is a US platform). Events outside the US are very
  rare and not filtered out — they're valid open calls for US-based artists
  applying to international fairs.
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

BASE_URL = "https://www.zapplication.org"
API_BASE = "https://api.zapplication.org"

# Public API key embedded in the ZAPP Vue.js frontend bundle.
# This key is intentionally public — it ships in unobfuscated JS served to
# every anonymous visitor of zapplication.org. It scopes access to
# unauthenticated read operations (browsing events) only.
_API_KEY = "3OZxiH7Ejdz98p9hU2xhbGqb4IZCtyOH7DvnncQL6qeNrQWVA7l5IT25MtaUXTx9"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Safety cap — raise if ZAPP grows well beyond current ~1,000 events
_MAX_EVENTS = 2000

_REQUEST_TIMEOUT = 60

# Seconds to wait between optional detail-page fetches (not used by default)
_DETAIL_DELAY = 1.0


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": _API_KEY,
            "X-Field-Map": "participating-events",
            "Referer": f"{BASE_URL}/participating-events.php",
            "Origin": BASE_URL,
        }
    )
    return session


def _fetch_events(session: requests.Session) -> Optional[list[dict]]:
    """
    Fetch the full ZAPP event catalog in a single API call.

    Returns the list of raw event dicts, or None on failure.
    """
    try:
        resp = session.get(
            f"{API_BASE}/v1.1/events",
            params={
                "max-results": _MAX_EVENTS,
                "order": "application_deadline",
                "invite_only": 0,
                "favorites": 0,
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        events = data.get("data", [])
        total = data.get("num-events", 0)
        logger.info("ZAPP: API returned %d events (num-events=%d)", len(events), total)
        return events
    except requests.RequestException as exc:
        logger.error("ZAPP: failed to fetch event list: %s", exc)
        return None
    except (KeyError, ValueError) as exc:
        logger.error("ZAPP: unexpected API response shape: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Deadline handling
# ---------------------------------------------------------------------------


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if deadline_str (YYYY-MM-DD) has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Title filters
# ---------------------------------------------------------------------------

# Events ZAPP keeps in the system after they become invalid — we don't want
# to surface these in the open calls feed.
_SKIP_TITLE_RE = re.compile(
    r"(?:"
    r"cancelled?"  # " Cancelled. Tavares Art..." etc.
    r"|do\s+not\s+apply"  # test events: "BRI Test Jurybuddy 2.0 - DO NOT APPLY"
    r"|test\s+event"
    r")",
    re.I,
)


def _should_skip_title(title: str) -> bool:
    """Return True if the event title indicates a cancelled or test event."""
    return bool(_SKIP_TITLE_RE.search(title))


# ---------------------------------------------------------------------------
# Description cleaning
# ---------------------------------------------------------------------------

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _clean_html(html_text: Optional[str]) -> Optional[str]:
    """
    Strip HTML tags from a description field and normalise whitespace.

    Returns cleaned plain text, or None if input is empty/None.
    """
    if not html_text:
        return None
    # Use BeautifulSoup for robust tag stripping (handles nested / malformed HTML)
    text = BeautifulSoup(html_text, "html.parser").get_text(separator=" ")
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text[:3000] if text else None


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------


def _parse_fee(price_str: Optional[str]) -> Optional[float]:
    """
    Parse a fee string like "25.00" into a float.

    Returns None if the string is absent, zero, or non-numeric.
    """
    if not price_str:
        return None
    try:
        amount = float(price_str)
        return amount if amount > 0 else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Location helpers
# ---------------------------------------------------------------------------


def _build_location(event: dict) -> str:
    """
    Build a readable location string from event fields.

    Format: "{event_location}, {event_city}, {event_state}"
    Falls back gracefully when fields are absent.
    """
    parts = []
    loc = (event.get("event_location") or "").strip()
    city = (event.get("event_city") or "").strip()
    state = (event.get("event_state") or "").strip()

    if loc:
        parts.append(loc)
    if city:
        parts.append(city)
    if state:
        parts.append(state)

    return ", ".join(parts) if parts else ""


# ---------------------------------------------------------------------------
# Eligibility + description helpers
# ---------------------------------------------------------------------------


def _build_eligibility(event: dict) -> str:
    """
    Build an eligibility string from ZAPP event metadata.

    ZAPP events are artist application fairs — eligibility is typically
    open to all artists unless marked invite-only (we skip those).
    Emerging artist acceptance is noted when available.
    """
    parts = ["Open to all artists and craftspeople"]
    if event.get("emerging_accept") == 1:
        parts.append("emerging artists welcome")
    return "; ".join(parts)


def _build_description(event: dict) -> Optional[str]:
    """
    Build a description from available event fields.

    Priority:
      1. event_short_description (HTML — only present on detail endpoint)
      2. Synthesise from location, dates, and fees (list endpoint)

    We use the synthesis approach since we don't fetch detail pages by default.
    """
    # event_short_description is absent in list endpoint responses; guard anyway
    if event.get("event_short_description"):
        cleaned = _clean_html(event["event_short_description"])
        if cleaned and len(cleaned) > 30:
            return cleaned

    # Synthesise a minimal description from structured fields
    city = event.get("event_city", "")
    state = event.get("event_state", "")
    event_start = event.get("event_start", "")
    event_end = event.get("event_end", "")
    org = event.get("licensee_name", "")
    indoor_outdoor = event.get("event_indoor_outdoor", "")

    parts = []
    if org:
        parts.append(f"Organized by {org}.")

    date_str = ""
    if event_start and event_end and event_start != event_end:
        date_str = f"{event_start} through {event_end}"
    elif event_start:
        date_str = event_start
    if date_str:
        loc_parts = [p for p in [city, state] if p]
        loc_str = ", ".join(loc_parts)
        if loc_str:
            parts.append(f"Event takes place {date_str} in {loc_str}.")
        else:
            parts.append(f"Event takes place {date_str}.")

    if indoor_outdoor:
        parts.append(f"Setting: {indoor_outdoor.replace(',', '/')}.")

    return " ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the ZAPP art fair application platform.

    Strategy:
      1. Fetch all events via GET /v1.1/events?max-results=9999 — single call,
         ~971 events currently.
      2. Skip cancelled or test events (title contains "cancelled" or "do not apply").
      3. Skip invite-only events (private fairs, not open calls).
      4. Skip events with past application deadlines.
      5. Build an open_call record from the structured API response.
         Application fee → call_data["fee"]. Booth fee stored in metadata.
      6. Insert or update via insert_open_call().

    All events map to call_type="submission" — ZAPP is exclusively an art fair
    application platform; artists submit to be juried/selected for booth space.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # -----------------------------------------------------------------------
    # Fetch full event catalog
    # -----------------------------------------------------------------------
    events = _fetch_events(session)
    if events is None:
        return 0, 0, 0

    if not events:
        logger.warning("ZAPP: no events returned — check if site structure changed")
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Process each event
    # -----------------------------------------------------------------------
    skipped_invite_only = 0
    skipped_past = 0
    skipped_cancelled = 0

    for event in events:
        event_id = event.get("event_id")
        title = (event.get("event_name") or "").strip()

        if not title or not event_id:
            logger.debug("ZAPP: skipping record with missing title or ID")
            continue

        # Skip cancelled / test events
        if _should_skip_title(title):
            skipped_cancelled += 1
            logger.debug(
                "ZAPP: skipping cancelled/test event %r (id=%s)", title[:60], event_id
            )
            continue

        # Skip invite-only events — not publicly open calls
        if event.get("invite_only") == 1:
            skipped_invite_only += 1
            logger.debug(
                "ZAPP: skipping invite-only event %r (id=%s)", title[:60], event_id
            )
            continue

        # Deadline check — prefer application_deadline, check early_bird as signal
        deadline = event.get("application_deadline") or None
        if _is_past_deadline(deadline):
            skipped_past += 1
            logger.debug(
                "ZAPP: skipping past-deadline event %r (deadline=%s)",
                title[:60],
                deadline,
            )
            continue

        found += 1

        # ------------------------------------------------------------------
        # Build the open call record
        # ------------------------------------------------------------------
        source_url = f"{BASE_URL}/event-info.php?ID={event_id}"
        application_url = source_url  # ZAPP hosts the application on this page

        org_name = (event.get("licensee_name") or "").strip() or "zapp"
        org_slug = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")[:40]

        description = _build_description(event)
        eligibility = _build_eligibility(event)
        location = _build_location(event)

        # Application (jury) fee
        fee = _parse_fee(event.get("jury_fee_regular_price"))
        early_fee = _parse_fee(event.get("jury_fee_early_price"))
        late_fee = _parse_fee(event.get("jury_fee_late_price"))

        # Booth fee — stored in metadata, not the fee column (it's a different
        # cost category: what the artist pays *after* being accepted)
        booth_fee = _parse_fee(event.get("booth_fee_price"))
        booth_fee_desc = (event.get("booth_fee_desc") or "").strip() or None

        # Event dates (when the fair itself takes place, not the application window)
        event_start = event.get("event_start") or None
        event_end = event.get("event_end") or None

        metadata: dict = {
            "source": "zapp",
            "organization": org_name,
            "event_id": event_id,
            "location": location,
            "event_start": event_start,
            "event_end": event_end,
            "event_city": event.get("event_city") or None,
            "event_state": event.get("event_state") or None,
            "event_region": event.get("event_region") or None,
            "is_juried": bool(event.get("is_juried") == 1),
            "early_bird_deadline": event.get("early_bird_deadline") or None,
            "notify_date": event.get("notify_date") or None,
            "fee_jury_regular": fee,
            "fee_jury_early": early_fee,
            "fee_jury_late": late_fee,
            "fee_booth": booth_fee,
            "fee_booth_desc": booth_fee_desc,
            "indoor_outdoor": event.get("event_indoor_outdoor") or None,
            "emerging_accept": bool(event.get("emerging_accept") == 1),
            "min_images": event.get("min_images"),
            "max_images": event.get("max_images"),
        }

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": "submission",
            "eligibility": eligibility,
            "fee": fee,  # Application/jury fee — numeric USD
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug,
            "metadata": metadata,
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ZAPP: inserted/updated %r (id=%s, deadline=%s, fee=$%s, booth=$%s)",
                title[:60],
                event_id,
                deadline,
                fee,
                booth_fee,
            )

    if skipped_cancelled:
        logger.info("ZAPP: skipped %d cancelled/test events", skipped_cancelled)
    if skipped_invite_only:
        logger.info("ZAPP: skipped %d invite-only events", skipped_invite_only)
    if skipped_past:
        logger.info("ZAPP: skipped %d past-deadline events", skipped_past)

    logger.info(
        "ZAPP: crawl complete — %d found (eligible), %d new/updated",
        found,
        new,
    )
    return found, new, updated
