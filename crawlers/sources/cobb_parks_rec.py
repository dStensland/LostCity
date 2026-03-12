"""
Crawler for Cobb County Parks & Recreation (secure.rec1.com/GA/cobb-county-ga).

Cobb County runs its parks registration portal on the Rec1 (CivicRec) platform.
This crawler delegates to _rec1_base.crawl_tenant() with Cobb-specific config.

Tenant slug: cobb-county-ga
Catalog: https://secure.rec1.com/GA/cobb-county-ga/catalog

Program tabs crawled (by Rec1 tab ID):
  3456  Adult Sports
  3454  Aquatics
  4320  Arts
  4317  Gymnastics
  4321  Outdoor/Nature
  8572  Recreation Centers
  4318  Tennis
  4324  Therapeutic Services
  4319  Camps
  18702 Senior Services Activities
  20238 Youth Sports
  4405  Special Events

Skipped tabs (not actual events):
  4404  Memberships
  3455  PARKS Facility Reservations
  5027  PARKS Pavilion Reservations
  4721  Government Service Center Facility Rentals
  5417  Library Facility Rental

Major venues pre-mapped (Cobb County recreation centers):
  - Cobb Aquatic Center (Marietta)
  - North Cobb Recreation Center (Kennesaw)
  - Jim R. Miller Park (Marietta)
  - Jennie T. Anderson Theatre (Marietta)
  - The Art Place (Marietta)
  - Smyrna Recreation Center (Smyrna)
  - East Cobb Recreation Center (Marietta)
  - South Cobb Recreation Center (Austell)
  - Mableton Recreation Center (Mableton)
  - Powder Springs Recreation Center (Powder Springs)
  - Acworth Recreation Center (Acworth)
"""

from __future__ import annotations

import logging

from sources._rec1_base import TenantConfig, VenueInfo, crawl_tenant

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default venue: Cobb County Parks & Recreation headquarters
# ---------------------------------------------------------------------------

_DEFAULT_VENUE = VenueInfo(
    name="Cobb County Parks & Recreation",
    slug="cobb-county-parks-recreation",
    address="1792 County Services Pkwy SW",
    neighborhood="Marietta",
    city="Marietta",
    state="GA",
    zip_code="30008",
    lat=33.9304,
    lng=-84.5718,
    venue_type="recreation",
)

# ---------------------------------------------------------------------------
# Known rec centers — key is lowercase Rec1 location string (partial match OK)
# ---------------------------------------------------------------------------

