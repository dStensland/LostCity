from datetime import date

from sources.americasmart import parse_date_line, parse_market_sections, parse_time_line


def test_parse_date_line_handles_same_month_and_cross_month_ranges() -> None:
    assert parse_date_line("Tuesday, June 9 – Sunday, June 14, 2026") == ("2026-06-09", "2026-06-14")
    assert parse_date_line("Monday, March 30 - Thursday, April 2, 2026") == ("2026-03-30", "2026-04-02")


def test_parse_time_line_handles_hours_with_minutes_and_footnotes() -> None:
    assert parse_time_line("9 a.m. – 5:30 p.m.*") == ("09:00", "17:30")
    assert parse_time_line("9 a.m. – 6 p.m.") == ("09:00", "18:00")


def test_parse_market_sections_extracts_current_official_market_windows() -> None:
    html = """
    <div class="imc-section--inner-content">
      <div class="h-wrap"><h2>SUMMER MARKET 2026</h2></div>
      <div class="imc-rich-text">
        <p><strong>Showrooms:</strong><br>Tuesday, June 9 – Sunday, June 14, 2026<br>9 a.m. – 6 p.m.</p>
        <p><strong>Temporaries:</strong><br>Tuesday, June 9 – Saturday, June 13, 2026<br>9 a.m. – 5:30 p.m.*</p>
      </div>
      <a href="https://www.xpressreg.net/register/AMJU0626/start.asp?foo=bar">REGISTRATION</a>
    </div>
    <div class="imc-section--inner-content">
      <div class="h-wrap"><a href="https://www.americasmart.com/Markets/Spring-Market?foo=bar"><h2>SPRING MARKET</h2></a></div>
      <div class="imc-rich-text">
        <p>Gift &amp; Home</p>
        <p><strong>Showrooms:</strong><br>Tuesday, March 3 – Thursday, March 5, 2026<br>9 a.m. – 6 p.m.</p>
      </div>
      <a href="https://www.xpressreg.net/register/AMSP0326/start.asp?foo=bar">REGISTER NOW</a>
      <a href="https://www.americasmart.com/Markets/Spring-Market?foo=bar">LEARN MORE</a>
    </div>
    <div class="imc-section--inner-content">
      <div class="h-wrap"><a href="https://www.americasmart.com/Markets/Spring-Cash-and-Carry?foo=bar"><h2>SPRING CASH &amp; CARRY</h2></a></div>
      <div class="imc-rich-text">
        <p>Gift &amp; Home</p>
        <p><strong>Showrooms &amp; Temporaries:</strong><br>Monday, March 23 – Wednesday, March 25, 2026<br>9 a.m. – 5 p.m.*<br><strong>*All Temps close at 2 p.m. on Wednesday</strong></p>
      </div>
      <a href="https://www.xpressreg.net/register/CNCS0326/start.asp?foo=bar">REGISTER NOW</a>
      <a href="https://www.americasmart.com/Markets/Spring-Cash-and-Carry?foo=bar">LEARN MORE</a>
    </div>
    <div class="imc-section--inner-content">
      <div class="h-wrap"><a href="https://www.atlanta-apparel.com/Markets/Atlanta-Apparel/March?foo=bar"><h2>MARCH ATLANTA APPAREL</h2></a></div>
      <div class="imc-rich-text">
        <p>Apparel</p>
        <p><strong>Showrooms &amp; Temporaries:</strong><br>Monday, March 30 - Thursday, April 2, 2026<br>9 a.m. – 6 p.m.*<br><strong>*All Temporaries close at 2 p.m. on Thursday</strong></p>
      </div>
      <a href="https://www.xpressreg.net/register/AAAP0426/landing.asp?sc=apparel">REGISTER NOW</a>
      <a href="https://www.atlanta-apparel.com/Markets/Atlanta-Apparel/March?foo=bar">LEARN MORE</a>
    </div>
    """

    events = parse_market_sections(html, today=date(2026, 3, 11))

    assert events == [
        {
            "title": "Atlanta Market Summer 2026",
            "description": "Atlanta Market Summer 2026 is the flagship AmericasMart wholesale market for gift, home, and design buyers. Showrooms run June 9-14, 2026, with temporaries open June 9-13 and closing early on Saturday.",
            "start_date": "2026-06-09",
            "end_date": "2026-06-14",
            "start_time": "09:00",
            "end_time": "18:00",
            "is_all_day": False,
            "subcategory": "market",
            "tags": ["market", "trade-show", "gift", "home", "design", "wholesale", "downtown"],
            "source_url": "https://www.atlantamarket.com/Attend/Market-Dates-and-Hours",
            "ticket_url": "https://www.xpressreg.net/register/AMJU0626/start.asp",
            "image_url": None,
            "raw_text": "SUMMER MARKET 2026 | Showrooms: | Tuesday, June 9 – Sunday, June 14, 2026 | 9 a.m. – 6 p.m. | Temporaries: | Tuesday, June 9 – Saturday, June 13, 2026 | 9 a.m. – 5:30 p.m.*",
        },
        {
            "title": "Spring Cash & Carry",
            "description": "Spring Cash & Carry is AmericasMart's mid-season gift and home buying market with showrooms and temporaries in Downtown Atlanta.",
            "start_date": "2026-03-23",
            "end_date": "2026-03-25",
            "start_time": "09:00",
            "end_time": "17:00",
            "is_all_day": False,
            "subcategory": "market",
            "tags": ["market", "trade-show", "gift", "home", "wholesale", "downtown"],
            "source_url": "https://www.americasmart.com/Markets/Spring-Cash-and-Carry",
            "ticket_url": "https://www.xpressreg.net/register/CNCS0326/start.asp",
            "image_url": None,
            "raw_text": "SPRING CASH & CARRY | Gift & Home | Showrooms & Temporaries: | Monday, March 23 – Wednesday, March 25, 2026 | 9 a.m. – 5 p.m.* | *All Temps close at 2 p.m. on Wednesday",
        },
        {
            "title": "March Atlanta Apparel",
            "description": "March Atlanta Apparel is the official AmericasMart fashion buying market, bringing apparel showrooms and temporaries together in Downtown Atlanta.",
            "start_date": "2026-03-30",
            "end_date": "2026-04-02",
            "start_time": "09:00",
            "end_time": "18:00",
            "is_all_day": False,
            "subcategory": "market",
            "tags": ["market", "trade-show", "apparel", "fashion", "wholesale", "downtown"],
            "source_url": "https://www.atlanta-apparel.com/Markets/Atlanta-Apparel/March",
            "ticket_url": "https://www.xpressreg.net/register/AAAP0426/landing.asp",
            "image_url": None,
            "raw_text": "MARCH ATLANTA APPAREL | Apparel | Showrooms & Temporaries: | Monday, March 30 - Thursday, April 2, 2026 | 9 a.m. – 6 p.m.* | *All Temporaries close at 2 p.m. on Thursday",
        },
    ]
