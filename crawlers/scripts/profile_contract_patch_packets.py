#!/usr/bin/env python3
"""
Generate executable patch packets for profile-contract rollout artifacts.

This produces unified diff patch files for:
- Phase 0 invalid existing profile fixes
- Each profile goal patch batch

The owner of `crawlers/sources/profiles/` can apply these with `git apply`
instead of translating markdown snippets into manual edits.
"""

from __future__ import annotations

import argparse
import difflib
import json
from datetime import date
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pyyaml is required to generate patch packets") from exc

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT_DIR = ROOT / "reports"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_yaml(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _dump_yaml(data: dict[str, Any]) -> str:
    return yaml.safe_dump(data, sort_keys=False, default_flow_style=False)


def _relative_profile_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT.parent))
    except ValueError:
        return path.name


def _unified_diff(*, old_text: str, new_text: str, relpath: str, is_new_file: bool) -> str:
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()
    fromfile = "/dev/null" if is_new_file else f"a/{relpath}"
    tofile = f"b/{relpath}"
    diff_lines = list(
        difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=fromfile,
            tofile=tofile,
            lineterm="",
        )
    )
    if not diff_lines:
        return ""
    return "\n".join(diff_lines) + "\n"


def _top_level_block_range(lines: list[str], key: str) -> tuple[int, int] | None:
    start: int | None = None
    for idx, line in enumerate(lines):
        if line.startswith(f"{key}:"):
            start = idx
            break
    if start is None:
        return None

    end = len(lines)
    for idx in range(start + 1, len(lines)):
        line = lines[idx]
        if line and not line.startswith(" ") and not line.startswith("\t") and not line.startswith("- "):
            end = idx
            break
    return start, end


def _replace_top_level_block(text: str, key: str, new_block: str) -> str:
    lines = text.splitlines()
    block_range = _top_level_block_range(lines, key)
    new_lines = new_block.splitlines()
    if block_range is None:
        if lines and lines[-1] != "":
            lines.append("")
        return "\n".join(lines + new_lines) + "\n"

    start, end = block_range
    updated = lines[:start] + new_lines + lines[end:]
    return "\n".join(updated) + "\n"


def _replace_discovery_block(text: str, *, new_type: str, api_adapter: str | None = None) -> str:
    lines = text.splitlines()
    block_range = _top_level_block_range(lines, "discovery")
    if block_range is None:
        new_lines = ["discovery:", "  enabled: true", f"  type: {new_type}"]
        if api_adapter:
            new_lines.extend(["  api:", f"    adapter: {api_adapter}"])
        if lines and lines[-1] != "":
            lines.append("")
        return "\n".join(lines + new_lines) + "\n"

    start, end = block_range
    block = lines[start:end]
    replaced_type = False
    has_api = False
    updated_block: list[str] = []

    for line in block:
        stripped = line.strip()
        if stripped.startswith("type:"):
            indent = line[: len(line) - len(line.lstrip())]
            updated_block.append(f"{indent}type: {new_type}")
            replaced_type = True
            if api_adapter and not has_api:
                updated_block.extend([f"{indent}api:", f"{indent}  adapter: {api_adapter}"])
                has_api = True
            continue
        if stripped.startswith("api:"):
            has_api = True
        updated_block.append(line)

    if not replaced_type:
        insert_idx = 1 if len(updated_block) > 1 else len(updated_block)
        updated_block.insert(insert_idx, f"  type: {new_type}")
        if api_adapter and not has_api:
            updated_block.insert(insert_idx + 1, "  api:")
            updated_block.insert(insert_idx + 2, f"    adapter: {api_adapter}")
            has_api = True
    elif api_adapter and not has_api:
        insert_after = 1
        updated_block.insert(insert_after + 1, "  api:")
        updated_block.insert(insert_after + 2, f"    adapter: {api_adapter}")

    updated = lines[:start] + updated_block + lines[end:]
    return "\n".join(updated) + "\n"


def _apply_drift_row(row: dict[str, Any]) -> str:
    path = Path(row["profile_path"])
    old_text = path.read_text(encoding="utf-8")
    new_text = old_text
    actions = set(row.get("change_actions") or [])

    if "replace-data-goals" in actions and row.get("recommended_data_goals"):
        goals_yaml = _dump_yaml({"data_goals": list(row["recommended_data_goals"])})
        new_text = _replace_top_level_block(new_text, "data_goals", goals_yaml.rstrip("\n"))

    recommended_discovery_type = row.get("recommended_discovery_type")
    if "replace-discovery-type" in actions and recommended_discovery_type:
        api_adapter = "custom" if recommended_discovery_type == "api" else None
        new_text = _replace_discovery_block(
            new_text,
            new_type=recommended_discovery_type,
            api_adapter=api_adapter,
        )

    return _unified_diff(
        old_text=old_text,
        new_text=new_text,
        relpath=_relative_profile_path(path),
        is_new_file=False,
    )


