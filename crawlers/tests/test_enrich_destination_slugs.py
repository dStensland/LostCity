from enrich_destination_slugs import (
    _candidate_planning_urls,
    _canonical_host,
    _compose_hospitality_planning_note,
    _extract_candidate_planning_urls_from_html,
    _extract_embedded_html_text,
    _extract_meta_description_text,
    _fetch_page_with_fallback,
    _extract_first_party_phone,
    _normalize_phone,
    _extract_planning_note_from_text,
    _maybe_parking_enrich,
    _maybe_planning_enrich,
    _maybe_website_hours_enrich,
    _root_guess_urls,
    _select_first_party_phone,
    _should_expand_nested_planning_urls,
    VISIT_CHILD_GUESSES,
)
from parking_extract import _focused_parking_snippet


def test_extract_planning_note_from_text_picks_explicit_destination_signals():
    text = """
    Parking is available at the venue parking garage for a fee starting at $20 per vehicle for all parkers.
    The parking garage has limited capacity and spaces are available on a first-come, first-served basis.
    A limited number of courtesy wheelchairs are available on a first-come-first-served basis.
    Baby strollers are welcome. Guided Tour Tickets require selecting a specific time slot when checking out.
    CityPASS tickets save up to 47% off admission.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "$20" in note
    assert "wheelchairs" in note.lower()
    assert "strollers" in note.lower()
    assert "Guided Tour Tickets" in note
    assert "CityPASS" in note


def test_extract_planning_note_from_text_handles_accessibility_and_parking_faq_copy():
    text = """
    Limited on-site and nearby parking options are available, along with metered street parking.
    Accessible parking is located near the museum entrance.
    The APEX Museum offers wheelchair-accessible entrances, ramps, and restrooms.
    Guided tours are available for groups, schools, and organizations with advance reservation.
    Most visitors spend 60-90 minutes exploring our exhibits.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "metered street parking" in note.lower()
    assert "accessible parking" in note.lower()
    assert "wheelchair-accessible" in note.lower()
    assert "guided tours are available" in note.lower()
    assert "60-90 minutes" in note


def test_extract_planning_note_from_text_handles_museum_visit_blocks():
    text = """
    Free Admission Every Day
    Sunday 11am - 6pm Monday Closed Tuesday & Wednesday Closed Thursday 11am - 8pm Friday 11am - 8pm Saturday 11am - 6pm
    Most people spend 30-45 minutes exploring the galleries.
    Parking is free in the Carriage Works Parking Lot at Bankhead & Means streets.
    You can reach us via MARTA. Visit itsmarta.com for help in planning your trip.
    Bike riders can use racks outside the museum.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "free admission" in note.lower()
    assert "11am - 6pm" in note.lower()
    assert "30-45 minutes" in note
    assert "parking is free" in note.lower()
    assert "marta" in note.lower()


def test_extract_planning_note_from_text_handles_museum_hours_and_donation_copy():
    text = """
    The museum is free and open to the public.
    GPS Address: 440 Westview Drive Atlanta, GA 30310.
    Museum Hours: Wednesday – Saturday | 12 p.m. – 5 p.m. | The Museum is closed on Sundays, Mondays, Tuesdays and campus breaks.
    Suggested Donation: $5
    Uber/Lyft and carpooling are highly encouraged as parking is limited.
    Parking is free in front and behind the TULA building.
    To avoid stairs, the lower level is accessible through the rear entrance.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "free and open to the public" in note.lower()
    assert "wednesday" in note.lower()
    assert "suggested donation" in note.lower()
    assert "parking is limited" in note.lower()
    assert "rear entrance" in note.lower()


def test_extract_candidate_planning_urls_from_html_prioritizes_deeper_visit_links():
    html = """
    <html><body>
      <a href="/visit">Visit</a>
      <a href="/visit/plan-a-visit/">Plan A Visit</a>
      <a href="/visit/hours">Hours</a>
    </body></html>
    """

    urls = _extract_candidate_planning_urls_from_html("https://www.mocaga.org", html)

    assert urls[0] == "https://www.mocaga.org/visit/plan-a-visit/"
    assert "https://www.mocaga.org/visit" in urls


