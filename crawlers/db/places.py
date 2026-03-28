"""
Place CRUD, proximity dedup, and caching.

Renamed from venues.py. Exported function get_or_create_place replaces
get_or_create_venue. Backward-compatible alias kept at bottom of file.
"""

import re
import logging
from typing import Optional

from datetime import datetime, timezone

from neighborhood_lookup import infer_neighborhood_from_coords
from crawl_context import get_crawl_context
from db.place_validation import (
    validate_place_name,
    validate_place_geo_scope,
    validate_place_minimum_fields,
)
from db.client import (
    get_client,
    retry_on_network_error,
    writes_enabled,
    _next_temp_id,
    _log_write_skip,
    _normalize_image_url,
    _VENUE_CACHE,
    venues_support_features_table,
    venues_support_location_designator,
)
from tags import VALID_VENUE_TYPES, VALID_VIBES
from closed_venues import (
    CLOSED_VENUE_NOTE,
    CLOSED_VENUE_SLUGS,
    CLOSED_VENUE_NAMES_NORMALIZED,
)
from utils import validate_url

logger = logging.getLogger(__name__)

# ===== VIRTUAL VENUE =====

VIRTUAL_VENUE_SLUG = "online-virtual"
VIRTUAL_VENUE_DATA = {
    "name": "Online / Virtual Event",
    "slug": VIRTUAL_VENUE_SLUG,
    "city": "Atlanta",
    "state": "GA",
    "venue_type": "virtual",
    "location_designator": "virtual",
}

_EVENT_ONLY_VENUE_FIELDS = {
    # Underscore-prefixed enrichment keys — popped at top of get_or_create_venue
    # before any DB write; listed here as a belt-and-suspenders safety net.
    "_destination_details",
    "_venue_features",
    "_venue_specials",
    "age_max",
    "age_min",
    "age_policy",
    "artists",
    "canonical_event_id",
    "category",
    "content_hash",
    "content_kind",
    "description_raw",
    "doors_time",
    "end_date",
    "end_time",
    "event_id",
    "event_images",
    "event_links",
    "extraction_confidence",
    "extraction_version",
    "festival_id",
    "field_confidence",
    "field_provenance",
    "film_external_genres",
    "film_identity_source",
    "film_imdb_id",
    "film_release_year",
    "film_title",
    "images",
    "is_all_day",
    "is_free",
    "is_recurring",
    "links",
    "organizer",
    "organizer_name",
    "participants",
    "price_max",
    "price_min",
    "price_note",
    "raw_text",
    "recurrence_rule",
    "reentry_policy",
    "set_times_mentioned",
    "source_id",
    "source_url",
    "start_date",
    "start_time",
    "subcategory",
    "tags",
    "ticket_status",
    "ticket_url",
    "title",
}


# ===== HELPERS =====

