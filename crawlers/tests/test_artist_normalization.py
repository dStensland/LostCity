"""Tests for artist name normalization."""

from artists import normalize_artist_name


def test_last_first_inversion():
    assert normalize_artist_name("Smith, Jane") == "Jane Smith"
    assert normalize_artist_name("Bailey, Radcliffe") == "Radcliffe Bailey"


def test_last_first_with_middle():
    assert normalize_artist_name("Shon, Jean M.") == "Jean M. Shon"


def test_no_inversion_for_normal_names():
    assert normalize_artist_name("Jean Shon") == "Jean Shon"
    assert normalize_artist_name("Kara Walker") == "Kara Walker"


def test_whitespace_normalization():
    assert normalize_artist_name("  Jean   Shon  ") == "Jean Shon"


def test_empty_and_none():
    assert normalize_artist_name("") == ""
    assert normalize_artist_name("   ") == ""
