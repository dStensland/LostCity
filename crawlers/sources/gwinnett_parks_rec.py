"""
Crawler for Gwinnett County Parks & Recreation
(secure.rec1.com/GA/gwinnett-county-parks-recreation).

Gwinnett County runs its parks registration portal on the Rec1 (CivicRec) platform.
This crawler delegates to _rec1_base.crawl_tenant() with Gwinnett-specific config.

Tenant slug: gwinnett-county-parks-recreation
Catalog: https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog

Program tabs crawled (by Rec1 tab ID):
  819  Events
  820  Active Adults 50+
  825  Classes & Activities
  823  Aquatics
  953  Wellness
  955  Sports
  930  Camps
  822  Education
  821  Nature & History

Skipped tabs (not actual events):
  824  Rental Venues

Major venues pre-mapped (Gwinnett County recreation facilities):
  - George Pierce Park Community Recreation Center (Suwanee)
  - Bethesda Community Recreation Center (Lawrenceville)
  - BB&T Park Community Recreation Center (Lilburn — now Lilburn Community Center)
  - Bogan Park Community Recreation Center (Buford)
  - Collins Hill Park Community Recreation Center (Lawrenceville)
  - Lucky Shoals Park Community Recreation Center (Norcross)
  - McDaniel Farm Park (Duluth)
  - Pinckneyville Park Community Recreation Center (Norcross)
  - Rhodes Jordan Park Community Recreation Center (Lawrenceville)
  - Sweet Water Park (Gwinnett multiple locations)
  - Shorty Howell Park (Duluth)
  - Harbins Community Recreation Center (Dacula)
  - Mountain Park Community Recreation Center (Lilburn)
  - Bunten Road Park (Duluth)
  - Gwinnett Environmental & Heritage Center (Buford)
"""

from __future__ import annotations

import logging

from sources._rec1_base import TenantConfig, VenueInfo, crawl_tenant

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default venue: Gwinnett County Parks & Recreation headquarters
# ---------------------------------------------------------------------------

_DEFAULT_VENUE = VenueInfo(
    name="Gwinnett County Parks & Recreation",
    slug="gwinnett-county-parks-recreation",
    address="75 Langley Dr",
    neighborhood="Lawrenceville",
    city="Lawrenceville",
    state="GA",
    zip_code="30046",
    lat=33.9566,
    lng=-84.0013,
    venue_type="recreation",
)

