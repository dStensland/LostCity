from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_contract_rollout import build_rollout, render_markdown


def test_build_rollout_orders_preflight_before_batches(tmp_path: Path):
    drift_path = tmp_path / "drift.json"
    drift_path.write_text(
        json.dumps(
            {
                "summary": {"invalid_profiles": 1},
                "rows": [{"slug": "hawks-bars", "profile_path": "/tmp/hawks-bars.yaml"}],
            }
        ),
        encoding="utf-8",
    )

    batch_dir = tmp_path / "batches"
    batch_dir.mkdir()
    (batch_dir / "batch_01.json").write_text(
        json.dumps([{"slug": "exhibition-hub-atlanta"}, {"slug": "besharat-gallery"}]),
        encoding="utf-8",
    )

    status_path = tmp_path / "status.json"
    status_path.write_text(
        json.dumps({"summary": {"status_counts": {"invalid": 1, "missing": 2}}}),
        encoding="utf-8",
    )

    report = build_rollout(drift_path, batch_dir, status_path)

    assert report["summary"]["invalid_preflight_profiles"] == 1
    assert report["summary"]["batch_count"] == 1
    assert report["summary"]["batch_rows"] == 2
    assert report["phases"][0]["phase"] == 0
    assert report["phases"][0]["name"] == "fix-invalid-existing-profiles"
    assert report["phases"][1]["name"] == "batch_01"
    assert report["phases"][1]["top_slugs"] == ["exhibition-hub-atlanta", "besharat-gallery"]


def test_render_markdown_includes_execution_order():
    markdown = render_markdown(
        {
            "status_report_path": "/tmp/status.json",
            "drift_plan_path": "/tmp/drift.json",
            "batch_dir": "/tmp/batches",
            "summary": {
                "invalid_preflight_profiles": 1,
                "batch_count": 1,
                "batch_rows": 2,
                "status_counts": {"invalid": 1, "missing": 2},
            },
            "phases": [
                {
                    "phase": 0,
                    "name": "fix-invalid-existing-profiles",
                    "count": 1,
                    "path": "/tmp/drift.json",
                    "markdown_path": "/tmp/drift.md",
                },
                {
                    "phase": 1,
                    "name": "batch_01",
                    "count": 2,
                    "path": "/tmp/batches/batch_01.json",
                    "markdown_path": "/tmp/batches/batch_01.md",
                    "top_slugs": ["exhibition-hub-atlanta", "besharat-gallery"],
                },
            ],
        }
    )

    assert "### Phase 0: fix-invalid-existing-profiles" in markdown
    assert "### Phase 1: batch_01" in markdown
    assert "First slugs: exhibition-hub-atlanta, besharat-gallery" in markdown
    assert "## Verification" in markdown
