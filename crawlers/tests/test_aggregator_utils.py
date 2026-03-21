"""
Tests for aggregator_utils.py — shared utilities for aggregator crawlers.
"""

import pytest
import sys
import os

# Allow imports from the crawlers/ directory without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from aggregator_utils import (
    clean_aggregator_title,
    detect_recurring_from_title,
    override_category_from_title,
    build_series_hint_from_recurring,
)


# ---------------------------------------------------------------------------
# clean_aggregator_title
# ---------------------------------------------------------------------------


class TestCleanAggregatorTitle:
    # --- Promotional suffixes must be stripped ---

    def test_strips_food_drink_specials_all_night(self):
        assert (
            clean_aggregator_title("Thursday Night Party | Food & Drink Specials All Night")
            == "Thursday Night Party"
        )

    def test_strips_drink_specials(self):
        assert clean_aggregator_title("DJ Night | Drink Specials") == "DJ Night"

    def test_strips_happy_hour_specials(self):
        assert clean_aggregator_title("Rooftop Social | Happy Hour Specials") == "Rooftop Social"

    def test_strips_tickets_on_sale(self):
        assert clean_aggregator_title("Big Show | Tickets On Sale") == "Big Show"

    def test_strips_ticket_singular(self):
        assert clean_aggregator_title("Festival | Ticket On Sale") == "Festival"

    def test_strips_free_entry(self):
        assert clean_aggregator_title("Open Mic | Free Entry") == "Open Mic"

    def test_strips_free_admission(self):
        assert clean_aggregator_title("Gallery Opening | Free Admission") == "Gallery Opening"

    def test_strips_free_parking(self):
        assert clean_aggregator_title("Concert | Free Parking") == "Concert"

    def test_strips_rsvp_now(self):
        assert clean_aggregator_title("Networking Event | RSVP Now") == "Networking Event"

    def test_strips_rsvp_today(self):
        assert clean_aggregator_title("Meetup | RSVP Today") == "Meetup"

    def test_strips_rsvp_required(self):
        assert clean_aggregator_title("Workshop | RSVP Required") == "Workshop"

    def test_strips_book_now(self):
        assert clean_aggregator_title("Tour | Book Now") == "Tour"

    def test_strips_book_today(self):
        assert clean_aggregator_title("Class | Book Today") == "Class"

    def test_strips_get_tickets(self):
        assert clean_aggregator_title("Rock Show | Get Tickets") == "Rock Show"

    def test_strips_limited_seats(self):
        assert clean_aggregator_title("Comedy Night | Limited Seats") == "Comedy Night"

    def test_strips_limited_availability(self):
        assert clean_aggregator_title("Yoga Retreat | Limited Availability") == "Yoga Retreat"

    def test_strips_early_bird(self):
        assert clean_aggregator_title("5K Race | Early Bird") == "5K Race"

    def test_strips_discount_in_suffix(self):
        assert clean_aggregator_title("Art Class | 20% discount") == "Art Class"

    def test_strips_promo_in_suffix(self):
        assert clean_aggregator_title("Trivia Night | Special Promo") == "Trivia Night"

    def test_strips_deal_in_suffix(self):
        assert clean_aggregator_title("Fitness Camp | Holiday Deal") == "Fitness Camp"

    def test_strips_off_percentage_in_suffix(self):
        assert clean_aggregator_title("Dance Class | 50% off") == "Dance Class"

    def test_strips_new_date(self):
        assert clean_aggregator_title("Postponed Concert | New Date") == "Postponed Concert"

    def test_strips_new_time(self):
        assert clean_aggregator_title("Film Screening | New Time") == "Film Screening"

    def test_strips_new_venue(self):
        assert clean_aggregator_title("Community Meet | New Venue") == "Community Meet"

    def test_strips_doors_open(self):
        assert clean_aggregator_title("Live Show | Doors Open at 7pm") == "Live Show"

    def test_strips_doors_open_no_time(self):
        assert clean_aggregator_title("Night Out | Doors Open Early") == "Night Out"

    # --- Iterative stripping of multiple promotional segments ---

    def test_strips_multiple_promotional_pipes(self):
        result = clean_aggregator_title("Jazz Brunch | Free Entry | RSVP Now")
        assert result == "Jazz Brunch"

    def test_strips_three_promotional_pipes(self):
        result = clean_aggregator_title("Summer Fest | Tickets On Sale | Early Bird | Book Now")
        assert result == "Summer Fest"

    # --- Non-promotional pipes must be preserved ---

    def test_preserves_genre_pipe(self):
        assert clean_aggregator_title("Jazz | Blues Night") == "Jazz | Blues Night"

    def test_preserves_artist_pipe(self):
        assert clean_aggregator_title("Duo Show | Alice & Bob") == "Duo Show | Alice & Bob"

    def test_preserves_venue_sub_pipe(self):
        title = "Comedy Night | The Basement Stage"
        assert clean_aggregator_title(title) == title

    def test_preserves_city_pipe(self):
        title = "Summer Market | Atlanta"
        assert clean_aggregator_title(title) == title

    # --- Whitespace normalisation ---

    def test_normalizes_leading_trailing_whitespace(self):
        assert clean_aggregator_title("  Night Out  ") == "Night Out"

    def test_normalizes_internal_whitespace(self):
        assert clean_aggregator_title("Night   Out") == "Night Out"

    def test_normalizes_whitespace_around_remaining_pipes(self):
        result = clean_aggregator_title("Jazz  |  Blues Night")
        assert result == "Jazz | Blues Night"

    # --- Edge cases ---

    def test_empty_string_returns_empty(self):
        assert clean_aggregator_title("") == ""

    def test_none_returns_empty(self):
        assert clean_aggregator_title(None) == ""  # type: ignore[arg-type]

    def test_title_with_no_pipe_unchanged(self):
        assert clean_aggregator_title("Simple Event Title") == "Simple Event Title"

    def test_case_insensitive_stripping(self):
        assert clean_aggregator_title("Show | FREE ENTRY") == "Show"
        assert clean_aggregator_title("Show | free entry") == "Show"

    def test_drink_specials_with_extra_qualifier(self):
        # "Happy Hour Drink Specials" — covered by the "Happy Hour Specials" OR
        # "Drink Specials" pattern depending on ordering; either result is acceptable
        result = clean_aggregator_title("Social | Happy Hour Drink Specials")
        assert result == "Social"


