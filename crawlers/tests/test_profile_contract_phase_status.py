from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_contract_phase_status import build_phase_status, render_markdown


def test_build_phase_status_tracks_phase_zero_and_batches(tmp_path: Path):
    rollout = tmp_path / "rollout.json"
    rollout.write_text(
        json.dumps(
            {
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 2},
                    {"phase": 1, "name": "batch_01", "count": 3},
                ]
            }
        ),
        encoding="utf-8",
    )
    drift = tmp_path / "drift.json"
    drift.write_text(
        json.dumps(
            {
                "rows": [
                    {"slug": "missing-a"},
                    {"slug": "missing-b"},
                ]
            }
        ),
        encoding="utf-8",
    )
    patch_status = tmp_path / "patch_status.json"
    patch_status.write_text(
        json.dumps(
            {
                "batch_summaries": [
                    {"batch": "batch_01", "status_counts": {"applied": 1, "missing": 2}},
                ]
            }
        ),
        encoding="utf-8",
    )
    patch_check = tmp_path / "patch_check.json"
    patch_check.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": "phase_00_fix-invalid-existing-profiles", "status": "clean"},
                    {"phase": "phase_01_batch_01", "status": "clean"},
                ]
            }
        ),
        encoding="utf-8",
    )

    report = build_phase_status(rollout, drift, patch_status, patch_check)

    assert report["summary"]["phases"] == 2
    assert report["summary"]["pending_phases"] == 2
    assert report["rows"][0]["phase"] == 0
    assert report["rows"][1]["name"] == "batch_01"
    assert report["rows"][1]["complete_rows"] == 1
    assert report["rows"][1]["pending_rows"] == 2


def test_render_markdown_includes_scoreboard():
    markdown = render_markdown(
        {
            "summary": {
                "phases": 2,
                "complete_phases": 0,
                "pending_phases": 2,
                "blocked_phases": 0,
            },
            "rows": [
                {
                    "phase": 0,
                    "name": "fix-invalid-existing-profiles",
                    "status": "pending",
                    "rows": 2,
                    "complete_rows": 0,
                    "pending_rows": 2,
                    "patch_check_status": "clean",
                    "reason": "schema-invalid existing profiles remain",
                    "top_pending_slugs": ["a", "b"],
                }
            ],
        }
    )

    assert "## Phase Scoreboard" in markdown
    assert "| 0 | fix-invalid-existing-profiles | pending | 2 | 0 | 2 | clean | schema-invalid existing profiles remain |" in markdown
    assert "Pending slugs: a, b" in markdown


def test_build_phase_status_marks_complete_blocked_phase_as_already_applied(tmp_path: Path):
    rollout = tmp_path / "rollout.json"
    rollout.write_text(
        json.dumps(
            {
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 0},
                    {"phase": 1, "name": "batch_01", "count": 2},
                ]
            }
        ),
        encoding="utf-8",
    )
    drift = tmp_path / "drift.json"
    drift.write_text(json.dumps({"rows": []}), encoding="utf-8")
    patch_status = tmp_path / "patch_status.json"
    patch_status.write_text(
        json.dumps(
            {
                "batch_summaries": [
                    {"batch": "batch_01", "status_counts": {"applied": 2}},
                ]
            }
        ),
        encoding="utf-8",
    )
    patch_check = tmp_path / "patch_check.json"
    patch_check.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": "phase_00_fix-invalid-existing-profiles", "status": "already_applied"},
                    {"phase": "phase_01_batch_01", "status": "blocked"},
                ]
            }
        ),
        encoding="utf-8",
    )

    report = build_phase_status(rollout, drift, patch_status, patch_check)

    assert report["rows"][0]["patch_check_status"] == "already_applied"
    assert report["rows"][1]["patch_check_status"] == "already_applied"
    assert report["summary"]["blocked_phases"] == 0
