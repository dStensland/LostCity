#!/usr/bin/env python3
"""
Audit migration parity between database/migrations and supabase/migrations.

The two tracks use different numbering schemes:
- database: integer-led migration ids
- supabase: timestamp-led migration ids

This script normalizes names, applies known semantic aliases, and reports
recent migrations that exist on one side without a counterpart on the other.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DB_DIR = ROOT / "database" / "migrations"
SUPABASE_DIR = ROOT / "supabase" / "migrations"


SEMANTIC_ALIASES = {
    "create_flags_table": "flags_table",
    "event_channel_matches": "event_channel_matches",
    "forth_atlanta_source_federation": "forth_atlanta_source_federation",
    "forth_content_filtering": "forth_content_filtering",
    "forth_tonight_time_filter": "forth_tonight_time_filter",
    "forth_venue_coordinates": "forth_venue_coordinates",
    "forth_venue_specials": "forth_venue_specials",
    "hangs": "hangs",
    "helpatl_activate_portal": "helpatl_portal",
    "helpatl_cause_channels_and_sources": "helpatl_cause_channels_and_sources",
    "helpatl_civic_literacy_opportunities": "helpatl_civic_literacy_opportunities",
    "helpatl_civic_participation_wave2": "helpatl_civic_participation_wave2",
    "helpatl_community_portal": "helpatl_portal",
    "helpatl_community_vertical": "helpatl_portal",
    "helpatl_explicit_federation_scope": "helpatl_explicit_federation_scope",
    "helpatl_family_refugee_opportunities": "helpatl_family_refugee_opportunities",
    "helpatl_georgia_democracy_watch_channel": "helpatl_georgia_democracy_watch_channel",
    "helpatl_health_public_health_opportunities": "helpatl_health_public_health_opportunities",
    "helpatl_humanitarian_opportunities": "helpatl_humanitarian_opportunities",
    "helpatl_humanitarian_rights_opportunities": "helpatl_humanitarian_rights_opportunities",
    "helpatl_manifest_live_source_reconcile": "helpatl_manifest_live_source_reconcile",
    "helpatl_metro_election_worker_opportunities": "helpatl_metro_election_worker_opportunities",
    "helpatl_npu_participation_opportunities": "helpatl_npu_participation_opportunities",
    "helpatl_official_boards_commissions_opportunities": "helpatl_official_boards_commissions_opportunities",
    "helpatl_portal_backfill": "helpatl_portal",
    "helpatl_redundant_owned_source_subscriptions_cleanup": "helpatl_redundant_owned_source_subscriptions_cleanup",
    "helpatl_school_board_tag_rule_reactivate": "helpatl_school_board_tag_rule_reactivate",
    "helpatl_survivor_support_opportunities": "helpatl_survivor_support_opportunities",
    "helpatl_volunteer_source_pack_v2": "helpatl_volunteer_source_pack_v2",
    "hooky_portal": "hooky_portal",
    "hooky_programs_and_age": "hooky_programs_and_age",
    "interest_channels": "interest_channels",
    "interest_channels_atlanta_seed": "interest_channels_atlanta_seed",
    "itinerary_social_layer": "itinerary_social_layer",
    "lwv_runoff_title_cleanup": "lwv_runoff_title_cleanup",
    "medshare_source_federation": "medshare_source_federation",
    "portal_nav_labels_split": "portal_nav_labels_split",
    "profile_hang_stats": "profile_hang_stats",
    "profile_hangs_expansion": "profile_hangs_expansion",
    "profile_rpc_optimize": "profile_rpc_optimize",
    "source_quality_dashboard": "source_quality_dashboard",
    "spot_event_counts_indexes": "spot_event_counts_indexes",
    "spot_event_counts_rpc": "spot_event_counts_rpc",
    "suppress_non_hang_regulars": "suppress_venue_regulars",
    "suppress_venue_regulars": "suppress_venue_regulars",
    "unconventional_convention_sources": "unconventional_convention_sources",
    "venue_inventory_snapshots": "venue_inventory_snapshots",
    "volunteer_opportunities_phase1": "volunteer_opportunities_phase1",
    "west_end_comedy_fest_source": "west_end_comedy_fest_source",
    "wild_heaven_west_end_source": "wild_heaven_west_end_source",
    "yonder_inventory_current_snapshot_view": "yonder_inventory_current_snapshot_view",
    "yonder_source_pack_foundation": "yonder_source_pack_foundation",
}

INTENTIONALLY_UNPAIRED = {
    "add_collections",
    "add_public_rsvp_policy",
    "seed_editorial_collections",
}


@dataclass(frozen=True)
class MigrationFile:
    filename: str
    stem: str
    semantic_key: str


def _db_stem(filename: str) -> str | None:
    match = re.match(r"^(\d+)_([^.]+)\.sql$", filename)
    if not match:
        return None
    return match.group(2)


def _supabase_stem(filename: str) -> str | None:
    match = re.match(r"^(\d{14})_([^.]+)\.sql$", filename)
    if not match:
        return None
    return match.group(2)


def _semantic_key(stem: str) -> str:
    return SEMANTIC_ALIASES.get(stem, stem)


def _load_db(recent_min: int) -> list[MigrationFile]:
    items: list[MigrationFile] = []
    for path in sorted(DB_DIR.glob("*.sql")):
        match = re.match(r"^(\d+)_", path.name)
        if not match:
            continue
        if int(match.group(1)) < recent_min:
            continue
        stem = _db_stem(path.name)
        if not stem or stem in INTENTIONALLY_UNPAIRED:
            continue
        items.append(MigrationFile(path.name, stem, _semantic_key(stem)))
    return items


def _load_supabase(recent_min: int) -> list[MigrationFile]:
    items: list[MigrationFile] = []
    for path in sorted(SUPABASE_DIR.glob("*.sql")):
        match = re.match(r"^(\d{14})_", path.name)
        if not match:
            continue
        if int(match.group(1)) < recent_min:
            continue
        stem = _supabase_stem(path.name)
        if not stem or stem in INTENTIONALLY_UNPAIRED:
            continue
        items.append(MigrationFile(path.name, stem, _semantic_key(stem)))
    return items


def _find_duplicate_prefixes(directory: Path, pattern: str) -> list[dict[str, object]]:
    grouped: dict[str, list[str]] = {}
    for path in sorted(directory.glob("*.sql")):
        match = re.match(pattern, path.name)
        if not match:
            continue
        grouped.setdefault(match.group(1), []).append(path.name)
    return [
        {
            "prefix": prefix,
            "files": files,
        }
        for prefix, files in sorted(grouped.items())
        if len(files) > 1
    ]


def build_report(recent_db_min: int, recent_supabase_min: int) -> dict:
    db_items = _load_db(recent_db_min)
    supabase_items = _load_supabase(recent_supabase_min)
    db_duplicates = _find_duplicate_prefixes(DB_DIR, r"^(\d+)_")
    supabase_duplicates = _find_duplicate_prefixes(SUPABASE_DIR, r"^(\d{14})_")

    db_by_key = {item.semantic_key: item for item in db_items}
    supabase_by_key = {item.semantic_key: item for item in supabase_items}

    matched = sorted(set(db_by_key) & set(supabase_by_key))
    db_only = [db_by_key[key] for key in sorted(set(db_by_key) - set(supabase_by_key))]
    supabase_only = [supabase_by_key[key] for key in sorted(set(supabase_by_key) - set(db_by_key))]

    return {
        "scope": {
            "recent_db_min": recent_db_min,
            "recent_supabase_min": recent_supabase_min,
        },
        "counts": {
            "database_recent": len(db_items),
            "supabase_recent": len(supabase_items),
            "matched_semantic_keys": len(matched),
            "database_only": len(db_only),
            "supabase_only": len(supabase_only),
            "database_duplicate_prefixes": len(db_duplicates),
            "supabase_duplicate_prefixes": len(supabase_duplicates),
        },
        "matched": [
            {
                "semantic_key": key,
                "database": db_by_key[key].filename,
                "supabase": supabase_by_key[key].filename,
            }
            for key in matched
        ],
        "database_only": [
            {
                "semantic_key": item.semantic_key,
                "database": item.filename,
            }
            for item in db_only
        ],
        "supabase_only": [
            {
                "semantic_key": item.semantic_key,
                "supabase": item.filename,
            }
            for item in supabase_only
        ],
        "database_duplicate_prefixes": db_duplicates,
        "supabase_duplicate_prefixes": supabase_duplicates,
    }


def write_markdown(report: dict, out_path: Path) -> None:
    counts = report["counts"]
    lines = [
        "# Migration Parity Audit",
        "",
        f"- Recent database threshold: `{report['scope']['recent_db_min']}`",
        f"- Recent supabase threshold: `{report['scope']['recent_supabase_min']}`",
        "",
        "## Summary",
        "",
        f"- Recent database migrations: **{counts['database_recent']}**",
        f"- Recent supabase migrations: **{counts['supabase_recent']}**",
        f"- Matched semantic keys: **{counts['matched_semantic_keys']}**",
        f"- Database-only recent migrations: **{counts['database_only']}**",
        f"- Supabase-only recent migrations: **{counts['supabase_only']}**",
        f"- Database duplicate numeric prefixes: **{counts['database_duplicate_prefixes']}**",
        f"- Supabase duplicate timestamp prefixes: **{counts['supabase_duplicate_prefixes']}**",
        "",
        "## Database Only",
        "",
    ]

    if report["database_only"]:
        for item in report["database_only"]:
            lines.append(f"- `{item['database']}`")
    else:
        lines.append("- none")

    lines.extend(["", "## Supabase Only", ""])
    if report["supabase_only"]:
        for item in report["supabase_only"]:
            lines.append(f"- `{item['supabase']}`")
    else:
        lines.append("- none")

    lines.extend(["", "## Database Duplicate Prefixes", ""])
    if report["database_duplicate_prefixes"]:
        for item in report["database_duplicate_prefixes"]:
            lines.append(f"- `{item['prefix']}`: {', '.join(f'`{name}`' for name in item['files'])}")
    else:
        lines.append("- none")

    lines.extend(["", "## Supabase Duplicate Prefixes", ""])
    if report["supabase_duplicate_prefixes"]:
        for item in report["supabase_duplicate_prefixes"]:
            lines.append(f"- `{item['prefix']}`: {', '.join(f'`{name}`' for name in item['files'])}")
    else:
        lines.append("- none")

    out_path.write_text("\n".join(lines) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit migration parity across database and supabase tracks.")
    parser.add_argument("--recent-db-min", type=int, default=280)
    parser.add_argument("--recent-supabase-min", type=int, default=20260305000000)
    parser.add_argument("--json-out", type=str, default=None)
    parser.add_argument("--md-out", type=str, default=None)
    parser.add_argument("--fail-on-unmatched", action="store_true")
    parser.add_argument("--fail-on-database-duplicates", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.recent_db_min, args.recent_supabase_min)

    print(json.dumps(report["counts"], indent=2))

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2) + "\n")
    if args.md_out:
        out = Path(args.md_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        write_markdown(report, out)

    if args.fail_on_unmatched and (
        report["database_only"] or report["supabase_only"] or report["supabase_duplicate_prefixes"]
    ):
        return 1
    if args.fail_on_database_duplicates and report["database_duplicate_prefixes"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
