from types import SimpleNamespace

from sources._dunwoody_camp_pdf import extract_title_date_pairs_from_lines
from sources.dunwoody_island_ford_camps import _build_event_record, _rows_from_pairs, crawl


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


def test_crawl_updates_existing_row_with_existing_record(monkeypatch) -> None:
    row = _rows_from_pairs([("Water World", "June 15 - 19")])[0]
    existing = {"id": 9123, "content_hash": "abc"}
    captured = {}

    monkeypatch.setattr(
        "sources.dunwoody_island_ford_camps.requests.get",
        lambda *args, **kwargs: SimpleNamespace(status_code=200, raise_for_status=lambda: None),
    )
    monkeypatch.setattr("sources.dunwoody_island_ford_camps._parse_rows_from_pdf", lambda: [row])
    monkeypatch.setattr("sources.dunwoody_island_ford_camps.get_or_create_venue", lambda venue: 42)
    monkeypatch.setattr(
        "sources.dunwoody_island_ford_camps.persist_typed_entity_envelope", lambda envelope: None
    )
    monkeypatch.setattr(
        "sources.dunwoody_island_ford_camps.find_event_by_hash", lambda content_hash: existing
    )

    def fake_smart_update(found_existing, record):
        captured["existing"] = found_existing
        captured["record"] = record
        return True

    monkeypatch.setattr("sources.dunwoody_island_ford_camps.smart_update_existing_event", fake_smart_update)
    monkeypatch.setattr("sources.dunwoody_island_ford_camps.insert_event", lambda record: True)

    found, new, updated = crawl({"id": 77})

    assert (found, new, updated) == (1, 0, 1)
    assert captured["existing"] == existing
    assert captured["record"]["title"] == "Island Ford Summer Camp: Water World"