# ---------------------------------------------------------------------------
# detect_recurring_from_title
# ---------------------------------------------------------------------------


class TestDetectRecurringFromTitle:
    # --- Daily ---

    def test_daily_keyword(self):
        is_rec, freq, day = detect_recurring_from_title("Daily Happy Hour")
        assert is_rec is True
        assert freq == "daily"
        assert day is None

    def test_every_day(self):
        is_rec, freq, day = detect_recurring_from_title("Trivia Every Day at 7pm")
        assert is_rec is True
        assert freq == "daily"
        assert day is None

    def test_every_night(self):
        is_rec, freq, day = detect_recurring_from_title("Live Music Every Night")
        assert is_rec is True
        assert freq == "daily"
        assert day is None

    # --- Weekly ---

    def test_every_thursday(self):
        is_rec, freq, day = detect_recurring_from_title("Seafood Karaoke Every Thursday")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "thursday"

    def test_every_monday(self):
        is_rec, freq, day = detect_recurring_from_title("Open Mic Every Monday")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "monday"

    def test_every_friday(self):
        is_rec, freq, day = detect_recurring_from_title("DJ Night Every Friday")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "friday"

    def test_weekly_keyword(self):
        is_rec, freq, day = detect_recurring_from_title("Weekly Trivia Night")
        assert is_rec is True
        assert freq == "weekly"
        assert day is None

    def test_every_week(self):
        is_rec, freq, day = detect_recurring_from_title("Yoga every week")
        assert is_rec is True
        assert freq == "weekly"
        assert day is None

    def test_each_week(self):
        is_rec, freq, day = detect_recurring_from_title("Bingo each week")
        assert is_rec is True
        assert freq == "weekly"
        assert day is None

    def test_each_day_with_name(self):
        is_rec, freq, day = detect_recurring_from_title("Salsa class each Wednesday")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "wednesday"

    def test_day_abbreviation_sat(self):
        is_rec, freq, day = detect_recurring_from_title("Brunch Every Sat")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "saturday"

    def test_day_abbreviation_thu(self):
        is_rec, freq, day = detect_recurring_from_title("Trivia Every Thu")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "thursday"

    # --- Biweekly ---

    def test_every_other_monday(self):
        is_rec, freq, day = detect_recurring_from_title("Book Club Every Other Monday")
        assert is_rec is True
        assert freq == "biweekly"
        assert day == "monday"

    def test_every_other_friday(self):
        is_rec, freq, day = detect_recurring_from_title("Comedy Every Other Friday")
        assert is_rec is True
        assert freq == "biweekly"
        assert day == "friday"

    def test_biweekly_keyword(self):
        is_rec, freq, day = detect_recurring_from_title("Biweekly Swap Meet")
        assert is_rec is True
        assert freq == "biweekly"
        assert day is None

    def test_bi_hyphen_weekly(self):
        is_rec, freq, day = detect_recurring_from_title("Bi-weekly Trivia")
        assert is_rec is True
        assert freq == "biweekly"
        assert day is None

    # --- Monthly ---

    def test_monthly_keyword(self):
        is_rec, freq, day = detect_recurring_from_title("Monthly Networking Brunch")
        assert is_rec is True
        assert freq == "monthly"
        assert day is None

    def test_first_saturday(self):
        is_rec, freq, day = detect_recurring_from_title("First Saturday Market")
        assert is_rec is True
        assert freq == "monthly"
        assert day == "saturday"

    def test_last_friday(self):
        is_rec, freq, day = detect_recurring_from_title("Last Friday Art Walk")
        assert is_rec is True
        assert freq == "monthly"
        assert day == "friday"

    def test_2nd_tuesday(self):
        is_rec, freq, day = detect_recurring_from_title("2nd Tuesday Town Hall")
        assert is_rec is True
        assert freq == "monthly"
        assert day == "tuesday"

    def test_3rd_wednesday(self):
        is_rec, freq, day = detect_recurring_from_title("3rd Wednesday Meetup")
        assert is_rec is True
        assert freq == "monthly"
        assert day == "wednesday"

    # --- Case insensitivity ---

    def test_case_insensitive(self):
        is_rec, freq, day = detect_recurring_from_title("Open Mic EVERY THURSDAY")
        assert is_rec is True
        assert freq == "weekly"
        assert day == "thursday"

    # --- Negative cases ---

    def test_no_pattern_returns_false(self):
        is_rec, freq, day = detect_recurring_from_title("One-Off Concert")
        assert is_rec is False
        assert freq is None
        assert day is None

    def test_empty_string_returns_false(self):
        is_rec, freq, day = detect_recurring_from_title("")
        assert is_rec is False
        assert freq is None
        assert day is None

    def test_none_returns_false(self):
        is_rec, freq, day = detect_recurring_from_title(None)  # type: ignore[arg-type]
        assert is_rec is False
        assert freq is None
        assert day is None

    def test_date_mention_not_confused(self):
        # "Friday" as a date context, but no "every/weekly" keyword
        is_rec, freq, day = detect_recurring_from_title("Friday Night Concert")
        assert is_rec is False

    def test_first_name_not_monthly(self):
        # "First" as ordinal only triggers monthly when paired with a day name
        is_rec, freq, day = detect_recurring_from_title("First Annual Gala")
        assert is_rec is False


