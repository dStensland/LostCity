"""
Load source profiles from YAML/JSON files.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from pipeline.models import SourceProfile


PROFILE_DIR = Path(__file__).resolve().parent.parent / "sources" / "profiles"
PROFILE_FILENAMES = ("{slug}.json", "{slug}.yaml", "{slug}.yml")


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


def load_profile(slug: str, base_dir: Optional[Path] = None) -> SourceProfile:
    path = find_profile_path(slug, base_dir=base_dir)
    if not path:
        raise FileNotFoundError(f"No profile found for '{slug}' in {base_dir or PROFILE_DIR}")
    data = _load_data(path)
    return SourceProfile(**data)
