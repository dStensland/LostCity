from datetime import date

from bs4 import BeautifulSoup

from sources.georgia_tech_athletics import (
    build_matchup_participants,
    build_consumer_title,
    maybe_adopt_existing_public_title,
    parse_schedule_page,
    reconcile_same_slot_variants,
    resolve_schedule_date,
    select_preferred_same_slot_variant,
)


def test_resolve_schedule_date_rolls_winter_games_into_next_year_when_in_horizon():
    assert resolve_schedule_date("Jan", "3", today=date(2025, 11, 1)) == "2026-01-03"


def test_resolve_schedule_date_skips_far_future_winter_games_outside_horizon():
    assert resolve_schedule_date("Jan", "3", today=date(2026, 3, 10)) is None


def test_resolve_schedule_date_keeps_same_year_for_current_season_games():
    assert resolve_schedule_date("Nov", "3", today=date(2026, 3, 10)) == "2026-11-03"


def test_build_consumer_title_matches_baseball_ticketmaster_style():
    assert (
        build_consumer_title("baseball", "Wake Forest Demon Deacons", True)
        == "Georgia Tech Yellow Jackets Baseball vs. Wake Forest Demon Deacons Baseball"
    )


def test_build_consumer_title_matches_softball_ticketmaster_style():
    assert (
        build_consumer_title("softball", "Florida State Seminoles", True)
        == "Georgia Tech Yellow Jackets Softball vs. Florida State Seminoles Softball"
    )


def test_build_matchup_participants_matches_baseball_title_shape():
    assert build_matchup_participants("baseball", "Wake Forest Demon Deacons", True) == [
        {"name": "Georgia Tech Yellow Jackets Baseball", "role": "team", "billing_order": 1},
        {"name": "Wake Forest Demon Deacons Baseball", "role": "team", "billing_order": 2},
    ]


def test_parse_schedule_page_uses_full_opponent_name_and_ticket_link():
    soup = BeautifulSoup(
        """
        <div class="schedule__table_item--inner home">
          <time>Fri Mar 27</time>
          <div class="matchup">
            <div class="logo"><img alt="GT" src="gt.png"/></div>
            <span>vs.</span>
            <div class="logo"><img alt="NC State" src="ncstate.png"/></div>
            <div class="name">
              <span>NC State</span>
              <p>Wolfpack</p>
            </div>
          </div>
          <div class="time">7:00 PM</div>
          <div class="information">
            <a href="https://ramblinwreck.evenue.net/event/BA26/BA15">Tickets</a>
          </div>
        </div>
        """,
        "html.parser",
    )

    games = parse_schedule_page(soup, "baseball", today=date(2026, 3, 10))

    assert games == [
        {
            "date": "2026-03-27",
            "time": "19:00",
            "opponent": "NC State Wolfpack",
            "ticket_url": "https://ramblinwreck.evenue.net/event/BA26/BA15",
            "is_home": True,
        }
    ]


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
                        "title": "Georgia Tech Yellow Jackets Baseball vs. North Carolina State Wolfpack Baseball",
                        "source_id": 11,
                    }
                ]
            )

    monkeypatch.setattr("sources.georgia_tech_athletics.get_client", lambda: _Client())

    assert (
        maybe_adopt_existing_public_title(
            257,
            625,
            "2026-03-27",
            "Georgia Tech Yellow Jackets Baseball vs. NC State Baseball",
        )
        == "Georgia Tech Yellow Jackets Baseball vs. North Carolina State Wolfpack Baseball"
    )


def test_select_preferred_same_slot_variant_prefers_full_public_title():
    preferred = select_preferred_same_slot_variant(
        [
            {"id": 1, "title": "GT Softball: vs Duke"},
            {"id": 2, "title": "Georgia Tech Yellow Jackets Softball vs. Duke Softball"},
            {"id": 3, "title": "Georgia Tech Yellow Jackets Softball vs. Duke Blue Devils Softball"},
        ]
    )

    assert preferred == {
        "id": 3,
        "title": "Georgia Tech Yellow Jackets Softball vs. Duke Blue Devils Softball",
    }


def test_reconcile_same_slot_variants_deactivates_noncanonical_rows(monkeypatch):
    operations = []
    table_calls = {"count": 0}

    class _UpdateQuery:
        def update(self, payload):
            operations.append(("update", payload))
            return self

        def in_(self, key, values):
            operations.append(("in", key, tuple(values)))
            return self

        def execute(self):
            operations.append(("execute_update",))
            return type("Result", (), {"data": []})()

    class _SelectQuery:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return type(
                "Result",
                (),
                {
                    "data": [
                        {"id": 78632, "title": "Georgia Tech Yellow Jackets Softball vs. Duke Blue Devils Softball", "is_active": True},
                        {"id": 122376, "title": "Georgia Tech Yellow Jackets Softball vs. Duke Softball", "is_active": True},
                        {"id": 23982, "title": "GT Softball: vs Duke", "is_active": True},
                    ]
                },
            )()

    class _Client:
        def table(self, name):
            if name != "events":
                raise AssertionError(name)
            table_calls["count"] += 1
            if table_calls["count"] == 1:
                return _SelectQuery()
            return _UpdateQuery()

    monkeypatch.setattr("sources.georgia_tech_athletics.get_client", lambda: _Client())
    monkeypatch.setattr("sources.georgia_tech_athletics.writes_enabled", lambda: True)

    removed = reconcile_same_slot_variants(257, 625, "2026-03-20", 78632)

    assert removed == 2
    assert ("update", {"is_active": False}) in operations
    assert ("in", "id", (122376, 23982)) in operations
