from extractors.lineup import dedupe_artist_entries, split_lineup_text_with_roles
from artist_images import extract_artist_from_title
from db import parse_lineup_from_title, sanitize_event_artists


def test_split_lineup_with_roles_support_clause() -> None:
    entries = split_lineup_text_with_roles("Hearts Gone South w/ Sid Jerr-Dan | Greenways")

    assert entries[0] == {"name": "Hearts Gone South", "role": "headliner"}
    assert entries[1] == {"name": "Sid Jerr-Dan", "role": "support"}
    assert entries[2] == {"name": "Greenways", "role": "support"}


def test_split_lineup_with_roles_openers() -> None:
    entries = split_lineup_text_with_roles("Main Act opening Band Two + Band Three")

    assert entries[0] == {"name": "Main Act", "role": "headliner"}
    assert entries[1] == {"name": "Band Two", "role": "opener"}
    assert entries[2] == {"name": "Band Three", "role": "opener"}


def test_split_lineup_preserves_plus_band_name_for_headliner() -> None:
    entries = split_lineup_text_with_roles("Florence + The Machine")
    assert entries == [{"name": "Florence + The Machine", "role": "headliner"}]


def test_split_lineup_headliner_comma_list_splits_into_multiple_artists() -> None:
    entries = split_lineup_text_with_roles(
        "Confessions of a Traitor, Fight From Within, Exit Wounds, Spiritless"
    )
    assert entries == [
        {"name": "Confessions of a Traitor", "role": "headliner"},
        {"name": "Fight From Within", "role": "support"},
        {"name": "Exit Wounds", "role": "support"},
        {"name": "Spiritless", "role": "support"},
    ]


def test_split_lineup_does_not_split_earth_wind_and_fire() -> None:
    entries = split_lineup_text_with_roles("Earth, Wind & Fire")
    assert entries == [{"name": "Earth, Wind & Fire", "role": "headliner"}]


def test_dedupe_artist_entries_prefers_stronger_role() -> None:
    entries = dedupe_artist_entries(
        [
            {"name": "Artist A", "role": "support"},
            {"name": "Artist A", "role": "headliner"},
            {"name": "Artist B", "role": "support"},
        ]
    )

    assert entries == [
        {"name": "Artist A", "role": "headliner"},
        {"name": "Artist B", "role": "support"},
    ]


# ── Bug class 1: Bracket metadata should not produce artists ──────────


def test_bracket_content_stripped_before_splitting() -> None:
    """[FREE ENTRY W/ RSVP] should not cause 'RSVP]' to appear as support."""
    entries = split_lineup_text_with_roles("LYFE ATL [FREE ENTRY W/ RSVP]")
    names = [e["name"] for e in entries]
    assert "LYFE ATL" in names
    assert not any("RSVP" in n for n in names)


def test_bracket_sold_out_stripped() -> None:
    entries = split_lineup_text_with_roles("Billy Strings [SOLD OUT]")
    assert len(entries) == 1
    assert entries[0]["name"] == "Billy Strings"


# ── Bug class 2: "An Evening With" prefix + ampersand co-headliners ──


def test_evening_with_ampersand_coheadliners() -> None:
    """'An Evening With Ben Strawn & Rolling Jane' → two co-headliners."""
    entries = split_lineup_text_with_roles("An Evening With Ben Strawn & Rolling Jane")
    assert entries == [
        {"name": "Ben Strawn", "role": "headliner"},
        {"name": "Rolling Jane", "role": "headliner"},
    ]


def test_night_with_single_headliner() -> None:
    entries = split_lineup_text_with_roles("A Night With The Whispers")
    assert entries == [{"name": "The Whispers", "role": "headliner"}]


def test_evening_with_plus_band_preserved() -> None:
    entries = split_lineup_text_with_roles("An Evening With Florence + The Machine")
    assert entries == [{"name": "Florence + The Machine", "role": "headliner"}]


# ── Bug class: "X & the Y" band names must not be split ──────────────


def test_ampersand_the_band_name_preserved() -> None:
    """'Mel Bryant & the Mercy Makers' is a single band, not two artists."""
    entries = split_lineup_text_with_roles("Mel Bryant & the Mercy Makers")
    assert entries == [{"name": "Mel Bryant & the Mercy Makers", "role": "headliner"}]


def test_ampersand_the_band_with_support() -> None:
    entries = split_lineup_text_with_roles(
        "Mel Bryant & the Mercy Makers w/ Sid Jerr-Dan"
    )
    assert entries[0] == {"name": "Mel Bryant & the Mercy Makers", "role": "headliner"}
    assert entries[1] == {"name": "Sid Jerr-Dan", "role": "support"}


