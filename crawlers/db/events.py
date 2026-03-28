"""
Event insert/update, dedup lookups, and event-level utilities.
"""

import re
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field as dc_field
from datetime import date, datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from db.client import (
    get_client,
    retry_on_network_error,
    writes_enabled,
    _next_temp_id,
    _log_write_skip,
    _normalize_image_url,
    _normalize_source_url,
    events_support_show_signal_columns,
    events_support_film_identity_columns,
    events_support_content_kind_column,
    events_support_is_active_column,
    events_support_field_metadata_columns,
    has_event_extractions_table,
    events_support_taxonomy_v2_columns,
)
from db.validation import (
    validate_event,
    validate_event_title,
    _reject_aggregator_source_url,
    normalize_category,
    infer_content_kind,
    sanitize_text,
)
from db.places import get_venue_by_id_cached
from crawl_context import get_crawl_context
from db.sources import get_source_info, get_festival_source_hint, infer_program_title
from db.enrichment import _queue_event_blurhash
from db.series_linking import _force_update_series_day
from db.artists import (
    parse_lineup_from_title,
    sanitize_event_artists,
    upsert_event_artists,
    _NIGHTLIFE_SKIP_GENRES,
)

from tags import VALID_CATEGORIES, ALL_TAGS
from tag_inference import (
    infer_tags,
    infer_is_class,
    infer_is_religious,
    infer_is_support_group,
    infer_is_kids_activity,
    infer_genres,
)
from genre_normalize import normalize_genres
from series import get_or_create_series, update_series_metadata
from posters import get_metadata_for_film_event, extract_film_info
from artist_images import get_info_for_music_event
from show_signals import derive_show_signals
from planning_capabilities import (
    derive_capability_snapshot,
    attach_capability_metadata,
)
from utils import is_likely_non_event_image
from closed_venues import CLOSED_VENUE_SLUGS
from tba_policy import classify_tba_event

logger = logging.getLogger(__name__)

_RECOVERABLE_EVENT_DUPLICATE_INDEXES = (
    "idx_events_unique_source_venue_slot_norm_title_timed",
    "idx_events_unique_source_venue_slot_norm_title_notimed",
)

_AGGREGATOR_SOURCE_PREFIXES = (
    "ticketmaster",
    "eventbrite",
    "bigtickets",
    "mobilize",
)
_AGGREGATOR_SOURCE_SLUGS = {
    "atlanta-recurring-social",
    "arts-atl",
    "artsatl-calendar",
    "access-atlanta",
    "discover-atlanta",
    "instagram-captions",
    "creative-loafing",
    "nashville-scene",
}

# ---------------------------------------------------------------------------
# Recurrence-rule / start_date consistency
# ---------------------------------------------------------------------------

_RRULE_BYDAY_TO_WEEKDAY = {
    "MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6,
}
_WEEKDAY_TO_BYDAY = {v: k for k, v in _RRULE_BYDAY_TO_WEEKDAY.items()}
_BYDAY_RE = re.compile(r"BYDAY=([A-Z]{2})", re.IGNORECASE)


def _fix_recurrence_day_mismatch(event_data: dict) -> None:
    """Fix recurrence_rule BYDAY when it disagrees with start_date's actual day."""
    rule = event_data.get("recurrence_rule")
    start_date_str = event_data.get("start_date")
    if not rule or not start_date_str:
        return

    match = _BYDAY_RE.search(rule)
    if not match:
        return

    byday = match.group(1).upper()
    expected_weekday = _RRULE_BYDAY_TO_WEEKDAY.get(byday)
    if expected_weekday is None:
        return

    try:
        actual_date = datetime.strptime(str(start_date_str), "%Y-%m-%d")
    except (ValueError, TypeError):
        return

    actual_weekday = actual_date.weekday()
    if actual_weekday == expected_weekday:
        return

    correct_byday = _WEEKDAY_TO_BYDAY[actual_weekday]
    fixed_rule = _BYDAY_RE.sub(f"BYDAY={correct_byday}", rule)
    logger.debug(
        "Fixed recurrence_rule day mismatch for '%s' on %s: %s → %s",
        event_data.get("title", "")[:50],
        start_date_str,
        rule,
        fixed_rule,
    )
    event_data["recurrence_rule"] = fixed_rule


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------

def _normalize_url_path(url: str) -> str:
    try:
        parsed = urlparse(url)
    except Exception:
        return ""
    path = (parsed.path or "").strip().lower()
    if not path:
        return "/"
    if not path.startswith("/"):
        path = f"/{path}"
    if len(path) > 1:
        path = path.rstrip("/")
    return path or "/"


def _is_listing_like_url(url: Optional[str]) -> bool:
    value = (url or "").strip()
    if not value:
        return True
    path = _normalize_url_path(value)
    return path in {
        "/", "/events", "/event", "/calendar", "/shows", "/upcoming", "/upcoming-events",
    }


_TICKET_HOST_HINTS = (
    "ticketmaster.",
    "axs.",
    "eventbrite.",
    "etix.",
    "evenue.net",
    "ticketweb.",
    "tickets.",
    "seetickets.",
    "dice.fm",
    "tixr.com",
    "universe.com",
)


def _looks_like_explicit_ticket_url(url: Optional[str]) -> bool:
    value = (url or "").strip()
    if not value:
        return False
    try:
        parsed = urlparse(value)
    except Exception:
        return False

    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").lower()
    query = (parsed.query or "").lower()
    combined = " ".join(part for part in (host, path, query) if part)

    if any(hint in host for hint in _TICKET_HOST_HINTS):
        return True

    return any(
        token in combined
        for token in (
            "/tickets",
            "ticket=",
            "tickets=",
            "buy",
            "checkout",
            "purchase",
            "cart",
            "register",
            "admission",
        )
    )


def _should_promote_incoming_url(existing_url: Optional[str], incoming_url: Optional[str]) -> bool:
    incoming = (incoming_url or "").strip()
    if not incoming:
        return False
    existing = (existing_url or "").strip()
    if not existing:
        return True
    if existing == incoming:
        return False
    return _is_listing_like_url(existing) and not _is_listing_like_url(incoming)


def _should_promote_incoming_ticket_url(
    existing_url: Optional[str], incoming_url: Optional[str]
) -> bool:
    if _should_promote_incoming_url(existing_url, incoming_url):
        return True

    existing = (existing_url or "").strip()
    incoming = (incoming_url or "").strip()
    if not incoming or not existing or existing == incoming:
        return False

    return _looks_like_explicit_ticket_url(incoming) and not _looks_like_explicit_ticket_url(existing)


def _normalize_entity_key(value: str) -> str:
    normalized = (value or "").strip().lower().replace("&", " and ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _should_use_incoming_image(
    existing_url: Optional[str], incoming_url: Optional[str]
) -> bool:
    """True when incoming image should replace existing event image."""
    if not incoming_url:
        return False
    if is_likely_non_event_image(incoming_url):
        return False
    if not existing_url:
        return True
    return is_likely_non_event_image(existing_url) and existing_url != incoming_url


def _should_replace_placeholder_artists(
    event_title: str,
    existing_artists: list[dict],
    incoming_artists: list[dict],
) -> bool:
    if not existing_artists or not incoming_artists:
        return False
    if len(existing_artists) != 1:
        return False

    existing_name = str(existing_artists[0].get("name") or "").strip()
    if not existing_name:
        return False
    title_key = _normalize_entity_key(event_title)
    if not title_key:
        return False

    existing_key = _normalize_entity_key(existing_name)
    if existing_key != title_key:
        return False

    incoming_name = str(incoming_artists[0].get("name") or "").strip()
    incoming_key = _normalize_entity_key(incoming_name)
    if not incoming_key:
        return False

    return incoming_key != title_key


# ---------------------------------------------------------------------------
# Insert pipeline context
# ---------------------------------------------------------------------------

@dataclass
class InsertContext:
    """Shared state passed through the insert pipeline."""
    client: object = None
    source_info: dict = None
    source_slug: str = None
    source_name: str = None
    source_url: str = None
    venue: dict = None
    venue_vibes: list = dc_field(default_factory=list)
    venue_type: str = None
    venue_inactive_or_closed: bool = False
    is_class_flag: bool = False
    is_sensitive_flag: bool = False
    original_category: str = None
    series_hint: dict = None
    genres: list = None
    film_metadata: object = None
    parsed_film_title: str = None
    music_info: object = None
    parsed_artists: list = None


# ---------------------------------------------------------------------------
# Pipeline step functions
# ---------------------------------------------------------------------------

def _step_normalize_category(event_data: dict, ctx: InsertContext) -> dict:
    """Normalize category and validate against VALID_CATEGORIES."""
    if event_data.get("category"):
        event_data["category"] = normalize_category(event_data["category"])
        if event_data["category"] not in VALID_CATEGORIES:
            logger.warning(
                f"Invalid category '{event_data['category']}' for "
                f"'{event_data.get('title', 'N/A')[:60]}' - defaulting to 'other'"
            )
            event_data["category"] = "other"
    return event_data


def _step_validate(event_data: dict, ctx: InsertContext) -> dict:
    """Run validate_event(), validate_event_title(), and reject bad titles."""
    is_valid, rejection_reason, warnings = validate_event(event_data)
    if not is_valid:
        logger.warning(
            f"Event rejected: {rejection_reason} - Title: \"{event_data.get('title', 'N/A')[:80]}\""
        )
        raise ValueError(f"Event validation failed: {rejection_reason}")

    if warnings:
        for warning in warnings:
            logger.debug(
                f"Event validation warning: {warning} - Title: \"{event_data.get('title', 'N/A')[:50]}\""
            )

    title = event_data.get("title", "")
    if not validate_event_title(title):
        logger.warning(f'Rejected bad title: "{title[:80]}"')
        raise ValueError(f'Invalid event title: "{title[:50]}"')

    venue_id = event_data.get("venue_id")
    if venue_id and title:
        try:
            venue_row = (
                ctx.client.table("venues")
                .select("name")
                .eq("id", venue_id)
                .maybe_single()
                .execute()
            )
            if venue_row.data:
                venue_name_db = (venue_row.data.get("name") or "").strip().lower()
                if venue_name_db and title.strip().lower() == venue_name_db:
                    logger.warning(f'Rejected title=venue_name junk: "{title[:80]}"')
                    raise ValueError(f'Event title matches venue name: "{title[:50]}"')
        except ValueError:
            raise
        except Exception:
            pass

    # A5: Warn on missing venue_id for non-virtual events
    if not event_data.get("venue_id"):
        is_online = event_data.get("is_online") or event_data.get("is_virtual")
        if not is_online:
            logger.warning(f'Missing venue_id for non-virtual event: "{title[:80]}"')

    return event_data


