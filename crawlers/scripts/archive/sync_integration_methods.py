#!/usr/bin/env python3
"""
Sync sources.integration_method from pipeline profiles.

Usage:
  python scripts/sync_integration_methods.py --dry-run
  python scripts/sync_integration_methods.py --apply
  python scripts/sync_integration_methods.py --slugs the-earl ticketmaster
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, Iterable

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client
from pipeline.loader import load_profile, PROFILE_DIR


AGGREGATOR_ADAPTERS = {"ticketmaster", "eventbrite"}


def _iter_profile_slugs() -> Iterable[str]:
    seen = set()
    for path in PROFILE_DIR.glob("*.json"):
        slug = path.stem
        if slug in seen:
            continue
        seen.add(slug)
        yield slug
    for path in PROFILE_DIR.glob("*.yml"):
        slug = path.stem
        if slug in seen:
            continue
        seen.add(slug)
        yield slug
    for path in PROFILE_DIR.glob("*.yaml"):
        slug = path.stem
        if slug in seen:
            continue
        seen.add(slug)
        yield slug


def _infer_method(profile) -> str:
    if profile.integration_method:
        return profile.integration_method

    if profile.discovery.type == "api":
        if profile.discovery.api and profile.discovery.api.adapter in AGGREGATOR_ADAPTERS:
            return "aggregator"
        return "api"

    if profile.discovery.type == "feed":
        return "feed"

    if profile.detail.jsonld_only:
        return "jsonld_only"

    if profile.discovery.type == "html":
        return "llm_crawler"

    if profile.detail.use_llm:
        return "llm_extraction"

    if profile.discovery.fetch.render_js or profile.detail.fetch.render_js:
        return "playwright"

    return "html"


def _load_methods(slugs: Iterable[str]) -> Dict[str, str]:
    methods: Dict[str, str] = {}
    for slug in slugs:
        profile = load_profile(slug)
        methods[slug] = _infer_method(profile)
    return methods


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync sources.integration_method from profiles")
    parser.add_argument("--apply", action="store_true", help="Apply updates to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Print updates without writing (default)")
    parser.add_argument("--slugs", nargs="*", default=None, help="Limit to specific slugs")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    slugs = args.slugs or list(_iter_profile_slugs())
    methods = _load_methods(slugs)

    print("Integration method updates:")
    for slug, method in sorted(methods.items()):
        print(f"  - {slug}: {method}")

    if args.dry_run:
        print("\nDry run only; no updates applied.")
        return

    client = get_client()
    for slug, method in methods.items():
        try:
            res = client.table("sources").update({"integration_method": method}).eq("slug", slug).execute()
            if getattr(res, "data", None) is None:
                print(f"[warn] No response for {slug}")
        except Exception as e:
            print(f"[error] Failed to update {slug}: {e}")


if __name__ == "__main__":
    main()
