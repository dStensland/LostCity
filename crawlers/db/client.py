"""
Supabase client, retry decorator, write mode control, and schema detection flags.
"""

import re
import time
import logging
import functools
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from supabase import create_client, Client
from config import get_config

logger = logging.getLogger(__name__)

# ===== TITLE CASE HELPER =====
_SMALL_WORDS = {
    "a", "an", "the", "and", "but", "or", "for", "nor",
    "on", "at", "to", "in", "of", "by", "is", "vs",
}


def smart_title_case(text: str) -> str:
    """Title-case that correctly handles apostrophes and small words."""
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    words = text.lower().split()
    result = []
    for i, word in enumerate(words):
        if "'" in word:
            parts = word.split("'")
            parts[0] = parts[0].capitalize()
            result.append("'".join(parts))
        elif i == 0 or word not in _SMALL_WORDS:
            result.append(word.capitalize())
        else:
            result.append(word)
    return " ".join(result)


# ===== IMAGE / SOURCE URL NORMALIZERS =====

_DOUBLED_HOSTNAME_RE = re.compile(r"^https?://[^/]+(?:https?://.*)", re.IGNORECASE)


def _normalize_image_url(url: Optional[str]) -> Optional[str]:
    """Normalize an image URL before DB insert/update."""
    if not url or not url.strip():
        return None

    url = url.strip()

    if url.startswith("//"):
        url = "https:" + url

    m = _DOUBLED_HOSTNAME_RE.match(url)
    if m:
        idx = url.index("http", 1)
        url = url[idx:]

    if not url.startswith("http"):
        return None

    if "{width}" in url or "{height}" in url:
        return None

    if "bping.php" in url:
        return None

    return url


def _normalize_source_url(url: Optional[str]) -> Optional[str]:
    """Normalize event/source URLs and reject non-http(s) values."""
    if not url:
        return None
    try:
        value = str(url).strip()
    except Exception:
        return None
    if not value:
        return None
    if value.startswith("//"):
        value = "https:" + value
    if _DOUBLED_HOSTNAME_RE.match(value):
        try:
            idx = value.index("http", 1)
            value = value[idx:]
        except ValueError:
            return None
    if not re.match(r"^https?://", value, re.IGNORECASE):
        return None
    return value


# ===== VALIDATION STATISTICS TRACKING =====

class ValidationStats:
    """Track validation statistics during a crawl run."""

    def __init__(self):
        self.total_validated = 0
        self.passed = 0
        self.rejected = 0
        self.warnings = 0
        self.rejection_reasons = {}
        self.warning_types = {}

    def record_rejection(self, reason: str):
        self.rejected += 1
        self.rejection_reasons[reason] = self.rejection_reasons.get(reason, 0) + 1

    def record_warning(self, warning_type: str):
        self.warnings += 1
        self.warning_types[warning_type] = self.warning_types.get(warning_type, 0) + 1

    def record_pass(self):
        self.passed += 1

    def get_summary(self) -> str:
        lines = [
            f"Validation: {self.passed} passed, {self.rejected} rejected, {self.warnings} warnings"
        ]
        if self.rejection_reasons:
            lines.append("Rejections:")
            for reason, count in sorted(self.rejection_reasons.items(), key=lambda x: -x[1]):
                lines.append(f"  - {reason}: {count}")
        if self.warning_types:
            lines.append("Warnings:")
            for wtype, count in sorted(self.warning_types.items(), key=lambda x: -x[1]):
                lines.append(f"  - {wtype}: {count}")
        return "\n".join(lines)


_thread_local = threading.local()


def reset_validation_stats():
    """Reset validation statistics for a new crawl run (per-thread)."""
    _thread_local.validation_stats = ValidationStats()


def get_validation_stats() -> ValidationStats:
    """Get current validation statistics (per-thread)."""
    if not hasattr(_thread_local, "validation_stats"):
        _thread_local.validation_stats = ValidationStats()
    return _thread_local.validation_stats


class _ValidationStatsProxy:
    """Proxy that delegates attribute access to the thread-local ValidationStats."""

    def __getattr__(self, name):
        return getattr(get_validation_stats(), name)


_validation_stats = _ValidationStatsProxy()