def test_tom_petty_and_the_heartbreakers_preserved() -> None:
    entries = split_lineup_text_with_roles("Tom Petty & the Heartbreakers")
    assert entries == [{"name": "Tom Petty & the Heartbreakers", "role": "headliner"}]


def test_evening_with_band_ampersand_the_preserved() -> None:
    """'An Evening With Hootie & the Blowfish' should not split the band."""
    entries = split_lineup_text_with_roles("An Evening With Hootie & the Blowfish")
    assert entries == [{"name": "Hootie & the Blowfish", "role": "headliner"}]


def test_parse_lineup_ampersand_the_band_preserved() -> None:
    entries = parse_lineup_from_title("Mel Bryant & the Mercy Makers")
    assert len(entries) == 1
    assert entries[0]["name"] == "Mel Bryant & the Mercy Makers"


def test_ampersand_his_band_name_preserved() -> None:
    """'James Brown & His Famous Flames' is a single act."""
    entries = split_lineup_text_with_roles("James Brown & His Famous Flames")
    assert entries == [{"name": "James Brown & His Famous Flames", "role": "headliner"}]


def test_ampersand_coheadliners_still_split() -> None:
    """'Ben Strawn & Rolling Jane' (no article) should still split."""
    entries = split_lineup_text_with_roles("An Evening With Ben Strawn & Rolling Jane")
    assert len(entries) == 2
    assert entries[0]["name"] == "Ben Strawn"
    assert entries[1]["name"] == "Rolling Jane"


def test_ampersand_not_split_in_extract() -> None:
    """'Simon & Garfunkel' should not be split on '&'.

    Note: 'Earth, Wind & Fire' still splits on the comma (a separate
    delimiter). The & fix prevents splitting band names that only use &.
    """
    result = extract_artist_from_title("Simon & Garfunkel")
    assert result == "Simon & Garfunkel"


def test_mumford_and_sons_preserved() -> None:
    result = extract_artist_from_title("Mumford & Sons")
    assert result == "Mumford & Sons"


# ── Bug class 3: Promoter prefix with "Presents:" ─────────────────────


def test_presents_prefix_stripped() -> None:
    """'Iris Presents: Habstrakt' should yield 'Habstrakt', not 'Iris Presents'."""
    result = extract_artist_from_title("Iris Presents: Habstrakt @ Believe Music Hall")
    assert result is not None
    assert "Habstrakt" in result
    assert "Iris" not in result


def test_productions_prefix_stripped() -> None:
    result = extract_artist_from_title("ATL Productions: Big Boi")
    assert result is not None
    assert "Big Boi" in result
    assert "Productions" not in result


def test_parse_colon_artist_tour_pattern() -> None:
    entries = parse_lineup_from_title("Home Free: Highways & High Seas Tour")
    assert len(entries) == 1
    assert entries[0]["name"] == "Home Free"


def test_parse_colon_presents_pattern() -> None:
    entries = parse_lineup_from_title("ASO Education Presents: Georgia Brass Band")
    assert len(entries) == 1
    assert entries[0]["name"] == "Georgia Brass Band"


def test_parse_colon_presents_with_trailing_descriptor() -> None:
    entries = parse_lineup_from_title("Monster Outbreak Tour Presents: Che: Encore")
    assert len(entries) == 1
    assert entries[0]["name"] == "Che"


def test_parse_colon_experience_pattern_uses_left_side_artist() -> None:
    entries = parse_lineup_from_title("KVS Tabla: The KVS Experience Atlanta")
    assert len(entries) == 1
    assert entries[0]["name"] == "KVS Tabla"


def test_parse_colon_orchestra_program_pattern_uses_left_side_artist() -> None:
    entries = parse_lineup_from_title("Atlanta Symphony Orchestra: Star Wars and More")
    assert len(entries) == 1
    assert entries[0]["name"] == "Atlanta Symphony Orchestra"


def test_parse_colon_show_with_ms_prefix_uses_right_side_artist() -> None:
    entries = parse_lineup_from_title("The Christi Show: Ms. Shirleen")
    assert len(entries) == 1
    assert entries[0]["name"] == "Ms. Shirleen"


def test_parse_colon_show_program_descriptor_uses_left_side_artist() -> None:
    entries = parse_lineup_from_title(
        "The Australian Pink Floyd Show: The Happiest Days Of Our Lives"
    )
    assert len(entries) == 1
    assert entries[0]["name"] == "The Australian Pink Floyd Show"


def test_parse_colon_session_jam_not_treated_as_artist() -> None:
    entries = parse_lineup_from_title("The Session: R&B Jam")
    assert entries == []


