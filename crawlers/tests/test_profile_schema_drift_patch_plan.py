from __future__ import annotations

import json
from pathlib import Path

from scripts.profile_schema_drift_patch_plan import (
    build_patch_plan,
    normalize_legacy_data_goals,
    normalize_legacy_discovery_type,
    render_markdown,
)


def test_normalize_legacy_data_goals_for_family_map():
    goals, reasons = normalize_legacy_data_goals(
        goals=["destinations", "destination_details", "venue_features"],
        slug="atlanta-parks-family-map",
        name="Atlanta Parks Family Map",
    )
    assert goals == ["images", "planning", "accessibility"]
    assert reasons


def test_normalize_legacy_data_goals_adds_hours_for_center():
    goals, _ = normalize_legacy_data_goals(
        goals=["destinations", "destination_details", "venue_features"],
        slug="exchange-recreation-center",
        name="Exchange Recreation Center",
    )
    assert goals == ["images", "planning", "accessibility", "venue_hours"]


def test_normalize_legacy_discovery_type_maps_wp_json_to_api():
    recommended_type, patch, reasons = normalize_legacy_discovery_type(
        {
            "integration_method": "api",
            "discovery": {
                "enabled": True,
                "type": "json",
                "urls": ["https://www.essentialtheatre.com/wp-json/wp/v2/et_play?per_page=100"],
            },
        }
    )
    assert recommended_type == "api"
    assert patch == {"type": "api", "api": {"adapter": "custom"}}
    assert reasons


def test_normalize_legacy_discovery_type_maps_curated_to_list():
    recommended_type, patch, _ = normalize_legacy_discovery_type(
        {
            "integration_method": "python",
            "discovery": {
                "enabled": False,
                "type": "curated",
                "urls": ["https://cpskyhawks.gleague.nba.com/news/college-park-skyhawks-announce-2025-26-season-schedule"],
            },
        }
    )
    assert recommended_type == "list"
    assert patch == {"type": "list"}


def test_build_patch_plan_generates_yaml_snippets(tmp_path: Path):
    profile_dir = tmp_path / "profiles"
    profile_dir.mkdir()
    profile_path = profile_dir / "essential-theatre.yaml"
    profile_path.write_text(
        "\n".join(
            [
                "version: 1",
                "slug: essential-theatre",
                "name: Essential Theatre",
                "integration_method: api",
                "discovery:",
                "  enabled: true",
                "  type: json",
                "  urls:",
                "    - https://www.essentialtheatre.com/wp-json/wp/v2/et_play?per_page=100",
                "data_goals:",
                "  - events",
                "  - images",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    status_path = tmp_path / "status.json"
    status_path.write_text(
        json.dumps(
            {
                "rows": [
                    {
                        "slug": "essential-theatre",
                        "status": "invalid",
                        "reason": "profile failed to load: 1 validation error for SourceProfile\ndiscovery.type\n  Input should be 'list', 'html', 'api' or 'feed'",
                        "profile_path": str(profile_path),
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    report = build_patch_plan(status_path)

    assert report["summary"]["invalid_profiles"] == 1
    assert report["summary"]["action_counts"]["replace-discovery-type"] == 1
    assert report["rows"][0]["yaml_snippet"] == "discovery:\n  type: api\n  api:\n    adapter: custom"


def test_render_markdown_includes_snippets():
    markdown = render_markdown(
        {
            "source_report": "/tmp/status.json",
            "summary": {
                "invalid_profiles": 1,
                "action_counts": {"replace-data-goals": 1},
                "error_counts": {"unsupported-data-goals": 1},
            },
            "rows": [
                {
                    "slug": "exchange-recreation-center",
                    "profile_path": "/tmp/exchange-recreation-center.yaml",
                    "error_class": "unsupported-data-goals",
                    "change_actions": ["replace-data-goals"],
                    "reasons": ["legacy destination profile goals are no longer valid literals in the current schema"],
                    "yaml_snippet": "data_goals:\n  - images\n  - planning\n  - accessibility\n  - venue_hours",
                }
            ],
        }
    )

    assert "## YAML Snippets" in markdown
    assert "exchange-recreation-center" in markdown
    assert "data_goals:\n  - images\n  - planning\n  - accessibility\n  - venue_hours" in markdown
