#!/usr/bin/env python3
"""
Venue Occasion Inference.

Populates venue_occasions table by inferring "Perfect For" tags from existing
venue attributes (vibes, type, hours, price level, location).

Reads venue attributes from the DB, applies rule-based logic, and writes
inferred occasion tags with appropriate confidence scores. Never overwrites
rows with source='manual' or source='editorial'.

Usage:
    python occasion_inference.py              # All active Atlanta venues
    python occasion_inference.py --venue-id 123  # Single venue
    python occasion_inference.py --dry-run    # Preview without writing
    python occasion_inference.py --verbose    # Debug logging
    python occasion_inference.py --min-confidence 0.6  # Raise quality bar
"""

from __future__ import annotations

import argparse
import logging
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from repo root before importing db/config
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import configure_write_mode, get_client, writes_enabled  # noqa: E402

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stadium coordinates for pre_game inference
# ---------------------------------------------------------------------------

# State Farm Arena (Hawks, Atlanta Gladiators)
_STATE_FARM_ARENA = (33.7573, -84.3963)
# Mercedes-Benz Stadium (Falcons, Atlanta United)
_MERCEDES_BENZ_STADIUM = (33.7553, -84.4006)
# Additional major sports venues in metro Atlanta
_TRUIST_PARK = (33.8908, -84.4678)  # Braves
_GAS_SOUTH_ARENA = (33.8962, -84.2107)  # Gwinnett Stripers / venue events

_STADIUM_COORDS = [
    _STATE_FARM_ARENA,
    _MERCEDES_BENZ_STADIUM,
    _TRUIST_PARK,
    _GAS_SOUTH_ARENA,
]

# Radius in km — 0.8 km ≈ 10-min walk for pre_game attribution
_PRE_GAME_RADIUS_KM = 0.8

# ---------------------------------------------------------------------------
# Occasion taxonomy
# ---------------------------------------------------------------------------
# Each rule defines the signals that vote for an occasion.
# confidence = base confidence when exactly 1 signal fires.
# Additional signals bump confidence by +0.1 each (capped at 0.95).
#
# NOTE: These occasions MUST match the CHECK constraint in
# database/migrations/433_editorial_mentions_and_occasions.sql:
#   'date_night', 'groups', 'solo', 'outdoor_dining', 'late_night',
#   'quick_bite', 'special_occasion', 'beltline', 'pre_game', 'brunch',
#   'family_friendly', 'dog_friendly', 'live_music', 'dancing'

