from sources.civil_rights_center import (
    _extract_detail_data,
    _extract_listings,
    _parse_time_component,
)


class _FakeResponse:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self) -> None:
        return None


class _FakeSession:
    def __init__(self, responses):
        self._responses = responses

    def get(self, url: str, timeout: int = 30):
        return _FakeResponse(self._responses[url])


def test_parse_time_component_handles_am_pm():
    assert _parse_time_component("10:00 am") == "10:00"
    assert _parse_time_component("7:00 pm") == "19:00"


def test_extract_listings_parses_event_rows_only():
    html = """
    <html><body>
      <div>Select date.</div>
      <ul>
        <li class="tribe-events-calendar-list__event-row">
          <div class="tribe-events-calendar-list__event-wrapper">
            <article>
              <div class="tribe-events-calendar-list__event-datetime-wrapper">
                <time class="tribe-events-calendar-list__event-datetime" datetime="2026-03-01">
                  <span class="tribe-event-date-start">March 1</span> -
                  <span class="tribe-event-date-end">March 31</span>
                </time>
              </div>
              <h4>
                <a class="tribe-events-calendar-list__event-title-link" href="/events/womens-history-month-at-the-center/">
                  Women’s History Month at the Center
                </a>
              </h4>
              <div class="tribe-events-calendar-list__event-description">
                <p>Month-long museum programming.</p>
              </div>
            </article>
          </div>
        </li>
      </ul>
    </body></html>
    """
    session = _FakeSession(
        {"https://www.civilandhumanrights.org/events/list/?posts_per_page=13": html}
    )

    listings = _extract_listings(session)

    assert len(listings) == 1
    assert listings[0]["title"] == "Women’s History Month at the Center"
    assert listings[0]["start_date"] == "2026-03-01"
    assert listings[0]["end_date"] == "2026-03-31"


def test_extract_detail_data_prefers_registration_link_and_explicit_dates():
    html = """
    <html><body>
      <div class="tribe-events-single-event-description">
        <p>This Saturday, bring the whole family.</p>
      </div>
      <div class="tribe-events-event-image">
        <img data-src="https://example.com/event.png" />
      </div>
      <div class="tribe-events-single-section tribe-events-event-meta">
        <div class="tribe-events-meta-group tribe-events-meta-group-details">
          <dl>
            <dt class="tribe-events-start-date-label">Date:</dt>
            <dd><abbr class="tribe-events-start-date" title="2026-03-14">March 14</abbr></dd>
            <dt class="tribe-events-start-time-label">Time:</dt>
            <dd><div class="tribe-events-start-time">10:00 am - 4:00 pm</div></dd>
          </dl>
        </div>
      </div>
      <a href="https://tickets.example.com/registration">Registration Here</a>
      <a href="https://tickets.example.com/buy">Buy Tickets</a>
    </body></html>
    """
    session = _FakeSession({"https://example.com/detail": html})

    detail = _extract_detail_data(session, "https://example.com/detail")

    assert detail["start_date"] == "2026-03-14"
    assert detail["start_time"] == "10:00"
    assert detail["end_time"] == "16:00"
    assert detail["image_url"] == "https://example.com/event.png"
    assert detail["ticket_url"] == "https://tickets.example.com/registration"
