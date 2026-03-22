"""
Migration status reporter — tracks v2 profile adoption across crawler sources.

Reports which sources have a profile YAML, which have a module (.py), which have
both, and computes adoption percentages.

Usage:
    python scripts/migration_status.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _crawlers_root() -> Path:
    """Return the absolute path to the crawlers/ directory."""
    return Path(__file__).resolve().parent.parent


def get_module_slugs() -> set[str]:
    """
    Scan sources/*.py, convert filenames to slugs (underscore → hyphen).

    Skips:
    - Files prefixed with _ (private/base modules)
    - __init__.py
    """
    sources_dir = _crawlers_root() / "sources"
    slugs: set[str] = set()
    for path in sources_dir.glob("*.py"):
        stem = path.stem
        if stem.startswith("_"):
            continue
        slug = stem.replace("_", "-")
        slugs.add(slug)
    return slugs


def get_profile_slugs() -> set[str]:
    """
    Scan sources/profiles/*.yaml and *.yml, return slugs derived from filenames.

    The slug is the filename stem (no extension). Profile filenames already use
    hyphens by convention (e.g. my-source.yaml → my-source).
    """
    profiles_dir = _crawlers_root() / "sources" / "profiles"
    if not profiles_dir.exists():
        return set()

    slugs: set[str] = set()
    for ext in ("*.yaml", "*.yml"):
        for path in profiles_dir.glob(ext):
            slugs.add(path.stem)
    return slugs


def get_archived_slugs() -> set[str]:
    """
    Scan sources/archive/*.py if the directory exists.

    Skips _ prefixed files and __init__.py, same as get_module_slugs().
    """
    archive_dir = _crawlers_root() / "sources" / "archive"
    if not archive_dir.exists():
        return set()

    slugs: set[str] = set()
    for path in archive_dir.glob("*.py"):
        stem = path.stem
        if stem.startswith("_"):
            continue
        slug = stem.replace("_", "-")
        slugs.add(slug)
    return slugs


def compute_migration_status(
    profiles: set[str],
    modules: set[str],
) -> dict[str, object]:
    """
    Compute migration status from two slug sets.

    Args:
        profiles: set of slugs that have a profile YAML
        modules:  set of slugs that have a source module (.py)

    Returns a dict with keys:
        total          — unique slugs across both sets
        profile_only   — slugs with a profile but no module (legacy-pending)
        module_only    — slugs with a module but no profile (not yet migrated)
        both           — slugs that have both profile and module
        pct_migrated   — percentage of total with both profile+module
        pct_legacy     — percentage of total that are profile-only
        pct_transitional — percentage of total that are module-only
    """
    both = profiles & modules
    profile_only = profiles - modules
    module_only = modules - profiles
    total = len(profiles | modules)

    def pct(n: int) -> float:
        if total == 0:
            return 0.0
        return round(n / total * 100, 1)

    return {
        "total": total,
        "both": len(both),
        "profile_only": len(profile_only),
        "module_only": len(module_only),
        "pct_migrated": pct(len(both)),
        "pct_legacy": pct(len(profile_only)),
        "pct_transitional": pct(len(module_only)),
    }


def _print_summary(
    status: dict[str, object],
    profiles: set[str],
    modules: set[str],
    archived: set[str],
) -> None:
    total = status["total"]
    both = status["both"]
    profile_only = status["profile_only"]
    module_only = status["module_only"]

    print("=" * 54)
    print("  Crawler Migration Status Report")
    print("=" * 54)
    print(f"  Total unique sources   : {total}")
    print(f"  Profile YAMLs          : {len(profiles)}")
    print(f"  Source modules (.py)   : {len(modules)}")
    if archived:
        print(f"  Archived modules       : {len(archived)}")
    print()
    print(f"  Both profile + module  : {both:>4}  ({status['pct_migrated']}%)")
    print(f"  Profile only (legacy)  : {profile_only:>4}  ({status['pct_legacy']}%)")
    print(f"  Module only (no profile): {module_only:>4}  ({status['pct_transitional']}%)")
    print("=" * 54)

    if profile_only > 0:
        only_set = sorted(profiles - modules)
        preview = ", ".join(only_set[:5])
        suffix = f", ... +{profile_only - 5} more" if profile_only > 5 else ""
        print(f"\n  Profile-only (first 5): {preview}{suffix}")

    if module_only > 0:
        only_set = sorted(modules - profiles)
        preview = ", ".join(only_set[:5])
        suffix = f", ... +{module_only - 5} more" if module_only > 5 else ""
        print(f"\n  Module-only (first 5): {preview}{suffix}")

    print()


def main() -> None:
    profiles = get_profile_slugs()
    modules = get_module_slugs()
    archived = get_archived_slugs()
    status = compute_migration_status(profiles, modules)
    _print_summary(status, profiles, modules, archived)


if __name__ == "__main__":
    main()
