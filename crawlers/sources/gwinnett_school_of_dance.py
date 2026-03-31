"""
Crawler for Gwinnett School of Dance — Grayson, GA.

Platform: JackRabbit (org ID: 517929)
Public endpoint: https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS?OrgID=517929

Address: 2057 Grayson Highway, Grayson, GA 30017
Phone: (770) 962-8078
Email: info@gwinnettschoolofdance.com
Website: https://www.gwinnettschoolofdance.com

Programs offered (46 class slots, all with detailed descriptions):
  - Pre-Ballet 1 & 2 (ages 3–6)
  - Ballet/Tumble (ages 3–6)
  - Ballet/Tap 1 (ages 5–7)
  - Intro to Lyrical (ages 8–10)
  - Jazz / Hip Hop Prep (ages 5–7)
  - Intermediate Jazz / Lyrical (ages 8+)
  - Teen/Adult Jazz (ages 13+)
  - Contemporary, Hip Hop, and more levels

Grayson is in eastern Gwinnett County, ~30 miles northeast of Atlanta.
Serves the Gwinnett/Lawrenceville/Snellville/Grayson family market.

Category: dance (structured dance classes for kids through adults)
Tags: dance, ballet, kids, class, family-friendly
"""

from sources._jackrabbit_base import JackRabbitConfig, crawl_jackrabbit

_CONFIG = JackRabbitConfig(
    org_id="517929",
    place_data={
        "name": "Gwinnett School of Dance",
        "slug": "gwinnett-school-of-dance",
        "address": "2057 Grayson Highway",
        "neighborhood": "Grayson",
        "city": "Grayson",
        "state": "GA",
        "zip": "30017",
        "lat": 33.8908,
        "lng": -83.9779,
        "place_type": "fitness_center",
        "spot_type": "fitness",
        "website": "https://www.gwinnettschoolofdance.com",
        "description": (
            "Gwinnett School of Dance in Grayson offers ballet, tap, tumbling, jazz, "
            "hip hop, lyrical, and contemporary classes for kids, teens, and adults."
        ),
        "image_url": "http://static1.squarespace.com/static/68dca836e2574146823a2c03/t/68dcb20be0d53a7931085256/1759293963664/GSD_logo_white.png?format=1500w",
        "phone": "(770) 962-8078",
        "vibes": ["family-friendly", "kids", "dance"],
    },
    default_category="dance",
    default_tags=["dance", "ballet", "kids", "family-friendly", "class", "rsvp-required"],
    enrollment_url="https://app.jackrabbitclass.com/regv2.asp?id=517929",
    weeks_ahead=12,
)


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gwinnett School of Dance class schedule via JackRabbit."""
    return crawl_jackrabbit(source, _CONFIG)
