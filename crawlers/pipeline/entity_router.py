"""
Routes extracted records to declared entity lanes based on content_kind.

Crawlers declare which lanes they emit (via SourceEntityCapabilities or an
explicit list). This module maps raw content_kind values from extracted records
to the canonical lane names defined in entity_lanes.py, then filters to only
the lanes a source has declared — discarding anything undeclared rather than
silently routing it somewhere unexpected.
"""

import logging

logger = logging.getLogger(__name__)

# Maps content_kind values from extractors to canonical entity lane names.
# Aliases (e.g. "exhibit" -> "exhibitions") are intentional: sources should
# normalise to canonical kinds over time, but the router absorbs variation
# rather than erroring so new extractors can be added incrementally.
_CONTENT_KIND_TO_LANE: dict[str, str] = {
    "event": "events",
    "exhibition": "exhibitions",
    "exhibit": "exhibitions",
    "program": "programs",
    "special": "venue_specials",
    "volunteer": "volunteer_opportunities",
    "open_call": "open_calls",
}

_DEFAULT_LANE = "events"


def route_extracted_data(
    extracted: list[dict],
    declared_lanes: list[str],
) -> dict[str, list[dict]]:
    """Route extracted records into declared entity lanes.

    Records whose resolved lane is not in ``declared_lanes`` are silently
    dropped and logged at DEBUG level — callers control which lanes are active
    for a given source via ``declared_lanes``.

    Args:
        extracted: Raw records returned by an extractor. Each record may carry
            a ``content_kind`` key; records without one default to the
            ``"events"`` lane.
        declared_lanes: Lane names the calling source has declared it emits.
            Must be a subset of the canonical names in ``ENTITY_LANE_NAMES``.

    Returns:
        A dict mapping lane name → list of records. Only lanes that received at
        least one record appear in the output; empty lanes are omitted.
    """
    declared_set = set(declared_lanes)
    routed: dict[str, list[dict]] = {}

    for record in extracted:
        content_kind = record.get("content_kind", _DEFAULT_LANE)
        lane = _CONTENT_KIND_TO_LANE.get(content_kind, _DEFAULT_LANE)

        if lane not in declared_set:
            logger.debug(
                "Dropping record: lane %r not declared (content_kind=%r, title=%r)",
                lane,
                content_kind,
                record.get("title"),
            )
            continue

        routed.setdefault(lane, []).append(record)

    return routed
