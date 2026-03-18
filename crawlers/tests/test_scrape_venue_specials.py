from scrape_venue_specials import (
    extract_event_items,
    _extract_popmenu_embedded_text,
    _supplement_with_fallback,
    _fallback_extract_data,
    _fallback_extract_specials,
    _looks_like_parked_site,
    validate_specials,
)


def test_fallback_extract_specials_handles_weekly_specials_block():
    text = """
    WEEKLY SPECIALS
    MONDAY TO FRIDAY
    Happy Hour Menu! $5 Tapas, $5 Mimosas, $5 Sangria, $5 Mojitos, $5 Margaritas from 3p-6p
    MONDAY
    BOGO Chicken Wings from 6p-10p
    TUESDAY
    Rotating $3 taco special
    WEDNESDAY
    Half off wine bottles
    FRIDAY
    BOGO Raw Boutique Oysters from 6p-10p
    SATURDAY
    Brunch 10a to 4p
    $5 Mimosas
    SUNDAY
    Brunch 10a to 4p
    $5 Mimosas
    Open Mon-Fri 3pm-11pm
    Open Sat & Sun 10am-11pm
    """

    specials = _fallback_extract_specials(text)

    assert len(specials) == 7

    happy_hour = next(s for s in specials if s["title"] == "Happy Hour")
    assert happy_hour["days"] == [1, 2, 3, 4, 5]
    assert happy_hour["time_start"] == "15:00"
    assert happy_hour["time_end"] == "18:00"
    assert "$5 Tapas" in happy_hour["price_note"]

    taco_tuesday = next(s for s in specials if s["title"] == "Taco Tuesday")
    assert taco_tuesday["days"] == [2]
    assert taco_tuesday["type"] == "recurring_deal"
    assert taco_tuesday["price_note"] == "$3 taco special"

    brunch_days = sorted(s["days"][0] for s in specials if s["title"] == "Weekend Brunch")
    assert brunch_days == [6, 7]


def test_fallback_extract_data_parses_hours():
    data = _fallback_extract_data(
        "Open Mon-Fri 3pm-11pm\nOpen Sat & Sun 10am-11pm\nHappy Hour Mon-Fri 3p-6p"
    )

    assert data["hours"] is not None
    assert data["hours"]["mon"] == {"open": "15:00", "close": "23:00"}
    assert data["hours"]["sat"] == {"open": "10:00", "close": "23:00"}
    assert data["_hours_source"] == "website"


def test_looks_like_parked_site_detects_domain_sale_pages():
    parked = """
    StarBarAtlanta.com is for sale
    Buy now for $4,195 or start payment plan
    Questions? Talk to a domain expert
    """

    assert _looks_like_parked_site(parked) is True
    assert _looks_like_parked_site("Neighborhood bar with happy hour and trivia.") is False


def test_fallback_extract_specials_normalizes_title_qualifiers():
    specials = _fallback_extract_specials(
        "WEDNESDAY\nWine Wednesday (Except Holiday)\nSATURDAY & SUNDAY\nBottomless Brunch 11am-3pm"
    )

    titles = [special["title"] for special in specials]
    assert "Wine Wednesday" in titles
    assert "Bottomless Brunch" in titles


def test_fallback_extract_data_promotes_bottomless_brunch_and_rejects_sentence_junk():
    data = _fallback_extract_data(
        "Saturdays & Sundays\nBottomless Brunch 11am-3pm\n"
        "Join us at Patagonia Beltline for a free yoga session every Sunday.\n"
        "14"
    )

    titles = [special["title"] for special in data["specials"]]
    assert "Bottomless Brunch" in titles
    assert not any(title.startswith("Join") for title in titles)
    assert "14" not in titles


def test_fallback_extract_specials_skips_event_promo_copy():
    specials = _fallback_extract_specials(
        "Sat | 14 | Join C. Ellet's Saturdays and Sundays for jazz brunch! "
        "Dine on your favorite bites, sip on mimosas, and listen to jazzy tunes. "
        "The Jazz Duo plays from 11-3pm every Saturday and Sunday. "
        "Click here to make your reservation today!"
    )

    assert specials == []


def test_fallback_extract_specials_skips_dated_or_marketing_candidates():
    specials = _fallback_extract_specials(
        "Cherry Street Brewing is home to killer beer brewed in two craft breweries. "
        "Our brewpubs offer lunch and dinner menus plus weekend brunch, as well as kid's options.\n"
        "Save the date: Brunch n Brews with the Easter Bunny Sunday 3/29 (11am - 3pm)\n"
        "Friday | Teacher Happy Hour 3pm - 6pm"
    )

    assert specials == [
        {
            "title": "Teacher Happy Hour",
            "type": "happy_hour",
            "description": None,
            "days": [5],
            "time_start": "15:00",
            "time_end": "18:00",
            "price_note": None,
            "_days_already_parsed": True,
        }
    ]


def test_fallback_extract_specials_rejects_generic_titles():
    specials = _fallback_extract_specials(
        "Saturday & Sunday | Restaurant: | Forsyth County's award-winning Brunch from 9am-1pm.\n"
        "Saturday & Sunday | Brunch"
    )

    titles = [special["title"] for special in specials]
    assert "Restaurant" not in titles
    assert titles == ["Weekend Brunch"]


