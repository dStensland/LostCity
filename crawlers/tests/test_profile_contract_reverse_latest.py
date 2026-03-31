from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_contract_reverse_latest import (
    render_markdown,
    reverse_latest_phase,
    select_latest_completed_phase,
)


def test_select_latest_completed_phase_prefers_highest_phase(tmp_path: Path):
    phase_status_path = tmp_path / "phase_status.json"
    phase_status_path.write_text(
        json.dumps(
            {
                "rows": [
                    {"phase": 0, "name": "phase_0", "status": "complete", "rows": 9},
                    {"phase": 1, "name": "phase_1", "status": "complete", "rows": 20},
                    {"phase": 2, "name": "phase_2", "status": "pending", "rows": 20},
                ]
            }
        ),
        encoding="utf-8",
    )

    result = select_latest_completed_phase(phase_status_path)

    assert result is not None
    assert result["phase"] == 1


def test_reverse_latest_phase_delegates_to_executor(tmp_path: Path):
    calls = {}

    def fake_selector(path: Path):
        return {"phase": 3, "name": "batch_03", "status": "complete", "rows": 20}

    def fake_execute_fn(**kwargs):
        calls.update(kwargs)
        return {"phase": 3, "check_ok": True, "applied": False, "reverse": True}

    result = reverse_latest_phase(
        phase_status_json=tmp_path / "phase_status.json",
        packet_dir=tmp_path / "packets",
        repo_root=tmp_path / "repo",
        apply=False,
        refresh=False,
        phase_selector=fake_selector,
        execute_fn=fake_execute_fn,
    )

    assert result["selected_phase"]["phase"] == 3
    assert result["execution"]["check_ok"] is True
    assert calls["phase"] == 3
    assert calls["reverse"] is True
    assert calls["apply"] is False


def test_reverse_latest_phase_handles_no_completed_phase(tmp_path: Path):
    def fake_selector(path: Path):
        return None

    result = reverse_latest_phase(
        phase_status_json=tmp_path / "phase_status.json",
        packet_dir=tmp_path / "packets",
        repo_root=tmp_path / "repo",
        apply=False,
        refresh=False,
        phase_selector=fake_selector,
    )

    assert result["selected_phase"] is None
    assert result["execution"] is None


def test_render_markdown_includes_selected_phase_and_execution():
    markdown = render_markdown(
        {
            "phase_status_path": "/tmp/phase_status.json",
            "selected_phase": {
                "phase": 2,
                "name": "batch_02",
                "rows": 20,
                "status": "complete",
            },
            "execution": {
                "phase": 2,
                "reverse": True,
                "patch_path": "/tmp/phase_02_batch_02.patch",
                "check_ok": True,
                "check_message": "",
                "applied": False,
                "apply_message": "",
                "refreshed": False,
                "refresh_summary": None,
            },
        }
    )

    assert "- Phase: 2 (batch_02)" in markdown
    assert "# Profile Contract Phase Execution" in markdown
