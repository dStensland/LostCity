from show_signals import derive_show_signals, extract_ticket_status


def test_extracts_doors_and_sold_out():
    signals = derive_show_signals(
        {
            "title": "ALLEYCVT w/ Steller",
            "description": "Doors 7:30 PM. Show at 8:30pm. Sold out.",
            "ticket_url": "https://tickets.example.com",
            "tags": ["ticketed"],
        },
        preserve_existing=False,
    )

    assert signals["doors_time"] == "19:30:00"
    assert signals["ticket_status"] == "sold-out"


def test_detects_age_policy_with_precedence():
    signals = derive_show_signals(
        {
            "description": "This event is 21+ only with valid ID.",
            "tags": ["all-ages", "21+"],
        },
        preserve_existing=False,
    )

    assert signals["age_policy"] == "21+"


def test_detects_cancelled_ticket_status():
    signals = derive_show_signals(
        {
            "title": "Touring Artist Live",
            "description": "This event has been postponed. Original tickets will be honored.",
        },
        preserve_existing=False,
    )

    assert signals["ticket_status"] == "cancelled"


def test_extract_ticket_status_maps_schema_org_availability_values():
    assert extract_ticket_status("https://schema.org/InStock") == "tickets-available"
    assert extract_ticket_status("https://schema.org/SoldOut") == "sold-out"
    assert extract_ticket_status("https://schema.org/LimitedAvailability") == "low-tickets"
    assert extract_ticket_status("https://schema.org/EventCancelled") == "cancelled"
    assert extract_ticket_status("https://schema.org/EventPostponed") == "cancelled"
    assert extract_ticket_status("https://schema.org/EventRescheduled") == "cancelled"


def test_detects_sold_out_from_price_note_text() -> None:
    signals = derive_show_signals(
        {
            "title": "Touring Artist Live",
            "price_note": "Sales Ended",
            "ticket_url": "https://tickets.example.com/event/123",
        },
        preserve_existing=False,
    )

    assert signals["ticket_status"] == "sold-out"


def test_preserves_existing_values_when_requested():
    signals = derive_show_signals(
        {
            "description": "Doors 8:00 PM. No re-entry.",
            "doors_time": "17:30:00",
            "ticket_status": "low-tickets",
            "reentry_policy": "reentry-allowed",
            "set_times_mentioned": True,
        },
        preserve_existing=True,
    )

    assert signals["doors_time"] == "17:30:00"
    assert signals["ticket_status"] == "low-tickets"
    assert signals["reentry_policy"] == "reentry-allowed"
    assert signals["set_times_mentioned"] is True
