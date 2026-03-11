from sources.indivisible_atl import _determine_category, _enrich_tags


def test_enrich_tags_marks_election_meeting_as_government_public_meeting():
    tags = _enrich_tags(
        "Fulton County: Join us for the Board of Registrations and Elections Meeting",
        "Stand with voters and election workers at the meeting.",
    )

    assert "government" in tags
    assert "public-meeting" in tags
    assert "election" in tags
    assert "public-comment" in tags


def test_determine_category_marks_poster_event_as_learning():
    assert _determine_category("Make a Poster for NO KINGS!", "Join us to make posters.") == "learning"


def test_enrich_tags_marks_ice_action_as_immigration_and_advocacy():
    tags = _enrich_tags(
        "Home Depot Loves ICE-New Northside Dr. & 285",
        "ICE unlawfully detains day laborers and immigrants.",
    )

    assert "advocacy" in tags
    assert "immigration" in tags
