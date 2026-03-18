from sources.dekalb_parks_rec import _derive_schedule_fields


def test_derive_schedule_fields_extracts_times_from_date_range_text() -> None:
    assert _derive_schedule_fields(
        start_raw="2026-06-15",
        end_raw="2026-06-19",
        date_range_description="Camp runs from 9am-4pm.",
        desc_text="Summer camp week.",
    ) == ("09:00:00", "16:00:00", False)
