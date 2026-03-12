from parking_extract import _focused_parking_snippet, is_valid_parking_note


def test_is_valid_parking_note_accepts_real_parking_copy():
    assert is_valid_parking_note(
        "Validated parking is available in the adjacent deck. Enter from West Peachtree Street."
    )


def test_is_valid_parking_note_rejects_event_promo_junk():
    assert not is_valid_parking_note(
        "UPCOMING EVENTS Learn More WEEKLY SPECIAL Sunday Brunch RESERVATIONS 675 N. Highland Ave."
    )


def test_focused_parking_snippet_extracts_parking_sentence_from_review_blob():
    text = (
        'LOVE this elevated bar with darts. Fun spot for drinks and food. '
        'Staff was helpful and attentive. Free parking available in parking garage. Google 5/5'
    )

    assert _focused_parking_snippet(text) == "Free parking available in parking garage."


def test_focused_parking_snippet_trims_policy_page_leadin():
    text = (
        "reference the policies page for further details Valet parking is available during all hours of operation; "
        "Please do not park in the lots surrounding our building."
    )

    assert _focused_parking_snippet(text) == (
        "Valet parking is available during all hours of operation; Please do not park in the lots surrounding our building."
    )


def test_focused_parking_snippet_prefers_specific_parking_clause():
    text = (
        "VALET PARKING - $3 Gift Cards | Facebook | Twitter | Instagram | Join Our Mailing List "
        "Concentrics Restaurants | Book An Event | Careers"
    )

    assert _focused_parking_snippet(text) == "VALET PARKING - $3"


def test_focused_parking_snippet_extracts_free_parking_clause_from_nav_blob():
    text = (
        "coffee wine tinned fish HOUSE RULES ORDER AT THE BAR FLATWARE + WATER OUTSIDE RETURN ITEMS TO OUTSIDE BUS BINS "
        "NO SUBSTITUTIONS NO TIPS FREE PARKING ON 12TH, 13TH, PIEDMONT HAVE FUN, LIFE IS WILD © Larakin 2025"
    )

    assert _focused_parking_snippet(text) == "FREE PARKING ON 12TH, 13TH, PIEDMONT"


def test_is_valid_parking_note_accepts_short_price_based_valet_note():
    assert is_valid_parking_note("VALET PARKING - $3")


def test_is_valid_parking_note_rejects_form_and_marketing_copy():
    assert not is_valid_parking_note(
        "Book Event Name (Required) First Last Email (Required) Location Atlanta: The Grove and The Greenhouse"
    )
    assert not is_valid_parking_note(
        "Become a Member Members enjoy early access to new exhibitions, free admission, exclusive discounts when shopping and dining, complimentary parking, and other great perks."
    )
    assert not is_valid_parking_note(
        "on day of show only What are the parking options at Cobb Galleria Centre?"
    )


def test_focused_parking_snippet_trims_breadcrumb_parking_headers():
    text = (
        "Home | Plan Your Visit | Arena Parking Arena Parking State Farm Arena offers multiple "
        "parking options tailored to your needs. Pre-purchase parking and save!"
    )

    assert _focused_parking_snippet(text) == (
        "State Farm Arena offers multiple parking options tailored to your needs. Pre-purchase parking and save!"
    )


def test_focused_parking_snippet_trims_directions_and_footer_noise():
    text = (
        "529 DIRECTIONS 529 Flat Shoals Ave SE, Atlanta, GA 30316 Parking available behind the venue. "
        "View Calendar © Copyright 2026 529 . All Rights Reserved."
    )

    assert _focused_parking_snippet(text) == "Parking available behind the venue."


def test_focused_parking_snippet_drops_rates_and_info_url_tail():
    text = (
        "PARKING INFO Located within The Dairies complex on Memorial Drive, The Eastern is "
        "conveniently located adjacent to a flat rate parking deck. Rates & Additional Information "
        "https://www.atlantadairies.com/"
    )

    assert _focused_parking_snippet(text) == (
        "PARKING INFO Located within The Dairies complex on Memorial Drive, The Eastern is conveniently located adjacent to a flat rate parking deck."
    )


def test_focused_parking_snippet_preserves_address_with_jr_abbreviation():
    text = (
        "Address: 121 Baker Street NW Atlanta, GA 30313-1807 (404) 676-5151 "
        "Parking Garage Address: 126 Ivan Allen Jr. Blvd NW Atlanta, GA 30313"
    )

    assert _focused_parking_snippet(text) == (
        "Parking Garage Address: 126 Ivan Allen Jr. Blvd NW Atlanta, GA 30313"
    )
