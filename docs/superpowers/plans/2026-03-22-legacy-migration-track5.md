# Legacy Crawler Migration (Track 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tooling to systematically migrate legacy Python crawlers to v2 profiles with LLM extraction, and establish the process for ongoing migration.

**Architecture:** A profile generation tool reads a legacy Python crawler, extracts its VENUE_DATA, import patterns, output structure, and URL patterns, then generates a v2 YAML profile. The legacy Python file is archived (not deleted). Migration proceeds in waves — agents convert batches in parallel, each crawler independently testable.

**Tech Stack:** Python, YAML, AST parsing for automated profile generation

**Spec:** `docs/superpowers/specs/2026-03-21-crawler-pipeline-architecture-design.md`

**Depends on:** Track 3 (Profile Pipeline v2) — must be complete before migrating crawlers onto the new pipeline.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `crawlers/scripts/generate_v2_profile.py` | Create | Automated v2 profile generator from legacy Python crawlers |
| `crawlers/scripts/validate_migration.py` | Create | Validates a migrated crawler produces equivalent output |
| `crawlers/scripts/migration_status.py` | Create | Reports migration progress (% on v2, % legacy, % archived) |
| `crawlers/sources/archive/` | Create | Archive directory for migrated Python files |
| `crawlers/MIGRATION.md` | Create | Migration guide for agents performing conversions |
| `crawlers/tests/test_generate_v2_profile.py` | Create | Tests for profile generator |
| `crawlers/tests/test_migration_status.py` | Create | Tests for status reporter |

---

## Task 1: Profile Generation Tool

**Files:**
- Create: `crawlers/scripts/generate_v2_profile.py`
- Create: `crawlers/tests/test_generate_v2_profile.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_generate_v2_profile.py
"""Tests for automated v2 profile generation from legacy crawlers."""
from scripts.generate_v2_profile import extract_profile_data, generate_v2_yaml


def test_extracts_venue_data_from_source():
    """Should extract VENUE_DATA dict from a crawler source file."""
    source_code = '''
VENUE_DATA = {
    "name": "The Earl",
    "slug": "the-earl",
    "address": "488 Flat Shoals Ave SE",
    "neighborhood": "East Atlanta Village",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30316",
    "venue_type": "music_venue",
    "website": "https://badearl.com",
}

def crawl(source):
    pass
'''
    data = extract_profile_data(source_code, "the_earl")
    assert data["venue"]["name"] == "The Earl"
    assert data["venue"]["venue_type"] == "music_venue"
    assert data["city"] == "Atlanta"


def test_detects_playwright_usage():
    """Should detect if the crawler uses Playwright."""
    source_with_pw = 'from playwright.sync_api import sync_playwright\ndef crawl(s): pass'
    source_without = 'import requests\ndef crawl(s): pass'

    data_pw = extract_profile_data(source_with_pw, "test")
    data_no = extract_profile_data(source_without, "test")

    assert data_pw["fetch"]["method"] == "playwright"
    assert data_no["fetch"]["method"] == "static"


def test_extracts_urls_from_constants():
    """Should find URL constants in the source."""
    source = '''
BASE_URL = "https://example.com"
EVENTS_URL = "https://example.com/events"
def crawl(s): pass
'''
    data = extract_profile_data(source, "test")
    assert "https://example.com/events" in data["fetch"]["urls"]


def test_generates_valid_yaml():
    """Generated YAML should be parseable."""
    import yaml
    profile_data = {
        "version": 2,
        "slug": "test-venue",
        "name": "Test Venue",
        "city": "atlanta",
        "fetch": {"method": "static", "urls": ["https://example.com/events"]},
        "parse": {"method": "llm"},
        "entity_lanes": ["events"],
        "venue": {"name": "Test Venue"},
        "defaults": {"category": "music"},
        "schedule": {"frequency": "daily", "priority": "normal"},
    }
    yaml_str = generate_v2_yaml(profile_data)
    parsed = yaml.safe_load(yaml_str)
    assert parsed["version"] == 2
    assert parsed["slug"] == "test-venue"


def test_detects_category_from_defaults():
    """Should extract default category from DEFAULTS or event_data patterns."""
    source = '''
VENUE_DATA = {"name": "Test", "venue_type": "comedy_club"}
def crawl(s):
    event = {"category": "comedy"}
'''
    data = extract_profile_data(source, "test")
    assert data["defaults"]["category"] == "comedy"
```