# ---------------------------------------------------------------------------
# override_category_from_title
# ---------------------------------------------------------------------------


class TestOverrideCategoryFromTitle:
    # --- Karaoke → nightlife ---

    def test_karaoke_overrides_music(self):
        assert override_category_from_title("Karaoke Night", "music") == "nightlife"

    def test_karaoke_overrides_other(self):
        assert override_category_from_title("Karaoke Tuesday", "other") == "nightlife"

    def test_karaoke_no_op_when_already_nightlife(self):
        assert override_category_from_title("Karaoke Night", "nightlife") == "nightlife"

    # --- Trivia → nightlife ---

    def test_trivia_overrides_community(self):
        assert override_category_from_title("Trivia Night", "community") == "nightlife"

    def test_pub_quiz_overrides_other(self):
        assert override_category_from_title("Weekly Pub Quiz", "other") == "nightlife"

    def test_quiz_night_overrides_food_drink(self):
        assert override_category_from_title("Quiz Night", "food_drink") == "nightlife"

    # --- Drag → nightlife ---

    def test_drag_show_overrides_art(self):
        assert override_category_from_title("Drag Show Saturday", "art") == "nightlife"

    def test_drag_brunch_overrides_food_drink(self):
        assert override_category_from_title("Drag Brunch", "food_drink") == "nightlife"

    def test_drag_bingo_overrides_other(self):
        assert override_category_from_title("Drag Bingo Night", "other") == "nightlife"

    def test_drag_queen_overrides_community(self):
        assert override_category_from_title("Drag Queen Trivia", "community") == "nightlife"

    # --- Bingo → nightlife ---

    def test_bingo_overrides_other(self):
        assert override_category_from_title("Bingo Night", "other") == "nightlife"

    def test_bingo_no_op_when_already_nightlife(self):
        assert override_category_from_title("Bingo Night", "nightlife") == "nightlife"

    # --- Open mic → nightlife ---

    def test_open_mic_overrides_music(self):
        assert override_category_from_title("Open Mic Wednesday", "music") == "nightlife"

    def test_open_mic_hyphenated(self):
        assert override_category_from_title("Open-Mic Night", "music") == "nightlife"

    def test_open_mic_nospace(self):
        assert override_category_from_title("Openmic Night", "music") == "nightlife"

    # --- Comedy → comedy ---

    def test_comedy_overrides_other(self):
        assert override_category_from_title("Comedy Night", "other") == "comedy"

    def test_standup_overrides_other(self):
        assert override_category_from_title("Stand-Up Showcase", "other") == "comedy"

    def test_standup_nospace(self):
        assert override_category_from_title("Standup Night", "other") == "comedy"

    def test_comedian_overrides_other(self):
        assert override_category_from_title("Local Comedian Showcase", "other") == "comedy"

    def test_improv_overrides_other(self):
        assert override_category_from_title("Improv Workshop", "other") == "comedy"

    def test_comedy_no_op_when_already_comedy(self):
        assert override_category_from_title("Comedy Show", "comedy") == "comedy"

    # --- Case insensitivity ---

    def test_case_insensitive_karaoke(self):
        assert override_category_from_title("KARAOKE NIGHT", "music") == "nightlife"

    def test_case_insensitive_trivia(self):
        assert override_category_from_title("TRIVIA NIGHT", "community") == "nightlife"

    # --- No-override cases ---

    def test_no_override_for_unknown_title(self):
        assert override_category_from_title("Summer Picnic", "community") == "community"

    def test_empty_title_returns_current(self):
        assert override_category_from_title("", "music") == "music"

    def test_none_title_returns_current(self):
        assert override_category_from_title(None, "music") == "music"  # type: ignore[arg-type]

    # --- Priority: first matching rule wins ---

    def test_drag_bingo_produces_nightlife_not_comedy(self):
        # "drag bingo" matches nightlife rule; comedy rule should not fire
        result = override_category_from_title("Drag Bingo Comedy Hour", "other")
        assert result == "nightlife"