_KNOWN_VENUES: dict[str, VenueInfo] = {
    "cobb aquatic center": VenueInfo(
        name="Cobb Aquatic Center",
        slug="cobb-aquatic-center",
        address="3996 South Hurt Rd SW",
        neighborhood="Smyrna",
        city="Smyrna",
        state="GA",
        zip_code="30082",
        lat=33.8593,
        lng=-84.5219,
        venue_type="recreation",
    ),
    "north cobb recreation": VenueInfo(
        name="North Cobb Recreation Center",
        slug="north-cobb-recreation-center",
        address="3900 Cherokee St NW",
        neighborhood="Kennesaw",
        city="Kennesaw",
        state="GA",
        zip_code="30144",
        lat=34.0234,
        lng=-84.6154,
        venue_type="recreation",
    ),
    "jim r. miller park": VenueInfo(
        name="Jim R. Miller Park",
        slug="jim-r-miller-park",
        address="2245 Callaway Rd SW",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30008",
        lat=33.9172,
        lng=-84.5802,
        venue_type="park",
    ),
    "jim miller park": VenueInfo(
        name="Jim R. Miller Park",
        slug="jim-r-miller-park",
        address="2245 Callaway Rd SW",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30008",
        lat=33.9172,
        lng=-84.5802,
        venue_type="park",
    ),
    "jennie t. anderson theatre": VenueInfo(
        name="Jennie T. Anderson Theatre",
        slug="jennie-t-anderson-theatre",
        address="548 S Marietta Pkwy SE",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30060",
        lat=33.9422,
        lng=-84.5465,
        venue_type="theater",
    ),
    "jennie t anderson": VenueInfo(
        name="Jennie T. Anderson Theatre",
        slug="jennie-t-anderson-theatre",
        address="548 S Marietta Pkwy SE",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30060",
        lat=33.9422,
        lng=-84.5465,
        venue_type="theater",
    ),
    "the art place": VenueInfo(
        name="The Art Place — Mountain View",
        slug="the-art-place-mountain-view",
        address="3330 Sandy Plains Rd",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30066",
        lat=34.0002,
        lng=-84.4896,
        venue_type="arts_center",
    ),
    "art place": VenueInfo(
        name="The Art Place — Mountain View",
        slug="the-art-place-mountain-view",
        address="3330 Sandy Plains Rd",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30066",
        lat=34.0002,
        lng=-84.4896,
        venue_type="arts_center",
    ),
    "smyrna recreation": VenueInfo(
        name="Smyrna Recreation Center",
        slug="smyrna-recreation-center",
        address="200 Village Green Circle SE",
        neighborhood="Smyrna",
        city="Smyrna",
        state="GA",
        zip_code="30082",
        lat=33.8836,
        lng=-84.5144,
        venue_type="recreation",
    ),
    "east cobb recreation": VenueInfo(
        name="East Cobb Recreation Center",
        slug="east-cobb-recreation-center",
        address="4101 Roswell Rd NE",
        neighborhood="Marietta",
        city="Marietta",
        state="GA",
        zip_code="30062",
        lat=33.9892,
        lng=-84.4644,
        venue_type="recreation",
    ),
    "south cobb recreation": VenueInfo(
        name="South Cobb Recreation Center",
        slug="south-cobb-recreation-center",
        address="620 Lions Club Dr",
        neighborhood="Austell",
        city="Austell",
        state="GA",
        zip_code="30168",
        lat=33.8169,
        lng=-84.6340,
        venue_type="recreation",
    ),
    "mableton recreation": VenueInfo(
        name="Mableton Recreation Center",
        slug="mableton-recreation-center",
        address="6145 Mableton Pkwy SW",
        neighborhood="Mableton",
        city="Mableton",
        state="GA",
        zip_code="30126",
        lat=33.8152,
        lng=-84.5716,
        venue_type="recreation",
    ),
    "powder springs recreation": VenueInfo(
        name="Powder Springs Recreation Center",
        slug="powder-springs-recreation-center",
        address="3521 Brownsville Rd",
        neighborhood="Powder Springs",
        city="Powder Springs",
        state="GA",
        zip_code="30127",
        lat=33.8613,
        lng=-84.6858,
        venue_type="recreation",
    ),
    "acworth recreation": VenueInfo(
        name="Acworth Recreation Center",
        slug="acworth-recreation-center",
        address="4894 Senator Richard Russell Dr",
        neighborhood="Acworth",
        city="Acworth",
        state="GA",
        zip_code="30101",
        lat=34.0668,
        lng=-84.6703,
        venue_type="recreation",
    ),
    "lost mountain recreation": VenueInfo(
        name="Lost Mountain Recreation Center",
        slug="lost-mountain-recreation-center",
        address="4484 Dallas Hwy SW",
        neighborhood="Powder Springs",
        city="Powder Springs",
        state="GA",
        zip_code="30127",
        lat=33.9218,
        lng=-84.7013,
        venue_type="recreation",
    ),
    "highland recreation": VenueInfo(
        name="Highland Recreation Center",
        slug="highland-recreation-center-cobb",
        address="2300 Joe Jerkins Blvd SW",
        neighborhood="Austell",
        city="Austell",
        state="GA",
        zip_code="30168",
        lat=33.8042,
        lng=-84.6414,
        venue_type="recreation",
    ),
}

# ---------------------------------------------------------------------------
# Tab configuration
# ---------------------------------------------------------------------------

# Tabs that have actual program/event content (not facility rentals or memberships)
_CRAWL_TAB_IDS = [
    "3456",  # Adult Sports
    "3454",  # Aquatics
    "4320",  # Arts
    "4317",  # Gymnastics
    "4321",  # Outdoor/Nature
    "8572",  # Recreation Centers
    "4318",  # Tennis
    "4324",  # Therapeutic Services
    "4319",  # Camps
    "18702",  # Senior Services Activities
    "20238",  # Youth Sports
    "4405",  # Special Events
]

# Group keywords to skip (facilities / vendor applications / non-events)
_SKIP_GROUP_KEYWORDS = [
    "vendor application",
    "facility rental",
    "pavilion rental",
    "room rental",
    "membership",
    "10 visit",
    "punch card",
    "annual pass",
    "season pass",
    "donation",
    "scholarship",
    "pickleball classes",
    "basketball skills training",
    "line dancing",
    "adult basics swimming lessons",
    "advanced beginner swimming lessons",
    "beginner swimming lessons",
    "belly dance",
    "basketball training - rarc",
    "tennis - adult classes",
]

# ---------------------------------------------------------------------------
# Tenant config
# ---------------------------------------------------------------------------

COBB_TENANT = TenantConfig(
    tenant_slug="cobb-county-ga",
    county_name="Cobb County",
    county_tag="cobb",
    default_venue=_DEFAULT_VENUE,
    known_venues=_KNOWN_VENUES,
    crawl_tab_ids=_CRAWL_TAB_IDS,
    skip_group_keywords=_SKIP_GROUP_KEYWORDS,
)

# ---------------------------------------------------------------------------
# Crawl entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Cobb County Parks & Recreation programs and events from Rec1."""
    logger.info("Starting Cobb County Parks & Recreation (Rec1) crawl")
    return crawl_tenant(source, COBB_TENANT)