OCCASION_RULES: dict[str, dict] = {
    "date_night": {
        "vibes_match": ["date-spot", "intimate", "upscale"],
        "price_level_min": 3,
        "service_style_match": ["full_service", "tasting_menu"],
        "venue_type_match": [
            "restaurant",
            "cocktail_bar",
            "wine_bar",
            "lounge",
            "rooftop",
        ],
        "confidence": 0.7,
    },
    "groups": {
        "vibes_match": ["good-for-groups"],
        "venue_type_match": [
            "beer_garden",
            "food_hall",
            "bowling",
            "sports_bar",
            "brewery",
            "eatertainment",
            "arcade",
            "museum",
            "zoo",
            "aquarium",
            "theme_park",
            "arena",
            "stadium",
            "convention_center",
            "entertainment",
            "escape_room",
        ],
        "confidence": 0.7,
    },
    "solo": {
        "vibes_match": ["intimate"],
        "venue_type_match": ["coffee_shop", "bar", "bookstore", "library", "museum", "gallery", "cinema"],
        "confidence": 0.6,
    },
    "outdoor_dining": {
        "vibes_match": ["outdoor-seating", "patio", "rooftop"],
        "venue_type_match": ["rooftop", "beer_garden"],
        "confidence": 0.8,
    },
    "late_night": {
        "vibes_match": ["late-night"],
        # Also inferred from hours — see _is_late_night()
        "confidence": 0.8,
    },
    "quick_bite": {
        "service_style_match": ["quick_service", "coffee_dessert"],
        "price_level_max": 2,
        "venue_type_match": ["coffee_shop", "food_truck", "food_hall"],
        "confidence": 0.6,
    },
    "special_occasion": {
        "price_level_min": 4,
        "service_style_match": ["tasting_menu"],
        "venue_type_match": ["convention_center", "arena", "stadium"],
        # reservation_recommended = true also signals this
        "confidence": 0.7,
    },
    "beltline": {
        # Factual attribute: beltline_adjacent = true
        # No signal stacking — this is a geographic fact, not a judgment call
        "confidence": 1.0,
    },
    "pre_game": {
        # Proximity to stadium coords — see _is_pre_game()
        "venue_type_match": ["bar", "restaurant", "sports_bar", "brewery", "lounge"],
        "confidence": 0.7,
    },
    "brunch": {
        # Inferred from weekend hours opening before noon — see _is_brunch()
        "venue_type_match": ["restaurant", "bar", "hotel", "cafe", "coffee_shop", "brewery", "food_hall"],
        "confidence": 0.6,
    },
    "family_friendly": {
        "vibes_match": ["family-friendly", "kid-friendly"],
        "venue_type_match": [
            "museum",
            "park",
            "garden",
            "zoo",
            "aquarium",
            "bowling",
            "arcade",
            "science_center",
            "arena",
            "stadium",
            "theme_park",
            "convention_center",
        ],
        "confidence": 0.7,
    },
    "dog_friendly": {
        "vibes_match": ["dog-friendly"],
        "confidence": 0.8,
    },
    "live_music": {
        "vibes_match": ["live-music"],
        "venue_type_match": ["music_venue", "amphitheater", "arena", "stadium"],
        "confidence": 0.8,
    },
    "dancing": {
        "vibes_match": ["dance-floor", "dancing", "latin-night", "line-dancing"],
        "venue_type_match": ["nightclub", "dance_hall"],
        "confidence": 0.7,
    },
}

# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in kilometres between two coordinates."""
    r = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return r * 2 * math.asin(math.sqrt(a))


def _parse_time_hhmm(time_str: str) -> Optional[int]:
    """Parse 'HH:MM' into minutes-since-midnight. Returns None on parse error."""
    if not time_str:
        return None
    try:
        parts = str(time_str).strip().split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours * 60 + minutes
    except (ValueError, IndexError):
        return None


def _is_after_midnight_close(close_time: str) -> bool:
    """Return True when close time represents an after-midnight closing.

    Times like '02:00' or '03:30' stored in the hours JSON represent 2 AM / 3:30 AM.
    We treat any close time in [00:00, 06:00) as after-midnight.
    Also treats '00:00' as midnight close (end-of-day).
    """
    minutes = _parse_time_hhmm(close_time)
    if minutes is None:
        return False
    # 0 = 00:00 (midnight) → after midnight
    # 360 = 06:00 → last boundary
    return 0 <= minutes < 360


def _is_late_night(venue: dict) -> bool:
    """Return True if any day in the hours JSON closes after midnight."""
    hours = venue.get("hours")
    if not hours or not isinstance(hours, dict):
        return False
    for _day, window in hours.items():
        if not isinstance(window, dict):
            continue
        close = window.get("close")
        if close and _is_after_midnight_close(str(close)):
            return True
    return False


def _is_brunch(venue: dict) -> bool:
    """Return True if venue is open on Saturday or Sunday before noon."""
    hours = venue.get("hours")
    if not hours or not isinstance(hours, dict):
        return False
    for day_key in ("sat", "sun"):
        window = hours.get(day_key)
        if not isinstance(window, dict):
            continue
        open_time = window.get("open")
        if not open_time:
            continue
        minutes = _parse_time_hhmm(str(open_time))
        if minutes is not None and 480 <= minutes < 720:  # 8am–noon only
            return True
    return False


