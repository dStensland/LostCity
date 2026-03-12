from sources.swift_summer_programs import (
    _build_event_record,
    _parse_date_range,
    _parse_program_page,
    _parse_time_range,
)


SUMMER_EXPLORATIONS_HTML = """
<main id="fsPageContent">
  <h1>Summer Explorations</h1>
  <div class="fsElementContent">
    <h2>Summer Explorations 2026</h2>
    <h2>Summer Explorations, a three-week program, provides rising kindergarten through sixth-grade students the opportunity to engage in programming focused on reading, writing, language arts, and math while filling their summer with enrichment and fun!</h2>
    <h2>Camp Information</h2>
    <ul>
      <li><strong>Dates:</strong> June 29-July 17, 2026</li>
      <li><strong>Times:</strong> 8:30 a.m. - 2:30 p.m.</li>
      <li><strong>Open to All:</strong> Rising kindergarten through sixth-grade students.</li>
      <li><strong>Location:</strong> Swift School - 300 Grimes Bridge Road, Roswell, GA 30075</li>
      <li><strong>2026 Costs:</strong>
        <ul>
          <li>$1995 Early Registration - before May 8, 2026</li>
          <li>$2195 Regular Registration</li>
          <li>$2295 Late Registration - after May 29, 2026</li>
        </ul>
      </li>
      <li><strong>Aftercare:</strong> Monday - Friday, 2:30 p.m. - 4:30 p.m., $125 per week</li>
    </ul>
    <p><a href="https://www.theswiftschool.org/fs/form-manager/view/e9ec50f3-f41e-45c2-8500-eccc63570bed">Register Here</a></p>
  </div>
</main>
"""

MATH_HTML = """
<main id="fsPageContent">
  <h1>Multisensory Math Summer Clinic</h1>
  <div class="fsElementContent">
    <h5>Swift's Multisensory Math Clinic provides a unique two-week program designed to:</h5>
    <h2><strong>Register Today!</strong></h2>
    <p><strong>Dates:</strong> June 1 - June 12, 2026<br />
    <strong>Cost:</strong> $900<br />
    <strong>Time:</strong></p>
    <ul>
      <li>Rising 1st &amp; 2nd Graders - 8:00 AM - 9:30 AM</li>
      <li>Rising 3rd &amp; 4th Graders - 10:00 AM - 11:30 AM</li>
      <li>Rising 5th &amp; 6th Graders - 12:00 PM - 1:30 PM</li>
    </ul>
    <p>Spaces are limited to 6 students per session.</p>
    <p><a href="https://www.theswiftschool.org/fs/form-manager/view/a17ead8c-6aa1-4519-91bb-8b45825f9ab1">Register for Swift's Multisensory Math Clinic</a></p>
  </div>
</main>
"""

SWIFT_SKILLS_HTML = """
<main id="fsPageContent">
  <h1>Swift Skills: Building Brains and Bodies</h1>
  <div class="fsElementContent">
    <h2>Join us for an engaging summer experience that builds essential life skills through fun, hands-on activities!</h2>
    <h2>Camp Information</h2>
    <ul>
      <li><strong>Dates:</strong> June 8 - June 18, 2026</li>
      <li><strong>Times:</strong> 8:30 a.m. - 2:30 p.m.</li>
      <li><strong>Aftercare:</strong> 2:30 p.m. - 5:00 p.m.</li>
      <li><strong>Open to:</strong> Rising Kindergarten through eighth grade students</li>
      <li><strong>Location:</strong> Swift School - 300 Grimes Bridge Road, Roswell, GA 30075</li>
    </ul>
    <p><strong>Cost:</strong> $1330 for two weeks<br/>$125 per week for aftercare (2:30 p.m. - 5:00 p.m.)</p>
    <p><a href="https://www.theswiftschool.org/fs/form-manager/view/6dea412e-3450-4154-b070-0752ca9956ab">Register for Swift Skills</a></p>
  </div>
</main>
"""


def test_parse_date_and_time_ranges() -> None:
    assert _parse_date_range("June 29-July 17, 2026") == ("2026-06-29", "2026-07-17")
    assert _parse_date_range("June 8 - June 18, 2026") == ("2026-06-08", "2026-06-18")
    assert _parse_time_range("8:30 a.m. - 2:30 p.m.") == ("08:30", "14:30")


def test_parse_program_page_handles_summer_explorations() -> None:
    rows = _parse_program_page(
        SUMMER_EXPLORATIONS_HTML,
        "https://www.theswiftschool.org/programs/summer-programs/summerexplorations",
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "Summer Explorations"
    assert row["start_date"] == "2026-06-29"
    assert row["end_date"] == "2026-07-17"
    assert row["price_min"] == 1995.0
    assert row["price_max"] == 2295.0
    assert row["age_min"] == 5
    assert row["age_max"] == 11
    assert row["ticket_url"].endswith("e9ec50f3-f41e-45c2-8500-eccc63570bed")


def test_parse_program_page_expands_math_grade_bands() -> None:
    rows = _parse_program_page(
        MATH_HTML,
        "https://www.theswiftschool.org/programs/summer-programs/multisensory-math",
    )

    assert len(rows) == 3
    assert (
        rows[0]["title"] == "Multisensory Math Summer Clinic (Rising 1st & 2nd Graders)"
    )
    assert rows[0]["start_time"] == "08:00"
    assert rows[0]["end_time"] == "09:30"
    assert rows[0]["age_min"] == 6
    assert rows[0]["age_max"] == 7
    assert rows[2]["start_time"] == "12:00"
    assert rows[2]["end_time"] == "13:30"


def test_parse_program_page_handles_swift_skills() -> None:
    rows = _parse_program_page(
        SWIFT_SKILLS_HTML,
        "https://www.theswiftschool.org/programs/summer-programs/swift-skills",
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "Swift Skills: Building Brains and Bodies"
    assert row["start_date"] == "2026-06-08"
    assert row["end_date"] == "2026-06-18"
    assert row["price_min"] == 1330.0
    assert row["price_max"] == 1330.0
    assert row["age_min"] == 5
    assert row["age_max"] == 13


def test_build_event_record_preserves_swift_registration() -> None:
    row = {
        "title": "Summer Explorations",
        "description": "Three-week academic enrichment program.",
        "start_date": "2026-06-29",
        "end_date": "2026-07-17",
        "start_time": "08:30",
        "end_time": "14:30",
        "age_min": 5,
        "age_max": 11,
        "tags": [
            "kids",
            "family-friendly",
            "educational",
            "seasonal",
            "rsvp-required",
            "elementary",
        ],
        "class_category": "education",
        "price_min": 1995.0,
        "price_max": 2295.0,
        "price_note": "$1995 early, $2195 regular, $2295 late. Aftercare: Monday - Friday, 2:30 p.m. - 4:30 p.m., $125 per week.",
        "ticket_url": "https://www.theswiftschool.org/fs/form-manager/view/e9ec50f3-f41e-45c2-8500-eccc63570bed",
        "source_url": "https://www.theswiftschool.org/programs/summer-programs/summerexplorations",
    }

    record = _build_event_record(13, 23, row)

    assert record["title"] == "Summer Explorations"
    assert record["ticket_url"].endswith("e9ec50f3-f41e-45c2-8500-eccc63570bed")
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["price_min"] == 1995.0
    assert record["price_max"] == 2295.0