def _normalize_venue_name(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


_LEADING_ARTICLES = {"the", "a", "an"}


def _strip_article(name: str) -> str:
    """Strip a leading English article from a lowercased, stripped venue name."""
    parts = name.split(None, 1)
    if len(parts) == 2 and parts[0] in _LEADING_ARTICLES:
        return parts[1]
    return name


def _proximity_name_match(name_a: str, name_b: str) -> bool:
    """
    Return True if two nearby venue names are close enough to be the same place.

    Rules (applied in order):

    1. Short-name guard: if either normalised name is fewer than 3 chars, skip.

    2. Article-stripped exact match: strip leading articles ("The", "A", "An")
       from both names; if they are then identical, merge. This handles
       "The Masquerade" == "Masquerade" without any ratio gymnastics.

    3. Substring match: one name must be a substring of the other AND:
       - The shorter name must be at least 60 % of the longer name's character
         length (blocks "Ponce" (5) vs "Ponce City Market" (17) — 29 %).
       - Both names must have at least 2 words (blocks single-word fragments
         like "Terminal" or "Park" matching multi-word names).
       Falls through to Jaccard if guards fail.

    4. Word-token Jaccard: strip punctuation, tokenise both names into words,
       compute len(intersection) / len(union), require >= 0.5.
       Both names must have at least 2 tokens for Jaccard to fire.
       Handles "Terminal West" vs "Terminal West - Dolby Live" (token J = 0.5).
    """
    a = name_a.lower().strip()
    b = name_b.lower().strip()

    # Guard: minimum length
    if min(len(a), len(b)) < 3:
        return False

    # Article-stripped exact match ("The Masquerade" == "Masquerade")
    if _strip_article(a) == _strip_article(b):
        return True

    shorter_len = min(len(a), len(b))
    longer_len = max(len(a), len(b))
    words_a = a.split()
    words_b = b.split()

    # Substring match — both-names two-word guard + 60 % ratio guard.
    # Falls through to Jaccard if guards fail (don't hard-reject).
    if a in b or b in a:
        if len(words_a) >= 2 and len(words_b) >= 2 and shorter_len / longer_len >= 0.60:
            return True

    # Jaccard on alpha-only word tokens (requires >= 2 tokens in each name).
    # Punctuation is stripped so "Terminal West - Dolby Live" tokenises to
    # {"terminal", "west", "dolby", "live"} — no stray "-" token.
    tokens_a = set(re.sub(r"[^a-z0-9 ]", " ", a).split())
    tokens_b = set(re.sub(r"[^a-z0-9 ]", " ", b).split())
    if len(tokens_a) >= 2 and len(tokens_b) >= 2:
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        if union and len(intersection) / len(union) >= 0.5:
            return True

    return False


def _is_permanently_closed_venue(venue_data: dict) -> bool:
    slug = (venue_data.get("slug") or "").strip().lower()
    name = _normalize_venue_name(venue_data.get("name"))
    return slug in CLOSED_VENUE_SLUGS or name in CLOSED_VENUE_NAMES_NORMALIZED


def _with_closed_note(description: Optional[str]) -> str:
    text = (description or "").strip()
    if not text:
        return CLOSED_VENUE_NOTE
    lower = text.lower()
    if "do not reactivate via crawler" in lower:
        return text
    if "permanently closed" in lower:
        needs_period = not text.endswith((".", "!", "?"))
        suffix = "Do not reactivate via crawler."
        return f"{text}. {suffix}" if needs_period else f"{text} {suffix}"
    needs_period = not text.endswith((".", "!", "?"))
    return (
        f"{text}. {CLOSED_VENUE_NOTE}"
        if needs_period
        else f"{text} {CLOSED_VENUE_NOTE}"
    )


def _lock_closed_venue_record(client, venue_id: int, existing: dict) -> None:
    """Ensure a permanently-closed venue remains inactive."""
    update_data = {}
    if existing.get("active") is not False:
        update_data["active"] = False
    next_description = _with_closed_note(existing.get("description"))
    if next_description != (existing.get("description") or "").strip():
        update_data["description"] = next_description

    if not update_data:
        return

    if not writes_enabled():
        _log_write_skip(f"update venues id={venue_id} set closed lock")
        return

    client.table("venues").update(update_data).eq("id", venue_id).execute()


def infer_location_designator(venue_data: dict) -> str:
    """Infer location designator for venue-level rendering/quality logic."""
    slug = (venue_data.get("slug") or "").strip().lower()
    name = _normalize_venue_name(venue_data.get("name"))
    venue_type = (venue_data.get("venue_type") or "").strip().lower()

    if (
        venue_type == "virtual"
        or slug == VIRTUAL_VENUE_SLUG
        or "online / virtual" in name
        or "virtual event" in name
    ):
        return "virtual"

    if (
        slug.startswith("aa-")
        or slug.startswith("na-")
        or "anonymous" in name
        or "recovery" in name
        or "alcoholics anonymous" in name
        or "narcotics anonymous" in name
    ):
        return "recovery_meeting"

    if (
        slug == "community-location"
        or slug.startswith("this-event-s-address-is-private")
        or name.startswith("community location")
        or "address is private" in name
        or "private location" in name
        or "sign up for more details" in name
    ):
        return "private_after_signup"

    return "standard"


def _fetch_venue_web_metadata(url: str) -> dict:
    """
    Fetch description and og:image from a venue website in a single HTTP request.

    Returns a dict with keys:
        - "description": str or None
        - "og_image": str or None
    """
    result: dict = {"description": None, "og_image": None}
    try:
        validate_url(url)
    except ValueError as e:
        logger.debug(f"Skipping venue web metadata fetch (SSRF check): {e}")
        return result
    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get(
            url,
            timeout=5,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LostCity/1.0)"},
        )
        if resp.status_code != 200:
            return result
        soup = BeautifulSoup(resp.text, "html.parser")

        # Description — first good meta tag wins
        for attr_key, attr_val in [
            ("name", "description"),
            ("property", "og:description"),
            ("name", "twitter:description"),
        ]:
            meta = soup.find("meta", attrs={attr_key: attr_val})
            if meta and meta.get("content", "").strip():
                desc = meta["content"].strip()
                if len(desc) >= 30:
                    lower = desc.lower()
                    if any(
                        lower.startswith(p)
                        for p in [
                            "welcome to", "just another", "coming soon", "page not found",
                        ]
                    ):
                        continue
                    result["description"] = desc[:500]
                    break

        # og:image
        og_img_tag = soup.find("meta", attrs={"property": "og:image"})
        if og_img_tag is None:
            og_img_tag = soup.find("meta", attrs={"name": "twitter:image"})
        if og_img_tag:
            og_image = (og_img_tag.get("content") or "").strip()
            if og_image:
                result["og_image"] = og_image
                logger.debug("Auto-fetched og:image for %s", url)

    except Exception:
        pass
    return result


