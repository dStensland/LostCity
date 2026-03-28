"""
Crawler for Atlanta School of Gymnastics — Tucker, GA.

Platform: JackRabbit (org ID: 549755)
Public endpoint: https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS?OrgID=549755

Address: 3345 Montreal Station, Tucker, GA 30084
Phone: (770) 938-1212
Website: https://atlantaschoolofgymnastics.net

Programs offered (197 class slots):
  - Parent Child 1 (ages 18 mos – 2 yr 11 mos)
  - Parent Child 2 (toddlers)
  - Gym Steps 1–3 (ages 3–6)
  - Gymnastics Levels 1–5 (ages 6–12)
  - Boys gymnastics
  - Xcel Bronze/Silver/Gold/Platinum team classes
  - Tumbling classes
  - Summer intensive / extra practice

Tucker is in DeKalb County, ~15 miles east of Atlanta.
Serves metro Atlanta families — kids' gymnastics programs.

Category: fitness (gymnastics programs for children)
Tags: gymnastics, kids, class, family-friendly
"""

from sources._jackrabbit_base import JackRabbitConfig, crawl_jackrabbit

_CONFIG = JackRabbitConfig(
    org_id="549755",
    place_data={
        "name": "Atlanta School of Gymnastics",
        "slug": "atlanta-school-of-gymnastics",
        "address": "3345 Montreal Station",
        "neighborhood": "Tucker",
        "city": "Tucker",
        "state": "GA",
        "zip": "30084",
        "lat": 33.8571,
        "lng": -84.2165,
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://atlantaschoolofgymnastics.net",
        "phone": "(770) 938-1212",
        "vibes": ["family-friendly", "kids", "gymnastics"],
    },
    default_category="fitness",
    default_tags=["gymnastics", "kids", "family-friendly", "class", "rsvp-required"],
    enrollment_url="https://app.jackrabbitclass.com/regv2.asp?id=549755",
    weeks_ahead=12,
)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Atlanta School of Gymnastics class schedule via JackRabbit."""
    return crawl_jackrabbit(source, _CONFIG)
