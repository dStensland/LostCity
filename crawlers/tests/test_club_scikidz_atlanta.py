from sources.club_scikidz_atlanta import (
    _build_event_record,
    _normalize_location_key,
    _parse_age_range,
    _parse_camp_page,
    _parse_locations_page,
    _resolve_venue,
)


LOCATIONS_HTML = """
<p class="location-anchor"><a name="location-203"></a></p>
<div class="location-schedule">
  <h2>Clairmont Presbyterian Church-Decatur</h2>
  <div class="location-address">1994 Clairmont Rd Decatur, GA 30033</div>
  <div class="location-date-block">
    <div class="date-title"><h3>June 8</h3></div>
    <div class="age-group of5">
      <h3>Ages 4-6</h3>
      <ul>
        <li><a href="https://atlanta.clubscikidz.com/summer-camps/little-scientist/" title="Little Scientist">Little Scientist</a></li>
        <li><a href="https://atlanta.clubscikidz.com/summer-camps/mini-medical-school/" title="Mini Medical School">Mini Medical School</a></li>
      </ul>
    </div>
  </div>
</div>
<p class="location-anchor"><a name="location-201"></a></p>
<div class="location-schedule">
  <h2>St. James UMC- Atlanta</h2>
  <div class="location-address">4400 Peachtree Dunwoody Rd Atlanta, GA 30342</div>
</div>
"""


CAMP_HTML = """
<div class="entry-content">
  <h1>Little Scientist</h1>
  <h2>Age Group: Ages 4-6</h2>
  <h2>Course Description</h2>
  <p>This unique camp offers hands-on science experiments for young campers.</p>
  <p>Sample Projects: Rocketry, Glowing Firefly, Edible Oceans.</p>
  <h3>Cost: $425/week (Full Day 9-4pm) or $350/week (Half-Day 9-1pm)</h3>
  <a href="/camp-categories/nature-summer-camps/">Nature Summer Camps</a>
  <a href="/camp-categories/extreme-science-summer-camps/">Extreme Science Summer Camps</a>
</div>
<div class="camp-details-box">
  <p class="camp-duration-value">5 Days</p>
  <p class="camp-price-value">$425</p>
  <div id="little-scientist-group" class="sessions-group">
    <span>2026 Summer</span>
    <a target="_blank" href="https://campscui.active.com/orgs/clubscikidznorthatlanta/?season=3718738&session=68465937">6/8 2026 At Clairmont Presbyterian Church</a>
    <a target="_blank" href="https://campscui.active.com/orgs/clubscikidznorthatlanta/?season=3718738&session=68481237">7/6 2026 At St. James UMC/Buckhead</a>
  </div>
</div>
"""


def test_parse_locations_page_extracts_venues_and_concepts() -> None:
    from bs4 import BeautifulSoup

    venue_map, concept_urls = _parse_locations_page(
        BeautifulSoup(LOCATIONS_HTML, "html.parser")
    )

    assert "clairmont presbyterian" in venue_map
    assert venue_map["clairmont presbyterian"]["address"] == "1994 Clairmont Rd"
    assert venue_map["clairmont presbyterian"]["city"] == "Decatur"
    assert (
        "https://atlanta.clubscikidz.com/summer-camps/little-scientist/" in concept_urls
    )


def test_parse_camp_page_extracts_sessions_price_and_ages() -> None:
    from bs4 import BeautifulSoup

    camp = _parse_camp_page(
        BeautifulSoup(CAMP_HTML, "html.parser"),
        "https://atlanta.clubscikidz.com/summer-camps/little-scientist/",
    )

    assert camp is not None
    assert camp["title"] == "Little Scientist"
    assert camp["age_min"] == 4
    assert camp["age_max"] == 6
    assert camp["price_min"] == 350.0
    assert camp["price_max"] == 425.0
    assert camp["duration_days"] == 5
    assert camp["schedule_start_time"] == "09:00"
    assert camp["schedule_end_time"] == "16:00"
    assert len(camp["sessions"]) == 2
    assert camp["sessions"][0]["start_date"] == "2026-06-08"
    assert camp["sessions"][0]["session_id"] == "68465937"


def test_resolve_venue_handles_club_scikidz_location_aliases() -> None:
    venue_map = {
        _normalize_location_key("Clairmont Presbyterian Church-Decatur"): {
            "name": "Clairmont Presbyterian Church-Decatur"
        },
        _normalize_location_key("St. James UMC- Atlanta"): {
            "name": "St. James UMC- Atlanta"
        },
    }

    assert (
        _resolve_venue("Clairmont Presbyterian Church", venue_map)["name"]
        == "Clairmont Presbyterian Church-Decatur"
    )
    assert (
        _resolve_venue("St. James UMC/Buckhead", venue_map)["name"]
        == "St. James UMC- Atlanta"
    )


def test_build_event_record_uses_session_id_for_hash_and_dates() -> None:
    camp = {
        "title": "Little Scientist",
        "age_text": "Age Group: Ages 4-6",
        "age_min": 4,
        "age_max": 6,
        "age_tags": ["preschool", "elementary"],
        "price_min": 350.0,
        "price_max": 425.0,
        "price_note": "Cost: $425/week (Full Day 9-4pm) or $350/week (Half-Day 9-1pm)",
        "description": "Hands-on science camp.",
        "categories": ["Nature Summer Camps"],
        "camp_url": "https://atlanta.clubscikidz.com/summer-camps/little-scientist/",
    }
    session = {
        "session_id": "68465937",
        "start_date": "2026-06-08",
        "end_date": "2026-06-12",
        "location_name": "Clairmont Presbyterian Church",
        "registration_url": "https://campscui.active.com/orgs/clubscikidznorthatlanta/?season=3718738&session=68465937",
        "session_label": "6/8 2026 At Clairmont Presbyterian Church",
    }

    record = _build_event_record(
        source_id=1,
        venue_id=2,
        venue_name="Clairmont Presbyterian Church-Decatur",
        camp=camp,
        session=session,
    )

    assert (
        record["title"] == "Little Scientist at Clairmont Presbyterian Church-Decatur"
    )
    assert record["start_date"] == "2026-06-08"
    assert record["end_date"] == "2026-06-12"
    assert record["start_time"] == "09:00"
    assert record["end_time"] == "16:00"
    assert record["is_all_day"] is False
    assert record["ticket_url"].endswith("session=68465937")
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"


def test_parse_age_range_returns_expected_tags() -> None:
    age_min, age_max, tags = _parse_age_range("Age Group: Ages 13-15")
    assert age_min == 13
    assert age_max == 15
    assert "teen" in tags
