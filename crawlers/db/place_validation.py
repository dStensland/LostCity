"""
Place validation — name quality, geo-scope, and minimum field checks.

Renamed from venue_validation.py (Task 8 — places refactor).
Analogous to db/validation.py for events. Called from get_or_create_place()
to reject junk places before they enter the database.
"""

import re
import math
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ===== COORDINATE SANITY CHECK =====

# Known geocoder default/fallback points.  These are coordinates that geocoders
# return when they cannot resolve an address to a specific building.  Any venue
# pinned here is almost certainly wrong — the geocoder gave up and returned a
# city-level centroid or a known "default point" for its dataset.
#
# The `exact` entries are specific fallback coordinates observed in production
# data (e.g. Nominatim's Atlanta fallback).  The `centroid` entries are city
# centres that both Google Places and Nominatim use as last-resort fallbacks.
#
# Radius (metres): within this distance a result is treated as suspicious.
_SUSPICIOUS_POINTS = [
    # Specific Nominatim Atlanta fallback observed in production
    {"lat": 33.7544657, "lng": -84.3898151, "radius_m": 50,   "label": "Nominatim Atlanta fallback"},
    # City centroids — larger radius because some real venues are close
    {"lat": 33.7490,    "lng": -84.3880,    "radius_m": 500,  "label": "Atlanta centroid"},
    {"lat": 36.1620,    "lng": -86.7810,    "radius_m": 500,  "label": "Nashville centroid"},
]


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two lat/lng points (Haversine)."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_suspicious_coordinate(lat: float, lng: float) -> tuple[bool, Optional[str]]:
    """
    Return (True, reason) if (lat, lng) is suspiciously close to a known
    geocoder default/fallback point; (False, None) otherwise.

    Used by get_or_create_venue() and post-crawl auditing to catch venues
    that were silently pinned at a city centroid because the geocoder couldn't
    resolve their address.

    Args:
        lat: Latitude of the coordinate to check.
        lng: Longitude of the coordinate to check.

    Returns:
        (is_suspicious, reason_string)
        is_suspicious is True if the coordinate matches a known bad point.
        reason_string is a human-readable explanation (or None when not suspicious).
    """
    if lat is None or lng is None:
        return False, None

    for point in _SUSPICIOUS_POINTS:
        dist = _haversine_m(lat, lng, point["lat"], point["lng"])
        if dist <= point["radius_m"]:
            return True, (
                f"coordinate ({lat}, {lng}) is {dist:.0f}m from {point['label']} "
                f"(threshold: {point['radius_m']}m) — likely a geocoder fallback"
            )
    return False, None


# ===== NAME VALIDATION =====

# Street suffixes that indicate an address masquerading as a venue name
_STREET_SUFFIXES = re.compile(
    r"\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court"
    r"|way|pl|place|pkwy|parkway|cir|circle|hwy|highway|nw|ne|sw|se)\b",
    re.IGNORECASE,
)

# Name starts with digits + street suffix pattern (e.g. "123 Peachtree St NE")
_ADDRESS_AS_NAME = re.compile(
    r"^\d+\s+\w+.*\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive"
    r"|ln|lane|ct|court|way|pl|place|pkwy|parkway|hwy|highway)\b",
    re.IGNORECASE,
)

_JUNK_NAMES = {
    "tbd", "tba", "virtual", "online", "n/a", "test", "none",
    "unknown", "private", "venue", "location", "address",
    "this event's address is private",
}

_JUNK_PATTERNS = [
    re.compile(r"^[a-zA-Z]$"),               # Single character
]


def validate_place_name(name: Optional[str]) -> tuple[bool, Optional[str]]:
    """
    Reject address-as-name, pure numbers, single chars, known junk patterns.

    Returns (is_valid, rejection_reason). If is_valid is True, rejection_reason is None.
    """
    if not name or not name.strip():
        return False, "empty name"

    cleaned = name.strip()

    # Too short
    if len(cleaned) < 2:
        return False, f"name too short: {cleaned!r}"

    # Known junk names (case-insensitive)
    if cleaned.lower() in _JUNK_NAMES:
        return False, f"known junk name: {cleaned!r}"

    # Pure numeric — but allow short numbers that could be real venue names
    # (e.g., "529" is 529 Bar in EAV, "40 Watt" would pass other checks)
    if cleaned.isdigit() and len(cleaned) > 4:
        return False, f"pure numeric name: {cleaned!r}"

    # URL as name
    if cleaned.lower().startswith(("http://", "https://")):
        return False, f"URL as name: {cleaned!r}"

    # Address-as-name: starts with digits + street suffix
    if _ADDRESS_AS_NAME.match(cleaned):
        return False, f"address as name: {cleaned!r}"

    # Junk patterns
    for pattern in _JUNK_PATTERNS:
        if pattern.match(cleaned):
            return False, f"matches junk pattern: {cleaned!r}"

    return True, None


# ===== GEO-SCOPE VALIDATION =====

def validate_place_geo_scope(venue_data: dict, context) -> tuple[bool, Optional[str]]:
    """
    Reject places outside the crawl context's allowed geography.

    Logic:
    - State is the primary gate: places in allowed_states pass.
    - Coordinates are secondary: used to reject places in allowed states but
      clearly in a different region (e.g., coords in Michigan with state="GA"
      defaulted by a crawler). Only rejects if coords are WAY outside — the
      metro_radius is for neighborhood inference, not place rejection.
    - Places with no state and no coords are ambiguous but allowed through
      (name validation is the gatekeeper for those).

    Returns (is_valid, rejection_reason).
    """
    lat = venue_data.get("lat")
    lng = venue_data.get("lng")
    state = venue_data.get("state")

    # Check 1: State check (primary gate)
    if state:
        if not context.is_valid_state(state):
            return False, f"state {state!r} not in allowed states {context.allowed_states}"
        # State is valid — trust it. Macon/Athens/Savannah are fine.
        return True, None

    # Check 2: No state provided — use coords if available to catch
    # out-of-state venues that leaked in without a state field
    if lat and lng:
        if not context.is_in_metro(lat, lng):
            return False, (
                f"no state provided and coords ({lat:.3f}, {lng:.3f}) outside "
                f"{context.metro_radius_km}km radius of {context.city}"
            )

    return True, None


# ===== MINIMUM FIELD VALIDATION =====

def validate_place_minimum_fields(venue_data: dict) -> tuple[bool, list[str]]:
    """
    Warn on hollow places missing critical fields.

    Returns (passes_minimum, list_of_warnings).
    A place passes minimum if it has name, city, and state.
    Warnings are generated for strongly preferred but missing fields.
    """
    warnings: list[str] = []

    # Required fields
    if not venue_data.get("name"):
        warnings.append("missing required field: name")
    if not venue_data.get("city"):
        warnings.append("missing required field: city")
    if not venue_data.get("state"):
        warnings.append("missing required field: state")

    passes = not any("required" in w for w in warnings)

    # Strongly preferred fields
    if not venue_data.get("lat") or not venue_data.get("lng"):
        warnings.append("missing coordinates (lat/lng)")
    if not venue_data.get("place_type"):
        warnings.append("missing venue_type")
    if not venue_data.get("address"):
        warnings.append("missing address")

    return passes, warnings

