"""
Crawler for Georgia Gymnastics Academy — Suwanee, GA.

Platform: JackRabbit (org ID: 509235)
Public endpoint: https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS?OrgID=509235

Address: 145 Old Peachtree Road N.W., Suwanee, GA 30024
Phone: (770) 945-3424 / (678) 926-3942
Website: https://www.georgiagymnasticsacademy.com

Programs offered (83 class slots):
  - Mommy & Me (ages 1yr 3mos – 2yr 6mos)
  - TumbleTykes® 2–3yr (TT2, TT2y, TT3)
  - TumbleTykes® 3–4yr (TT3, TT4)
  - K / 1st Grade classes (ages 5–6)
  - Novice 1 Young (ages 5–6)
  - Novice 1–3 (ages 6–12)
  - Intermediate / Advanced
  - Team gymnastics
  - Summer camps (via special events)

Suwanee is in Gwinnett County, ~35 min north of Atlanta.
Serves the metro Atlanta family portal for the north suburbs.

Category: fitness (gymnastics programs for children)
Tags: gymnastics, kids, class, family-friendly
"""

from sources._jackrabbit_base import JackRabbitConfig, crawl_jackrabbit

_CONFIG = JackRabbitConfig(
    org_id="509235",
    place_data={
        "name": "Georgia Gymnastics Academy",
        "slug": "georgia-gymnastics-academy",
        "address": "145 Old Peachtree Road NW",
        "neighborhood": "Suwanee",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "lat": 34.0518,
        "lng": -84.0678,
        "place_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.georgiagymnasticsacademy.com",
        "phone": "(770) 945-3424",
        "vibes": ["family-friendly", "kids", "gymnastics"],
    },
    default_category="fitness",
    default_tags=["gymnastics", "kids", "family-friendly", "class", "rsvp-required"],
    enrollment_url="https://app.jackrabbitclass.com/regv2.asp?id=509235",
    weeks_ahead=12,
)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Georgia Gymnastics Academy class schedule via JackRabbit."""
    return crawl_jackrabbit(source, _CONFIG)
