from entity_resolution_metrics import (
    _looks_like_festival_yearly_wrapper,
    build_entity_resolution_gate,
    classify_festival_issue,
    classify_organizer_issue,
    classify_program_issue,
    classify_venue_issue,
    compute_entity_resolution_snapshot,
)


def test_classify_venue_issue_prefers_matching_fix_for_same_address() -> None:
    label = classify_venue_issue(
        [
            {"address_norm": "123 main st", "domain": "example.com"},
            {"address_norm": "123 main st", "domain": "example.com"},
        ]
    )

    assert label == "matching_only_fix"


def test_classify_venue_issue_demotes_same_domain_different_addresses() -> None:
    label = classify_venue_issue(
        [
            {"address_norm": "123 main st", "domain": "example.com"},
            {"address_norm": "456 broad st", "domain": "example.com"},
        ]
    )

    assert label == "manual_review_only"


def test_classify_program_issue_marks_ambiguous_provider_as_manual_review() -> None:
    label = classify_program_issue(
        [
            {"venue_id": 1, "provider_name": "parks"},
            {"venue_id": 2, "provider_name": "schools"},
        ]
    )

    assert label == "manual_review_only"


def test_classify_organizer_issue_uses_alias_support_when_domains_conflict() -> None:
    label = classify_organizer_issue(
        [
            {"domain": "org-a.org"},
            {"domain": "org-b.org"},
        ]
    )

    assert label == "alias_support_fix"


def test_build_entity_resolution_gate_requires_labels() -> None:
    gate = build_entity_resolution_gate(
        {
            "generated_at": "2026-04-03T22:00:00Z",
            "metrics": {
                "duplicate_place_rate_pct": 2.0,
                "unresolved_place_source_match_rate_pct": 1.5,
                "festival_yearly_wrapper_fragmentation_rate_pct": 0.0,
                "program_session_fragmentation_rate_pct": 8.0,
                "organizer_duplication_rate_pct": 0.0,
            },
            "top_issues": [
                {"entity_family": "festival", "issue_type": "yearly_wrapper_fragmentation", "label": classify_festival_issue([]), "count": 3}
            ],
        }
    )

    assert gate["decision"] == "BASELINE_READY"
    assert gate["ready_for_mutation"] is True
    assert gate["bounded_queue"] is False


def test_build_entity_resolution_gate_can_report_bounded_queue() -> None:
    gate = build_entity_resolution_gate(
        {
            "generated_at": "2026-04-04T04:00:00Z",
            "metrics": {
                "duplicate_place_rate_pct": 1.2,
                "unresolved_place_source_match_rate_pct": 0.4,
                "festival_yearly_wrapper_fragmentation_rate_pct": 0.0,
                "program_session_fragmentation_rate_pct": 2.1,
                "organizer_duplication_rate_pct": 0.0,
            },
            "top_issues": [
                {"entity_family": "program", "issue_type": "program_session_fragmentation", "label": "matching_only_fix", "count": 4}
            ],
        }
    )

    assert gate["decision"] == "BOUNDED_QUEUE"
    assert gate["ready_for_mutation"] is False
    assert gate["bounded_queue"] is True


def test_yearly_wrapper_detection_requires_festival_name_match() -> None:
    assert _looks_like_festival_yearly_wrapper(
        "Juneteenth Atlanta Parade & Music Festival 2026",
        "Juneteenth Atlanta Parade & Music Festival",
    )
    assert not _looks_like_festival_yearly_wrapper(
        "ATLFF Presents Page to Stage: 2026 Screenplay Competition Winners",
        "Atlanta Film Festival",
    )


def test_compute_entity_resolution_snapshot_skips_family_linked_program_sessions(monkeypatch) -> None:
    def fake_fetch_rows(table, fields, **_kwargs):
        if table == "places":
            return []
        if table == "festivals":
            return []
        if table == "series":
            return []
        if table == "programs":
            return [
                {
                    "id": "program-1",
                    "name": "Code Coaching for Kids at theCoderSchool Marietta",
                    "provider_name": "theCoderSchool Atlanta",
                    "place_id": 5657,
                    "season": "spring",
                    "program_type": "enrichment",
                    "age_min": 8,
                    "age_max": 14,
                    "before_after_care": False,
                    "lunch_included": False,
                    "status": "active",
                    "source_id": 1305,
                    "metadata": {"program_family_key": "family-1"},
                },
                {
                    "id": "program-2",
                    "name": "Code Coaching for Kids at theCoderSchool Marietta",
                    "provider_name": "theCoderSchool Atlanta",
                    "place_id": 5657,
                    "season": "spring",
                    "program_type": "enrichment",
                    "age_min": 8,
                    "age_max": 14,
                    "before_after_care": False,
                    "lunch_included": False,
                    "status": "active",
                    "source_id": 1305,
                    "metadata": {"program_family_key": "family-1"},
                },
            ]
        if table == "organizations":
            return []
        raise AssertionError(f"unexpected table {table}")

    monkeypatch.setattr("entity_resolution_metrics._fetch_rows", fake_fetch_rows)
    monkeypatch.setattr("entity_resolution_metrics._fetch_event_resolution_rows", lambda: [])

    snapshot = compute_entity_resolution_snapshot()

    assert snapshot["metrics"]["program_session_fragmentation_rate_pct"] == 0.0
    assert not any(issue["entity_family"] == "program" for issue in snapshot["top_issues"])
