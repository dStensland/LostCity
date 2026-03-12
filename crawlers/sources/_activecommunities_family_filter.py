"""
Shared family-relevance filter for broad ACTIVENet civic catalogs.
"""

from __future__ import annotations

import re
from typing import Optional

_FAMILY_SIGNAL_RE = re.compile(
    r"\bfamily\b|\byouth\b|\bkids?\b|\bchild(?:ren)?\b|\bteen\b|\btween\b|"
    r"\bjunior\b|\bpreschool\b|\btoddler\b|\bcamp\b",
    re.IGNORECASE,
)
_ADULT_SIGNAL_RE = re.compile(
    r"\badult\b|\bsenior\b|\bolder adult\b|\b55\+\b|\b50\+\b|\bprimetime\b|\bgold\b|"
    r"\bmen'?s\b|\bwomen'?s\b",
    re.IGNORECASE,
)


def is_family_relevant_activity(
    *,
    name: str,
    desc_text: str,
    age_min: Optional[int],
    age_max: Optional[int],
    category: str,
    tags: list[str],
    blocked_keywords: Optional[list[str]] = None,
) -> bool:
    """Return True when an ACTIVENet activity belongs in Hooky's family lane."""
    combined = f"{name} {desc_text}".lower()

    if blocked_keywords and any(keyword in combined for keyword in blocked_keywords):
        return False

    if age_min is not None and age_min >= 18:
        return False
    if age_max is not None and age_max <= 18:
        return True
    if age_min is not None and age_min < 18:
        return True

    if _ADULT_SIGNAL_RE.search(combined):
        return False

    if any(tag in tags for tag in ("kids", "preschool", "elementary", "tween", "teen")):
        return True
    if category == "family":
        return True
    if _FAMILY_SIGNAL_RE.search(combined):
        return True
    return False
