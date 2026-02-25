"""Auto-generated profile-backed crawler for wais-gong-fu-tea."""

from __future__ import annotations

from db import writes_enabled
from pipeline_main import run_profile

SLUG = "wais-gong-fu-tea"


def crawl(source: dict) -> tuple[int, int, int]:
    """Run the shared profile pipeline for this source."""
    result = run_profile(SLUG, dry_run=not writes_enabled(), limit=None)
    return result.events_found, result.events_new, result.events_updated