def _is_pre_game(venue: dict) -> bool:
    """Return True if venue is within pre_game radius of any major stadium."""
    lat = venue.get("lat")
    lng = venue.get("lng")
    if lat is None or lng is None:
        return False
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return False
    return any(
        haversine_km(lat, lng, slat, slng) <= _PRE_GAME_RADIUS_KM
        for slat, slng in _STADIUM_COORDS
    )


def _normalize_vibes(venue: dict) -> list[str]:
    """Return vibes as a normalised list of lowercase strings."""
    raw = venue.get("vibes")
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(v).lower().strip() for v in raw]
    if isinstance(raw, str):
        # JSON arrays sometimes come back as strings from Supabase
        import json

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(v).lower().strip() for v in parsed]
        except json.JSONDecodeError:
            pass
        return [raw.lower().strip()]
    return []


# ---------------------------------------------------------------------------
# Core inference
# ---------------------------------------------------------------------------


def infer_occasions(venue: dict, min_confidence: float = 0.5) -> list[dict]:
    """Apply all occasion rules to a single venue.

    Returns a list of occasion dicts ready for DB upsert:
        {"venue_id": int, "occasion": str, "confidence": float, "source": "inferred"}
    """
    venue_id = venue["id"]
    vibes = _normalize_vibes(venue)
    venue_type = (venue.get("venue_type") or "").lower().strip()
    price_level = venue.get("price_level")
    service_style = (venue.get("service_style") or "").lower().strip()
    reservation_recommended = bool(venue.get("reservation_recommended"))
    beltline_adjacent = bool(venue.get("beltline_adjacent"))

    results: list[dict] = []

    for occasion, rule in OCCASION_RULES.items():
        base_confidence: float = rule["confidence"]
        signals_fired = 0

        # ── Factual / geographic special cases ──────────────────────────────

        if occasion == "beltline":
            if beltline_adjacent:
                results.append(
                    {
                        "venue_id": venue_id,
                        "occasion": "beltline",
                        "confidence": 1.0,
                        "source": "inferred",
                    }
                )
            continue

        if occasion == "late_night":
            if "late-night" in vibes:
                signals_fired += 1
            if _is_late_night(venue):
                signals_fired += 1

        elif occasion == "brunch":
            type_matches = rule.get("venue_type_match", [])
            if type_matches and venue_type not in type_matches:
                continue
            if _is_brunch(venue):
                signals_fired += 1

        elif occasion == "pre_game":
            if _is_pre_game(venue):
                signals_fired += 1
                # venue_type provides a corroborating signal
                type_matches: list[str] = rule.get("venue_type_match", [])
                if venue_type in type_matches:
                    signals_fired += 1
            # If not near a stadium, pre_game never fires (location is mandatory)
            if signals_fired == 0:
                continue

        elif occasion == "quick_bite":
            # price_level only counts when there is food context; without it
            # the signal tags libraries, boutiques, and galleries incorrectly.
            _FOOD_TYPES = {
                "restaurant", "cafe", "coffee_shop", "food_truck",
                "food_hall", "bar", "brewery", "bakery",
            }
            _FOOD_STYLES = {"quick_service", "coffee_dessert", "counter_service"}
            has_food_context = (
                venue_type in _FOOD_TYPES
                or service_style in _FOOD_STYLES
            )
            if not has_food_context:
                continue

            # service_style signal
            style_matches = rule.get("service_style_match", [])
            if service_style and service_style in style_matches:
                signals_fired += 1

            # venue_type signal
            type_matches = rule.get("venue_type_match", [])
            if venue_type and venue_type in type_matches:
                signals_fired += 1

            # price_level_max signal — only fires with food context (already gated)
            price_max = rule.get("price_level_max")
            if price_max is not None and price_level is not None:
                try:
                    if int(price_level) <= int(price_max):
                        signals_fired += 1
                except (TypeError, ValueError):
                    pass

        elif occasion == "special_occasion":
            # price_level
            price_min = rule.get("price_level_min")
            if price_min is not None and price_level is not None:
                try:
                    if int(price_level) >= int(price_min):
                        signals_fired += 1
                except (TypeError, ValueError):
                    pass
            # service style
            style_matches: list[str] = rule.get("service_style_match", [])
            if service_style in style_matches:
                signals_fired += 1
            # reservation recommended
            if reservation_recommended:
                signals_fired += 1
            # venue type (large event venues host special occasions)
            so_type_matches: list[str] = rule.get("venue_type_match", [])
            if venue_type in so_type_matches:
                signals_fired += 1

        else:
            # ── Generic multi-signal rules ───────────────────────────────────

            # vibes signal
            vibe_matches: list[str] = rule.get("vibes_match", [])
            if any(v in vibes for v in vibe_matches):
                signals_fired += 1

            # venue_type signal
            type_matches = rule.get("venue_type_match", [])
            if venue_type and venue_type in type_matches:
                signals_fired += 1

            # service_style signal
            style_matches = rule.get("service_style_match", [])
            if service_style and service_style in style_matches:
                signals_fired += 1

            # price_level_min signal
            price_min = rule.get("price_level_min")
            if price_min is not None and price_level is not None:
                try:
                    if int(price_level) >= int(price_min):
                        signals_fired += 1
                except (TypeError, ValueError):
                    pass

            # price_level_max signal (inversely — fires when price is LOW enough)
            price_max = rule.get("price_level_max")
            if price_max is not None and price_level is not None:
                try:
                    if int(price_level) <= int(price_max):
                        signals_fired += 1
                except (TypeError, ValueError):
                    pass

        if signals_fired == 0:
            continue

        # Bump confidence by +0.1 per additional signal beyond the first
        confidence = min(0.95, base_confidence + (signals_fired - 1) * 0.1)

        if confidence < min_confidence:
            logger.debug(
                "Skipping %s → %s (confidence %.2f below threshold %.2f)",
                venue.get("name"),
                occasion,
                confidence,
                min_confidence,
            )
            continue

        results.append(
            {
                "venue_id": venue_id,
                "occasion": occasion,
                "confidence": round(confidence, 2),
                "source": "inferred",
            }
        )

    return results


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_venues(venue_id: Optional[int] = None) -> list[dict]:
    """Fetch all active venues with all occasion-relevant columns."""
    client = get_client()
    all_venues: list[dict] = []
    offset = 0
    while True:
        query = (
            client.table("venues")
            .select(
                "id, name, slug, venue_type, vibes, price_level, hours, "
                "service_style, reservation_recommended, beltline_adjacent, lat, lng"
            )
            .eq("active", True)
            .order("id")
            .range(offset, offset + 999)
        )
        if venue_id is not None:
            query = query.eq("id", venue_id)

        result = query.execute()
        if not result.data:
            break
        all_venues.extend(result.data)
        if len(result.data) < 1000:
            break
        offset += 1000
    return all_venues


