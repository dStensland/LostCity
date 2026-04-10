"""
Persistence helpers for typed crawler entity envelopes.

This lets crawlers emit a multi-entity payload first, then persist through the
shared writers. Unsupported lanes are reported explicitly instead of being
silently discarded.
"""

from dataclasses import dataclass, field
from typing import Optional

from db import (
    get_or_create_place,
    insert_event,
    insert_exhibition,
    insert_open_call,
    insert_program,
    persist_screening_bundle,
    upsert_editorial_mention,
    upsert_volunteer_opportunity,
    upsert_place_vertical_details,
    upsert_venue_feature,
    upsert_place_occasion,
    upsert_place_special,
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
    venue_id = record.get("place_id") or record.get("venue_id")
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
        venue_id = get_or_create_place(destination_record)
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
        persisted = upsert_place_vertical_details(venue_id, details_record)
        if persisted:
            result.bump_persisted("destination_details")
        else:
            result.bump_skipped("destination_details")

    feature_id_by_slug: dict[str, int] = {}
    for feature in envelope.venue_features:
        feature_record = dict(feature)
        venue_id = _resolve_venue_id(feature_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("venue_features")
            result.unresolved.append("venue_features")
            continue
        persisted = upsert_venue_feature(venue_id, feature_record)
        if persisted:
            slug = feature_record.get("slug") or feature_record.get("title", "")
            if isinstance(slug, str) and slug:
                feature_id_by_slug[slug] = int(persisted)
            result.bump_persisted("venue_features")
        else:
            result.bump_skipped("venue_features")

    for special in envelope.venue_specials:
        special_record = dict(special)
        venue_id = _resolve_venue_id(special_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("venue_specials")
            result.unresolved.append("venue_specials")
            continue
        persisted = upsert_place_special(venue_id, special_record)
        if persisted:
            result.bump_persisted("venue_specials")
        else:
            result.bump_skipped("venue_specials")

    for mention in envelope.editorial_mentions:
        mention_record = dict(mention)
        venue_id = _resolve_venue_id(mention_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("editorial_mentions")
            result.unresolved.append("editorial_mentions")
            continue
        persisted = upsert_editorial_mention(venue_id, mention_record)
        if persisted:
            result.bump_persisted("editorial_mentions")
        else:
            result.bump_skipped("editorial_mentions")

    for occasion in envelope.venue_occasions:
        occasion_record = dict(occasion)
        venue_id = _resolve_venue_id(occasion_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("venue_occasions")
            result.unresolved.append("venue_occasions")
            continue
        persisted = upsert_place_occasion(venue_id, occasion_record)
        if persisted:
            result.bump_persisted("venue_occasions")
        else:
            result.bump_skipped("venue_occasions")

    for event in envelope.events:
        event_record = dict(event)
        venue_id = _resolve_venue_id(event_record, venue_ids_by_slug)
        if venue_id:
            event_record["place_id"] = venue_id
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
        program_record["place_id"] = venue_id
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

    for screening_bundle in envelope.screenings:
        persisted_summary = persist_screening_bundle(dict(screening_bundle))
        if persisted_summary.get("unsupported"):
            result.bump_skipped("screenings")
            result.unresolved.append("screenings")
            continue
        if persisted_summary.get("persisted"):
            result.bump_persisted("screenings")
        else:
            result.bump_skipped("screenings")

    for exhibition in envelope.exhibitions:
        exhibition_record = dict(exhibition)
        venue_id = _resolve_venue_id(exhibition_record, venue_ids_by_slug)
        if not venue_id:
            result.bump_skipped("exhibitions")
            result.unresolved.append("exhibitions")
            continue
        exhibition_record["place_id"] = venue_id
        if "_venue_name" not in exhibition_record:
            for key in ("venue_slug", "destination_slug", "_destination_slug"):
                slug = exhibition_record.get(key)
                if isinstance(slug, str) and slug in venue_names_by_slug:
                    exhibition_record["_venue_name"] = venue_names_by_slug[slug]
                    break
        related_feature_slug = exhibition_record.pop("related_feature_slug", None)
        if related_feature_slug and related_feature_slug in feature_id_by_slug:
            exhibition_record["related_feature_id"] = feature_id_by_slug[related_feature_slug]
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
            open_call_record["place_id"] = venue_id
        persisted = insert_open_call(open_call_record)
        if persisted:
            result.bump_persisted("open_calls")
        else:
            result.bump_skipped("open_calls")

    for opportunity in envelope.volunteer_opportunities:
        opportunity_record = dict(opportunity)
        if not opportunity_record.get("organization_id") and not opportunity_record.get(
            "organization_slug"
        ):
            result.bump_skipped("volunteer_opportunities")
            result.unresolved.append("volunteer_opportunities")
            continue
        persisted = upsert_volunteer_opportunity(opportunity_record)
        if persisted:
            result.bump_persisted("volunteer_opportunities")
        else:
            result.bump_skipped("volunteer_opportunities")

    return result
