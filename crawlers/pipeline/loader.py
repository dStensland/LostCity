"""
Load source profiles from YAML/JSON files.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from pipeline.models import SourceProfile, SourceProfileV2, FetchConfigV2, ParseConfigV2, DefaultsConfigV2


PROFILE_DIR = Path(__file__).resolve().parent.parent / "sources" / "profiles"
PROFILE_FILENAMES = ("{slug}.json", "{slug}.yaml", "{slug}.yml")

# Maps v1 data_goals values to v2 entity_lane names.
_DATA_GOAL_TO_LANE: dict[str, str] = {
    "events": "events",
    "exhibits": "exhibitions",
    "classes": "programs",
    "images": "destination_details",
}

# Maps v1 integration_method to (fetch_method, parse_method).
_INTEGRATION_METHOD_MAP: dict[str, tuple[str, str]] = {
    "html": ("static", "llm"),
    "api": ("api", "api_adapter"),
    "playwright": ("playwright", "llm"),
    "llm_crawler": ("static", "llm"),
}


def _load_data(path: Path) -> dict:
    if path.suffix in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError as e:
            raise ImportError("pyyaml is required to load YAML profiles") from e
        with path.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    if path.suffix == ".json":
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def find_profile_path(slug: str, base_dir: Optional[Path] = None) -> Optional[Path]:
    base = base_dir or PROFILE_DIR
    for tmpl in PROFILE_FILENAMES:
        candidate = base / tmpl.format(slug=slug)
        if candidate.exists():
            return candidate
    return None


def normalize_to_v2(data: dict) -> SourceProfileV2:
    """Convert a raw profile dict (v1 or v2) to a SourceProfileV2 instance.

    v2 profiles (version >= 2) are passed through directly via SourceProfileV2(**data).
    v1 profiles are normalized using the integration_method → fetch/parse mapping,
    discovery.urls → fetch.urls, and data_goals → entity_lanes.
    """
    version = data.get("version", 1)

    if version >= 2:
        return SourceProfileV2(**data)

    # --- v1 → v2 normalization ---
    integration_method = data.get("integration_method") or "html"
    fetch_method, parse_method = _INTEGRATION_METHOD_MAP.get(
        integration_method, ("static", "llm")
    )

    # render_js=True on discovery.fetch overrides fetch_method to playwright
    discovery = data.get("discovery") or {}
    discovery_fetch = discovery.get("fetch") or {}
    if discovery_fetch.get("render_js"):
        fetch_method = "playwright"

    urls: list[str] = discovery.get("urls") or []

    # Map data_goals to entity_lanes; unknown goals are dropped silently
    data_goals: list[str] = data.get("data_goals") or []
    entity_lanes: list[str] = []
    for goal in data_goals:
        lane = _DATA_GOAL_TO_LANE.get(goal)
        if lane and lane not in entity_lanes:
            entity_lanes.append(lane)
    if not entity_lanes:
        entity_lanes = ["events"]

    # Preserve defaults (category, tags)
    v1_defaults = data.get("defaults") or {}

    # Carry the detail block forward unchanged if present
    v1_detail = data.get("detail") or {}

    return SourceProfileV2(
        version=2,
        slug=data["slug"],
        name=data["name"],
        city=data.get("city", "atlanta"),
        portal_id=data.get("portal_id"),
        fetch=FetchConfigV2(method=fetch_method, urls=urls),
        parse=ParseConfigV2(method=parse_method),
        entity_lanes=entity_lanes,
        defaults=DefaultsConfigV2(
            category=v1_defaults.get("category"),
            tags=v1_defaults.get("tags") or [],
        ),
        **({} if not v1_detail else {"detail": v1_detail}),
    )


def load_profile(slug: str, base_dir: Optional[Path] = None) -> SourceProfileV2:
    """Load a source profile by slug and return a normalized SourceProfileV2.

    Accepts both v1 and v2 profile files on disk. v1 files are automatically
    normalized to v2 via normalize_to_v2().
    """
    path = find_profile_path(slug, base_dir=base_dir)
    if not path:
        raise FileNotFoundError(f"No profile found for '{slug}' in {base_dir or PROFILE_DIR}")
    data = _load_data(path)
    return normalize_to_v2(data)
