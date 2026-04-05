"""Tests for _looks_like_band_with_ampersand heuristics."""


from extractors.lineup import _looks_like_band_with_ampersand


class TestLooksLikeBandWithAmpersand:
    # ------------------------------------------------------------------ #
    # Should be recognised as a single band (return True)                 #
    # ------------------------------------------------------------------ #

    def test_article_the_pattern(self):
        assert _looks_like_band_with_ampersand("Mel Bryant & the Mercy Makers")

    def test_hootie(self):
        assert _looks_like_band_with_ampersand("Hootie & the Blowfish")

    def test_tom_petty(self):
        assert _looks_like_band_with_ampersand("Tom Petty & the Heartbreakers")

    def test_florence(self):
        assert _looks_like_band_with_ampersand("Florence & the Machine")

    def test_of_pattern(self):
        assert _looks_like_band_with_ampersand("Lukas Nelson & Promise of the Real")

    def test_possessive(self):
        assert _looks_like_band_with_ampersand("Jack & Jill's Adventure")

    def test_short_name_simon_garfunkel(self):
        # 19 chars — under the 20-char threshold
        assert _looks_like_band_with_ampersand("Simon & Garfunkel")

    def test_a_article(self):
        assert _looks_like_band_with_ampersand("Bob & a Band of Brothers")

    def test_an_article(self):
        assert _looks_like_band_with_ampersand("Echo & an Earful")

    # ------------------------------------------------------------------ #
    # Should NOT be recognised as a single band (return False)            #
    # These are genuine co-headliners that ought to be split.             #
    # ------------------------------------------------------------------ #

    def test_no_ampersand(self):
        assert not _looks_like_band_with_ampersand("The Black Keys")

    def test_two_multi_word_names(self):
        assert not _looks_like_band_with_ampersand("Tedeschi Trucks Band & Los Lobos")

    def test_two_real_artists_long(self):
        assert not _looks_like_band_with_ampersand(
            "Jason Isbell & Amanda Shires Live in Concert"
        )

    # NOTE: "The Brothers Johnson & The Gap Band" cannot be reliably handled
    # at the heuristic level — "The Gap Band" starts with "the", which
    # correctly triggers the article rule for cases like "the Heartbreakers".
    # This edge-case (two bands both starting with "The") is handled upstream
    # by the DB artist lookup in sanitize_event_artists, not here.
