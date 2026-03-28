"""
Tests for database operations in db.py.
Uses mocked Supabase client to avoid actual database calls.
"""

from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from types import SimpleNamespace


def test_normalize_title_for_natural_key_collapses_matchup_punctuation():
    from db.events import _normalize_title_for_natural_key

    assert (
        _normalize_title_for_natural_key("Atlanta Hawks v. Brooklyn Nets")
        == _normalize_title_for_natural_key("Atlanta Hawks vs. Brooklyn Nets")
    )
    assert (
        _normalize_title_for_natural_key("Atlanta Vibe v Omaha Supernovas")
        == _normalize_title_for_natural_key("Atlanta Vibe vs. Omaha Supernovas")
    )


def test_reject_aggregator_source_url_blocks_editorial_curators():
    from db import _reject_aggregator_source_url

    for url in (
        "https://discoveratlanta.com/events/main/",
        "https://www.nashvillescene.com/calendar/",
        "https://www.artsatl.org/calendar/",
    ):
        try:
            _reject_aggregator_source_url(url)
        except ValueError as exc:
            assert "crawl the original venue source instead" in str(exc)
        else:
            raise AssertionError(f"Expected curator URL to be rejected: {url}")


def test_sanitize_text_strips_html_tags_and_decodes_entities():
    from db import sanitize_text

    cleaned = sanitize_text("<p>Free and <strong>open</strong> to the public.</p>")

    assert cleaned == "Free and open to the public."


def test_sanitize_text_normalizes_entities_and_breaks():
    from db import sanitize_text

    cleaned = sanitize_text("Band &amp; Friends&nbsp;<br> Live")

    assert cleaned == "Band & Friends Live"


def test_sanitize_text_strips_breadcrumb_arrows():
    from db import sanitize_text

    # Navigation breadcrumb pattern: "Home >> Events >> Details"
    cleaned = sanitize_text("Home >> Events >> Details")
    assert ">>" not in cleaned
    assert ">" not in cleaned

    # Inline >> within a description
    cleaned = sanitize_text("Join us >> Click here to register")
    assert ">>" not in cleaned

    # Unescaped &gt;&gt; that survived html.unescape (double-escaped)
    # html.unescape twice will resolve &amp;gt;&amp;gt; -> &gt;&gt; -> >>
    cleaned = sanitize_text("Home &amp;gt;&amp;gt; Events")
    assert ">>" not in cleaned
    assert ">" not in cleaned

    # Runs of more than 2 '>' (malformed HTML artifacts)
    cleaned = sanitize_text("Click here >>> Register")
    assert ">>>" not in cleaned
    assert ">>" not in cleaned

    # Markdown-style blockquote leading '>'
    cleaned = sanitize_text("> This is a quoted line")
    assert cleaned == "This is a quoted line"

    # Normal description without >> should be untouched
    cleaned = sanitize_text("A great show featuring local artists.")
    assert cleaned == "A great show featuring local artists."


def test_normalize_category_maps_programs_to_family():
    from db import normalize_category

    assert normalize_category("programs") == "family"
    assert normalize_category("meetup") == "community"
    assert normalize_category("gaming") == "community"
    assert normalize_category("markets") == "food_drink"
    assert normalize_category("dance") == "dance"
    assert normalize_category("tours") == "learning"


def test_convention_source_hints_capture_unconventional_expo_types():
    from db import get_festival_source_hint

    coin_show = get_festival_source_hint(
        "greater-atlanta-coin-show", "Greater Atlanta Coin Show"
    )
    collect_a_con = get_festival_source_hint(
        "collect-a-con-atlanta-fall", "Collect-A-Con Atlanta (Fall)"
    )
    atlantacon = get_festival_source_hint("atlantacon", "AtlantaCon")
    pen_show = get_festival_source_hint("atlanta-pen-show", "Atlanta Pen Show")
    sewing_expo = get_festival_source_hint(
        "original-sewing-quilt-expo", "Original Sewing & Quilt Expo"
    )
    train_show = get_festival_source_hint(
        "atlanta-toy-model-train-show", "Terminus Chapter Toy and Model Train Show"
    )
    bellpoint = get_festival_source_hint("bellpoint-gem-show", "Bellpoint Gem Show")
    verticon = get_festival_source_hint("verticon", "VERTICON")
    conjuration = get_festival_source_hint("conjuration", "CONjuration")

    assert collect_a_con["festival_type"] == "convention"
    assert atlantacon["festival_type"] == "expo"
    assert pen_show["festival_type"] == "expo"
    assert sewing_expo["festival_type"] == "expo"
    assert coin_show["festival_type"] == "expo"
    assert train_show["festival_type"] == "expo"
    assert bellpoint["festival_type"] == "expo"
    assert verticon["festival_type"] == "conference"
    assert conjuration["festival_type"] == "convention"


@patch(
    "db.sources.get_source_info",
    return_value={"integration_method": "festival_schedule"},
)
def test_validate_event_allows_official_festival_schedule_announcements_far_in_future(
    _mock_get_source_info,
):
    from db import validate_event

    future_date = (datetime.now().date() + timedelta(days=320)).isoformat()

    is_valid, rejection_reason, warnings = validate_event(
        {
            "title": "Southeastern Stamp Expo",
            "start_date": future_date,
            "source_id": 702,
        }
    )

    assert is_valid is True
    assert rejection_reason is None
    assert warnings == ["Missing start_time (not all-day): Southeastern Stamp Expo"]


@patch("db.sources.get_source_info", return_value={"integration_method": "scraper"})
def test_validate_event_keeps_default_future_guard_for_non_festival_schedule_sources(
    _mock_get_source_info,
):
    from db import validate_event

    future_date = (datetime.now().date() + timedelta(days=320)).isoformat()

    is_valid, rejection_reason, _warnings = validate_event(
        {
            "title": "Example Event",
            "start_date": future_date,
            "source_id": 999,
        }
    )

    assert is_valid is False
    assert rejection_reason is not None


