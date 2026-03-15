"""
Persistence helpers for typed crawler entity envelopes.

This lets crawlers emit a multi-entity payload first, then persist through the
shared writers. Unsupported lanes are reported explicitly instead of being
silently discarded.
"""

from dataclasses import dataclass, field
from typing import Optional

from db import (
    get_or_create_venue,
    insert_event,
    insert_exhibition,
    insert_open_call,
    insert_program,
    upsert_venue_destination_details,
    upsert_venue_feature,
)
from entity_lanes import TypedEntityEnvelope


@dataclass
class TypedEntityPersistResult:
    persisted: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    unresolved: list[str] = field(default_factory=list)

    def bump_persisted(self, lane: str) -> None:
        self.persisted[lane] = self.persisted.get(lane, 0) + 1

    def bump_skipped(self, lane: str) -> None:
        self.skipped[lane] = self.skipped.get(lane, 0) + 1


def _resolve_venue_id(
    record: dict,
    venue_ids_by_slug: dict[str, int],
) -> Optional[int]:
    venue_id = record.get("venue_id")
    if isinstance(venue_id, int) and venue_id > 0:
        return venue_id

    for key in ("venue_slug", "destination_slug", "_destination_slug"):
        slug = record.get(key)
        if isinstance(slug, str) and slug in venue_ids_by_slug:
            return venue_ids_by_slug[slug]

    return None


def persist_typed_entity_envelope(
    envelope: TypedEntityEnvelope,
) -> TypedEntityPersistResult:
    result = TypedEntityPersistResult()
    venue_ids_by_slug: dict[str, int] = {}
    venue_names_by_slug: dict[str, str] = {}

    for destination in envelope.destinations:
        destination_record = dict(destination)
        venue_id = get_or_create_venue(destination_record)
        if isinstance(venue_id, int) and venue_id > 0:
            slug = destination_record.get("slug")
            if isinstance(slug, str) and slug:
                venue_ids_by_slug[slug] = venue_id
                if isinstance(destination_record.get("name"), str):
                    venue_names_by_slug[slug] = destination_record["name"]
            result.bump_persisted("destinations")
        else:
            result.bump_skipped("destinations")

    for details in envelope.destination_details:
        details_record = dict(details)
        venue_id = _resolve_venue_id(details_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("destination_details")
            result.unresolved.append("destination_details")
            continue
        persisted = upsert_venue_destination_details(venue_id, details_record)
        if persisted:
            result.bump_persisted("destination_details")
        else:
            result.bump_skipped("destination_details")

    for feature in envelope.venue_features:
        feature_record = dict(feature)
        venue_id = _resolve_venue_id(feature_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("venue_features")
            result.unresolved.append("venue_features")
            continue
        persisted = upsert_venue_feature(venue_id, feature_record)
        if persisted:
            result.bump_persisted("venue_features")
        else:
            result.bump_skipped("venue_features")

    for event in envelope.events:
        event_record = dict(event)
        venue_id = _resolve_venue_id(event_record, venue_ids_by_slug)
        if venue_id:
            event_record["venue_id"] = venue_id
        persisted = insert_event(event_record)
        if persisted:
            result.bump_persisted("events")
        else:
            result.bump_skipped("events")

    for program in envelope.programs:
        program_record = dict(program)
        venue_id = _resolve_venue_id(program_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("programs")
            result.unresolved.append("programs")
            continue
        program_record["venue_id"] = venue_id
        if "_venue_name" not in program_record:
            for key in ("venue_slug", "destination_slug", "_destination_slug"):
                slug = program_record.get(key)
                if isinstance(slug, str) and slug in venue_names_by_slug:
                    program_record["_venue_name"] = venue_names_by_slug[slug]
                    break
        persisted = insert_program(program_record)
        if persisted:
            result.bump_persisted("programs")
        else:
            result.bump_skipped("programs")

    for exhibition in envelope.exhibitions:
        exhibition_record = dict(exhibition)
        venue_id = _resolve_venue_id(exhibition_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("exhibitions")
            result.unresolved.append("exhibitions")
            continue
        exhibition_record["venue_id"] = venue_id
        if "_venue_name" not in exhibition_record:
            for key in ("venue_slug", "destination_slug", "_destination_slug"):
                slug = exhibition_record.get(key)
                if isinstance(slug, str) and slug in venue_names_by_slug:
                    exhibition_record["_venue_name"] = venue_names_by_slug[slug]
                    break
        artists = exhibition_record.pop("artists", None)
        persisted = insert_exhibition(exhibition_record, artists=artists)
        if persisted:
            result.bump_persisted("exhibitions")
        else:
            result.bump_skipped("exhibitions")

    for open_call in envelope.open_calls:
        open_call_record = dict(open_call)
        venue_id = _resolve_venue_id(open_call_record, venue_ids_by_slug)
        if venue_id:
            open_call_record["venue_id"] = venue_id
        persisted = insert_open_call(open_call_record)
        if persisted:
            result.bump_persisted("open_calls")
        else:
            result.bump_skipped("open_calls")

    for lane in (
        "opportunities",
        "venue_specials",
        "editorial_mentions",
        "venue_occasions",
    ):
        records = getattr(envelope, lane)
        if records:
            result.skipped[lane] = result.skipped.get(lane, 0) + len(records)
            result.unresolved.append(lane)

    return result
