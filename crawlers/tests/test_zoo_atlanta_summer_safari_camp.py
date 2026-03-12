from sources.zoo_atlanta_summer_safari_camp import (
    _build_event_record,
    _parse_week_rows,
)


HTML = """
<html>
  <body>
    <p>Upcoming Dates: weekly, May 26 - July 31, 2026 Time(s): 9 a.m.-4 p.m. Cost: JUNIOR RANGER AND TREK: $400/week QUEST: $425/week Member Cost: JUNIOR RANGER AND TREK: $350/week QUEST: $370/week EXTENDED CARE COST: $75/week</p>
    <a href="https://zooatlanta.doubleknot.com/2026-summer-safari-junior-rangers/76653">Junior Ranger Registration</a>
    <a href="https://zooatlanta.doubleknot.com/2026-summer-safari-trek/76662">Trek Registration</a>
    <a href="https://zooatlanta.doubleknot.com/2026-summer-safari-quest/76663">Quest Registration</a>

    <div class="wpsm_panel">
      <h4>JUNIOR RANGERS (Ages 5-7):</h4>
      <p>Our youngest campers will explore the Zoo and connect with wildlife.</p>
    </div>
    <div class="wpsm_panel">
      <h4>TREK (Ages 8-11):</h4>
      <p>Trek campers will go behind the scenes and investigate wildlife habitats.</p>
    </div>
    <div class="wpsm_panel">
      <h4>QUEST (Ages 12-14):</h4>
      <p>Quest campers will learn about animal care and conservation careers.</p>
    </div>

    <div class="wpsm_panel">
      <h4>Week 1: May 26-29</h4>
      <p><strong>Junior Rangers (Ages 5 - 7)</strong></p>
      <p><strong>Elevating Ecosystems:</strong> Join us for a week-long exploration of ecosystems.</p>
      <p><strong>Trek (Ages 8 - 11)</strong></p>
      <p><strong>Brilliant Biomes:</strong> Explore wild homes of animal ambassadors.</p>
      <p><strong>Quest (Ages 12 - 14)</strong></p>
      <p><strong>Animal Care Explorations:</strong> Peek behind the scenes with Animal Care Specialists.</p>
    </div>
  </body>
</html>
"""


def test_parse_week_rows_expands_track_sessions() -> None:
    rows = _parse_week_rows(HTML)

    assert len(rows) == 3
    assert rows[0]["title"] == "Summer Safari Camp - Junior Rangers: Elevating Ecosystems"
    assert rows[0]["start_date"] == "2026-05-26"
    assert rows[0]["end_date"] == "2026-05-29"
    assert rows[0]["ticket_url"].endswith("/76653")
    assert rows[1]["price_min"] == 400.0
    assert rows[2]["price_min"] == 425.0
    assert rows[2]["age_min"] == 12
    assert rows[2]["age_max"] == 14


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_week_rows(HTML)[0]
    record = _build_event_record(7, 11, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["title"].startswith("Summer Safari Camp - Junior Rangers")
