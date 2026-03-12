from sources._dunwoody_camp_pdf import extract_title_date_pairs_from_lines
from sources.dunwoody_island_ford_camps import _build_event_record, _rows_from_pairs


RAW_LINES = [
    "Island Ford Campus",
    "June 1 - 5",
    "June 8 - 12",
    "Junior Rangers",
    "Animal Adaptations",
    "Water World",
    "June 15 - 19",
    "Scales and Slime",
    "June 22 - 26",
    "Legends and Myths",
    "July 6 - 10",
    "July 20 - 24",
    "July 13 - 17",
    "Birds of a Feather",
    "Trekkers and Trailblazers",
]


def test_rows_from_pairs_shapes_island_ford_weekly_camps() -> None:
    pairs = extract_title_date_pairs_from_lines(RAW_LINES, ignored_titles={"Island Ford Campus"})
    rows = _rows_from_pairs(pairs)

    assert len(rows) == 7
    assert rows[0]["title"] == "Island Ford Summer Camp: Junior Rangers"
    assert rows[0]["age_min"] == 9
    assert rows[0]["price_min"] == 422.0
    assert rows[-1]["title"] == "Island Ford Summer Camp: Birds of a Feather"


def test_build_event_record_shapes_program_event() -> None:
    row = _rows_from_pairs([("Water World", "June 15 - 19")])[0]
    record = _build_event_record(41, 42, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["start_time"] == "09:00"