# ---------------------------------------------------------------------------
# Known rec centers — key is lowercase Rec1 location string (partial match OK)
# ---------------------------------------------------------------------------

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "george pierce park": VenueInfo(
        name="George Pierce Park Community Recreation Center",
        slug="george-pierce-park-crc",
        address="55 Buford Hwy NE",
        neighborhood="Suwanee",
        city="Suwanee",
        state="GA",
        zip_code="30024",
        lat=34.0443,
        lng=-84.0678,
        venue_type="recreation",
    ),
    "bethesda": VenueInfo(
        name="Bethesda Community Recreation Center",
        slug="bethesda-community-recreation-center",
        address="225 Bethesda Church Rd",
        neighborhood="Lawrenceville",
        city="Lawrenceville",
        state="GA",
        zip_code="30044",
        lat=33.9211,
        lng=-84.0299,
        venue_type="recreation",
    ),
    "bogan park": VenueInfo(
        name="Bogan Park Community Recreation Center",
        slug="bogan-park-crc",
        address="2723 N Bogan Rd",
        neighborhood="Buford",
        city="Buford",
        state="GA",
        zip_code="30519",
        lat=34.0979,
        lng=-83.9948,
        venue_type="recreation",
    ),
    "collins hill": VenueInfo(
        name="Collins Hill Park Community Recreation Center",
        slug="collins-hill-park-crc",
        address="2425 Collins Hill Rd",
        neighborhood="Lawrenceville",
        city="Lawrenceville",
        state="GA",
        zip_code="30043",
        lat=33.9927,
        lng=-84.0018,
        venue_type="recreation",
    ),
    "lucky shoals": VenueInfo(
        name="Lucky Shoals Park Community Recreation Center",
        slug="lucky-shoals-park-crc",
        address="4651 Britt Rd",
        neighborhood="Norcross",
        city="Norcross",
        state="GA",
        zip_code="30093",
        lat=33.9293,
        lng=-84.1617,
        venue_type="recreation",
    ),
    "mcdaniel farm": VenueInfo(
        name="McDaniel Farm Park",
        slug="mcdaniel-farm-park",
        address="3251 McDaniel Rd",
        neighborhood="Duluth",
        city="Duluth",
        state="GA",
        zip_code="30096",
        lat=33.9718,
        lng=-84.1484,
        venue_type="park",
    ),
    "pinckneyville": VenueInfo(
        name="Pinckneyville Park Community Recreation Center",
        slug="pinckneyville-park-crc",
        address="4758 S Old Peachtree Rd",
        neighborhood="Norcross",
        city="Norcross",
        state="GA",
        zip_code="30071",
        lat=33.9551,
        lng=-84.1867,
        venue_type="recreation",
    ),
    "rhodes jordan": VenueInfo(
        name="Rhodes Jordan Park Community Recreation Center",
        slug="rhodes-jordan-park-crc",
        address="100 E Crogan St",
        neighborhood="Lawrenceville",
        city="Lawrenceville",
        state="GA",
        zip_code="30046",
        lat=33.9524,
        lng=-83.9877,
        venue_type="recreation",
    ),
    "shorty howell": VenueInfo(
        name="Shorty Howell Park",
        slug="shorty-howell-park",
        address="2750 Pleasant Hill Rd",
        neighborhood="Duluth",
        city="Duluth",
        state="GA",
        zip_code="30096",
        lat=33.9796,
        lng=-84.1245,
        venue_type="park",
    ),
    "harbins": VenueInfo(
        name="Harbins Community Recreation Center",
        slug="harbins-community-recreation-center",
        address="2929 Harbins Rd",
        neighborhood="Dacula",
        city="Dacula",
        state="GA",
        zip_code="30019",
        lat=33.9737,
        lng=-83.9006,
        venue_type="recreation",
    ),
    "mountain park": VenueInfo(
        name="Mountain Park Community Recreation Center",
        slug="mountain-park-crc-gwinnett",
        address="1063 Rockbridge Rd SW",
        neighborhood="Lilburn",
        city="Lilburn",
        state="GA",
        zip_code="30047",
        lat=33.8929,
        lng=-84.0864,
        venue_type="recreation",
    ),
    "bunten road": VenueInfo(
        name="Bunten Road Park",
        slug="bunten-road-park",
        address="2500 Bunten Rd",
        neighborhood="Duluth",
        city="Duluth",
        state="GA",
        zip_code="30097",
        lat=34.0056,
        lng=-84.1310,
        venue_type="park",
    ),
    "gwinnett environmental": VenueInfo(
        name="Gwinnett Environmental & Heritage Center",
        slug="gwinnett-environmental-heritage-center",
        address="2020 Clean Water Drive",
        neighborhood="Buford",
        city="Buford",
        state="GA",
        zip_code="30519",
        lat=34.0843,
        lng=-84.0093,
        venue_type="museum",
    ),
    "heritage center": VenueInfo(
        name="Gwinnett Environmental & Heritage Center",
        slug="gwinnett-environmental-heritage-center",
        address="2020 Clean Water Drive",
        neighborhood="Buford",
        city="Buford",
        state="GA",
        zip_code="30519",
        lat=34.0843,
        lng=-84.0093,
        venue_type="museum",
    ),
    "gwinnett county aquatics": VenueInfo(
        name="Gwinnett County Aquatics Center",
        slug="gwinnett-county-aquatics-center",
        address="3201 Club Drive",
        neighborhood="Lawrenceville",
        city="Lawrenceville",
        state="GA",
        zip_code="30044",
        lat=33.9286,
        lng=-84.0411,
        venue_type="recreation",
    ),
    "club drive pool": VenueInfo(
        name="Gwinnett County Aquatics Center",
        slug="gwinnett-county-aquatics-center",
        address="3201 Club Drive",
        neighborhood="Lawrenceville",
        city="Lawrenceville",
        state="GA",
        zip_code="30044",
        lat=33.9286,
        lng=-84.0411,
        venue_type="recreation",
    ),
    "berkley lake recreation": VenueInfo(
        name="Berkley Lake Recreation Center",
        slug="berkley-lake-recreation-center",
        address="4500 Buena Vista Rd",
        neighborhood="Berkley Lake",
        city="Berkeley Lake",
        state="GA",
        zip_code="30096",
        lat=33.9760,
        lng=-84.2181,
        venue_type="recreation",
    ),
}

# ---------------------------------------------------------------------------
# Tab configuration
# ---------------------------------------------------------------------------

# Tabs with actual programs and events
_CRAWL_TAB_IDS = [
    "819",  # Events
    "820",  # Active Adults 50+
    "825",  # Classes & Activities
    "823",  # Aquatics
    "953",  # Wellness
    "955",  # Sports
    "930",  # Camps
    "822",  # Education
    "821",  # Nature & History
]

# Group keywords to skip (facility rentals, memberships, non-events)
_SKIP_GROUP_KEYWORDS = [
    "venue rental",
    "facility rental",
    "pavilion rental",
    "room rental",
    "membership",
    "annual pass",
    "season pass",
    "punch card",
    "donation",
    "scholarship",
    "vendor application",
    "sensory swim",
    "aquatics fitness",
    "adult - swim lessons",
    "adaptive sport activities",
    "cultural dances",
    "pickleball",
    "tennis",
    "yoga/pilates",
    "aerobic/cardio",
    "ballroom/waltz",
]

_SKIP_SESSION_KEYWORDS = [
    "line dance",
    "line dancing",
    "tap-",
    "basic meditation",
]

# ---------------------------------------------------------------------------
# Tenant config
# ---------------------------------------------------------------------------

GWINNETT_TENANT = TenantConfig(
    tenant_slug="gwinnett-county-parks-recreation",
    county_name="Gwinnett County",
    county_tag="gwinnett",
    default_venue=_DEFAULT_VENUE,
    known_venues=_KNOWN_VENUES,
    crawl_tab_ids=_CRAWL_TAB_IDS,
    skip_group_keywords=_SKIP_GROUP_KEYWORDS,
    skip_session_keywords=_SKIP_SESSION_KEYWORDS,
)

# ---------------------------------------------------------------------------
# Crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Gwinnett County Parks & Recreation programs and events from Rec1."""
    logger.info("Starting Gwinnett County Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, GWINNETT_TENANT)
