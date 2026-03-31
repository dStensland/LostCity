from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_goal_patch_status import build_status_report, evaluate_row


def test_evaluate_row_marks_missing_profile():
    row = {
        "slug": "definitely-not-a-real-profile-slug",
        "profile_action": "create-profile",
        "profile_path": "/tmp/definitely-not-a-real-profile-slug.yaml",
        "recommended_goals": ["events"],
    }
    result = evaluate_row(row)
    assert result.status == "missing"


def test_build_status_report_reads_batch_dir(tmp_path: Path):
    batch_dir = tmp_path / "batches"
    batch_dir.mkdir()
    (batch_dir / "batch_01.json").write_text(
        json.dumps(
            [
                {
                    "slug": "definitely-not-a-real-profile-slug",
                    "profile_action": "create-profile",
                    "profile_path": "/tmp/definitely-not-a-real-profile-slug.yaml",
                    "recommended_goals": ["events"],
                }
            ]
        ),
        encoding="utf-8",
    )
    report = build_status_report(batch_dir)
    assert report["summary"]["batches"] == 1
    assert report["summary"]["rows"] == 1
    assert report["summary"]["status_counts"]["missing"] == 1