def _step_check_past_date(event_data: dict, ctx: InsertContext) -> dict:
    """Hard-reject very stale new events; mark recent past events as inactive."""
    start_date = event_data.get("start_date")
    if not start_date:
        return event_data
    try:
        event_date = datetime.strptime(str(start_date)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return event_data

    today = datetime.now().date()

    # Hard-reject events more than 14 days old unless they are recurring/series
    # or already exist in the DB (updates to existing events are always allowed).
    # 14 days gives crawlers a full weekly recrawl cycle of slack.
    if event_date < today - timedelta(days=14):
        is_recurring = event_data.get("is_recurring", False)
        series_id = event_data.get("series_id")
        has_series_hint = getattr(ctx, "series_hint", None) is not None
        content_hash = event_data.get("content_hash")
        existing = find_event_by_hash(content_hash) if content_hash else None
        if not is_recurring and not series_id and not has_series_hint and not existing:
            raise ValueError(
                f"Rejecting stale event (start_date={start_date}, "
                f">14 days in past): {(event_data.get('title') or 'untitled')[:60]}"
            )

    # Mark yesterday/today-past as inactive (existing behavior)
    if event_date < today:
        logger.warning(
            "Past start_date %s → inserting as inactive: %s",
            start_date,
            (event_data.get("title") or "N/A")[:60],
        )
        event_data["is_active"] = False

    return event_data


def _step_validate_source_url(event_data: dict, ctx: InsertContext) -> dict:
    """Reject aggregator source URLs and do initial source_url normalization."""
    _reject_aggregator_source_url(event_data.get("source_url"))
    event_data["source_url"] = _normalize_source_url(event_data.get("source_url"))
    return event_data


def _step_generate_hash(event_data: dict, ctx: InsertContext) -> dict:
    """Auto-generate content_hash if missing, fix recurrence day mismatch, pop producer_id."""
    venue_id = event_data.get("venue_id")
    title = event_data.get("title", "")
    if not event_data.get("content_hash"):
        from dedupe import generate_content_hash

        venue_name_for_hash = ""
        if venue_id:
            venue_info = get_venue_by_id_cached(venue_id)
            if venue_info and isinstance(venue_info, dict):
                venue_name_for_hash = venue_info.get("name", "") or ""
        event_data["content_hash"] = generate_content_hash(
            title or "", venue_name_for_hash, event_data.get("start_date", "") or ""
        )
        logger.warning(f"Auto-generated missing content_hash for: {title[:60]}")

    _fix_recurrence_day_mismatch(event_data)

    if "producer_id" in event_data:
        event_data.pop("producer_id")

    return event_data


def _step_resolve_source(event_data: dict, ctx: InsertContext) -> dict:
    """Load source_info from source_id; apply source_url fallbacks and reject if missing."""
    if event_data.get("source_id"):
        ctx.source_info = get_source_info(event_data["source_id"])
        if ctx.source_info:
            ctx.source_slug = ctx.source_info.get("slug")
            ctx.source_name = ctx.source_info.get("name")
            ctx.source_url = ctx.source_info.get("url")

    if not ctx.is_sensitive_flag and ctx.source_info and ctx.source_info.get("is_sensitive"):
        ctx.is_sensitive_flag = True

    # Apply source_url fallback chain now that source_info is available
    if not event_data.get("source_url"):
        for candidate in (
            event_data.get("ticket_url"),
            event_data.get("url"),
            ctx.source_url,
        ):
            normalized = _normalize_source_url(candidate)
            if normalized:
                event_data["source_url"] = normalized
                break

    if not event_data.get("source_url"):
        msg = f'Missing source_url after fallback: "{event_data.get("title", "")[:80]}"'
        logger.warning(f"Event rejected: {msg}")
        raise ValueError(msg)

    return event_data


def _step_resolve_venue(event_data: dict, ctx: InsertContext) -> dict:
    """Load venue, check active state and geography, extract vibes/type into ctx."""
    if event_data.get("venue_id"):
        ctx.venue = get_venue_by_id_cached(event_data["venue_id"])
        if ctx.venue:
            ctx.venue_vibes = ctx.venue.get("vibes") or []
            ctx.venue_type = ctx.venue.get("venue_type")
            venue_slug = str(ctx.venue.get("slug") or "").strip().lower()
            if ctx.venue.get("active") is False or venue_slug in CLOSED_VENUE_SLUGS:
                ctx.venue_inactive_or_closed = True

            venue_state = (ctx.venue.get("state") or "").upper().strip()
            crawl_ctx = get_crawl_context()
            if venue_state and not crawl_ctx.is_valid_state(venue_state):
                msg = (
                    f"Venue outside allowed states {crawl_ctx.allowed_states}: "
                    f"{ctx.venue.get('name')} "
                    f"({ctx.venue.get('city')}, {venue_state})"
                )
                logger.warning(f"Event rejected: {msg}")
                raise ValueError(msg)

    return event_data


def _step_normalize_image(event_data: dict, ctx: InsertContext) -> dict:
    """Normalize image URL, discard low-quality images, fall back to venue image."""
    event_data["image_url"] = _normalize_image_url(event_data.get("image_url"))

    if is_likely_non_event_image(event_data.get("image_url")):
        if event_data.get("image_url"):
            logger.debug(
                "Discarding low-quality image URL for event: %s",
                event_data.get("title", "")[:80],
            )
        event_data["image_url"] = None

    if not event_data.get("image_url") and ctx.venue:
        venue_image = ctx.venue.get("image_url")
        if venue_image and not is_likely_non_event_image(venue_image):
            event_data["image_url"] = venue_image
            logger.debug(
                f"Using venue image fallback for: {event_data.get('title', '')[:50]}"
            )

    return event_data


def _step_enrich_film(event_data: dict, ctx: InsertContext) -> dict:
    """Fetch film metadata (OMDB) with timeout; populate image, film identity fields, genres."""
    if event_data.get("category") != "film":
        return event_data

    ctx.parsed_film_title, parsed_film_year = extract_film_info(
        event_data.get("title", "")
    )
    if events_support_film_identity_columns():
        if ctx.parsed_film_title and not event_data.get("film_title"):
            event_data["film_title"] = ctx.parsed_film_title
            event_data["film_identity_source"] = "title_parse"
        if parsed_film_year and not event_data.get("film_release_year"):
            try:
                event_data["film_release_year"] = int(parsed_film_year)
            except (TypeError, ValueError):
                pass

    _film_title_for_enrich = event_data.get("title", "")
    _film_image_for_enrich = event_data.get("image_url")
    try:
        with ThreadPoolExecutor(max_workers=1) as _pool:
            _future = _pool.submit(
                get_metadata_for_film_event,
                _film_title_for_enrich,
                _film_image_for_enrich,
            )
            ctx.film_metadata = _future.result(timeout=15)
    except Exception as _enrich_err:
        logger.warning(
            "Film enrichment timed out or failed for '%s': %s — inserting without metadata",
            event_data.get("title", "")[:60],
            _enrich_err,
        )
        ctx.film_metadata = None

    if ctx.film_metadata:
        metadata_source = getattr(ctx.film_metadata, "source", None) or "omdb"
        if not event_data.get("image_url"):
            event_data["image_url"] = ctx.film_metadata.poster_url
        if events_support_film_identity_columns():
            if ctx.film_metadata.title:
                event_data["film_title"] = ctx.film_metadata.title
            if ctx.film_metadata.year:
                event_data["film_release_year"] = ctx.film_metadata.year
            if ctx.film_metadata.imdb_id:
                event_data["film_imdb_id"] = ctx.film_metadata.imdb_id
            if ctx.film_metadata.genres:
                event_data["film_external_genres"] = ctx.film_metadata.genres
            event_data["film_identity_source"] = metadata_source
        if ctx.film_metadata.genres and not ctx.genres:
            ctx.genres = ctx.film_metadata.genres
        # Populate description from OMDB plot if event has no description
        if ctx.film_metadata.plot and not event_data.get("description"):
            event_data["description"] = ctx.film_metadata.plot

    return event_data


def _step_enrich_music(event_data: dict, ctx: InsertContext) -> dict:
    """Fetch music metadata (Spotify/Deezer) with timeout; populate image and genres."""
    if event_data.get("category") != "music":
        return event_data

    # Use pre-parsed headliner name if available (from _step_parse_artists),
    # otherwise fall back to the raw title for extraction.
    if ctx.parsed_artists:
        _music_title_for_enrich = ctx.parsed_artists[0].get("name") or event_data.get("title", "")
    else:
        _music_title_for_enrich = event_data.get("title", "")
    _music_image_for_enrich = event_data.get("image_url")
    _music_genres_for_enrich = ctx.genres
    try:
        with ThreadPoolExecutor(max_workers=1) as _pool:
            _future = _pool.submit(
                get_info_for_music_event,
                _music_title_for_enrich,
                _music_image_for_enrich,
                _music_genres_for_enrich,
            )
            ctx.music_info = _future.result(timeout=20)
    except Exception as _enrich_err:
        logger.warning(
            "Music enrichment timed out or failed for '%s': %s — inserting without artist info",
            event_data.get("title", "")[:60],
            _enrich_err,
        )
        ctx.music_info = None

    if ctx.music_info and ctx.music_info.image_url and not event_data.get("image_url"):
        event_data["image_url"] = ctx.music_info.image_url
    if ctx.music_info and ctx.music_info.genres and not ctx.genres:
        ctx.genres = ctx.music_info.genres

    return event_data


def _step_parse_artists(event_data: dict, ctx: InsertContext) -> dict:
    """Parse lineup from title for music/comedy/nightlife events."""
    if event_data.get("_suppress_title_participants"):
        return event_data
    event_category = str(
        event_data.get("category") or event_data.get("category_id") or ""
    ).strip().lower()
    if event_category in ("music", "comedy", "nightlife"):
        event_genres = set(event_data.get("genres") or [])
        skip = event_category == "nightlife" and bool(event_genres & _NIGHTLIFE_SKIP_GENRES)
        if not skip and not event_data.get("_parsed_artists"):
            parsed = parse_lineup_from_title(event_data.get("title", ""))
            if parsed:
                ctx.parsed_artists = parsed
                event_data["_parsed_artists"] = parsed
    return event_data


def _is_volunteer_event(event_data: dict) -> bool:
    """Return True if this event is a volunteer opportunity.

    Volunteer events should have their category preserved as ``volunteer`` and
    must never be reclassified to ``food_drink`` or any other category by
    downstream inference rules.
    """
    subcategory = str(event_data.get("subcategory") or "").strip().lower()
    if subcategory == "volunteer":
        return True
    tags = event_data.get("tags") or []
    return "volunteer" in {str(t).strip().lower() for t in tags}


def _step_infer_category(event_data: dict, ctx: InsertContext) -> dict:
    """Infer class/religious/support_group/kids category overrides."""
    # Volunteer events — preserve the crawler's category as "volunteer" and
    # skip all downstream inference.
    if _is_volunteer_event(event_data):
        event_data["category"] = "volunteer"
        return event_data

    if not ctx.is_class_flag:
        if infer_is_class(event_data, source_slug=ctx.source_slug, venue_type=ctx.venue_type):
            ctx.is_class_flag = True

    if infer_is_religious(event_data, source_slug=ctx.source_slug, venue_type=ctx.venue_type):
        event_data["category"] = "religious"

    if infer_is_support_group(event_data, source_slug=ctx.source_slug):
        event_data["category"] = "support_group"
        ctx.is_sensitive_flag = True

    if infer_is_kids_activity(event_data):
        event_data["category"] = "family"

    # Tighten community: reclassify events with strong specific-category signals
    if event_data.get("category") == "community":
        title_lower = (event_data.get("title") or "").lower()
        tags = event_data.get("tags") or []
        genres = event_data.get("genres") or []
        all_signals = set(tags + genres)

        # Music signals
        if any(s in all_signals for s in ("live-music", "concert", "dj", "open-mic", "karaoke", "jazz", "blues")):
            event_data["category"] = "music"
        # Comedy signals
        elif any(s in all_signals for s in ("comedy", "stand-up", "improv", "open-mic-comedy")):
            event_data["category"] = "comedy"
        # Outdoor signals
        elif any(s in all_signals for s in ("hiking", "trail", "outdoor", "nature", "kayak", "camping")):
            event_data["category"] = "outdoors"
        # Learning signals (from library/museum sources)
        elif any(s in all_signals for s in ("workshop", "class", "education", "lecture", "seminar", "training")):
            if not any(s in all_signals for s in ("volunteer", "civic", "nonprofit", "fundraiser")):
                event_data["category"] = "learning"

    return event_data


def _step_resolve_series(event_data: dict, ctx: InsertContext) -> dict:
    """Resolve festival hints, class series, and recurring show series hints."""
    series_hint = ctx.series_hint

    festival_hint = get_festival_source_hint(ctx.source_slug, ctx.source_name)
    if festival_hint:
        if not series_hint:
            if event_data.get("category") == "film":
                series_type = "film"
            elif ctx.is_class_flag:
                series_type = "class_series"
            elif event_data.get("is_recurring"):
                series_type = "recurring_show"
            else:
                series_type = "festival_program"

            inferred_program = infer_program_title(event_data.get("title"))
            series_title = inferred_program or festival_hint.get("festival_name")
            if not series_title:
                festival_hint = None
            else:
                series_hint = {
                    "series_type": series_type,
                    "series_title": series_title,
                }

        if festival_hint and series_hint:
            if festival_hint.get("festival_name") and not series_hint.get("festival_name"):
                series_hint["festival_name"] = festival_hint["festival_name"]
            if festival_hint.get("festival_type") and not series_hint.get("festival_type"):
                series_hint["festival_type"] = festival_hint["festival_type"]
            if ctx.source_url and not series_hint.get("festival_website"):
                series_hint["festival_website"] = ctx.source_url

    if not series_hint and ctx.is_class_flag:
        series_hint = {
            "series_type": "class_series",
            "series_title": event_data.get("title"),
            "venue_id": event_data.get("venue_id"),
        }

    if not series_hint and event_data.get("is_recurring"):
        series_hint = {
            "series_type": "recurring_show",
            "series_title": event_data.get("title"),
            "venue_id": event_data.get("venue_id"),
        }

    # Include venue_id for venue-scoped series matching (class_series, recurring_show)
    if event_data.get("venue_id") and series_hint:
        series_hint.setdefault("venue_id", event_data["venue_id"])

    ctx.series_hint = series_hint
    return event_data


def _step_infer_genres(event_data: dict, ctx: InsertContext) -> dict:
    """Infer genres from event/venue data and merge with explicit genres."""
    venue_genres = None
    if event_data.get("venue_id"):
        venue = get_venue_by_id_cached(event_data["venue_id"])
        if venue:
            venue_genres = venue.get("genres")

    inferred_genres = normalize_genres(
        infer_genres(
            event_data,
            venue_genres=venue_genres,
            venue_vibes=ctx.venue_vibes,
            venue_type=ctx.venue_type,
        )
    )
    explicit_genres = normalize_genres(ctx.genres or [])
    merged_genres = list(dict.fromkeys(explicit_genres + inferred_genres))
    if ctx.original_category == "activism" and "activism" not in merged_genres:
        merged_genres.append("activism")

    if merged_genres:
        ctx.genres = merged_genres

    return event_data


def _step_infer_tags(event_data: dict, ctx: InsertContext) -> dict:
    """Infer tags from event/venue data and merge with crawler-supplied tags."""
    from genre_normalize import VALID_GENRES

    crawler_tags = {str(t).strip().lower() for t in (event_data.get("tags") or [])}
    valid_crawler_tags = {t for t in crawler_tags if t in ALL_TAGS}
    inferred = infer_tags(
        event_data,
        ctx.venue_vibes,
        venue_type=ctx.venue_type,
        genres=ctx.genres or [],
    )
    event_data["tags"] = list(
        dict.fromkeys(inferred + sorted(valid_crawler_tags - set(inferred)))
    )

    final_tags = set(event_data.get("tags") or [])
    unknown_genres = set(ctx.genres or []) - VALID_GENRES
    unknown_tags = final_tags - ALL_TAGS
    if unknown_genres:
        logger.debug(
            f"Unknown genres for '{event_data.get('title', '')[:50]}': {unknown_genres}"
        )
    if unknown_tags:
        logger.debug(
            f"Unknown tags for '{event_data.get('title', '')[:50]}': {unknown_tags}"
        )

    return event_data


def _step_classify_v2(event_data: dict, ctx: InsertContext) -> dict:
    """
    Run new hybrid classification engine (Phase 2).
    Populates derived columns WITHOUT overwriting category_id.
    Guarded by CLASSIFY_V2_ENABLED env var and column-existence check.
    """
    import os as _os
    import time as _time

    # Feature flag — disable without a code deploy
    if not _os.environ.get("CLASSIFY_V2_ENABLED"):
        return event_data

    # Column-existence guard
    if not events_support_taxonomy_v2_columns():
        return event_data

    from classify import classify_event

    # Extract source_id from ctx.source_info (NOT ctx.source_id which doesn't exist!)
    source_id = None
    if ctx.source_info:
        source_id = ctx.source_info.get("id")
    if not source_id:
        source_id = event_data.get("source_id")

    title = event_data.get("title", "")
    old_category = event_data.get("category", "")

    start = _time.monotonic()
    result = classify_event(
        title=title,
        description=event_data.get("description", ""),
        venue_type=ctx.venue_type,
        source_name=ctx.source_name or ctx.source_slug,
        source_id=source_id,
        source_slug=ctx.source_slug,
        category_hint=old_category,
    )
    elapsed = _time.monotonic() - start
    if elapsed > 2.0:
        logger.info("classify_v2 took %.1fs for '%s' (source=%s)", elapsed, title[:40], result.source)

    # Log disagreements between old and new classification
    if result.category and old_category and result.category != old_category:
        logger.info("classify_v2 disagrees: old=%s new=%s title='%s'",
                    old_category, result.category, title[:60])

    # Populate derived attributes (additive — DON'T overwrite category)
    if result.duration:
        event_data["duration"] = result.duration
    if result.cost_tier:
        event_data["cost_tier"] = result.cost_tier
    if result.skill_level:
        event_data["skill_level"] = result.skill_level
    if result.booking_required is not None:
        event_data["booking_required"] = result.booking_required
    if result.indoor_outdoor:
        event_data["indoor_outdoor"] = result.indoor_outdoor
    if result.significance:
        event_data["significance"] = result.significance
    if result.significance_signals:
        event_data["significance_signals"] = result.significance_signals
    # Only set audience_tags when non-general
    if result.audience and result.audience != "general":
        event_data["audience_tags"] = [result.audience]
    event_data["classification_prompt_version"] = result.prompt_version

    return event_data


def _step_infer_content_kind(event_data: dict, ctx: InsertContext) -> dict:
    """Infer content_kind column value."""
    if events_support_content_kind_column():
        event_data["content_kind"] = infer_content_kind(
            event_data,
            series_hint=ctx.series_hint,
            source_slug=ctx.source_slug,
        )
    else:
        event_data.pop("content_kind", None)
    return event_data


_FREE_ADMISSION_RE = re.compile(
    r"\bfree\s+(admission|entry|event|and\s+open|to\s+the\s+public|to\s+attend|tickets?)\b"
    r"|\bno\s+(charge|cost|fee|admission)\b"
    r"|\bfree\s+community\s+event\b"
    r"|\bopen\s+to\s+(?:the\s+)?public\s+(?:and\s+)?free\b",
    re.IGNORECASE,
)


def _infer_is_free(event_data: dict) -> Optional[bool]:
    """Infer is_free from price fields and description text.

    Returns the inferred bool, or None if genuinely unknown.
    Does not mutate event_data.
    """
    # Already explicitly set by crawler — respect it
    if event_data.get("is_free") is not None:
        return event_data["is_free"]

    # price_min == 0 → free; price_min > 0 → paid
    price_min = event_data.get("price_min")
    if price_min is not None:
        try:
            val = float(price_min)
            if val == 0:
                return True
            if val > 0:
                return False
        except (ValueError, TypeError):
            pass

    # price_note contains free or paid signals
    price_note = (event_data.get("price_note") or "").lower()
    free_signals = ("free", "no charge", "no cost", "complimentary", "no fee")
    if any(signal in price_note for signal in free_signals):
        return True
    paid_signals = ("$", "per person", "per ticket")
    if any(signal in price_note for signal in paid_signals):
        return False

    # Description / title text patterns
    desc = event_data.get("description") or ""
    title = event_data.get("title") or ""
    if _FREE_ADMISSION_RE.search(desc) or _FREE_ADMISSION_RE.search(title):
        return True

    return None  # genuinely unknown


def _step_set_flags(event_data: dict, ctx: InsertContext) -> dict:
    """Set is_active, is_class, is_sensitive, portal_id, ticket_url, and is_free."""
    from description_quality import is_likely_truncated_description

    series_hint = ctx.series_hint
    genres = ctx.genres

    # Infer is_free from price fields and text before anything else reads it
    inferred_free = _infer_is_free(event_data)
    if inferred_free is not None and event_data.get("is_free") is None:
        logger.debug(
            "is_free inferred as %s for '%s'",
            inferred_free,
            event_data.get("title", "")[:60],
        )
        event_data["is_free"] = inferred_free

    if events_support_is_active_column():
        event_data["is_active"] = not ctx.venue_inactive_or_closed
    else:
        event_data.pop("is_active", None)

    existing_desc = event_data.get("description") or ""
    desc_is_weak = len(existing_desc) < 80 or is_likely_truncated_description(existing_desc)
    if ctx.film_metadata and ctx.film_metadata.plot and desc_is_weak:
        event_data["description"] = ctx.film_metadata.plot[:2000]

    existing_desc = event_data.get("description") or ""
    desc_is_weak = len(existing_desc) < 80 or is_likely_truncated_description(existing_desc)
    if ctx.music_info and ctx.music_info.bio and desc_is_weak:
        event_data["description"] = ctx.music_info.bio[:2000]

    desc = event_data.get("description") or ""
    if re.match(
        r"^(Event at |Live music at .+ featuring|Comedy show at |"
        r"Theater performance at |Film screening at |Sporting event at |"
        r"Arts event at |Food & drink event at |Fitness class at |"
        r"Creative workshop at |Performance at |Show at |Paint and sip class at )",
        desc,
    ):
        event_data["description"] = None

    if (
        not event_data.get("portal_id")
        and ctx.source_info
        and ctx.source_info.get("owner_portal_id")
    ):
        event_data["portal_id"] = ctx.source_info["owner_portal_id"]

    if ctx.is_class_flag:
        event_data["is_class"] = True

    if ctx.is_sensitive_flag:
        event_data["is_sensitive"] = True

    if not event_data.get("ticket_url") and event_data.get("source_url"):
        category_value = str(event_data.get("category") or "").lower()
        tags_value = {str(tag).lower() for tag in (event_data.get("tags") or [])}
        genres_value = {str(genre).lower() for genre in (genres or [])}
        is_paid = event_data.get("is_free") is False or (
            event_data.get("price_min") is not None
            and float(event_data.get("price_min") or 0) > 0
        )
        if (
            category_value == "film"
            or "showtime" in tags_value
            or "showtime" in genres_value
            or is_paid
        ):
            event_data["ticket_url"] = event_data["source_url"]

    # Final is_free normalization — price_min=0 with no paid tiers is definitively free,
    # even if the crawler explicitly said is_free=False (common crawler default bug)
    if event_data.get("price_min") is not None:
        pm = float(event_data["price_min"])
        if pm == 0 and not event_data.get("price_max"):
            event_data["is_free"] = True
        elif pm > 0:
            event_data["is_free"] = False
    elif event_data.get("is_free") is False and event_data.get("price_min") is None:
        # is_free=False with no price data → unknown, not definitively paid
        event_data["is_free"] = None

    return event_data


def _step_show_signals(event_data: dict, ctx: InsertContext) -> dict:
    """Derive show signals from event data."""
    signal_fields = (
        "doors_time", "age_policy", "ticket_status", "reentry_policy", "set_times_mentioned",
    )
    if events_support_show_signal_columns():
        event_data.update(derive_show_signals(event_data))
        # Stamp the check time whenever ticket_status is present so the
        # planning horizon urgency signals stay current.
        if event_data.get("ticket_status"):
            event_data["ticket_status_checked_at"] = datetime.utcnow().isoformat()
    else:
        for field in signal_fields:
            event_data.pop(field, None)
        event_data.pop("ticket_status_checked_at", None)
    return event_data


def _step_field_metadata(event_data: dict, ctx: InsertContext) -> dict:
    """Capture capability snapshot and attach field metadata."""
    if events_support_field_metadata_columns():
        capability_snapshot = derive_capability_snapshot(
            event_data,
            source_info=ctx.source_info,
        )
        attach_capability_metadata(
            event_data,
            capability_snapshot,
            source_info=ctx.source_info,
        )
    else:
        event_data.pop("field_provenance", None)
        event_data.pop("field_confidence", None)
    return event_data


def _step_data_quality(event_data: dict, ctx: InsertContext) -> dict:
    """Compute and attach data_quality score."""
    try:
        from compute_data_quality import score_record, EVENT_WEIGHTS
        event_data["data_quality"] = score_record(event_data, EVENT_WEIGHTS)
    except Exception as e:
        logger.debug(
            "data_quality scoring failed for '%s': %s",
            event_data.get("title", "")[:50],
            e,
        )
    return event_data


def _step_finalize(event_data: dict, ctx: InsertContext) -> dict:
    """Rename category→category_id, write genres, and clean up internal fields."""
    if ctx.genres:
        event_data["genres"] = ctx.genres

    # Film series hint enrichment
    series_hint = ctx.series_hint
    if series_hint and series_hint.get("series_type") == "film" and ctx.parsed_film_title:
        series_hint["series_title"] = ctx.parsed_film_title

    if ctx.film_metadata and series_hint and series_hint.get("series_type") == "film":
        omdb_fields = {
            "director": ctx.film_metadata.director,
            "runtime_minutes": ctx.film_metadata.runtime_minutes,
            "year": ctx.film_metadata.year,
            "rating": ctx.film_metadata.rating,
            "imdb_id": ctx.film_metadata.imdb_id,
            "genres": ctx.film_metadata.genres,
            "description": ctx.film_metadata.plot,
            "image_url": ctx.film_metadata.poster_url,
        }
        for key, value in omdb_fields.items():
            if value is not None and not series_hint.get(key):
                series_hint[key] = value

    if series_hint and not event_data.get("series_id") and writes_enabled():
        genres = ctx.genres
        if genres and not series_hint.get("genres"):
            series_hint["genres"] = genres
        series_id = get_or_create_series(
            ctx.client, series_hint, event_data.get("category"),
            venue_id=series_hint.get("venue_id"),
        )
        if series_id:
            event_data["series_id"] = series_id
            if genres:
                update_series_metadata(ctx.client, series_id, {"genres": genres})
            if ctx.film_metadata and series_hint.get("series_type") == "film":
                update_series_metadata(
                    ctx.client,
                    series_id,
                    {
                        "director": ctx.film_metadata.director,
                        "runtime_minutes": ctx.film_metadata.runtime_minutes,
                        "year": ctx.film_metadata.year,
                        "rating": ctx.film_metadata.rating,
                        "imdb_id": ctx.film_metadata.imdb_id,
                        "genres": ctx.film_metadata.genres,
                        "description": ctx.film_metadata.plot,
                        "image_url": ctx.film_metadata.poster_url,
                    },
                )
            if series_hint.get("series_type") in ("recurring_show", "class_series"):
                backfill = {}
                for field in (
                    "description", "image_url", "day_of_week", "start_time",
                    "frequency", "price_note",
                ):
                    if series_hint.get(field):
                        backfill[field] = series_hint[field]
                if backfill:
                    update_series_metadata(ctx.client, series_id, backfill)
                if series_hint.get("last_verified_at"):
                    ctx.client.table("series").update(
                        {"last_verified_at": series_hint["last_verified_at"]}
                    ).eq("id", series_id).execute()

                hint_dow = (series_hint.get("day_of_week") or "").strip().lower()
                if hint_dow and event_data.get("start_date"):
                    try:
                        ev_date = datetime.strptime(
                            str(event_data["start_date"]), "%Y-%m-%d"
                        )
                        actual_dow = [
                            "monday", "tuesday", "wednesday",
                            "thursday", "friday", "saturday", "sunday",
                        ][ev_date.weekday()]
                        if hint_dow == actual_dow:
                            _force_update_series_day(
                                ctx.client, series_id, series_hint["day_of_week"]
                            )
                    except (ValueError, IndexError):
                        pass

    # Promote event image_url to the series record (fills the 97.4% imageless series gap).
    series_id = event_data.get("series_id")
    event_image = event_data.get("image_url")
    if (
        series_id
        and event_image
        and series_hint
        and series_hint.get("series_type") != "film"
        and writes_enabled()
    ):
        logger.debug(
            f"Promoting image to series {series_id} from event '{event_data.get('title', '')}'"
        )
        update_series_metadata(ctx.client, series_id, {"image_url": event_image})

    # category → category_id rename
    if "category" in event_data and "category_id" not in event_data:
        event_data["category_id"] = event_data.pop("category")
    elif "category" in event_data:
        event_data.pop("category")

    event_data.pop("subcategory", None)
    event_data.pop("subcategory_id", None)

    return event_data


# ---------------------------------------------------------------------------
# Insert pipeline definition
# ---------------------------------------------------------------------------

INSERT_PIPELINE = [
    _step_normalize_category,
    _step_validate,
    _step_check_past_date,
    _step_validate_source_url,
    _step_generate_hash,
    _step_resolve_source,
    _step_resolve_venue,
    _step_normalize_image,
    _step_enrich_film,
    _step_parse_artists,
    _step_enrich_music,
    _step_infer_category,
    _step_resolve_series,
    _step_infer_genres,
    _step_set_flags,
    _step_infer_tags,
    _step_classify_v2,          # NEW — taxonomy v2 derived columns
    _step_infer_content_kind,
    _step_show_signals,
    _step_field_metadata,
    _step_data_quality,
    _step_finalize,
]


# ---------------------------------------------------------------------------
# Extraction column routing (Phase C: event_extractions table)
# ---------------------------------------------------------------------------

_EXTRACTION_COLUMNS = {"raw_text", "extraction_confidence", "field_provenance", "field_confidence", "extraction_version"}


def _pop_extraction_columns(event_data: dict) -> dict:
    """Pop extraction-related columns from event_data, return them as a separate dict."""
    extraction = {}
    for col in _EXTRACTION_COLUMNS:
        val = event_data.pop(col, None)
        if val is not None:
            extraction[col] = val
    return extraction


def _write_event_extraction(client, event_id: int, extraction_data: dict) -> None:
    """Write extraction metadata to the event_extractions table."""
    if not extraction_data:
        return
    try:
        payload = {"event_id": event_id, **extraction_data}
        client.table("event_extractions").upsert(payload, on_conflict="event_id").execute()
    except Exception as e:
        logger.debug("Failed to write event_extractions for event %s: %s", event_id, e)


# ---------------------------------------------------------------------------
# Importance inference
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Importance inference: determines which events earn "major" tier
# ---------------------------------------------------------------------------
# An event earns "major" (= worth planning ahead for) if ANY of:
#   1. Part of a festival (has festival_id or series→festival_id)
#   2. Arena concert/show: capacity_tier 5, music or theater category
#   3. Amphitheater headliner: capacity_tier 4, music category
#   4. Has sellout_risk in (medium, high)
#
# EXCLUDED regardless of venue size:
#   - Regular-season sports (category=sports)
#   - Tours, fitness, community, unknown categories
#   - Classes (is_class=true)
#   - Admin/billing noise (title patterns)
#   - Tier 3 and below venues (Tabernacle, Masquerade, Eastern, etc.)

_IMPORTANCE_ELIGIBLE_CATEGORIES_TIER5 = frozenset({"music", "theater", "comedy", "art", "food_drink", "family"})
_IMPORTANCE_ELIGIBLE_CATEGORIES_TIER4 = frozenset({"music"})

_IMPORTANCE_SKIP_TITLE_RES = [
    re.compile(r"^tours?:", re.IGNORECASE),
    re.compile(r"\btour\b.*\bpark\b", re.IGNORECASE),
    re.compile(r"\bopen gym\b", re.IGNORECASE),
    re.compile(r"\bworkout day\b", re.IGNORECASE),
    re.compile(r"\bselect.a.seat\b", re.IGNORECASE),
    re.compile(r"\bsymposium\b", re.IGNORECASE),
    re.compile(r"\bconference\b", re.IGNORECASE),
    re.compile(r"\btraining event\b", re.IGNORECASE),
    re.compile(r"\bmember open\b", re.IGNORECASE),
    re.compile(r"\bsuite season\b", re.IGNORECASE),
    re.compile(r"\bsth deposit\b", re.IGNORECASE),
    re.compile(r"^event for calendar\b", re.IGNORECASE),
]


def _maybe_infer_importance(event_id: int, event_data: dict) -> None:
    """Auto-set importance='major' for events worth planning ahead for.

    Criteria: arena/amphitheater concerts, festival programs, or sellout risk.
    Regular-season sports, tours, classes, and tier-3-and-below venues are excluded.
    Never downgrades.
    """
    if not writes_enabled():
        return

    current_importance = event_data.get("importance", "standard")
    if current_importance in ("flagship", "major"):
        return  # Already elevated, don't touch

    # Quick-reject: classes and title noise
    if event_data.get("is_class"):
        return
    title = event_data.get("title", "")
    if any(p.search(title) for p in _IMPORTANCE_SKIP_TITLE_RES):
        return

    category = event_data.get("category", "")
    should_upgrade = False

    # Path 1: sellout risk
    if event_data.get("sellout_risk") in ("medium", "high"):
        should_upgrade = True

    # Path 2: venue capacity — tier 5 (arenas/stadiums) or tier 4 (amphitheaters)
    if not should_upgrade:
        venue_id = event_data.get("venue_id")
        if venue_id:
            venue = get_venue_by_id_cached(int(venue_id))
            capacity_tier = venue.get("capacity_tier") if venue else None

            if capacity_tier and capacity_tier >= 5 and category in _IMPORTANCE_ELIGIBLE_CATEGORIES_TIER5:
                should_upgrade = True
            elif capacity_tier and capacity_tier >= 4 and category in _IMPORTANCE_ELIGIBLE_CATEGORIES_TIER4:
                should_upgrade = True

    if should_upgrade:
        try:
            client = get_client()
            client.table("events").update({"importance": "major"}).eq(
                "id", event_id
            ).eq("importance", "standard").execute()
            logger.info(
                "Auto-inferred importance='major' for event %s (category=%s)",
                event_id,
                category,
            )
        except Exception as e:
            logger.debug("importance inference failed for event %s: %s", event_id, e)


# ---------------------------------------------------------------------------
# Event insert
# ---------------------------------------------------------------------------

@retry_on_network_error(max_retries=4, base_delay=0.5)
def insert_event(
    event_data: dict, series_hint: dict = None, genres: list = None
) -> int:
    """Insert a new event with inferred tags, series linking, and genres. Returns event ID."""
    venue_id = event_data.get("venue_id")
    if venue_id is None or (isinstance(venue_id, int) and venue_id < 0):
        title = event_data.get("title", "untitled")
        logger.warning("Skipping event insert — invalid venue_id=%s for '%s'", venue_id, title[:80])
        return _next_temp_id()

    client = get_client()

    ctx = InsertContext(
        client=client,
        series_hint=series_hint,
        genres=genres,
        original_category=event_data.get("category"),
        is_class_flag=event_data.pop("is_class", None) or False,
        is_sensitive_flag=event_data.pop("is_sensitive", None) or False,
    )

    # Run pipeline
    for step in INSERT_PIPELINE:
        event_data = step(event_data, ctx)

    links_for_insert = event_data.pop("links", None)
    images_for_insert = event_data.pop("images", None)

    # Dedup check
    existing = find_existing_event_for_insert(event_data)
    if existing:
        if ctx.parsed_artists and not event_data.get("_parsed_artists"):
            event_data["_parsed_artists"] = ctx.parsed_artists
        smart_update_existing_event(existing, event_data)
        if images_for_insert:
            upsert_event_images(existing["id"], images_for_insert)
        if links_for_insert:
            upsert_event_links(existing["id"], links_for_insert)
        return existing["id"]

    cross_source_canonical_id = find_cross_source_canonical_for_insert(event_data)
    if cross_source_canonical_id:
        event_data["canonical_event_id"] = cross_source_canonical_id

    event_data.pop("_parsed_artists", None)
    event_data.pop("_suppress_title_participants", None)

    if not writes_enabled():
        _log_write_skip(f"insert events title={event_data.get('title', 'untitled')[:60]}")
        return _next_temp_id()

    # If event_extractions table exists, route extraction columns there instead
    extraction_data = None
    if has_event_extractions_table():
        extraction_data = _pop_extraction_columns(event_data)

    try:
        result = _insert_event_record(client, event_data)
        event_id = result.data[0]["id"]
    except Exception as exc:
        if not _is_recoverable_event_duplicate(exc):
            raise
        existing = find_existing_event_for_insert(event_data)
        if not existing:
            raise
        if ctx.parsed_artists and not event_data.get("_parsed_artists"):
            event_data["_parsed_artists"] = ctx.parsed_artists
        smart_update_existing_event(existing, event_data)
        if images_for_insert:
            upsert_event_images(existing["id"], images_for_insert)
        if links_for_insert:
            upsert_event_links(existing["id"], links_for_insert)
        logger.info(
            "Recovered duplicate event insert as smart update: %s",
            (event_data.get("title") or "untitled")[:80],
        )
        return existing["id"]

    # Write extraction data to the separate table
    if extraction_data:
        _write_event_extraction(client, event_id, extraction_data)

    _queue_event_blurhash(event_id, event_data.get("image_url"))

    if ctx.parsed_artists:
        try:
            upsert_event_artists(event_id, ctx.parsed_artists, pre_parsed=True)
        except Exception as e:
            logger.debug(f"Auto event_artists failed for event {event_id}: {e}")

    if images_for_insert:
        try:
            upsert_event_images(event_id, images_for_insert)
        except Exception as e:
            logger.debug(f"Auto event_images failed for event {event_id}: {e}")

    if links_for_insert:
        try:
            upsert_event_links(event_id, links_for_insert)
        except Exception as e:
            logger.debug(f"Auto event_links failed for event {event_id}: {e}")

    _maybe_infer_importance(event_id, event_data)

    return event_id


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _insert_event_record(client, event_data: dict):
    """Insert event row with retries for transient socket/network errors."""
    return client.table("events").insert(event_data).execute()


def _is_recoverable_event_duplicate(exc: Exception) -> bool:
    text = str(exc or "")
    if "duplicate key value violates unique constraint" not in text:
        return False
    return any(index_name in text for index_name in _RECOVERABLE_EVENT_DUPLICATE_INDEXES)


def update_event(event_id: int, event_data: dict) -> None:
    """Update an existing event."""
    if not writes_enabled():
        _log_write_skip(f"update events id={event_id}")
        return
    client = get_client()
    _update_event_record(client, event_id, event_data)


@retry_on_network_error(max_retries=4, base_delay=0.5)
def _update_event_record(client, event_id: int, event_data: dict):
    """Update event row with retries for transient socket/network errors."""
    return client.table("events").update(event_data).eq("id", event_id).execute()


def smart_update_existing_event(existing: dict, incoming: dict) -> bool:
    """Compare existing DB event with incoming crawler data and update if incoming is better."""
    event_id = existing.get("id")
    if not event_id:
        return False

    incoming = dict(incoming or {})
    suppress_title_participants = bool(
        incoming.pop("_suppress_title_participants", False)
    )

    updates: dict = {}
    existing_category = str(existing.get("category_id") or "").strip().lower()
    incoming_category = str(
        incoming.get("category_id") or incoming.get("category") or ""
    ).strip().lower()
    existing_source_id = existing.get("source_id")
    incoming_source_id = incoming.get("source_id")

    existing_desc = existing.get("description") or ""
    incoming_desc = incoming.get("description") or ""
    if incoming_desc:
        from description_quality import (
            classify_description,
            is_likely_truncated_description,
        )

        incoming_desc_quality = classify_description(incoming_desc)
        if incoming_desc_quality == "good":
            existing_desc_truncated = is_likely_truncated_description(existing_desc)
            incoming_desc_truncated = is_likely_truncated_description(incoming_desc)
            if (
                len(incoming_desc) > len(existing_desc)
                and not incoming_desc_truncated
            ) or (
                existing_desc_truncated
                and not incoming_desc_truncated
            ):
                updates["description"] = incoming_desc

    existing_img = existing.get("image_url") or ""
    incoming_img = _normalize_image_url(incoming.get("image_url")) or ""
    if _should_use_incoming_image(existing_img, incoming_img):
        updates["image_url"] = incoming_img

    incoming_start_time = incoming.get("start_time")
    existing_start_time = existing.get("start_time")
    if incoming_start_time and not existing_start_time:
        updates["start_time"] = incoming_start_time
    elif (
        incoming_start_time
        and existing_start_time
        and incoming_start_time != existing_start_time
    ):
        existing_urls = {
            str(existing.get("ticket_url") or "").strip(),
            str(existing.get("source_url") or "").strip(),
        }
        incoming_urls = {
            str(incoming.get("ticket_url") or "").strip(),
            str(incoming.get("source_url") or "").strip(),
        }
        existing_urls.discard("")
        incoming_urls.discard("")
        if (
            existing_source_id
            and incoming_source_id
            and existing_source_id == incoming_source_id
            and existing.get("venue_id")
            and incoming.get("venue_id")
            and existing.get("venue_id") == incoming.get("venue_id")
            and existing.get("start_date")
            and incoming.get("start_date")
            and existing.get("start_date") == incoming.get("start_date")
            and _normalize_title_for_natural_key(existing.get("title"))
            == _normalize_title_for_natural_key(incoming.get("title"))
            and existing_urls
            and incoming_urls
            and existing_urls & incoming_urls
        ):
            updates["start_time"] = incoming_start_time
    if incoming.get("end_time") and not existing.get("end_time"):
        updates["end_time"] = incoming["end_time"]
    if incoming.get("end_date") and not existing.get("end_date"):
        updates["end_date"] = incoming["end_date"]

    if incoming.get("price_min") is not None and existing.get("price_min") is None:
        updates["price_min"] = incoming["price_min"]
    if incoming.get("price_max") is not None and existing.get("price_max") is None:
        updates["price_max"] = incoming["price_max"]
    if incoming.get("price_note") and not existing.get("price_note"):
        updates["price_note"] = incoming["price_note"]

    if _should_promote_incoming_ticket_url(existing.get("ticket_url"), incoming.get("ticket_url")):
        updates["ticket_url"] = incoming["ticket_url"]
    if _should_promote_incoming_url(existing.get("source_url"), incoming.get("source_url")):
        updates["source_url"] = incoming["source_url"]

    # Planning horizon fields — only set if incoming has value AND existing is empty
    for field in (
        "on_sale_date",
        "presale_date",
        "early_bird_deadline",
        "announce_date",
        "registration_opens",
        "registration_closes",
        "registration_url",
        "sellout_risk",
    ):
        if incoming.get(field) and not existing.get(field):
            updates[field] = incoming[field]

    # importance: only upgrade, never downgrade (flagship > major > standard)
    _IMPORTANCE_RANK = {"flagship": 3, "major": 2, "standard": 1}
    incoming_importance = incoming.get("importance", "standard")
    existing_importance = existing.get("importance", "standard")
    if _IMPORTANCE_RANK.get(incoming_importance, 0) > _IMPORTANCE_RANK.get(existing_importance, 0):
        updates["importance"] = incoming_importance

    # ticket_status: update when incoming has a value (show signals ran)
    incoming_ticket_status = incoming.get("ticket_status")
    if incoming_ticket_status and incoming_ticket_status != existing.get("ticket_status"):
        updates["ticket_status"] = incoming_ticket_status

    # ticket_status_checked_at: always take the most recent
    incoming_checked = incoming.get("ticket_status_checked_at")
    existing_checked = existing.get("ticket_status_checked_at")
    if incoming_checked:
        if not existing_checked or incoming_checked > existing_checked:
            updates["ticket_status_checked_at"] = incoming_checked
    elif incoming_ticket_status:
        # ticket_status was set but checked_at wasn't stamped upstream — stamp it now
        updates["ticket_status_checked_at"] = datetime.utcnow().isoformat()

    if not existing.get("portal_id"):
        incoming_portal_id = incoming.get("portal_id")
        if not incoming_portal_id and incoming.get("source_id"):
            source_info = get_source_info(incoming["source_id"])
            if source_info:
                incoming_portal_id = source_info.get("owner_portal_id")
        if incoming_portal_id:
            updates["portal_id"] = incoming_portal_id

    if incoming_source_id and existing_source_id and incoming_source_id != existing_source_id:
        existing_source = get_source_info(existing_source_id) or {}
        incoming_source = get_source_info(incoming_source_id) or {}
        existing_priority = _source_priority_for_dedupe(
            existing_source.get("slug"), existing_source.get("is_active")
        )
        incoming_priority = _source_priority_for_dedupe(
            incoming_source.get("slug"), incoming_source.get("is_active")
        )
        if incoming_priority < existing_priority:
            updates["source_id"] = incoming_source_id
            incoming_portal_id = incoming.get("portal_id") or incoming_source.get("owner_portal_id")
            if incoming_portal_id:
                updates["portal_id"] = incoming_portal_id

    if incoming_category in VALID_CATEGORIES:
        if not existing_category:
            updates["category_id"] = incoming_category
        elif (
            incoming_category != existing_category
            and existing_category in {"community", "other"}
            and incoming_category not in {"community", "other"}
        ):
            # Never override the category of a volunteer event — it is
            # intentionally ``community`` regardless of venue type or title
            # signals from other sources (e.g. a farmers-market venue type
            # would otherwise push it to ``food_drink``).
            existing_subcategory = str(existing.get("subcategory") or existing.get("subcategory_id") or "").strip().lower()
            existing_tags = existing.get("tags") or []
            existing_is_volunteer = (
                existing_subcategory == "volunteer"
                or "volunteer" in {str(t).strip().lower() for t in existing_tags}
            )
            if not existing_is_volunteer:
                updates["category_id"] = incoming_category

    if not existing.get("is_sensitive"):
        source_id = existing.get("source_id") or incoming.get("source_id")
        if source_id:
            src = get_source_info(source_id)
            if src and src.get("is_sensitive"):
                updates["is_sensitive"] = True

    if incoming.get("recurrence_rule") and not existing.get("recurrence_rule"):
        tmp = {
            "recurrence_rule": incoming["recurrence_rule"],
            "start_date": existing.get("start_date"),
        }
        _fix_recurrence_day_mismatch(tmp)
        updates["recurrence_rule"] = tmp["recurrence_rule"]
    if incoming.get("is_recurring") and not existing.get("is_recurring"):
        updates["is_recurring"] = True

    if events_support_is_active_column() and existing.get("is_active") is False:
        should_reactivate = True
        venue_id = incoming.get("venue_id") or existing.get("venue_id")
        if venue_id:
            venue = get_venue_by_id_cached(int(venue_id))
            venue_slug = str((venue or {}).get("slug") or "").strip().lower()
            if (venue or {}).get("active") is False or venue_slug in CLOSED_VENUE_SLUGS:
                should_reactivate = False
        if should_reactivate:
            updates["is_active"] = True

    if events_support_content_kind_column():
        from db.validation import _CONTENT_KIND_ALLOWED
        existing_kind = str(existing.get("content_kind") or "").strip().lower()
        incoming_kind = str(incoming.get("content_kind") or "").strip().lower()
        if incoming_kind in _CONTENT_KIND_ALLOWED:
            if not existing_kind or (
                existing_kind == "event" and incoming_kind in {"exhibit", "special"}
            ):
                updates["content_kind"] = incoming_kind

    if events_support_film_identity_columns() and existing.get("category_id") == "film":
        if incoming.get("film_title") and not existing.get("film_title"):
            updates["film_title"] = incoming["film_title"]
        if incoming.get("film_release_year") and not existing.get("film_release_year"):
            updates["film_release_year"] = incoming["film_release_year"]
        if incoming.get("film_imdb_id") and not existing.get("film_imdb_id"):
            updates["film_imdb_id"] = incoming["film_imdb_id"]
        if incoming.get("film_external_genres") and not existing.get("film_external_genres"):
            updates["film_external_genres"] = incoming["film_external_genres"]
        if incoming.get("film_identity_source") and not existing.get("film_identity_source"):
            updates["film_identity_source"] = incoming["film_identity_source"]

    existing_tags = set(existing.get("tags") or [])
    incoming_tags = set(incoming.get("tags") or [])
    if incoming_tags:
        from tag_inference import ALL_TAGS as _ALL_TAGS
        manual_tags = existing_tags - _ALL_TAGS
        reconciled = incoming_tags | manual_tags
        if reconciled != existing_tags:
            updates["tags"] = list(reconciled)

    incoming_genre_list = list(incoming.get("genres") or [])
    if not incoming_genre_list:
        from tag_inference import infer_genres as _infer_genres
        from genre_normalize import normalize_genres as _normalize_genres_su

        venue_id = incoming.get("venue_id") or existing.get("venue_id")
        venue = get_venue_by_id_cached(int(venue_id)) if venue_id else None
        inferred = _normalize_genres_su(
            _infer_genres(
                incoming,
                venue_genres=(venue or {}).get("genres"),
                venue_vibes=(venue or {}).get("vibes"),
                venue_type=(venue or {}).get("venue_type"),
            )
        )
        if inferred:
            incoming_genre_list = inferred

    existing_genres = set(existing.get("genres") or [])
    incoming_genres = set(incoming_genre_list)
    if incoming_genres and incoming_genres != existing_genres:
        updates["genres"] = list(incoming_genres)

    existing_title = existing.get("title") or ""
    incoming_title = incoming.get("title") or ""
    if (
        incoming_title
        and existing_title.isupper()
        and not incoming_title.isupper()
        and incoming_title.lower() == existing_title.lower()
    ):
        updates["title"] = incoming_title

    if updates:
        try:
            from compute_data_quality import score_record as _score_record, EVENT_WEIGHTS as _EW
            merged = {**existing, **updates}
            if "category_id" in merged and "category" not in merged:
                merged["category"] = merged["category_id"]
            updates["data_quality"] = _score_record(merged, _EW)
        except Exception as e:
            logger.debug("data_quality scoring failed for '%s': %s", existing.get("title", "")[:50], e)

    if updates:
        if not writes_enabled():
            _log_write_skip(f"update events id={event_id} (smart update)")
        else:
            try:
                client = get_client()
                _update_event_record(client, event_id, updates)
                updated_fields = list(updates.keys())
                logger.info(
                    f"Smart-updated event {event_id}: {', '.join(updated_fields)} "
                    f"for '{existing_title[:50]}'"
                )
            except Exception as e:
                logger.error(f"Failed to smart-update event {event_id}: {e}")
                return False

    category = str(
        updates.get("category_id") or incoming_category or existing_category or ""
    ).strip().lower()
    event_genres = set(incoming.get("genres") or existing.get("genres") or [])
    _skip_nightlife = category == "nightlife" and bool(event_genres & _NIGHTLIFE_SKIP_GENRES)
    if category in ("music", "comedy", "nightlife", "sports") and not _skip_nightlife:
        try:
            client = get_client()
            current_artist_rows = (
                client.table("event_artists")
                .select("id,name")
                .eq("event_id", event_id)
                .order("billing_order", desc=False)
                .execute()
            )
            existing_artists = current_artist_rows.data or []

            parsed = incoming.get("_parsed_artists") or []
            if not parsed and not existing_artists and not suppress_title_participants:
                title = incoming.get("title") or existing.get("title") or ""
                parsed = parse_lineup_from_title(title)

            if parsed:
                title = incoming.get("title") or existing.get("title") or ""
                should_replace = (
                    not existing_artists
                    or (
                        bool(incoming.get("_parsed_artists"))
                        and _should_replace_placeholder_artists(
                            title, existing_artists, parsed
                        )
                    )
                )
                if should_replace:
                    upsert_event_artists(event_id, parsed)
                    logger.debug(
                        f"Backfilled {len(parsed)} artist(s) on update for event {event_id}"
                    )
        except Exception as e:
            logger.debug(f"Artist backfill on update failed for event {event_id}: {e}")

    _maybe_infer_importance(event_id, {**existing, **updates})

    return bool(updates)


# ---------------------------------------------------------------------------
# Dedup lookups
# ---------------------------------------------------------------------------

_PRESENTER_PREFIX_RE = re.compile(
    r'^(?:presents?:\s*|presented\s+by\s+.+?[-:]\s*|live\s+nation\s+presents?\s*[-:]\s*)',
    re.IGNORECASE,
)
_SPORTS_MATCHUP_SEPARATOR_RE = re.compile(
    r"\s+v(?:s)?\.?\s+",
    re.IGNORECASE,
)
_GENERIC_EVENT_URL_PATHS = {
    "/",
    "/calendar",
    "/events",
    "/event-calendar",
    "/volunteer_calendar",
    "/need",
    "/programs",
    "/schedule",
}
_SPECIFIC_EVENT_URL_PARENT_SEGMENTS = {
    "event",
    "events",
    "need",
    "opportunity",
    "opportunities",
    "show",
    "shows",
    "performance",
    "performances",
}
_GENERIC_EVENT_URL_SEGMENTS = {
    "calendar",
    "events",
    "event-calendar",
    "volunteer_calendar",
    "need",
    "programs",
    "schedule",
}
_SPECIFIC_EVENT_QUERY_KEYS = {
    "id",
    "event_id",
    "need_id",
    "eid",
    "show_id",
    "performance_id",
}


def _normalize_title_for_natural_key(title: Optional[str]) -> str:
    """Normalize title for exact-ish natural-key dedupe checks."""
    from dedupe import normalize_text

    t = title or ""
    # Strip presenter prefixes that cause cross-source dedup misses
    t = _PRESENTER_PREFIX_RE.sub('', t)
    # Collapse matchup separators so "v", "v.", and "vs." dedupe together.
    t = _SPORTS_MATCHUP_SEPARATOR_RE.sub(" vs ", t)
    return normalize_text(t)


def _is_specific_event_url(url: Optional[str]) -> bool:
    """Heuristic guard for URL-based natural-key fallback."""
    raw_url = str(url or "").strip()
    if not raw_url:
        return False

    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False

    query_keys = {key.lower() for key in parsed.query.split("&") if "=" in key for key in [key.split("=", 1)[0]]}
    if query_keys & _SPECIFIC_EVENT_QUERY_KEYS:
        return True

    path = (parsed.path or "/").rstrip("/").lower() or "/"
    if path in _GENERIC_EVENT_URL_PATHS:
        return False

    segments = [segment for segment in path.split("/") if segment]
    if not segments:
        return False

    last_segment = segments[-1]
    if last_segment in _GENERIC_EVENT_URL_SEGMENTS:
        return False

    if len(segments) >= 2 and segments[-2] in _SPECIFIC_EVENT_URL_PARENT_SEGMENTS:
        return True

    if re.search(r"\d", last_segment):
        return True

    if "-" in last_segment and len(last_segment) >= 12:
        return True

    return False


@retry_on_network_error(max_retries=3, base_delay=0.5)
def find_event_by_hash(content_hash: str) -> Optional[dict]:
    """Find event by content hash for deduplication."""
    client = get_client()
    result = (
        client.table("events").select("*").eq("content_hash", content_hash).execute()
    )
    rows = result.data or []
    if not rows:
        return None
    if events_support_is_active_column():
        for row in rows:
            if row.get("is_active") is True:
                return row
    if rows:
        return rows[0]
    return None


def prefetch_hashes(source_id: int = None, venue_id: int = None) -> set[str]:
    """Pre-fetch all content hashes for a source or venue in one query."""
    try:
        client = get_client()
        query = client.table("events").select("content_hash")
        if source_id:
            query = query.eq("source_id", source_id)
        if venue_id:
            query = query.eq("venue_id", venue_id)
        query = query.eq("is_active", True)
        result = query.execute()
        return {row["content_hash"] for row in (result.data or []) if row.get("content_hash")}
    except Exception as e:
        logger.warning(f"Failed to prefetch hashes: {e}")
        return set()


def prefetch_events_by_source(source_id: int) -> dict[str, dict]:
    """Pre-fetch all active events for a source, keyed by content_hash.

    Returns full event records so callers can pass them directly to
    smart_update_existing_event() without individual DB lookups.
    One query replaces ~1,000 individual find_event_by_hash() calls.
    """
    try:
        client = get_client()
        result = (
            client.table("events")
            .select("*")
            .eq("source_id", source_id)
            .eq("is_active", True)
            .execute()
        )
        return {
            row["content_hash"]: row
            for row in (result.data or [])
            if row.get("content_hash")
        }
    except Exception as e:
        logger.warning(f"Failed to prefetch events for source {source_id}: {e}")
        return {}


@retry_on_network_error(max_retries=3, base_delay=0.5)
def find_existing_event_by_natural_key(event_data: dict) -> Optional[dict]:
    """Find a likely duplicate event by natural key when hash lookup misses."""
    source_id = event_data.get("source_id")
    venue_id = event_data.get("venue_id")
    start_date = event_data.get("start_date")
    title = event_data.get("title")

    if not source_id or not venue_id or not start_date or not title:
        return None

    incoming_start_time = event_data.get("start_time")
    incoming_title_norm = _normalize_title_for_natural_key(title)
    if not incoming_title_norm:
        return None

    client = get_client()
    query = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("start_date", start_date)
    )

    if incoming_start_time:
        query = query.eq("start_time", incoming_start_time)
    else:
        query = query.is_("start_time", "null")

    result = query.execute()
    candidates = result.data or []
    if events_support_is_active_column():
        candidates = sorted(
            candidates, key=lambda row: row.get("is_active") is not True
        )

    for candidate in candidates:
        if (
            _normalize_title_for_natural_key(candidate.get("title"))
            == incoming_title_norm
        ):
            return candidate

    # Fallback for corrected showtimes: same source/venue/date/title, but time changed.
    fallback_query = (
        client.table("events")
        .select("*")
        .eq("source_id", source_id)
        .eq("venue_id", venue_id)
        .eq("start_date", start_date)
    )
    fallback_result = fallback_query.execute()
    fallback_candidates = fallback_result.data or []
    title_matches = [
        candidate
        for candidate in fallback_candidates
        if _normalize_title_for_natural_key(candidate.get("title")) == incoming_title_norm
    ]
    if len(title_matches) == 1:
        candidate = title_matches[0]
        candidate_start_time = candidate.get("start_time")
        if not incoming_start_time or not candidate_start_time:
            return candidate

    incoming_urls = {
        str(event_data.get("ticket_url") or "").strip(),
        str(event_data.get("source_url") or "").strip(),
    }
    incoming_urls.discard("")
    if incoming_urls:
        url_matches = []
        for candidate in title_matches:
            candidate_urls = {
                str(candidate.get("ticket_url") or "").strip(),
                str(candidate.get("source_url") or "").strip(),
            }
            candidate_urls.discard("")
            matching_urls = incoming_urls & candidate_urls
            if matching_urls and any(
                _is_specific_event_url(url) for url in matching_urls
            ):
                url_matches.append(candidate)
        if len(url_matches) == 1:
            return url_matches[0]

    return None


