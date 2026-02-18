"""
Canonical registry of confirmed closed venues.

Use this module for:
- crawler/runtime guards (do not reactivate closed venues)
- source blocking
- closure audits and cleanup scripts
"""

from __future__ import annotations

from dataclasses import dataclass


CLOSED_VENUE_NOTE = "Permanently closed. Do not reactivate via crawler."


@dataclass(frozen=True)
class ClosedVenue:
    slug: str
    name: str
    reason: str
    source_slug: str | None = None


# Keep this list to high-confidence, confirmed closures only.
CLOSED_VENUES: tuple[ClosedVenue, ...] = (
    ClosedVenue(
        slug="orpheus-brewing",
        name="Orpheus Brewing",
        reason="Permanently closed",
        source_slug="orpheus-brewing",
    ),
    ClosedVenue(
        slug="prohibition-atlanta",
        name="Prohibition Atlanta",
        reason="Permanently closed (Dec 2025)",
    ),
    ClosedVenue(
        slug="torched-hop-brewing",
        name="Torched Hop Brewing Company",
        reason="Permanently closed (Dec 2024)",
    ),
    ClosedVenue(
        slug="torched-hop",
        name="Torched Hop Brewing",
        reason="Permanently closed (Dec 2024)",
        source_slug="torched-hop",
    ),
    ClosedVenue(
        slug="bookhouse-pub",
        name="Bookhouse Pub",
        reason="Permanently closed (Dec 2024)",
        source_slug="bookhouse-pub",
    ),
    ClosedVenue(
        slug="8arm",
        name="8Arm",
        reason="Permanently closed (Oct 2022)",
    ),
    ClosedVenue(
        slug="8arm-restaurant",
        name="8ARM",
        reason="Permanently closed (Oct 2022)",
    ),
    ClosedVenue(
        slug="churchill-grounds",
        name="Churchill Grounds",
        reason="Permanently closed (2016)",
    ),
    ClosedVenue(
        slug="o4w-pizza",
        name="O4W Pizza",
        reason="Atlanta location closed",
    ),
)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


CLOSED_VENUE_SLUGS = {entry.slug for entry in CLOSED_VENUES}
CLOSED_VENUE_NAMES_NORMALIZED = {_normalize_name(entry.name) for entry in CLOSED_VENUES}
CLOSED_SOURCE_SLUGS = {entry.source_slug for entry in CLOSED_VENUES if entry.source_slug}

