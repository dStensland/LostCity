#!/usr/bin/env python3
"""
Infer integration_method from profiles + legacy crawler code to eliminate unknowns.

Priority:
1) Profile signals (discovery.type, jsonld_only, use_llm)
2) URL signals (ticketmaster/eventbrite/meetup/feed)
3) Legacy crawler code signals (playwright/feed/api hints)
4) Default to html

Usage:
  python scripts/infer_integration_methods_from_code.py --dry-run
  python scripts/infer_integration_methods_from_code.py --apply --output tmp/infer_report.json
  python scripts/infer_integration_methods_from_code.py --apply --limit 100
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    import yaml  # type: ignore
except Exception:
    yaml = None

PROFILE_DIR = ROOT / "sources" / "profiles"
SOURCES_DIR = ROOT / "sources"
MAIN_PATH = ROOT / "main.py"


def _load_profiles() -> Dict[str, Path]:
    profiles: Dict[str, Path] = {}
    for path in PROFILE_DIR.glob("*.json"):
        profiles[path.stem] = path
    for path in PROFILE_DIR.glob("*.yaml"):
        profiles.setdefault(path.stem, path)
    for path in PROFILE_DIR.glob("*.yml"):
        profiles.setdefault(path.stem, path)
    return profiles


def _load_profile_data(path: Path) -> dict:
    if path.suffix == ".json":
        return json.loads(path.read_text(encoding="utf-8"))
    text = path.read_text(encoding="utf-8")
    if yaml is not None:
        try:
            return yaml.safe_load(text) or {}
        except Exception:
            pass
    # Minimal YAML fallback for stubs
    data: dict = {}
    for line in text.splitlines():
        if line.strip().startswith("integration_method:"):
            data["integration_method"] = line.split(":", 1)[1].strip().strip("'\"")
        if line.strip().startswith("type:"):
            data.setdefault("discovery", {})["type"] = line.split(":", 1)[1].strip().strip("'\"")
        if line.strip() == "jsonld_only: true":
            data.setdefault("detail", {})["jsonld_only"] = True
        if line.strip() == "use_llm: true":
            data.setdefault("detail", {})["use_llm"] = True
        if line.strip().startswith("- "):
            url = line.strip()[2:].strip().strip("'\"")
            if url:
                data.setdefault("discovery", {}).setdefault("urls", []).append(url)
    return data


def _update_profile_method(path: Path, method: str, overwrite: bool) -> bool:
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        existing = data.get("integration_method")
        if existing and existing != "unknown" and not overwrite:
            return False
        data["integration_method"] = method
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        return True

    lines = path.read_text(encoding="utf-8").splitlines()
    for idx, line in enumerate(lines):
        if line.strip().startswith("integration_method:"):
            existing = line.split(":", 1)[1].strip().strip("'\"")
            if existing and existing != "unknown" and not overwrite:
                return False
            lines[idx] = f"integration_method: {method}"
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return True

    insert_at = None
    for idx, line in enumerate(lines):
        if line.strip().startswith("name:"):
            insert_at = idx + 1
            break
    if insert_at is None:
        insert_at = 2 if len(lines) >= 2 else len(lines)
    lines.insert(insert_at, f"integration_method: {method}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return True


def _read_integration_method(data: dict) -> Optional[str]:
    method = data.get("integration_method")
    if isinstance(method, str):
        return method.strip()
    return None


def _profile_signal_method(data: dict) -> Optional[str]:
    discovery = data.get("discovery") or {}
    detail = data.get("detail") or {}

    discovery_type = discovery.get("type")
    if discovery_type == "api":
        api = discovery.get("api") or {}
        adapter = api.get("adapter")
        if adapter in {"ticketmaster", "eventbrite"}:
            return "aggregator"
        return "api"
    if discovery_type == "feed":
        return "feed"
    if detail.get("jsonld_only"):
        return "jsonld_only"
    if discovery_type == "html":
        return "llm_crawler"
    if detail.get("use_llm"):
        return "llm_extraction"
    return None


def _url_signal_method(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    lower = url.lower()
    if "ticketmaster.com" in lower or "eventbrite.com" in lower:
        return "aggregator"
    if "meetup.com" in lower:
        return "api"
    if lower.startswith("webcal://"):
        return "feed"
    if lower.endswith(".ics") or lower.endswith(".rss") or lower.endswith(".atom"):
        return "feed"
    if "rss" in lower and ("feed" in lower or "rss" in lower):
        return "feed"
    return None


def _load_source_modules() -> Dict[str, str]:
    if not MAIN_PATH.exists():
        return {}
    try:
        tree = ast.parse(MAIN_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "SOURCE_MODULES":
                    try:
                        return ast.literal_eval(node.value)
                    except Exception:
                        return {}
    return {}


def _module_path_for_slug(slug: str, source_modules: Dict[str, str]) -> Optional[Path]:
    if slug in source_modules:
        module = source_modules[slug]
        if module.startswith("sources."):
            module = module.replace("sources.", "")
        path = SOURCES_DIR / f"{module}.py"
        if path.exists():
            return path
    candidate = SOURCES_DIR / f"{slug.replace('-', '_')}.py"
    if candidate.exists():
        return candidate
    return None


def _code_signal_method(path: Optional[Path]) -> Optional[str]:
    if not path or not path.exists():
        return None
    text = path.read_text(encoding="utf-8", errors="ignore")
    lower = text.lower()

    if "playwright" in lower or "sync_playwright" in lower:
        return "playwright"
    if "icalendar" in lower or "feedparser" in lower or ".ics" in lower:
        return "feed"
    if "ticketmaster" in lower or "eventbrite" in lower:
        return "aggregator"
    if "meetup" in lower:
        return "api"
    if "anthropic" in lower or "openai" in lower or "llm" in lower:
        return "llm_extraction"
    return "html"


def _first_url(data: dict) -> Optional[str]:
    discovery = data.get("discovery") or {}
    urls = discovery.get("urls") or []
    if isinstance(urls, list) and urls:
        if isinstance(urls[0], str):
            return urls[0]
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Infer integration methods from profiles + legacy code")
    parser.add_argument("--apply", action="store_true", help="Write profile updates")
    parser.add_argument("--dry-run", action="store_true", help="Print summary only (default)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing non-unknown methods")
    parser.add_argument("--limit", type=int, default=0, help="Limit number processed")
    parser.add_argument("--output", help="Write report JSON")
    args = parser.parse_args()

    if not args.apply and not args.dry_run:
        args.dry_run = True

    profiles = _load_profiles()
    source_modules = _load_source_modules()

    slugs = sorted(profiles.keys())
    if args.limit and args.limit > 0:
        slugs = slugs[: args.limit]

    report = []
    updated = 0

    for slug in slugs:
        path = profiles[slug]
        data = _load_profile_data(path)
        existing = _read_integration_method(data)
        if existing and existing != "unknown" and not args.overwrite:
            report.append({"slug": slug, "method": existing, "source": "existing"})
            continue

        method = _profile_signal_method(data)
        source = "profile"
        if not method:
            method = _url_signal_method(_first_url(data))
            source = "url"
        if not method:
            module_path = _module_path_for_slug(slug, source_modules)
            method = _code_signal_method(module_path)
            source = "code"
        if not method:
            method = "html"
            source = "default"

        report.append({"slug": slug, "method": method, "source": source})

        if args.apply:
            did_update = _update_profile_method(path, method, args.overwrite)
            if did_update:
                updated += 1
                print(f"[update] {slug} -> {method} ({source})")
            else:
                print(f"[keep] {slug} -> existing method")
        else:
            print(f"[infer] {slug} -> {method} ({source})")

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"\nReport written to {args.output}")

    if args.dry_run:
        print("\nDry run only; no profiles updated.")
    else:
        print(f"\nProfiles updated: {updated}/{len(slugs)}")


if __name__ == "__main__":
    main()
