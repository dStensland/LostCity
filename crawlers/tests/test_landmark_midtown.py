from sources import landmark_midtown as source_module


class _FakeAnchor:
    def __init__(self, href, text):
        self._href = href
        self._text = text

    def get_attribute(self, name):
        if name == "href":
            return self._href
        return None

    def inner_text(self):
        return self._text


class _FakeElement:
    def __init__(self, text):
        self._text = text

    def inner_text(self):
        return self._text


class _FakeExtractPage:
    def __init__(self, main_text):
        self._main = _FakeElement(main_text)

    def query_selector(self, selector):
        if selector == "main":
            return self._main
        return None


class _DummyLocator:
    @property
    def first(self):
        return self

    def is_visible(self, timeout=0):
        return False

    def click(self):
        return None


class _DummyPage:
    def goto(self, url, wait_until=None, timeout=0):
        return None

    def wait_for_timeout(self, ms):
        return None

    def evaluate(self, script):
        return None

    def locator(self, selector):
        return _DummyLocator()

    def query_selector_all(self, selector):
        return []

    def close(self):
        return None


class _DummyContext:
    def new_page(self):
        return _DummyPage()


class _DummyBrowser:
    def new_context(self, **kwargs):
        return _DummyContext()

    def close(self):
        return None


class _DummyPlaywright:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    @property
    def chromium(self):
        return self

    def launch(self, headless=True):
        return _DummyBrowser()


def test_crawl_uses_screening_primary_flow(monkeypatch):
    persist_calls = []
    run_event_calls = []
    cleanup_calls = []

    monkeypatch.setattr(source_module, "sync_playwright", lambda: _DummyPlaywright())
    monkeypatch.setattr(source_module, "get_or_create_place", lambda _place: 77)
    monkeypatch.setattr(source_module, "select_midtown_location", lambda _page: True)
    monkeypatch.setattr(source_module, "extract_images_from_page", lambda _page: {})

    def _fake_extract_movies_for_date(
        page,
        target_date,
        source_id,
        venue_id,
        image_map,
        movie_url_map,
        detail_image_map,
        seen_showtimes,
    ):
        return [{"title": "Avatar", "start_date": "2026-04-08", "start_time": "19:00",
                 "place_id": venue_id, "source_id": source_id, "tags": ["film", "cinema", "showtime"]}]

    monkeypatch.setattr(source_module, "extract_movies_for_date", _fake_extract_movies_for_date)
    monkeypatch.setattr(
        source_module,
        "build_screening_bundle_from_event_rows",
        lambda **kwargs: {"source_id": kwargs["source_id"], "source_slug": kwargs["source_slug"],
                          "titles": [], "runs": [], "times": []},
    )
    monkeypatch.setattr(
        source_module,
        "persist_screening_bundle",
        lambda bundle: persist_calls.append(bundle) or {"titles": 1, "runs": 1, "times": 1},
    )
    monkeypatch.setattr(
        source_module,
        "sync_run_events_from_screenings",
        lambda **kwargs: run_event_calls.append(kwargs) or {"events_created": 1, "events_updated": 0,
                                                             "times_linked": 1, "run_event_hashes": {"h1"}},
    )
    monkeypatch.setattr(
        source_module,
        "remove_stale_showtime_events",
        lambda **kwargs: cleanup_calls.append(kwargs) or {"deactivated": 0, "deleted": 0},
    )

    found, new, updated = source_module.crawl({"id": 88, "slug": "landmark-midtown"})

    assert found == 1  # 1 showtime entry
    assert new == 1    # 1 run event created
    assert len(persist_calls) == 1
    assert run_event_calls == [{"source_id": 88, "source_slug": "landmark-midtown"}]
    assert len(cleanup_calls) == 1


def test_extract_movie_detail_links_reads_midtown_movie_pages():
    class _FakePage:
        def query_selector_all(self, selector):
            assert selector == "a[href*='/movies/']"
            return [
                _FakeAnchor(
                    "/movies/1000008742-the-drama/?theater=X00QM",
                    "THE DRAMA\nA FILM BY KRISTOFFER BORGLI",
                ),
                _FakeAnchor(
                    "/movies/282076-project-hail-mary/?theater=X00QM",
                    "PROJECT HAIL MARY\nA FILM BY PHIL LORD, CHRISTOPHER MILLER",
                ),
            ]

    movie_links = source_module.extract_movie_detail_links(_FakePage())

    assert movie_links == {
        "the drama": "https://www.landmarktheatres.com/movies/1000008742-the-drama/?theater=X00QM",
        "project hail mary": "https://www.landmarktheatres.com/movies/282076-project-hail-mary/?theater=X00QM",
    }


def test_extract_movie_detail_images_reads_og_images(monkeypatch):
    html = """
    <html>
      <head>
        <meta property="og:image" content="https://images.example.com/the-drama.jpg" />
      </head>
      <body></body>
    </html>
    """

    monkeypatch.setattr(source_module, "fetch_page", lambda _url: html)

    images = source_module.extract_movie_detail_images(
        {
            "the drama": "https://www.landmarktheatres.com/movies/1000008742-the-drama/?theater=X00QM",
        }
    )

    assert images == {
        "the drama": "https://images.example.com/the-drama.jpg",
    }


def test_extract_movies_for_date_returns_screening_entries_with_detail_links():
    page = _FakeExtractPage(
        "PG-13 • 2 hr, 10 minThe DramaDirected by Kristoffer Borgli Today, April 8 4:00PM7:00PM"
    )
    entries = source_module.extract_movies_for_date(
        page=page,
        target_date=source_module.datetime(2026, 4, 8),
        source_id=7,
        venue_id=8,
        image_map={},
        movie_url_map={
            "the drama": "https://www.landmarktheatres.com/movies/1000008742-the-drama/?theater=X00QM"
        },
        detail_image_map={
            "the drama": "https://images.example.com/the-drama.jpg",
        },
        seen_showtimes=set(),
    )

    assert len(entries) == 2
    assert {e["ticket_url"] for e in entries} == {
        "https://www.landmarktheatres.com/movies/1000008742-the-drama/?theater=X00QM"
    }
    assert {e["source_url"] for e in entries} == {
        "https://www.landmarktheatres.com/movies/1000008742-the-drama/?theater=X00QM"
    }
    assert {e["image_url"] for e in entries} == {
        "https://images.example.com/the-drama.jpg"
    }
    assert entries[0]["title"] == "The Drama"
    assert entries[0]["start_date"] == "2026-04-08"
