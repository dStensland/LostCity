from sources.aa_atlanta import build_compact_meeting_description as build_aa_description
from sources.atlanta_city_meetings import build_compact_meeting_description
from sources.lore_atlanta import WEEKLY_EVENTS, clean_description as clean_lore_description
from sources.na_georgia import build_compact_meeting_description as build_na_description
from sources.recurring_social_events import _clean_description as clean_recurring_description
from sources.team_trivia import EVENT_TYPE_CONFIG


def test_build_compact_meeting_description_keeps_factual_location_context():
    description = build_compact_meeting_description(
        board="Atlanta City Council",
        meeting_type="Regular Meeting",
        location="Marvin S. Arrington, Sr. Council Chamber, Atlanta City Hall",
    )

    assert description == (
        "Public Atlanta City Council regular meeting at "
        "Marvin S. Arrington, Sr. Council Chamber, Atlanta City Hall."
    )


def test_team_trivia_descriptions_are_event_type_specific_and_natural():
    assert EVENT_TYPE_CONFIG["trivia"]["description"].startswith(
        "Free team trivia hosted by OutSpoken Entertainment."
    )
    assert "Music bingo" in EVENT_TYPE_CONFIG["music_bingo"]["description"]


def test_aa_compact_description_keeps_format_and_arrival_notes():
    description = build_aa_description(
        {
            "types": ["O", "B"],
            "attendance_option": "in_person",
            "location_notes": "Use the side entrance.",
        },
        location_name="Peachtree Church",
    )

    assert description == (
        "Alcoholics Anonymous peer-support meeting (in-person). "
        "Format: Open, Beginners. "
        "Location: Peachtree Church. "
        "Arrival notes: Use the side entrance."
    )


def test_na_compact_description_keeps_hybrid_and_virtual_facts():
    description = build_na_description(
        {
            "virtual_meeting_link": "https://example.com",
            "phone_meeting_number": "555-1234",
            "latitude": 33.7,
            "longitude": -84.3,
            "comments": "Mask-friendly space",
        },
        ["Open", "LGBTQ+"],
        location_name="Triangle Club",
    )

    assert description == (
        "Narcotics Anonymous peer-support meeting (hybrid: in-person and online). "
        "Format: Open, LGBTQ+. "
        "Location: Triangle Club. "
        "Notes: Mask-friendly space. "
        "Virtual meeting link available. "
        "Dial-in available."
    )


def test_lore_description_cleaner_keeps_compact_source_copy():
    assert clean_lore_description(WEEKLY_EVENTS[0]["description"]) == (
        "Tuesday karaoke night at Lore Atlanta on Edgewood Ave. LGBTQ+ club with full bar and late-night vibes."
    )


def test_recurring_social_description_cleaner_removes_whitespace_only():
    assert clean_recurring_description("  Weekly vinyl listening session at Commune.  ") == (
        "Weekly vinyl listening session at Commune."
    )
