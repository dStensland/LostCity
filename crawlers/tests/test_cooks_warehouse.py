from sources.cooks_warehouse import _sanitize_class_description


def test_sanitize_class_description_removes_schedule_and_policy_scaffolding():
    raw = (
        "Tuesday, April 7th - 6:30pm-9:30pm Prices are listed per person. "
        "Knife Skills 101 Hands On with Melissa Pelkey-Hass Master the blade and transform your cooking. "
        "This is a hands-on cooking class where you'll put your new skills to immediate use. "
        "We do not allow groups larger than six to book in public classes. "
        "Classes are held at the Ansley Mall Store."
    )

    cleaned = _sanitize_class_description("Knife Skills 101 Hands On", raw)

    assert cleaned == (
        "Melissa Pelkey-Hass Master the blade and transform your cooking. "
        "This is a hands-on cooking class where you'll put your new skills to immediate use."
    )


def test_sanitize_class_description_returns_none_for_empty_input():
    assert _sanitize_class_description("Knife Skills 101 Hands On", "") is None
