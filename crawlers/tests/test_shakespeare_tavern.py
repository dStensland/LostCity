from sources.shakespeare_tavern import _determine_category


def test_determine_category_uses_family_for_kids_camps():
    category, tags = _determine_category(
        "Shakespeare Superheroes: Much Ado About Nothing",
        "Week-long camp for rising 2nd-5th grades.",
    )

    assert category == "family"
    assert "kids" in tags
    assert "family-friendly" in tags


def test_determine_category_uses_learning_for_sit():
    category, tags = _determine_category(
        "Shakespeare Intensive for Teens (SIT) – Session 1",
        "Four-week audition-based summer intensive for rising 9th grade through college freshmen.",
    )

    assert category == "learning"
    assert "teen" in tags
    assert "educational" in tags
