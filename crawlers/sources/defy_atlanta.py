"""
DEPRECATED: Defy Atlanta (source 415).

Defy Atlanta was acquired by Sky Zone and no longer exists as a separate brand.
The 3200 Northlake Pkwy NE location now operates as Sky Zone Atlanta.

This crawler is permanently deactivated. Source 415 must remain is_active=false.
See sky_zone_atlanta.py for the current crawler covering that location.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Defy Atlanta no longer exists. Source should be inactive.
    If somehow activated, log a warning and return cleanly.
    """
    logger.warning(
        "defy_atlanta crawler called but this source is deprecated. "
        "Defy Atlanta was acquired by Sky Zone. See sky_zone_atlanta.py. "
        "Deactivate source 415 if not already done."
    )
    return 0, 0, 0
