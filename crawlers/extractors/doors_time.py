"""
Shared extractor for doors_time from free-text event descriptions.

Usage:
    from extractors.doors_time import extract_doors_time
    doors = extract_doors_time(text)  # Returns "HH:MM" (24-hour) or None
"""

from __future__ import annotations

import re
from typing import Optional

# Ordered most-specific to least-specific to avoid greedy ambiguity.
# Pattern 1: "Doors open at 7 PM", "Doors 7PM", "Door at 9:30 pm"
# Pattern 2: "Doors: 8:30 pm", "Doors- 8 PM"
# Pattern 3: "7:00 PM Doors", "9pm Doors"
_DOORS_PATTERNS = [
    re.compile(
        r"doors?\s*(?:open)?\s*(?:at)?\s*[:\-]?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"doors?\s*[:\-]\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*doors?",
        re.IGNORECASE,
    ),
]


def _normalize_ampm(raw: str) -> str:
    """Collapse 'a.m.'/'p.m.' variants to 'AM'/'PM'."""
    return raw.replace(".", "").upper().strip()


def _to_24h(hour: int, minute: int, ampm: str) -> str:
    """Convert 12-hour (hour, minute, ampm) to 'HH:MM' string."""
    ampm = _normalize_ampm(ampm)
    if ampm == "PM" and hour != 12:
        hour += 12
    elif ampm == "AM" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def extract_doors_time(text: Optional[str]) -> Optional[str]:
    """Return the doors time as 'HH:MM' (24-hour) or None.

    Scans text for patterns like:
      "Doors open at 7 PM"  -> "19:00"
      "doors: 8:30 pm"      -> "20:30"
      "DOORS 7PM / SHOW 8PM" -> "19:00"
      "7:00 PM Doors"       -> "19:00"

    Returns None if text is None, empty, or no doors pattern is found.
    O(len(text)) per pattern — pure, no I/O.
    """
    if not text:
        return None

    for pattern in _DOORS_PATTERNS:
        m = pattern.search(text)
        if m:
            hour = int(m.group(1))
            minute = int(m.group(2)) if m.group(2) else 0
            ampm = m.group(3)
            return _to_24h(hour, minute, ampm)

    return None