# ===== MODULE-LEVEL STATE =====

_client: Optional[Client] = None
_SOURCE_CACHE: dict[int, dict] = {}
_VENUE_CACHE: dict[int, dict] = {}
_BLURHASH_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="blurhash")
_EVENTS_HAS_SHOW_SIGNAL_COLUMNS: Optional[bool] = None
_EVENTS_HAS_IS_SHOW_COLUMN: Optional[bool] = None
_EVENTS_HAS_FILM_IDENTITY_COLUMNS: Optional[bool] = None
_EVENTS_HAS_CONTENT_KIND_COLUMN: Optional[bool] = None
_EVENTS_HAS_FIELD_METADATA_COLUMNS: Optional[bool] = None
_EVENTS_HAS_IS_ACTIVE_COLUMN: Optional[bool] = None
_EVENTS_HAS_TAXONOMY_V2_COLUMNS: Optional[bool] = None
_VENUES_HAS_FEATURES_TABLE: Optional[bool] = None
_VENUES_HAS_DESTINATION_DETAILS_TABLE: Optional[bool] = None
_VENUES_HAS_LOCATION_DESIGNATOR: Optional[bool] = None
_HAS_EVENT_EXTRACTIONS_TABLE: Optional[bool] = None
_HAS_SCREENING_TABLES: Optional[bool] = None
_WRITES_ENABLED = True
_WRITE_SKIP_REASON = ""
_TEMP_ID_COUNTER = 0
_TEMP_ID_LOCK = threading.Lock()


def configure_write_mode(enable_writes: bool, reason: str = "") -> None:
    """Configure runtime write mode for crawler operations."""
    global _WRITES_ENABLED, _WRITE_SKIP_REASON
    _WRITES_ENABLED = enable_writes
    _WRITE_SKIP_REASON = reason.strip()


def writes_enabled() -> bool:
    """Return True when DB writes are allowed for this process."""
    return _WRITES_ENABLED


def _next_temp_id() -> int:
    """Return a negative synthetic ID for dry-run inserts."""
    global _TEMP_ID_COUNTER
    with _TEMP_ID_LOCK:
        _TEMP_ID_COUNTER -= 1
        return _TEMP_ID_COUNTER


def _log_write_skip(operation: str) -> None:
    """Emit a consistent log line when a DB write is skipped."""
    suffix = f" ({_WRITE_SKIP_REASON})" if _WRITE_SKIP_REASON else ""
    logger.info(f"[DRY RUN] Skipping DB write: {operation}{suffix}")


def reset_client() -> None:
    """Reset cached DB client and per-process caches."""
    global _client, _EVENTS_HAS_SHOW_SIGNAL_COLUMNS, _EVENTS_HAS_IS_SHOW_COLUMN, _EVENTS_HAS_FILM_IDENTITY_COLUMNS
    global _EVENTS_HAS_CONTENT_KIND_COLUMN, _EVENTS_HAS_FIELD_METADATA_COLUMNS
    global _EVENTS_HAS_IS_ACTIVE_COLUMN, _VENUES_HAS_FEATURES_TABLE
    global _VENUES_HAS_DESTINATION_DETAILS_TABLE, _HAS_SCREENING_TABLES
    _client = None
    _EVENTS_HAS_SHOW_SIGNAL_COLUMNS = None
    _EVENTS_HAS_IS_SHOW_COLUMN = None
    _EVENTS_HAS_FILM_IDENTITY_COLUMNS = None
    _EVENTS_HAS_CONTENT_KIND_COLUMN = None
    _EVENTS_HAS_FIELD_METADATA_COLUMNS = None
    _EVENTS_HAS_IS_ACTIVE_COLUMN = None
    _VENUES_HAS_FEATURES_TABLE = None
    _VENUES_HAS_DESTINATION_DETAILS_TABLE = None
    _HAS_SCREENING_TABLES = None
    _SOURCE_CACHE.clear()
    _VENUE_CACHE.clear()


