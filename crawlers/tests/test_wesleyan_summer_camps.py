from bs4 import BeautifulSoup

from sources.wesleyan_summer_camps import (
    _build_event_record,
    _parse_articles,
    _parse_date_segments,
    _parse_filter_maps,
    _parse_time_range,
)


WESLEYAN_HTML = """
<h1>2026 Summer Camp Offerings</h1>
<div class="fsElement">
  <h2>Filter by rising age or grade</h2>
  <div class="fsElementContent">
    <a data-category-id="169" href="#">3-year-old to 4-year-old</a>
    <a data-category-id="164" href="#">1st</a>
    <a data-category-id="165" href="#">2nd</a>
    <a data-category-id="166" href="#">3rd</a>
    <a data-category-id="167" href="#">4th</a>
    <a data-category-id="168" href="#">Kindergarten</a>
    <a data-category-id="170" href="#">5th</a>
    <a data-category-id="171" href="#">6th</a>
    <a data-category-id="172" href="#">7th</a>
    <a data-category-id="173" href="#">8th</a>
  </div>
</div>
<div class="fsElement">
  <h2>Filter by camp category</h2>
  <div class="fsElementContent">
    <a data-tag-id="107" href="#">Academic</a>
    <a data-tag-id="103" href="#">Athletic</a>
    <a data-tag-id="102" href="#">Day Camp</a>
    <a data-tag-id="104" href="#">Enrichment</a>
    <a data-tag-id="17" href="#">Fine Arts</a>
  </div>
</div>
<article class="fsStyleAutoclear fsBoard-48 fsCategory-170 fsCategory-171 fsCategory-172 fsCategory-173 fsTag-103 icon-volleyball">
  <div class="fsTitle">Advanced Volleyball</div>
  <div class="fsSummary">
    <p>Time: 1 p.m. to 4 p.m.<br/>Dates: July 6-10<br/>Instructor: Coach Connor</p>
  </div>
  <a class="fsPostLink fsReadMoreLink" data-slug="summer-camps-2026/post/advanced-volleyball" href="#">Read More</a>
</article>
<article class="fsStyleAutoclear fsBoard-48 fsCategory-164 fsCategory-165 fsCategory-166 fsTag-107 icon-apple">
  <div class="fsTitle">Orton Gillingham (2 weeks)</div>
  <div class="fsSummary">
    <p>Time: 9 a.m. to 12 p.m.<br/>Dates: June 1-5, June 8-12<br/>Instructors: Cooper &amp; Jensen</p>
  </div>
  <a class="fsPostLink fsReadMoreLink" data-slug="summer-camps-2026/post/orton-gillingham" href="#">Read More</a>
</article>
<article class="fsStyleAutoclear fsBoard-48 fsCategory-169 fsTag-102 icon-block">
  <div class="fsTitle">Junior Wolves Day Camp</div>
  <div class="fsSummary">
    <p>Time: 9 a.m. to 4 p.m.<br/>Dates: June 1-5, June 8-12, July 14-18<br/>Instructor: Mills</p>
  </div>
  <a class="fsPostLink fsReadMoreLink" data-slug="summer-camps-2026/post/junior-wolves-day-camp" href="#">Read More</a>
</article>
"""


def test_parse_filter_maps_extracts_grade_and_category_labels() -> None:
    grade_map, category_map = _parse_filter_maps(
        BeautifulSoup(WESLEYAN_HTML, "html.parser")
    )

    assert grade_map["169"] == "3-year-old to 4-year-old"
    assert grade_map["173"] == "8th"
    assert category_map["103"] == "Athletic"
    assert category_map["17"] == "Fine Arts"


def test_parse_date_segments_merges_true_multiweek_titles() -> None:
    assert _parse_date_segments("July 6-10", 2026, "Advanced Volleyball") == [
        ("2026-07-06", "2026-07-10")
    ]
    assert _parse_date_segments(
        "June 1-5, June 8-12",
        2026,
        "Orton Gillingham (2 weeks)",
    ) == [("2026-06-01", "2026-06-12")]
    assert _parse_date_segments(
        "June 1-5, June 8-12, July 14-18",
        2026,
        "Junior Wolves Day Camp",
    ) == [
        ("2026-06-01", "2026-06-05"),
        ("2026-06-08", "2026-06-12"),
        ("2026-07-14", "2026-07-18"),
    ]


def test_parse_time_range_normalizes_clock_values() -> None:
    assert _parse_time_range("9 a.m. to 12 p.m.") == ("09:00", "12:00")
    assert _parse_time_range("1 p.m. to 4 p.m.") == ("13:00", "16:00")


def test_parse_articles_expands_sessions_and_age_ranges() -> None:
    rows = _parse_articles(BeautifulSoup(WESLEYAN_HTML, "html.parser"))

    assert len(rows) == 5

    volleyball = rows[0]
    orton = rows[1]
    junior = rows[2]

    assert volleyball["title"] == "Advanced Volleyball"
    assert volleyball["start_date"] == "2026-07-06"
    assert volleyball["start_time"] == "13:00"
    assert volleyball["class_category"] == "fitness"
    assert "sports" in volleyball["tags"]
    assert volleyball["age_min"] == 10
    assert volleyball["age_max"] == 14

    assert orton["start_date"] == "2026-06-01"
    assert orton["end_date"] == "2026-06-12"
    assert orton["class_category"] == "education"
    assert orton["age_min"] == 6
    assert orton["age_max"] == 9

    assert junior["title"] == "Junior Wolves Day Camp"
    assert junior["age_min"] == 3
    assert junior["age_max"] == 4
    assert junior["start_date"] == "2026-06-01"


def test_build_event_record_preserves_registration_and_program_shape() -> None:
    row = {
        "title": "Advanced Volleyball",
        "summary_text": "Time: 1 p.m. to 4 p.m. Dates: July 6-10 Instructor: Coach Connor",
        "time_text": "1 p.m. to 4 p.m.",
        "instructor_text": "Coach Connor",
        "grade_labels": ["5th", "6th", "7th", "8th"],
        "category_labels": ["Athletic"],
        "age_min": 10,
        "age_max": 14,
        "age_tags": ["elementary", "tween", "teen"],
        "start_time": "13:00",
        "end_time": "16:00",
        "source_url": "https://www.wesleyanschool.org/camps-clinics/summer-camp-offerings#/summer-camps-2026/post/advanced-volleyball",
        "class_category": "fitness",
        "start_date": "2026-07-06",
        "end_date": "2026-07-10",
        "tags": [
            "kids",
            "family-friendly",
            "educational",
            "seasonal",
            "rsvp-required",
            "elementary",
            "tween",
            "teen",
            "sports",
            "fitness",
        ],
    }

    record = _build_event_record(11, 21, row)

    assert record["title"] == "Advanced Volleyball"
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "fitness"
    assert record["ticket_url"] == "https://wesleyansummer.campbrainregistration.com/"
    assert record["start_time"] == "13:00"
    assert record["end_time"] == "16:00"
    assert (
        record["price_note"]
        == "Registration required. See CampBrain for current pricing."
    )
