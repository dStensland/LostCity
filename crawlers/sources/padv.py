"""
Crawler for Partnership Against Domestic Violence (padv.org).

PADV provides crisis intervention, advocacy, and prevention services for
survivors of domestic violence in the Atlanta metro area.

Events include:
- Community fundraising galas (Hearts with Hope, Women in Action)
- Candlelight vigils and awareness events
- Teen summits
- DV clinical training for professionals
- Community education workshops

Site uses WordPress + The Events Calendar (Tribe) plugin.
API endpoint: https://padv.org/wp-json/tribe/events/v1/events

Note: PADV does not post events year-round — long gaps between listings
are expected. The crawler handles this gracefully via the Tribe base.
"""

from __future__ import annotations

from sources._tribe_events_base import TribeConfig, crawl_tribe

_CONFIG = TribeConfig(
    base_url="https://padv.org",
    place_data={
        "name": "Partnership Against Domestic Violence",
        "slug": "padv",
        "address": "P.O. Box 170009",
        "neighborhood": "East Atlanta Village",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30317",
        "lat": 33.7391,
        "lng": -84.3371,
        "venue_type": "organization",
        "spot_type": "organization",
        "website": "https://padv.org",
    },
    default_category="community",
    default_tags=["domestic-violence", "awareness", "nonprofit"],
)


def crawl(source: dict) -> tuple[int, int, int]:
    return crawl_tribe(source, _CONFIG)