def _fetch_venue_description(url: str) -> Optional[str]:
    """
    Backward-compatible wrapper — returns description string or None.

    Prefer _fetch_venue_web_metadata() for new call sites.
    """
    return _fetch_venue_web_metadata(url).get("description")


def _sanitize_venue_payload(venue_data: dict) -> dict:
    """Strip event-only fields before any venues table insert."""
    if not venue_data:
        return {}

    sanitized = dict(venue_data)
    stripped = sorted(key for key in _EVENT_ONLY_VENUE_FIELDS if key in sanitized)
    for key in stripped:
        sanitized.pop(key, None)

    if stripped:
        logger.debug(
            "Stripped event-only venue payload fields for '%s': %s",
            venue_data.get("slug") or venue_data.get("name") or "unknown",
            ", ".join(stripped),
        )

    return sanitized


# ===== VENUE BACKFILL =====

# Fields eligible for NULL→non-NULL backfill on existing venue records.
# Identity/administrative fields (name, slug, city, state, active) are excluded.
_VENUE_BACKFILL_FIELDS = {
    "address", "zip", "neighborhood", "description", "image_url",
    "hero_image_url", "website", "venue_type", "vibes", "spot_type",
    "hours", "phone",
}


def _maybe_update_existing_venue(venue_id: int, venue_data: dict) -> None:
    """Backfill NULL fields on an existing venue with incoming non-NULL data."""
    if not writes_enabled():
        return

    client = get_client()
    existing = client.table("venues").select("*").eq("id", venue_id).execute()
    if not existing.data:
        return
    current = existing.data[0]

    updates: dict = {}

    for field in _VENUE_BACKFILL_FIELDS - {"description", "lat", "lng", "image_url", "hero_image_url", "vibes"}:
        incoming_val = venue_data.get(field)
        current_val = current.get(field)
        if incoming_val and not current_val:
            updates[field] = incoming_val

    # Special case: description — prefer longer even if existing is non-NULL
    incoming_desc = venue_data.get("description") or ""
    current_desc = current.get("description") or ""
    if incoming_desc and (not current_desc or len(incoming_desc) > len(current_desc) + 50):
        updates["description"] = incoming_desc

    # Special case: lat/lng — both must be NULL, both must be provided
    if not current.get("lat") and not current.get("lng"):
        if venue_data.get("lat") and venue_data.get("lng"):
            updates["lat"] = venue_data["lat"]
            updates["lng"] = venue_data["lng"]

    # image_url / hero_image_url — backfill NULL only, normalize before storing
    for img_field in ("image_url", "hero_image_url"):
        incoming_val = venue_data.get(img_field)
        current_val = current.get(img_field)
        if incoming_val and not current_val:
            updates[img_field] = _normalize_image_url(incoming_val)

    # vibes — backfill NULL/empty only, validate against VALID_VIBES
    incoming_vibes = venue_data.get("vibes")
    current_vibes = current.get("vibes")
    if incoming_vibes and not current_vibes:
        valid = [v for v in incoming_vibes if v in VALID_VIBES]
        if valid:
            updates["vibes"] = valid

    # venue_type: crawler VENUE_DATA is a higher-trust signal than early LLM
    # classification — allow override even when current is non-NULL.
    incoming_type = venue_data.get("venue_type")
    current_type = current.get("venue_type")
    if (
        incoming_type
        and current_type
        and incoming_type != current_type
        and incoming_type in VALID_VENUE_TYPES
    ):
        updates["venue_type"] = incoming_type
        logger.info(
            "Correcting venue_type for '%s': %s -> %s (crawler override)",
            current.get("name") or "unknown",
            current_type,
            incoming_type,
        )

    if not updates:
        return

    client.table("venues").update(updates).eq("id", venue_id).execute()
    logger.info(
        "Backfilled venue %s (id=%d): %s",
        current.get("name") or venue_data.get("name") or "unknown",
        venue_id,
        ", ".join(sorted(updates.keys())),
    )