def test_get_sibling_venue_ids_prefers_parent_linked_active_family():
    from db import get_sibling_venue_ids

    family_rows = [{"id": 364}, {"id": 104}, {"id": 112}]
    query = MagicMock()
    query.select.return_value = query
    query.or_.return_value = query
    query.eq.return_value = query
    query.execute.return_value = SimpleNamespace(data=family_rows)
    client = MagicMock()
    client.table.return_value = query

    with patch("db.places.get_venue_by_id", return_value={"id": 104, "name": "The Masquerade - Hell", "parent_venue_id": 364}), patch(
        "db.places.get_client", return_value=client
    ):
        assert sorted(get_sibling_venue_ids(104)) == [104, 112, 364]


def test_get_sibling_venue_ids_falls_back_to_active_name_match_for_masquerade_family():
    from db import get_sibling_venue_ids

    family_rows = [{"id": 364}, {"id": 104}, {"id": 112}]
    query = MagicMock()
    query.select.return_value = query
    query.ilike.return_value = query
    query.eq.return_value = query
    query.execute.return_value = SimpleNamespace(data=family_rows)
    client = MagicMock()
    client.table.return_value = query

    with patch("db.places.get_venue_by_id", return_value={"id": 104, "name": "The Masquerade - Hell", "parent_venue_id": None}), patch(
        "db.places.get_client", return_value=client
    ):
        assert sorted(get_sibling_venue_ids(104)) == [104, 112, 364]


def test_db_venues_get_sibling_venue_ids_prefers_parent_linked_active_family():
    from db.places import get_sibling_venue_ids

    family_rows = [{"id": 364}, {"id": 104}, {"id": 112}]
    query = MagicMock()
    query.select.return_value = query
    query.or_.return_value = query
    query.eq.return_value = query
    query.execute.return_value = SimpleNamespace(data=family_rows)
    client = MagicMock()
    client.table.return_value = query

    with patch("db.places.get_venue_by_id", return_value={"id": 104, "name": "The Masquerade - Hell", "parent_venue_id": 364}), patch(
        "db.places.get_client", return_value=client
    ):
        assert sorted(get_sibling_venue_ids(104)) == [104, 112, 364]


@patch("db.events.events_support_is_active_column", return_value=True)
@patch("db.events.get_client")
def test_find_existing_event_by_natural_key_falls_back_when_start_time_changes(
    mock_get_client, _mock_events_active
):
    from db.events import find_existing_event_by_natural_key

    client = MagicMock()
    mock_get_client.return_value = client

    table = MagicMock()
    client.table.return_value = table
    table.select.return_value = table
    table.eq.return_value = table
    table.execute.side_effect = [
        MagicMock(data=[]),
        MagicMock(
            data=[
                {
                    "id": 1047,
                    "title": "Atlanta Hawks v. Dallas Mavericks",
                    "source_id": 11,
                    "venue_id": 126,
                    "start_date": "2026-03-10",
                    "start_time": "20:00:00",
                    "ticket_url": "https://www.ticketmaster.com/event/abc",
                    "source_url": "https://www.ticketmaster.com/event/abc",
                    "is_active": True,
                }
            ]
        ),
    ]

    existing = find_existing_event_by_natural_key(
        {
            "source_id": 11,
            "venue_id": 126,
            "start_date": "2026-03-10",
            "start_time": "19:30:00",
            "title": "Atlanta Hawks vs. Dallas Mavericks",
            "ticket_url": "https://www.ticketmaster.com/event/abc",
            "source_url": "https://www.ticketmaster.com/event/abc",
        }
    )

    assert existing is not None
    assert existing["id"] == 1047


@patch("db.events.events_support_is_active_column", return_value=True)
@patch("db.events.get_client")
def test_find_existing_event_by_natural_key_skips_ambiguous_same_day_url_matches(
    mock_get_client, _mock_events_active
):
    from db.events import find_existing_event_by_natural_key

    client = MagicMock()
    mock_get_client.return_value = client

    table = MagicMock()
    client.table.return_value = table
    table.select.return_value = table
    table.eq.return_value = table
    table.execute.side_effect = [
        MagicMock(data=[]),
        MagicMock(
            data=[
                {
                    "id": 60220,
                    "title": "Harry Potter and the Cursed Child (Touring)",
                    "source_id": 11,
                    "venue_id": 119,
                    "start_date": "2026-03-21",
                    "start_time": "13:00:00",
                    "ticket_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
                    "source_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
                    "is_active": True,
                },
                {
                    "id": 13938,
                    "title": "Harry Potter and the Cursed Child (Touring)",
                    "source_id": 11,
                    "venue_id": 119,
                    "start_date": "2026-03-21",
                    "start_time": "19:00:00",
                    "ticket_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
                    "source_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
                    "is_active": True,
                },
            ]
        ),
    ]

    existing = find_existing_event_by_natural_key(
        {
            "source_id": 11,
            "venue_id": 119,
            "start_date": "2026-03-21",
            "start_time": "15:00:00",
            "title": "Harry Potter and the Cursed Child (Touring)",
            "ticket_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
            "source_url": "https://www.ticketmaster.com/event/Z7r9jZ1A7fEaf",
        }
    )

    assert existing is None


@patch("db.events.events_support_is_active_column", return_value=True)
@patch("db.events.get_client")
def test_find_existing_event_by_natural_key_skips_generic_calendar_for_repeated_shifts(
    mock_get_client, _mock_events_active
):
    from db.events import find_existing_event_by_natural_key

    client = MagicMock()
    mock_get_client.return_value = client

    table = MagicMock()
    client.table.return_value = table
    table.select.return_value = table
    table.eq.return_value = table
    table.execute.side_effect = [
        MagicMock(data=[]),
        MagicMock(
            data=[
                {
                    "id": 118479,
                    "title": "Delivery Driver Volunteer",
                    "source_id": 804,
                    "venue_id": 162,
                    "start_date": "2026-03-10",
                    "start_time": "09:00",
                    "ticket_url": "https://donate.openhandatlanta.org/volunteer_calendar",
                    "source_url": "https://donate.openhandatlanta.org/volunteer_calendar",
                    "is_active": True,
                }
            ]
        ),
    ]

    existing = find_existing_event_by_natural_key(
        {
            "source_id": 804,
            "venue_id": 162,
            "start_date": "2026-03-10",
            "start_time": "10:00",
            "title": "Delivery Driver Volunteer",
            "ticket_url": "https://donate.openhandatlanta.org/volunteer_calendar",
            "source_url": "https://donate.openhandatlanta.org/volunteer_calendar",
        }
    )

    assert existing is None