def test_extract_candidate_planning_urls_from_html_includes_plan_your_trip_links():
    html = """
    <html><body>
      <a href="/about/our-venue/">Venue</a>
      <a href="/about/plan-your-trip/">Plan Your Trip</a>
    </body></html>
    """

    urls = _extract_candidate_planning_urls_from_html("https://www.7stages.org", html)

    assert "https://www.7stages.org/about/plan-your-trip/" in urls


def test_extract_candidate_planning_urls_from_html_includes_getting_here_links():
    html = """
    <html><body>
      <a href="/calendar/">Calendar</a>
      <a href="/getting-here/">Getting Here</a>
      <a href="/faq/">FAQ</a>
    </body></html>
    """

    urls = _extract_candidate_planning_urls_from_html(
        "https://www.variety-playhouse.com",
        html,
    )

    assert urls[0] == "https://www.variety-playhouse.com/getting-here/"
    assert "https://www.variety-playhouse.com/faq/" in urls


def test_extract_candidate_planning_urls_from_html_treats_www_variants_as_same_host():
    html = """
    <html><body>
      <a href="https://batteryatl.com/directions-parking/">Get Here</a>
      <a href="https://batteryatl.com/faqs/">FAQs</a>
    </body></html>
    """

    urls = _extract_candidate_planning_urls_from_html("https://www.batteryatl.com", html)

    assert "https://batteryatl.com/directions-parking/" in urls
    assert "https://batteryatl.com/faqs/" in urls


def test_canonical_host_strips_www_prefix():
    assert _canonical_host("www.batteryatl.com") == "batteryatl.com"
    assert _canonical_host("atlantaeagle.com") == "atlantaeagle.com"


def test_candidate_planning_urls_do_not_append_root_guesses_when_real_links_exist(monkeypatch):
    monkeypatch.setattr(
        "enrich_destination_slugs._fetch_page_with_fallback",
        lambda website: '<a href="/about/plan-your-trip/">Plan Your Trip</a>',
    )

    urls = _candidate_planning_urls("https://www.7stages.org")

    assert urls == ["https://www.7stages.org/about/plan-your-trip/"]


def test_should_expand_nested_planning_urls_only_for_generic_hubs():
    assert _should_expand_nested_planning_urls("https://example.com/visit/") is True
    assert _should_expand_nested_planning_urls("https://example.com/plan-your-trip/") is True
    assert _should_expand_nested_planning_urls("https://example.com/parking-and-directions/") is False
    assert _should_expand_nested_planning_urls("https://example.com/getting-here/") is False


def test_root_guess_urls_include_common_visit_paths():
    urls = _root_guess_urls("https://www.atlantahistorycenter.com/")

    assert "https://www.atlantahistorycenter.com/visit/" in urls
    assert "https://www.atlantahistorycenter.com/plan-your-visit/" in urls
    assert "https://www.atlantahistorycenter.com/getting-here/" in urls
    assert "https://www.atlantahistorycenter.com/daily-schedule/" in urls


def test_visit_child_guesses_include_common_museum_paths():
    assert "plan-a-visit/" in VISIT_CHILD_GUESSES
    assert "plan-your-visit/" in VISIT_CHILD_GUESSES
    assert "visit-us" in VISIT_CHILD_GUESSES


def test_extract_first_party_phone_normalizes_us_numbers():
    text = "Contact 75 Bennett Street, Suite M1 Atlanta, GA 30309 404-367-8700 info@mocaga.org"

    assert _extract_first_party_phone(text) == "(404) 367-8700"


def test_extract_first_party_phone_prefers_labeled_number():
    text = "Nearby attraction: 404-848-5000. Phone [404] 880-4800 for visitor services."

    assert _extract_first_party_phone(text) == "(404) 880-4800"


def test_normalize_phone_rejects_555_placeholders():
    assert _normalize_phone("(404) 555-1234") is None
    assert _normalize_phone("404-555-1212") is None
    assert _normalize_phone("(404) 367-8700") == "(404) 367-8700"


