"""
db package — re-export of all public symbols.

Module rename history (Task 8 — places refactor):
  venues.py            -> places.py
  venue_validation.py  -> place_validation.py
  venue_occasions.py   -> place_occasions.py
  venue_specials.py    -> place_specials.py
  destination_details.py -> place_vertical.py
"""

# ===== client.py =====
from db.client import (
    smart_title_case,
    _normalize_image_url,
    _normalize_source_url,
    ValidationStats,
    reset_validation_stats,
    get_validation_stats,
    _ValidationStatsProxy,
    _validation_stats,
    configure_write_mode,
    writes_enabled,
    _next_temp_id,
    _log_write_skip,
    reset_client,
    retry_on_network_error,
    get_client,
    events_support_show_signal_columns,
    events_support_is_show_column,
    events_support_film_identity_columns,
    events_support_content_kind_column,
    venues_support_features_table,
    events_support_is_active_column,
    events_support_field_metadata_columns,
    venues_support_location_designator,
    has_event_extractions_table,
    venues_support_destination_details_table,
    events_support_taxonomy_v2_columns,
    # module-level state (needed by scripts that directly access them)
    _SOURCE_CACHE,
    _VENUE_CACHE,
    _BLURHASH_EXECUTOR,
)

# ===== validation.py =====
from db.validation import (
    PROHIBITED_SOURCE_DOMAINS,
    _reject_aggregator_source_url,
    sanitize_text,
    validate_event,
    validate_event_title,
    normalize_category,
    _CONTENT_KIND_ALLOWED,
    infer_content_kind,
)

# ===== sources.py =====
from db.sources import (
    _SOURCE_PRODUCER_MAP,
    _FESTIVAL_SOURCE_OVERRIDES,
    _FESTIVAL_SOURCE_SLUGS,
    infer_festival_type_from_name,
    get_festival_source_hint,
    infer_program_title,
    get_source_info,
    get_source_by_slug,
    get_portal_id_by_slug,
    get_active_sources,
    get_producer_id_for_source,
    create_crawl_log,
    update_crawl_log,
    update_source_last_crawled,
    update_expected_event_count,
    get_sources_due_for_crawl,
    get_sources_by_cadence,
    refresh_available_filters,
    refresh_search_suggestions,
    update_source_health_tags,
    get_source_health_tags,
    detect_zero_event_sources,
)

# ===== places.py (formerly venues.py) =====
from db.places import (
    VIRTUAL_VENUE_SLUG,
    VIRTUAL_VENUE_DATA,
    _normalize_venue_name,
    _is_permanently_closed_venue,
    _with_closed_note,
    _lock_closed_venue_record,
    infer_location_designator,
    _fetch_venue_description,
    _fetch_venue_web_metadata,
    _persist_venue_enrichment,
    get_or_create_virtual_venue,
    get_or_create_place,
    get_venue_by_id,
    get_venue_by_id_cached,
    clear_venue_cache,
    get_venue_by_slug,
    upsert_venue_feature,
    get_sibling_venue_ids,
)

# ===== enrichment.py =====
from db.enrichment import (
    _compute_and_save_event_blurhash,
    _queue_event_blurhash,
)

# ===== series_linking.py =====
from db.series_linking import (
    _force_update_series_day,
)

# ===== artists.py =====
from db.artists import (
    _NIGHTLIFE_SKIP_GENRES,
    _GENERIC_EVENT_TITLE_RE,
    _normalize_participant_text,
    _normalize_team_entity,
    _title_has_participant_descriptors,
    _looks_like_participant_boilerplate,
    _clean_team_name,
    _parse_sports_teams_from_title,
    parse_lineup_from_title,
    sanitize_event_artists,
    upsert_event_artists,
)

# ===== events.py =====
from db.events import (
    _fix_recurrence_day_mismatch,
    _normalize_url_path,
    _is_listing_like_url,
    _looks_like_explicit_ticket_url,
    _should_promote_incoming_url,
    _should_promote_incoming_ticket_url,
    _normalize_entity_key,
    _should_use_incoming_image,
    _should_replace_placeholder_artists,
    insert_event,
    _insert_event_record,
    update_event,
    _update_event_record,
    smart_update_existing_event,
    _normalize_title_for_natural_key,
    find_event_by_hash,
    prefetch_hashes,
    prefetch_events_by_source,
    find_existing_event_by_natural_key,
    find_existing_event_for_insert,
    _source_priority_for_dedupe,
    _candidate_quality_score,
    find_cross_source_canonical_for_insert,
    remove_stale_source_events,
    find_events_by_date_and_venue,
    find_events_by_date_and_venue_family,
    get_all_events,
    update_event_tags,
    upsert_event_images,
    upsert_event_links,
    update_event_extraction_metadata,
    deactivate_tba_events,
)

# ===== programs.py =====
from db.programs import (
    infer_program_type,
    infer_season,
    infer_cost_period,
    generate_program_hash,
    find_program_by_hash,
    insert_program,
    update_program,
)

# ===== exhibitions.py =====
from db.exhibitions import (
    generate_exhibition_hash,
    find_exhibition_by_hash,
    insert_exhibition,
    update_exhibition,
)

# ===== open_calls.py =====
from db.open_calls import (
    generate_open_call_hash,
    find_open_call_by_hash,
    insert_open_call,
    update_open_call,
)

# ===== place_vertical.py (formerly destination_details.py) =====
from db.place_vertical import (
    upsert_place_vertical_details,
)

# ===== place_specials.py (formerly venue_specials.py) =====
from db.place_specials import (
    upsert_place_special,
)

# ===== editorial_mentions.py =====
from db.editorial_mentions import (
    upsert_editorial_mention,
)

# ===== place_occasions.py (formerly venue_occasions.py) =====
from db.place_occasions import (
    upsert_place_occasion,
)

# ===== volunteer_opportunities.py =====
from db.volunteer_opportunities import (
    deactivate_stale_volunteer_opportunities,
    upsert_volunteer_opportunity,
)

# ===== notifications.py =====
from db.notifications import (
    _CANCEL_KEYWORDS,
    _event_looks_cancelled,
    format_event_update_message,
    _filter_users_with_event_updates,
    create_event_update_notifications,
    compute_event_update,
)
