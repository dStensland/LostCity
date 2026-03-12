from sources._myrec_base import (
    _build_event_record,
    _choose_ticket_url,
    _parse_age_range,
    _parse_listing_page,
    _parse_price_text,
    _parse_program_detail,
    is_family_relevant_session,
)


LISTING_HTML = """
<div class="category">
  <div class="category-name"><a href="default.aspx?CategoryID=1540&type=activities">Sports Camps</a></div>
  <ul>
    <li><a href="program_details.aspx?ProgramID=29918" name="Baseball Camp">Baseball Camp</a></li>
    <li><a href="program_details.aspx?ProgramID=29917" name="Basketball Camp">Basketball Camp</a></li>
  </ul>
</div>
<div class="category">
  <div class="category-name"><a href="default.aspx?CategoryID=1541&type=activities">Other Camps</a></div>
  <ul>
    <li><a href="program_details.aspx?ProgramID=29910" name="Chess Camp">Chess Camp</a></li>
  </ul>
</div>
"""


DETAIL_HTML = """
<span id="Content_lblProgramName">Baseball Camp</span>
<div id="Content_lblDescription">
  Head Varsity Baseball Coach Mike Strickland will lead both camp sessions.
</div>
<table id="no-more-tables">
  <tbody>
    <tr class="spc">
      <td colspan="7"><a name="144246"></a></td>
    </tr>
    <tr class="center nobord def">
      <td data-title="Register" rowspan="2">
        <a href="/info/household/login.aspx?ProgramID=29918&amp;aID=144246">Log In</a>
      </td>
      <td data-title="Activity"><b>Boys Baseball Camp</b></td>
      <td data-title="Ages">9y - 14y</td>
      <td data-title="Grades">N/A</td>
      <td data-title="Days">MTuWThF</td>
      <td data-title="Date/Time">
        <a href="javascript: EventDates(29918,20797,144246)">06/22/2026 - 06/26/2026<br/>09:00 AM - 02:00 PM</a>
        <br/>
        <a href="/info/facilities/details.aspx?ActivityID=144246">Marist School</a>
      </td>
      <td data-title="Fees">$280.00 Res, $280.00 Non-Res</td>
    </tr>
    <tr class="notes def">
      <td colspan="5">Bring baseball pants and cleats each day.</td>
      <td colspan="1"></td>
    </tr>
  </tbody>
</table>
"""


CHAMBLEE_DETAIL_HTML = """
<span id="Content_lblProgramName">Snapology STEAM Programs</span>
<div id="Content_lblDescription">
  SNAPOLOGY STEAM Programs at Keswick Park!
  <a href="https://embed.snapology.com/licensee/237/events/location">Register HERE!</a>
</div>
<table id="no-more-tables">
  <tbody>
    <tr class="spc">
      <td colspan="7"><a name="145001"></a></td>
    </tr>
    <tr class="center nobord def">
      <td data-title="Register" rowspan="2">Register at Snapology</td>
      <td data-title="Activity"><b>Snapology Camp: Spring Break 2026</b></td>
      <td data-title="Ages">5y - 11y</td>
      <td data-title="Grades">N/A</td>
      <td data-title="Days">MTuWThF</td>
      <td data-title="Date/Time">
        04/06/2026 - 04/10/2026<br/>09:00 AM - 04:00 PM<br/>
        <a href="/info/facilities/details.aspx?ActivityID=145001">Keswick Park - Keswick Building</a>
      </td>
      <td data-title="Fees">$300.00 Res, $350.00 Non-Res</td>
    </tr>
    <tr class="notes def">
      <td colspan="5"></td>
      <td colspan="1"></td>
    </tr>
  </tbody>
</table>
"""


def test_parse_listing_page_extracts_category_and_detail_urls() -> None:
    records = _parse_listing_page(
        LISTING_HTML,
        "https://maristschoolga.myrec.com/info/activities/default.aspx?type=activities",
    )

    assert len(records) == 3
    assert records[0]["category_name"] == "Sports Camps"
    assert records[0]["program_name"] == "Baseball Camp"
    assert records[0]["detail_url"] == (
        "https://maristschoolga.myrec.com/info/activities/program_details.aspx?ProgramID=29918"
    )


