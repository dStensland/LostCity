# ── Synthetic description detection ──────────────────────────────────────

def test_synthetic_festival_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Great food festival. AfroPunk Atlanta is an Atlanta music festival experience. "
        "Timing: October 2026 through October 2026."
    ) is True

def test_synthetic_eventbrite_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Yoga in the Park is an Eventbrite event. Location: Piedmont Park in Midtown, Atlanta, GA. "
        "Scheduled on 2026-05-01 at 9:00 AM. Free registration."
    ) is True

def test_synthetic_ticketmaster_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Concert Tour 2026 is a live Ticketmaster event. Location: State Farm Arena in Downtown, Atlanta, GA. "
        "Scheduled on 2026-06-15 at 8:00 PM."
    ) is True

def test_synthetic_scheduled_on_pattern():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Fun community event. Location: Library in Decatur, GA. Scheduled on 2026-04-01 at 2:00 PM."
    ) is True

def test_synthetic_recurring_event():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Recurring event: Tuesday Trivia. Recurring weekly every Tuesday at 7:00 PM. "
        "Location: The Porter in Little Five Points."
    ) is True

def test_synthetic_meetup():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Meetup community event: Atlanta Python Users Group. Format: Online meetup. "
        "Check Meetup for RSVP limits, attendance requirements, and updates."
    ) is True

def test_synthetic_check_cta():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Great show. Check Eventbrite for full agenda details, policy updates, and current ticket availability."
    ) is True

def test_good_description_not_flagged():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Annual celebration of Atlanta's vibrant food scene featuring over 50 local restaurants, "
        "live cooking demonstrations, and craft cocktail workshops."
    ) is False

def test_short_description_not_flagged():
    from description_quality import is_synthetic_description
    # Short but real — should NOT be flagged as synthetic
    assert is_synthetic_description(
        "Jazz quartet performing original compositions and classic standards."
    ) is False

def test_none_returns_false():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(None) is False
    assert is_synthetic_description("") is False

def test_truncate_at_synthetic():
    from description_quality import truncate_at_synthetic
    result = truncate_at_synthetic(
        "Great food festival with live music and tastings. "
        "AfroPunk Atlanta is an Atlanta music festival experience. Timing: October 2026."
    )
    assert result == "Great food festival with live music and tastings."

def test_truncate_all_synthetic_returns_none():
    from description_quality import truncate_at_synthetic
    result = truncate_at_synthetic(
        "AfroPunk Atlanta is an Atlanta music festival experience. Timing: October 2026."
    )
    assert result is None

def test_truncate_no_synthetic_returns_unchanged():
    from description_quality import truncate_at_synthetic
    original = "Annual celebration of Atlanta's vibrant food scene."
    assert truncate_at_synthetic(original) == original