@patch("db.events.find_existing_event_by_natural_key", return_value=None)
@patch("db.events.find_event_by_hash")
def test_find_existing_event_for_insert_prefers_explicit_content_hash(
    mock_find_event_by_hash, _mock_find_existing_event_by_natural_key
):
    from db.events import find_existing_event_for_insert

    custom_match = {
        "id": 8801,
        "title": "Delivery Driver Volunteer",
        "content_hash": "custom-hash",
    }

    def _lookup(content_hash):
        if content_hash == "custom-hash":
            return custom_match
        if content_hash in {"generic-hash", "legacy-hash"}:
            return None
        raise AssertionError(f"Unexpected hash lookup: {content_hash}")

    mock_find_event_by_hash.side_effect = _lookup

    with patch(
        "dedupe.generate_content_hash_candidates",
        return_value=["generic-hash", "legacy-hash"],
    ):
        existing = find_existing_event_for_insert(
            {
                "title": "Delivery Driver Volunteer",
                "start_date": "2026-03-23",
                "content_hash": "custom-hash",
            }
        )

    assert existing == custom_match
    assert mock_find_event_by_hash.call_args_list[0].args[0] == "custom-hash"


class TestGetOrCreateVenue:
    """Tests for get_or_create_venue function."""

    @patch("db.places.get_client")
    def test_finds_existing_venue_by_slug(self, mock_get_client, sample_venue_data):
        """Should return existing venue ID when slug matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        # Setup mock to return existing venue
        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 42}])

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 42
        client.table.assert_called_with("venues")

    @patch("db.places._maybe_update_existing_venue")
    @patch("db.places.writes_enabled", return_value=True)
    @patch("db.places.get_client")
    def test_reactivates_existing_venue_when_source_marks_it_active(
        self, mock_get_client, _mock_writes_enabled, _mock_update, sample_venue_data
    ):
        """Should reactivate an inactive venue when the crawler explicitly marks it active."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.update.return_value = table
        table.execute.side_effect = [
            MagicMock(data=[{"id": 42, "active": False}]),
            MagicMock(data=[{"id": 42}]),  # reactivate update
            MagicMock(data=[{"id": 42}]),  # verified_at touch
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue({**sample_venue_data, "active": True})

        assert venue_id == 42
        # First update call is reactivation, second is verified_at touch
        update_calls = table.update.call_args_list
        assert any(call.args == ({"active": True},) for call in update_calls)

    @patch("db.places._maybe_update_existing_venue")
    @patch("db.places.get_client")
    def test_finds_existing_venue_by_name(self, mock_get_client, _mock_update, sample_venue_data):
        """Should return existing venue ID when name matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table

        # First call (by slug) returns empty, second call (by name) returns venue
        table.execute.side_effect = [
            MagicMock(data=[]),  # No match by slug
            MagicMock(data=[{"id": 99}]),  # Match by name
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 99

    @patch("db.places._maybe_update_existing_venue")
    @patch("db.places.get_client")
    def test_finds_existing_venue_by_name_alias(self, mock_get_client, _mock_update, sample_venue_data):
        """Should reuse deterministic singular/plural venue aliases before creating a new row."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table

        table.execute.side_effect = [
            MagicMock(data=[]),  # No match by slug
            MagicMock(data=[]),  # No exact match by name
            MagicMock(data=[{"id": 2206}]),  # Alias match by name
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue(
            {
                **sample_venue_data,
                "name": "Gwinnett County Fairground",
                "slug": "gwinnett-county-fairground",
            }
        )

        assert venue_id == 2206

    @patch("db.places.get_client")
    def test_creates_new_venue(self, mock_get_client, sample_venue_data):
        """Should create new venue when no match found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.insert.return_value = table

        # No existing venue found
        table.execute.side_effect = [
            MagicMock(data=[]),  # No match by slug
            MagicMock(data=[]),  # No match by name
            MagicMock(data=[{"id": 123}]),  # Insert returns new ID
        ]

        from db import get_or_create_venue

        venue_id = get_or_create_venue(sample_venue_data)

        assert venue_id == 123
        table.insert.assert_called_once_with(sample_venue_data)

    @patch("db.places.get_client")
    def test_strips_event_only_fields_from_new_venue_payload(
        self, mock_get_client, sample_venue_data
    ):
        """Should not send event-only fields like price_note into venues inserts."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.insert.return_value = table
        table.execute.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[{"id": 123}]),
        ]

        from db import get_or_create_venue

        payload = {
            **sample_venue_data,
            "price_note": "Adults $25",
            "ticket_url": "https://example.com/tickets",
            "start_date": "2026-03-11",
        }

        venue_id = get_or_create_venue(payload)

        assert venue_id == 123
        insert_payload = table.insert.call_args.args[0]
        assert "price_note" not in insert_payload
        assert "ticket_url" not in insert_payload
        assert "start_date" not in insert_payload
        assert insert_payload["name"] == sample_venue_data["name"]

    @patch("db.places.get_client")
    def test_dry_run_skips_new_venue_insert(self, mock_get_client, sample_venue_data):
        """Should return a synthetic ID and skip insert in dry-run mode."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table

        # No existing venue found by slug or name.
        table.execute.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[]),
        ]

        from db import get_or_create_venue, configure_write_mode

        configure_write_mode(False, reason="test dry run")
        try:
            venue_id = get_or_create_venue(sample_venue_data)
        finally:
            configure_write_mode(True)

        assert venue_id < 0
        table.insert.assert_not_called()


class TestInsertEvent:
    """Tests for insert_event function."""

    @patch("db.events.upsert_event_links")
    @patch("db.events.upsert_event_images")
    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=False)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_insert_event_persists_transient_links_and_images(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        _mock_festival_hint,
        mock_upsert_images,
        mock_upsert_links,
        sample_event_data,
    ):
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 321}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["links"] = [
            {"type": "event", "url": "https://example.com/events/spring-festival"},
            {"type": "ticket", "url": "https://tickets.example.com/spring-festival"},
        ]
        event_data["images"] = [
            {"url": "https://example.com/images/spring-festival.jpg", "is_primary": True}
        ]

        event_id = insert_event(event_data)

        assert event_id == 321
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "links" not in inserted_data
        assert "images" not in inserted_data
        mock_upsert_links.assert_called_once_with(
            321,
            [
                {"type": "event", "url": "https://example.com/events/spring-festival"},
                {"type": "ticket", "url": "https://tickets.example.com/spring-festival"},
            ],
        )
        mock_upsert_images.assert_called_once_with(
            321,
            [
                {"url": "https://example.com/images/spring-festival.jpg", "is_primary": True}
            ],
        )

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=False)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_sets_event_row_active_true_when_column_supported(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        _mock_festival_hint,
        sample_event_data,
    ):
        """Should default inserted events to active when row-level flag exists."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": ["intimate"]}
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 321}])

        from db import insert_event

        event_id = insert_event(sample_event_data)

        assert event_id == 321
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["is_active"] is True

    @patch("db.events.upsert_event_links")
    @patch("db.events.upsert_event_images")
    @patch("db.events.smart_update_existing_event")
    @patch("db.events.find_existing_event_for_insert")
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=False)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_insert_event_recovers_timed_duplicate_conflict_as_update(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_source_info,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        _mock_festival_hint,
        _mock_find_cross_source,
        mock_find_existing,
        mock_smart_update,
        mock_upsert_images,
        mock_upsert_links,
        sample_event_data,
    ):
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        existing = {"id": 987, "title": sample_event_data["title"], "source_id": sample_event_data["source_id"]}
        mock_find_existing.side_effect = [
            None,
            existing,
        ]

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.side_effect = Exception(
            'duplicate key value violates unique constraint "idx_events_unique_source_venue_slot_norm_title_timed"'
        )

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["links"] = [{"type": "event", "url": "https://example.com/event"}]
        event_data["images"] = [{"url": "https://example.com/image.jpg"}]

        event_id = insert_event(event_data)

        assert event_id == 987
        mock_smart_update.assert_called_once()
        mock_upsert_images.assert_called_once_with(987, [{"url": "https://example.com/image.jpg"}])
        mock_upsert_links.assert_called_once_with(987, [{"type": "event", "url": "https://example.com/event"}])

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=False)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_insert_event_skips_title_participant_inference_when_suppressed(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        _mock_festival_hint,
        mock_parse_lineup,
        mock_upsert_artists,
        sample_event_data,
    ):
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {
            "slug": "venue-specials-scraper",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 654}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data.update(
            {
                "title": "Bottomless Brunch",
                "category": "nightlife",
                "_suppress_title_participants": True,
            }
        )

        event_id = insert_event(event_data)

        assert event_id == 654
        mock_parse_lineup.assert_not_called()
        mock_upsert_artists.assert_not_called()

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=False)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch(
        "db.events.get_venue_by_id_cached",
        return_value={
            "id": 123,
            "name": "Churchill Grounds",
            "slug": "churchill-grounds",
            "active": False,
            "vibes": [],
            "venue_type": "cafe",
            "state": "GA",
        },
    )
    @patch("db.events.get_client")
    def test_sets_event_row_inactive_when_venue_is_closed_or_inactive(
        self,
        mock_get_client,
        _mock_get_venue,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        _mock_festival_hint,
        sample_event_data,
    ):
        """Should keep new rows hidden when ingesting events at inactive/closed venues."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 322}])

        from db import insert_event

        event_id = insert_event(sample_event_data)

        assert event_id == 322
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["is_active"] is False

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.events_support_field_metadata_columns", return_value=True)
    @patch("db.events.events_support_content_kind_column", return_value=True)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_inserts_event_with_tags(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        _mock_events_active,
        _mock_content_kind,
        _mock_field_cols,
        mock_festival_hint,
        sample_event_data,
    ):
        """Should insert event and infer tags."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": ["intimate"]}
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 456}])

        from db import insert_event

        event_id = insert_event(sample_event_data)

        assert event_id == 456
        client.table.assert_any_call("events")
        table.insert.assert_called()

        # Verify tags were added to event data (first insert call is the event)
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "tags" in inserted_data
        assert "field_confidence" in inserted_data
        assert "capabilities" in inserted_data["field_confidence"]
        assert inserted_data["field_confidence"]["capabilities"]["quality_score"] >= 0

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_inherits_venue_vibes(
        self, mock_get_client, mock_get_venue, mock_get_source_info,
        _mock_find_existing, _mock_find_cross_source, mock_festival_hint,
        sample_event_data
    ):
        """Should inherit vibes from venue when inferring tags."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": ["intimate", "all-ages"]}
        mock_get_source_info.return_value = {
            "slug": "test-source",
            "url": "https://example.com/source",
            "source_type": "organization",
        }

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 789}])

        from db import insert_event

        insert_event(sample_event_data)

        # Verify tags include inherited vibes (first insert call is the event)
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "intimate" in inserted_data["tags"]
        assert "all-ages" in inserted_data["tags"]

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_normalizes_activism_category_to_community_with_genre(
        self, mock_get_client, mock_get_venue, mock_get_source_info,
        _mock_find_existing, _mock_find_cross_source, mock_festival_hint,
        sample_event_data
    ):
        """Should map activism category to community and preserve activism as a genre signal."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 999}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "activism"
        event_data["tags"] = ["activism"]
        event_data["title"] = "Community Organizing Rally"

        insert_event(event_data)

        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["category_id"] == "civic"
        assert "activism" in (inserted_data.get("genres") or [])

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_defaults_invalid_category_to_other(
        self, mock_get_client, mock_get_venue, mock_get_source_info,
        _mock_find_existing, _mock_find_cross_source, mock_festival_hint,
        sample_event_data
    ):
        """Should default invalid categories to 'other' instead of rejecting the event."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 888}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "invalid_garbage_category"
        event_data["title"] = "Some Event"

        event_id = insert_event(event_data)

        # Event should be inserted, not rejected
        assert event_id == 888

        # Category should be defaulted to "other"
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["category_id"] == "other"

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.events_support_film_identity_columns", return_value=True)
    @patch("db.events.get_metadata_for_film_event")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_stores_film_identity_without_overwriting_event_title(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_film_metadata,
        mock_film_cols,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        mock_festival_hint,
        sample_event_data,
    ):
        """Film identity should be stored in dedicated fields while title stays venue-provided."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}
        mock_get_film_metadata.return_value = SimpleNamespace(
            title="The NeverEnding Story",
            poster_url="https://example.com/poster.jpg",
            director="Wolfgang Petersen",
            runtime_minutes=94,
            year=1984,
            rating="PG",
            imdb_id="tt0088323",
            genres=["adventure", "family"],
            plot="A young boy discovers a magical world through a mysterious book.",
        )

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 901}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "film"
        event_data["title"] = "The NeverEnding Story (40th Anniversary Screening)"
        event_data["tags"] = ["showtime"]

        event_id = insert_event(event_data)

        assert event_id == 901
        inserted_data = table.insert.call_args_list[0][0][0]
        assert (
            inserted_data["title"]
            == "The NeverEnding Story (40th Anniversary Screening)"
        )
        assert inserted_data["film_title"] == "The NeverEnding Story"
        assert inserted_data["film_release_year"] == 1984
        assert inserted_data["film_imdb_id"] == "tt0088323"
        assert inserted_data["film_identity_source"] == "omdb"
        assert inserted_data["film_external_genres"] == ["adventure", "family"]

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.events_support_film_identity_columns", return_value=True)
    @patch("db.events.get_metadata_for_film_event")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_uses_wikidata_source_for_film_identity_when_omdb_misses(
        self,
        mock_get_client,
        mock_get_venue,
        mock_get_film_metadata,
        mock_film_cols,
        mock_get_source_info,
        _mock_find_existing,
        _mock_find_cross_source,
        mock_festival_hint,
        sample_event_data,
    ):
        """Film identity source should reflect Wikidata fallback when it provides metadata."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}
        mock_get_film_metadata.return_value = SimpleNamespace(
            title="Fight Club",
            poster_url=None,
            director="David Fincher",
            runtime_minutes=139,
            year=1999,
            rating=None,
            imdb_id="tt0137523",
            genres=["drama"],
            plot=None,
            source="wikidata",
        )

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 902}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "film"
        event_data["title"] = "Fight Club (1999)"

        event_id = insert_event(event_data)

        assert event_id == 902
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["title"] == "Fight Club (1999)"
        assert inserted_data["film_title"] == "Fight Club"
        assert inserted_data["film_identity_source"] == "wikidata"

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_uses_source_url_as_ticket_url_for_film_showtimes(
        self, mock_get_client, mock_get_venue, mock_get_source_info,
        _mock_find_existing, _mock_find_cross_source, mock_festival_hint,
        sample_event_data
    ):
        """Film/showtime records should expose a ticket_url even when crawlers only provide source_url."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 903}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["category"] = "film"
        event_data["tags"] = ["showtime"]
        event_data["ticket_url"] = None
        event_data["source_url"] = "https://example.com/showtimes?date=2026-02-20"

        event_id = insert_event(event_data)

        assert event_id == 903
        inserted_data = table.insert.call_args_list[0][0][0]
        assert inserted_data["ticket_url"] == event_data["source_url"]

    @patch("db.events.get_festival_source_hint", return_value=None)
    @patch("db.events.find_cross_source_canonical_for_insert", return_value=None)
    @patch("db.events.find_existing_event_for_insert", return_value=None)
    @patch("db.events.get_source_info")
    @patch("db.events.get_venue_by_id_cached")
    @patch("db.events.get_client")
    def test_strips_deprecated_subcategory_fields_before_insert(
        self, mock_get_client, mock_get_venue, mock_get_source_info,
        _mock_find_existing, _mock_find_cross_source, mock_festival_hint,
        sample_event_data
    ):
        """Deprecated subcategory fields should never be persisted to events."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_venue.return_value = {"vibes": []}
        mock_get_source_info.return_value = {"slug": "test-source", "url": "https://example.com", "source_type": "organization"}

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 904}])

        from db import insert_event

        event_data = dict(sample_event_data)
        event_data["subcategory"] = "concert"
        event_data["subcategory_id"] = "legacy-concert"

        event_id = insert_event(event_data)

        assert event_id == 904
        inserted_data = table.insert.call_args_list[0][0][0]
        assert "subcategory" not in inserted_data
        assert "subcategory_id" not in inserted_data


class TestFindEventByHash:
    """Tests for find_event_by_hash function."""

    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.get_client")
    def test_prefers_active_row_when_hash_has_multiple_matches(
        self, mock_get_client, _mock_events_active
    ):
        """Should choose active row when duplicate hash rows include inactive candidates."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(
            data=[
                {"id": 10, "content_hash": "abc", "is_active": False},
                {"id": 11, "content_hash": "abc", "is_active": True},
            ]
        )

        from db import find_event_by_hash

        result = find_event_by_hash("abc")

        assert result is not None
        assert result["id"] == 11

    @patch("db.events.get_client")
    def test_finds_existing_event(self, mock_get_client):
        """Should return event when hash matches."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(
            data=[{"id": 1, "title": "Test Event", "content_hash": "abc123"}]
        )

        from db import find_event_by_hash

        result = find_event_by_hash("abc123")

        assert result is not None
        assert result["id"] == 1
        assert result["title"] == "Test Event"

    @patch("db.events.get_client")
    def test_returns_none_when_not_found(self, mock_get_client):
        """Should return None when no match found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import find_event_by_hash

        result = find_event_by_hash("nonexistent")

        assert result is None