# ---------------------------------------------------------------------------
# build_series_hint_from_recurring
# ---------------------------------------------------------------------------


class TestBuildSeriesHintFromRecurring:
    def test_none_when_not_recurring(self):
        assert build_series_hint_from_recurring("Concert", False, None, None) is None

    def test_none_when_empty_title_and_recurring(self):
        assert build_series_hint_from_recurring("", True, "weekly", "thursday") is None

    def test_basic_weekly_with_day(self):
        hint = build_series_hint_from_recurring(
            "Seafood Karaoke Every Thursday", True, "weekly", "thursday"
        )
        assert hint is not None
        assert hint["series_type"] == "recurring_show"
        assert hint["series_title"] == "Seafood Karaoke"
        assert hint["frequency"] == "weekly"
        assert hint["day_of_week"] == "thursday"

    def test_strips_leading_weekly_keyword(self):
        hint = build_series_hint_from_recurring(
            "Weekly Trivia Night", True, "weekly", None
        )
        assert hint is not None
        assert hint["series_title"] == "Trivia Night"

    def test_strips_trailing_every_day(self):
        hint = build_series_hint_from_recurring(
            "Open Mic Every Monday", True, "weekly", "monday"
        )
        assert hint is not None
        assert hint["series_title"] == "Open Mic"

    def test_strips_every_other_day(self):
        hint = build_series_hint_from_recurring(
            "Book Club Every Other Monday", True, "biweekly", "monday"
        )
        assert hint is not None
        assert hint["series_title"] == "Book Club"

    def test_strips_first_saturday(self):
        hint = build_series_hint_from_recurring(
            "First Saturday Market", True, "monthly", "saturday"
        )
        assert hint is not None
        assert hint["series_title"] == "Market"

    def test_strips_last_friday(self):
        hint = build_series_hint_from_recurring(
            "Last Friday Art Walk", True, "monthly", "friday"
        )
        assert hint is not None
        assert hint["series_title"] == "Art Walk"

    def test_strips_daily_keyword(self):
        hint = build_series_hint_from_recurring(
            "Daily Happy Hour", True, "daily", None
        )
        assert hint is not None
        assert hint["series_title"] == "Happy Hour"

    def test_strips_every_night(self):
        hint = build_series_hint_from_recurring(
            "Live Music Every Night", True, "daily", None
        )
        assert hint is not None
        assert hint["series_title"] == "Live Music"

    def test_fallback_when_stripping_leaves_nothing(self):
        # Title IS the recurring phrase — fall back to the raw title
        hint = build_series_hint_from_recurring("Weekly", True, "weekly", None)
        assert hint is not None
        assert hint["series_title"] == "Weekly"

    def test_monthly_no_day(self):
        hint = build_series_hint_from_recurring(
            "Monthly Networking Brunch", True, "monthly", None
        )
        assert hint is not None
        assert hint["series_title"] == "Networking Brunch"
        assert hint["frequency"] == "monthly"
        assert hint["day_of_week"] is None

    def test_frequency_and_day_passed_through(self):
        hint = build_series_hint_from_recurring(
            "Drag Bingo Every Wednesday", True, "weekly", "wednesday"
        )
        assert hint is not None
        assert hint["frequency"] == "weekly"
        assert hint["day_of_week"] == "wednesday"

    def test_series_type_always_recurring_show(self):
        hint = build_series_hint_from_recurring(
            "Yoga Every Sunday", True, "weekly", "sunday"
        )
        assert hint is not None
        assert hint["series_type"] == "recurring_show"

    def test_whitespace_normalized_in_series_title(self):
        hint = build_series_hint_from_recurring(
            "  Open Mic   Every   Friday  ", True, "weekly", "friday"
        )
        assert hint is not None
        assert hint["series_title"] == "Open Mic"
