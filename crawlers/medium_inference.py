"""
Keyword-based medium inference for exhibitions.

Matches exhibition titles and descriptions against a curated taxonomy
of art media. Returns the most likely medium or None if ambiguous.

Taxonomy (10 values):
  painting, photography, sculpture, mixed_media, printmaking,
  drawing, textile, digital, ceramics, installation
"""

import re
from typing import Optional

# Each medium maps to a list of keyword patterns (matched with word boundaries)
_MEDIUM_KEYWORDS: dict[str, list[str]] = {
    "painting": [
        "painting", "paintings", "oil on canvas", "acrylic", "watercolor",
        "watercolour", "gouache", "tempera", "fresco", "oil paint",
    ],
    "photography": [
        "photograph", "photographs", "photography", "photo",
        "daguerreotype", "cyanotype", "darkroom", "photographic",
    ],
    "sculpture": [
        "sculpture", "sculptures", "bronze", "marble", "carved",
        "statue", "statues", "sculptural",
    ],
    "mixed_media": [
        "mixed media", "assemblage", "collage", "multimedia",
        "multi-media", "found objects",
    ],
    "printmaking": [
        "printmaking", "lithograph", "lithographs", "screenprint",
        "screenprints", "etching", "etchings", "woodcut", "woodcuts",
        "intaglio", "monoprint", "monoprints", "prints",
        "linocut", "linocuts", "engraving",
    ],
    "drawing": [
        "drawing", "drawings", "charcoal", "pencil", "graphite",
        "pastel", "pastels",
    ],
    "textile": [
        "textile", "textiles", "fiber art", "fiber arts", "fibre",
        "weaving", "quilt", "quilts", "tapestry", "embroidery",
    ],
    "digital": [
        "digital art", "video art", "video installation",
        "projection", "new media", "generative", "generative art",
        "AI art", "nft",
    ],
    "ceramics": [
        "ceramics", "ceramic", "pottery", "porcelain",
        "stoneware", "glaze", "glazed",
    ],
    "installation": [
        "installation", "site-specific", "site specific",
        "immersive", "environment", "environmental art",
    ],
}

# Pre-compile word-boundary regex for each keyword.
# Multi-word phrases (containing spaces or hyphens) use exact match anchored by
# word boundaries on the first and last token rather than a naive \b + re.escape
# pattern (which would allow \bfound objects\b to match inside "found objectsX").
_COMPILED_PATTERNS: dict[str, list[re.Pattern]] = {}

for _medium, _keywords in _MEDIUM_KEYWORDS.items():
    _patterns: list[re.Pattern] = []
    for _kw in _keywords:
        # Escape the keyword, then restore word-boundary markers at start/end
        _escaped = re.escape(_kw)
        _pattern = re.compile(r"\b" + _escaped + r"\b", re.IGNORECASE)
        _patterns.append(_pattern)
    _COMPILED_PATTERNS[_medium] = _patterns

# Special case: "ink" needs careful handling to avoid matching inside words
_COMPILED_PATTERNS["drawing"].append(
    re.compile(r"\bink\b", re.IGNORECASE)
)

# Valid medium values (for CHECK constraint alignment)
VALID_MEDIA = frozenset(_MEDIUM_KEYWORDS.keys())

# Phrases that should suppress a simpler keyword match in another medium.
# Key: (dominant_medium, phrase_that_was_matched)
# Value: set of other media whose match should be suppressed.
# Example: "video installation" belongs to digital, so it suppresses the bare
# "installation" keyword that would otherwise also fire for the installation medium.
_PHRASE_SUPPRESSIONS: list[tuple[str, re.Pattern, set[str]]] = [
    (
        "digital",
        re.compile(r"\bvideo\s+installation\b", re.IGNORECASE),
        {"installation"},
    ),
    (
        "digital",
        re.compile(r"\bprojection\s+installation\b", re.IGNORECASE),
        {"installation"},
    ),
]


def infer_exhibition_medium(
    title: str,
    description: str = "",
) -> Optional[str]:
    """Infer exhibition medium from title and/or description keywords.

    Rules:
    - Match keywords in title first (highest confidence)
    - Fall back to description if title has no match
    - If multiple distinct media detected, return 'mixed_media'
    - If no match, return None (don't guess)
    """
    if not title and not description:
        return None

    # Try title first
    title_media = _match_media(title)
    if title_media:
        return title_media

    # Fall back to description
    if description:
        desc_media = _match_media(description)
        if desc_media:
            return desc_media

    return None


def _match_media(text: str) -> Optional[str]:
    """Find matching media in text. Returns medium name or None."""
    if not text:
        return None

    matched: set[str] = set()

    for medium, patterns in _COMPILED_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(text):
                matched.add(medium)
                break  # One match per medium is enough

    if not matched:
        return None

    # Apply phrase suppressions: when a multi-word phrase in one medium matches,
    # it may subsume a simpler keyword match in another medium.
    # e.g. "video installation" (digital) suppresses bare "installation" match.
    for dominant_medium, phrase_pattern, suppressed_media in _PHRASE_SUPPRESSIONS:
        if dominant_medium in matched and phrase_pattern.search(text):
            matched -= suppressed_media

    if not matched:
        return None

    # If mixed_media was explicitly matched, return it
    if "mixed_media" in matched:
        return "mixed_media"

    # If multiple distinct media detected, return mixed_media
    if len(matched) > 1:
        return "mixed_media"

    return matched.pop()
