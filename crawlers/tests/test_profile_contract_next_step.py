from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_contract_next_step import build_recommendation, render_markdown


def test_build_recommendation_prioritizes_phase_zero(tmp_path: Path):
    rollout = tmp_path / "rollout.json"
    rollout.write_text(
        json.dumps(
            {
                "summary": {"invalid_preflight_profiles": 2},
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 2},
                    {"phase": 1, "name": "batch_01", "count": 20},
                ],
            }
        ),
        encoding="utf-8",
    )
    patch_check = tmp_path / "patch_check.json"
    patch_check.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": "phase_00_fix-invalid-existing-profiles", "status": "clean", "message": ""},
                ]
            }
        ),
        encoding="utf-8",
    )
    status = tmp_path / "status.json"
    status.write_text(json.dumps({"batch_summaries": []}), encoding="utf-8")
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()

    report = build_recommendation(rollout, patch_check, status, packet_dir)

    assert report["status"] == "ready"
    assert report["next_phase"]["phase"] == 0


def test_build_recommendation_skips_phase_zero_when_phase_status_marks_complete(tmp_path: Path):
    rollout = tmp_path / "rollout.json"
    rollout.write_text(
        json.dumps(
            {
                "summary": {"invalid_preflight_profiles": 9},
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 9},
                    {"phase": 1, "name": "batch_01", "count": 20},
                ],
            }
        ),
        encoding="utf-8",
    )
    patch_check = tmp_path / "patch_check.json"
    patch_check.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": "phase_00_fix-invalid-existing-profiles", "status": "blocked", "message": "patch no longer applies"},
                    {"phase": "phase_01_batch_01", "status": "clean", "message": ""},
                ]
            }
        ),
        encoding="utf-8",
    )
    status = tmp_path / "status.json"
    status.write_text(
        json.dumps(
            {
                "batch_summaries": [
                    {"batch": "batch_01", "status_counts": {"missing": 20}},
                ]
            }
        ),
        encoding="utf-8",
    )
    phase_status = tmp_path / "phase_status.json"
    phase_status.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "status": "complete"},
                    {"phase": 1, "name": "batch_01", "status": "pending"},
                ]
            }
        ),
        encoding="utf-8",
    )
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()

    report = build_recommendation(
        rollout,
        patch_check,
        status,
        packet_dir,
        phase_status_path=phase_status,
    )

    assert report["status"] == "ready"
    assert report["next_phase"]["phase"] == 1
    assert report["next_phase"]["name"] == "batch_01"


def test_build_recommendation_advances_to_first_pending_batch(tmp_path: Path):
    rollout = tmp_path / "rollout.json"
    rollout.write_text(
        json.dumps(
            {
                "summary": {"invalid_preflight_profiles": 0},
                "phases": [
                    {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 0},
                    {"phase": 1, "name": "batch_01", "count": 20},
                    {"phase": 2, "name": "batch_02", "count": 20},
                ],
            }
        ),
        encoding="utf-8",
    )
    patch_check = tmp_path / "patch_check.json"
    patch_check.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": "phase_01_batch_01", "status": "clean", "message": ""},
                    {"phase": "phase_02_batch_02", "status": "clean", "message": ""},
                ]
            }
        ),
        encoding="utf-8",
    )
    status = tmp_path / "status.json"
    status.write_text(
        json.dumps(
            {
                "batch_summaries": [
                    {"batch": "batch_01", "status_counts": {"applied": 20}},
                    {"batch": "batch_02", "status_counts": {"missing": 20}},
                ]
            }
        ),
        encoding="utf-8",
    )
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()

    report = build_recommendation(rollout, patch_check, status, packet_dir)

    assert report["status"] == "ready"
    assert report["next_phase"]["phase"] == 2
    assert report["next_phase"]["name"] == "batch_02"


def test_render_markdown_includes_commands():
    markdown = render_markdown(
        {
            "status": "ready",
            "reason": "batch_01 still has unapplied rows",
            "next_phase": {
                "phase": 1,
                "name": "batch_01",
                "count": 20,
                "packet_path": "/tmp/phase_01_batch_01.patch",
                "patch_check_status": "clean",
                "patch_check_message": "",
            },
            "commands": ["git apply /tmp/phase_01_batch_01.patch"],
        }
    )

    assert "- Status: ready" in markdown
    assert "```bash" in markdown
    assert "git apply /tmp/phase_01_batch_01.patch" in markdown
