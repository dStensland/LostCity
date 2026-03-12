"""Shared helpers for Atlanta sports-bar and watch-party crawlers."""

from __future__ import annotations

from typing import Iterable


SPORT_KEYWORDS = {
    "soccer": (
        "soccer",
        "atlanta united",
        "atlutd",
        "mls",
        "premier league",
        "champions league",
        "usmnt",
        "uswnt",
        "world cup",
        "fifa",
        "copa america",
        "euros",
        "euro ",
    ),
    "basketball": (
        "basketball",
        "hawks",
        "nba",
        "march madness",
        "final four",
        "ncaa tournament",
        "tip-off",
        "tip off",
        "hoops",
    ),
    "football": (
        "football",
        "nfl",
        "falcons",
        "super bowl",
        "college football",
        "cfb",
        "sec championship",
    ),
    "baseball": (
        "baseball",
        "braves",
        "mlb",
    ),
    "rugby": (
        "rugby",
        "six nations",
    ),
    "hockey": (
        "hockey",
        "nhl",
    ),
}

WATCH_CUES = (
    "watch party",
    "viewing party",
    "game day",
    "gameday",
    "match day",
    "matchday",
)


def detect_sports_watch_party(
    title: str,
    description: str = "",
    extra_tags: Iterable[str] | None = None,
) -> tuple[str, str, list[str]] | None:
    """
    Return a normalized sports/watch-party classification when a title/description
    clearly signals public sports viewing inventory.
    """
    combined = f"{title} {description}".lower()
    detected_sports: list[str] = []

    for tag, keywords in SPORT_KEYWORDS.items():
        if any(keyword in combined for keyword in keywords):
            detected_sports.append(tag)

    has_watch_cue = any(cue in combined for cue in WATCH_CUES)

    if not detected_sports and not has_watch_cue:
        return None

    if not detected_sports:
        return None

    tags = ["sports", "watch-party", *detected_sports]
    if extra_tags:
        tags.extend(extra_tags)

    deduped_tags: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        if tag not in seen:
            deduped_tags.append(tag)
            seen.add(tag)

    return "sports", "watch_party", deduped_tags
