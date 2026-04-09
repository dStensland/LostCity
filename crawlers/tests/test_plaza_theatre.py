from datetime import datetime

from sources import plaza_theatre
from sources.plaza_theatre import resolve_showtime_ticket_url


class _FakeButton:
    def __init__(self, page):
        self.page = page

    def click(self, timeout=0):
        self.page.url = "https://www.plazaatlanta.com/checkout/showing/sharkys-machine/2708266"


class _FakePage:
    def __init__(self):
        self.url = "https://www.plazaatlanta.com/now-showing/"
        self.went_back = False

    def wait_for_url(self, pattern, timeout=0):
        if "/checkout/showing/" not in self.url:
            raise RuntimeError("navigation did not occur")

    def go_back(self, wait_until=None, timeout=0):
        self.url = "https://www.plazaatlanta.com/now-showing/"
        self.went_back = True

    def wait_for_timeout(self, ms):
        return None


class _FakeNoopButton:
    def click(self, timeout=0):
        return None


def test_resolve_showtime_ticket_url_returns_checkout_url_and_restores_listing_page():
    page = _FakePage()

    url = resolve_showtime_ticket_url(page, _FakeButton(page))

    assert url == "https://www.plazaatlanta.com/checkout/showing/sharkys-machine/2708266"
    assert page.url == "https://www.plazaatlanta.com/now-showing/"
    assert page.went_back is True


def test_resolve_showtime_ticket_url_returns_none_when_button_does_not_navigate():
    page = _FakePage()

    url = resolve_showtime_ticket_url(page, _FakeNoopButton())

    assert url is None
    assert page.url == "https://www.plazaatlanta.com/now-showing/"


class _FakeContainerLocator:
    def __init__(self, items):
        self.items = items

    def count(self):
        return len(self.items)

    def nth(self, index):
        return self.items[index]

    @property
    def first(self):
        return self.items[0]


class _FakeTextNode:
    def __init__(self, text):
        self.text = text

    def count(self):
        return 1

    def inner_text(self):
        return self.text


class _FakeImageNode:
    def __init__(self, src):
        self.src = src

    def count(self):
        return 1

    def get_attribute(self, name):
        if name == "src":
            return self.src
        return None


class _FakeButtonNode:
    def __init__(self, text):
        self.text = text

    def inner_text(self):
        return self.text


class _FakeMovieContainer:
    def __init__(self, title, button_texts, image_src=None):
        self.title = title
        self.button_texts = button_texts
        self.image_src = image_src

    def locator(self, selector):
        if selector == ".text-h5":
            return _FakeContainerLocator([_FakeTextNode(self.title)])
        if selector == "button":
            return _FakeContainerLocator([_FakeButtonNode(text) for text in self.button_texts])
        if selector == "img.q-img__image":
            if self.image_src:
                return _FakeContainerLocator([_FakeImageNode(self.image_src)])
            return _FakeContainerLocator([])
        raise AssertionError(f"Unexpected selector: {selector}")


class _FakeExtractionPage:
    def __init__(self, containers, primary_selector=".movie-container"):
        self.containers = containers
        self.primary_selector = primary_selector

    def locator(self, selector):
        if selector == self.primary_selector:
            return _FakeContainerLocator(self.containers)
        if selector in {".movie-container", ".q-card.col.movie", ".col-sm-6 .q-card.col.movie"}:
            return _FakeContainerLocator([])
        raise AssertionError(f"Unexpected selector: {selector}")


def test_extract_movies_for_date_uses_dom_showtimes_without_resolving_checkout_urls(monkeypatch):
    page = _FakeExtractionPage(
        [
            _FakeMovieContainer(
                "The Napa Boys Not Rated",
                ["4:00 PM\nENDS AT 5:43 PM", "6:15 PM\nENDS AT 7:58 PM"],
                image_src="https://example.com/napa.jpg",
            )
        ]
    )

    monkeypatch.setattr(
        plaza_theatre,
        "resolve_showtime_ticket_url",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("should not click checkout buttons")),
    )

    entries = plaza_theatre.extract_movies_for_date(
        page,
        datetime(2026, 4, 8),
        source_id=10,
        venue_id=20,
        letterboxd_movies=[],
        image_map={},
        seen_hashes=set(),
    )

    assert len(entries) == 2
    assert [e["title"] for e in entries] == ["The Napa Boys", "The Napa Boys"]
    assert [e["start_time"] for e in entries] == ["16:00", "18:15"]
    assert all(e["ticket_url"] is None for e in entries)