def test_fallback_extract_specials_expands_day_ranges_and_compact_time_ranges():
    specials = _fallback_extract_specials(
        "Brunch served Friday-Sunday 11AM - 4PM\n"
        "Saturday Brunch Menu (12-3pm)"
    )

    assert specials == [
        {
            "title": "Weekend Brunch",
            "type": "brunch",
            "description": None,
            "days": [5, 6, 7],
            "time_start": "11:00",
            "time_end": "16:00",
            "price_note": None,
            "_days_already_parsed": True,
        },
        {
            "title": "Weekend Brunch",
            "type": "brunch",
            "description": None,
            "days": [6],
            "time_start": "12:00",
            "time_end": "15:00",
            "price_note": None,
            "_days_already_parsed": True,
        },
    ]


def test_fallback_extract_specials_prefers_weekend_over_daily_service_copy():
    specials = _fallback_extract_specials(
        "MONDAY – THURSDAY: 11:30am – 10pm\n"
        "FRIDAY: 11:30am – 11pm\n"
        "SATURDAY: 10:30am – 11pm\n"
        "SUNDAY: 10:30am – 10pm\n"
        "Brunch Service Ends at 3pm on Saturday + Sunday\n"
        "Offering breakfast, lunch, and dinner daily with brunch served on weekends.\n"
    )

    brunch_days = sorted(s["days"] for s in specials if s["title"] == "Weekend Brunch")
    assert brunch_days == [[6, 7]]


def test_fallback_extract_specials_reads_menu_style_special_headers():
    specials = _fallback_extract_specials(
        "Brunch, Lunch, and Dinner Menus\n"
        "Lunch Menu\n"
        "Mon-Fri 11am-3pm\n"
        "Dinner Menu\n"
        "Mon-Thurs 5pm-9pm\n"
        "Fri-Sat 5pm-10pm\n"
        "Sunday 4pm-9pm\n"
        "Brunch Menu\n"
        "Sat-Sun 10am-3pm\n"
        "Happy Hour Menu\n"
        "Bar Menu\n"
        "Mon-Fri 3pm-5pm\n"
    )

    assert specials == [
        {
            "title": "Weekend Brunch",
            "type": "brunch",
            "description": None,
            "days": [6, 7],
            "time_start": "10:00",
            "time_end": "15:00",
            "price_note": None,
            "_days_already_parsed": True,
        },
        {
            "title": "Happy Hour",
            "type": "happy_hour",
            "description": None,
            "days": [1, 2, 3, 4, 5],
            "time_start": "15:00",
            "time_end": "17:00",
            "price_note": None,
            "_days_already_parsed": True,
        },
    ]


def test_validate_specials_keeps_food_drink_deals_even_if_llm_marks_event_night():
    specials = validate_specials(
        [
            {
                "title": "Taco Tuesday",
                "type": "event_night",
                "description": "Every Tuesday with $3 tacos and rotating fillings.",
                "days": [2],
                "price_note": "$3 tacos",
            },
            {
                "title": "Teacher Happy Hour",
                "type": "event_night",
                "description": "Fridays 3pm to 6pm with half-price cocktails.",
                "days": [5],
                "time_start": "15:00",
                "time_end": "18:00",
                "price_note": "half-price cocktails",
            },
        ]
    )

    assert [special["type"] for special in specials] == ["recurring_deal", "happy_hour"]


def test_extract_event_items_only_routes_programmed_entertainment_nights():
    events = extract_event_items(
        [
            {
                "title": "Trivia Night",
                "type": "event_night",
                "description": "Every Wednesday at 8pm.",
                "days": [3],
                "time_start": "20:00",
            },
            {
                "title": "Wine Wednesday",
                "type": "event_night",
                "description": "Half-price bottles every Wednesday.",
                "days": [3],
                "price_note": "half-price bottles",
            },
            {
                "title": "Happy Hour",
                "type": "happy_hour",
                "description": "$6 drafts weekdays.",
                "days": [1, 2, 3, 4, 5],
                "price_note": "$6 drafts",
            },
        ]
    )

    assert len(events) == 1
    assert events[0]["title"] == "Trivia Night"


def test_supplement_with_fallback_fills_sparse_llm_output():
    data, supplemented = _supplement_with_fallback(
        {
            "specials": [],
            "hours": None,
        },
        "Brunch Menu\nSat-Sun 10am-3pm\nHappy Hour Menu\nMon-Fri 3pm-5pm\n",
    )

    assert supplemented == ["specials"]
    assert [item["title"] for item in data["specials"]] == ["Weekend Brunch", "Happy Hour"]
    assert data["hours"] is None


def test_extract_popmenu_embedded_text_surfaces_hidden_special_menus():
    html = """
    <html><body>
    <script>
    window.__DATA__ = {
      "Menu:174201":{"__typename":"Menu","id":174201,"name":"Taco Tuesday","slug":"taco-tuesday"},
      "MenuSection:4216665":{"__typename":"MenuSection","id":4216665,"name":"$3 Tacos"},
      "MenuItem:11671176":{"__typename":"MenuItem","id":11671176,"isEnabled":true,"name":"Chorizo Taco","menu":{"__ref":"Menu:174201"},"section":{"__ref":"MenuSection:4216665"}}
    };
    </script>
    </body></html>
    """

    lines = _extract_popmenu_embedded_text(html)

    assert lines == ["Taco Tuesday | $3 Tacos | Chorizo Taco"]
