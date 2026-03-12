from datetime import date

from sources.gas_south import parse_event_cards, parse_date_label, should_skip_dedicated_team_event


def test_parse_date_label_handles_single_day_and_ranges() -> None:
    assert parse_date_label("March 12 2026", today=date(2026, 3, 11)) == ("2026-03-12", None)
    assert parse_date_label("March 12 to March 14 2026", today=date(2026, 3, 11)) == (
        "2026-03-12",
        "2026-03-14",
    )


def test_parse_event_cards_extracts_non_team_district_events() -> None:
    html = """
    <div class="eventItem entry featured team arena clearfix">
      <div class="info clearfix">
        <div class="date" aria-label="March 11 2026"><span class="time">10:30AM</span></div>
        <h3 class="title"><a href="https://www.gassouthdistrict.com/events/detail/atlanta-gladiators-140">Atlanta Gladiators</a></h3>
        <h4 class="tagline">vs. Florida Everblades</h4>
        <div class="meta"><h5 class="location">Gas South Arena®</h5></div>
      </div>
    </div>
    <div class="eventItem entry alt featured convention-center clearfix">
      <div class="thumb"><img src="https://www.gassouthdistrict.com/assets/img/event.png" /></div>
      <div class="info clearfix">
        <div class="date" aria-label="March 12 to March 14 2026"></div>
        <h3 class="title"><a href="https://www.gassouthdistrict.com/events/detail/original-sewing-and-quilt-expo-2">Original Sewing &amp; Quilt Expo</a></h3>
        <div class="meta"><h5 class="location">Gas South Convention Center®</h5></div>
      </div>
    </div>
    <div class="eventItem entry alt featured theater clearfix">
      <div class="info clearfix">
        <div class="date" aria-label="March 12 2026"><span class="time">7:30PM</span></div>
        <h3 class="title"><a href="https://www.gassouthdistrict.com/events/detail/home-by-dark-9">Home By Dark featuring Tony Arata</a></h3>
        <div class="meta"><h5 class="location">Gas South Theater®</h5></div>
      </div>
    </div>
    """

    events = parse_event_cards(html, today=date(2026, 3, 11))

    assert events == [
        {
            "title": "Original Sewing & Quilt Expo",
            "location_label": "Gas South Convention Center®",
            "start_date": "2026-03-12",
            "end_date": "2026-03-14",
            "start_time": None,
            "end_time": None,
            "is_all_day": True,
            "detail_url": "https://www.gassouthdistrict.com/events/detail/original-sewing-and-quilt-expo-2",
            "image_url": "https://www.gassouthdistrict.com/assets/img/event.png",
            "description": None,
        },
        {
            "title": "Home By Dark featuring Tony Arata",
            "location_label": "Gas South Theater®",
            "start_date": "2026-03-12",
            "end_date": None,
            "start_time": "19:30",
            "end_time": None,
            "is_all_day": False,
            "detail_url": "https://www.gassouthdistrict.com/events/detail/home-by-dark-9",
            "image_url": None,
            "description": None,
        },
    ]


def test_should_skip_dedicated_team_event_detects_owned_team_feeds() -> None:
    assert should_skip_dedicated_team_event("Atlanta Gladiators")
    assert should_skip_dedicated_team_event("Atlanta Vibe")
    assert should_skip_dedicated_team_event("Georgia Swarm")
    assert not should_skip_dedicated_team_event("Original Sewing & Quilt Expo")
