"""
Source-level category defaults for high-volume deterministic sources.
Only add sources where EVERY event has the same category.
"""
from __future__ import annotations
from typing import Optional

_SOURCE_ID_DEFAULTS: dict[int, dict] = {
    554: {"category": "workshops"},   # Painting With a Twist
    808: {"category": "workshops"},   # Spruill Center
    1318: {"category": "education", "genre": "technology"},  # theCoderSchool
}

_SOURCE_NAME_DEFAULTS: list[tuple[str, dict]] = [
    ("AMC ", {"category": "film"}),
    ("Regal ", {"category": "film"}),
]

_SUPPORT_SOURCE_SLUGS = {
    "alcoholics-anonymous-atlanta",
    "narcotics-anonymous-georgia",
    "ga-council-recovery",
}


def get_source_default(
    source_id: int = None, source_name: str = None, source_slug: str = None,
) -> Optional[dict]:
    if source_id and source_id in _SOURCE_ID_DEFAULTS:
        return _SOURCE_ID_DEFAULTS[source_id].copy()
    if source_slug and source_slug in _SUPPORT_SOURCE_SLUGS:
        return {"category": "support"}
    if source_name:
        for prefix, default in _SOURCE_NAME_DEFAULTS:
            if source_name.startswith(prefix):
                return default.copy()
    return None
