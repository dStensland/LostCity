"""
Source queries, crawl log CRUD, and source scheduling.
"""

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from db.client import (
    get_client,
    writes_enabled,
    _next_temp_id,
    _log_write_skip,
    _SOURCE_CACHE,
)

logger = logging.getLogger(__name__)

# ===== HARDCODED FALLBACK MAPS =====

_SOURCE_PRODUCER_MAP = {
    "atlanta-film-society": "atlanta-film-society",
    "out-on-film": "out-on-film",
    "ajff": "atlanta-jewish-film",
    "atlanta-opera": "atlanta-opera",
    "atlanta-ballet": "atlanta-ballet",
    "atlanta-pride": "atlanta-pride",
    "beltline": "atlanta-beltline-inc",
    "atlanta-contemporary": "atlanta-contemporary",
    "callanwolde": "callanwolde",
    "atlanta-track-club": "atlanta-track-club",
    "arts-atl": "artsatl",
    "atlanta-cultural-affairs": "atlanta-cultural-affairs",
    "community-foundation-atl": "community-foundation-atl",
    "high-museum": "woodruff-arts",
    "decatur-arts-festival": "decatur-arts",
    "taste-of-atlanta": "taste-of-atlanta",
}

_FESTIVAL_SOURCE_OVERRIDES = {
    "dragon-con": {"festival_type": "convention"},
    "momocon": {"festival_type": "convention"},
    "fancons": {"festival_type": "convention"},
    "anime-weekend-atlanta": {"festival_type": "convention"},
    "dreamhack-atlanta": {"festival_type": "convention"},
    "blade-show": {"festival_type": "convention"},
    "conjuration": {"festival_type": "convention"},
    "furry-weekend-atlanta": {"festival_type": "convention"},
    "southern-fried-gaming-expo": {"festival_type": "convention"},
    "collect-a-con-atlanta-fall": {"festival_type": "convention"},
    "atlantacon": {"festival_type": "expo"},
    "atlanta-pen-show": {"festival_type": "expo"},
    "original-sewing-quilt-expo": {"festival_type": "expo"},
    "greater-atlanta-coin-show": {"festival_type": "expo"},
    "atlanta-toy-model-train-show": {"festival_type": "expo"},
    "verticon": {"festival_type": "conference"},
    "bellpoint-gem-show": {"festival_type": "expo"},
    "ga-mineral-society-show": {"festival_type": "expo"},
    "atlanta-bead-show": {"festival_type": "expo"},
    "atlanta-tech-week": {"festival_type": "conference"},
    "render-atl": {"festival_type": "conference"},
    "piedmont-heart-conferences": {"festival_type": "conference"},
    "shaky-knees": {"festival_name": "Shaky Knees"},
    "juneteenth-atlanta": {"festival_name": "Juneteenth Atlanta"},
    "a3c-festival": {"festival_name": "A3C Festival & Conference", "festival_type": "conference"},
    "ajff": {"festival_name": "Atlanta Jewish Film Festival"},
    "atlanta-dogwood": {"festival_name": "Atlanta Dogwood Festival"},
    "atlanta-food-wine": {"festival_name": "Atlanta Food & Wine Festival"},
    "buried-alive": {"festival_name": "Buried Alive Film Festival"},
    "candler-park-fest": {"festival_name": "Candler Park Fall Fest"},
    "grant-park-festival": {"festival_name": "Grant Park Summer Shade Festival"},
    "music-midtown": {"festival_name": "Music Midtown"},
    "bronzelens": {"festival_name": "BronzeLens Film Festival"},
    "elevate-atl-art": {"festival_name": "Elevate Atlanta"},
    "piedmont-park-arts-festival": {"force_event_model": True},
    "national-black-arts-festival": {"force_event_model": True},
    "native-american-festival-and-pow-wow": {"force_event_model": True},
    "one-musicfest": {"force_event_model": True},
    "sweetwater-420-fest": {"force_event_model": True},
    "bluesberry-norcross": {"force_event_model": True},
    "conyers-cherry-blossom": {"force_event_model": True},
    "decatur-watchfest": {"force_event_model": True},
    "ga-renaissance-festival": {"force_event_model": True},
    "blue-ridge-trout-fest": {"force_event_model": True},
    "breakaway-atlanta": {"force_event_model": True},
    "esfna-atlanta": {"force_event_model": True},
    "221b-con": {"force_event_model": True},
    "fifa-fan-festival-atlanta": {"force_event_model": True},
    "atlanta-expo-centers": {"force_event_model": True},
}

