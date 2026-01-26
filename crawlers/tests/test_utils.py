"""
Tests for utility functions in utils.py.
"""

from datetime import datetime, timedelta
from utils import (
    slugify,
    parse_price,
    parse_relative_date,
    validate_event_time,
    normalize_time_format,
    get_date_range,
    extract_text_content,
)


class TestSlugify:
    """Tests for the slugify function."""

    def test_basic_text(self):
        assert slugify("Hello World") == "hello-world"

    def test_special_characters(self):
        assert slugify("Rock & Roll!") == "rock-roll"

    def test_multiple_spaces(self):
        assert slugify("Too   Many    Spaces") == "too-many-spaces"

    def test_underscores(self):
        assert slugify("under_score_text") == "under-score-text"

    def test_leading_trailing_hyphens(self):
        assert slugify("--test--") == "test"

    def test_mixed_case(self):
        assert slugify("MiXeD CaSe") == "mixed-case"

    def test_numbers(self):
        assert slugify("Event 2026") == "event-2026"

    def test_unicode_characters(self):
        # Note: Current slugify preserves unicode characters
        assert slugify("Café Music") == "café-music"

    def test_empty_string(self):
        assert slugify("") == ""

    def test_only_special_chars(self):
        assert slugify("!!!") == ""

    def test_venue_name(self):
        assert slugify("The Earl") == "the-earl"
        assert slugify("Eddie's Attic") == "eddies-attic"


class TestParsePrice:
    """Tests for the parse_price function."""

    def test_free(self):
        min_p, max_p, note = parse_price("Free")
        assert min_p == 0
        assert max_p == 0
        assert note == "Free"

    def test_free_case_insensitive(self):
        min_p, max_p, note = parse_price("FREE admission")
        assert min_p == 0
        assert max_p == 0

    def test_single_price(self):
        min_p, max_p, note = parse_price("$25")
        assert min_p == 25.0
        assert max_p == 25.0
        assert note is None

    def test_price_range(self):
        min_p, max_p, note = parse_price("$15 - $30")
        assert min_p == 15.0
        assert max_p == 30.0

    def test_price_range_no_dollar(self):
        min_p, max_p, note = parse_price("15 - 30")
        assert min_p == 15.0
        assert max_p == 30.0

    def test_decimal_price(self):
        min_p, max_p, note = parse_price("$19.99")
        assert min_p == 19.99
        assert max_p == 19.99

    def test_price_with_text(self):
        min_p, max_p, note = parse_price("Tickets: $25 advance, $30 door")
        assert min_p == 25.0
        assert max_p == 30.0

    def test_empty_string(self):
        min_p, max_p, note = parse_price("")
        assert min_p is None
        assert max_p is None
        assert note is None

    def test_none_input(self):
        min_p, max_p, note = parse_price(None)
        assert min_p is None
        assert max_p is None

    def test_text_only(self):
        min_p, max_p, note = parse_price("Contact venue for pricing")
        assert min_p is None
        assert max_p is None
        assert note == "contact venue for pricing"


class TestParseRelativeDate:
    """Tests for the parse_relative_date function."""

    def test_today(self, today):
        result = parse_relative_date("Today")
        assert result.date() == today.date()

    def test_tomorrow(self, today):
        result = parse_relative_date("Tomorrow")
        expected = today + timedelta(days=1)
        assert result.date() == expected.date()

    def test_weekday_name(self, today):
        result = parse_relative_date("Saturday")
        assert result is not None
        assert result > today
        assert result.weekday() == 5  # Saturday

    def test_next_weekday(self, today):
        result = parse_relative_date("Next Friday")
        assert result is not None
        assert result > today + timedelta(days=7)
        assert result.weekday() == 4  # Friday

    def test_unknown_format(self):
        result = parse_relative_date("Some random text")
        assert result is None

    def test_case_insensitive(self, today):
        result = parse_relative_date("TOMORROW")
        expected = today + timedelta(days=1)
        assert result.date() == expected.date()


