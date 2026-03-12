from sources.westside_motor_lounge import (
    determine_category,
    parse_price_fields,
    parse_shotgun_event_jsonld,
)


EVENT_HTML = """
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "The Love Jones",
        "description": "An all vinyl set of R&B slow jams spanning all decades.",
        "startDate": "2026-03-13T20:00:00-04:00",
        "endDate": "2026-03-14T01:00:00-04:00",
        "offers": [
          {"name": "FREE before 9PM", "price": 0},
          {"name": "General Admission", "price": 10}
        ],
        "image": {"url": "https://res.cloudinary.com/example.jpg"}
      }
    </script>
  </head>
</html>
"""


def test_parse_shotgun_event_jsonld_extracts_event():
    event = parse_shotgun_event_jsonld(EVENT_HTML)

    assert event["name"] == "The Love Jones"
    assert event["startDate"] == "2026-03-13T20:00:00-04:00"


def test_parse_price_fields_builds_price_note():
    price_min, price_max, price_note, is_free = parse_price_fields(
        [
            {"name": "FREE before 9PM", "price": 0},
            {"name": "General Admission", "price": 10},
        ]
    )

    assert price_min == 0
    assert price_max == 10
    assert price_note == "FREE before 9PM ($0), General Admission ($10)"
    assert is_free is False


def test_determine_category_uses_music_tags():
    category, subcategory, tags = determine_category(
        "The Love Jones",
        "An all vinyl set of R&B slow jams spanning all decades.",
        ["JAZZ", "SOUL", "R&B"],
    )

    assert category == "music"
    assert subcategory == "live"
    assert "jazz" in tags
