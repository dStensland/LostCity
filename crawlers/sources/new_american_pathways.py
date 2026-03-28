"""
Crawler for New American Pathways (newamericanpathways.org).

New American Pathways is an Atlanta nonprofit providing services to
refugees and immigrants: English language instruction, workforce
development, legal immigration services, health & wellbeing programs,
and civic engagement.

Events include:
- Community celebrations and cultural events
- Fundraisers and galas
- Volunteer engagement events
- Civic/advocacy events

Site uses WordPress + The Events Calendar (Tribe) plugin.
API endpoint: https://newamericanpathways.org/wp-json/tribe/events/v1/events
Events calendar: https://newamericanpathways.org/nap-events/

Note: New American Pathways publishes events infrequently — the calendar
may return 0 future events between cycles. This is expected behavior.
"""

from __future__ import annotations

from sources._tribe_events_base import TribeConfig, crawl_tribe

_CONFIG = TribeConfig(
    base_url="https://newamericanpathways.org",
    place_data={
        "name": "New American Pathways",
        "slug": "new-american-pathways",
        "address": "2300 Lake Park Dr SE Suite 200",
        "neighborhood": "Smyrna",
        "city": "Smyrna",
        "state": "GA",
        "zip": "30080",
        "lat": 33.8784,
        "lng": -84.5144,
        "place_type": "organization",
        "spot_type": "organization",
        "website": "https://newamericanpathways.org",
    },
    default_category="community",
    default_tags=["refugee-services", "immigrant-community", "nonprofit"],
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_tribe(source, _CONFIG)