- [ ] **Step 2: Run tests, verify failure**

```bash
cd crawlers && python3 -m pytest tests/test_generate_v2_profile.py -v
```

- [ ] **Step 3: Implement generate_v2_profile.py**

```python
#!/usr/bin/env python3
"""
Generate a v2 YAML profile from a legacy Python crawler.

Usage:
  python scripts/generate_v2_profile.py sources/the_earl.py
  python scripts/generate_v2_profile.py sources/the_earl.py --output sources/profiles/the-earl.yaml
  python scripts/generate_v2_profile.py --batch sources/*.py  # generate for all
"""

import argparse
import ast
import logging
import re
import sys
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

_VENUE_TYPE_TO_CATEGORY = {
    "music_venue": "music",
    "comedy_club": "comedy",
    "nightclub": "nightlife",
    "gallery": "art",
    "museum": "art",
    "cinema": "film",
    "theater": "theater",
    "brewery": "food_drink",
    "restaurant": "food_drink",
    "bar": "nightlife",
    "sports_bar": "sports",
    "church": "religious",
    "fitness_center": "exercise",
    "community_center": "community",
}


def extract_profile_data(source_code: str, module_name: str) -> dict:
    """Extract v2 profile data from a legacy crawler's source code."""
    # Detect Playwright
    uses_playwright = "playwright" in source_code.lower()
    fetch_method = "playwright" if uses_playwright else "static"

    # Extract VENUE_DATA dict
    venue = _extract_venue_data(source_code)
    city = venue.pop("city", "Atlanta") if venue else "Atlanta"

    # Extract URLs
    urls = _extract_url_constants(source_code)

    # Extract category
    category = _extract_category(source_code, venue)

    # Extract tags
    tags = _extract_tags(source_code)

    slug = module_name.replace("_", "-")

    return {
        "version": 2,
        "slug": slug,
        "name": venue.get("name", module_name.replace("_", " ").title()) if venue else module_name.replace("_", " ").title(),
        "city": city.lower() if city else "atlanta",
        "fetch": {"method": fetch_method, "urls": urls},
        "parse": {"method": "custom", "module": f"sources.{module_name}"},
        "entity_lanes": ["events"],
        "venue": _clean_venue(venue) if venue else {},
        "defaults": {"category": category, "tags": tags},
        "schedule": {"frequency": "daily", "priority": "normal"},
    }


def _extract_venue_data(source: str) -> Optional[dict]:
    """Extract VENUE_DATA dict using AST parsing."""
    try:
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "VENUE_DATA":
                        return ast.literal_eval(node.value)
    except Exception:
        pass
    # Fallback: regex
    match = re.search(r'VENUE_DATA\s*=\s*\{([^}]+)\}', source, re.DOTALL)
    if match:
        try:
            return ast.literal_eval('{' + match.group(1) + '}')
        except Exception:
            pass
    return None


def _extract_url_constants(source: str) -> list[str]:
    """Find URL string constants."""
    urls = []
    for match in re.finditer(r'(?:BASE_URL|EVENTS_URL|URL|CALENDAR_URL)\s*=\s*["\']([^"\']+)["\']', source):
        url = match.group(1)
        if url.startswith("http"):
            urls.append(url)
    # Prefer EVENTS_URL over BASE_URL
    return urls or []


def _extract_category(source: str, venue: Optional[dict]) -> Optional[str]:
    """Infer default category."""
    # From explicit category in source
    match = re.search(r'"category"\s*:\s*"(\w+)"', source)
    if match:
        return match.group(1)
    # From venue_type
    if venue:
        vtype = venue.get("venue_type", "")
        return _VENUE_TYPE_TO_CATEGORY.get(vtype)
    return None


def _extract_tags(source: str) -> list[str]:
    """Extract default tags."""
    match = re.search(r'"tags"\s*:\s*\[([^\]]+)\]', source)
    if match:
        return [t.strip().strip('"\'') for t in match.group(1).split(",")]
    return []


def _clean_venue(venue: dict) -> dict:
    """Remove non-profile fields from venue data."""
    keep = {"name", "address", "neighborhood", "state", "zip", "venue_type", "website", "lat", "lng"}
    return {k: v for k, v in venue.items() if k in keep and v}


def generate_v2_yaml(data: dict) -> str:
    """Generate YAML string from profile data."""
    return yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)


def main():
    parser = argparse.ArgumentParser(description="Generate v2 profile from legacy crawler")
    parser.add_argument("source_file", nargs="?", help="Path to Python crawler file")
    parser.add_argument("--output", "-o", help="Output YAML path")
    parser.add_argument("--batch", nargs="+", help="Batch mode: multiple source files")
    parser.add_argument("--dry-run", action="store_true", help="Print YAML without writing")
    args = parser.parse_args()

    files = args.batch or ([args.source_file] if args.source_file else [])
    for fpath in files:
        path = Path(fpath)
        module_name = path.stem
        source_code = path.read_text()
        data = extract_profile_data(source_code, module_name)
        yaml_str = generate_v2_yaml(data)

        if args.dry_run:
            print(f"--- {module_name} ---")
            print(yaml_str)
        else:
            out = Path(args.output) if args.output else Path(f"sources/profiles/{data['slug']}.yaml")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(yaml_str)
            print(f"Generated: {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/scripts/generate_v2_profile.py crawlers/tests/test_generate_v2_profile.py
git commit -m "feat: v2 profile generator — reads legacy Python crawlers, outputs YAML profiles"
```