_FESTIVAL_SOURCE_SLUGS = {
    "atlanta-film-festival", "atlanta-jazz-festival", "decatur-arts-festival",
    "decatur-book-festival", "grant-park-festival", "inman-park-festival",
    "shaky-knees", "atlanta-dogwood", "atlanta-food-wine", "sweet-auburn-springfest",
    "candler-park-fest", "east-atlanta-strut", "peachtree-road-race", "atlanta-pride",
    "out-on-film", "ajff", "buried-alive",
    "dragon-con", "momocon", "music-midtown", "one-musicfest",
    "southern-fried-queer-pride", "dreamhack-atlanta",
    "ga-renaissance-festival", "imagine-music-festival", "a3c-festival",
    "afropunk-atlanta", "japanfest-atlanta", "atlanta-greek-festival",
    "juneteenth-atlanta", "stone-mountain-highland-games",
    "atlanta-tattoo-arts-festival", "blade-show", "furry-weekend-atlanta",
    "southern-fried-gaming-expo", "anime-weekend-atlanta",
    "atlanta-salsa-bachata-festival", "bronzelens", "elevate-atl-art",
}

_FESTIVAL_NAME_PATTERN = re.compile(
    r"\b(festival|fest|conference|convention|summit|symposium|expo|week)\b",
    re.IGNORECASE,
)
_FESTIVAL_CONFERENCE_PATTERN = re.compile(
    r"\b(conference|summit|symposium|forum|congress)\b",
    re.IGNORECASE,
)
_FESTIVAL_CONVENTION_PATTERN = re.compile(
    r"\b(convention|expo|con)\b",
    re.IGNORECASE,
)
_PROGRAM_TITLE_KEYWORDS = {
    "track", "program", "stage", "room", "hall", "session", "panel", "workshop",
    "keynote", "talk", "lecture", "summit", "forum", "expo", "screening", "showcase",
}


def infer_festival_type_from_name(name: Optional[str]) -> Optional[str]:
    """Infer festival type (conference vs convention) from name."""
    if not name:
        return None
    if _FESTIVAL_CONFERENCE_PATTERN.search(name):
        return "conference"
    if _FESTIVAL_CONVENTION_PATTERN.search(name):
        return "convention"
    return None


def get_festival_source_hint(
    source_slug: Optional[str], source_name: Optional[str]
) -> Optional[dict]:
    """Return festival metadata hint if the source looks like a festival/conference."""
    slug = source_slug or ""
    if slug in _FESTIVAL_SOURCE_OVERRIDES:
        override = _FESTIVAL_SOURCE_OVERRIDES.get(slug, {})
        if override.get("force_event_model"):
            return None
    if slug in _FESTIVAL_SOURCE_OVERRIDES or slug in _FESTIVAL_SOURCE_SLUGS:
        override = _FESTIVAL_SOURCE_OVERRIDES.get(slug, {})
        name = override.get("festival_name") or source_name
        return {
            "festival_name": name,
            "festival_type": override.get("festival_type") or infer_festival_type_from_name(name),
        }

    if source_name and _FESTIVAL_NAME_PATTERN.search(source_name):
        return {
            "festival_name": source_name,
            "festival_type": infer_festival_type_from_name(source_name),
        }

    return None


def infer_program_title(title: Optional[str]) -> Optional[str]:
    """Infer a program/track title from an event title."""
    if not title:
        return None
    separators = [" - ", ": ", " | "]
    for sep in separators:
        if sep not in title:
            continue
        left, right = title.split(sep, 1)
        left = left.strip()
        right = right.strip()
        if not left or not right:
            continue
        if len(left) < 4 or len(left) > 60:
            continue
        if any(keyword in left.lower() for keyword in _PROGRAM_TITLE_KEYWORDS):
            return left
    return None


# ===== SOURCE QUERIES =====

def get_source_info(source_id: int) -> Optional[dict]:
    """Fetch source info with caching."""
    if source_id in _SOURCE_CACHE:
        return _SOURCE_CACHE[source_id]

    client = get_client()
    try:
        result = (
            client.table("sources")
            .select(
                "id, slug, name, url, owner_portal_id, producer_id, is_sensitive, is_active, integration_method"
            )
            .eq("id", source_id)
            .execute()
        )
    except Exception:
        try:
            result = (
                client.table("sources")
                .select(
                    "id, slug, name, url, owner_portal_id, is_sensitive, is_active, integration_method"
                )
                .eq("id", source_id)
                .execute()
            )
        except Exception:
            try:
                result = (
                    client.table("sources")
                    .select(
                        "id, slug, name, url, owner_portal_id, is_active, integration_method"
                    )
                    .eq("id", source_id)
                    .execute()
                )
            except Exception:
                try:
                    result = (
                        client.table("sources")
                        .select("id, slug, name, url, owner_portal_id, is_active")
                        .eq("id", source_id)
                        .execute()
                    )
                except Exception:
                    result = (
                        client.table("sources")
                        .select("id, slug, name, url, owner_portal_id")
                        .eq("id", source_id)
                        .execute()
                    )
    if result.data:
        _SOURCE_CACHE[source_id] = result.data[0]
        return result.data[0]
    return None