def find_existing_event_for_insert(event_data: dict) -> Optional[dict]:
    """Dedupe guard for insert_event."""
    title = event_data.get("title")
    venue_name = ""
    if event_data.get("venue_id"):
        venue_info = get_venue_by_id_cached(event_data["venue_id"])
        if venue_info and isinstance(venue_info, dict):
            venue_name = venue_info.get("name", "") or ""
    start_date = event_data.get("start_date")
    explicit_hash = event_data.get("content_hash")

    try:
        from dedupe import generate_content_hash_candidates

        hash_candidates = []
        if explicit_hash:
            hash_candidates.append(explicit_hash)
        hash_candidates.extend(
            generate_content_hash_candidates(title or "", venue_name, start_date)
        )
        hash_candidates = list(dict.fromkeys([h for h in hash_candidates if h]))
    except Exception:
        hash_candidates = [explicit_hash] if explicit_hash else []

    for content_hash in hash_candidates:
        existing = find_event_by_hash(content_hash)
        if existing:
            if event_data.get("content_hash") and existing.get(
                "content_hash"
            ) != event_data.get("content_hash"):
                update_event(
                    existing["id"], {"content_hash": event_data["content_hash"]}
                )
                existing["content_hash"] = event_data["content_hash"]
            return existing

    existing = find_existing_event_by_natural_key(event_data)
    if (
        existing
        and event_data.get("content_hash")
        and existing.get("content_hash") != event_data.get("content_hash")
    ):
        update_event(existing["id"], {"content_hash": event_data["content_hash"]})
        existing["content_hash"] = event_data["content_hash"]
    return existing