---

## Task 2: Migration Status Reporter

**Files:**
- Create: `crawlers/scripts/migration_status.py`
- Create: `crawlers/tests/test_migration_status.py`

- [ ] **Step 1: Write failing tests**

```python
# crawlers/tests/test_migration_status.py
"""Tests for migration status reporting."""
from scripts.migration_status import compute_migration_status


def test_counts_profile_only_sources():
    profiles = {"a", "b", "c"}
    modules = {"b", "c", "d"}
    status = compute_migration_status(profiles, modules)
    assert status["profile_only"] == 1  # "a" has profile but no module
    assert status["both"] == 2  # "b", "c" have both
    assert status["module_only"] == 1  # "d" has module but no profile


def test_migration_percentage():
    profiles = {"a", "b", "c", "d", "e"}
    modules = {"d", "e", "f", "g"}
    status = compute_migration_status(profiles, modules)
    # total unique = 7 (a,b,c,d,e,f,g)
    # on v2 (profile_only) = 3 (a,b,c)
    # legacy (module_only) = 2 (f,g)
    # transitional (both) = 2 (d,e)
    assert status["total"] == 7
    assert status["profile_only"] == 3
    assert status["module_only"] == 2
```

- [ ] **Step 2: Run tests, verify failure**

- [ ] **Step 3: Implement migration_status.py**