def get_source_by_slug(slug: str) -> Optional[dict]:
    """Fetch a source by its slug."""
    client = get_client()
    result = client.table("sources").select("*").eq("slug", slug).single().execute()
    return result.data


def get_portal_id_by_slug(slug: str) -> Optional[str]:
    """Fetch a portal's UUID by its slug."""
    client = get_client()
    result = client.table("portals").select("id").eq("slug", slug).single().execute()
    if result.data:
        return result.data["id"]
    return None


def get_active_sources() -> list[dict]:
    """Fetch all active sources."""
    client = get_client()
    result = client.table("sources").select("*").eq("is_active", True).execute()
    return result.data or []


def get_producer_id_for_source(source_id: int) -> Optional[str]:
    """Get the producer_id associated with a source, if any."""
    source_info = get_source_info(source_id)
    if source_info:
        producer_id = source_info.get("producer_id")
        if producer_id:
            return producer_id

    try:
        if source_info and source_info.get("slug"):
            return _SOURCE_PRODUCER_MAP.get(source_info["slug"])

        client = get_client()
        result = client.table("sources").select("slug").eq("id", source_id).execute()
        if result.data:
            slug = result.data[0].get("slug")
            if slug:
                return _SOURCE_PRODUCER_MAP.get(slug)
    except Exception:
        pass

    return None


# ===== CRAWL LOG CRUD =====