def _source_priority_for_dedupe(
    source_slug: Optional[str], is_active: Optional[bool] = None
) -> int:
    """Lower is better (preferred canonical source)."""
    slug = (source_slug or "").strip().lower()
    inactive_penalty = 500 if is_active is False else 0
    if not slug:
        return 200 + inactive_penalty
    if slug.endswith("-test"):
        return 300 + inactive_penalty
    if slug in _AGGREGATOR_SOURCE_SLUGS:
        return 230 + inactive_penalty
    if slug.startswith(_AGGREGATOR_SOURCE_PREFIXES):
        return 220 + inactive_penalty
    return 100 + inactive_penalty


def _candidate_quality_score(event_row: dict) -> tuple[int, int, int]:
    """Rank candidate quality for canonical selection."""
    desc_len = len((event_row.get("description") or "").strip())
    has_image = 1 if event_row.get("image_url") else 0
    has_ticket = 1 if event_row.get("ticket_url") else 0
    return (desc_len, has_image, has_ticket)


@retry_on_network_error(max_retries=3, base_delay=0.5)
def find_cross_source_canonical_for_insert(event_data: dict) -> Optional[int]:
    """Find canonical event ID for cross-source duplicate suppression."""
    source_id = event_data.get("source_id")
    venue_id = event_data.get("venue_id")
    start_date = event_data.get("start_date")
    start_time = event_data.get("start_time")
    title = event_data.get("title")

    if not source_id or not venue_id or not start_date or not title:
        return None

    incoming_title_norm = _normalize_title_for_natural_key(title)
    if not incoming_title_norm:
        return None

    client = get_client()
    has_event_active = events_support_is_active_column()
    query = (
        client.table("events")
        .select(
            "id,title,source_id,canonical_event_id,created_at,description,image_url,ticket_url,is_active"
        )
        .eq("venue_id", venue_id)
        .eq("start_date", start_date)
        .neq("source_id", source_id)
    )
    if has_event_active:
        query = query.eq("is_active", True)
    if start_time:
        query = query.eq("start_time", start_time)
    else:
        query = query.is_("start_time", "null")

    result = query.execute()
    candidates = [
        row
        for row in (result.data or [])
        if _normalize_title_for_natural_key(row.get("title")) == incoming_title_norm
    ]
    if not candidates:
        return None

    resolved: list[dict] = []
    for row in candidates:
        canonical_id = row.get("canonical_event_id")
        if canonical_id:
            canonical = (
                client.table("events")
                .select(
                    "id,source_id,created_at,description,image_url,ticket_url,is_active"
                )
                .eq("id", canonical_id)
            )
            if has_event_active:
                canonical = canonical.eq("is_active", True)
            canonical = canonical.maybe_single().execute().data
            if canonical:
                resolved.append(canonical)
                continue
        resolved.append(row)

    unique_by_id = {row["id"]: row for row in resolved if row.get("id")}
    candidates = list(unique_by_id.values())
    if not candidates:
        return None

    def _sort_key(row: dict):
        s = get_source_info(row.get("source_id")) or {}
        source_priority = _source_priority_for_dedupe(s.get("slug"), s.get("is_active"))
        quality = _candidate_quality_score(row)
        created = row.get("created_at") or ""
        return (source_priority, -quality[0], -quality[1], -quality[2], created)

    canonical = sorted(candidates, key=_sort_key)[0]
    return canonical.get("id")


