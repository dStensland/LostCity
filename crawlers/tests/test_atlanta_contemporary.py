from datetime import datetime

from sources.atlanta_contemporary import (
    _build_destination_envelope,
    build_exhibition_lane_record,
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


class TestBuildExhibitionLaneRecord:
    def test_projects_exhibition_into_typed_lane(self):
        record, artists = build_exhibition_lane_record(
            {
                "title": "Artist One: Unbound Narratives",
                "description": "A survey exhibition.",
                "canonical_start_date": "2026-02-01",
                "start_date": "2026-03-09",
                "end_date": "2026-05-17",
                "source_url": "https://example.com/exhibits/unbound",
                "image_url": "https://example.com/image.jpg",
            },
            source_id=77,
            venue_id=99,
            portal_id="portal-arts",
        )

        assert record["source_id"] == 77
        assert record["place_id"] == 99
        assert record["portal_id"] == "portal-arts"
        assert record["opening_date"] == "2026-02-01"
        assert record["closing_date"] == "2026-05-17"
        assert record["metadata"]["display_start_date"] == "2026-03-09"
        assert artists == [{"artist_name": "Artist One"}]


class TestBuildDestinationEnvelope:
    def test_builds_family_destination_shape(self):
        envelope = _build_destination_envelope(233)

        assert envelope.destination_details[0]["destination_type"] == "art_museum"
        assert envelope.destination_details[0]["commitment_tier"] == "hour"
        assert envelope.destination_details[0]["family_suitability"] == "caution"
        assert {feature["slug"] for feature in envelope.venue_features} == {
            "free-contemporary-art-center",
            "west-midtown-cultural-pairing-stop",
        }
        assert {special["slug"] for special in envelope.venue_specials} == {
            "always-free-gallery-admission",
        }
