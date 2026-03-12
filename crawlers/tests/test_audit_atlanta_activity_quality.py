from scripts.audit_atlanta_activity_quality import render_markdown


def test_render_markdown_includes_core_sections() -> None:
    markdown = render_markdown(
        {
            "logical_target_count": 53,
            "active_feature_row_count": 159,
            "missing_url_rows": 0,
            "missing_description_rows": 0,
            "missing_price_rows": [],
            "weak_rows": [],
            "targets_not_three_rows": [],
            "duplicate_groups": {
                "sparkles": [
                    {
                        "slug": "sparkles-family-fun-center-kennesaw",
                        "city": "Kennesaw",
                        "venue_type": "games",
                        "website": "https://www.sparkles.com",
                    }
                ]
            },
        }
    )
    assert "# Atlanta Activity Quality Audit" in markdown
    assert "Active `venue_features` rows: `159`" in markdown
    assert "Missing feature `price_note`: `0`" in markdown
    assert "Targets not on the standard 3-row overlay shape: `0`" in markdown
    assert "`sparkles`" in markdown
    assert "- none" in markdown