def test_parse_program_detail_extracts_structured_session_rows() -> None:
    detail = _parse_program_detail(
        DETAIL_HTML,
        "https://maristschoolga.myrec.com/info/activities/program_details.aspx?ProgramID=29918",
        "https://maristschoolga.myrec.com",
    )

    assert detail["program_name"] == "Baseball Camp"
    assert "Mike Strickland" in detail["description_text"]
    assert detail["external_registration_url"] is None
    assert len(detail["sessions"]) == 1

    session = detail["sessions"][0]
    assert session["activity_id"] == "144246"
    assert session["activity_title"] == "Boys Baseball Camp"
    assert session["start_date"] == "2026-06-22"
    assert session["end_date"] == "2026-06-26"
    assert session["start_time"] == "09:00"
    assert session["end_time"] == "14:00"
    assert session["facility_name"] == "Marist School"
    assert session["registration_url"] == (
        "https://maristschoolga.myrec.com/info/household/login.aspx?ProgramID=29918&aID=144246"
    )
    assert "cleats" in session["note_text"].lower()


def test_parse_program_detail_extracts_external_registration_link() -> None:
    detail = _parse_program_detail(
        CHAMBLEE_DETAIL_HTML,
        "https://chambleega.myrec.com/info/activities/program_details.aspx?ProgramID=29977",
        "https://chambleega.myrec.com",
    )

    assert detail["external_registration_url"] == (
        "https://embed.snapology.com/licensee/237/events/location"
    )
    assert detail["sessions"][0]["registration_url"] is None


def test_choose_ticket_url_prefers_external_registration_when_row_is_external() -> None:
    session = {
        "register_text": "Register at Snapology",
        "registration_url": None,
    }

    assert (
        _choose_ticket_url(
            session,
            "https://embed.snapology.com/licensee/237/events/location",
            "https://chambleega.myrec.com/info/activities/program_details.aspx?ProgramID=29977",
        )
        == "https://embed.snapology.com/licensee/237/events/location"
    )


def test_parse_age_and_price_helpers_cover_myrec_shapes() -> None:
    age_min, age_max, tags = _parse_age_range("5y - 11y")
    assert age_min == 5
    assert age_max == 11
    assert "elementary" in tags

    price_min, price_max, is_free = _parse_price_text("$300.00 Res, $350.00 Non-Res")
    assert price_min == 300.0
    assert price_max == 350.0
    assert is_free is False

    adult_min, adult_max, adult_tags = _parse_age_range("18y and up")
    assert adult_min == 18
    assert adult_max is None
    assert adult_tags == []

    under_min, under_max, under_tags = _parse_age_range("4y 11m and under")
    assert under_min is None
    assert under_max == 4
    assert under_tags == ["preschool"]


def test_family_filter_skips_adult_rows_and_keeps_kid_programs() -> None:
    adult_session = {
        "activity_title": "Level 1/2 Class: Starts March 19th",
        "register_text": "Log In",
        "age_text": "18y and up",
    }
    kid_session = {
        "activity_title": "Snapology Camp: Spring Break 2026",
        "register_text": "Register at Snapology",
        "age_text": "5y - 11y",
    }

    assert (
        is_family_relevant_session(
            category_name="Athletics",
            program_name="Pickleball Clinics (Adult)",
            program_description="Pickleball skills lessons for adults.",
            session=adult_session,
            age_min=18,
            age_max=None,
        )
        is False
    )
    assert (
        is_family_relevant_session(
            category_name="Camps",
            program_name="Snapology STEAM Programs",
            program_description="STEAM camps and youth programs at Keswick Park.",
            session=kid_session,
            age_min=5,
            age_max=11,
        )
        is True
    )


def test_build_event_record_marks_rows_without_times_as_all_day() -> None:
    record = _build_event_record(
        source_id=1,
        venue_id=2,
        venue_name="Chamblee Parks and Recreation",
        category_name="Athletics",
        program_detail={
            "program_name": "Baseball & T-Ball (Youth)",
            "description_text": "Youth spring baseball league.",
            "detail_url": "https://example.com/program",
        },
        session={
            "activity_id": "123",
            "activity_title": "3-4 year old division",
            "age_text": "4y 11m and under",
            "grade_text": "N/A",
            "days_text": "Sa",
            "register_text": "Log In",
            "registration_url": "https://example.com/register",
            "fee_text": "$80.00 Res, $95.00 Non-Res",
            "note_text": "",
            "start_date": "2026-03-07",
            "end_date": "2026-04-25",
            "start_time": None,
            "end_time": None,
            "facility_name": "Keswick Park",
            "date_time_text": "03/07/2026 - 04/25/2026",
        },
    )

    assert record["is_all_day"] is True
    assert record["age_max"] == 4