def test_select_first_party_phone_prefers_most_common_same_host_number():
    phone = _select_first_party_phone(
        "https://www.aso.org",
        [
            ("https://www.aso.org/", "Phone (404) 733-4800"),
            ("https://www.aso.org/plan-your-visit", "Phone (404) 733-4800"),
            ("https://www.aso.org/plan-your-visit/dining-lodging", "Phone (404) 965-9091"),
        ],
        allow_cross_host_fallback=False,
    )

    assert phone == "(404) 733-4800"


def test_extract_planning_note_from_text_handles_gallery_hours_and_address_blocks():
    text = """
    Gallery Hours Currently Closed for Install | Gallery Hours with resume 2/26
    Sun-Wed by appointment only
    Thurs- Saturday : 12pm- 5pm
    Phone: 470-727-2058
    Our Address: 352 University Ave SW, Atlanta, GA 30310
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "gallery hours" in note.lower()
    assert "appointment only" in note.lower()
    assert "352 university ave sw" in note.lower()


def test_extract_planning_note_from_text_handles_opened_visit_copy_and_admission():
    text = """
    Atlanta History Center Buckhead and the Margaret Mitchell House are opened Tuesday-Sunday from 9am-4pm.
    Admission Fee: General Admission - $15 for adults.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "tuesday-sunday from 9am-4pm" in note.lower()
    assert "admission fee" in note.lower()


def test_extract_planning_note_from_text_handles_hours_of_operation_copy():
    text = """
    Hours of Operation HALL OF FAME Open Wed - Mon 10 a.m. - 5 p.m. Closed Tuesdays.
    Address 250 Marietta St., N.W Atlanta, GA 30313 Phone [404] 880-4800
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "hours of operation" in note.lower()
    assert "open wed - mon 10 a.m. - 5 p.m." in note.lower()


def test_extract_planning_note_from_text_handles_reservations_and_available_hours():
    text = """
    Reservations: (404) 252-LAFF(5233)
    Available hours MON - FRI: 12:00PM - 10:00PM SAT: 10:00AM - 12:00PM SUN: 10:00AM - 9:00PM
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "available hours" in note.lower()


def test_extract_planning_note_from_text_handles_transit_parking_and_reservations_email():
    text = """
    The Battery Atlanta and Truist Park are accessible via CobbLinc, MARTA, and the Cumberland Circulator.
    Accessible parking is available at all of our parking decks.
    Multiple parking garages are located within walking distance of Cafe.
    Taking MARTA? We are located next to the Peachtree Center MARTA station.
    Dinner served until 9:30PM and all the fun happens on the entertainment level.
    Cover: $8 until 10PM | $10 after 10PM. Table reservations: reservations@atlantaeagle.com
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "marta" in note.lower()
    assert "accessible parking" in note.lower()
    assert "walking distance" in note.lower()
    assert "reservations@atlantaeagle.com" in note.lower()
    assert "cover" in note.lower()


def test_extract_planning_note_from_text_handles_doors_security_and_transit():
    text = """
    Doors to the venue open 90 minutes before a performance begins.
    There are now enhanced security screenings (metal detectors) in place for every performance. Please allow extra time to enter the venue.
    This section has information about directions, parking, dining, hotels & public transportation.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "doors to the venue open 90 minutes" in note.lower()
    assert "security screenings" in note.lower()
    assert "public transportation" in note.lower()


def test_extract_planning_note_from_text_handles_split_day_hours_blocks():
    text = """
    Hammonds House Museum 503 Peeples Street, SW | Atlanta, GA 30310
    Monday - Friday : Closed
    Saturday: 11am - 5pm
    Sunday: 12pm - 5pm
    Admission Fee: General Admission - $15
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "monday - friday : closed saturday: 11am - 5pm sunday: 12pm - 5pm" in note.lower()
    assert "admission fee" in note.lower()


def test_extract_planning_note_from_text_handles_bag_policy_rideshare_and_will_call():
    text = """
    We strongly recommend pre-purchasing game day parking before you arrive.
    Rideshare pick-up and drop-off access is available along Windy Ridge.
    Bag Policy: Bags are not allowed to enter the venue. Exceptions may be made for medical bags, diaper bags, and bags required for guests with ADA needs.
    Will Call with all tickets being mobile, will call as a service is no longer offered through the ticket office.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "pre-purchasing game day parking" in note.lower()
    assert "rideshare" in note.lower()
    assert "bag policy" in note.lower()


