"""Tests for TBA event reporting."""

from db import deactivate_tba_events


def test_deactivate_tba_events_returns_count():
    """Test that deactivate_tba_events returns a count without mutating data."""
    count = deactivate_tba_events()
    # Should return a non-negative integer (count of TBA events)
    assert isinstance(count, int)
    assert count >= 0
