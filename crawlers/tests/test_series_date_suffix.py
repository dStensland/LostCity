from series import normalize_title


class TestNormalizeTitleDateSuffix:
    def test_pipe_month_day(self):
        assert normalize_title("Open Mic Night | Feb 25") == normalize_title("Open Mic Night | Mar 4")

    def test_pipe_full_month_day_year(self):
        assert normalize_title("Open Mic Night | February 25, 2026") == normalize_title("Open Mic Night | March 4, 2026")

    def test_dash_full_date(self):
        assert normalize_title("Trivia Tuesday - February 25, 2026") == normalize_title("Trivia Tuesday - March 4, 2026")

    def test_emdash_numeric_date(self):
        assert normalize_title("Jazz Night — 02/25") == normalize_title("Jazz Night — 03/04")

    def test_parens_date(self):
        assert normalize_title("Yoga Flow (2/25)") == normalize_title("Yoga Flow (3/4)")

    def test_parens_month_day(self):
        assert normalize_title("Comedy Show (Feb 25)") == normalize_title("Comedy Show (Mar 4)")

    def test_trailing_month_day_year(self):
        assert normalize_title("Trivia Tuesday February 25, 2026") == normalize_title("Trivia Tuesday March 4, 2026")

    def test_ordinals(self):
        assert normalize_title("Open Mic | Feb 25th") == normalize_title("Open Mic | Mar 4th")

    def test_preserves_non_date_titles(self):
        """Non-date titles should not be mangled."""
        assert normalize_title("may day celebration") == "may day celebration"
        assert normalize_title("march for justice") == "march for justice"
        assert "jazz" in normalize_title("Jazz Night at the Lounge")

    def test_base_title_matches(self):
        """All date variants normalize to the same base."""
        base = normalize_title("Open Mic Night")
        assert normalize_title("Open Mic Night | Feb 25") == base
        assert normalize_title("Open Mic Night — 02/25") == base
        assert normalize_title("Open Mic Night (Feb 25)") == base
