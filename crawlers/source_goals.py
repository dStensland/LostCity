"""
Source data-goal resolution.

Profiles can explicitly declare `data_goals`; when absent we infer sensible goals
from source/venue context so every crawler target has a declared intent set.
"""

from __future__ import annotations

from typing import Optional

from pipeline.loader import load_profile

VALID_DATA_GOALS = {
    "events",
    "exhibits",
    "specials",
    "classes",
    "showtimes",
    "lineup",
    "tickets",
    "images",
    "venue_hours",
}

GOAL_ALIASES = {
    "event": "events",
    "exhibit": "exhibits",
    "exhibitions": "exhibits",
    "special": "specials",
    "deals": "specials",
    "class": "classes",
    "workshops": "classes",
    "workshop": "classes",
    "artist_lineup": "lineup",
    "artists": "lineup",
    "teams": "lineup",
    "ticketing": "tickets",
    "photos": "images",
    "image": "images",
    "hours": "venue_hours",
}


def normalize_goal(goal: str) -> Optional[str]:
    value = (goal or "").strip().lower()
    if not value:
        return None
    value = GOAL_ALIASES.get(value, value)
    if value not in VALID_DATA_GOALS:
        return None
    return value


def infer_data_goals(
    source_slug: str,
    source_name: str = "",
    venue_type: Optional[str] = None,
    spot_type: Optional[str] = None,
) -> list[str]:
    """
    Infer reasonable data goals for a source when profile-level goals are absent.
    """
    slug = (source_slug or "").lower()
    name = (source_name or "").lower()
    venue = (venue_type or spot_type or "").lower()
    combined = f"{slug} {name} {venue}"

    goals = {"events", "tickets", "images"}

    if any(
        token in combined
        for token in (
            "museum",
            "gallery",
            "botanical",
            "garden",
            "aquarium",
            "zoo",
            "arboretum",
            "history center",
            "science center",
            "planetarium",
            "exhibit",
        )
    ):
        goals.add("exhibits")

    if any(
        token in combined
        for token in (
            "bar",
            "restaurant",
            "brew",
            "pub",
            "special",
            "happy-hour",
            "happy hour",
            "hotel",
            "dining",
        )
    ):
        goals.add("specials")
        goals.add("venue_hours")

    if any(
        token in combined
        for token in (
            "class",
            "workshop",
            "studio",
            "yoga",
            "school",
            "academy",
            "training",
        )
    ):
        goals.add("classes")

    if any(
        token in combined
        for token in (
            "cinema",
            "theatre",
            "theater",
            "film",
            "movie",
            "drive-in",
        )
    ):
        goals.add("showtimes")

    if any(
        token in combined
        for token in (
            "music",
            "concert",
            "club",
            "comedy",
            "arena",
            "stadium",
            "ballpark",
            "sports",
            "festival",
            "venue",
        )
    ):
        goals.add("lineup")

    return sorted(goals)


def resolve_source_data_goals(
    source_slug: str,
    source_name: str = "",
    venue_type: Optional[str] = None,
    spot_type: Optional[str] = None,
) -> tuple[list[str], str]:
    """
    Resolve source data goals from profile config or inferred fallback.

    Returns:
      (goals, mode) where mode in {"profile", "inferred"}
    """
    try:
        profile = load_profile(source_slug)
        profile_goals = [normalize_goal(goal) for goal in (profile.data_goals or [])]
        goals = sorted({goal for goal in profile_goals if goal})
        if goals:
            return goals, "profile"
    except Exception:
        pass

    return (
        infer_data_goals(
            source_slug=source_slug,
            source_name=source_name,
            venue_type=venue_type,
            spot_type=spot_type,
        ),
        "inferred",
    )
