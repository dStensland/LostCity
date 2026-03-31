from __future__ import annotations

from scripts.profile_goal_patch_batches import chunk_rows, render_batch_markdown, render_index_markdown


def test_chunk_rows_splits_evenly():
    rows = [{"slug": f"item-{idx}"} for idx in range(5)]
    batches = chunk_rows(rows, 2)
    assert [len(batch) for batch in batches] == [2, 2, 1]


def test_render_batch_markdown_includes_yaml_snippets():
    markdown = render_batch_markdown(
        [
            {
                "profile_action": "create-profile",
                "slug": "example",
                "portal_slug": "atlanta",
                "profile_path": "/tmp/example.yaml",
                "recommended_goals": ["events", "images"],
                "yaml_snippet": "data_goals:\n  - events\n  - images",
            }
        ],
        batch_index=1,
        batch_count=3,
    )
    assert "# Profile Goal Patch Batch 1 of 3" in markdown
    assert "### example" in markdown
    assert "data_goals:\n  - events\n  - images" in markdown


def test_render_index_markdown_lists_batches():
    markdown = render_index_markdown(
        {
            "generated_at": "2026-03-31T12:00:00+00:00",
            "summary": {
                "patch_candidates": 25,
                "batch_size": 10,
                "batch_count": 3,
                "profile_action_counts": {"create-profile": 20, "add-data-goals": 5},
            },
            "batch_summaries": [
                {"index": 1, "size": 10, "first_slug": "a", "last_slug": "j"},
                {"index": 2, "size": 10, "first_slug": "k", "last_slug": "t"},
            ],
        }
    )
    assert "| 1 | 10 | a | j |" in markdown
