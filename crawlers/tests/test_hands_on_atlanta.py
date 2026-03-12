from sources.hands_on_atlanta import _build_event_title


def test_build_event_title_prefers_specific_name():
    opp = {
        "name": "Volunteer: Meal Delivery to Seniors",
        "organizationName": "Open Hand Atlanta",
        "purpose": "Food Delivery",
    }

    assert _build_event_title(opp) == "Volunteer: Meal Delivery to Seniors"


def test_build_event_title_falls_back_to_purpose_when_name_is_generic():
    opp = {
        "name": " Volunteer ",
        "organizationName": "Power Atlanta Inc",
        "purpose": "Handyman and Maintenance",
        "role": "Assist with minor repairs and equipment upkeep.",
    }

    assert _build_event_title(opp) == "Volunteer: Handyman and Maintenance"


def test_build_event_title_uses_org_name_as_last_resort():
    opp = {
        "name": "Opportunity",
        "organizationName": "Power Atlanta Inc",
        "purpose": "",
        "role": "",
    }

    assert _build_event_title(opp) == "Volunteer with Power Atlanta Inc"
