from __future__ import annotations

import json
from pathlib import Path

import yaml

from scripts.profile_contract_patch_packets import (
    _apply_batch_row,
    _apply_drift_row,
    build_patch_packets,
    render_index_markdown,
)


def test_apply_drift_row_updates_existing_profile(tmp_path: Path):
    profile_path = tmp_path / "exchange-recreation-center.yaml"
    profile_path.write_text(
        "\n".join(
            [
                "version: 1",
                "slug: exchange-recreation-center",
                "name: Exchange Recreation Center",
                "data_goals:",
                "  - destinations",
                "discovery:",
                "  type: html",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    diff = _apply_drift_row(
        {
            "profile_path": str(profile_path),
            "recommended_data_goals": ["images", "planning", "accessibility", "venue_hours"],
            "recommended_discovery_type": None,
            "change_actions": ["replace-data-goals"],
        }
    )

    assert "a/" in diff
    assert "b/" in diff
    assert "+- venue_hours" in diff


def test_apply_batch_row_creates_new_profile(tmp_path: Path):
    profile_path = tmp_path / "new-profile.yaml"
    diff = _apply_batch_row(
        {
            "profile_path": str(profile_path),
            "profile_action": "create-profile",
            "slug": "new-profile",
            "name": "New Profile",
            "recommended_goals": ["open_calls"],
        }
    )

    assert "--- /dev/null" in diff
    assert "+++ b/" in diff
    assert "+slug: new-profile" in diff


def test_build_patch_packets_includes_phase_zero_and_batches(tmp_path: Path):
    profiles_dir = tmp_path / "profiles"
    profiles_dir.mkdir()
    invalid_profile = profiles_dir / "hawks-bars.yaml"
    invalid_profile.write_text(
        yaml.safe_dump(
            {
                "version": 1,
                "slug": "hawks-bars",
                "name": "Hawks Bars",
                "discovery": {"type": "json", "enabled": False},
                "data_goals": ["events", "images", "venue_hours"],
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )

    drift_path = tmp_path / "drift.json"
    drift_path.write_text(
        json.dumps(
            {
                "rows": [
                    {
                        "slug": "hawks-bars",
                        "profile_path": str(invalid_profile),
                        "recommended_data_goals": ["events", "images", "venue_hours"],
                        "recommended_discovery_type": "html",
                        "change_actions": ["replace-discovery-type"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    batch_dir = tmp_path / "batches"
    batch_dir.mkdir()
    (batch_dir / "batch_01.json").write_text(
        json.dumps(
            [
                {
                    "slug": "open-calls-artconnect",
                    "name": "ArtConnect",
                    "profile_path": str(profiles_dir / "open-calls-artconnect.yaml"),
                    "profile_action": "create-profile",
                    "recommended_goals": ["open_calls"],
                }
            ]
        ),
        encoding="utf-8",
    )

    report = build_patch_packets(drift_path, batch_dir)

    assert report["summary"]["phase_count"] == 2
    assert report["summary"]["invalid_profiles"] == 1
    assert report["summary"]["batch_rows"] == 1
    assert report["phases"][0]["name"] == "fix-invalid-existing-profiles"
    assert report["phases"][1]["name"] == "batch_01"


def test_render_index_markdown_lists_patch_files(tmp_path: Path):
    markdown = render_index_markdown(
        {
            "summary": {
                "invalid_profiles": 1,
                "batch_count": 1,
                "batch_rows": 2,
            },
            "phases": [
                {"phase": 0, "name": "fix-invalid-existing-profiles", "count": 1},
                {"phase": 1, "name": "batch_01", "count": 2},
            ],
        },
        tmp_path,
    )

    assert "phase_00_fix-invalid-existing-profiles.patch" in markdown
    assert "phase_01_batch_01.patch" in markdown