def load_existing_occasions(venue_ids: list[int]) -> dict[tuple[int, str], dict]:
    """Return a mapping of (venue_id, occasion) → existing row dict.

    Only loads rows for the venues we're processing to avoid full-table scans.
    Processes in batches of 200 to stay under Supabase URL limits.
    """
    if not venue_ids:
        return {}

    client = get_client()
    existing: dict[tuple[int, str], dict] = {}
    batch_size = 200

    for i in range(0, len(venue_ids), batch_size):
        batch = venue_ids[i : i + batch_size]
        result = (
            client.table("venue_occasions")
            .select("id, venue_id, occasion, confidence, source")
            .in_("venue_id", batch)
            .execute()
        )
        for row in result.data or []:
            key = (row["venue_id"], row["occasion"])
            existing[key] = row

    return existing


# ---------------------------------------------------------------------------
# DB writes
# ---------------------------------------------------------------------------


def upsert_occasions(
    occasions: list[dict],
    existing: dict[tuple[int, str], dict],
) -> tuple[int, int]:
    """Write inferred occasions to venue_occasions.

    Never overwrites rows with source='manual' or source='editorial'.
    Updates confidence on existing inferred rows only when the value changes
    by more than 0.01.

    Returns (created_count, updated_count).
    """
    if not occasions:
        return 0, 0

    created = 0
    updated = 0

    if not writes_enabled():
        for o in occasions:
            logger.info(
                "DRY RUN: venue_id=%s → %s (%.2f)",
                o["venue_id"],
                o["occasion"],
                o["confidence"],
            )
        return 0, 0

    client = get_client()

    for o in occasions:
        key = (o["venue_id"], o["occasion"])
        row = existing.get(key)

        if row is None:
            # New row
            try:
                client.table("venue_occasions").insert(o).execute()
                created += 1
                logger.debug(
                    "INSERT venue_id=%s %s (%.2f)",
                    o["venue_id"],
                    o["occasion"],
                    o["confidence"],
                )
            except Exception as exc:
                logger.warning(
                    "Failed to insert occasion %s for venue_id=%s: %s",
                    o["occasion"],
                    o["venue_id"],
                    exc,
                )
            continue

        # Row exists — check source protection
        if row["source"] in ("manual", "editorial"):
            logger.debug(
                "Skipping venue_id=%s %s — protected source '%s'",
                o["venue_id"],
                o["occasion"],
                row["source"],
            )
            continue

        # Existing inferred row — update confidence only if it changed materially
        existing_conf = float(row["confidence"])
        new_conf = float(o["confidence"])
        if abs(existing_conf - new_conf) < 0.01:
            continue

        try:
            client.table("venue_occasions").update({"confidence": new_conf}).eq(
                "id", row["id"]
            ).execute()
            updated += 1
            logger.debug(
                "UPDATE venue_id=%s %s %.2f → %.2f",
                o["venue_id"],
                o["occasion"],
                existing_conf,
                new_conf,
            )
        except Exception as exc:
            logger.warning(
                "Failed to update occasion %s for venue_id=%s: %s",
                o["occasion"],
                o["venue_id"],
                exc,
            )

    return created, updated


