from datetime import date

from sources.cobb_galleria import parse_date_parts, parse_event_cards


def test_parse_date_parts_handles_same_month_and_cross_month_ranges() -> None:
    assert parse_date_parts("March", "20-22", "2026") == ("2026-03-20", "2026-03-22")
    assert parse_date_parts("July", "31-02", "2026") == ("2026-07-31", "2026-08-02")
    assert parse_date_parts("May", "16", "2026") == ("2026-05-16", None)


def test_parse_event_cards_extracts_public_expo_cards_and_skips_dedicated_sources() -> None:
    html = """
    <div class="item" data-event-id="7190">
      <div class="image" style="background-image: url(https://cobbgalleria.com/home-show.jpg);"></div>
      <div class="details">
        <div class="date">
          <div class="month">March</div>
          <div class="day">20-22</div>
          <div class="year">2026</div>
        </div>
        <div class="text">
          <div class="title"><h4>Atlanta Home Show</h4></div>
          <div class="excerpt">
            <p><strong>Friday 10 a.m. to 6 p.m.</strong></p>
            <p>The Atlanta Home Show is a vibrant marketplace for home products and services.</p>
            <a href="https://www.atlantahomeshow.com/">atlantahomeshow.com/</a>
          </div>
        </div>
      </div>
    </div>
    <div class="item" data-event-id="7223">
      <div class="details">
        <div class="date">
          <div class="month">July</div>
          <div class="day">31-02</div>
          <div class="year">2026</div>
        </div>
        <div class="text">
          <div class="title"><h4>Southern-Fried Gaming Expo</h4></div>
          <div class="excerpt"><p>Dedicated source already owns this.</p></div>
        </div>
      </div>
    </div>
    <div class="item" data-event-id="7901">
      <div class="details">
        <div class="date">
          <div class="month">March</div>
          <div class="day">28-29</div>
          <div class="year">2026</div>
        </div>
        <div class="text">
          <div class="title"><h4>Front Row Card Show</h4></div>
          <div class="excerpt">
            <p>11 a.m. to 5 p.m.</p>
            <p>Dedicated organizer page should own this.</p>
          </div>
        </div>
      </div>
    </div>
    <div class="item" data-event-id="7842">
      <div class="details">
        <div class="date">
          <div class="month">May</div>
          <div class="day">16</div>
          <div class="year">2026</div>
        </div>
        <div class="text">
          <div class="title"><h4>IMPORTEXPO CAR SHOW</h4></div>
          <div class="excerpt">
            <p>5 to 10 p.m.</p>
            <p>ATL's modified car show - Dope Cars. Music + Good Vibes!</p>
            <a href="http://www.importexpo.net">importexpo.net</a>
          </div>
        </div>
      </div>
    </div>
    """

    events = parse_event_cards(html, today=date(2026, 3, 11))

    assert events == []
