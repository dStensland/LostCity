from __future__ import annotations

from pathlib import Path

from scripts.profile_contract_run_next import render_markdown, run_next_phase


def test_run_next_phase_delegates_to_executor(tmp_path: Path):
    calls = {}

    def fake_recommendation_fn(**kwargs):
        return {
            "status": "ready",
            "reason": "phase 0 still pending",
            "next_phase": {
                "phase": 0,
                "name": "fix-invalid-existing-profiles",
                "packet_path": "/tmp/phase_00.patch",
                "patch_check_status": "clean",
            },
        }

    def fake_execute_fn(**kwargs):
        calls.update(kwargs)
        return {"phase": 0, "check_ok": True, "applied": False, "refreshed": False}

    result = run_next_phase(
        rollout_json=tmp_path / "rollout.json",
        patch_check_json=tmp_path / "patch_check.json",
        patch_status_json=tmp_path / "patch_status.json",
        packet_dir=tmp_path / "packets",
        repo_root=tmp_path / "repo",
        apply=False,
        refresh=False,
        recommendation_fn=fake_recommendation_fn,
        execute_fn=fake_execute_fn,
    )

    assert result["recommendation"]["next_phase"]["phase"] == 0
    assert result["execution"]["check_ok"] is True
    assert calls["phase"] == 0
    assert calls["apply"] is False


def test_run_next_phase_handles_done_state(tmp_path: Path):
    def fake_recommendation_fn(**kwargs):
        return {
            "status": "done",
            "reason": "no remaining rollout phases need action",
            "next_phase": None,
            "commands": [],
        }

    result = run_next_phase(
        rollout_json=tmp_path / "rollout.json",
        patch_check_json=tmp_path / "patch_check.json",
        patch_status_json=tmp_path / "patch_status.json",
        packet_dir=tmp_path / "packets",
        repo_root=tmp_path / "repo",
        apply=False,
        refresh=False,
        recommendation_fn=fake_recommendation_fn,
    )

    assert result["execution"] is None
    assert result["recommendation"]["status"] == "done"


def test_render_markdown_includes_recommendation_and_execution():
    markdown = render_markdown(
        {
            "recommendation": {
                "status": "ready",
                "reason": "phase 0 still pending",
                "next_phase": {
                    "phase": 0,
                    "name": "fix-invalid-existing-profiles",
                    "packet_path": "/tmp/phase_00.patch",
                    "patch_check_status": "clean",
                },
            },
            "execution": {
                "phase": 0,
                "patch_path": "/tmp/phase_00.patch",
                "check_ok": True,
                "check_message": "",
                "applied": False,
                "apply_message": "",
                "refreshed": False,
                "refresh_summary": None,
            },
        }
    )

    assert "- Recommendation status: ready" in markdown
    assert "- Phase: 0 (fix-invalid-existing-profiles)" in markdown
    assert "# Profile Contract Phase Execution" in markdown
