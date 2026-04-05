from scripts.festival_atlanta_verification import build_atlanta_verification


def _snapshot() -> dict:
    return {
        "counts": {"festivals_in_scope": 42},
        "date_quality": {
            "festival_missing_announced_start": 0,
            "festival_past_cycle_pending_only": 5,
            "festivals_with_events_outside_announced_window": 0,
        },
        "description_quality": {
            "festival_short_description_lt80": 0,
            "top_series_description_gap_festivals": [],
        },
        "samples": {
            "festival_missing_announced_start": [],
            "festival_short_description": [],
            "festivals_with_events_outside_announced_window": [],
            "festival_past_cycle_pending_only": [
                {
                    "slug": "atlanta-black-expo",
                    "pending_start": "2026-02-20",
                    "pending_end": "2026-02-22",
                    "date_source": "auto-demoted-stale",
                }
            ],
        },
    }


def test_build_atlanta_verification_passes_when_gate_clean(monkeypatch) -> None:
    monkeypatch.setattr(
        "scripts.festival_atlanta_verification._summarize_llm_pilot",
        lambda *_args, **_kwargs: {
            "tasks_total": 3,
            "results_total": 3,
            "accepted_total": 3,
            "rejected_total": 0,
            "prepared_only_total": 0,
            "accepted": [],
            "rejected": [],
            "prepared_only": [],
        },
    )
    monkeypatch.setattr(
        "scripts.festival_atlanta_verification.build_report_payload",
        lambda *_args, **_kwargs: {
            "remediation_queue": [],
            "promotion_holds": [],
            "evaluation": {"overall": "PASS"},
        },
    )

    verification = build_atlanta_verification(
        _snapshot(),
        {
            "decision": "PASS",
            "overall_gate_status": "PASS",
            "promotion_hold_count": 0,
        },
    )

    assert verification["status"] == "PASS"
    assert verification["counts"]["festival_past_cycle_pending_only"] == 5
    assert verification["remediation_queue_count"] == 0


def test_build_atlanta_verification_warns_when_queue_remains(monkeypatch) -> None:
    monkeypatch.setattr(
        "scripts.festival_atlanta_verification._summarize_llm_pilot",
        lambda *_args, **_kwargs: {
            "tasks_total": 3,
            "results_total": 3,
            "accepted_total": 3,
            "rejected_total": 0,
            "prepared_only_total": 0,
            "accepted": [],
            "rejected": [],
            "prepared_only": [],
        },
    )
    monkeypatch.setattr(
        "scripts.festival_atlanta_verification.build_report_payload",
        lambda *_args, **_kwargs: {
            "remediation_queue": [
                {
                    "target": "atlanta-film-festival",
                    "scope": "festival",
                    "reason": "festival series descriptions weak",
                    "evidence": "1 weak series description",
                }
            ],
            "promotion_holds": [],
            "evaluation": {"overall": "PASS"},
        },
    )

    verification = build_atlanta_verification(
        _snapshot(),
        {
            "decision": "PASS",
            "overall_gate_status": "PASS",
            "promotion_hold_count": 0,
        },
    )

    assert verification["status"] == "WARN"
    assert verification["samples"]["remediation_queue"][0]["target"] == "atlanta-film-festival"
