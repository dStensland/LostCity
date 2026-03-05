"""
Activate MudFire Pottery Studio source.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def activate_mudfire():
    """Activate MudFire source in the database."""
    client = get_client()

    slug = "mudfire-pottery-studio"

    # Update source to active
    result = client.table("sources").update({
        "is_active": True,
        "integration_method": "playwright",
        "crawl_frequency": "daily"
    }).eq("slug", slug).execute()

    logger.info(f"Activated source: {slug}")
    logger.info(f"Result: {result}")

if __name__ == "__main__":
    activate_mudfire()
