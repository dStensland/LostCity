"""
Activate sources that already exist but are inactive.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SOURCES_TO_ACTIVATE = ["midway-pub", "wild-heaven"]

def activate_sources():
    """Activate sources in the database."""
    client = get_client()
    
    for slug in SOURCES_TO_ACTIVATE:
        # Update source to active
        result = client.table("sources").update({"is_active": True}).eq("slug", slug).execute()
        logger.info(f"Activated source: {slug}")

if __name__ == "__main__":
    activate_sources()