# ===== ENRICHMENT HELPER =====

def _persist_venue_enrichment(
    venue_id: int,
    details: Optional[dict],
    features: Optional[list],
    specials: Optional[list],
) -> None:
    """
    Persist underscore-prefixed enrichment payloads embedded in VENUE_DATA.

    Called after a real venue_id is resolved (create or existing).
    All failures are logged and swallowed — enrichment is never critical path.
    """
    if details:
        try:
            from db.place_vertical import upsert_venue_destination_details
            upsert_venue_destination_details(venue_id, details)
            logger.debug("_persist_venue_enrichment: destination_details for venue_id=%s", venue_id)
        except Exception:
            logger.exception("_persist_venue_enrichment: destination_details failed for venue_id=%s", venue_id)

    if features:
        try:
            for feature in features:
                upsert_venue_feature(venue_id, feature)
            logger.debug(
                "_persist_venue_enrichment: %d feature(s) for venue_id=%s",
                len(features),
                venue_id,
            )
        except Exception:
            logger.exception("_persist_venue_enrichment: features failed for venue_id=%s", venue_id)

    if specials:
        try:
            from db.place_specials import upsert_venue_special
            for special in specials:
                upsert_venue_special(venue_id, special)
            logger.debug(
                "_persist_venue_enrichment: %d special(s) for venue_id=%s",
                len(specials),
                venue_id,
            )
        except Exception:
            logger.exception("_persist_venue_enrichment: specials failed for venue_id=%s", venue_id)


# ===== VENUE CRUD =====

def get_or_create_virtual_venue() -> int:
    """Get or create canonical virtual venue. Returns venue ID."""
    client = get_client()
    result = (
        client.table("venues").select("id").eq("slug", VIRTUAL_VENUE_SLUG).execute()
    )
    if result.data:
        return result.data[0]["id"]
    if not writes_enabled():
        _log_write_skip(f"insert venues slug={VIRTUAL_VENUE_SLUG}")
        return _next_temp_id()
    payload = _sanitize_venue_payload(VIRTUAL_VENUE_DATA)
    if not venues_support_location_designator():
        payload.pop("location_designator", None)
    result = client.table("venues").insert(payload).execute()
    return result.data[0]["id"]


