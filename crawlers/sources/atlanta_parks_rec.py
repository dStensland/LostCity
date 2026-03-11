"""
Compatibility wrapper for the `atlanta-parks-rec` source slug.

The old Atlanta.gov calendar scraper was low-signal and often returned zero
usable events. The ACTIVENet-backed crawler in `atlanta_dpr.py` is a much
better representation of Atlanta Parks & Recreation programming, so this slug
now delegates to that implementation.
"""

from __future__ import annotations

from sources.atlanta_dpr import crawl

__all__ = ["crawl"]
