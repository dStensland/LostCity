from datetime import date

from bs4 import BeautifulSoup

from sources.georgia_bulldogs_baseball_atlanta import (
    build_consumer_title,
    maybe_adopt_existing_public_title,
    parse_schedule_cards,
)


def test_parse_schedule_cards_extracts_truist_park_game():
    soup = BeautifulSoup(
        """
        <div data-test-id="s-game-card-standard__root">
          <a data-test-id="s-game-card-standard__header-team-opponent-link">Georgia Tech</a>
          <span data-test-id="s-game-card-facility-and-location__standard-facility-title">Truist Park</span>
          <span class="s-game-card__promotion-btn-text">Spring Baseball Classic to benefit Children's Healthcare of Atlanta</span>
          <p data-test-id="s-game-card-standard__header-game-date">Apr 21 <span>(Tue)</span></p>
          <p data-test-id="s-game-card-standard__header-game-time">7 pm</p>
          <a href="/showcase?Live=4995">Listen</a>
        </div>
        """,
        "html.parser",
    )

    assert parse_schedule_cards(soup, today=date(2026, 3, 11)) == [
        {
            "date": "2026-04-21",
            "time": "19:00",
            "opponent": "Georgia Tech",
            "promotion": "Spring Baseball Classic to benefit Children's Healthcare of Atlanta",
            "source_url": "https://georgiadogs.com/showcase?Live=4995",
        }
    ]


def test_build_consumer_title_for_baseball():
    assert build_consumer_title("Georgia Tech Yellow Jackets") == (
        "Georgia Bulldogs Baseball vs. Georgia Tech Yellow Jackets Baseball"
    )


def test_maybe_adopt_existing_public_title_prefers_same_slot_external_row(monkeypatch):
    class _Query:
        def __init__(self, rows):
            self._rows = rows

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def neq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type("Result", (), {"data": self._rows})()

    class _Client:
        def table(self, _name):
            return _Query(
                [
                    {
                        "title": "Spring Classic: Georgia vs. Georgia Tech",
                        "source_id": 11,
                    }
                ]
            )

    monkeypatch.setattr(
        "sources.georgia_bulldogs_baseball_atlanta.get_client",
        lambda: _Client(),
    )

    assert maybe_adopt_existing_public_title(
        2001,
        103,
        "2026-04-21",
        "19:00",
        "Georgia Bulldogs Baseball vs. Georgia Tech Baseball",
    ) == "Spring Classic: Georgia vs. Georgia Tech"