@retry_on_network_error(max_retries=3, base_delay=0.5)
def get_or_create_place(venue_data: dict) -> Optional[int]:
    """Get existing place (venue) or create new one. Returns venue ID, or None if validation rejects."""
    client = get_client()

    # Pop underscore-prefixed enrichment payloads before any DB write.
    # These are never stored in the venues table; they route to separate tables
    # via _persist_venue_enrichment() after a real venue_id is resolved.
    _enrichment_details = venue_data.pop("_destination_details", None)
    _enrichment_features = venue_data.pop("_venue_features", None)
    _enrichment_specials = venue_data.pop("_venue_specials", None)

    def _venue_name_aliases(value: Optional[str]) -> list[str]:
        if not value:
            return []

        name_value = value.strip()
        aliases: list[str] = []
        lowered = name_value.lower()

        if lowered.endswith(" fairground"):
            aliases.append(name_value + "s")
        elif lowered.endswith(" fairgrounds"):
            aliases.append(name_value[:-1])

        return [alias for alias in aliases if alias != name_value]

    if _is_permanently_closed_venue(venue_data):
        slug = venue_data.get("slug")
        name = venue_data.get("name")
        logger.info(
            "Closed venue guard: keeping '%s' inactive",
            slug or name or "unknown",
        )

        existing = None
        if slug:
            res = (
                client.table("venues")
                .select("id, active, description")
                .eq("slug", slug)
                .limit(1)
                .execute()
            )
            if res.data:
                existing = res.data[0]

        if not existing and name:
            res = (
                client.table("venues")
                .select("id, active, description")
                .eq("name", name)
                .limit(1)
                .execute()
            )
            if res.data:
                existing = res.data[0]

        if existing:
            _lock_closed_venue_record(client, existing["id"], existing)
            return existing["id"]

        blocked_venue_data = _sanitize_venue_payload(venue_data)
        blocked_venue_data["active"] = False
        blocked_venue_data["description"] = _with_closed_note(
            blocked_venue_data.get("description")
        )

        if not writes_enabled():
            _log_write_skip(
                f"insert venues name={blocked_venue_data.get('name', 'unknown')} (closed guard)"
            )
            return _next_temp_id()
        result = client.table("venues").insert(blocked_venue_data).execute()
        return result.data[0]["id"]

    def _touch_verified_at(venue_id: int) -> None:
        """Update verified_at timestamp — piggybacks on crawler lookups."""
        if not writes_enabled():
            return
        try:
            client.table("venues").update(
                {"verified_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", venue_id).execute()
        except Exception:
            pass  # Non-critical — don't fail the crawl

    def _maybe_reactivate_existing_venue(existing: dict) -> int:
        venue_id = existing["id"]
        if existing.get("active") is False and venue_data.get("active") is True:
            if not writes_enabled():
                _log_write_skip(f"update venues id={venue_id} reactivate")
            else:
                client.table("venues").update({"active": True}).eq("id", venue_id).execute()
                logger.info(
                    "Reactivated venue %s from explicit crawler signal",
                    venue_data.get("slug") or venue_data.get("name") or venue_id,
                )
        _touch_verified_at(venue_id)
        return venue_id

    # ── Venue name validation (must pass before any lookup) ──
    _v_name = venue_data.get("name")
    name_ok, name_reason = validate_place_name(_v_name)
    if not name_ok:
        logger.warning("Venue name rejected: %r — %s", _v_name, name_reason)
        return None

    # ── Existing venue lookup (before creation-only validation) ──
    slug = venue_data.get("slug")
    if slug:
        result = client.table("venues").select("id, active").eq("slug", slug).execute()
        if result.data and len(result.data) > 0:
            venue_id = _maybe_reactivate_existing_venue(result.data[0])
            _maybe_update_existing_venue(venue_id, venue_data)
            _persist_venue_enrichment(venue_id, _enrichment_details, _enrichment_features, _enrichment_specials)
            return venue_id

    name = venue_data.get("name")
    if name:
        result = client.table("venues").select("id, active").eq("name", name).execute()
        if result.data and len(result.data) > 0:
            venue_id = _maybe_reactivate_existing_venue(result.data[0])
            _maybe_update_existing_venue(venue_id, venue_data)
            _persist_venue_enrichment(venue_id, _enrichment_details, _enrichment_features, _enrichment_specials)
            return venue_id

        for alias in _venue_name_aliases(name):
            result = client.table("venues").select("id, active").eq("name", alias).execute()
            if result.data and len(result.data) > 0:
                logger.info(
                    "Venue alias match: reusing '%s' for '%s'",
                    alias,
                    name,
                )
                venue_id = _maybe_reactivate_existing_venue(result.data[0])
                _maybe_update_existing_venue(venue_id, venue_data)
                _persist_venue_enrichment(venue_id, _enrichment_details, _enrichment_features, _enrichment_specials)
                return venue_id

    # ── Creation-only validation (geo scope, minimum fields) ──
    context = get_crawl_context()
    geo_ok, geo_reason = validate_place_geo_scope(venue_data, context)
    if not geo_ok:
        logger.warning("Venue out of scope: %r — %s", _v_name, geo_reason)
        return None

    min_ok, min_warnings = validate_place_minimum_fields(venue_data)
    if min_warnings:
        for w in min_warnings:
            logger.debug("Venue %r: %s", _v_name, w)
    if not min_ok:
        logger.warning("Venue %r fails minimum field check — skipping", _v_name)
        return None

    lat = venue_data.get("lat")
    lng = venue_data.get("lng")
    if name and lat and lng:
        lat_delta = 0.001
        lng_delta = 0.001
        try:
            nearby = (
                client.table("venues")
                .select("id, name")
                .gte("lat", lat - lat_delta)
                .lte("lat", lat + lat_delta)
                .gte("lng", lng - lng_delta)
                .lte("lng", lng + lng_delta)
                .execute()
            )
            if nearby.data:
                for row in nearby.data:
                    existing_name = row.get("name") or ""
                    if _proximity_name_match(name, existing_name):
                        logger.info(
                            f"Proximity dedup: reusing '{row['name']}' (id={row['id']}) for '{name}'"
                        )
                        _touch_verified_at(row["id"])
                        _maybe_update_existing_venue(row["id"], venue_data)
                        _persist_venue_enrichment(row["id"], _enrichment_details, _enrichment_features, _enrichment_specials)
                        return row["id"]
        except Exception as e:
            logger.debug(f"Proximity dedup check failed: {e}")

    if venue_data.get("website") and (
        not venue_data.get("description") or not venue_data.get("image_url")
    ):
        try:
            web_meta = _fetch_venue_web_metadata(venue_data["website"])
            if web_meta.get("description") and not venue_data.get("description"):
                venue_data["description"] = web_meta["description"]
                logger.debug(
                    "Auto-fetched description for %s", venue_data.get("name", "unknown")
                )
            if web_meta.get("og_image") and not venue_data.get("image_url"):
                venue_data["image_url"] = web_meta["og_image"]
                logger.debug(
                    "Auto-fetched og:image for %s", venue_data.get("name", "unknown")
                )
        except Exception:
            pass

    if venue_data.get("website") and not venue_data.get("parking_note"):
        try:
            from parking_extract import extract_parking_info

            parking = extract_parking_info(venue_data["website"])
            if parking:
                venue_data["parking_note"] = parking["parking_note"]
                venue_data["parking_type"] = parking["parking_type"]
                venue_data["parking_free"] = parking["parking_free"]
                venue_data["parking_source"] = "scraped"
                if parking.get("transit_note"):
                    venue_data["transit_note"] = parking["transit_note"]
                logger.debug(
                    "Auto-extracted parking for %s", venue_data.get("name", "unknown")
                )
        except Exception:
            pass

    if "image_url" in venue_data:
        venue_data["image_url"] = _normalize_image_url(venue_data.get("image_url"))
    if "hero_image_url" in venue_data:
        venue_data["hero_image_url"] = _normalize_image_url(
            venue_data.get("hero_image_url")
        )

    vtype = venue_data.get("venue_type")
    if vtype and vtype not in VALID_VENUE_TYPES:
        logger.warning(
            f"Unknown venue_type '{vtype}' for '{venue_data.get('name', '?')}'"
        )

    if venue_data.get("vibes"):
        valid = [v for v in venue_data["vibes"] if v in VALID_VIBES]
        removed = set(venue_data["vibes"]) - set(valid)
        if removed:
            logger.warning(
                f"Removed invalid vibes {removed} from '{venue_data.get('name', '?')}'"
            )
        venue_data["vibes"] = valid or None

    if venues_support_location_designator():
        venue_data.setdefault(
            "location_designator", infer_location_designator(venue_data)
        )

    # Auto-infer neighborhood from coordinates when not already set.
    if venue_data.get("lat") and venue_data.get("lng") and not venue_data.get("neighborhood"):
        try:
            inferred_hood = infer_neighborhood_from_coords(
                venue_data["lat"], venue_data["lng"],
                city=venue_data.get("city", "Atlanta"),
            )
            if inferred_hood:
                venue_data["neighborhood"] = inferred_hood
                logger.debug(
                    "Auto-inferred neighborhood '%s' for %s",
                    inferred_hood,
                    venue_data.get("name", "unknown"),
                )
        except Exception:
            pass

    _has_address = bool(venue_data.get("address"))
    _has_coords = bool(venue_data.get("lat") and venue_data.get("lng"))

    if not _has_address and not _has_coords:
        logger.warning(
            "Hollow venue: '%s' has no address or coordinates — "
            "proximity dedup cannot catch future duplicates.",
            venue_data.get("name", "unknown"),
        )
        if not venue_data.get("city") or not venue_data.get("venue_type"):
            logger.warning(
                "Skipping venue creation for '%s' — insufficient data.",
                venue_data.get("name", "unknown"),
            )
            return None

    venue_data = _sanitize_venue_payload(venue_data)

    if not writes_enabled():
        _log_write_skip(f"insert venues name={venue_data.get('name', 'unknown')}")
        return _next_temp_id()
    result = client.table("venues").insert(venue_data).execute()
    new_venue_id = result.data[0]["id"]
    _persist_venue_enrichment(new_venue_id, _enrichment_details, _enrichment_features, _enrichment_specials)
    return new_venue_id


@retry_on_network_error(max_retries=3, base_delay=0.5)
def get_venue_by_id(venue_id: int) -> Optional[dict]:
    """Fetch a venue by its ID."""
    client = get_client()
    result = client.table("venues").select("*").eq("id", venue_id).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def get_venue_by_id_cached(venue_id: int) -> Optional[dict]:
    """Fetch a venue by its ID with per-crawl-run caching."""
    if venue_id in _VENUE_CACHE:
        return _VENUE_CACHE[venue_id]

    venue = get_venue_by_id(venue_id)
    if venue:
        _VENUE_CACHE[venue_id] = venue
    return venue


def clear_venue_cache() -> None:
    """Clear the venue cache. Call this at the start of each crawl run."""
    _VENUE_CACHE.clear()


def get_venue_by_slug(slug: str) -> Optional[dict]:
    """Fetch a venue by its slug."""
    client = get_client()
    result = client.table("venues").select("*").eq("slug", slug).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def upsert_venue_feature(venue_id: int, feature_data: dict) -> Optional[int]:
    """Insert or update a venue feature. Dedupes on (venue_id, slug)."""
    if not venues_support_features_table():
        return None

    title = (feature_data.get("title") or "").strip()
    if not title:
        logger.warning("upsert_venue_feature: missing title for venue_id=%s", venue_id)
        return None

    slug = (feature_data.get("slug") or "").strip().lower()
    if not slug:
        slug = re.sub(r"[^\w\s-]", "", title.lower())
        slug = re.sub(r"[\s_]+", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")

    if not slug:
        logger.warning("upsert_venue_feature: empty slug from title '%s'", title)
        return None

    row = {
        "venue_id": venue_id,
        "slug": slug,
        "title": title,
        "feature_type": feature_data.get("feature_type", "attraction"),
        "description": feature_data.get("description"),
        "image_url": feature_data.get("image_url"),
        "url": feature_data.get("url"),
        "is_seasonal": feature_data.get("is_seasonal", False),
        "start_date": feature_data.get("start_date"),
        "end_date": feature_data.get("end_date"),
        "price_note": feature_data.get("price_note"),
        "is_free": feature_data.get("is_free", False),
        "sort_order": feature_data.get("sort_order", 0),
        "is_active": True,
        "updated_at": "now()",
    }

    if not writes_enabled():
        _log_write_skip(f"upsert venue_features slug={slug} venue_id={venue_id}")
        return _next_temp_id()

    client = get_client()
    try:
        result = (
            client.table("venue_features")
            .upsert(row, on_conflict="venue_id,slug")
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
    except Exception:
        logger.exception("Failed to upsert venue feature '%s' for venue %s", title, venue_id)
    return None


def get_sibling_venue_ids(venue_id: int) -> list[int]:
    """Get IDs of sibling venues (other rooms of the same multi-room venue)."""
    client = get_client()

    venue = get_venue_by_id(venue_id)
    if not venue:
        return [venue_id]  # noqa: early-return

    venue_name = venue.get("name", "").lower()

    parent_venue_id = venue.get("parent_venue_id")

    if parent_venue_id:
        result = (
            client.table("venues")
            .select("id")
            .or_(f"id.eq.{parent_venue_id},parent_venue_id.eq.{parent_venue_id}")
            .eq("active", True)
            .execute()
        )
        if result.data:
            return [v["id"] for v in result.data]

    if "masquerade" in venue_name:
        result = (
            client.table("venues")
            .select("id")
            .ilike("name", "%masquerade%")
            .eq("active", True)
            .execute()
        )
        if result.data:
            return [v["id"] for v in result.data]

    return [venue_id]


# ===== BACKWARD-COMPATIBLE ALIASES =====
# Remove in cleanup phase (Task 9+)
get_or_create_venue = get_or_create_place