def test_extract_planning_note_from_text_handles_hospitality_reservations_and_patio():
    text = """
    Reservations are always encouraged.
    Double the patios, double the fun! The upstairs patio gets full sun in the afternoon and the downstairs patio is in the shade.
    Walk-ins are welcome when space allows.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "reservations are always encouraged" in note.lower()
    assert "double the patios" in note.lower()
    assert "walk-ins are welcome" in note.lower()


def test_extract_planning_note_from_text_strips_nav_junk():
    text = """
    Skip to content Parking and Directions - Park Bench Battery Click to Enlarge
    Parking is available at the venue parking garage for a fee starting at $20 per vehicle.
    Reservations Home Live Music Private Parties Calendar Reservations
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "skip to content" not in note.lower()
    assert "reservations home live music private parties calendar reservations" not in note.lower()
    assert "click to enlarge" not in note.lower()
    assert "parking and directions -" not in note.lower()
    assert "parking garage" in note.lower()


def test_extract_planning_note_from_text_prefers_concise_overlap_for_parking():
    text = """
    Parking is Available in the Green, Red, and Purple Decks as shown on the map.
    Parking is Available in the Green, Red, and Purple Decks as shown on the map. Parking and Directions Park Bench Atlanta 900 Battery Ave Suite 1060 Atlanta, GA 30339 (770) 575-2879 Parking is Available in the Green, Red, and Purple Decks as shown on the map.
    """

    note = _extract_planning_note_from_text(text)

    assert note is not None
    assert "green, red, and purple decks" in note.lower()
    assert "900 battery ave" not in note.lower()
    assert note.lower().count("parking is available in the green, red, and purple decks") == 1


def test_compose_hospitality_planning_note_trims_address_and_normalizes_21_plus():
    note = (
        "Open Hours Monday: 4p - 12a Tuesday: 4p - 12a Wednesday: 4p - 1a "
        "Thursday: 4p - 1a Friday: 4p - 2a Saturday: 4p - 2a Sunday: Closed "
        "In the heart of East Atlanta 1287 Glenwood Av SE, Suite B Atlanta, Georgia 30316 21 & Up."
    )

    composed = _compose_hospitality_planning_note(note, "bar")

    assert composed is not None
    assert composed.startswith("Open Monday: 4p - 12a")
    assert "1287 glenwood" not in composed.lower()
    assert composed.endswith("21+.")


def test_compose_hospitality_planning_note_drops_hours_only_copy():
    note = "Monday – Thursday 5 PM - 12 AM Friday – Saturday 5 PM – 2 AM Closed Sunday Follow."

    assert _compose_hospitality_planning_note(note, "bar") is None


def test_compose_hospitality_planning_note_drops_location_only_copy():
    note = "Location 602 North Highland Ave NE Atlanta, GA 30307 404-525-3447 manuelstavern."

    assert _compose_hospitality_planning_note(note, "bar") is None


def test_compose_hospitality_planning_note_trims_contact_footer_tail():
    note = (
        "Open late and transitions into music after hours on Friday & Saturday. "
        "Tuesday - Thursday: 5pm-10pm Friday - Saturday: 5pm-2am "
        "Contact Us 1271 Glenwood Ave SE Atlanta, GA 30316 General Manager Copyright."
    )

    composed = _compose_hospitality_planning_note(note, "bar")

    assert composed == (
        "Open late and transitions into music after hours on Friday & Saturday. "
        "Tuesday - Thursday: 5pm-10pm Friday - Saturday: 5pm-2am."
    )


