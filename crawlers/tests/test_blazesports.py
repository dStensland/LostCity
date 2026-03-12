from sources.blazesports import build_venue_data, parse_api_event


def test_build_venue_data_uses_api_venue_fields():
    venue = build_venue_data(
        {
            "venue": "Bowlero Bowling Alley",
            "slug": "bowlero-bowling-alley",
            "address": "3835 Lawrenceville Hwy",
            "city": "Lawrenceville",
            "state": "GA",
            "zip": "30044",
            "url": "https://blazesports.org/venue/bowlero-bowling-alley/",
        }
    )

    assert venue["slug"] == "bowlero-bowling-alley"
    assert venue["city"] == "Lawrenceville"
    assert venue["website"] == "https://blazesports.org/venue/bowlero-bowling-alley/"


def test_parse_api_event_builds_adaptive_sports_event():
    parsed = parse_api_event(
        {
            "title": "Bowling",
            "description": "<p>Veteran bowling program with registration required.</p>",
            "start_date": "2026-03-11 12:00:00",
            "end_date": "2026-03-11 14:30:00",
            "cost": "Free",
            "website": "https://blazesports.org/veteran/bowling/",
            "url": "https://blazesports.org/event/bowling-2/2026-03-11/",
            "image": {"url": "https://example.com/image.jpg"},
            "venue": {
                "venue": "Bowlero Bowling Alley",
                "slug": "bowlero-bowling-alley",
                "address": "3835 Lawrenceville Hwy",
                "city": "Lawrenceville",
                "state": "GA",
                "zip": "30044",
                "url": "https://blazesports.org/venue/bowlero-bowling-alley/",
            },
            "categories": [{"slug": "bowling"}],
        }
    )

    assert parsed is not None
    assert parsed["start_date"] == "2026-03-11"
    assert parsed["start_time"] == "12:00"
    assert parsed["end_time"] == "14:30"
    assert parsed["category"] == "sports"
    assert parsed["subcategory"] == "bowling"
    assert "adaptive-sports" in parsed["tags"]
    assert "veterans" in parsed["tags"]
    assert parsed["is_free"] is True


def test_parse_api_event_maps_yoga_to_fitness():
    parsed = parse_api_event(
        {
            "title": "Yoga",
            "description": "<p>Adaptive yoga for veterans.</p>",
            "start_date": "2026-03-11 14:00:00",
            "end_date": "2026-03-11 15:00:00",
            "cost": "",
            "website": "",
            "url": "https://blazesports.org/event/veteran-yoga-2/2026-03-11/",
            "image": {},
            "venue": None,
            "categories": [{"slug": "yoga"}],
        }
    )

    assert parsed is not None
    assert parsed["category"] == "fitness"
    assert parsed["subcategory"] == "adaptive_fitness"