class TestValidateEventTime:
    """Tests for the validate_event_time function."""

    def test_normal_evening_time(self):
        time_str, is_suspicious = validate_event_time("19:00")
        assert time_str == "19:00"
        assert is_suspicious is False

    def test_morning_time(self):
        time_str, is_suspicious = validate_event_time("10:00")
        assert time_str == "10:00"
        assert is_suspicious is False

    def test_suspicious_time_rejected(self):
        time_str, is_suspicious = validate_event_time("03:00", category="community")
        assert time_str is None
        assert is_suspicious is True

    def test_suspicious_time_allowed_for_nightlife(self):
        time_str, is_suspicious = validate_event_time("02:00", category="nightlife")
        assert time_str == "02:00"
        assert is_suspicious is True

    def test_suspicious_time_allowed_for_music(self):
        time_str, is_suspicious = validate_event_time("01:30", category="music")
        assert time_str == "01:30"
        assert is_suspicious is True

    def test_suspicious_time_allowed_for_comedy(self):
        time_str, is_suspicious = validate_event_time("01:00", category="comedy")
        assert time_str == "01:00"
        assert is_suspicious is True

    def test_none_input(self):
        time_str, is_suspicious = validate_event_time(None)
        assert time_str is None
        assert is_suspicious is False

    def test_midnight_not_suspicious(self):
        time_str, is_suspicious = validate_event_time("00:00")
        assert time_str == "00:00"
        assert is_suspicious is False

    def test_6am_not_suspicious(self):
        time_str, is_suspicious = validate_event_time("06:00")
        assert time_str == "06:00"
        assert is_suspicious is False


class TestNormalizeTimeFormat:
    """Tests for the normalize_time_format function."""

    def test_12_hour_pm(self):
        assert normalize_time_format("7:00 PM") == "19:00"

    def test_12_hour_am(self):
        assert normalize_time_format("10:30 AM") == "10:30"

    def test_12_hour_no_space(self):
        assert normalize_time_format("8:00PM") == "20:00"

    def test_24_hour(self):
        assert normalize_time_format("19:30") == "19:30"

    def test_24_hour_with_seconds(self):
        assert normalize_time_format("19:30:00") == "19:30"

    def test_noon(self):
        assert normalize_time_format("12:00 PM") == "12:00"

    def test_midnight(self):
        assert normalize_time_format("12:00 AM") == "00:00"

    def test_no_minutes_pm(self):
        assert normalize_time_format("7PM") == "19:00"

    def test_no_minutes_am(self):
        assert normalize_time_format("9AM") == "09:00"

    def test_single_digit_hour(self):
        assert normalize_time_format("9:00") == "09:00"

    def test_none_input(self):
        assert normalize_time_format(None) is None

    def test_empty_string(self):
        assert normalize_time_format("") is None

    def test_invalid_format(self):
        assert normalize_time_format("invalid") is None


class TestGetDateRange:
    """Tests for the get_date_range function."""

    def test_default_range(self):
        start, end = get_date_range()
        start_date = datetime.fromisoformat(start)
        end_date = datetime.fromisoformat(end)
        assert (end_date - start_date).days == 14

    def test_custom_range(self):
        start, end = get_date_range(days_ahead=30)
        start_date = datetime.fromisoformat(start)
        end_date = datetime.fromisoformat(end)
        assert (end_date - start_date).days == 30

    def test_start_is_today(self):
        start, _ = get_date_range()
        today = datetime.now().date().isoformat()
        assert start == today


class TestExtractTextContent:
    """Tests for the extract_text_content function."""

    def test_removes_script_tags(self):
        html = "<html><body><script>alert('test')</script><p>Content</p></body></html>"
        result = extract_text_content(html)
        assert "alert" not in result
        assert "Content" in result

    def test_removes_style_tags(self):
        html = "<html><body><style>.test{color:red}</style><p>Content</p></body></html>"
        result = extract_text_content(html)
        assert "color" not in result
        assert "Content" in result

    def test_removes_nav_footer_header(self):
        html = """
        <html><body>
        <header>Header content</header>
        <nav>Nav links</nav>
        <main><p>Main content</p></main>
        <footer>Footer content</footer>
        </body></html>
        """
        result = extract_text_content(html)
        assert "Header content" not in result
        assert "Nav links" not in result
        assert "Footer content" not in result
        assert "Main content" in result

    def test_preserves_text_content(self):
        html = "<html><body><h1>Title</h1><p>Paragraph text.</p></body></html>"
        result = extract_text_content(html)
        assert "Title" in result
        assert "Paragraph text" in result

    def test_cleans_whitespace(self):
        html = "<p>Line 1</p>   <p>Line 2</p>"
        result = extract_text_content(html)
        lines = [l for l in result.split("\n") if l.strip()]
        assert len(lines) >= 2
