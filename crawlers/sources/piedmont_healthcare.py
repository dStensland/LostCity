"""
Main crawler for Piedmont Healthcare.

This is a coordinator crawler that imports events from multiple Piedmont sources:
- Piedmont Auxiliary (pahauxiliary.org/calendar)
- Piedmont Foundation (special events, galas, fundraisers)
- Piedmont Cancer Institute (support groups)
- Piedmont Classes (maternity, CPR, etc. via Inquicker)

Can be run standalone or as part of the main crawler system.
"""

from __future__ import annotations

import logging

from sources.piedmont_auxiliary import crawl as crawl_auxiliary
from sources.piedmont_foundation import crawl as crawl_foundation
from sources.piedmont_cancer_support import crawl as crawl_cancer_support
from sources.piedmont_classes import crawl as crawl_classes
from sources.piedmont_fitness import crawl as crawl_fitness

logger = logging.getLogger(__name__)


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all Piedmont Healthcare event sources.

    This coordinator runs all Piedmont-related crawlers and aggregates results.
    """
    total_found = 0
    total_new = 0
    total_updated = 0

    crawlers = [
        ("Piedmont Auxiliary", crawl_auxiliary),
        ("Piedmont Foundation", crawl_foundation),
        ("Piedmont Cancer Support", crawl_cancer_support),
        ("Piedmont Classes", crawl_classes),
        ("Piedmont Fitness", crawl_fitness),
    ]

    for name, crawler_func in crawlers:
        try:
            logger.info(f"Running {name} crawler...")
            found, new, updated = crawler_func(source)
            total_found += found
            total_new += new
            total_updated += updated
            logger.info(f"{name}: {found} found, {new} new, {updated} updated")
        except Exception as e:
            logger.error(f"Failed to run {name} crawler: {e}")
            # Continue with other crawlers even if one fails
            continue

    logger.info(
        f"Piedmont Healthcare crawl complete: "
        f"{total_found} found, {total_new} new, {total_updated} updated"
    )

    return total_found, total_new, total_updated
