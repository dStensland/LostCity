from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_contract_refresh import build_output_paths, refresh_reports


def test_build_output_paths_uses_expected_filenames(tmp_path: Path):
    paths = build_output_paths(tmp_path, "2026-03-31")

    assert paths["patch_status_md"] == tmp_path / "profile_goal_patch_status_2026-03-31.md"
    assert paths["patch_check_json"] == tmp_path / "profile_contract_patch_check_latest.json"
    assert paths["next_step_md"] == tmp_path / "profile_contract_next_step_2026-03-31.md"


def test_refresh_reports_writes_latest_files(tmp_path: Path):
    batch_dir = tmp_path / "batches"
    batch_dir.mkdir()
    (batch_dir / "batch_01.json").write_text(
        json.dumps(
            [
                {
                    "slug": "example",
                    "profile_action": "create-profile",
                    "profile_path": str(tmp_path / "profiles" / "example.yaml"),
                    "recommended_goals": ["events"],
                }
            ]
        ),
        encoding="utf-8",
    )

    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    (packet_dir / "phase_00_fix-invalid-existing-profiles.patch").write_text("", encoding="utf-8")

    rollout_json = tmp_path / "rollout.json"
    rollout_json.write_text(
        json.dumps(
            {
                "summary": {"invalid_preflight_profiles": 0},
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 0},
                    {"phase": 1, "name": "batch_01", "count": 1},
                ],
            }
        ),
        encoding="utf-8",
    )

    drift_plan_json = tmp_path / "drift.json"
    drift_plan_json.write_text(json.dumps({"rows": []}), encoding="utf-8")

    report_dir = tmp_path / "reports"
    summary = refresh_reports(
        batch_dir=batch_dir,
        packet_dir=packet_dir,
        rollout_json=rollout_json,
        drift_plan_json=drift_plan_json,
        report_dir=report_dir,
    )

    assert (report_dir / "profile_goal_patch_status_latest.json").exists()
    assert (report_dir / "profile_contract_patch_check_latest.json").exists()
    assert (report_dir / "profile_contract_phase_status_latest.json").exists()
    assert (report_dir / "profile_contract_next_step_latest.json").exists()
    assert summary["summary"]["next_step_status"] in {"ready", "done", "blocked"}
