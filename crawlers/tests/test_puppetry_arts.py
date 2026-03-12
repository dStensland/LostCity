from sources.puppetry_arts import (
    _extract_performances_json,
    _parse_performance_datetime,
    _parse_show_urls,
)


PERF_HTML = """
<html>
  <body>
    <div class="perf-json">
      {"performances":{
        "44723":{
          "Id":44723,
          "Description":"Tales of Edgar Allan Poe",
          "PerfDate":{"date":"2026-03-17 00:00:00.000000","timezone_type":1,"timezone":"-04:00"},
          "PerfTS":1773757800,
          "DateTimeString":"March 17, 10:30 AM",
          "InThePast":false,
          "BeforeToday":false,
          "ProductionSeason":43958,
          "generalPrice":20,
          "memberPrice":17,
          "generalZonePrices":{"40":20},
          "memberZonePrices":{"40":17},
          "seats":0
        }
      }}
    </div>
  </body>
</html>
"""


def test_extract_performances_json_reads_perf_json_container():
    performances = _extract_performances_json(PERF_HTML)

    assert "44723" in performances
    assert performances["44723"]["Description"] == "Tales of Edgar Allan Poe"
    assert performances["44723"]["generalPrice"] == 20


def test_parse_performance_datetime_uses_datetime_string():
    performance = _extract_performances_json(PERF_HTML)["44723"]

    start_date, start_time = _parse_performance_datetime(performance)

    assert start_date == "2026-03-17"
    assert start_time == "10:30"


def test_parse_show_urls_limits_results_to_archive_cards():
    html = """
    <html>
      <body>
        <nav>
          <a class="pmm-resource" href="https://puppet.org/programs/jim-henson-collection/">
            Jim Henson Collection
          </a>
        </nav>
        <div class="puppets-archive__grid">
          <article class="card card-events">
            <div class="wp-block-button">
              <a class="wp-block-button__link" href="https://puppet.org/programs/pete-the-cat/">
                Buy Tickets
              </a>
            </div>
          </article>
          <article class="card card-events">
            <div class="wp-block-button">
              <a class="wp-block-button__link" href="https://puppet.org/programs/the-tales-of-edgar-allan-poe/">
                Buy Tickets
              </a>
            </div>
          </article>
        </div>
      </body>
    </html>
    """

    urls = _parse_show_urls(html, "https://puppet.org/programs/?type=puppet-show")

    assert urls == [
        "https://puppet.org/programs/pete-the-cat/",
        "https://puppet.org/programs/the-tales-of-edgar-allan-poe/",
    ]
