from datetime import date

from sources.atlanta_roller_derby import build_matchup_participants, extract_schedule_events


SAMPLE_HTML = """
<section>
  <div>
    <h3>March 21</h3>
    <p>Doors at 5:00pm &amp; 7:30pm</p>
    <p>5:00pm: Atlanta Rolling Ruckus vs Peach State Roller Derby 7:30pm: Atlanta Rumble Bs vs Terminus Roller Derby</p>
    <p><a href="https://example.com/tickets">Buy Tickets</a></p>
  </div>
</section>
"""


def test_extract_schedule_events_builds_double_header():
    events = extract_schedule_events(SAMPLE_HTML, today=date(2026, 3, 10))

    assert events == [
        {
            "title": "Roller Derby Double-Header: Atlanta Rolling Ruckus vs Peach State Roller Derby / Atlanta Rumble Bs vs Terminus Roller Derby",
            "description": (
                "Bout 1: Atlanta Rolling Ruckus vs Peach State Roller Derby "
                "Bout 2: Atlanta Rumble Bs vs Terminus Roller Derby "
                "Atlanta Roller Derby hosts exciting flat track roller derby action at Agnes Scott College's Woodruff Athletic Complex. "
                "Doors at 5:00pm. Double-header featuring two exciting matchups."
            ),
            "start_date": "2026-03-21",
            "start_time": "17:00",
            "ticket_url": "https://example.com/tickets",
            "raw_text": "March 21 | Atlanta Rolling Ruckus vs Peach State Roller Derby | Atlanta Rumble Bs vs Terminus Roller Derby",
            "participants": [
                {"name": "Atlanta Rolling Ruckus", "role": "team", "billing_order": 1},
                {"name": "Peach State Roller Derby", "role": "team", "billing_order": 2},
                {"name": "Atlanta Rumble Bs", "role": "team", "billing_order": 3},
                {"name": "Terminus Roller Derby", "role": "team", "billing_order": 4},
            ],
        }
    ]


def test_build_matchup_participants_skips_generic_or_tbd_labels():
    assert build_matchup_participants(
        "Home Team Grudge Match",
        "Atlanta Dirty South Allstars vs TBD Minnesota B Team",
    ) == [
        {"name": "Atlanta Dirty South Allstars", "role": "team", "billing_order": 1},
    ]