def retry_on_network_error(max_retries: int = 3, base_delay: float = 0.5):
    """Decorator to retry database operations on transient network errors."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except OSError as e:
                    if e.errno in (35, 11) or "Resource temporarily unavailable" in str(e):
                        last_error = e
                        delay = base_delay * (2 ** attempt)
                        logger.debug(
                            f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(delay)
                    else:
                        raise
                except Exception as e:
                    error_str = str(e).lower()
                    if (
                        "resource temporarily unavailable" in error_str
                        or "connection reset" in error_str
                        or "connectionterminated" in error_str
                        or "compression_error" in error_str
                        or "protocol_error" in error_str
                        or "remoteprotocolerror" in error_str
                    ):
                        last_error = e
                        delay = base_delay * (2 ** attempt)
                        # HTTP/2 connection died — reset client so retry gets a fresh connection
                        if "connectionterminated" in error_str or "protocol_error" in error_str:
                            reset_client()
                        logger.debug(
                            f"Network error in {func.__name__}, retrying in {delay}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(delay)
                    else:
                        raise
            raise last_error

        return wrapper

    return decorator


def get_client() -> Client:
    """Get or create Supabase client."""
    global _client
    if _client is None:
        cfg = get_config()
        missing_credentials = cfg.database.missing_active_credentials()
        if missing_credentials:
            missing_display = ", ".join(missing_credentials)
            raise RuntimeError(
                f"Missing DB credentials for target '{cfg.database.active_target}': {missing_display}"
            )
        _client = create_client(
            cfg.database.active_supabase_url,
            cfg.database.active_supabase_service_key,
        )
    return _client


# ===== SCHEMA DETECTION =====

def events_support_show_signal_columns() -> bool:
    """Detect whether first-class show metadata columns exist on events."""
    global _EVENTS_HAS_SHOW_SIGNAL_COLUMNS
    if _EVENTS_HAS_SHOW_SIGNAL_COLUMNS is not None:
        return _EVENTS_HAS_SHOW_SIGNAL_COLUMNS

    client = get_client()
    try:
        client.table("events").select(
            "doors_time,age_policy,ticket_status,reentry_policy,set_times_mentioned"
        ).limit(1).execute()
        _EVENTS_HAS_SHOW_SIGNAL_COLUMNS = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and (
            "doors_time" in error_str
            or "age_policy" in error_str
            or "ticket_status" in error_str
            or "reentry_policy" in error_str
            or "set_times_mentioned" in error_str
        ):
            _EVENTS_HAS_SHOW_SIGNAL_COLUMNS = False
            logger.warning(
                "events table missing show signal columns; run migration 20260216110000_event_show_signal_columns.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_SHOW_SIGNAL_COLUMNS)


def events_support_is_show_column() -> bool:
    """Detect whether events.is_show exists."""
    global _EVENTS_HAS_IS_SHOW_COLUMN
    if _EVENTS_HAS_IS_SHOW_COLUMN is not None:
        return _EVENTS_HAS_IS_SHOW_COLUMN

    client = get_client()
    try:
        client.table("events").select("is_show").limit(1).execute()
        _EVENTS_HAS_IS_SHOW_COLUMN = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and "is_show" in error_str:
            _EVENTS_HAS_IS_SHOW_COLUMN = False
            logger.warning(
                "events.is_show missing; run migration 20260330010001_event_is_show.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_IS_SHOW_COLUMN)


def events_support_film_identity_columns() -> bool:
    """Detect whether dedicated film identity columns exist on events."""
    global _EVENTS_HAS_FILM_IDENTITY_COLUMNS
    if _EVENTS_HAS_FILM_IDENTITY_COLUMNS is not None:
        return _EVENTS_HAS_FILM_IDENTITY_COLUMNS

    client = get_client()
    try:
        client.table("events").select(
            "film_title,film_release_year,film_imdb_id,film_external_genres,film_identity_source"
        ).limit(1).execute()
        _EVENTS_HAS_FILM_IDENTITY_COLUMNS = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and (
            "film_title" in error_str
            or "film_release_year" in error_str
            or "film_imdb_id" in error_str
            or "film_external_genres" in error_str
            or "film_identity_source" in error_str
        ):
            _EVENTS_HAS_FILM_IDENTITY_COLUMNS = False
            logger.warning(
                "events table missing film identity columns; run migration 225_film_identity_fields.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_FILM_IDENTITY_COLUMNS)


def events_support_content_kind_column() -> bool:
    """Detect whether events.content_kind exists."""
    global _EVENTS_HAS_CONTENT_KIND_COLUMN
    if _EVENTS_HAS_CONTENT_KIND_COLUMN is not None:
        return _EVENTS_HAS_CONTENT_KIND_COLUMN

    client = get_client()
    try:
        client.table("events").select("content_kind").limit(1).execute()
        _EVENTS_HAS_CONTENT_KIND_COLUMN = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and "content_kind" in error_str:
            _EVENTS_HAS_CONTENT_KIND_COLUMN = False
            logger.warning(
                "events.content_kind missing; run migration 230_event_content_kind.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_CONTENT_KIND_COLUMN)


def venues_support_features_table() -> bool:
    """Detect whether the venue_features table exists."""
    global _VENUES_HAS_FEATURES_TABLE
    if _VENUES_HAS_FEATURES_TABLE is not None:
        return _VENUES_HAS_FEATURES_TABLE

    client = get_client()
    try:
        client.table("venue_features").select("id").limit(1).execute()
        _VENUES_HAS_FEATURES_TABLE = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str or "relation" in error_str:
            _VENUES_HAS_FEATURES_TABLE = False
            logger.warning(
                "venue_features table missing; run migration 275_venue_features.sql"
            )
        else:
            raise

    return bool(_VENUES_HAS_FEATURES_TABLE)


def venues_support_destination_details_table() -> bool:
    """Detect whether the venue_destination_details table exists."""
    global _VENUES_HAS_DESTINATION_DETAILS_TABLE
    if _VENUES_HAS_DESTINATION_DETAILS_TABLE is not None:
        return _VENUES_HAS_DESTINATION_DETAILS_TABLE

    client = get_client()
    try:
        client.table("venue_destination_details").select("place_id").limit(1).execute()
        _VENUES_HAS_DESTINATION_DETAILS_TABLE = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str or "relation" in error_str:
            _VENUES_HAS_DESTINATION_DETAILS_TABLE = False
            logger.warning(
                "venue_destination_details table missing; run migrations 500_venue_destination_details.sql and 503_destination_details_contract.sql"
            )
        else:
            raise

    return bool(_VENUES_HAS_DESTINATION_DETAILS_TABLE)


def events_support_is_active_column() -> bool:
    """Detect whether events.is_active exists."""
    global _EVENTS_HAS_IS_ACTIVE_COLUMN
    if _EVENTS_HAS_IS_ACTIVE_COLUMN is not None:
        return _EVENTS_HAS_IS_ACTIVE_COLUMN

    client = get_client()
    try:
        client.table("events").select("is_active").limit(1).execute()
        _EVENTS_HAS_IS_ACTIVE_COLUMN = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and "is_active" in error_str:
            _EVENTS_HAS_IS_ACTIVE_COLUMN = False
            logger.warning(
                "events.is_active missing; run migration 267_events_is_active.sql"
            )
        else:
            raise

    return bool(_EVENTS_HAS_IS_ACTIVE_COLUMN)


def events_support_field_metadata_columns() -> bool:
    """Detect whether events.field_provenance and events.field_confidence exist."""
    global _EVENTS_HAS_FIELD_METADATA_COLUMNS
    if _EVENTS_HAS_FIELD_METADATA_COLUMNS is not None:
        return _EVENTS_HAS_FIELD_METADATA_COLUMNS

    client = get_client()
    try:
        client.table("events").select("field_provenance,field_confidence").limit(1).execute()
        _EVENTS_HAS_FIELD_METADATA_COLUMNS = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and (
            "field_provenance" in error_str or "field_confidence" in error_str
        ):
            _EVENTS_HAS_FIELD_METADATA_COLUMNS = False
            logger.warning(
                "events metadata columns missing; field_provenance/field_confidence enrichment disabled."
            )
        else:
            raise

    return bool(_EVENTS_HAS_FIELD_METADATA_COLUMNS)


def venues_support_location_designator() -> bool:
    """Detect whether venues.location_designator exists."""
    global _VENUES_HAS_LOCATION_DESIGNATOR
    if _VENUES_HAS_LOCATION_DESIGNATOR is not None:
        return _VENUES_HAS_LOCATION_DESIGNATOR

    client = get_client()
    try:
        client.table("places").select("location_designator").limit(1).execute()
        _VENUES_HAS_LOCATION_DESIGNATOR = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str and "location_designator" in error_str:
            _VENUES_HAS_LOCATION_DESIGNATOR = False
            logger.warning(
                "venues.location_designator missing; run migration 227_venue_location_designator.sql"
            )
        else:
            raise
    return bool(_VENUES_HAS_LOCATION_DESIGNATOR)


def has_event_extractions_table() -> bool:
    """Detect whether the event_extractions table exists."""
    global _HAS_EVENT_EXTRACTIONS_TABLE
    if _HAS_EVENT_EXTRACTIONS_TABLE is not None:
        return _HAS_EVENT_EXTRACTIONS_TABLE

    client = get_client()
    try:
        client.table("event_extractions").select("event_id").limit(1).execute()
        _HAS_EVENT_EXTRACTIONS_TABLE = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str or "relation" in error_str:
            _HAS_EVENT_EXTRACTIONS_TABLE = False
            logger.info(
                "event_extractions table not found; extraction data stays on events table."
            )
        else:
            raise

    return bool(_HAS_EVENT_EXTRACTIONS_TABLE)


def venues_support_destination_details_table() -> bool:
    """Detect whether the venue_destination_details table exists."""
    global _VENUES_HAS_DESTINATION_DETAILS_TABLE
    if _VENUES_HAS_DESTINATION_DETAILS_TABLE is not None:
        return _VENUES_HAS_DESTINATION_DETAILS_TABLE

    client = get_client()
    try:
        client.table("venue_destination_details").select("place_id").limit(1).execute()
        _VENUES_HAS_DESTINATION_DETAILS_TABLE = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str or "relation" in error_str:
            _VENUES_HAS_DESTINATION_DETAILS_TABLE = False
            logger.warning(
                "venue_destination_details table missing; run migrations 500_venue_destination_details.sql and 503_destination_details_contract.sql"
            )
        else:
            raise

    return bool(_VENUES_HAS_DESTINATION_DETAILS_TABLE)


def screenings_support_tables() -> bool:
    """Detect whether additive screening storage tables exist."""
    global _HAS_SCREENING_TABLES
    if _HAS_SCREENING_TABLES is not None:
        return _HAS_SCREENING_TABLES

    client = get_client()
    try:
        client.table("screening_runs").select("id").limit(1).execute()
        client.table("screening_titles").select("id").limit(1).execute()
        client.table("screening_times").select("id").limit(1).execute()
        _HAS_SCREENING_TABLES = True
    except Exception as e:
        error_str = str(e).lower()
        if "does not exist" in error_str or "relation" in error_str:
            _HAS_SCREENING_TABLES = False
            logger.warning(
                "screening storage tables missing; run migration 602_screening_storage.sql"
            )
        else:
            raise

    return bool(_HAS_SCREENING_TABLES)


def events_support_taxonomy_v2_columns() -> bool:
    """Detect whether taxonomy v2 derived columns exist on events."""
    global _EVENTS_HAS_TAXONOMY_V2_COLUMNS
    if _EVENTS_HAS_TAXONOMY_V2_COLUMNS is not None:
        return _EVENTS_HAS_TAXONOMY_V2_COLUMNS
    client = get_client()
    try:
        client.table("events").select(
            "classification_prompt_version,duration,significance"
        ).limit(1).execute()
        _EVENTS_HAS_TAXONOMY_V2_COLUMNS = True
    except Exception:
        _EVENTS_HAS_TAXONOMY_V2_COLUMNS = False
    return _EVENTS_HAS_TAXONOMY_V2_COLUMNS


def _error_indicates_missing_relation(exc: Exception) -> bool:
    """Return True when an exception signals a missing table or column.

    Covers both Supabase REST PGRST205 schema-cache misses and direct Postgres
    'relation does not exist' / 'column does not exist' messages.
    """
    error_str = str(exc).lower()
    missing_keywords = (
        "does not exist",
        "relation",
        "pgrst205",
        "could not find the table",
        "column",
        "schema cache",
    )
    return any(kw in error_str for kw in missing_keywords)
