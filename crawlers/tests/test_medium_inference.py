"""Tests for exhibition medium inference from title/description keywords."""

from medium_inference import infer_exhibition_medium


class TestTitleMatching:
    def test_painting_keywords(self):
        assert infer_exhibition_medium("Oil Paintings by Jane Doe") == "painting"
        assert infer_exhibition_medium("Watercolor Landscapes") == "painting"

    def test_photography_keywords(self):
        assert infer_exhibition_medium("Photographs of the American South") == "photography"
        assert infer_exhibition_medium("Cyanotype Dreams") == "photography"

    def test_sculpture_keywords(self):
        assert infer_exhibition_medium("Bronze Sculptures: A Retrospective") == "sculpture"
        assert infer_exhibition_medium("Carved in Stone") == "sculpture"

    def test_printmaking_keywords(self):
        assert infer_exhibition_medium("Lithographs and Etchings") == "printmaking"
        assert infer_exhibition_medium("Screenprint Workshop Show") == "printmaking"

    def test_drawing_keywords(self):
        assert infer_exhibition_medium("Charcoal Drawings") == "drawing"
        assert infer_exhibition_medium("Works in Graphite") == "drawing"

    def test_textile_keywords(self):
        assert infer_exhibition_medium("Fiber Arts: Weaving Traditions") == "textile"
        assert infer_exhibition_medium("Contemporary Quilts") == "textile"

    def test_digital_keywords(self):
        assert infer_exhibition_medium("Generative Art: Code as Canvas") == "digital"
        assert infer_exhibition_medium("Video Installation") == "digital"

    def test_ceramics_keywords(self):
        assert infer_exhibition_medium("Pottery and Porcelain") == "ceramics"
        assert infer_exhibition_medium("Stoneware Forms") == "ceramics"

    def test_installation_keywords(self):
        assert infer_exhibition_medium("Site-Specific Installation") == "installation"
        assert infer_exhibition_medium("Immersive Experience") == "installation"

    def test_mixed_media_keywords(self):
        assert infer_exhibition_medium("Mixed Media Assemblage") == "mixed_media"
        assert infer_exhibition_medium("Collage and Found Objects") == "mixed_media"


class TestMultipleMedia:
    def test_multiple_media_returns_mixed(self):
        """When multiple distinct media detected, return mixed_media."""
        assert infer_exhibition_medium("Paintings and Sculptures") == "mixed_media"
        assert infer_exhibition_medium("Photography, Drawing, and Printmaking") == "mixed_media"


class TestNoMatch:
    def test_ambiguous_title_returns_none(self):
        assert infer_exhibition_medium("New Horizons") is None
        assert infer_exhibition_medium("Group Exhibition") is None
        assert infer_exhibition_medium("The Great Migration") is None

    def test_empty_input(self):
        assert infer_exhibition_medium("") is None
        assert infer_exhibition_medium("", "") is None


class TestDescriptionFallback:
    def test_description_used_when_title_has_no_match(self):
        result = infer_exhibition_medium(
            "New Horizons",
            "A collection of watercolor and gouache paintings."
        )
        assert result == "painting"

    def test_title_takes_precedence_over_description(self):
        result = infer_exhibition_medium(
            "Bronze Sculptures",
            "The artist also works in photography."
        )
        assert result == "sculpture"


class TestWordBoundary:
    def test_print_does_not_match_in_printmakers(self):
        """'print' should match as a medium keyword but not inside 'printmakers' venue name."""
        # 'print' as standalone word should match printmaking
        assert infer_exhibition_medium("Fine Art Prints") == "printmaking"

    def test_ink_does_not_match_inside_thinking(self):
        """'ink' should only match as a word boundary, not inside 'thinking'."""
        assert infer_exhibition_medium("Thinking About Art") is None
        assert infer_exhibition_medium("Works in Ink") == "drawing"