# ── Bug class 4: Generic recurring event titles ───────────────────────


def test_generic_live_music_saturday_rejected() -> None:
    assert parse_lineup_from_title("Live Music Saturday") == []


def test_generic_saturday_jazz_sessions_rejected() -> None:
    assert parse_lineup_from_title("Saturday Jazz Sessions") == []


def test_generic_karaoke_friday_rejected() -> None:
    assert parse_lineup_from_title("Karaoke Friday") == []


# ── Bug class 5: Date suffix not stripped ─────────────────────────────


def test_date_suffix_stripped() -> None:
    """Trailing '- February 21, 2026' should not produce '2026' as artist."""
    entries = parse_lineup_from_title("Robert Shaw Room Dinner - February 21, 2026")
    names = [e["name"] for e in entries]
    assert "2026" not in names
    assert not any("February" in n for n in names)


# ── Bug class 6: Venue branding / boilerplate ─────────────────────────


def test_nightclub_branding_rejected() -> None:
    assert parse_lineup_from_title("OPIUM NIGHTCLUB SATURDAYS") == []


def test_lounge_in_blocklist() -> None:
    result = extract_artist_from_title("Lounge")
    assert result is None


# ── Regressions: these must still parse correctly ─────────────────────


def test_regression_pipe_delimiter() -> None:
    entries = parse_lineup_from_title("Aych | Karezza")
    names = [e["name"] for e in entries]
    assert "Aych" in names
    assert "Karezza" in names


def test_regression_w_slash_delimiter() -> None:
    entries = parse_lineup_from_title("Priscilla Block w/ Greylan James")
    names = [e["name"] for e in entries]
    assert "Priscilla Block" in names
    assert "Greylan James" in names


def test_regression_single_artist() -> None:
    entries = parse_lineup_from_title("Billy Strings")
    assert len(entries) == 1
    assert entries[0]["name"] == "Billy Strings"
    assert entries[0]["is_headliner"] is True


def test_regression_single_word_acronym_artist() -> None:
    entries = parse_lineup_from_title("KWN")
    assert len(entries) == 1
    assert entries[0]["name"] == "KWN"


def test_regression_artist_name_with_suite_suffix() -> None:
    entries = parse_lineup_from_title("JOHNNY SUITE")
    assert len(entries) == 1
    assert entries[0]["name"] == "JOHNNY SUITE"


def test_regression_and_in_band_name() -> None:
    """'MARTY STUART AND HIS FABULOUS SUPERLATIVES' is a single act."""
    entries = parse_lineup_from_title("MARTY STUART AND HIS FABULOUS SUPERLATIVES")
    names = [e["name"] for e in entries]
    assert any("MARTY STUART" in n for n in names)


def test_regression_florence_plus_the_machine_not_split() -> None:
    entries = parse_lineup_from_title("Florence + The Machine")
    assert len(entries) == 1
    assert entries[0]["name"] == "Florence + The Machine"


def test_regression_earth_wind_and_fire_not_fragmented() -> None:
    entries = parse_lineup_from_title("Lionel Richie and Earth, Wind & Fire")
    names = [e["name"] for e in entries]
    assert "Wind & Fire" not in names
    assert "Lionel Richie and Earth" not in names


def test_sanitize_splits_title_mirror_comma_lineup() -> None:
    rows = sanitize_event_artists(
        "Confessions of a Traitor, Fight From Within, Exit Wounds, Spiritless",
        "music",
        [
            {
                "name": "Confessions of a Traitor, Fight From Within, Exit Wounds, Spiritless",
                "role": "headliner",
                "billing_order": 1,
                "is_headliner": True,
            }
        ],
    )
    assert [r["name"] for r in rows] == [
        "Confessions of a Traitor",
        "Fight From Within",
        "Exit Wounds",
        "Spiritless",
    ]


def test_sports_premium_seating_suffix_removed() -> None:
    rows = sanitize_event_artists(
        "Atlanta Braves v. Kansas City Royals * Premium Seating *",
        "sports",
        [],
    )
    assert [r["name"] for r in rows] == [
        "Atlanta Braves",
        "Kansas City Royals",
    ]
    assert [r["role"] for r in rows] == ["home", "away"]


def test_regression_ellipsis_title() -> None:
    entries = parse_lineup_from_title("Strumming Fore The Future...")
    assert len(entries) >= 1
    assert any("Strumming" in e["name"] for e in entries)


# ── Nightlife — should parse (DJ/performer events) ──────────────────


