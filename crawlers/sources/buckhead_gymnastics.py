"""
Crawler for Buckhead Gymnastics Center — Atlanta, GA.

Platform: iClassPro (org code: buckheadgymnastics)
API: https://app.iclasspro.com/api/open/v1/buckheadgymnastics/classes

Address: 2351 Adams Drive, Atlanta, GA 30318
Phone: 404-367-4414

Programs offered:
  - Kindergym (ages 4–5)
  - Levels 1–5 (girls, ages 6–12)
  - Boys gymnastics (ages 6–12)
  - Preschool tumbling
  - Advanced/team classes

Category: fitness (structured gymnastics classes for kids)
Tags: gymnastics, kids, class, family-friendly
"""

from sources._iclasspro_base import IClassProConfig, crawl_iclasspro

_CONFIG = IClassProConfig(
    org_code="buckheadgymnastics",
    place_data={
        "name": "Buckhead Gymnastics Center",
        "slug": "buckhead-gymnastics-center",
        "address": "2351 Adams Drive",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.8302,
        "lng": -84.4073,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://portal.iclasspro.com/buckheadgymnastics/classes",
        "phone": "404-367-4414",
        "vibes": ["family-friendly", "kids", "gymnastics"],
    },
    default_category="fitness",
    default_tags=["gymnastics", "kids", "family-friendly", "class", "rsvp-required"],
    weeks_ahead=12,
)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Buckhead Gymnastics Center class schedule via iClassPro."""
    return crawl_iclasspro(source, _CONFIG)
