from bs4 import BeautifulSoup

from sources.pace_summer_programs import (
    _build_event_record,
    _parse_articles,
    _parse_date_range,
    _parse_time_range,
)


PACE_HTML = """
<div>
  <article class="fsStyleAutoclear fsBoard-268 fsCategory-378 fsTag-383 fsTag-386 fsTag-395 fsTag-397" data-post-id="8271">
    <ul class="fsCategories fsStyleInlineList">
      <li class="fsCategory">Middle School</li>
    </ul>
    <div class="fsTitle" id="fsArticle_60186_8271">
      <a class="fsPostLink" data-opens-in="popup" data-slug="week-4-june-22-26/post/glow-up-camp-diy-self-care-essentials" href="#">
        Glow Up Camp - DIY Self Care Essentials
      </a>
    </div>
    <div class="fsSummary">
      <p>
        <strong>Week:</strong> June 22-26<br/>
        <strong>Camp Time:</strong> 9 a.m. - 12 p.m.<br/>
        <strong>Cost:</strong> $350<br/>
        <strong>Vendor:</strong> Mrs. Julia Wilson
      </p>
    </div>
    <ul class="fsTags fsStyleInlineList">
      <li class="fsTag">Grade 05</li>
      <li class="fsTag">Grade 06</li>
      <li class="fsTag">Grade 07</li>
      <li class="fsTag">Grade 08</li>
    </ul>
    <a class="fsPostLink fsReadMoreLink" data-opens-in="popup" data-slug="week-4-june-22-26/post/glow-up-camp-diy-self-care-essentials" href="#">View Camp Description</a>
  </article>
  <article class="fsStyleAutoclear fsBoard-265 fsCategory-362 fsTag-380 fsTag-381 fsTag-382 fsTag-383" data-post-id="9000">
    <ul class="fsCategories fsStyleInlineList">
      <li class="fsCategory">Athletics</li>
    </ul>
    <div class="fsTitle">
      <a class="fsPostLink" data-slug="week-1-june-1-5/post/the-elementary-golf-experience" href="#">The Elementary Golf Experience</a>
    </div>
    <div class="fsSummary">
      <p>
        <strong>Week:</strong> June 1-5<br/>
        <strong>Camp Time:</strong> 9 a.m. - 12 p.m.<br/>
        <strong>Cost:</strong> $350<br/>
        <strong>Vendor:</strong> Elementary Golf
      </p>
    </div>
    <ul class="fsTags fsStyleInlineList">
      <li class="fsTag">Grade 02</li>
      <li class="fsTag">Grade 03</li>
      <li class="fsTag">Grade 04</li>
      <li class="fsTag">Grade 05</li>
    </ul>
    <a class="fsPostLink fsReadMoreLink" data-slug="week-1-june-1-5/post/the-elementary-golf-experience" href="#">View Camp Description</a>
  </article>
</div>
"""


def test_parse_date_range_and_time_range_normalize_values() -> None:
    assert _parse_date_range("June 22-26", 2026) == ("2026-06-22", "2026-06-26")
    assert _parse_time_range("9 a.m. - 12 p.m.") == ("09:00", "12:00")


def test_parse_articles_extracts_structured_pace_rows() -> None:
    rows = _parse_articles(BeautifulSoup(PACE_HTML, "html.parser"))

    assert len(rows) == 2

    glow = rows[0]
    golf = rows[1]

    assert glow["title"] == "Glow Up Camp - DIY Self Care Essentials"
    assert glow["category_label"] == "Middle School"
    assert glow["start_date"] == "2026-06-22"
    assert glow["end_date"] == "2026-06-26"
    assert glow["start_time"] == "09:00"
    assert glow["price_min"] == 350.0
    assert glow["vendor"] == "Mrs. Julia Wilson"
    assert glow["age_min"] == 10
    assert glow["age_max"] == 14

    assert golf["category_label"] == "Athletics"
    assert golf["class_category"] == "fitness"
    assert "sports" in golf["tags"]
    assert golf["age_min"] == 7
    assert golf["age_max"] == 11


def test_parse_articles_handles_kindergarten_style_grade_tokens() -> None:
    rows = _parse_articles(
        BeautifulSoup(
            """
            <h1>Search Camps 2026</h1>
            <article>
              <ul class="fsCategories"><li class="fsCategory">Arts</li></ul>
              <div class="fsTitle"><a class="fsPostLink" data-slug="week-5-july-6-10/post/art-camp" href="#">Art Camp</a></div>
              <div class="fsSummary">
                <p><strong>Week 5:</strong> July 6-10<br/><strong>Camp Time:</strong> 9 a.m. - 3 p.m.<br/><strong>Cost:</strong> $345</p>
              </div>
              <ul class="fsTags"><li class="fsTag">0_Kindergarten</li><li class="fsTag">Grade 01</li></ul>
            </article>
            """,
            "html.parser",
        )
    )

    assert len(rows) == 1
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 7
    assert rows[0]["class_category"] == "mixed"
    assert "arts" in rows[0]["tags"]


def test_build_event_record_preserves_price_and_registration_url() -> None:
    row = {
        "title": "The Elementary Golf Experience",
        "category_label": "Athletics",
        "grade_labels": ["Grade 02", "Grade 03", "Grade 04", "Grade 05"],
        "start_date": "2026-06-01",
        "end_date": "2026-06-05",
        "start_time": "09:00",
        "end_time": "12:00",
        "price_min": 350.0,
        "price_max": 350.0,
        "vendor": "Elementary Golf",
        "age_min": 7,
        "age_max": 11,
        "age_tags": ["elementary", "tween"],
        "class_category": "fitness",
        "tags": [
            "kids",
            "family-friendly",
            "educational",
            "seasonal",
            "rsvp-required",
            "elementary",
            "tween",
            "sports",
            "fitness",
        ],
        "source_url": "https://www.paceacademy.org/community/summer-programs/search-camps/~board/week-1-june-1-5/post/the-elementary-golf-experience",
        "summary_text": "Week: June 1-5 Camp Time: 9 a.m. - 12 p.m. Cost: $350 Vendor: Elementary Golf",
    }

    record = _build_event_record(12, 22, row)

    assert record["title"] == "The Elementary Golf Experience"
    assert (
        record["ticket_url"]
        == "https://paceacademysummerprograms.campbrainregistration.com/"
    )
    assert record["price_min"] == 350.0
    assert record["price_note"] == "$350"
    assert record["class_category"] == "fitness"
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
