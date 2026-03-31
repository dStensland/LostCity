from __future__ import annotations

from pathlib import Path

from scripts.profile_contract_patch_check import build_report, render_markdown, run_git_apply_check


def test_run_git_apply_check_detects_clean_patch(tmp_path: Path):
    repo = tmp_path / "repo"
    repo.mkdir()
    target = repo / "example.txt"
    target.write_text("old\n", encoding="utf-8")

    import subprocess

    subprocess.run(["git", "-C", str(repo), "init"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "add", "example.txt"], check=True, capture_output=True, text=True)
    subprocess.run(
        ["git", "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        check=True,
        capture_output=True,
        text=True,
    )

    patch = tmp_path / "phase_00_test.patch"
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

    ok, message = run_git_apply_check(repo, patch)

    assert ok is True
    assert message == ""


def test_build_report_marks_blocked_patch(tmp_path: Path):
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_00_test.patch"
    patch.write_text(
        "\n".join(
            [
                "--- a/missing.txt",
                "+++ b/missing.txt",
                "@@ -1 +1 @@",
                "-old",
                "+new",
                "",
            ]
        ),
        encoding="utf-8",
    )

    report = build_report(packet_dir)

    assert report["summary"]["phases"] == 1
    assert report["summary"]["blocked"] == 1
    assert report["rows"][0]["status"] == "blocked"


def test_build_report_marks_already_applied_patch(tmp_path: Path):
    packet_dir = tmp_path / "packets"
    packet_dir.mkdir()
    patch = packet_dir / "phase_00_test.patch"
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

    import subprocess
    from scripts import profile_contract_patch_check as module

    repo = tmp_path / "repo"
    repo.mkdir()
    target = repo / "example.txt"
    target.write_text("new\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo), "init"], check=True, capture_output=True, text=True)
    subprocess.run(["git", "-C", str(repo), "add", "example.txt"], check=True, capture_output=True, text=True)
    subprocess.run(
        ["git", "-C", str(repo), "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"],
        check=True,
        capture_output=True,
        text=True,
    )

    original_repo_root = module.REPO_ROOT
    module.REPO_ROOT = repo
    try:
        report = build_report(packet_dir)
    finally:
        module.REPO_ROOT = original_repo_root

    assert report["summary"]["already_applied"] == 1
    assert report["rows"][0]["status"] == "already_applied"


def test_render_markdown_includes_summary():
    markdown = render_markdown(
        {
            "packet_dir": "/tmp/packets",
            "summary": {"phases": 2, "clean": 1, "already_applied": 0, "blocked": 1},
            "rows": [
                {
                    "phase": "phase_00_test",
                    "status": "clean",
                    "patch_path": "/tmp/packets/phase_00_test.patch",
                    "message": "",
                }
            ],
        }
    )

    assert "- Clean: 1" in markdown
    assert "- Already applied: 0" in markdown
    assert "| phase_00_test | clean | /tmp/packets/phase_00_test.patch | - |" in markdown