```python
#!/usr/bin/env python3
"""
Report migration status: how many sources are on v2 profiles vs legacy Python.

Usage:
  python scripts/migration_status.py
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

SOURCES_DIR = Path(__file__).resolve().parent.parent / "sources"
PROFILES_DIR = SOURCES_DIR / "profiles"
ARCHIVE_DIR = SOURCES_DIR / "archive"


def get_module_slugs() -> set[str]:
    """Get slugs from Python module files."""
    slugs = set()
    for f in SOURCES_DIR.glob("*.py"):
        if f.name.startswith("_") or f.name == "__init__.py":
            continue
        slugs.add(f.stem.replace("_", "-"))
    return slugs


def get_profile_slugs() -> set[str]:
    """Get slugs from YAML profile files."""
    slugs = set()
    for f in PROFILES_DIR.glob("*.yaml"):
        slugs.add(f.stem)
    for f in PROFILES_DIR.glob("*.yml"):
        slugs.add(f.stem)
    return slugs


def get_archived_slugs() -> set[str]:
    """Get slugs from archived Python files."""
    slugs = set()
    if ARCHIVE_DIR.exists():
        for f in ARCHIVE_DIR.glob("*.py"):
            slugs.add(f.stem.replace("_", "-"))
    return slugs


def compute_migration_status(profiles: set[str], modules: set[str]) -> dict:
    """Compute migration status from profile and module slug sets."""
    all_slugs = profiles | modules
    profile_only = profiles - modules
    module_only = modules - profiles
    both = profiles & modules

    return {
        "total": len(all_slugs),
        "profile_only": len(profile_only),  # Fully migrated
        "module_only": len(module_only),  # Legacy, no profile
        "both": len(both),  # Transitional (profile exists, module not yet archived)
        "pct_migrated": round(len(profile_only) / max(len(all_slugs), 1) * 100, 1),
        "pct_legacy": round(len(module_only) / max(len(all_slugs), 1) * 100, 1),
        "pct_transitional": round(len(both) / max(len(all_slugs), 1) * 100, 1),
    }


def main():
    profiles = get_profile_slugs()
    modules = get_module_slugs()
    archived = get_archived_slugs()
    status = compute_migration_status(profiles, modules)

    print("=== Crawler Migration Status ===")
    print(f"Total sources: {status['total']}")
    print(f"  Profile-only (v2): {status['profile_only']} ({status['pct_migrated']}%)")
    print(f"  Module-only (legacy): {status['module_only']} ({status['pct_legacy']}%)")
    print(f"  Both (transitional): {status['both']} ({status['pct_transitional']}%)")
    print(f"  Archived: {len(archived)}")
    print()
    print(f"Migration progress: {status['pct_migrated']}% complete")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests, verify passing**

- [ ] **Step 5: Commit**

```bash
git add crawlers/scripts/migration_status.py crawlers/tests/test_migration_status.py
git commit -m "feat: migration status reporter — tracks v2 profile adoption"
```

---

## Task 3: Migration Guide for Agents

**Files:**
- Create: `crawlers/MIGRATION.md`

- [ ] **Step 1: Write the migration guide**

```markdown
# Crawler Migration Guide: Legacy Python → v2 Profile

## When to Migrate

- **New sources:** Always create a v2 profile. No new Python crawlers.
- **Broken crawlers:** When a legacy crawler breaks, migrate instead of patching.
- **Batch sprints:** Agents can convert batches of simple crawlers in parallel.

## Migration Steps

### 1. Generate the v2 profile

```bash
python scripts/generate_v2_profile.py sources/my_crawler.py --dry-run
```

Review the output. Fix any issues (wrong URLs, missing category, etc.)

```bash
python scripts/generate_v2_profile.py sources/my_crawler.py
```

### 2. Test the profile pipeline

```bash
python pipeline_main.py --source my-crawler --limit 5
```

Compare output with the legacy crawler:
```bash
python main.py --source my-crawler --dry-run
```

### 3. If LLM extraction works (parse.method: llm)

The generated profile defaults to `parse.method: custom` (uses the Python module).
To switch to LLM extraction:

1. Edit the profile: change `parse.method: custom` to `parse.method: llm`
2. Remove `module: sources.my_crawler` from the parse block
3. Test: `python pipeline_main.py --source my-crawler --limit 5`
4. If event counts match, the LLM extraction works

### 4. Archive the Python file

```bash
mkdir -p sources/archive
mv sources/my_crawler.py sources/archive/
```

### 5. Verify

```bash
python main.py --source my-crawler --dry-run
```

Should now use the profile pipeline (no Python module found → profile path).

### 6. Commit

```bash
git add sources/profiles/my-crawler.yaml sources/archive/my_crawler.py
git commit -m "migrate: convert my-crawler from Python to v2 profile with LLM extraction"
```

## When NOT to Migrate

- **API adapters** (Ticketmaster, Eventbrite, AEG) — these have complex API logic. Keep as Python.
- **Multi-page auth flows** — if the crawler manages sessions, cookies, or auth tokens.
- **Crawlers with custom dedup logic** — if it does something beyond standard content hashing.
- **Playwright-dependent crawlers** — if they genuinely need browser rendering (clicks, evaluate, WAF).

These stay as `parse.method: custom` in their v2 profile.

## Batch Migration

For agents converting multiple crawlers:

```bash
# Generate profiles for a batch
python scripts/generate_v2_profile.py --batch sources/a.py sources/b.py sources/c.py

# Check migration status
python scripts/migration_status.py
```

Each crawler is independent — agents can convert in parallel without conflicts.
```

- [ ] **Step 2: Commit**

```bash
git add crawlers/MIGRATION.md
git commit -m "docs: add crawler migration guide for agents converting legacy Python to v2 profiles"
```

---

## Task 4: Source Archive Directory + SOURCE_OVERRIDES Cleanup

**Files:**
- Create: `crawlers/sources/archive/` (directory for migrated Python files)
- Modify: `crawlers/main.py` — document SOURCE_OVERRIDES deprecation path

- [ ] **Step 1: Create archive directory**

```bash
mkdir -p crawlers/sources/archive
touch crawlers/sources/archive/.gitkeep
```

- [ ] **Step 2: Add archive exclusion to main.py's auto_discover_modules()**

Read `auto_discover_modules()` in main.py. Add a check to skip files in the `archive/` subdirectory so archived Python files don't get picked up as active crawlers.

- [ ] **Step 3: Commit**

```bash
git add crawlers/sources/archive/.gitkeep crawlers/main.py
git commit -m "feat: add sources/archive/ for migrated crawlers, exclude from auto-discovery"
```

---

## Task 5: Pilot Migration — Convert 10 Simple Crawlers

**Files:**
- Generate: 10 v2 profiles in `crawlers/sources/profiles/`
- Archive: 10 Python files to `crawlers/sources/archive/`

- [ ] **Step 1: Pick 10 simple crawlers for pilot**

Good candidates are crawlers that:
- Already converted from Playwright to static HTTP (in this session's Track 2 work)
- Use simple BeautifulSoup parsing
- Have a single URL
- Don't use custom dedup or API logic

Start with: `afsp_georgia`, `arthritis_foundation_georgia`, `chadd_atlanta`, `colorectal_cancer_alliance`, `donate_life_georgia`, `ehlers_danlos_georgia`, `fighting_blindness_atlanta`, `gcdhh`, `lewy_body_dementia`, `literacy_action`

- [ ] **Step 2: Generate v2 profiles**

```bash
cd crawlers
python scripts/generate_v2_profile.py --batch \
  sources/afsp_georgia.py \
  sources/arthritis_foundation_georgia.py \
  sources/chadd_atlanta.py \
  sources/colorectal_cancer_alliance.py \
  sources/donate_life_georgia.py \
  sources/ehlers_danlos_georgia.py \
  sources/fighting_blindness_atlanta.py \
  sources/gcdhh.py \
  sources/lewy_body_dementia.py \
  sources/literacy_action.py
```

- [ ] **Step 3: Edit profiles to use LLM extraction**

For each generated profile, change `parse.method: custom` to `parse.method: llm` and remove the `module` field.

- [ ] **Step 4: Archive the Python files**

```bash
mv sources/afsp_georgia.py sources/arthritis_foundation_georgia.py \
   sources/chadd_atlanta.py sources/colorectal_cancer_alliance.py \
   sources/donate_life_georgia.py sources/ehlers_danlos_georgia.py \
   sources/fighting_blindness_atlanta.py sources/gcdhh.py \
   sources/lewy_body_dementia.py sources/literacy_action.py \
   sources/archive/
```

- [ ] **Step 5: Check migration status**

```bash
python scripts/migration_status.py
```

- [ ] **Step 6: Commit**

```bash
git add sources/profiles/*.yaml sources/archive/*.py
git commit -m "migrate: pilot batch — 10 crawlers moved from Python to v2 profile + LLM extraction"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `python3 -m pytest tests/test_generate_v2_profile.py tests/test_migration_status.py -v` — all pass
- [ ] `python scripts/generate_v2_profile.py sources/salvation_army_atl.py --dry-run` — generates valid YAML
- [ ] `python scripts/migration_status.py` — shows 10 profile-only + counts
- [ ] `python main.py --source afsp-georgia --dry-run` — uses profile pipeline (not Python module)
- [ ] `MIGRATION.md` committed and readable
- [ ] `sources/archive/` contains 10 archived Python files