def test_extract_movies_for_date_supports_new_q_card_movie_layout(monkeypatch):
    page = _FakeExtractionPage(
        [
            _FakeMovieContainer(
                "The Drama (Digital + 35mm)",
                ["4:15 PM\nENDS AT 6:10 PM", "8:30 PM\nENDS AT 10:25 PM"],
                image_src="https://example.com/drama.jpg",
            )
        ],
        primary_selector=".q-card.col.movie",
    )

    entries = plaza_theatre.extract_movies_for_date(
        page,
        datetime(2026, 4, 8),
        source_id=10,
        venue_id=20,
        letterboxd_movies=[],
        image_map={},
        seen_hashes=set(),
    )

    assert len(entries) == 2
    assert [e["title"] for e in entries] == [
        "The Drama (Digital + 35mm)",
        "The Drama (Digital + 35mm)",
    ]
    assert [e["start_time"] for e in entries] == ["16:15", "20:30"]


def test_extract_movies_for_date_drops_enrichment_ticket_urls_for_now_showing(monkeypatch):
    page = _FakeExtractionPage(
        [
            _FakeMovieContainer(
                "The Napa Boys",
                ["4:00 PM\nENDS AT 5:43 PM"],
                image_src="https://example.com/napa.jpg",
            )
        ]
    )

    monkeypatch.setattr(
        plaza_theatre,
        "enrich_movie_data",
        lambda *_args, **_kwargs: {
            "ticket_url": "https://www.plazaatlanta.com/checkout/showing/todays-show/123",
            "image_url": "https://example.com/enriched.jpg",
        },
    )

    entries = plaza_theatre.extract_movies_for_date(
        page,
        datetime(2026, 4, 8),
        source_id=10,
        venue_id=20,
        letterboxd_movies=[],
        image_map={},
        seen_hashes=set(),
    )

    assert len(entries) == 1
    assert entries[0]["ticket_url"] is None


class _FakeBodyPage:
    def __init__(self, body_text):
        self._body_text = body_text

    def inner_text(self, selector):
        assert selector == "body"
        return self._body_text


def test_extract_movies_from_text_handles_rating_and_accessibility_lines(monkeypatch):
    page = _FakeBodyPage(
        """
        NOW PLAYING
        Chime + Serpent's Path (4K)
        Not Rated
        closed_caption
        Subtitled
        2 hr 10 min
        Thriller
        The Rej
        Digital
        8:15 PM
        ENDS AT 10:35 PM
        The Drama (Digital + 35mm)
        accessible
        headphones
        1 hr 45 min
        Romance
        The Lefont
        35MM
        4:15 PM
        ENDS AT 6:10 PM
        The Mike
        Digital
        8:30 PM
        ENDS AT 10:25 PM
        The Napa Boys
        Not Rated
        add_shopping_cart
        Discount Days
        1 hr 33 min
        Comedy
        The Mike
        Digital
        4:00 PM
        ENDS AT 5:43 PM
        """
    )

    entries = plaza_theatre._extract_movies_from_text(
        page,
        "2026-04-08",
        source_id=10,
        venue_id=20,
        letterboxd_movies=[],
        image_map={},
        seen_hashes=set(),
    )

    assert len(entries) == 4
    assert [e["title"] for e in entries] == [
        "Chime + Serpent's Path",
        "The Drama (Digital + 35mm)",
        "The Drama (Digital + 35mm)",
        "The Napa Boys",
    ]
    assert [e["start_time"] for e in entries] == [
        "20:15",
        "16:15",
        "20:30",
        "16:00",
    ]
    assert all(e["ticket_url"] is None for e in entries)
