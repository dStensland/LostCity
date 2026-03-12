from bs4 import BeautifulSoup

from sources.diventures_alpharetta_swim import (
    _build_event_record,
    _derive_age_range,
    _extract_lesson_rows,
    _extract_venue_data,
)


DIVENTURES_HTML = """
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"LocalBusiness","telephone":"(770) 992-3772","address":{"@type":"PostalAddress","streetAddress":"2880 Holcomb Bridge Rd","addressLocality":"Alpharetta","postalCode":"30022","addressRegion":"GA"},"geo":{"@type":"GeoCoordinates","latitude":"33.9914446","longitude":"-84.275204"}}
</script>
<div class="et_pb_column">
  <div class="et_pb_blurb_container">
    <h3 class="et_pb_module_header"><span>Baby &amp; toddler swim lessons</span></h3>
    <div class="et_pb_blurb_description">
      <p><strong>Starting at $120/month<br />+ $50 registration fee</strong></p>
      <p>For children ages two months to 35 months, Diventures has the toddler and infant swimming lessons in Alpharetta that you need.</p>
    </div>
  </div>
  <div class="et_pb_button_module_wrapper">
    <a class="et_pb_button" href="/swim/baby-and-toddler/">Baby &amp; Toddler Lessons</a>
  </div>
</div>
<div class="et_pb_column">
  <div class="et_pb_blurb_container">
    <h3 class="et_pb_module_header"><span>Child swim lessons</span></h3>
    <div class="et_pb_blurb_description">
      <p><strong>Starting at $120/month<br />+ $50 registration fee</strong></p>
      <p>Whether you're looking for swim lessons for your 3-year-old, 15-year-old, or any age in between, we have swim classes for children near Atlanta.</p>
    </div>
  </div>
  <div class="et_pb_button_module_wrapper">
    <a class="et_pb_button" href="/swim/child-lessons/">Child Lessons</a>
  </div>
</div>
<div class="et_pb_column">
  <div class="et_pb_blurb_container">
    <h3 class="et_pb_module_header"><span>Adult swim lessons</span></h3>
    <div class="et_pb_blurb_description">
      <p><strong>Starting at $120/month<br />+ $50 registration fee</strong></p>
      <p>For anyone 16 years and older who has little to no prior experience with swimming.</p>
    </div>
  </div>
  <div class="et_pb_button_module_wrapper">
    <a class="et_pb_button" href="/swim/adult-lessons/">Adult Lessons</a>
  </div>
</div>
<div class="et_pb_column">
  <div class="et_pb_blurb_container">
    <h3 class="et_pb_module_header"><span>Private swim lessons</span></h3>
    <div class="et_pb_blurb_description">
      <p><strong>Starting at $300/month</strong></p>
      <p>These private swim classes give you one-on-one support from a swim teacher. Or, semiprivate lessons starting at $162.50/month are an option.</p>
    </div>
  </div>
  <div class="et_pb_button_module_wrapper">
    <a class="et_pb_button" href="/swim/private-swim-lessons/">Private Lessons</a>
  </div>
</div>
"""


def test_derive_age_range_for_diventures_cards() -> None:
    assert _derive_age_range(
        "Baby & toddler swim lessons",
        "For children ages two months to 35 months.",
    ) == (0, 2, ["infant", "toddler"], "2-35 months")
    assert _derive_age_range(
        "Child swim lessons",
        "Whether you're looking for swim lessons for your 3-year-old, 15-year-old, or any age in between.",
    ) == (3, 15, ["preschool", "elementary", "tween"], "3-15 years")
    assert _derive_age_range(
        "Adult swim lessons",
        "For anyone 16 years and older who has little to no prior experience with swimming.",
    ) == (16, None, ["adult"], "16+ years")


def test_extract_lesson_rows_from_diventures_page() -> None:
    soup = BeautifulSoup(DIVENTURES_HTML, "html.parser")
    rows = _extract_lesson_rows(soup)

    assert len(rows) == 4
    assert rows[0]["detail_url"].endswith("/swim/baby-and-toddler/")
    assert rows[0]["price_min"] == 120.0
    assert rows[0]["price_max"] == 120.0
    assert rows[3]["detail_url"].endswith("/swim/private-swim-lessons/")
    assert rows[3]["price_min"] == 162.5
    assert rows[3]["price_max"] == 300.0


def test_build_event_record_uses_fitness_swim_contract() -> None:
    venue = _extract_venue_data(BeautifulSoup(DIVENTURES_HTML, "html.parser"))
    row = _extract_lesson_rows(BeautifulSoup(DIVENTURES_HTML, "html.parser"))[1]

    record = _build_event_record(7, 11, venue, row, "2026-03-21")

    assert record["category"] == "fitness"
    assert record["subcategory"] == "fitness.swim"
    assert record["is_class"] is True
    assert record["class_category"] == "fitness"
    assert record["ticket_url"].endswith("loc=Alpharetta")
