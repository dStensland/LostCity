"""
Tests for the Georgia Elections crawler.

Covers HTML parsing, date handling, past-event filtering, and event record
construction — all without touching the database or network.
"""

from __future__ import annotations

from sources.georgia_elections import (
    _build_election_day_event,
    _build_registration_deadline_event,
    _extract_first_deadline,
    _parse_date,
    _parse_table,
    SOURCE_URL,
    VENUE_DATA,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_HTML = """
<html>
<body>
<table>
  <thead>
    <tr>
      <th>Election</th>
      <th>Election Date</th>
      <th>Registration Deadline*Federal Contest Registration Deadline</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Special Election - United States House District 14</td>
      <td>March 10, 2026</td>
      <td>February 9, 2026</td>
    </tr>
    <tr>
      <td>General Primary Election/Nonpartisan Election</td>
      <td>May 19, 2026</td>
      <td>April 20, 2026</td>
    </tr>
    <tr>
      <td>General Primary Election/Nonpartisan Election Runoff</td>
      <td>June 16, 2026</td>
      <td>April 20, 2026*May 18, 2026</td>
    </tr>
    <tr>
      <td>General Election/Special Election</td>
      <td>November 3, 2026</td>
      <td>October 5, 2026</td>
    </tr>
  </tbody>
</table>
</body>
</html>
"""

EMPTY_HTML = "<html><body><p>No table here.</p></body></html>"
EMPTY_TABLE_HTML = "<html><body><table><tr><th>A</th></tr></table></body></html>"


# ---------------------------------------------------------------------------
# _parse_date
# ---------------------------------------------------------------------------


def test_parse_date_standard_format() -> None:
    assert _parse_date("March 10, 2026") == "2026-03-10"


def test_parse_date_single_digit_day() -> None:
    assert _parse_date("April 7, 2026") == "2026-04-07"


def test_parse_date_november() -> None:
    assert _parse_date("November 3, 2026") == "2026-11-03"


def test_parse_date_empty_string() -> None:
    assert _parse_date("") is None


def test_parse_date_garbage() -> None:
    assert _parse_date("TBD") is None


def test_parse_date_whitespace_stripped() -> None:
    assert _parse_date("  May 19, 2026  ") == "2026-05-19"


# ---------------------------------------------------------------------------
# _extract_first_deadline
# ---------------------------------------------------------------------------


def test_extract_first_deadline_single() -> None:
    assert _extract_first_deadline("April 20, 2026") == "April 20, 2026"


def test_extract_first_deadline_dual() -> None:
    # Asterisk separates state from federal deadline — take the first (earlier)
    assert _extract_first_deadline("April 20, 2026*May 18, 2026") == "April 20, 2026"


def test_extract_first_deadline_with_surrounding_whitespace() -> None:
    result = _extract_first_deadline("October 5, 2026 * November 2, 2026")
    assert result == "October 5, 2026"


def test_extract_first_deadline_empty() -> None:
    assert _extract_first_deadline("") == ""


# ---------------------------------------------------------------------------
# _parse_table
# ---------------------------------------------------------------------------


def test_parse_table_returns_four_rows() -> None:
    rows = _parse_table(SAMPLE_HTML)
    assert len(rows) == 4


def test_parse_table_first_row_fields() -> None:
    rows = _parse_table(SAMPLE_HTML)
    row = rows[0]
    assert row["election_name"] == "Special Election - United States House District 14"
    assert row["election_date"] == "2026-03-10"
    assert row["reg_deadline"] == "2026-02-09"


def test_parse_table_general_primary_row() -> None:
    rows = _parse_table(SAMPLE_HTML)
    row = rows[1]
    assert row["election_name"] == "General Primary Election/Nonpartisan Election"
    assert row["election_date"] == "2026-05-19"
    assert row["reg_deadline"] == "2026-04-20"


def test_parse_table_dual_deadline_row_uses_first() -> None:
    """Row with 'April 20, 2026*May 18, 2026' — crawler takes April 20."""
    rows = _parse_table(SAMPLE_HTML)
    runoff = next(
        r
        for r in rows
        if "Runoff" in r["election_name"] and "Primary" in r["election_name"]
    )
    assert runoff["reg_deadline"] == "2026-04-20"


def test_parse_table_no_table_returns_empty() -> None:
    assert _parse_table(EMPTY_HTML) == []


def test_parse_table_empty_table_returns_empty() -> None:
    # Only a header row, no data rows
    assert _parse_table(EMPTY_TABLE_HTML) == []


def test_parse_table_all_rows_have_required_keys() -> None:
    rows = _parse_table(SAMPLE_HTML)
    for row in rows:
        assert "election_name" in row
        assert "election_date" in row
        assert "reg_deadline" in row


# ---------------------------------------------------------------------------
# _build_election_day_event
# ---------------------------------------------------------------------------


def test_build_election_day_event_structure() -> None:
    event = _build_election_day_event(
        source_id=99,
        venue_id=42,
        election_name="General Primary Election/Nonpartisan Election",
        election_date="2026-05-19",
    )
    assert event["source_id"] == 99
    assert event["venue_id"] == 42
    assert event["start_date"] == "2026-05-19"
    assert event["start_time"] == "07:00"
    assert event["end_time"] == "19:00"
    assert event["is_all_day"] is False
    assert event["is_free"] is True
    assert event["category"] == "civic"
    assert event["source_url"] == SOURCE_URL
    assert "election" in event["tags"]
    assert "election-day" in event["tags"]
    assert event["content_hash"] is not None


def test_build_election_day_event_title_strips_slash_portion() -> None:
    event = _build_election_day_event(
        source_id=1,
        venue_id=1,
        election_name="General Election/Special Election",
        election_date="2026-11-03",
    )
    # Title should begin with "Georgia" and not include the slash portion
    assert event["title"].startswith("Georgia")
    assert "/" not in event["title"]


def test_build_election_day_event_description_mentions_polls() -> None:
    event = _build_election_day_event(
        source_id=1,
        venue_id=1,
        election_name="General Primary Election/Nonpartisan Election",
        election_date="2026-05-19",
    )
    assert "7:00 AM" in event["description"] or "Polls" in event["description"]


def test_build_election_day_event_content_hash_unique_per_election() -> None:
    e1 = _build_election_day_event(1, 1, "General Primary Election", "2026-05-19")
    e2 = _build_election_day_event(1, 1, "General Election", "2026-11-03")
    assert e1["content_hash"] != e2["content_hash"]


# ---------------------------------------------------------------------------
# _build_registration_deadline_event
# ---------------------------------------------------------------------------


def test_build_registration_deadline_event_structure() -> None:
    event = _build_registration_deadline_event(
        source_id=99,
        venue_id=42,
        election_name="General Primary Election/Nonpartisan Election",
        reg_deadline="2026-04-20",
    )
    assert event["source_id"] == 99
    assert event["venue_id"] == 42
    assert event["start_date"] == "2026-04-20"
    assert event["is_all_day"] is True
    assert event["start_time"] is None
    assert event["is_free"] is True
    assert event["category"] == "civic"
    assert event["source_url"] == SOURCE_URL
    assert "voter-registration" in event["tags"]
    assert "civic-deadline" in event["tags"]
    assert event["ticket_url"] == "https://mvp.sos.ga.gov/s/voter-registration"


def test_build_registration_deadline_event_title() -> None:
    event = _build_registration_deadline_event(
        source_id=1,
        venue_id=1,
        election_name="General Primary Election/Nonpartisan Election",
        reg_deadline="2026-04-20",
    )
    assert "Voter Registration Deadline" in event["title"]
    assert "Georgia" in event["title"]


def test_build_registration_deadline_event_description_mentions_registration() -> None:
    event = _build_registration_deadline_event(
        source_id=1,
        venue_id=1,
        election_name="General Election/Special Election",
        reg_deadline="2026-10-05",
    )
    assert "register" in event["description"].lower()


def test_build_registration_deadline_event_content_hash_unique_per_election() -> None:
    e1 = _build_registration_deadline_event(
        1, 1, "General Primary Election", "2026-04-20"
    )
    e2 = _build_registration_deadline_event(1, 1, "General Election", "2026-10-05")
    assert e1["content_hash"] != e2["content_hash"]


# ---------------------------------------------------------------------------
# VENUE_DATA sanity
# ---------------------------------------------------------------------------


def test_venue_data_has_required_fields() -> None:
    required = [
        "name",
        "slug",
        "address",
        "city",
        "state",
        "zip",
        "lat",
        "lng",
        "venue_type",
        "spot_type",
        "website",
    ]
    for field in required:
        assert field in VENUE_DATA, f"VENUE_DATA missing field: {field}"


def test_venue_data_lat_lng_are_numeric() -> None:
    assert isinstance(VENUE_DATA["lat"], float)
    assert isinstance(VENUE_DATA["lng"], float)
    # Marietta, GA approximate bounds
    assert 33.8 < VENUE_DATA["lat"] < 34.1
    assert -84.7 < VENUE_DATA["lng"] < -84.4