def delete_stale_occasions(
    venue_ids: list[int],
    inferred_occasions: list[dict],
    existing: dict[tuple[int, str], dict],
) -> int:
    """Delete inferred occasion rows that the current rules no longer produce.

    Only deletes rows with source='inferred'. Never touches 'manual' or
    'editorial' rows.

    Returns the number of rows deleted.
    """
    # Build a set of (venue_id, occasion) keys that the current run produced.
    current_keys: set[tuple[int, str]] = {
        (o["venue_id"], o["occasion"]) for o in inferred_occasions
    }

    # Collect existing inferred rows that are no longer in the current set.
    stale_ids: list[int] = []
    for key, row in existing.items():
        venue_id, _occasion = key
        if venue_id not in set(venue_ids):
            continue  # Outside our processing scope — leave alone
        if row["source"] != "inferred":
            continue  # Protected row — never delete
        if key not in current_keys:
            stale_ids.append(row["id"])
            logger.debug(
                "STALE: venue_id=%s %s (row id=%s) — no longer inferred",
                row["venue_id"],
                row["occasion"],
                row["id"],
            )

    if not stale_ids:
        return 0

    if not writes_enabled():
        logger.info("DRY RUN: would delete %d stale inferred rows", len(stale_ids))
        return 0

    client = get_client()
    deleted = 0
    # Delete in batches of 200 to stay under Supabase URL limits.
    batch_size = 200
    for i in range(0, len(stale_ids), batch_size):
        batch = stale_ids[i : i + batch_size]
        try:
            client.table("venue_occasions").delete().in_("id", batch).execute()
            deleted += len(batch)
        except Exception as exc:
            logger.warning("Failed to delete stale occasion rows %s: %s", batch, exc)

    logger.info("Deleted %d stale inferred occasion rows", deleted)
    return deleted


