"""
Event deduplication logic for Lost City.
Identifies and merges duplicate events from different sources.
"""

import hashlib
import re
import logging
from typing import Optional
from rapidfuzz import fuzz
from extract import EventData
from db import find_event_by_hash, find_events_by_date_and_venue

logger = logging.getLogger(__name__)

# Similarity thresholds
VENUE_SIMILARITY_THRESHOLD = 80
TITLE_SIMILARITY_THRESHOLD = 85


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


def generate_content_hash(title: str, venue_name: str, date: str) -> str:
    """
    Generate a content hash for deduplication.
    Hash is based on normalized title + venue + date.
    """
    normalized = f"{normalize_text(title)}|{normalize_text(venue_name)}|{date}"
    return hashlib.md5(normalized.encode()).hexdigest()


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

    # Then check fuzzy match
    candidates = find_events_by_date_and_venue(event.start_date, venue_id)

    for candidate in candidates:
        similarity = calculate_similarity(event, candidate)
        if similarity >= TITLE_SIMILARITY_THRESHOLD:
            logger.debug(
                f"Found fuzzy match for '{event.title}' -> '{candidate['title']}' "
                f"(similarity: {similarity:.1f}%)"
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
