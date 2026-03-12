from bs4 import BeautifulSoup

from sources.big_blue_swim_johns_creek import (
    _build_event_record,
    _extract_lesson_rows,
    _extract_location_config,
    _extract_ongoing_program_rows,
    _parse_age_range,
)


BIG_BLUE_HTML = """
<script>
var bbss = {"location":{"lb_data":{"name":"Johns Creek","displayName":"Johns Creek, GA","regionSlug":"georgia","slug":"johns-creek","phoneNumber":"7706260168","email":"johnscreek@bigblueswimschool.com","address":{"street":"10955 Jones Bridge Rd.","city":"Johns Creek","postalCode":"30022","coords":{"lat":34.0453,"lng":-84.2213},"province":{"shortName":"GA"}}}}};
</script>
<div class="col-12 col-lg-6">
  <h5>Baby Blue</h5>
  <div class="sub-text">3 months - 2 years</div>
  <p>Our Baby Blue class helps your little one build confidence.</p>
  <ul class="list">
    <li>6 babies : 1 instructor</li>
    <li>30-min weekly lessons</li>
    <li>Parent participation required</li>
  </ul>
  <div class="button-wrapper">
    <a class="secondary-btn" href="https://app.bigblueswimschool.com/locations/regionSlug/locationSlug/preview/weekly?levels=BA1">3-17 mo. Schedule</a>
    <a class="secondary-btn" href="https://app.bigblueswimschool.com/locations/regionSlug/locationSlug/preview/weekly?levels=BA2">18-35 mo. Schedule</a>
  </div>
</div>
<div class="col-12 col-lg-6">
  <h5>Bright Blue</h5>
  <div class="sub-text">3-5 years</div>
  <p>Play-based learning for toddlers.</p>
  <ul class="list">
    <li>3 students : 1 instructor</li>
    <li>30-min weekly lessons</li>
  </ul>
  <div class="button-wrapper">
    <a class="secondary-btn" href="https://app.bigblueswimschool.com/locations/regionSlug/locationSlug/preview/weekly?levels=BR1">View Schedule</a>
  </div>
</div>
<div class="col-12 col-lg-6">
  <h5>Big Blue</h5>
  <div class="sub-text">6+ years advanced</div>
  <p>Advanced swimmers refine strokes and endurance.</p>
  <ul class="list">
    <li>Up to 7 students : 1 instructor</li>
    <li>45-min weekly lessons</li>
  </ul>
</div>
<div class="program-item">
  <h3 class="program-headline">Drop-in Lessons</h3>
  <p class="program-content">Flexible extra swim time.</p>
  <div class="button-wrapper">
    <a class="primary-btn" href="https://app.bigblueswimschool.com/locations/georgia/johns-creek/preview/drop-in?">Sign Up</a>
    <a class="secondary-btn" href="https://bigblueswimschool.com/programs/drop-in-lessons/">Learn More</a>
  </div>
</div>
<div class="program-item">
  <h3 class="program-headline">Adaptive Swim Lessons</h3>
  <p class="program-content">Customized sessions for different needs.</p>
  <div class="button-wrapper">
    <a class="primary-btn" href="tel:7706260168">Call to Enroll</a>
    <a class="secondary-btn" href="https://bigblueswimschool.com/lessons/adaptive-swim/">Learn More</a>
  </div>
</div>
"""


def test_parse_age_range_handles_months_and_years() -> None:
    assert _parse_age_range("3-17 mo. Schedule") == (
        0,
        1,
        ["infant", "toddler"],
        "3-17 months",
    )
    assert _parse_age_range("18-35 mo. Schedule") == (1, 2, ["toddler"], "18-35 months")
    assert _parse_age_range("3-5 years") == (
        3,
        5,
        ["preschool", "elementary"],
        "3-5 years",
    )
    assert _parse_age_range("6+ years advanced") == (
        6,
        17,
        ["elementary", "tween"],
        "6+ years",
    )


def test_extract_rows_from_big_blue_page() -> None:
    location = _extract_location_config(BIG_BLUE_HTML)
    soup = BeautifulSoup(BIG_BLUE_HTML, "html.parser")

    lesson_rows = _extract_lesson_rows(soup, location)
    program_rows = _extract_ongoing_program_rows(soup, location)

    assert len(lesson_rows) == 4
    assert len(program_rows) == 2
    assert lesson_rows[0]["ticket_url"].endswith("levels=BA1")
    assert lesson_rows[1]["ticket_url"].endswith("levels=BA2")
    assert lesson_rows[3]["ticket_url"].endswith("/preview/weekly")
    assert program_rows[0]["title"] == "Drop-in Lessons"
    assert program_rows[1]["ticket_url"] == "tel:7706260168"


def test_build_event_record_uses_fitness_swim_contract() -> None:
    location = _extract_location_config(BIG_BLUE_HTML)
    row = {
        "title": "Bright Blue Swim Lessons",
        "program_name": "Bright Blue",
        "age_label": "3-5 years",
        "description": "Play-based learning for toddlers.",
        "details": ["3 students : 1 instructor", "30-min weekly lessons"],
        "ticket_url": "https://app.bigblueswimschool.com/locations/georgia/johns-creek/preview/weekly?levels=BR1",
        "source_url": "https://bigblueswimschool.com/locations/georgia/johns-creek/",
        "age_min": 3,
        "age_max": 5,
        "tags": [
            "kids",
            "family-friendly",
            "swimming",
            "class",
            "rsvp-required",
            "toddler",
            "preschool",
            "weekly",
            "fitness",
        ],
        "price_min": None,
        "price_max": None,
        "price_note": "Weekly lessons. Pricing varies by plan.",
    }

    record = _build_event_record(7, 11, row, "2026-03-21", location)

    assert record["category"] == "fitness"
    assert record["subcategory"] == "fitness.swim"
    assert record["is_class"] is True
    assert record["class_category"] == "fitness"
    assert record["ticket_url"].endswith("levels=BR1")