# ---------------------------------------------------------------------------
# Summary reporting
# ---------------------------------------------------------------------------


def _log_summary(
    venue_count: int,
    all_occasions: list[dict],
    created: int,
    updated: int,
    deleted: int,
    dry_run: bool,
) -> None:
    """Log a structured summary of inference results."""
    occasion_counts: Counter = Counter(o["occasion"] for o in all_occasions)
    total_inferred = len(all_occasions)

    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info("")
    logger.info("=== Venue Occasion Inference (%s) ===", mode)
    logger.info("  Venues processed:   %d", venue_count)
    logger.info(
        "  Occasions inferred:  %d across %d venues", total_inferred, venue_count
    )
    logger.info("  DB rows created:    %d", created)
    logger.info("  DB rows updated:    %d", updated)
    logger.info("  DB rows deleted:    %d  (stale inferred rows removed)", deleted)
    logger.info("")
    logger.info("Distribution by occasion:")
    for occasion in sorted(OCCASION_RULES.keys()):
        count = occasion_counts.get(occasion, 0)
        bar = "#" * min(count, 50)
        logger.info("  %-20s %4d  %s", occasion, count, bar)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Infer 'Perfect For' occasion tags from venue attributes."
    )
    parser.add_argument(
        "--venue-id",
        type=int,
        metavar="ID",
        help="Process a single venue by ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview inferences without writing to the database",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug-level logging",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.5,
        metavar="FLOAT",
        help="Only write occasions at or above this confidence threshold (default: 0.5)",
    )
    parser.add_argument(
        "--allow-production-writes",
        "--allow-prod-writes",
        action="store_true",
        dest="allow_production_writes",
        help="Required to perform write operations against the production DB",
    )
    args = parser.parse_args()

    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=log_level, format="%(message)s")

    if args.min_confidence < 0.0 or args.min_confidence > 1.0:
        logger.error("--min-confidence must be between 0.0 and 1.0")
        sys.exit(1)

    # Writes are enabled only when explicitly requested (either --allow-production-writes
    # or the legacy --dry-run=False path). Default to read-only when neither flag is set.
    should_write = args.allow_production_writes and not args.dry_run
    configure_write_mode(
        enable_writes=should_write,
        reason="" if should_write else "pass --allow-production-writes to write",
    )

    # ── 1. Load venues ──────────────────────────────────────────────────────
    logger.info("Loading venues from database…")
    venues = load_venues(venue_id=args.venue_id)
    if not venues:
        target = (
            f"venue_id={args.venue_id}"
            if args.venue_id
            else "all active Atlanta venues"
        )
        logger.warning("No venues found for %s. Nothing to do.", target)
        return

    logger.info("Loaded %d venue(s)", len(venues))

    # ── 2. Pre-load existing occasions (avoid N+1 per-venue queries) ────────
    venue_ids = [v["id"] for v in venues]
    existing = load_existing_occasions(venue_ids)
    logger.info("Found %d existing occasion rows in DB", len(existing))

    # ── 3. Infer occasions for each venue ───────────────────────────────────
    all_occasions: list[dict] = []
    venues_with_any: int = 0

    for venue in venues:
        inferred = infer_occasions(venue, min_confidence=args.min_confidence)
        if inferred:
            venues_with_any += 1
            logger.debug(
                "%s → %s",
                venue.get("name", venue["id"]),
                [o["occasion"] for o in inferred],
            )
        all_occasions.extend(inferred)

    # ── 4. Write to database ────────────────────────────────────────────────
    created, updated = upsert_occasions(all_occasions, existing)

    # ── 4b. Remove stale inferred rows ──────────────────────────────────────
    deleted = delete_stale_occasions(venue_ids, all_occasions, existing)

    # ── 5. Summary ──────────────────────────────────────────────────────────
    _log_summary(
        venue_count=len(venues),
        all_occasions=all_occasions,
        created=created,
        updated=updated,
        deleted=deleted,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
