from datetime import datetime

from sources.atlanta_contemporary import (
    build_exhibition_title,
    normalize_ongoing_exhibit_dates,
    parse_exhibition_date_range,
)


class TestParseExhibitionDateRange:
    def test_parses_full_date_range(self):
        start_date, end_date = parse_exhibition_date_range("February 1, 2026 - May 17, 2026")

        assert start_date == "2026-02-01"
        assert end_date == "2026-05-17"


class TestNormalizeOngoingExhibitDates:
    def test_normalizes_active_ongoing_exhibit_to_today(self, monkeypatch):
        class MockDatetime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 3, 9, 12, 0, 0)

        monkeypatch.setattr("sources.atlanta_contemporary.datetime", MockDatetime)

        start_date, end_date = normalize_ongoing_exhibit_dates("2026-02-01", "2026-05-17")

        assert start_date == "2026-03-09"
        assert end_date == "2026-05-17"


class TestBuildExhibitionTitle:
    def test_combines_artist_and_show_title(self):
        assert (
            build_exhibition_title("Johnson Publishing Company Archives", "Rejoice, Resist, Rest")
            == "Johnson Publishing Company Archives: Rejoice, Resist, Rest"
        )

    def test_avoids_duplicate_repetition(self):
        assert build_exhibition_title("Unbound Narratives", "Unbound Narratives") == "Unbound Narratives"
