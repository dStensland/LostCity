from sources.mercedes_benz_stadium import should_skip_official_match


def test_should_skip_official_match_skips_atlanta_united_match_placeholders():
    assert should_skip_official_match("Atlanta United vs. Philadelphia Union") is True
    assert should_skip_official_match("Atlanta United FC vs. D.C. United") is True
    assert should_skip_official_match("USMNT vs. Belgium") is True
    assert should_skip_official_match("18th Match - USMNT x Belgium") is True


def test_should_skip_official_match_keeps_non_match_titles():
    assert should_skip_official_match("Atlanta United x Tech Women of ATL") is False
    assert should_skip_official_match("Beyonce at Mercedes-Benz Stadium") is False
