"""
LLM-based discovery from a single HTML page.
Uses the existing extract_events() logic.
"""

from __future__ import annotations

import logging
from typing import Any

from extract import extract_events

logger = logging.getLogger(__name__)


def discover_from_llm(html: str, url: str, source_name: str) -> list[dict[str, Any]]:
    if not html:
        return []

    events = extract_events(html, url, source_name)
    results: list[dict[str, Any]] = []

    for event in events:
        try:
            results.append(event.model_dump())
        except Exception:
            # Fallback for older pydantic or raw dicts
            results.append(dict(event))

    return results
