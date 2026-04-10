"""Tests for past exhibition deactivation."""


def test_deactivate_past_exhibitions_is_importable():
    from scripts.deactivate_past_exhibitions import deactivate_past_exhibitions
    assert callable(deactivate_past_exhibitions)
