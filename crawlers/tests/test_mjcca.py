from sources.mjcca import should_skip_event


def test_should_skip_join_first_sports_programs():
    assert should_skip_event("Young Professionals Basketball League") is True
    assert should_skip_event("Men’s Soccer League") is True
    assert should_skip_event("Women’s Soccer League") is True
    assert should_skip_event("Adult Women’s Basketball League") is True
    assert should_skip_event("ALTA Pickleball") is True
    assert should_skip_event("Debra “Debbie” Sonenshine SOAR Pickleball") is True


def test_should_keep_public_cultural_events():
    assert should_skip_event("Jerry’s Habima Theatre: Mary Poppins JR") is False
    assert should_skip_event("The Art of Mitzvah: A Journey Through Jewish Ritual Beauty") is False
