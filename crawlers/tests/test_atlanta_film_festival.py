from sources.atlanta_film_festival import (
    _build_series_hint_for_screening,
    _get_or_cache_venue,
    _is_ancillary_outside_window,
    _is_blacklisted_title,
    FESTIVAL_VENUE_DATA,
)


def test_is_ancillary_outside_window_requires_no_linked_films() -> None:
    assert not _is_ancillary_outside_window(
        films_linked=[{"id": "film-1"}],
        start_date="2026-03-23",
    )


def test_is_ancillary_outside_window_flags_pre_festival_non_film_events() -> None:
    # March 1 is 53 days before festival start (April 23), outside the 45-day lead window
    assert _is_ancillary_outside_window(
        films_linked=[],
        start_date="2026-03-01",
    )


def test_is_ancillary_outside_window_ignores_in_window_non_film_events() -> None:
    assert not _is_ancillary_outside_window(
        films_linked=[],
        start_date="2026-04-25",
    )


def test_build_series_hint_for_screening_prefers_linked_film_metadata() -> None:
    hint = _build_series_hint_for_screening(
        {
            "name": "POWER BALLAD",
            "films": [
                {
                    "name": "Power Ballad",
                    "description": "Film synopsis",
                    "poster_image": "https://example.com/poster.jpg",
                    "imdb_id": "tt1234567",
                    "details": {"runtime": "98", "year": "2026"},
                    "credits": {"director": "John Carney"},
                }
            ],
        },
        "Screening description",
        "https://example.com/event.jpg",
    )

    assert hint["series_title"] == "Power Ballad"
    assert hint["description"] == "Film synopsis"
    assert hint["image_url"] == "https://example.com/poster.jpg"
    assert hint["runtime_minutes"] == 98
    assert hint["year"] == 2026
    assert hint["director"] == "John Carney"
    assert hint["imdb_id"] == "tt1234567"


def test_build_series_hint_for_screening_falls_back_to_event_copy() -> None:
    description = ("Panel description " * 8).strip()
    hint = _build_series_hint_for_screening(
        {"name": "Practical AI for Independent Filmmakers", "films": []},
        description,
        "https://example.com/panel.jpg",
    )

    assert hint["series_title"] == "Practical AI for Independent Filmmakers"
    assert hint["description"] == description
    assert hint["image_url"] == "https://example.com/panel.jpg"


def test_build_series_hint_for_screening_expands_short_nonfilm_copy() -> None:
    hint = _build_series_hint_for_screening(
        {"name": "Mystery Panel", "films": []},
        "Panel TBA",
        "https://example.com/panel.jpg",
    )

    assert hint["series_title"] == "Mystery Panel"
    assert "Atlanta Film Festival 2026 festival session" in hint["description"]
    assert len(hint["description"]) >= 80


def test_is_blacklisted_title_flags_known_marketing_copy() -> None:
    assert _is_blacklisted_title(
        "Championing discovery, artistic growth, and the arts locally and internationally."
    )


def test_festival_venue_data_marks_festival_place_active() -> None:
    assert FESTIVAL_VENUE_DATA["is_active"] is True


def test_get_or_cache_venue_marks_eventive_venues_active(monkeypatch) -> None:
    captured = {}

    def fake_get_or_create_place(place_data):
        captured.update(place_data)
        return 123

    monkeypatch.setattr("sources.atlanta_film_festival.get_or_create_place", fake_get_or_create_place)
    monkeypatch.setattr("sources.atlanta_film_festival._VENUE_CACHE", {})

    venue_id, auditorium = _get_or_cache_venue(
        {
            "id": "venue-1",
            "name": "Plaza Theatre | LeFont Auditorium",
            "address": "1049 Ponce De Leon Ave NE, Atlanta, GA 30306",
        }
    )

    assert venue_id == 123
    assert auditorium == "LeFont Auditorium"
    assert captured["is_active"] is True
