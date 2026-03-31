from __future__ import annotations

import subprocess
from pathlib import Path

from scripts.profile_contract_execute_phase import execute_phase, find_phase_patch, render_markdown


def _init_repo(repo: Path) -> None:
    subprocess.run(["git", "-C", str(repo), "init"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.com"], check=True, capture_output=True, text=True)


def test_find_phase_patch_locates_single_match(tmp_path: Path):
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_03_batch_03.patch"
    patch.write_text("", encoding="utf-8")

    assert find_phase_patch(packet_dir, 3) == patch


def test_execute_phase_check_only(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    target = repo / "example.txt"
    target.write_text("old\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "example.txt"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-m", "init"], check=True, capture_output=True, text=True)

    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_01_batch_01.patch"
    patch.write_text(
        "\n".join(
            [
                "--- a/example.txt",
                "+++ b/example.txt",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "",
            ]
        ),
        encoding="utf-8",
    )

    result = execute_phase(
        phase=1,
        packet_dir=packet_dir,
        repo_root=repo,
        apply=False,
        refresh=False,
    )

    assert result["check_ok"] is True
    assert result["applied"] is False
    assert target.read_text(encoding="utf-8") == "old\n"


def test_execute_phase_apply_with_refresh_stub(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    target = repo / "example.txt"
    target.write_text("old\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "example.txt"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-m", "init"], check=True, capture_output=True, text=True)

    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_01_batch_01.patch"
    patch.write_text(
        "\n".join(
            [
                "--- a/example.txt",
                "+++ b/example.txt",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "",
            ]
        ),
        encoding="utf-8",
    )

    calls = {}

    def fake_refresh_fn(**kwargs):
        calls.update(kwargs)
        return {"summary": {"next_phase": "batch_02", "next_step_status": "ready"}}

    result = execute_phase(
        phase=1,
        packet_dir=packet_dir,
        repo_root=repo,
        apply=True,
        refresh=True,
        batch_dir=tmp_path / "batches",
        rollout_json=tmp_path / "rollout.json",
        drift_plan_json=tmp_path / "drift.json",
        report_dir=tmp_path / "reports",
        refresh_fn=fake_refresh_fn,
    )

    assert result["check_ok"] is True
    assert result["applied"] is True
    assert result["refreshed"] is True
    assert result["refresh_summary"]["next_phase"] == "batch_02"
    assert target.read_text(encoding="utf-8") == "new\n"
    assert calls["packet_dir"] == packet_dir


def test_execute_phase_reverse_apply(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _init_repo(repo)
    target = repo / "example.txt"
    target.write_text("new\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "add", "example.txt"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-m", "init"], check=True, capture_output=True, text=True)

    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_01_batch_01.patch"
    patch.write_text(
        "\n".join(
            [
                "--- a/example.txt",
                "+++ b/example.txt",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "",
            ]
        ),
        encoding="utf-8",
    )

    result = execute_phase(
        phase=1,
        packet_dir=packet_dir,
        repo_root=repo,
        apply=True,
        refresh=False,
        reverse=True,
    )

    assert result["check_ok"] is True
    assert result["applied"] is True
    assert result["reverse"] is True
    assert target.read_text(encoding="utf-8") == "old\n"


def test_render_markdown_includes_refresh_summary():
    markdown = render_markdown(
        {
            "phase": 1,
            "reverse": False,
            "patch_path": "/tmp/phase_01_batch_01.patch",
            "check_ok": True,
            "check_message": "",
            "applied": True,
            "apply_message": "",
            "refreshed": True,
            "refresh_summary": {
                "next_phase": "batch_02",
                "next_step_status": "ready",
                "patch_status_counts": {"missing": 10},
            },
        }
    )

    assert "- Phase: 1" in markdown
    assert "- Reverse: False" in markdown
    assert "- Applied: True" in markdown
    assert "- Next phase: batch_02" in markdown