def _build_profile_from_batch_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "slug": row["slug"],
        "name": row["name"],
        "data_goals": list(row["recommended_goals"]),
    }


def _apply_batch_row(row: dict[str, Any]) -> str:
    path = Path(row["profile_path"])
    if row["profile_action"] == "create-profile" or not path.exists():
        new_text = _dump_yaml(_build_profile_from_batch_row(row))
        return _unified_diff(
            old_text="",
            new_text=new_text,
            relpath=_relative_profile_path(path),
            is_new_file=True,
        )

    old_text = path.read_text(encoding="utf-8")
    goals_yaml = _dump_yaml({"data_goals": list(row["recommended_goals"])})
    new_text = _replace_top_level_block(old_text, "data_goals", goals_yaml.rstrip("\n"))
    return _unified_diff(
        old_text=old_text,
        new_text=new_text,
        relpath=_relative_profile_path(path),
        is_new_file=False,
    )


def build_patch_packets(drift_plan_path: Path, batch_dir: Path) -> dict[str, Any]:
    drift_plan = _load_json(drift_plan_path)
    phase_packets: list[dict[str, Any]] = []

    drift_diffs = [_apply_drift_row(row) for row in drift_plan["rows"]]
    drift_patch = "".join(diff for diff in drift_diffs if diff)
    phase_packets.append(
        {
            "phase": 0,
            "name": "fix-invalid-existing-profiles",
            "count": len(drift_plan["rows"]),
            "patch_text": drift_patch,
            "slugs": [row["slug"] for row in drift_plan["rows"]],
        }
    )

    for index, batch_path in enumerate(sorted(batch_dir.glob("batch_*.json")), start=1):
        rows = _load_json(batch_path)
        diffs = [_apply_batch_row(row) for row in rows]
        patch_text = "".join(diff for diff in diffs if diff)
        phase_packets.append(
            {
                "phase": index,
                "name": batch_path.stem,
                "count": len(rows),
                "patch_text": patch_text,
                "slugs": [row["slug"] for row in rows],
            }
        )

    return {
        "drift_plan_path": str(drift_plan_path),
        "batch_dir": str(batch_dir),
        "summary": {
            "phase_count": len(phase_packets),
            "invalid_profiles": len(drift_plan["rows"]),
            "batch_count": max(len(phase_packets) - 1, 0),
            "batch_rows": sum(packet["count"] for packet in phase_packets[1:]),
        },
        "phases": phase_packets,
    }


def render_index_markdown(report: dict[str, Any], output_dir: Path) -> str:
    summary = report["summary"]
    lines = [
        "# Profile Contract Patch Packets",
        "",
        f"- Invalid profiles: {summary['invalid_profiles']}",
        f"- Batch count: {summary['batch_count']}",
        f"- Batch rows: {summary['batch_rows']}",
        "",
        "| Phase | Name | Rows | Patch File |",
        "| --- | --- | ---: | --- |",
    ]
    for phase in report["phases"]:
        filename = f"phase_{phase['phase']:02d}_{phase['name']}.patch"
        lines.append(
            f"| {phase['phase']} | {phase['name']} | {phase['count']} | {output_dir / filename} |"
        )

    lines.extend(
        [
            "",
            "## Apply",
            "",
            "Apply one phase at a time from the repo root:",
            "",
            "```bash",
            f"git apply {output_dir / 'phase_00_fix-invalid-existing-profiles.patch'}",
            "```",
            "",
            "Then continue with `phase_01_batch_01.patch`, `phase_02_batch_02.patch`, and so on.",
            "",
            "Re-run `profile_goal_patch_status.py` after each phase or batch.",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate executable patch packets for profile contract rollout")
    parser.add_argument("drift_plan_json", help="Path to profile_schema_drift_patch_plan_latest.json")
    parser.add_argument("batch_dir", help="Directory created by profile_goal_patch_batches.py")
    parser.add_argument("--output-dir", help="Directory to write patch packets")
    args = parser.parse_args()

    report = build_patch_packets(
        drift_plan_path=Path(args.drift_plan_json),
        batch_dir=Path(args.batch_dir),
    )

    output_dir = (
        Path(args.output_dir)
        if args.output_dir
        else DEFAULT_REPORT_DIR / f"profile_contract_patch_packets_{date.today().isoformat()}"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    for phase in report["phases"]:
        filename = output_dir / f"phase_{phase['phase']:02d}_{phase['name']}.patch"
        filename.write_text(phase["patch_text"], encoding="utf-8")

    index_path = output_dir / "index.md"
    index_path.write_text(render_index_markdown(report, output_dir), encoding="utf-8")
    json_path = output_dir / "index.json"
    json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")

    print(f"Wrote patch packet directory: {output_dir}")
    print(
        "Patch packet summary:",
        f"phases={report['summary']['phase_count']}, "
        f"invalid={report['summary']['invalid_profiles']}, "
        f"batch_rows={report['summary']['batch_rows']}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
