import json

from enrich_venue_descriptions import (
    apply_venue_results,
    build_venue_task_payload,
    extract_venue_tasks,
    prepare_venue_tasks,
    run_venue_cycle,
)


def test_prepare_venue_tasks_writes_json_files(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "enrich_venue_descriptions.compute_venue_description_snapshot",
        lambda: {
            "issues": {
                "candidates": [
                    {
                        "id": 11,
                        "slug": "deshong-park",
                        "name": "DeShong Park",
                        "city": "Stone Mountain",
                        "place_type": "park",
                        "tier_label": "discoverable",
                        "issue_type": "missing_description",
                        "website": "https://example.com/deshong",
                    }
                ]
            }
        },
    )
    monkeypatch.setattr(
        "enrich_venue_descriptions.fetch_html",
        lambda *_args, **_kwargs: (
            "<html><body><main><p>DeShong Park is a Gwinnett County park with trails, playground space, a fishing lake, and outdoor recreation areas for families visiting Stone Mountain.</p></main></body></html>",
            None,
        ),
    )

    stats = prepare_venue_tasks(task_dir=tmp_path)

    assert stats == {"total": 1, "written": 1, "failed": 0, "skipped": 0}
    payload = json.loads((tmp_path / "deshong-park.json").read_text())
    assert payload["place_id"] == 11
    assert payload["slug"] == "deshong-park"
    assert "Gwinnett County park" in payload["visible_text"]


def test_extract_venue_tasks_writes_results(tmp_path, monkeypatch) -> None:
    task_dir = tmp_path / "tasks"
    result_dir = tmp_path / "results"
    task_dir.mkdir()
    task_payload = build_venue_task_payload(
        {
            "id": 11,
            "slug": "deshong-park",
            "name": "DeShong Park",
            "city": "Stone Mountain",
            "place_type": "park",
            "tier_label": "discoverable",
            "issue_type": "missing_description",
            "website": "https://example.com/deshong",
        },
        "DeShong Park is a Gwinnett County park with trails, playground space, and a fishing lake.",
    )
    (task_dir / "deshong-park.json").write_text(json.dumps(task_payload))
    monkeypatch.setattr(
        "enrich_venue_descriptions.generate_text",
        lambda *_args, **_kwargs: "DeShong Park is a Gwinnett County park with trails, playground areas, and a fishing lake for outdoor recreation.",
    )

    stats = extract_venue_tasks(task_dir=task_dir, result_dir=result_dir)

    assert stats == {"total": 1, "written": 1, "failed": 0}
    result = json.loads((result_dir / "deshong-park.json").read_text())
    assert result["place_id"] == 11
    assert "trails" in result["description"]


def test_apply_venue_results_dry_run_accepts_grounded_result(tmp_path) -> None:
    result_dir = tmp_path / "results"
    result_dir.mkdir()
    payload = {
        "schema_version": "venue_description_result_v1",
        "entity_type": "place",
        "place_id": 11,
        "slug": "deshong-park",
        "name": "DeShong Park",
        "website": "https://example.com/deshong",
        "description": "DeShong Park is a Gwinnett County park with trails, playground areas, and a fishing lake for outdoor recreation.",
        "source_text": "DeShong Park is a Gwinnett County park with trails, playground space, and a fishing lake for outdoor recreation.",
    }
    (result_dir / "deshong-park.json").write_text(json.dumps(payload))

    stats = apply_venue_results(dry_run=True, result_dir=result_dir)

    assert stats == {"total": 1, "accepted": 1, "rejected": 0, "updated": 0}


def test_apply_venue_results_rejects_ungrounded_result(tmp_path) -> None:
    result_dir = tmp_path / "results"
    result_dir.mkdir()
    payload = {
        "schema_version": "venue_description_result_v1",
        "entity_type": "place",
        "place_id": 11,
        "slug": "deshong-park",
        "name": "DeShong Park",
        "website": "https://example.com/deshong",
        "description": "An award-winning nightlife destination with celebrity chefs and rooftop bottle service in Midtown.",
        "source_text": "DeShong Park is a Gwinnett County park with trails, playground space, and a fishing lake for outdoor recreation.",
    }
    (result_dir / "deshong-park.json").write_text(json.dumps(payload))

    stats = apply_venue_results(dry_run=True, result_dir=result_dir)

    assert stats == {"total": 1, "accepted": 0, "rejected": 1, "updated": 0}


