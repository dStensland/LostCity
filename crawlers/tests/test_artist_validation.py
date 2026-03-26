"""Tests for artist name validation gate."""

from artists import validate_artist_name


class TestRejectGarbage:
    def test_blocklist_names(self):
        assert not validate_artist_name("ARTISTS")
        assert not validate_artist_name("Various Artists")
        assert not validate_artist_name("Group Exhibition")
        assert not validate_artist_name("TBD")
        assert not validate_artist_name("TBA")

    def test_all_caps_single_word(self):
        assert not validate_artist_name("ARTISTS")
        assert not validate_artist_name("EXHIBITION")
        assert not validate_artist_name("GALLERY")

    def test_pipe_characters(self):
        assert not validate_artist_name("Artist One | Artist Two")
        assert not validate_artist_name("Name|Other")

    def test_purely_numeric(self):
        assert not validate_artist_name("2016")
        assert not validate_artist_name("12345")

    def test_too_short(self):
        assert not validate_artist_name("")
        assert not validate_artist_name("  ")
        assert not validate_artist_name("AB")

    def test_too_long(self):
        assert not validate_artist_name("A" * 201)


class TestAcceptValid:
    def test_normal_names(self):
        assert validate_artist_name("Jean Shon")
        assert validate_artist_name("Radcliffe Bailey")
        assert validate_artist_name("Kara Walker")

    def test_hyphenated_names(self):
        assert validate_artist_name("Jean-Michel Basquiat")

    def test_single_word_names_not_all_caps(self):
        assert validate_artist_name("Banksy")
        assert validate_artist_name("Christo")

    def test_names_with_suffixes(self):
        assert validate_artist_name("John Smith Jr.")
        assert validate_artist_name("Jane Doe III")

    def test_all_caps_multi_word_names(self):
        """Multi-word all-caps names are OK (some galleries format names this way)."""
        assert validate_artist_name("KARA WALKER")
        assert validate_artist_name("JEAN SHON")