class TestFindEventsByDateAndVenue:
    """Tests for find_events_by_date_and_venue function."""

    @patch("db.events.get_client")
    def test_finds_events(self, mock_get_client):
        """Should return events matching date and venue."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(
            data=[
                {"id": 1, "title": "Event 1"},
                {"id": 2, "title": "Event 2"},
            ]
        )

        from db import find_events_by_date_and_venue

        results = find_events_by_date_and_venue("2026-01-15", 42)

        assert len(results) == 2
        assert results[0]["title"] == "Event 1"

    @patch("db.events.get_client")
    def test_returns_empty_list(self, mock_get_client):
        """Should return empty list when no events found."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=None)

        from db import find_events_by_date_and_venue

        results = find_events_by_date_and_venue("2026-01-15", 999)

        assert results == []


class TestSmartUpdateExistingEvent:
    """Tests for smart_update_existing_event function."""

    @patch("db.events.get_source_info")
    @patch("db.events.get_client")
    def test_backfills_portal_from_source_owner(
        self, mock_get_client, mock_get_source_info
    ):
        """Should fill missing portal_id from source owner on smart update."""
        client = MagicMock()
        mock_get_client.return_value = client
        mock_get_source_info.return_value = {"owner_portal_id": "portal-123"}

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Existing Event",
            "description": "Existing",
            "portal_id": None,
        }
        incoming = {
            "source_id": 99,
            "description": "Existing description with a bit more detail",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["portal_id"] == "portal-123"

    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.get_client")
    def test_keeps_existing_portal_unchanged(
        self, mock_get_client, _mock_get_source_info
    ):
        """Should not overwrite existing portal_id when already set."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Existing Event",
            "description": "Detailed description",
            "portal_id": "portal-existing",
        }
        incoming = {"source_id": 99}

        updated = smart_update_existing_event(existing, incoming)
        assert updated is False
        table.update.assert_not_called()

    @patch("db.events.get_client")
    def test_replaces_bad_existing_image_when_incoming_is_better(self, mock_get_client):
        """Should upgrade logo/placeholder images when a better event image arrives."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Existing Event",
            "description": "Detailed description",
            "portal_id": "portal-existing",
            "image_url": "https://example.com/assets/logo.png",
        }
        incoming = {
            "image_url": "https://images.example.com/events/headliner-1200x675.jpg",
        }

        updated = smart_update_existing_event(existing, incoming)
        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["image_url"] == incoming["image_url"]

    @patch("db.events.get_client")
    def test_does_not_accept_bad_incoming_image_when_missing(self, mock_get_client):
        """Should ignore incoming logo/placeholder URLs even if event image is missing."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Existing Event",
            "description": "Detailed description",
            "portal_id": "portal-existing",
            "image_url": None,
        }
        incoming = {
            "image_url": "https://example.com/assets/default-placeholder.png",
        }

        updated = smart_update_existing_event(existing, incoming)
        assert updated is False
        table.update.assert_not_called()

    @patch("db.events.get_client")
    def test_promotes_listing_urls_to_specific_event_urls(self, mock_get_client):
        """Should replace generic listing URLs with event-specific links on smart update."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "The King of Possibilities Tour",
            "source_url": "https://www.masqueradeatlanta.com/events/",
            "ticket_url": "https://www.masqueradeatlanta.com/events/",
        }
        incoming = {
            "source_url": "https://www.masqueradeatlanta.com/events/goldie-boutilier/",
            "ticket_url": "https://www.masqueradeatlanta.com/events/goldie-boutilier/",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert (
            updates["source_url"]
            == "https://www.masqueradeatlanta.com/events/goldie-boutilier/"
        )
        assert (
            updates["ticket_url"]
            == "https://www.masqueradeatlanta.com/events/goldie-boutilier/"
        )

    @patch("db.events.get_client")
    def test_replaces_truncated_existing_description_with_shorter_clean_copy(self, mock_get_client):
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Afterhour Experience",
            "description": (
                "Purgatory at The Masquerade TheARTI$T creates music without borders. "
                "After graduating high school, TheARTI$T attended Essex County College "
                "to study music production and performance, where the sound kept expanding…"
            ),
        }
        incoming = {
            "description": (
                "The Masquerade presents TheARTI$T with support from special guests. "
                "Doors open at 7:00 PM."
            ),
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["description"] == incoming["description"]

    @patch("db.events.get_client")
    def test_does_not_downgrade_specific_urls_to_listing(self, mock_get_client):
        """Should not overwrite specific URLs when incoming data regresses to listing pages."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Specific Event",
            "source_url": "https://www.masqueradeatlanta.com/events/specific-event/",
            "ticket_url": "https://www.ticketmaster.com/specific-event",
        }
        incoming = {
            "source_url": "https://www.masqueradeatlanta.com/events/",
            "ticket_url": "https://www.masqueradeatlanta.com/events/",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is False
        table.update.assert_not_called()

    @patch("db.events.get_client")
    def test_promotes_explicit_ticketing_url_over_detail_page_ticket_url(self, mock_get_client):
        """Should replace a detail-page ticket_url with an explicit external ticket link."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1}])

        from db import smart_update_existing_event

        existing = {
            "id": 1,
            "title": "Specific Event",
            "source_url": "https://www.masqueradeatlanta.com/events/specific-event/",
            "ticket_url": "https://www.masqueradeatlanta.com/events/specific-event/",
        }
        incoming = {
            "source_url": "https://www.masqueradeatlanta.com/events/specific-event/",
            "ticket_url": "https://www.ticketmaster.com/event/0E00636796DF7AD4",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["ticket_url"] == "https://www.ticketmaster.com/event/0E00636796DF7AD4"
        assert "source_url" not in updates

    @patch("db.events.get_source_info", return_value=None)
    @patch(
        "db.events.get_venue_by_id_cached", return_value={"active": True, "slug": "open-venue"}
    )
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.get_client")
    def test_reactivates_inactive_event_when_seen_again(
        self,
        mock_get_client,
        _mock_get_venue,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
    ):
        """Should reactivate an inactive row when the crawler observes it again."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 42}])

        from db import smart_update_existing_event

        existing = {
            "id": 42,
            "title": "Test Concert",
            "source_id": 1,
            "category_id": "other",
            "is_active": False,
        }
        incoming = {"title": "Test Concert", "category": "other"}

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["is_active"] is True

    @patch("db.events.get_source_info", return_value=None)
    @patch(
        "db.events.get_venue_by_id_cached",
        return_value={"active": False, "slug": "churchill-grounds"},
    )
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.get_client")
    @patch("genre_normalize.normalize_genres", return_value=[])
    @patch("tag_inference.infer_genres", return_value=[])
    def test_does_not_reactivate_event_on_inactive_or_closed_venue(
        self,
        _mock_infer_genres,
        _mock_normalize_genres,
        mock_get_client,
        _mock_get_venue,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
    ):
        """Should keep inactive rows hidden when their venue is inactive/closed."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 43}])

        from db import smart_update_existing_event

        existing = {
            "id": 43,
            "title": "Jazz Night",
            "source_id": 1,
            "category_id": "music",
            "is_active": False,
            "venue_id": 321,
        }
        incoming = {"title": "Jazz Night", "category": "music", "venue_id": 321}

        updated = smart_update_existing_event(existing, incoming)

        assert updated is False
        table.update.assert_not_called()

    @patch("db.events.get_source_info")
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=True)
    @patch("db.events.get_client")
    @patch("genre_normalize.normalize_genres", return_value=[])
    @patch("tag_inference.infer_genres", return_value=[])
    def test_prefers_official_source_over_aggregator_on_exact_match(
        self,
        _mock_infer_genres,
        _mock_normalize_genres,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        mock_get_source_info,
    ):
        """Should transfer ownership from aggregator rows to a stronger official source."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 44}])

        mock_get_source_info.side_effect = lambda source_id: {
            11: {"id": 11, "slug": "ticketmaster", "is_active": True},
            1261: {
                "id": 1261,
                "slug": "georgia-swarm",
                "is_active": True,
                "owner_portal_id": "portal-123",
            },
        }.get(source_id)

        from db import smart_update_existing_event

        existing = {
            "id": 44,
            "title": "Georgia Swarm vs Vancouver Warriors",
            "source_id": 11,
            "category_id": "sports",
            "is_active": True,
        }
        incoming = {
            "title": "Georgia Swarm vs Vancouver Warriors",
            "category": "sports",
            "source_id": 1261,
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["source_id"] == 1261
        assert updates["portal_id"] == "portal-123"

    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    @patch("genre_normalize.normalize_genres", return_value=[])
    @patch("tag_inference.infer_genres", return_value=[])
    def test_updates_start_time_when_same_source_event_time_is_corrected(
        self,
        _mock_infer_genres,
        _mock_normalize_genres,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
    ):
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 1047}])

        from db import smart_update_existing_event

        existing = {
            "id": 1047,
            "title": "Atlanta Hawks v. Dallas Mavericks",
            "source_id": 11,
            "venue_id": 126,
            "start_date": "2026-03-10",
            "start_time": "20:00:00",
            "ticket_url": "https://www.ticketmaster.com/event/abc",
            "source_url": "https://www.ticketmaster.com/event/abc",
            "category_id": "sports",
        }
        incoming = {
            "title": "Atlanta Hawks vs. Dallas Mavericks",
            "source_id": 11,
            "venue_id": 126,
            "start_date": "2026-03-10",
            "start_time": "19:30:00",
            "ticket_url": "https://www.ticketmaster.com/event/abc",
            "source_url": "https://www.ticketmaster.com/event/abc",
            "category": "sports",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        # use call_args_list[0] to get the smart-update dict specifically;
        # _maybe_infer_importance may add a second update call for importance.
        updates = table.update.call_args_list[0][0][0]
        assert updates["start_time"] == "19:30:00"

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    def test_backfills_artists_when_incoming_uses_category_id(
        self,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
        mock_parse_lineup,
        mock_upsert_artists,
    ):
        """Should trigger artist backfill when incoming category is category_id-only."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute.return_value = MagicMock(data=[])

        mock_parse_lineup.return_value = [
            {
                "name": "Mumford & Sons",
                "role": "headliner",
                "billing_order": 1,
                "is_headliner": True,
            }
        ]

        from db import smart_update_existing_event

        existing = {
            "id": 99,
            "title": "Mumford & Sons",
            "category_id": "community",
        }
        incoming = {
            "title": "Mumford & Sons",
            "category_id": "music",
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is True
        updates = table.update.call_args[0][0]
        assert updates["category_id"] == "music"
        mock_parse_lineup.assert_called_once_with("Mumford & Sons")
        mock_upsert_artists.assert_called_once()

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    def test_prefers_incoming_parsed_artists_for_backfill(
        self,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
        mock_parse_lineup,
        mock_upsert_artists,
    ):
        """Should use incoming _parsed_artists and skip title parsing when provided."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute.return_value = MagicMock(data=[])

        incoming_artists = [
            {
                "name": "Florence + The Machine",
                "role": "headliner",
                "billing_order": 1,
                "is_headliner": True,
            }
        ]

        from db import smart_update_existing_event

        existing = {
            "id": 123,
            "title": "Florence + The Machine",
            "category_id": "music",
        }
        incoming = {
            "title": "Florence + The Machine",
            "category_id": "music",
            "_parsed_artists": incoming_artists,
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is False
        mock_parse_lineup.assert_not_called()
        mock_upsert_artists.assert_called_once_with(123, incoming_artists)

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    def test_suppressed_title_participants_skip_backfill_on_update(
        self,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
        mock_parse_lineup,
        mock_upsert_artists,
    ):
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import smart_update_existing_event

        existing = {
            "id": 123,
            "title": "Bottomless Brunch",
            "category_id": "nightlife",
        }
        incoming = {
            "title": "Bottomless Brunch",
            "category_id": "nightlife",
            "_suppress_title_participants": True,
        }

        smart_update_existing_event(existing, incoming)

        mock_parse_lineup.assert_not_called()
        mock_upsert_artists.assert_not_called()

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    def test_replaces_placeholder_artist_with_incoming_parsed_artist(
        self,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
        mock_parse_lineup,
        mock_upsert_artists,
    ):
        """Should replace title-equals-artist placeholder rows with better parsed incoming artists."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute.return_value = MagicMock(
            data=[{"id": 10, "name": "The King of Possibilities Tour"}]
        )

        from db import smart_update_existing_event

        incoming_artists = [
            {
                "name": "Goldie Boutilier",
                "role": "headliner",
                "billing_order": 1,
                "is_headliner": True,
            }
        ]
        existing = {
            "id": 9001,
            "title": "The King of Possibilities Tour",
            "category_id": "music",
        }
        incoming = {
            "title": "The King of Possibilities Tour",
            "category_id": "music",
            "_parsed_artists": incoming_artists,
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is False
        mock_parse_lineup.assert_not_called()
        mock_upsert_artists.assert_called_once_with(9001, incoming_artists)

    @patch("db.events.upsert_event_artists")
    @patch("db.events.parse_lineup_from_title")
    @patch("db.events.get_source_info", return_value=None)
    @patch("db.events.events_support_content_kind_column", return_value=False)
    @patch("db.events.events_support_is_active_column", return_value=False)
    @patch("db.events.get_client")
    def test_backfills_sports_participants_from_incoming_parsed_artists(
        self,
        mock_get_client,
        _mock_events_active,
        _mock_content_kind,
        _mock_get_source_info,
        mock_parse_lineup,
        mock_upsert_artists,
    ):
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.order.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import smart_update_existing_event

        incoming_artists = [
            {"name": "Atlanta Dream", "role": "team", "billing_order": 1},
            {"name": "Las Vegas Aces", "role": "team", "billing_order": 2},
        ]
        existing = {
            "id": 9002,
            "title": "Atlanta Dream vs Las Vegas Aces",
            "category_id": "sports",
        }
        incoming = {
            "title": "Atlanta Dream vs Las Vegas Aces",
            "category_id": "sports",
            "_parsed_artists": incoming_artists,
        }

        updated = smart_update_existing_event(existing, incoming)

        assert updated is False
        mock_parse_lineup.assert_not_called()
        mock_upsert_artists.assert_called_once_with(9002, incoming_artists)


class TestCrawlLog:
    """Tests for crawl log functions."""

    @patch("db.sources.get_client")
    def test_create_crawl_log(self, mock_get_client):
        """Should create a crawl log entry."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock(data=[{"id": 100}])

        from db import create_crawl_log

        log_id = create_crawl_log(source_id=1)

        assert log_id == 100
        client.table.assert_called_with("crawl_logs")

        # Verify log data
        insert_data = table.insert.call_args[0][0]
        assert insert_data["source_id"] == 1
        assert insert_data["status"] == "running"
        assert "started_at" in insert_data

    @patch("db.sources.get_client")
    def test_create_crawl_log_dry_run_skips_insert(self, mock_get_client):
        """Should return synthetic ID and avoid DB writes in dry-run mode."""
        from db import create_crawl_log, configure_write_mode

        configure_write_mode(False, reason="test dry run")
        try:
            log_id = create_crawl_log(source_id=1)
        finally:
            configure_write_mode(True)

        assert log_id < 0
        mock_get_client.assert_not_called()

    @patch("db.sources.get_client")
    def test_update_crawl_log(self, mock_get_client):
        """Should update crawl log with results."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import update_crawl_log

        update_crawl_log(
            log_id=100,
            status="completed",
            events_found=10,
            events_new=5,
            events_updated=3,
        )

        client.table.assert_called_with("crawl_logs")
        table.update.assert_called_once()

        update_data = table.update.call_args[0][0]
        assert update_data["status"] == "completed"
        assert update_data["events_found"] == 10
        assert update_data["events_new"] == 5
        assert update_data["events_updated"] == 3
        assert "completed_at" in update_data

    @patch("db.sources.get_client")
    def test_update_crawl_log_with_error(self, mock_get_client):
        """Should include error message when provided."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.update.return_value = table
        table.eq.return_value = table
        table.execute.return_value = MagicMock(data=[])

        from db import update_crawl_log

        update_crawl_log(
            log_id=100, status="failed", error_message="Connection timeout"
        )

        update_data = table.update.call_args[0][0]
        assert update_data["status"] == "failed"
        assert update_data["error_message"] == "Connection timeout"


class TestCrossSourceCanonicalSelection:
    """Tests for cross-source canonical ranking."""

    def test_source_priority_penalizes_inactive_sources(self):
        """Inactive sources should always rank lower than active peers."""
        from db import _source_priority_for_dedupe

        active = _source_priority_for_dedupe("blakes-on-park", True)
        inactive = _source_priority_for_dedupe("blakes-on-park", False)

        assert active < inactive

    @patch("db.events.get_source_info")
    @patch("db.events.get_client")
    def test_prefers_active_source_for_cross_source_canonical(
        self, mock_get_client, mock_get_source_info
    ):
        """Canonical selector should prefer active source rows over inactive rows."""
        client = MagicMock()
        mock_get_client.return_value = client

        table = MagicMock()
        client.table.return_value = table
        table.select.return_value = table
        table.eq.return_value = table
        table.neq.return_value = table
        table.is_.return_value = table
        table.execute.return_value = MagicMock(
            data=[
                {
                    "id": 901,
                    "title": "Bocce League at The Painted Duck",
                    "source_id": 1001,
                    "canonical_event_id": None,
                    "created_at": "2026-02-17T10:00:00+00:00",
                    "description": "Long detailed description",
                    "image_url": "https://example.com/img.jpg",
                    "ticket_url": "https://example.com/tickets",
                },
                {
                    "id": 902,
                    "title": "Bocce League at The Painted Duck",
                    "source_id": 1002,
                    "canonical_event_id": None,
                    "created_at": "2026-02-17T09:00:00+00:00",
                    "description": "Long detailed description",
                    "image_url": "https://example.com/img.jpg",
                    "ticket_url": "https://example.com/tickets",
                },
            ]
        )

        def source_lookup(source_id):
            if source_id == 1001:
                return {"slug": "blakes-on-the-park", "is_active": False}
            if source_id == 1002:
                return {"slug": "blakes-on-park", "is_active": True}
            return None

        mock_get_source_info.side_effect = source_lookup

        from db import find_cross_source_canonical_for_insert

        canonical_id = find_cross_source_canonical_for_insert(
            {
                "source_id": 2000,
                "venue_id": 333,
                "start_date": "2026-02-18",
                "start_time": "19:00",
                "title": "Bocce League at The Painted Duck",
            }
        )

        assert canonical_id == 902
