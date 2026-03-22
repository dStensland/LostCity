"""
generate_v2_profile.py — reads a legacy Python crawler and generates a v2 YAML profile.

Usage:
    python scripts/generate_v2_profile.py sources/a_cappella_books.py
    python scripts/generate_v2_profile.py --batch sources/*.py
    python scripts/generate_v2_profile.py sources/high_museum.py --dry-run

Output:
    sources/profiles/<slug>.yaml   (unless --dry-run)
"""

from __future__ import annotations

import ast
import argparse
import logging
import re
import sys
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Venue-type → default category mapping (mirrors normalize_categories.py)
# ---------------------------------------------------------------------------

VENUE_TYPE_TO_CATEGORY: dict[str, str] = {
    "music_venue": "music",
    "concert_hall": "music",
    "amphitheater": "music",
    "nightclub": "nightlife",
    "bar": "nightlife",
    "sports_bar": "sports",
    "comedy_club": "comedy",
    "cinema": "film",
    "theater": "theater",
    "gallery": "art",
    "museum": "art",
    "brewery": "food_drink",
    "restaurant": "food_drink",
    "winery": "food_drink",
    "distillery": "food_drink",
    "food_hall": "food_drink",
    "stadium": "sports",
    "arena": "sports",
    "park": "outdoor",
    "garden": "outdoor",
    "library": "community",
    "bookstore": "words",
    "church": "community",
    "community_center": "community",
    "fitness_center": "fitness",
    "coffee_shop": "community",
    "coworking": "community",
    "college": "learning",
    "university": "learning",
}

# URL constants we look for
_URL_CONST_PATTERN = re.compile(
    r'^(BASE_URL|EVENTS_URL|CALENDAR_URL)\s*=\s*["\']([^"\']+)["\']',
    re.MULTILINE,
)

# F-string URL constants like: EVENTS_URL = f"{BASE_URL}/events"
_FSTRING_URL_PATTERN = re.compile(
    r'^(EVENTS_URL|CALENDAR_URL)\s*=\s*f["\']([^"\']+)["\']',
    re.MULTILINE,
)

