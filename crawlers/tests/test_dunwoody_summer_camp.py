from sources._dunwoody_camp_pdf import extract_title_date_pairs_from_lines, normalize_short_line
from sources.dunwoody_summer_camp import _build_event_record, _rows_from_pairs


RAW_LINES = [
    "W i n g i n g  I t",
    "C r e e k  W e e k  I",
    "June 1 - 5",
    "Incredible Insects",
    "June 8 - 12",
    "May 26 - 29",
    "4 Day Week",
    "July 27 - 31",
    "Creek Week III",
    "Animal Superpowers",
    "August 3 - 7",
    "2 Full Day/3 Half Day Classes",
    "Habitat Hunt",
    "August 10 - 14",
    "Half Day Only",
    "August 17 - 21",
    "Half Day Only",
    "Buzz and Flutter",
]


def test_rows_from_pairs_shapes_mixed_track_and_half_day_camps() -> None:
    pairs = extract_title_date_pairs_from_lines(RAW_LINES)
    rows = _rows_from_pairs(pairs)

    assert len(rows) == 7
    assert rows[0]["title"] == "Dunwoody Nature Summer Camp: Winging It"
    assert rows[0]["price_min"] == 208.0
    assert rows[0]["price_max"] == 300.0

    habitat = next(row for row in rows if row["title"].endswith("Habitat Hunt"))
    assert habitat["age_min"] == 4
    assert habitat["age_max"] == 4
    assert habitat["end_time"] == "13:00"
    assert habitat["price_min"] == 270.0

    assert normalize_short_line("R e p t i l e s  R o c k !  ") == "Reptiles Rock!"


def test_build_event_record_shapes_program_event() -> None:
    row = _rows_from_pairs([("Creek Week I", "June 1 - 5")])[0]
    record = _build_event_record(31, 32, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["ticket_url"].startswith("https://www.hisawyer.com/")
