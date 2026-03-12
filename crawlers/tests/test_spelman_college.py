from datetime import datetime

from sources.spelman_college import (
    _museum_hash_candidates,
    categorize_event,
    extract_museum_exhibitions,
    normalize_ongoing_exhibit_dates,
    parse_spelman_museum_date_range,
)


def test_parse_spelman_museum_date_range_handles_abbreviated_range():
    start_date, end_date = parse_spelman_museum_date_range("Oct. 17, 2025 - May 1, 2026")

    assert start_date == "2025-10-17"
    assert end_date == "2026-05-01"


def test_parse_spelman_museum_date_range_handles_open_until_copy():
    text = (
        "Away with the Tides will open to the public on Friday, March 27, 2026, "
        "and will be on view until September 5, 2026."
    )

    start_date, end_date = parse_spelman_museum_date_range(text)

    assert start_date == "2026-03-27"
    assert end_date == "2026-09-05"


def test_normalize_ongoing_exhibit_dates_advances_open_show(monkeypatch):
    class MockDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 3, 9, 12, 0, 0)

    monkeypatch.setattr("sources.spelman_college.datetime", MockDatetime)

    start_date, end_date = normalize_ongoing_exhibit_dates("2025-10-17", "2026-05-01")

    assert start_date == "2026-03-09"
    assert end_date == "2026-05-01"


def test_museum_hash_candidates_include_colon_and_comma_variants():
    hashes = _museum_hash_candidates("Calida Rawles: Away with the Tides", "2026-03-27")

    assert hashes
    assert len(hashes) == 1


def test_extract_museum_exhibitions_parses_live_style_blocks():
    html = """
    <html><body>
      <div class="image-content-container">
        <div class="image-container" style="background-image: url(_museum-images/repossessions.jpg);"></div>
        <div class="content-container">
          <div class="image-content">
            <h3><strong>Repossessions</strong><br/><strong>Oct. 17, 2025 - May 1, 2026</strong></h3>
            <p><em><a href="art-and-events/exhibitions/repossessions.html">Repossessions</a></em> presents the work of seven Black artists commissioned by The Reparations Project.</p>
          </div>
        </div>
      </div>
      <div class="image-content-container">
        <div class="image-container" style="background-image: url(_museum-images/calida.jpg);"></div>
        <div class="content-container">
          <div class="image-content">
            <h3>Calida Rawles: Away with the Tides</h3>
            <p>Away with the Tides will open to the public on <strong>Friday, March 27, 2026</strong>, and will be on view until September 5, 2026.</p>
            <div class="content-cta-container">
              <div class="content-cta">
                <a class="content-cta-item" href="art-and-events/exhibitions/calida-rawles.html">Learn More</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body></html>
    """

    exhibitions = extract_museum_exhibitions(html)

    assert len(exhibitions) == 2
    assert exhibitions[0]["title"] == "Repossessions"
    assert exhibitions[0]["source_url"] == "https://museum.spelman.edu/art-and-events/exhibitions/repossessions.html"
    assert exhibitions[0]["ticket_url"] == "https://museum.spelman.edu/art-and-events/exhibitions/repossessions.html"
    assert exhibitions[1]["title"] == "Calida Rawles: Away with the Tides"
    assert exhibitions[1]["end_date"] == "2026-09-05"
    assert exhibitions[1]["ticket_url"] == "https://museum.spelman.edu/art-and-events/exhibitions/calida-rawles.html"


def test_categorize_event_uses_valid_theater_category():
    category, subcategory, venue = categorize_event(
        {"filter1": ["Arts and Entertainment"]},
        "Spelman Theater and Performance Presents Single Black Female",
    )

    assert category == "theater"
    assert subcategory == "play"
    assert venue["slug"] == "spelman-college"