def test_nightlife_dj_at_venue_parsed() -> None:
    entries = parse_lineup_from_title("Marshmello @ Believe Music Hall")
    names = [e["name"] for e in entries]
    assert any("Marshmello" in n for n in names)


def test_nightlife_dj_with_support_parsed() -> None:
    entries = parse_lineup_from_title("DJ Snake w/ Valentino Khan")
    names = [e["name"] for e in entries]
    assert any("DJ Snake" in n for n in names)
    assert any("Valentino Khan" in n for n in names)


# ── Nightlife — should reject (generic nightlife titles) ────────────


def test_nightlife_ladies_night_rejected() -> None:
    assert parse_lineup_from_title("Ladies Night") == []


def test_nightlife_industry_night_friday_rejected() -> None:
    assert parse_lineup_from_title("Industry Night Friday") == []


def test_nightlife_happy_hour_rejected() -> None:
    assert parse_lineup_from_title("Happy Hour") == []


def test_nightlife_pool_party_rejected() -> None:
    assert parse_lineup_from_title("Pool Party") == []


def test_nightlife_bottle_service_saturday_rejected() -> None:
    assert parse_lineup_from_title("Bottle Service Saturday") == []


# ── Comedy — should reject (generic show format titles) ─────────────


def test_comedy_improv_jam_rejected() -> None:
    assert parse_lineup_from_title("Improv Jam") == []


def test_comedy_workshop_rejected() -> None:
    assert parse_lineup_from_title("Comedy Workshop") == []


def test_comedy_sketch_show_rejected() -> None:
    assert parse_lineup_from_title("Sketch Show") == []


def test_comedy_standup_showcase_rejected() -> None:
    assert parse_lineup_from_title("Stand-Up Showcase") == []


# ── Comedy — should parse (named performer events) ──────────────────


def test_comedy_named_performer_parsed() -> None:
    entries = parse_lineup_from_title("Dave Chappelle: Live")
    names = [e["name"] for e in entries]
    assert any("Dave Chappelle" in n for n in names)


def test_comedy_performer_with_support_parsed() -> None:
    entries = parse_lineup_from_title("Tom Segura w/ Christina P")
    names = [e["name"] for e in entries]
    assert any("Tom Segura" in n for n in names)
    assert any("Christina P" in n for n in names)


# ── Tightened filters — standalone activities always rejected ────────


def test_standalone_karaoke_night_rejected() -> None:
    assert parse_lineup_from_title("Karaoke Night") == []


def test_branded_karaoke_rejected() -> None:
    assert parse_lineup_from_title("Sip and Sing Karaoke") == []


def test_live_band_karaoke_rejected() -> None:
    assert parse_lineup_from_title("Live Band Karaoke") == []


def test_trivia_night_rejected() -> None:
    assert parse_lineup_from_title("Trivia Night") == []


def test_drag_bingo_rejected() -> None:
    assert parse_lineup_from_title("Drag Bingo") == []


def test_bingo_night_rejected() -> None:
    assert parse_lineup_from_title("Bingo Night") == []


def test_free_poker_night_rejected() -> None:
    assert parse_lineup_from_title("Free Poker Night at Neighbor's Pub") == []


def test_bowling_league_rejected() -> None:
    assert parse_lineup_from_title("Duckpin Bowling League") == []


def test_curling_night_rejected() -> None:
    assert parse_lineup_from_title("Curling Night at Ormsby's") == []


def test_improv_show_name_rejected() -> None:
    assert parse_lineup_from_title("All Star Improv") == []


# ── Tightened filters — generic themed nights rejected ──────────────


def test_salsa_night_rejected() -> None:
    assert parse_lineup_from_title("Salsa Night") == []


def test_drag_nite_rejected() -> None:
    assert parse_lineup_from_title("Drag Nite") == []


def test_friday_night_at_venue_rejected() -> None:
    assert parse_lineup_from_title("Friday Night at Ten Atlanta") == []


def test_saturday_night_djs_rejected() -> None:
    assert parse_lineup_from_title("Saturday Night DJs") == []


# ── Tightened filters — performer events still parse correctly ──────


def test_karaoke_with_named_host_extracts_host() -> None:
    """'Karaoke Night W/ Music Mike' should extract Music Mike, not Karaoke Night."""
    entries = parse_lineup_from_title("Karaoke Night W/ Music Mike")
    names = [e["name"] for e in entries]
    assert any("Music Mike" in n for n in names)
    assert not any("Karaoke" in n for n in names)


def test_dj_at_venue_still_parses() -> None:
    entries = parse_lineup_from_title("Boogie T @ Believe Music Hall")
    names = [e["name"] for e in entries]
    assert any("Boogie T" in n for n in names)
