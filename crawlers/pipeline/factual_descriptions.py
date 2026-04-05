"""Compact factual description builders for structured sources."""

from __future__ import annotations

from typing import Optional


def _normalize(value: Optional[str]) -> str:
    return " ".join((value or "").split()).strip(" ,")


def build_public_meeting_description(
    body_name: str,
    meeting_type: Optional[str] = None,
    *,
    location: Optional[str] = None,
    agenda_available: bool = False,
) -> Optional[str]:
    """Build compact factual copy for public civic meetings."""
    body_clean = _normalize(body_name)
    type_clean = _normalize(meeting_type)
    location_clean = _normalize(location)

    if not body_clean:
        return None

    if type_clean:
        lead = f"Public {body_clean} {type_clean.lower()}".strip()
    else:
        lead = f"{body_clean} meeting"

    if location_clean:
        lead = f"{lead} at {location_clean}"

    tail = "Open to the public."
    if agenda_available:
        tail = f"{tail} Agenda available at the link above."

    description = f"{lead}. {tail}".strip()
    return " ".join(description.split())


def build_support_group_description(
    lead_text: str,
    venue_name: str,
    *,
    location: Optional[str] = None,
    virtual: bool = False,
    open_to_all: bool = True,
) -> Optional[str]:
    """Build compact factual copy for support-group style events."""
    lead_clean = _normalize(lead_text)
    venue_clean = _normalize(venue_name)
    location_clean = _normalize(location)

    if not lead_clean or not venue_clean:
        return None

    if virtual:
        body = f"{lead_clean}. Free community support at {venue_clean}"
    elif location_clean:
        body = f"{lead_clean}. Free community support at {venue_clean} {location_clean}"
    else:
        body = f"{lead_clean}. Free community support at {venue_clean}"

    if open_to_all:
        body = f"{body}. Open to all."
    else:
        body = f"{body}."

    return " ".join(body.split())


def build_recovery_meeting_description(
    fellowship_name: str,
    *,
    attendance: str = "in_person",
    formats: Optional[list[str]] = None,
    location_name: Optional[str] = None,
    notes: Optional[str] = None,
    notes_label: str = "Notes",
    virtual_link_available: bool = False,
    dial_in_available: bool = False,
) -> Optional[str]:
    """Build compact factual copy for recurring recovery meetings."""
    fellowship_clean = _normalize(fellowship_name)
    location_clean = _normalize(location_name)
    notes_clean = _normalize(notes)
    notes_label_clean = _normalize(notes_label) or "Notes"
    attendance_clean = _normalize(attendance).lower().replace("-", "_")

    if not fellowship_clean:
        return None

    if attendance_clean == "hybrid":
        lead = (
            f"{fellowship_clean} peer-support meeting (hybrid: in-person and online)."
        )
    elif attendance_clean == "online":
        lead = f"{fellowship_clean} peer-support meeting (online)."
    else:
        lead = f"{fellowship_clean} peer-support meeting (in-person)."

    parts = [lead]

    cleaned_formats = [
        _normalize(value) for value in (formats or []) if _normalize(value)
    ]
    if cleaned_formats:
        parts.append(f"Format: {', '.join(cleaned_formats)}.")

    if location_clean and attendance_clean != "online":
        parts.append(f"Location: {location_clean}.")

    if notes_clean:
        parts.append(f"{notes_label_clean}: {notes_clean}.")

    if virtual_link_available:
        parts.append("Virtual meeting link available.")

    if dial_in_available:
        parts.append("Dial-in available.")

    return " ".join(" ".join(parts).split())
