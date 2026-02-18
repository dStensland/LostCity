"""
Event deduplication logic for Lost City.
Identifies and merges duplicate events from different sources.
"""

import hashlib
import re
import logging
from datetime import date as dt_date, datetime
from typing import Optional
from rapidfuzz import fuzz
from extract import EventData
from db import find_event_by_hash, find_events_by_date_and_venue_family

logger = logging.getLogger(__name__)

# Similarity thresholds
VENUE_SIMILARITY_THRESHOLD = 80
TITLE_SIMILARITY_THRESHOLD = 85

# Multi-room venue patterns: base name -> list of room suffix patterns
# These venues have multiple rooms that should be treated as the same venue for dedup
MULTI_ROOM_VENUES = {
    "the masquerade": [
        r"\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$",
    ],
    "masquerade": [
        r"\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$",
    ],
    # Add more multi-room venues here as needed
    # "terminal west": [r"\s*-\s*(main|rooftop)$"],
}


def normalize_venue_for_dedup(venue_name: str) -> str:
    """
    Normalize venue name for deduplication purposes.
    Strips room suffixes from multi-room venues so events at different rooms
    of the same venue are detected as potential duplicates.

    Example: "The Masquerade - Hell" -> "the masquerade"
    """
    if not venue_name:
        return ""

    normalized = venue_name.lower().strip()

    # Check each multi-room venue pattern
    for base_name, patterns in MULTI_ROOM_VENUES.items():
        for pattern in patterns:
            # Check if venue name starts with base and has room suffix
            if normalized.startswith(base_name):
                stripped = re.sub(pattern, "", normalized, flags=re.IGNORECASE)
                if stripped != normalized:
                    logger.debug(f"Normalized venue '{venue_name}' -> '{stripped}' for dedup")
                    return stripped.strip()

    return normalized


def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    # Lowercase
    text = text.lower()
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Remove common prefixes/suffixes
    text = re.sub(r"^(the|a|an)\s+", "", text)
    # Remove punctuation
    text = re.sub(r"[^\w\s]", "", text)
    return text


def _normalize_date_for_hash(value) -> str:
    """Normalize date-like values to YYYY-MM-DD for stable hashing."""
    if isinstance(value, dt_date):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()

    text = str(value or "").strip()
    if not text:
        return ""

    # Handles values like "2026-02-17T00:00:00" / "2026-02-17 00:00:00"
    m = re.match(r"^(\d{4}-\d{2}-\d{2})", text)
    if m:
        return m.group(1)
    return text


def generate_legacy_content_hash(title: str, venue_name: str, date) -> str:
    """
    Legacy hash used before 2026-02-16 venue normalization change.
    Kept for backward-compatible dedupe lookup during migration.
    """
    normalized_venue = normalize_venue_for_dedup(venue_name)
    normalized = f"{normalize_text(title)}|{normalized_venue}|{_normalize_date_for_hash(date)}"
    return hashlib.md5(normalized.encode()).hexdigest()


def generate_content_hash(title: str, venue_name: str, date) -> str:
    """
    Generate a content hash for deduplication.
    Hash is based on ONLY: normalized title + normalized venue + date.
    Does NOT include description or other varying fields.
    Uses special venue normalization that strips room suffixes from multi-room venues.
    """
    # Use venue-specific normalization to handle multi-room venues, then apply text normalization
    venue_after_room_strip = normalize_venue_for_dedup(venue_name)
    normalized_venue = normalize_text(venue_after_room_strip)
    normalized_title = normalize_text(title)
    normalized = f"{normalized_title}|{normalized_venue}|{_normalize_date_for_hash(date)}"
    return hashlib.md5(normalized.encode()).hexdigest()


def generate_content_hash_candidates(title: str, venue_name: str, date) -> list[str]:
    """Return current+legacy hash candidates (deduped, stable order)."""
    hashes = [
        generate_content_hash(title, venue_name, date),
        generate_legacy_content_hash(title, venue_name, date),
    ]
    deduped = list(dict.fromkeys(hashes))
    return [h for h in deduped if h]


def calculate_similarity(event1: EventData, event2: dict) -> float:
    """
    Calculate similarity score between two events.
    Returns a score from 0-100.
    """
    # Must be on same date
    if event1.start_date != event2.get("start_date"):
        return 0.0

    # Compare titles
    title_sim = fuzz.ratio(
        normalize_text(event1.title),
        normalize_text(event2.get("title", ""))
    )

    # Compare venues
    venue_sim = fuzz.ratio(
        normalize_text(event1.venue.name),
        normalize_text(event2.get("venue_name", ""))
    )

    # Weighted average (title is more important)
    return (title_sim * 0.6) + (venue_sim * 0.4)


def is_duplicate(event: EventData, venue_id: int) -> Optional[int]:
    """
    Check if an event is a duplicate of an existing event.

    Args:
        event: The event to check
        venue_id: The resolved venue ID

    Returns:
        The ID of the canonical event if duplicate, None otherwise
    """
    # First check exact hash match
    content_hash = generate_content_hash(
        event.title,
        event.venue.name,
        event.start_date
    )

    existing = find_event_by_hash(content_hash)
    if existing:
        logger.debug(f"Found exact hash match for '{event.title}'")
        return existing["id"]

    # Then check fuzzy match - search across venue "family" (e.g., all Masquerade rooms)
    candidates = find_events_by_date_and_venue_family(event.start_date, venue_id)

    for candidate in candidates:
        similarity = calculate_similarity(event, candidate)
        if similarity >= TITLE_SIMILARITY_THRESHOLD:
            logger.debug(
                f"Found fuzzy match for '{event.title}' -> '{candidate['title']}' "
                f"at '{candidate.get('venue_name', 'unknown')}' (similarity: {similarity:.1f}%)"
            )
            return candidate["id"]

    return None


def merge_event_data(existing: dict, new: EventData) -> dict:
    """
    Merge new event data into existing event, keeping more complete data.

    Args:
        existing: The existing event record
        new: The new event data

    Returns:
        Merged event data dict
    """
    merged = existing.copy()

    # Prefer longer description
    if new.description and (
        not existing.get("description") or
        len(new.description) > len(existing.get("description", ""))
    ):
        merged["description"] = new.description

    # Add missing times
    if new.start_time and not existing.get("start_time"):
        merged["start_time"] = new.start_time
    if new.end_time and not existing.get("end_time"):
        merged["end_time"] = new.end_time

    # Prefer lower confidence to be conservative
    if new.confidence < existing.get("extraction_confidence", 1.0):
        merged["extraction_confidence"] = new.confidence

    # Merge tags
    existing_tags = set(existing.get("tags") or [])
    new_tags = set(new.tags or [])
    merged["tags"] = list(existing_tags | new_tags)

    # Add price info if missing
    if new.price_min is not None and existing.get("price_min") is None:
        merged["price_min"] = new.price_min
    if new.price_max is not None and existing.get("price_max") is None:
        merged["price_max"] = new.price_max
    if new.price_note and not existing.get("price_note"):
        merged["price_note"] = new.price_note

    # Add image if missing
    if new.image_url and not existing.get("image_url"):
        merged["image_url"] = new.image_url

    # Add ticket URL if missing
    if new.ticket_url and not existing.get("ticket_url"):
        merged["ticket_url"] = new.ticket_url

    return merged