# Explicit "category": "value" inside an event dict anywhere in the source
_EXPLICIT_CATEGORY_PATTERN = re.compile(
    r'"category"\s*:\s*"([a-z_]+)"'
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def extract_profile_data(source_code: str, module_name: str) -> dict[str, Any]:
    """
    Parse a legacy crawler source and return a structured dict:

    {
        "venue_data": {...},        # contents of VENUE_DATA = {...}
        "fetch_method": "static" | "playwright",
        "urls": {
            "BASE_URL": "https://...",
            "EVENTS_URL": "https://...",  # if present
            "CALENDAR_URL": "https://...",  # if present
        },
        "category": "music" | ... | None,
    }
    """
    venue_data = _extract_venue_data(source_code)
    fetch_method = _detect_fetch_method(source_code)
    urls = _extract_url_constants(source_code)
    category = _infer_category(source_code, venue_data)

    return {
        "venue_data": venue_data,
        "fetch_method": fetch_method,
        "urls": urls,
        "category": category,
    }


def generate_v2_yaml(data: dict[str, Any]) -> str:
    """
    Given the dict produced by extract_profile_data (plus 'slug' and 'name'),
    return a v2 profile YAML string.
    """
    urls = data.get("urls", {})

    # Prefer EVENTS_URL > CALENDAR_URL > BASE_URL for the fetch url list.
    fetch_url = (
        urls.get("EVENTS_URL")
        or urls.get("CALENDAR_URL")
        or urls.get("BASE_URL")
        or ""
    )
    fetch_urls = [fetch_url] if fetch_url else []

    venue_data = data.get("venue_data", {})
    category = data.get("category")

    profile: dict[str, Any] = {
        "version": 2,
        "slug": data.get("slug", ""),
        "name": data.get("name", venue_data.get("name", "")),
        "city": venue_data.get("city", "atlanta").lower() if venue_data.get("city") else "atlanta",
        "fetch": {
            "method": data.get("fetch_method", "static"),
            "urls": fetch_urls,
        },
        "parse": {
            "method": "llm",
        },
        "entity_lanes": ["events"],
        "venue": _build_venue_block(venue_data),
        "defaults": {
            "category": category,
            "tags": _infer_default_tags(venue_data),
        },
    }

    # yaml.dump sorts keys by default — preserve insertion order for readability
    return yaml.dump(profile, default_flow_style=False, allow_unicode=True, sort_keys=False)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _extract_venue_data(source_code: str) -> dict[str, Any]:
    """
    Find the VENUE_DATA = {...} assignment and return its value as a dict.

    Strategy:
    1. Walk the AST looking for a module-level assignment `VENUE_DATA = {...}`.
    2. Use ast.literal_eval() on the RHS node.
    3. Fall back to regex if AST parsing fails.
    """
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return _extract_venue_data_regex(source_code)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "VENUE_DATA":
                try:
                    return ast.literal_eval(node.value)
                except (ValueError, TypeError):
                    # Dict may contain f-strings or non-literal values.
                    # Fall back to extracting what we can.
                    return _extract_partial_dict(node.value)

    return _extract_venue_data_regex(source_code)


def _extract_partial_dict(node: ast.AST) -> dict[str, Any]:
    """
    Best-effort extraction of a dict node that contains non-literal values
    (e.g., f-strings, variable references).  Only extracts str/int/float/bool/None
    values; skips anything more complex.
    """
    if not isinstance(node, ast.Dict):
        return {}

    result: dict[str, Any] = {}
    for key_node, val_node in zip(node.keys, node.values):
        if not isinstance(key_node, ast.Constant):
            continue
        key = key_node.value
        try:
            result[key] = ast.literal_eval(val_node)
        except (ValueError, TypeError):
            # Skip f-strings, variable refs, etc.
            pass
    return result


def _extract_venue_data_regex(source_code: str) -> dict[str, Any]:
    """
    Regex fallback: find VENUE_DATA = { ... } block and extract simple
    string/number key-value pairs.
    """
    match = re.search(
        r'VENUE_DATA\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}',
        source_code,
        re.DOTALL,
    )
    if not match:
        return {}

    body = match.group(1)
    result: dict[str, Any] = {}
    for kv_match in re.finditer(r'"(\w+)"\s*:\s*"([^"]*)"', body):
        result[kv_match.group(1)] = kv_match.group(2)
    return result


def _detect_fetch_method(source_code: str) -> str:
    """
    Return 'playwright' if the source references playwright, else 'static'.
    """
    if "playwright" in source_code:
        return "playwright"
    return "static"


def _extract_url_constants(source_code: str) -> dict[str, str]:
    """
    Extract BASE_URL, EVENTS_URL, and CALENDAR_URL literal string constants.

    For f-string assignments like `EVENTS_URL = f"{BASE_URL}/events/"`, we
    resolve by substituting the known BASE_URL value if available.
    """
    urls: dict[str, str] = {}

    # First pass: plain string assignments
    for match in _URL_CONST_PATTERN.finditer(source_code):
        name, value = match.group(1), match.group(2)
        urls[name] = value

    # Second pass: f-string assignments — resolve against known BASE_URL
    for match in _FSTRING_URL_PATTERN.finditer(source_code):
        name = match.group(1)
        if name in urls:
            continue  # already captured as plain string
        template = match.group(2)
        base = urls.get("BASE_URL", "")
        if base:
            resolved = template.replace("{BASE_URL}", base)
        else:
            # Leave the template fragment as-is so callers still see the path
            resolved = template
        urls[name] = resolved

    return urls


def _infer_category(source_code: str, venue_data: dict[str, Any]) -> str | None:
    """
    Infer category in priority order:
    1. Explicit `"category": "value"` inside an event dict in the source.
    2. venue_type → category mapping.
    3. None.
    """
    # Check for explicit category strings in event records
    explicit_matches = _EXPLICIT_CATEGORY_PATTERN.findall(source_code)
    # Filter out venue-level "category" keys that might appear in VENUE_DATA
    # by using a heuristic: skip if the value looks like a venue taxonomy term.
    venue_taxonomy_values = {
        "admission", "amenity", "feature", "art_museum",  # destination fields
    }
    for match in explicit_matches:
        if match not in venue_taxonomy_values:
            return match

    venue_type = venue_data.get("venue_type", "")
    if venue_type in VENUE_TYPE_TO_CATEGORY:
        return VENUE_TYPE_TO_CATEGORY[venue_type]

    return None


def _infer_default_tags(venue_data: dict[str, Any]) -> list[str]:
    """Produce a minimal default tag list from venue_data."""
    tags: list[str] = []
    slug = venue_data.get("slug", "")
    if slug:
        tags.append(slug)
    return tags


def _build_venue_block(venue_data: dict[str, Any]) -> dict[str, Any]:
    """
    Build the venue sub-dict for the profile, keeping only the fields
    relevant to the v2 schema.
    """
    fields = [
        "name", "slug", "address", "neighborhood", "city", "state", "zip",
        "lat", "lng", "venue_type", "spot_type", "website",
    ]
    return {k: venue_data[k] for k in fields if k in venue_data}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _slug_from_path(path: Path) -> str:
    """Derive a slug from a source file path: a_cappella_books → a-cappella-books"""
    return path.stem.replace("_", "-")


def _process_file(
    source_path: Path,
    output_dir: Path,
    dry_run: bool = False,
) -> bool:
    """
    Process a single source file.  Returns True on success.
    """
    try:
        source_code = source_path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("Cannot read %s: %s", source_path, exc)
        return False

    module_name = source_path.stem
    slug = _slug_from_path(source_path)

    data = extract_profile_data(source_code, module_name)
    data["slug"] = slug
    data["name"] = data["venue_data"].get("name", slug)

    yaml_str = generate_v2_yaml(data)

    if dry_run:
        print(f"--- {slug}.yaml ---")
        print(yaml_str)
        return True

    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{slug}.yaml"
    out_path.write_text(yaml_str, encoding="utf-8")
    print(f"Written: {out_path}")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate v2 YAML profiles from legacy Python crawler files."
    )
    parser.add_argument(
        "sources",
        nargs="+",
        help="Path(s) to crawler source file(s). Supports shell glob expansion.",
    )
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Process multiple files (same as listing them; kept for documentation).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print generated YAML to stdout without writing files.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory for profiles (default: sources/profiles/ relative to first source).",
    )

    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(message)s",
    )

    source_paths = [Path(p) for p in args.sources]

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        # Default: sibling profiles/ directory next to the source files
        output_dir = source_paths[0].parent / "profiles"

    success_count = 0
    for path in source_paths:
        if _process_file(path, output_dir, dry_run=args.dry_run):
            success_count += 1

    total = len(source_paths)
    if total > 1:
        print(f"\n{success_count}/{total} profiles generated.")

    return 0 if success_count == total else 1


if __name__ == "__main__":
    sys.exit(main())
