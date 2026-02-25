"""Auto-generated profile-backed crawler for scott-antique-markets."""

from __future__ import annotations

from db import writes_enabled
from pipeline_main import run_profile

SLUG = "scott-antique-markets"


def crawl(source: dict) -> tuple[int, int, int]:
    """Run the shared profile pipeline for this source."""
    result = run_profile(SLUG, dry_run=not writes_enabled(), limit=None)
    return result.events_found, result.events_new, result.events_updated
