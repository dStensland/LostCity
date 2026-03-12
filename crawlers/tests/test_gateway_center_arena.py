from sources.gateway_center_arena import should_skip_official_lovb_match


def test_should_skip_official_lovb_match_skips_home_match_placeholders() -> None:
    assert should_skip_official_lovb_match("LOVB Atlanta vs LOVB Salt Lake")
    assert should_skip_official_lovb_match("LOVB Atlanta v. LOVB Nebraska")


def test_should_skip_official_lovb_match_keeps_non_lovb_titles() -> None:
    assert not should_skip_official_lovb_match("2026 Pepsi SWAC Basketball Tournament presented by Buick")
    assert not should_skip_official_lovb_match("Atlanta Dream vs Las Vegas Aces")
