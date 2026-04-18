"""Tests for crawlers/extractors/doors_time.py."""

from __future__ import annotations

from typing import Optional

import pytest

from extractors.doors_time import extract_doors_time


@pytest.mark.parametrize(
    "text,expected",
    [
        # Core patterns from spec
        ("Doors open at 7 PM", "19:00"),
        ("doors: 8:30 pm", "20:30"),
        ("DOORS 7PM / SHOW 8PM", "19:00"),
        ("7:00 PM Doors", "19:00"),
        ("Doors at 11 AM", "11:00"),
        # Edge: midnight and noon
        ("doors 12 AM", "00:00"),
        ("doors 12 PM", "12:00"),
        # Should NOT match (no doors keyword)
        ("Show at 8 pm", None),
        # Empty / None input
        (None, None),
        ("", None),
        # Varied formatting
        ("Doors Open At 6:30 PM", "18:30"),
        ("DOORS - 8 PM", "20:00"),
        ("Door at 9 pm", "21:00"),
        ("9:30pm Doors", "21:30"),
        ("doors open 10pm", "22:00"),
        # Periods in AM/PM
        ("Doors at 7 p.m.", "19:00"),
        ("Doors at 11 a.m.", "11:00"),
        # Realistic multi-field line
        ("Doors: 7:00 PM / Show: 8:00 PM", "19:00"),
        # Make sure 12 AM -> 00:00 and 12 PM -> 12:00
        ("doors: 12:00 AM", "00:00"),
        ("doors: 12:00 PM", "12:00"),
        ("doors: 12:30 PM", "12:30"),
        ("doors: 12:30 AM", "00:30"),
    ],
)
def test_extract_doors_time(text: Optional[str], expected: Optional[str]) -> None:
    assert extract_doors_time(text) == expected
