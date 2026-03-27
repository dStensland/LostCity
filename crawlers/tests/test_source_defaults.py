from source_defaults import get_source_default


def test_painting_with_a_twist():
    assert get_source_default(source_id=554) == {"category": "workshops"}


def test_callanwolde_not_in_defaults():
    assert get_source_default(source_id=809) is None


def test_amc_theaters():
    assert get_source_default(source_name="AMC Phipps Plaza 14") == {"category": "film"}


def test_unknown_source():
    assert get_source_default(source_id=999999) is None


def test_coder_school():
    assert get_source_default(source_id=1318) == {"category": "education", "genre": "technology"}


def test_spruill():
    assert get_source_default(source_id=808) == {"category": "workshops"}


def test_recovery_slug():
    assert get_source_default(source_slug="alcoholics-anonymous-atlanta") == {"category": "support"}