def create_crawl_log(source_id: int) -> int:
    """Create a new crawl log entry. Returns log ID."""
    if not writes_enabled():
        _log_write_skip(f"insert crawl_logs source_id={source_id}")
        return _next_temp_id()

    client = get_client()
    result = (
        client.table("crawl_logs")
        .insert(
            {
                "source_id": source_id,
                "started_at": datetime.utcnow().isoformat(),
                "status": "running",
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def update_crawl_log(
    log_id: int,
    status: str,
    events_found: int = 0,
    events_new: int = 0,
    events_updated: int = 0,
    events_rejected: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Update crawl log with results."""
    if not writes_enabled():
        _log_write_skip(f"update crawl_logs id={log_id}")
        return

    client = get_client()

    update_data = {
        "completed_at": datetime.utcnow().isoformat(),
        "status": status,
        "events_found": events_found,
        "events_new": events_new,
        "events_updated": events_updated,
    }

    if error_message:
        update_data["error_message"] = error_message
    elif status != "error":
        update_data["error_message"] = None

    update_data["events_rejected"] = events_rejected

    client.table("crawl_logs").update(update_data).eq("id", log_id).execute()


def update_source_last_crawled(source_id: int) -> None:
    """Set last_crawled_at = NOW() for a source after successful crawl."""
    if not writes_enabled():
        _log_write_skip(f"update sources id={source_id} (last_crawled_at)")
        return

    client = get_client()
    client.table("sources").update(
        {"last_crawled_at": datetime.utcnow().isoformat()}
    ).eq("id", source_id).execute()


def update_expected_event_count(source_id: int, events_found: int) -> None:
    """Update rolling average of expected event count for zero-event detection."""
    if not writes_enabled():
        _log_write_skip(f"update sources id={source_id} (expected_event_count)")
        return

    client = get_client()
    result = (
        client.table("sources")
        .select("expected_event_count")
        .eq("id", source_id)
        .execute()
    )
    old = None
    if result.data:
        old = result.data[0].get("expected_event_count")

    if old is None:
        new_count = events_found
    else:
        new_count = int(0.7 * old + 0.3 * events_found)

    client.table("sources").update({"expected_event_count": new_count}).eq(
        "id", source_id
    ).execute()


def get_sources_due_for_crawl() -> list[dict]:
    """Fetch active sources that are due for a crawl based on crawl_frequency."""
    client = get_client()
    sources = client.table("sources").select("*").eq("is_active", True).execute()
    all_sources = sources.data or []

    now = datetime.utcnow()
    thresholds = {
        "daily": timedelta(hours=20),
        "twice_weekly": timedelta(days=3),
        "weekly": timedelta(days=6, hours=12),
        "monthly": timedelta(days=28),
    }

    due = []
    for source in all_sources:
        freq = source.get("crawl_frequency") or "daily"
        threshold = thresholds.get(freq, thresholds["daily"])
        last = source.get("last_crawled_at")

        if last is None:
            due.append(source)
            continue

        if isinstance(last, str):
            last_str = last.replace("Z", "+00:00")
            try:
                last_dt = datetime.fromisoformat(last_str).replace(tzinfo=None)
            except ValueError:
                due.append(source)
                continue
        else:
            last_dt = last

        if (now - last_dt) > threshold:
            due.append(source)

    return due


def get_sources_by_cadence(cadence: str) -> list[dict]:
    """Fetch all active sources with a specific crawl_frequency."""
    client = get_client()
    result = (
        client.table("sources")
        .select("*")
        .eq("is_active", True)
        .eq("crawl_frequency", cadence)
        .execute()
    )
    return result.data or []


def refresh_available_filters() -> bool:
    """Refresh the available_filters table with current filter options."""
    if not writes_enabled():
        _log_write_skip("rpc refresh_available_filters")
        return True

    client = get_client()
    try:
        client.rpc("refresh_available_filters").execute()
        return True
    except Exception as e:
        print(f"Error refreshing available filters: {e}")
        return False


def refresh_search_suggestions(city: Optional[str] = None) -> bool:
    """Incrementally refresh the autocomplete corpus after crawl writes."""
    if not writes_enabled():
        suffix = f" city={city}" if city else ""
        _log_write_skip(f"rpc refresh_search_suggestions_incremental{suffix}")
        return True

    client = get_client()
    try:
        payload = {"p_city": city} if city else {}
        client.rpc("refresh_search_suggestions_incremental", payload).execute()
        return True
    except Exception as e:
        print(f"Error refreshing search suggestions: {e}")
        return False


def update_source_health_tags(
    source_id: int, health_tags: list[str], active_months: Optional[list[int]] = None
) -> bool:
    """Update the health_tags and optionally active_months for a source."""
    if not writes_enabled():
        _log_write_skip(f"update sources id={source_id} (health tags)")
        return True

    client = get_client()
    try:
        update_data = {"health_tags": health_tags}
        if active_months is not None:
            update_data["active_months"] = active_months
        client.table("sources").update(update_data).eq("id", source_id).execute()
        return True
    except Exception as e:
        print(f"Error updating source health tags: {e}")
        return False


def get_source_health_tags(source_id: int) -> tuple[list[str], Optional[list[int]]]:
    """Get the current health_tags and active_months for a source."""
    client = get_client()
    try:
        result = (
            client.table("sources")
            .select("health_tags, active_months")
            .eq("id", source_id)
            .execute()
        )
        if result.data and len(result.data) > 0:
            return (
                result.data[0].get("health_tags") or [],
                result.data[0].get("active_months"),
            )
    except Exception:
        pass
    return [], None


def detect_zero_event_sources() -> tuple[int, list[str]]:
    """Detect and auto-deactivate sources with persistent zero-event crawls."""
    client = get_client()

    result = (
        client.table("sources")
        .select("id, slug, expected_event_count, health_tags")
        .eq("is_active", True)
        .gt("expected_event_count", 5)
        .execute()
    )
    candidates = result.data or []

    deactivated_slugs = []

    for source in candidates:
        logs = (
            client.table("crawl_logs")
            .select("events_found")
            .eq("source_id", source["id"])
            .eq("status", "success")
            .order("completed_at", desc=True)
            .limit(3)
            .execute()
        )
        log_data = logs.data or []

        if len(log_data) < 3:
            continue

        if all(log.get("events_found", 0) == 0 for log in log_data):
            existing_tags = source.get("health_tags") or []
            if "zero-events-deactivated" not in existing_tags:
                existing_tags.append("zero-events-deactivated")

            if not writes_enabled():
                _log_write_skip(
                    f"update sources id={source['id']} (auto-deactivate zero-events)"
                )
                deactivated_slugs.append(source["slug"])
                continue

            client.table("sources").update(
                {
                    "is_active": False,
                    "health_tags": existing_tags,
                }
            ).eq("id", source["id"]).execute()

            deactivated_slugs.append(source["slug"])
            logger.warning(
                f"Auto-deactivated source '{source['slug']}': "
                f"3 consecutive zero-event crawls (expected ~{source['expected_event_count']})"
            )

    return len(deactivated_slugs), deactivated_slugs
