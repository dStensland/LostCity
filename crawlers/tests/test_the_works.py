from bs4 import BeautifulSoup

from sources.the_works import _get_source_config, _parse_photo_view_datetime, _resolve_venue


def test_get_source_config_uses_the_works_slug_as_primary_venue():
    config = _get_source_config("the-works-atl")

    assert config["primary_venue"]["slug"] == "the-works-atl"
    assert config["events_url"] == "https://theworksatl.com/events/"


def test_get_source_config_uses_food_works_slug_as_primary_venue():
    config = _get_source_config("chattahoochee-food-works")

    assert config["primary_venue"]["slug"] == "chattahoochee-food-works"
    assert config["events_url"] == "https://chattahoocheefoodworks.com/events/"


def test_resolve_venue_maps_food_works_child_venue_when_present():
    config = _get_source_config("the-works-atl")

    resolved = _resolve_venue(
        "Chattahoochee Food Works",
        config["primary_venue"],
        config["sub_venues"],
    )

    assert resolved["slug"] == "chattahoochee-food-works"


def test_resolve_venue_defaults_to_source_primary_venue():
    config = _get_source_config("the-works-atl")

    resolved = _resolve_venue(
        "Live Jazz Fridays",
        config["primary_venue"],
        config["sub_venues"],
    )

    assert resolved["slug"] == "the-works-atl"


def test_parse_photo_view_datetime_sets_same_day_end_time():
    soup = BeautifulSoup(
        """
        <article>
          <time class="tribe-events-pro-photo__event-date-tag-datetime" datetime="2026-03-12"></time>
          <div class="tribe-events-pro-photo__event-datetime">
            <time datetime="18:00">6:00 pm</time>
            <span>-</span>
            <time datetime="21:00">9:00 pm</time>
          </div>
        </article>
        """,
        "html.parser",
    )
    article = soup.find("article")
    dt_el = article.find("div", class_="tribe-events-pro-photo__event-datetime")
    date_tag = article.find("time", class_="tribe-events-pro-photo__event-date-tag-datetime")

    start_date, start_time, end_date, end_time = _parse_photo_view_datetime(article, dt_el, date_tag)

    assert start_date == "2026-03-12"
    assert start_time == "18:00"
    assert end_date == "2026-03-12"
    assert end_time == "21:00"