def test_compose_hospitality_planning_note_prefers_dress_code_signal():
    note = (
        "Locations Back Locations Atlanta Chicago Delray Beach Denver Houston "
        "Le Colonial Logo Atlanta Reservations Le Colonial Atlanta 3035 Peachtree RD NE, Atlanta, GA 30305 "
        "Sunday - Thursday 12 PM - 10 PM Friday & Saturday 12 PM - 11 PM "
        "We politely request refined dinner attire."
    )

    composed = _compose_hospitality_planning_note(note, "restaurant")

    assert composed == "We politely request refined dinner attire."


def test_extract_embedded_html_text_decodes_next_payload_planning_copy():
    html = r"""
    <script>
    self.__next_f.push([1,"\u003cp\u003eThe Tabernacle strives to make our venue and live experiences inclusive and accessible.\u003c/p\u003e
    \u003cstrong\u003eAccessible Parking:\u003c/strong\u003e Discounted parking in a nearby deck is available.
    The deck includes an elevator.
    Our box office is open only on show days, 1 hour prior to show time.
    \u003cstrong\u003eArrival \u0026amp; Accessible Entrances:\u003c/strong\u003e If you require an accessible entrance, please head to the main entrance.
    "])
    </script>
    """

    text = _extract_embedded_html_text(html)

    assert "inclusive and accessible" in text.lower()
    assert "discounted parking in a nearby deck is available" in text.lower()
    assert "box office is open only on show days" in text.lower()
    assert "accessible entrances" in text.lower()


def test_extract_meta_description_text_collects_description_variants():
    html = """
    <html><head>
      <meta name="description" content="Directions and MARTA. We are located at 84 Luckie Street NW.">
      <meta property="og:description" content="Parking is available nearby.">
      <meta name="twitter:description" content="ADA accessible with elevator service.">
    </head></html>
    """

    text = _extract_meta_description_text(html)

    assert "84 luckie street nw" in text.lower()
    assert "parking is available nearby" in text.lower()
    assert "ada accessible with elevator service" in text.lower()


def test_maybe_website_hours_enrich_uses_candidate_pages(monkeypatch):
    venue = {
        "website": "https://www.georgiaaquarium.org/",
        "venue_type": "aquarium",
        "hours": None,
        "hours_source": None,
    }

    seen_urls = []

    def fake_scrape_hours(url):
        seen_urls.append(url)
        if url.endswith("/daily-schedule/"):
            return {
                "mon": {"open": "09:00", "close": "18:00"},
                "tue": {"open": "09:00", "close": "18:00"},
                "wed": {"open": "09:00", "close": "18:00"},
            }
        return None

    monkeypatch.setattr(
        "enrich_destination_slugs._candidate_planning_urls",
        lambda website: ["https://www.georgiaaquarium.org/daily-schedule/"],
    )
    monkeypatch.setattr("enrich_destination_slugs.scrape_hours_from_website", fake_scrape_hours)

    updates = _maybe_website_hours_enrich(venue)

    assert seen_urls == [
        "https://www.georgiaaquarium.org/",
        "https://www.georgiaaquarium.org/daily-schedule/",
    ]
    assert updates["hours_source"] == "website"
    assert updates["hours"]["mon"] == {"open": "09:00", "close": "18:00"}


def test_fetch_page_with_fallback_uses_curl_when_fetch_page_fails(monkeypatch):
    monkeypatch.setattr(
        "enrich_destination_slugs.fetch_page",
        lambda url: (_ for _ in ()).throw(RuntimeError("tls failed")),
    )
    monkeypatch.setattr("enrich_destination_slugs.validate_url", lambda url: url)

    class Result:
        stdout = "<html>curl ok</html>"

    monkeypatch.setattr("enrich_destination_slugs.subprocess.run", lambda *args, **kwargs: Result())

    assert _fetch_page_with_fallback("https://www.cfbhall.com/visit/") == "<html>curl ok</html>"