@retry_on_network_error()
def remove_stale_source_events(source_id: int, current_hashes: set[str]) -> int:
    """Remove future events from a source that weren't seen in the current crawl."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = (
        client.table("events")
        .select("id,content_hash")
        .eq("source_id", source_id)
        .gte("start_date", today)
        .execute()
    )

    if not result.data:
        return 0

    stale_ids = [
        e["id"] for e in result.data if e["content_hash"] not in current_hashes
    ]

    if not stale_ids:
        return 0

    if not writes_enabled():
        _log_write_skip(
            f"delete stale events source_id={source_id} count={len(stale_ids)}"
        )
        return len(stale_ids)

    for stale_id in stale_ids:
        client.table("events").update({"canonical_event_id": None}).eq(
            "canonical_event_id", stale_id
        ).execute()

    deleted = 0
    batch_size = 50
    for i in range(0, len(stale_ids), batch_size):
        batch = stale_ids[i: i + batch_size]
        client.table("events").delete().in_("id", batch).execute()
        deleted += len(batch)

    logger.info(f"Removed {deleted} stale events from source {source_id}")
    return deleted


def find_events_by_date_and_venue(date: str, venue_id: int) -> list[dict]:
    """Find events on a specific date at a specific venue."""
    client = get_client()
    result = (
        client.table("events")
        .select("*")
        .eq("start_date", date)
        .eq("venue_id", venue_id)
        .execute()
    )
    return result.data or []


def find_events_by_date_and_venue_family(date: str, venue_id: int) -> list[dict]:
    """Find events on a specific date at a venue OR any of its sibling rooms."""
    from db.places import get_sibling_venue_ids
    client = get_client()
    sibling_ids = get_sibling_venue_ids(venue_id)

    result = (
        client.table("events")
        .select("*, venue:venues(name)")
        .eq("start_date", date)
        .in_("venue_id", sibling_ids)
        .execute()
    )

    events = []
    for event in result.data or []:
        event["venue_name"] = event.get("venue", {}).get("name", "")
        events.append(event)

    return events


def get_all_events(limit: int = 1000, offset: int = 0) -> list[dict]:
    """Fetch events with pagination."""
    client = get_client()
    result = (
        client.table("events")
        .select("*")
        .order("id")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


def update_event_tags(event_id: int, tags: list[str]) -> None:
    """Update only the tags field of an event."""
    if not writes_enabled():
        _log_write_skip(f"update events id={event_id} (tags)")
        return
    client = get_client()
    client.table("events").update({"tags": tags}).eq("id", event_id).execute()


def upsert_event_images(event_id: int, images: list) -> None:
    """Upsert images for an event."""
    if not images:
        return
    if not writes_enabled():
        _log_write_skip(f"upsert event_images event_id={event_id}")
        return

    payload = []
    seen: set[str] = set()

    for entry in images:
        if isinstance(entry, dict):
            url = entry.get("url")
            width = entry.get("width")
            height = entry.get("height")
            img_type = entry.get("type")
            source = entry.get("source")
            confidence = entry.get("confidence")
            is_primary = entry.get("is_primary", False)
        else:
            url = entry
            width = None
            height = None
            img_type = None
            source = None
            confidence = None
            is_primary = False

        if not url:
            continue
        normalized = str(url).strip()
        if not normalized:
            continue
        if normalized in seen:
            continue
        seen.add(normalized)

        payload.append(
            {
                "event_id": event_id,
                "url": normalized,
                "width": width,
                "height": height,
                "type": img_type,
                "source": source,
                "confidence": confidence,
                "is_primary": bool(is_primary),
            }
        )

    if not payload:
        return

    client = get_client()
    client.table("event_images").upsert(payload, on_conflict="event_id,url").execute()


def upsert_event_links(event_id: int, links: list) -> None:
    """Upsert links for an event (ticketing, organizer, etc.)."""
    if not links:
        return
    if not writes_enabled():
        _log_write_skip(f"upsert event_links event_id={event_id}")
        return

    payload = []
    seen: set[tuple[str, str]] = set()

    for entry in links:
        if isinstance(entry, dict):
            link_type = entry.get("type")
            url = entry.get("url")
            source = entry.get("source")
            confidence = entry.get("confidence")
        else:
            link_type = None
            url = entry
            source = None
            confidence = None

        if not link_type or not url:
            continue

        normalized_url = str(url).strip()
        normalized_type = str(link_type).strip()
        if not normalized_url or not normalized_type:
            continue

        key = (normalized_type.lower(), normalized_url)
        if key in seen:
            continue
        seen.add(key)

        payload.append(
            {
                "event_id": event_id,
                "type": normalized_type,
                "url": normalized_url,
                "source": source,
                "confidence": confidence,
            }
        )

    if not payload:
        return

    client = get_client()
    client.table("event_links").upsert(
        payload, on_conflict="event_id,type,url"
    ).execute()


def update_event_extraction_metadata(
    event_id: int,
    field_provenance: Optional[dict] = None,
    field_confidence: Optional[dict] = None,
    extraction_version: Optional[str] = None,
) -> None:
    """Update per-field provenance/confidence metadata for an event.

    Routes to event_extractions table when available, falls back to events table.
    """
    update_data: dict = {}
    if field_provenance is not None:
        update_data["field_provenance"] = field_provenance
    if field_confidence is not None:
        update_data["field_confidence"] = field_confidence
    if extraction_version is not None:
        update_data["extraction_version"] = extraction_version

    if not update_data:
        return

    if not writes_enabled():
        _log_write_skip(f"update events id={event_id} (extraction metadata)")
        return

    client = get_client()

    # Prefer the dedicated extraction table when available
    if has_event_extractions_table():
        _write_event_extraction(client, event_id, update_data)
    else:
        client.table("events").update(update_data).eq("id", event_id).execute()


def deactivate_tba_events() -> int:
    """
    Report future events that still have no start_time after enrichment.
    Returns the number of actionable TBA events still remaining.
    """
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = (
        client.table("events")
        .select("id,title,source_url,ticket_url", count="exact")
        .gte("start_date", today)
        .is_("start_time", "null")
        .eq("is_all_day", False)
        .execute()
    )

    rows = result.data or []
    actionable_count = 0
    non_actionable_count = 0
    for row in rows:
        actionable, _reason = classify_tba_event(row)
        if actionable:
            actionable_count += 1
        else:
            non_actionable_count += 1

    if actionable_count > 0:
        logger.info(
            "Found %s actionable TBA events (missing start_time) — hidden from feeds via API filter",
            actionable_count,
        )
    if non_actionable_count > 0:
        logger.info(
            "Excluded %s intentional/structural date-only rows from actionable TBA count",
            non_actionable_count,
        )

    return actionable_count
