"""
Typed crawler entity lanes for incremental multi-entity ingestion.

This module does not persist anything by itself. It gives crawlers a shared
shape for first-pass capture so new portals can add entity types without
reverting to the "everything is an event" pattern.
"""

from dataclasses import dataclass, field
from typing import Any

EntityRecord = dict[str, Any]

ENTITY_LANE_NAMES = (
    "destinations",
    "destination_details",
    "events",
    "programs",
    "exhibitions",
    "open_calls",
    "volunteer_opportunities",
    "venue_features",
    "venue_specials",
    "editorial_mentions",
    "venue_occasions",
)

DESTINATION_ATTACHMENT_LANES = (
    "destination_details",
    "venue_features",
    "venue_specials",
    "editorial_mentions",
    "venue_occasions",
)


@dataclass(frozen=True)
class SourceEntityCapabilities:
    """Declare which typed lanes a source is expected to emit."""

    destinations: bool = False
    destination_details: bool = False
    events: bool = False
    programs: bool = False
    exhibitions: bool = False
    open_calls: bool = False
    volunteer_opportunities: bool = False
    venue_features: bool = False
    venue_specials: bool = False
    editorial_mentions: bool = False
    venue_occasions: bool = False

    def enabled_lanes(self) -> tuple[str, ...]:
        return tuple(
            lane for lane in ENTITY_LANE_NAMES if getattr(self, lane)
        )


@dataclass
class TypedEntityEnvelope:
    """
    Shared lane container for a crawler pass.

    Keep standalone actionables in their own lanes. Destination-attached
    richness stays attached until it earns independent identity.
    """

    destinations: list[EntityRecord] = field(default_factory=list)
    destination_details: list[EntityRecord] = field(default_factory=list)
    events: list[EntityRecord] = field(default_factory=list)
    programs: list[EntityRecord] = field(default_factory=list)
    exhibitions: list[EntityRecord] = field(default_factory=list)
    open_calls: list[EntityRecord] = field(default_factory=list)
    volunteer_opportunities: list[EntityRecord] = field(default_factory=list)
    venue_features: list[EntityRecord] = field(default_factory=list)
    venue_specials: list[EntityRecord] = field(default_factory=list)
    editorial_mentions: list[EntityRecord] = field(default_factory=list)
    venue_occasions: list[EntityRecord] = field(default_factory=list)

    def add(self, lane: str, record: EntityRecord) -> None:
        if lane not in ENTITY_LANE_NAMES:
            raise ValueError(f"Unknown entity lane: {lane}")
        getattr(self, lane).append(record)

    def extend(self, lane: str, records: list[EntityRecord]) -> None:
        if lane not in ENTITY_LANE_NAMES:
            raise ValueError(f"Unknown entity lane: {lane}")
        getattr(self, lane).extend(records)

    def counts(self) -> dict[str, int]:
        return {
            lane: len(getattr(self, lane))
            for lane in ENTITY_LANE_NAMES
        }

    def non_empty_lanes(self) -> dict[str, list[EntityRecord]]:
        return {
            lane: getattr(self, lane)
            for lane in ENTITY_LANE_NAMES
            if getattr(self, lane)
        }

    def has_records(self) -> bool:
        return any(self.counts().values())

    def has_destination_attachments(self) -> bool:
        return any(len(getattr(self, lane)) > 0 for lane in DESTINATION_ATTACHMENT_LANES)
