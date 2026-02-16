from extractors.lineup import dedupe_artist_entries, split_lineup_text_with_roles


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
