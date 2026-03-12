from datetime import date

from sources.atlanta_vibe import (
    build_matchup_participants,
    parse_schedule_html,
    upcoming_supplemental_matches,
)


SAMPLE_HTML = """
<div class="event_list content_item">
  <div class="list">
    <div class="eventItem entry featured team arena clearfix">
      <div class="wrapper">
        <div class="thumb">
          <a href="/events/detail/atlanta-vibe-31" title="More Info for Atlanta Vibe ">
            <img alt="More Info for Atlanta Vibe " src="/assets/img/vibe-home.png"/>
          </a>
        </div>
        <div class="info clearfix">
          <div class="date" aria-label="March 13 2026">
            <span class="m-date__singleDate"><span class="m-date__month">Mar</span><span class="m-date__day">13</span></span>
            <span class="time">7:00PM</span>
          </div>
          <h3 class="title title-withTagline">
            <a href="https://www.gassouthdistrict.com/events/detail/atlanta-vibe-31" title="More Info">Atlanta Vibe</a>
          </h3>
          <h4 class="tagline">vs. Grand Rapids Rise</h4>
          <div class="meta">
            <h5 class="location">Gas South Arena®</h5>
            <h5 class="time"><span class="startlang">Event Starts</span><span class="start">7:00 PM</span></h5>
          </div>
          <div class="buttons">
            <a class="tickets onsalenow" href="https://www.ticketmaster.com/atlanta-vibe-vs-grand-rapids-rise/event/0E006365AB677976" target="_blank">Buy Tickets</a>
          </div>
        </div>
      </div>
    </div>
    <div class="eventItem entry featured team arena clearfix">
      <div class="wrapper">
        <div class="thumb">
          <a href="/events/detail/atlanta-vibe-29" title="More Info for Atlanta Vibe ">
            <img alt="More Info for Atlanta Vibe " src="/assets/img/vibe-past.png"/>
          </a>
        </div>
        <div class="info clearfix">
          <div class="date" aria-label="February 1 2026">
            <span class="m-date__singleDate"><span class="m-date__month">Feb</span><span class="m-date__day">1</span></span>
          </div>
          <h3 class="title title-withTagline">
            <a href="https://www.gassouthdistrict.com/events/detail/atlanta-vibe-29" title="More Info">Atlanta Vibe</a>
          </h3>
          <h4 class="tagline">vs. San Diego Mojo</h4>
          <div class="meta">
            <h5 class="location">Gas South Arena®</h5>
            <h5 class="time"><span class="startlang">Event Starts</span><span class="start">3:00 PM</span></h5>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
"""


def test_parse_schedule_html_extracts_future_home_matches():
    matches = parse_schedule_html(SAMPLE_HTML, today=date(2026, 3, 10))

    assert matches == [
        {
            "title": "Atlanta Vibe vs. Grand Rapids Rise",
            "opponent": "Grand Rapids Rise",
            "start_date": "2026-03-13",
            "start_time": "19:00",
            "source_url": "https://www.gassouthdistrict.com/events/detail/atlanta-vibe-31",
            "ticket_url": "https://www.ticketmaster.com/atlanta-vibe-vs-grand-rapids-rise/event/0E006365AB677976",
            "image_url": "https://www.gassouthdistrict.com/assets/img/vibe-home.png",
            "raw_text": "Mar | 13 | 7:00PM | Atlanta Vibe | vs. Grand Rapids Rise | Gas South Arena® | Event Starts | 7:00 PM | Buy Tickets",
        }
    ]


def test_upcoming_supplemental_matches_returns_gsu_dates():
    matches = upcoming_supplemental_matches(today=date(2026, 4, 1))

    assert matches == [
        {
            "title": "Atlanta Vibe vs. Omaha Supernovas",
            "opponent": "Omaha Supernovas",
            "start_date": "2026-04-02",
            "start_time": "19:00",
            "source_url": "https://provolleyball.com/news/2025/10/atlanta-vibe-unveils-2026-season-schedule",
            "ticket_url": "https://www.ticketmaster.com/atlanta-vibe-vs-omaha-supernovas-atlanta-georgia-04-02-2026/event/0E0063710344B648",
            "image_url": None,
            "raw_text": "Official 2026 Atlanta Vibe schedule article lists Omaha at GSU Convocation Center on Thursday, April 2, 2026.",
        },
        {
            "title": "Atlanta Vibe vs. Orlando Valkyries",
            "opponent": "Orlando Valkyries",
            "start_date": "2026-04-04",
            "start_time": "18:00",
            "source_url": "https://provolleyball.com/news/2025/10/atlanta-vibe-unveils-2026-season-schedule",
            "ticket_url": "https://www.ticketmaster.com/atlanta-vibe-vs-orlando-valkyries-atlanta-georgia-04-04-2026/event/0E006371065BB823",
            "image_url": None,
            "raw_text": "Official 2026 Atlanta Vibe schedule article lists Orlando at GSU Convocation Center on Saturday, April 4, 2026.",
        },
    ]


def test_build_matchup_participants_uses_home_team_and_opponent():
    assert build_matchup_participants("Grand Rapids Rise") == [
        {"name": "Atlanta Vibe", "role": "team", "billing_order": 1},
        {"name": "Grand Rapids Rise", "role": "team", "billing_order": 2},
    ]
