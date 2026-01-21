"""
Main crawler for Piedmont Healthcare.

This is a coordinator crawler that imports events from multiple Piedmont sources:
- Piedmont Auxiliary (pahauxiliary.org/calendar)
- Piedmont Foundation (special events, galas, fundraisers)
- Piedmont Cancer Institute (support groups)
- Piedmont Classes (maternity, CPR, etc. via Inquicker)
- Piedmont Fitness (fitness center schedules)
- Piedmont CME (continuing medical education)
- Piedmont Heart Conferences (cardiology conferences)
- Piedmont Women's Heart (support network)
- Piedmont Luminaria (oncology gala)
- Piedmont Transplant (transplant support groups)
- Piedmont Athens (spiritual care and support)
- Piedmont HealthCare Events (piedmonthealthcare.com)

Can be run standalone or as part of the main crawler system.
"""

from __future__ import annotations

import logging

from sources.piedmont_auxiliary import crawl as crawl_auxiliary
from sources.piedmont_foundation import crawl as crawl_foundation
from sources.piedmont_cancer_support import crawl as crawl_cancer_support
from sources.piedmont_classes import crawl as crawl_classes
from sources.piedmont_fitness import crawl as crawl_fitness
from sources.piedmont_cme import crawl as crawl_cme
from sources.piedmont_heart_conferences import crawl as crawl_heart_conferences
from sources.piedmont_womens_heart import crawl as crawl_womens_heart
from sources.piedmont_luminaria import crawl as crawl_luminaria
from sources.piedmont_transplant import crawl as crawl_transplant
from sources.piedmont_athens import crawl as crawl_athens
from sources.piedmonthealthcare_events import crawl as crawl_piedmonthealthcare

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
        ("Piedmont CME", crawl_cme),
        ("Piedmont Heart Conferences", crawl_heart_conferences),
        ("Piedmont Women's Heart", crawl_womens_heart),
        ("Piedmont Luminaria", crawl_luminaria),
        ("Piedmont Transplant", crawl_transplant),
        ("Piedmont Athens", crawl_athens),
        ("Piedmont HealthCare Events", crawl_piedmonthealthcare),
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
