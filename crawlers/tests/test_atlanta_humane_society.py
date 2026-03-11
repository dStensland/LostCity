from sources.atlanta_humane_society import _categorize, _sync_existing_event


def test_categorize_bingo_night_as_fundraiser_not_adoption():
    category, subcategory, tags = _categorize(
        "Bingo Night",
        "Bingo Night is a local event. Admission: free.",
    )

    assert category == "community"
    assert subcategory == "fundraiser"
    assert "fundraiser" in tags
    assert "adoption" not in tags


def test_categorize_info_session_as_learning():
    category, subcategory, tags = _categorize(
        "Virtual Pets In Crisis Info Session",
        "Join us during our Virtual Pets in Crisis Support Program Information Session to learn more about this program and how to get involved.",
    )

    assert category == "learning"
    assert subcategory == "info-session"
    assert "adoption" not in tags


def test_sync_existing_event_overwrites_stale_tags(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "sources.atlanta_humane_society.update_event",
        lambda event_id, payload: calls.append(("update", event_id, payload)),
    )
    monkeypatch.setattr(
        "sources.atlanta_humane_society.smart_update_existing_event",
        lambda existing, incoming: calls.append(("smart", existing["tags"], incoming["tags"])),
    )

    _sync_existing_event(
        {
            "id": 77,
            "category_id": "community",
            "tags": ["adoption", "animals", "atlanta-humane-society", "family-friendly"],
        },
        {
            "category": "community",
            "tags": ["animals", "atlanta-humane", "fundraiser", "nightlife"],
        },
    )

    assert calls == [
        ("update", 77, {"tags": ["animals", "atlanta-humane", "fundraiser", "nightlife"]}),
        (
            "smart",
            ["animals", "atlanta-humane", "fundraiser", "nightlife"],
            ["animals", "atlanta-humane", "fundraiser", "nightlife"],
        ),
    ]