def test_run_venue_cycle_runs_prepare_extract_and_apply(monkeypatch, tmp_path) -> None:
    calls = {"prepare": [], "extract": [], "apply": []}

    def fake_prepare_venue_tasks(*, slug=None, render_js=False, task_dir=None, limit=None, return_details=False):
        calls["prepare"].append({"slug": slug, "render_js": render_js, "task_dir": task_dir, "limit": limit})
        if slug == "skip-me":
            result = {"total": 1, "written": 0, "failed": 0, "skipped": 1}
            if return_details:
                result["details"] = [{"slug": slug, "status": "skipped", "reason": "low_signal_page_text"}]
            return result
        result = {"total": 1, "written": 1, "failed": 0, "skipped": 0}
        if return_details:
            result["details"] = [{"slug": slug, "status": "written", "reason": "ok"}]
        return result

    def fake_extract_venue_tasks(*, task_dir=None, result_dir=None, provider_override=None, model_override=None, slug=None, return_details=False):
        calls["extract"].append(
            {
                "task_dir": task_dir,
                "result_dir": result_dir,
                "provider_override": provider_override,
                "model_override": model_override,
                "slug": slug,
            }
        )
        result = {"total": 1, "written": 1, "failed": 0}
        if return_details:
            result["details"] = [{"slug": "good-one", "status": "written", "reason": "ok"}]
        return result

    def fake_apply_venue_results(*, dry_run=True, slug=None, result_dir=None, return_details=False):
        calls["apply"].append({"dry_run": dry_run, "slug": slug, "result_dir": result_dir})
        if dry_run:
            return {
                "total": 1,
                "accepted": 1,
                "rejected": 0,
                "updated": 0,
                "details": [{"slug": "good-one", "status": "accepted", "reason": "ok"}],
            }
        return {
            "total": 1,
            "accepted": 1,
            "rejected": 0,
            "updated": 1,
            "details": [{"slug": "good-one", "status": "updated", "reason": "ok"}],
        }

    def fake_record_history(**_kwargs):
        return {"generated_at": "2026-04-04T05:00:00Z", "slugs": {}}

    def fake_regenerate_artifacts():
        return {
            "snapshot": {"counts": {"pilot_candidate_count": 9, "monitor_only_count": 4}},
            "gate": {"decision": "PILOT_READY"},
        }

    monkeypatch.setattr("enrich_venue_descriptions.prepare_venue_tasks", fake_prepare_venue_tasks)
    monkeypatch.setattr("enrich_venue_descriptions.extract_venue_tasks", fake_extract_venue_tasks)
    monkeypatch.setattr("enrich_venue_descriptions.apply_venue_results", fake_apply_venue_results)
    monkeypatch.setattr("enrich_venue_descriptions._record_venue_cycle_history", fake_record_history)
    monkeypatch.setattr("enrich_venue_descriptions.regenerate_venue_artifacts", fake_regenerate_artifacts)

    stats = run_venue_cycle(
        slugs=["good-one", "skip-me"],
        task_dir=tmp_path / "tasks",
        result_dir=tmp_path / "results",
        live=True,
        render_js=True,
        provider_override="provider-x",
        model_override="model-y",
    )

    assert stats["requested_slugs"] == ["good-one", "skip-me"]
    assert stats["prepared_slugs"] == ["good-one"]
    assert stats["extract_stats"]["total"] == 1
    assert stats["extract_stats"]["written"] == 1
    assert stats["extract_stats"]["failed"] == 0
    assert stats["extract_stats"]["details"] == [{"slug": "good-one", "status": "written", "reason": "ok"}]
    assert stats["dry_run_stats"]["accepted"] == 1
    assert stats["live_stats"]["updated"] == 1
    assert stats["history_generated_at"] == "2026-04-04T05:00:00Z"
    assert stats["gate_decision"] == "PILOT_READY"
    assert stats["pilot_candidate_count"] == 9
    assert stats["monitor_only_count"] == 4
    assert len(calls["prepare"]) == 2
    assert calls["extract"][0]["provider_override"] == "provider-x"
    assert calls["apply"] == [
        {"dry_run": True, "slug": None, "result_dir": tmp_path / "results"},
        {"dry_run": False, "slug": None, "result_dir": tmp_path / "results"},
    ]
