#!/usr/bin/env python3
"""Build a source-oriented remediation manifest from the festival gate output."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CRAWLERS_ROOT = REPO_ROOT / "crawlers"
DEFAULT_GATE_PATH = CRAWLERS_ROOT / "reports" / "festival_promotion_gate_latest.json"
DEFAULT_OUTPUT_PATH = (
    CRAWLERS_ROOT / "reports" / "festival_remediation_manifest_latest.md"
)


def _source_paths(slug: str) -> dict[str, str | None]:
    crawler = CRAWLERS_ROOT / "sources" / f"{slug.replace('-', '_')}.py"
    profile = CRAWLERS_ROOT / "sources" / "profiles" / f"{slug}.yaml"
    return {
        "crawler_path": str(crawler) if crawler.exists() else None,
        "profile_path": str(profile) if profile.exists() else None,
    }


def _integration_type(paths: dict[str, str | None]) -> str:
    if paths["profile_path"]:
        return "profile"
    if paths["crawler_path"]:
        return "crawler"
    return "unknown"


def _suggested_fix(reason: str, integration_type: str) -> str:
    if "fragmentation" in reason:
        if integration_type == "profile":
            return "review festival_schedule grouping so schedule buckets do not create ghost or single-event festival_program series"
        return "review series_hint / series creation so one-off festival rows do not become ghost or single-event festival_program series"
    if "too short" in reason:
        return "improve first-pass description capture on festival event rows instead of accepting stub copy"
    if "missing" in reason:
        return (
            "restore missing event description capture from detail or listing content"
        )
    return "inspect source output against the promotion hold evidence"


def build_manifest(gate: dict) -> dict:
    entries = []
    for row in gate.get("promotion_holds", []):
        paths = _source_paths(row["target"])
        integration_type = _integration_type(paths)
        entries.append(
            {
                "slug": row["target"],
                "integration_type": integration_type,
                "crawler_path": paths["crawler_path"],
                "profile_path": paths["profile_path"],
                "reason": row["reason"],
                "evidence": row["evidence"],
                "action": row["action"],
                "suggested_fix_path": _suggested_fix(row["reason"], integration_type),
            }
        )

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "gate_decision": gate.get("decision"),
        "promotion_hold_count": gate.get("promotion_hold_count", 0),
        "entries": entries,
        "top_remediation_queue": gate.get("top_remediation_queue", []),
    }


def render_markdown(manifest: dict) -> str:
    lines = [
        "# Festival Remediation Manifest",
        "",
        f"- Generated: {manifest['generated_at']}",
        f"- Gate decision: **{manifest['gate_decision']}**",
        f"- Promotion holds: {manifest['promotion_hold_count']}",
        "",
        "## Held Sources",
        "",
        "| Slug | Integration | Reason | Evidence | Suggested Fix Path | File |",
        "|---|---|---|---|---|---|",
    ]
    for row in manifest["entries"]:
        file_ref = row["profile_path"] or row["crawler_path"] or "-"
        lines.append(
            f"| {row['slug']} | {row['integration_type']} | {row['reason']} | "
            f"{row['evidence']} | {row['suggested_fix_path']} | {file_ref} |"
        )
    lines.extend(
        [
            "",
            "## Top Remediation Queue",
            "",
            "| Target | Scope | Reason | Evidence | Action |",
            "|---|---|---|---|---|",
        ]
    )
    for row in manifest["top_remediation_queue"]:
        lines.append(
            f"| {row['target']} | {row['scope']} | {row['reason']} | {row['evidence']} | {row['action']} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate a festival remediation manifest"
    )
    parser.add_argument(
        "--gate", type=Path, default=DEFAULT_GATE_PATH, help="Festival gate JSON path"
    )
    parser.add_argument(
        "--output", type=Path, default=DEFAULT_OUTPUT_PATH, help="Markdown output path"
    )
    args = parser.parse_args()

    gate = json.loads(args.gate.read_text(encoding="utf-8"))
    manifest = build_manifest(gate)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_markdown(manifest), encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
