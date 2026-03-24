"""
Crawler for ShowSubmit open calls (showsubmit.com/open-calls).

ShowSubmit is a juried art show submission platform used by galleries,
art societies, and exhibition organizers. ~70 active calls at any time.

Crawl strategy — single page, Schema.org JSON-LD extraction:

  The page at https://www.showsubmit.com/open-calls embeds a single
  <script type="application/ld+json"> block containing an ItemList
  of all currently open calls as Event objects.

  Each Event has:
    name        — title (includes "— Call for Entry" suffix, stripped)
    url         — canonical ShowSubmit detail URL (also used as application URL)
    endDate     — submission deadline (YYYY-MM-DD)
    organizer   — { name: "Organization Name" }
    description — brief description with deadline restated
    image       — featured image URL (not stored)

  All calls are juried exhibitions/art shows → call_type = "submission".
  Eligibility defaults to "National" (US-focused art societies).

Confidence tier: "aggregated" — ShowSubmit is a platform, not the issuing org.
"""

import json
import logging
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

BASE_URL = "https://www.showsubmit.com/open-calls"
REQUEST_TIMEOUT = 30

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Suffix to strip from titles for cleaner display
_TITLE_SUFFIX = "— Call for Entry"


def _clean_title(raw_title: str) -> str:
    """Strip '— Call for Entry' suffix from ShowSubmit titles."""
    title = raw_title.strip()
    if title.endswith(_TITLE_SUFFIX):
        title = title[: -len(_TITLE_SUFFIX)].strip()
    return title


def _is_past_deadline(deadline: Optional[str]) -> bool:
    if not deadline:
        return False
    try:
        return date.fromisoformat(deadline) < date.today()
    except ValueError:
        return False


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ShowSubmit open calls via JSON-LD extraction.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    try:
        resp = requests.get(
            BASE_URL,
            headers={"User-Agent": _USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("ShowSubmit: failed to fetch page: %s", exc)
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    json_ld_tag = soup.find("script", type="application/ld+json")
    if not json_ld_tag or not json_ld_tag.string:
        logger.warning("ShowSubmit: no JSON-LD found on page")
        return 0, 0, 0

    try:
        data = json.loads(json_ld_tag.string)
    except json.JSONDecodeError as exc:
        logger.warning("ShowSubmit: JSON-LD parse error: %s", exc)
        return 0, 0, 0

    items = data.get("itemListElement", [])
    logger.info("ShowSubmit: found %d items in JSON-LD", len(items))

    for item_wrapper in items:
        item = item_wrapper.get("item", item_wrapper)

        raw_title = item.get("name", "").strip()
        if not raw_title:
            continue

        title = _clean_title(raw_title)
        detail_url = item.get("url", "").strip()
        if not detail_url:
            continue

        deadline = item.get("endDate")  # YYYY-MM-DD
        if _is_past_deadline(deadline):
            continue

        found += 1

        organizer = item.get("organizer", {})
        org_name = organizer.get("name", "").strip() if isinstance(organizer, dict) else ""
        description = item.get("description", "").strip() or None

        call_data = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": detail_url,
            "source_url": detail_url,
            "call_type": "submission",
            "eligibility": "National",
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name or "showsubmit",
            "metadata": {
                "source": "showsubmit",
                "organizer": org_name,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    logger.info("ShowSubmit: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
