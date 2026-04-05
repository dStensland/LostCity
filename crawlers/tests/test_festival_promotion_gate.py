from scripts.festival_promotion_gate import build_gate_report


def test_build_gate_report_holds_when_promotion_holds_present(monkeypatch) -> None:
    monkeypatch.setattr(
        "scripts.festival_promotion_gate.compute_festival_audit_snapshot",
        lambda: {
            "derived": {"series_description_quality_pct": 19.6},
            "counts": {},
            "description_quality": {
                "top_short_description_sources": [["atlanta-fringe-festival", 52]],
                "top_missing_description_sources": [],
            },
            "samples": {"fragmented_sources": []},
        },
    )
    monkeypatch.setattr(
        "scripts.festival_promotion_gate._summarize_llm_pilot",
        lambda *_args, **_kwargs: {
            "tasks_total": 2,
            "results_total": 2,
            "accepted_total": 2,
            "rejected_total": 0,
            "prepared_only_total": 0,
        },
    )
    monkeypatch.setattr(
        "scripts.festival_promotion_gate.build_report_payload",
        lambda snapshot, pilot: {
            "evaluation": {"overall": "FAIL"},
            "promotion_holds": [
                {
                    "target": "atlanta-fringe-festival",
                    "scope": "source",
                    "reason": "festival event descriptions too short",
                    "evidence": "52 short festival event descriptions",
                    "action": "hold promotion until short-description count drops below 10",
                }
            ],
            "remediation_queue": [{"target": "atlanta-fringe-festival"}],
            "snapshot": snapshot,
            "pilot": pilot,
        },
    )

    report = build_gate_report()

    assert report["decision"] == "HOLD"
    assert report["promotion_hold_count"] == 1
    assert report["promotion_holds"][0]["target"] == "atlanta-fringe-festival"
    assert report["llm_pilot"]["accepted_total"] == 2


def test_build_gate_report_warns_without_explicit_holds(monkeypatch) -> None:
    monkeypatch.setattr(
        "scripts.festival_promotion_gate.compute_festival_audit_snapshot",
        lambda: {
            "derived": {"series_description_quality_pct": 84.0},
            "counts": {},
            "description_quality": {
                "top_short_description_sources": [],
                "top_missing_description_sources": [],
            },
            "samples": {"fragmented_sources": []},
        },
    )
    monkeypatch.setattr(
        "scripts.festival_promotion_gate._summarize_llm_pilot",
        lambda *_args, **_kwargs: {
            "tasks_total": 2,
            "results_total": 2,
            "accepted_total": 2,
            "rejected_total": 0,
            "prepared_only_total": 0,
        },
    )
    monkeypatch.setattr(
        "scripts.festival_promotion_gate.build_report_payload",
        lambda snapshot, pilot: {
            "evaluation": {"overall": "WARN"},
            "promotion_holds": [],
            "remediation_queue": [],
            "snapshot": snapshot,
            "pilot": pilot,
        },
    )

    report = build_gate_report()

    assert report["decision"] == "WARN"
    assert report["promotion_hold_count"] == 0
