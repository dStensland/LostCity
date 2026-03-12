from sources.camp_invention_atlanta import (
    _build_event_record,
    _parse_detail_page,
    _parse_search_rows,
)


CAMP_INVENTION_SEARCH_HTML = r"""
\u003Ca href=\u0022/program-search/camp-invention/ga22/11452\u0022 target=\u0022_blank\u0022 role=\u0022article\u0022 class=\u0022program-teaser program--teaser\u0022\u003E
  \u003Cdiv class=\u0022program-teaser__top\u0022\u003E
    \u003Ch3 class=\u0022program-teaser__title\u0022\u003ESt. Jude the Apostle School - Camp Invention: Spark\u003C/h3\u003E
    \u003Cp class=\u0022program-teaser__date\u0022\u003EJune 1-5, 2026\u003C/p\u003E
  \u003C/div\u003E
  \u003Cdiv class=\u0022program-teaser__content\u0022\u003E
    \u003Cdiv class=\u0022program-teaser__address\u0022\u003E7171 Glenridge Drive\u003Cbr\u003EAtlanta, GA 30328\u003C/div\u003E
  \u003C/div\u003E
\u003C/a\u003E
\u003Ca href=\u0022/program-search/camp-invention/ga22/17558\u0022 target=\u0022_blank\u0022 role=\u0022article\u0022 class=\u0022program-teaser program--teaser\u0022\u003E
  \u003Cdiv class=\u0022program-teaser__top\u0022\u003E
    \u003Ch3 class=\u0022program-teaser__title\u0022\u003EAmana Academy - Camp Invention: Spark\u003C/h3\u003E
    \u003Cp class=\u0022program-teaser__date\u0022\u003EJune 1-5, 2026\u003C/p\u003E
  \u003C/div\u003E
  \u003Cdiv class=\u0022program-teaser__content\u0022\u003E
    \u003Cdiv class=\u0022program-teaser__address\u0022\u003E285 South Main Street\u003Cbr\u003EAlpharetta, GA 30009\u003C/div\u003E
  \u003C/div\u003E
\u003C/a\u003E
\u003Ca href=\u0022/program-search/camp-invention/ga99/99999\u0022 target=\u0022_blank\u0022 role=\u0022article\u0022 class=\u0022program-teaser program--teaser\u0022\u003E
  \u003Cdiv class=\u0022program-teaser__top\u0022\u003E
    \u003Ch3 class=\u0022program-teaser__title\u0022\u003ESomewhere Else - Camp Invention: Spark\u003C/h3\u003E
    \u003Cp class=\u0022program-teaser__date\u0022\u003EJune 1-5, 2026\u003C/p\u003E
  \u003C/div\u003E
  \u003Cdiv class=\u0022program-teaser__content\u0022\u003E
    \u003Cdiv class=\u0022program-teaser__address\u0022\u003E1 Main Street\u003Cbr\u003ESavannah, GA 31401\u003C/div\u003E
  \u003C/div\u003E
\u003C/a\u003E
"""


CAMP_INVENTION_DETAIL_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Event",
            "url": "https://www.invent.org/program-search/camp-invention/ga22/17558",
            "name": "Amana Academy - Camp Invention: Spark",
            "description": "Help your child build confidence and explore STEM in Alpharetta, Georgia.",
            "startDate": "2026-06-01",
            "endDate": "2026-06-05",
            "location": {
              "@type": "Place",
              "name": "Amana Academy - Camp Invention: Spark",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "285 South Main Street",
                "addressLocality": "Alpharetta",
                "addressRegion": "GA",
                "postalCode": "30009",
                "addressCountry": "US"
              }
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <div class="program__info">
      <p class="program__info--text">Location: 285 South Main Street, Alpharetta, GA 30009</p>
      <p class="program__info--text">2026 Program Dates: 6/1/2026 - 6/5/2026</p>
      <p class="program__info--text">2026 Program Times: 8:30 AM - 3:00 PM</p>
      <div class="program__info--strong">For children entering grades K-6</div>
      <p class="program__info--text program__info--text--price">Camper Price: $300*</p>
    </div>
    <div class="program__register--desktop--wrapper">
      <a class="program__register" href="https://invent.ungerboeck.com/prod/emc00/register.aspx?OrgCode=10&amp;EvtID=46576&amp;AppCode=REG&amp;cc=">Register Here</a>
    </div>
    <div class="program__inner--body">
      <p>Exciting news for this location: For a more convenient program schedule, add our Before and After Care option to your cart at registration. Before and After Care hours are from 7:30 AM to 5:30 PM for an additional $100 per week.</p>
      <p>Introducing an All-New 2026 Camp Invention Experience!</p>
    </div>
  </body>
</html>
"""


RESTRICTED_DETAIL_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Event",
            "url": "https://www.invent.org/program-search/camp-invention/ga22/11452",
            "name": "St. Jude the Apostle School - Camp Invention: Spark",
            "description": "Restricted camp.",
            "startDate": "2026-06-01",
            "endDate": "2026-06-05",
            "location": {
              "@type": "Place",
              "name": "St. Jude the Apostle School - Camp Invention: Spark",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "7171 Glenridge Drive",
                "addressLocality": "Atlanta",
                "addressRegion": "GA",
                "postalCode": "30328",
                "addressCountry": "US"
              }
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <div class="program__inner--body">
      <p>Please Note: This site is only accepting students that attend St. Jude the Apostle Catholic School.</p>
    </div>
  </body>
</html>
"""


def test_parse_search_rows_filters_to_atlanta_metro() -> None:
    rows = _parse_search_rows(CAMP_INVENTION_SEARCH_HTML)

    assert len(rows) == 2
    assert rows[0]["detail_url"].endswith("/ga22/11452")
    assert rows[1]["detail_url"].endswith("/ga22/17558")


def test_parse_detail_page_extracts_program_fields() -> None:
    row = _parse_detail_page(
        CAMP_INVENTION_DETAIL_HTML,
        "https://www.invent.org/program-search/camp-invention/ga22/17558",
    )

    assert row is not None
    assert row["title"] == "Camp Invention: Spark at Amana Academy"
    assert row["start_time"] == "08:30"
    assert row["end_time"] == "15:00"
    assert row["price_min"] == 300.0
    assert row["age_min"] == 5
    assert row["age_max"] == 11
    assert row["ticket_url"].startswith("https://invent.ungerboeck.com")


def test_parse_detail_page_skips_restricted_school_only_sites() -> None:
    row = _parse_detail_page(
        RESTRICTED_DETAIL_HTML,
        "https://www.invent.org/program-search/camp-invention/ga22/11452",
    )

    assert row is None


def test_build_event_record_shapes_camp_invention_program() -> None:
    row = _parse_detail_page(
        CAMP_INVENTION_DETAIL_HTML,
        "https://www.invent.org/program-search/camp-invention/ga22/17558",
    )
    assert row is not None
    record = _build_event_record(15, 29, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["price_min"] == 300.0
    assert record["age_min"] == 5
    assert record["age_max"] == 11
