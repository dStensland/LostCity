from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_schema_drift_queue import build_queue, classify_reason


def test_classify_reason_detects_data_goal_errors():
    assert classify_reason("data_goals.0 invalid literal") == "unsupported-data-goals"


def test_build_queue_extracts_invalid_rows(tmp_path: Path):
    report_path = tmp_path / "status.json"
    report_path.write_text(
        json.dumps(
            {
                "rows": [
                    {"slug": "a", "status": "missing", "reason": "profile file does not exist yet"},
                    {"slug": "b", "status": "invalid", "reason": "data_goals.0 invalid literal", "profile_path": "/tmp/b.yaml"},
                ]
            }
        ),
        encoding="utf-8",
    )
    queue = build_queue(report_path)
    assert queue["summary"]["invalid_profiles"] == 1
    assert queue["summary"]["error_counts"]["unsupported-data-goals"] == 1
