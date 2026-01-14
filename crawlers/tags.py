"""
Canonical tag definitions for Lost City events.
Tags are organized into three categories: experiential, practical, and content.
"""

from __future__ import annotations

# Experiential tags (mood/vibe)
EXPERIENTIAL_TAGS = {
    "date-night",      # Romantic atmosphere
    "chill",           # Relaxed, low-key
    "high-energy",     # Loud, exciting, dancing
    "intimate",        # Small crowd, personal
    "rowdy",           # Party atmosphere
}

# Practical tags (attributes)
PRACTICAL_TAGS = {
    "free",            # No cost
    "ticketed",        # Requires tickets
    "21+",             # Age restricted
    "all-ages",        # No age restrictions
    "family-friendly", # Good for kids
    "outdoor",         # Outside event
    "accessible",      # Wheelchair accessible
    "rsvp-required",   # Must register
    "sold-out",        # No tickets available
    "limited-seating", # Small capacity
}

# Content tags (what it is)
CONTENT_TAGS = {
    "local-artist",    # Local/regional act
    "touring",         # National/international tour
    "debut",           # First show/premiere
    "album-release",   # Album release show
    "holiday",         # Holiday-themed
    "seasonal",        # Seasonal event
    "one-night-only",  # Single performance
    "opening-night",   # Theater/show opening
    "closing-night",   # Final performance
}

# Combined set of all valid tags
ALL_TAGS = EXPERIENTIAL_TAGS | PRACTICAL_TAGS | CONTENT_TAGS

# Tags that can be inherited from venue vibes
INHERITABLE_VIBES = {
    "intimate",
    "all-ages",
    "family-friendly",
    "outdoor-seating",  # Maps to "outdoor" tag
}

# Mapping from venue vibe to event tag (when different)
VIBE_TO_TAG = {
    "outdoor-seating": "outdoor",
}