def test_maybe_planning_enrich_clears_stale_hospitality_note_when_only_boilerplate_remains(monkeypatch):
    venue = {
        "website": "https://example.com",
        "venue_type": "bar",
        "planning_notes": "Old noisy note",
        "phone": None,
    }

    monkeypatch.setattr("enrich_destination_slugs._candidate_planning_urls", lambda website: [])
    monkeypatch.setattr(
        "enrich_destination_slugs._fetch_page_with_fallback",
        lambda url: "<html><body>Monday – Thursday 5 PM - 12 AM Friday – Saturday 5 PM – 2 AM Closed Sunday Follow.</body></html>",
    )

    updates = _maybe_planning_enrich(venue)

    assert updates["planning_notes"] is None
    assert "planning_last_verified_at" in updates


def test_maybe_planning_enrich_clears_stale_hospitality_note_even_when_phone_matches(monkeypatch):
    venue = {
        "website": "https://example.com",
        "venue_type": "bar",
        "planning_notes": "Old noisy note",
        "phone": "(404) 555-0100",
    }

    monkeypatch.setattr("enrich_destination_slugs._candidate_planning_urls", lambda website: [])
    monkeypatch.setattr(
        "enrich_destination_slugs._fetch_page_with_fallback",
        lambda url: "<html><body>Monday – Thursday 5 PM - 12 AM Friday – Saturday 5 PM – 2 AM Closed Sunday Follow.</body></html>",
    )
    monkeypatch.setattr(
        "enrich_destination_slugs._select_first_party_phone",
        lambda website, page_texts, allow_cross_host_fallback: "(404) 555-0100",
    )

    updates = _maybe_planning_enrich(venue)

    assert updates["planning_notes"] is None
    assert "planning_last_verified_at" in updates
    assert "phone" not in updates


def test_maybe_parking_enrich_replaces_invalid_existing_note_with_osm(monkeypatch):
    venue = {
        "website": "https://example.com",
        "parking_note": "UPCOMING EVENTS Learn More WEEKLY SPECIAL RESERVATIONS",
        "lat": 33.75,
        "lng": -84.39,
    }

    monkeypatch.setattr("enrich_destination_slugs.extract_parking_info", lambda website: None)
    monkeypatch.setattr(
        "enrich_destination_slugs._osm_parking_for_venue",
        lambda lat, lng, osm_data: {
            "parking_note": "Nearest lot is 2 min walk. Paid parking nearby.",
            "parking_type": ["lot"],
            "parking_free": False,
            "parking_source": "osm",
        },
    )

    updates = _maybe_parking_enrich(venue, osm_data=[{}])

    assert updates["parking_note"] == "Nearest lot is 2 min walk. Paid parking nearby."
    assert updates["parking_source"] == "osm"


def test_maybe_parking_enrich_clears_invalid_existing_note_without_replacement(monkeypatch):
    venue = {
        "website": None,
        "parking_note": "UPCOMING EVENTS Learn More WEEKLY SPECIAL RESERVATIONS",
        "lat": None,
        "lng": None,
    }

    updates = _maybe_parking_enrich(venue, osm_data=None)

    assert updates["parking_note"] is None
    assert updates["parking_source"] is None


def test_maybe_parking_enrich_normalizes_existing_scraped_note():
    venue = {
        "website": "https://example.com",
        "parking_note": "reference the policies page for further details Valet parking is available during all hours of operation; Please do not park in the lots surrounding our building.",
        "parking_source": "scraped",
        "lat": 33.75,
        "lng": -84.39,
    }

    updates = _maybe_parking_enrich(venue, osm_data=[{}])

    assert updates["parking_note"] == (
        "Valet parking is available during all hours of operation; Please do not park in the lots surrounding our building."
    )


def test_needs_parking_cleanup_style_normalization_path():
    venue = {
        "parking_note": "reference the policies page for further details Valet parking is available during all hours of operation; Please do not park in the lots surrounding our building.",
        "parking_source": "scraped",
    }

    normalized_existing = _focused_parking_snippet(venue["parking_note"])

    assert normalized_existing != venue["parking_note"]
