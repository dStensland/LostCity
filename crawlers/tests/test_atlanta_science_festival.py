import sources.atlanta_science_festival as asf


class _ImmediateFuture:
    def __init__(self, result):
        self._result = result

    def result(self):
        return self._result


class _ImmediateExecutor:
    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def submit(self, fn, arg):
        return _ImmediateFuture(fn(arg))


def test_existing_rows_use_insert_pipeline_for_series_relink(monkeypatch):
    monkeypatch.setattr(asf, "get_or_create_place", lambda _venue: 1)
    monkeypatch.setattr(asf, "_get", lambda _session, _url: "<html></html>")
    monkeypatch.setattr(
        asf,
        "_parse_listing",
        lambda _html: [
            {
                "source_url": "https://atlantasciencefestival.org/event/example/",
                "title": "Discovery Walk Emory",
                "description_snippet": "Explore science on campus.",
                "start_date": "2099-03-10",
                "start_time": "11:00",
                "end_time": "12:00",
                "image_url": "https://example.com/discovery.jpg",
                "audiences": ["Families"],
            }
        ],
    )
    monkeypatch.setattr(
        asf,
        "_fetch_detail",
        lambda args: (
            args[1],
            {
                "venue_name": "Emory University",
                "venue_address": "201 Dowman Dr",
                "venue_city": "Atlanta",
                "venue_state": "GA",
                "venue_zip": "30322",
                "venue_type_label": "Indoor",
                "price_text": "Free",
                "ticket_url": "https://tickets.example.com/discovery",
                "topics": ["biology"],
            },
        ),
    )
    monkeypatch.setattr(asf, "ThreadPoolExecutor", _ImmediateExecutor)
    monkeypatch.setattr(asf, "as_completed", lambda futures: list(futures))
    monkeypatch.setattr(asf, "_get_or_create_event_venue", lambda *args, **kwargs: 2)
    monkeypatch.setattr(
        asf,
        "find_event_by_hash",
        lambda _content_hash: {"id": 77, "place_id": 2},
    )

    captured = {}

    def fake_insert_event(record, series_hint=None):
        captured["record"] = record
        captured["series_hint"] = series_hint
        return 77

    monkeypatch.setattr(asf, "insert_event", fake_insert_event)

    found, new, updated = asf.crawl({"id": 123})

    assert (found, new, updated) == (1, 0, 1)
    assert captured["record"]["title"] == "Discovery Walk Emory"
    assert captured["record"]["place_id"] == 2
    assert captured["series_hint"] is None
