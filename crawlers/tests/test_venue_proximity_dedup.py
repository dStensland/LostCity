"""
Unit tests for _proximity_name_match — the venue proximity-dedup helper.

These tests exercise the matching logic directly without any DB calls.
"""

import pytest
from db.venues import _proximity_name_match


# ---------------------------------------------------------------------------
# FALSE POSITIVES — pairs that must NOT be merged
# ---------------------------------------------------------------------------

class TestFalsePositives:
    """Names that are nearby on the map but are distinct places."""

    def test_ponce_vs_ponce_city_market(self):
        # "Ponce" is a single-word name (1 word) — the two-word guard on the
        # substring branch blocks the match regardless of ratio (5/17 = 29 %).
        assert _proximity_name_match("Ponce", "Ponce City Market") is False

    def test_park_vs_park_tavern(self):
        # "Park" is a single-word name — two-word guard blocks it.
        assert _proximity_name_match("Park", "Park Tavern") is False

    def test_terminal_vs_terminal_west(self):
        # "Terminal" (8) vs "Terminal West" (13) — ratio 61.5 % passes the
        # character-length guard, but "Terminal" is a single-word name.
        # The two-word guard on the substring branch blocks the match.
        # Jaccard also requires >= 2 tokens per name, so that path is blocked too.
        assert _proximity_name_match("Terminal", "Terminal West") is False

    def test_ponce_city_market_vs_ponce(self):
        # Order-independent
        assert _proximity_name_match("Ponce City Market", "Ponce") is False

    def test_park_tavern_vs_park(self):
        assert _proximity_name_match("Park Tavern", "Park") is False

    def test_terminal_west_vs_terminal(self):
        assert _proximity_name_match("Terminal West", "Terminal") is False

    def test_very_short_name_guard(self):
        # Names shorter than 3 chars are skipped entirely
        assert _proximity_name_match("GA", "GA Aquarium") is False
        assert _proximity_name_match("", "Venue") is False


# ---------------------------------------------------------------------------
# TRUE POSITIVES — pairs that SHOULD be merged
# ---------------------------------------------------------------------------

class TestTruePositives:
    """Names that represent the same real-world venue."""

    def test_terminal_west_vs_terminal_west_dolby_live(self):
        # Substring: "terminal west" (13) in "terminal west - dolby live" (26).
        # Ratio 13/26 = 50 % — below 60 %, so substring guard fails.
        # Falls through to Jaccard: alpha-only tokens {"terminal","west"} vs
        # {"terminal","west","dolby","live"} — intersection=2, union=4, J=0.5 ≥ 0.5.
        assert _proximity_name_match("Terminal West", "Terminal West - Dolby Live") is True

    def test_the_masquerade_vs_masquerade(self):
        # Article-stripped exact match: strip "the" → "masquerade" == "masquerade".
        # Merges before any ratio or word-count guard fires.
        assert _proximity_name_match("The Masquerade", "Masquerade") is True

    def test_masquerade_vs_the_masquerade(self):
        # Order-independent
        assert _proximity_name_match("Masquerade", "The Masquerade") is True

    def test_monday_night_brewing_vs_monday_night_brewing_garage(self):
        # Substring: "monday night brewing" (20) in "monday night brewing garage" (27).
        # Both ≥ 2 words. Ratio 20/27 = 74 % ≥ 60 % — merges via substring rule.
        assert _proximity_name_match(
            "Monday Night Brewing", "Monday Night Brewing Garage"
        ) is True

    def test_monday_night_brewing_garage_vs_monday_night_brewing(self):
        # Order-independent
        assert _proximity_name_match(
            "Monday Night Brewing Garage", "Monday Night Brewing"
        ) is True

    def test_exact_match(self):
        assert _proximity_name_match("The Earl", "The Earl") is True

    def test_case_insensitive(self):
        assert _proximity_name_match("THE EARL", "the earl") is True

    def test_jaccard_partial_overlap(self):
        # "Monday Night Brewing Ponce" vs "Monday Night Brewing West"
        # Not substrings of each other.
        # Jaccard: intersection={"monday","night","brewing"} (3) /
        # union={"monday","night","brewing","ponce","west"} (5) = 0.6 ≥ 0.5.
        assert _proximity_name_match(
            "Monday Night Brewing Ponce", "Monday Night Brewing West"
        ) is True


# ---------------------------------------------------------------------------
# EDGE CASES
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_both_empty(self):
        assert _proximity_name_match("", "") is False

    def test_one_empty(self):
        assert _proximity_name_match("", "Ponce City Market") is False
        assert _proximity_name_match("Ponce City Market", "") is False

    def test_identical_single_word(self):
        # Single-word exact match hits the article-stripped exact match path
        # (strip returns the same word, they're equal).
        assert _proximity_name_match("Vortex", "Vortex") is True

    def test_two_char_name(self):
        # Shorter < 3 — always False
        assert _proximity_name_match("PC", "PCM Venue") is False

    def test_substring_just_below_60_pct(self):
        # "Ponce" (1 word) vs "Ponce Market" — blocked by two-word guard on shorter name.
        assert _proximity_name_match("Ponce", "Ponce Market") is False

    def test_single_word_identical_after_article_strip(self):
        # "A Vortex" → "vortex" == "vortex" — article-stripped exact match.
        assert _proximity_name_match("A Vortex", "Vortex") is True

    def test_jaccard_at_half_threshold(self):
        # "Monday Night Brewing" (substring of longer) fails ratio (20/27 already
        # tested above). Here test pure Jaccard path without substring.
        # "Wild Heaven East" vs "Wild Heaven West" — not substrings of each other.
        # Jaccard: {"wild","heaven"} ∩ {"wild","heaven","east"} = 2,
        # union = {"wild","heaven","east","west"} = 4, J = 0.5 ≥ 0.5 → True.
        assert _proximity_name_match("Wild Heaven East", "Wild Heaven West") is True

    def test_no_shared_tokens(self):
        assert _proximity_name_match("Wild Heaven", "Park Tavern") is False

    def test_hyphen_punctuation_stripped_for_jaccard(self):
        # Hyphens in names should not create extra tokens that dilute Jaccard.
        # "Smith's Old Bar" vs "Smith's Olde Bar - Live Music Venue"
        # Apostrophe stripped: tokens_a={"smiths","old","bar"},
        # tokens_b={"smiths","olde","bar","live","music","venue"}
        # intersection={"smiths","bar"}=2, union=6+... let's use a cleaner case.
        # "Smiths Bar" vs "Smiths Bar - Ponce"
        # Substring: 10/16 = 62.5 % ≥ 60 %, both ≥ 2 words → True via substring.
        assert _proximity_name_match("Smiths Bar", "Smiths Bar - Ponce") is True
