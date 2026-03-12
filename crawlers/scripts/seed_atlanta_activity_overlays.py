#!/usr/bin/env python3
"""
Seed Atlanta-owned venue_features overlays for the first 12 family activity targets.

Usage:
    python3 scripts/seed_atlanta_activity_overlays.py          # dry-run
    python3 scripts/seed_atlanta_activity_overlays.py --apply  # commit writes
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import (  # noqa: E402
    configure_write_mode,
    get_client,
    upsert_venue_feature,
    venues_support_features_table,
)

logger = logging.getLogger(__name__)


ATLANTA_ACTIVITY_OVERLAYS: dict[str, list[dict[str, Any]]] = {
    "georgia-aquarium": [
        {
            "slug": "ocean-voyager-gallery",
            "title": "Ocean Voyager Gallery",
            "feature_type": "attraction",
            "description": "Massive ocean habitat viewing built for a full family visit, with large-format windows and high wow-factor for kids and adults alike.",
            "price_note": "Included with general admission",
            "url": "https://www.georgiaaquarium.org/",
            "sort_order": 10,
        },
        {
            "slug": "dolphin-presentations",
            "title": "Dolphin Presentations",
            "feature_type": "experience",
            "description": "Scheduled dolphin presentations that make the aquarium feel like a destination outing rather than a quick walk-through.",
            "price_note": "Check daily schedule; included with admission on presentation days",
            "url": "https://www.georgiaaquarium.org/",
            "sort_order": 20,
        },
        {
            "slug": "beluga-viewing",
            "title": "Beluga Viewing",
            "feature_type": "attraction",
            "description": "Signature beluga habitat viewing that works especially well as a slower-paced family stop during a longer aquarium visit.",
            "price_note": "Included with general admission",
            "url": "https://www.georgiaaquarium.org/",
            "sort_order": 30,
        },
    ],
    "zoo-atlanta": [
        {
            "slug": "african-savanna",
            "title": "African Savanna",
            "feature_type": "attraction",
            "description": "Large outdoor animal habitat zone that gives Zoo Atlanta its strongest all-ages destination feel.",
            "price_note": "Included with general admission",
            "url": "https://zooatlanta.org/",
            "sort_order": 10,
        },
        {
            "slug": "scaly-slimy-spectacular",
            "title": "Scaly Slimy Spectacular",
            "feature_type": "attraction",
            "description": "Indoor reptile and amphibian exhibits that add weather-proof value to a family zoo day.",
            "price_note": "Included with general admission",
            "url": "https://zooatlanta.org/",
            "sort_order": 20,
        },
        {
            "slug": "family-ride-and-play-zone",
            "title": "Family Ride and Play Zone",
            "feature_type": "experience",
            "description": "Kid-leaning ride and play elements that help extend zoo visits for younger families.",
            "price_note": "Some attractions may require an add-on ticket",
            "url": "https://zooatlanta.org/",
            "sort_order": 30,
        },
    ],
    "atlanta-botanical-garden": [
        {
            "slug": "canopy-walk",
            "title": "Canopy Walk",
            "feature_type": "attraction",
            "description": "Elevated woodland walk that gives the garden a destination-quality experience beyond traditional floral displays.",
            "price_note": "Included with garden admission",
            "url": "https://atlantabg.org/",
            "sort_order": 10,
        },
        {
            "slug": "childrens-garden",
            "title": "Children's Garden",
            "feature_type": "amenity",
            "description": "Younger-kid garden area that makes the Botanical Garden a more realistic family outing, not just an adult scenic stop.",
            "price_note": "Included with garden admission",
            "url": "https://atlantabg.org/",
            "sort_order": 20,
        },
        {
            "slug": "seasonal-outdoor-installations",
            "title": "Seasonal Outdoor Installations",
            "feature_type": "exhibition",
            "description": "Rotating seasonal displays and large-format garden installations that keep repeat family visits interesting.",
            "price_note": "Included with general admission unless separately ticketed",
            "url": "https://atlantabg.org/",
            "sort_order": 30,
        },
    ],
    "high-museum-of-art": [
        {
            "slug": "collection-galleries",
            "title": "Collection Galleries",
            "feature_type": "collection",
            "description": "Core art galleries that make the High a durable visitable destination rather than only an event venue.",
            "price_note": "Included with museum admission",
            "url": "https://high.org/",
            "sort_order": 10,
        },
        {
            "slug": "meier-atrium",
            "title": "Meier Atrium",
            "feature_type": "attraction",
            "description": "The museum's signature atrium and circulation spaces provide a strong architectural experience even on shorter family visits.",
            "price_note": "Included with museum admission",
            "url": "https://high.org/",
            "sort_order": 20,
        },
        {
            "slug": "family-gallery-stops",
            "title": "Family Gallery Stops",
            "feature_type": "experience",
            "description": "Short-format gallery experiences and family-friendly museum stops that help parents do the High without treating it as an all-day adult-only outing.",
            "price_note": "Included with museum admission; some family activities vary by day",
            "url": "https://high.org/",
            "sort_order": 30,
        },
    ],
    "childrens-museum-atlanta": [
        {
            "slug": "hands-on-play-exhibits",
            "title": "Hands-On Play Exhibits",
            "feature_type": "attraction",
            "description": "Interactive exhibits built for active younger-kid exploration rather than passive viewing.",
            "price_note": "Included with museum admission",
            "url": "https://www.childrensmuseumatlanta.org/",
            "sort_order": 10,
        },
        {
            "slug": "maker-and-art-activities",
            "title": "Maker and Art Activities",
            "feature_type": "experience",
            "description": "Creative hands-on stations that make the museum especially useful for preschool and early-elementary families.",
            "price_note": "Included with museum admission unless separately noted",
            "url": "https://www.childrensmuseumatlanta.org/",
            "sort_order": 20,
        },
        {
            "slug": "story-and-performance-space",
            "title": "Story and Performance Space",
            "feature_type": "experience",
            "description": "Live storytelling and performance-oriented spaces that give the museum stronger repeat-visit energy.",
            "price_note": "Included with museum admission when available",
            "url": "https://www.childrensmuseumatlanta.org/",
            "sort_order": 30,
        },
    ],
    "fernbank-museum": [
        {
            "slug": "dinosaur-galleries",
            "title": "Dinosaur Galleries",
            "feature_type": "collection",
            "description": "Large-format dinosaur and natural history exhibits that anchor Fernbank's broad all-ages appeal.",
            "price_note": "Included with museum admission",
            "url": "https://www.fernbankmuseum.org/",
            "sort_order": 10,
        },
        {
            "slug": "giant-screen-theater",
            "title": "Giant Screen Theater",
            "feature_type": "experience",
            "description": "Immersive theater programming that gives Fernbank a useful rainy-day family fallback beyond static exhibits.",
            "price_note": "May require an add-on or specific ticket selection",
            "url": "https://www.fernbankmuseum.org/",
            "sort_order": 20,
        },
        {
            "slug": "fernbank-forest",
            "title": "Fernbank Forest",
            "feature_type": "attraction",
            "description": "Old-growth urban forest trails that extend museum visits into a destination-quality indoor/outdoor family day.",
            "price_note": "Included with museum admission",
            "url": "https://www.fernbankmuseum.org/",
            "sort_order": 30,
        },
    ],
    "center-for-puppetry-arts": [
        {
            "slug": "jim-henson-collection",
            "title": "Jim Henson Collection",
            "feature_type": "collection",
            "description": "Signature Henson material that gives the Center for Puppetry Arts unusual family and tourist value in the Atlanta market.",
            "price_note": "Included with museum admission or bundled experiences as offered",
            "url": "https://puppet.org/",
            "sort_order": 10,
        },
        {
            "slug": "worlds-of-puppetry-museum",
            "title": "Worlds of Puppetry Museum",
            "feature_type": "collection",
            "description": "Permanent museum experience that helps the venue work as a destination even beyond scheduled performances.",
            "price_note": "Included with museum admission or bundled experiences as offered",
            "url": "https://puppet.org/",
            "sort_order": 20,
        },
        {
            "slug": "family-puppet-performances",
            "title": "Family Puppet Performances",
            "feature_type": "experience",
            "description": "Live family-focused puppet shows that make this one of the strongest distinctive family culture destinations in Atlanta.",
            "price_note": "Performance ticketing varies by production",
            "url": "https://puppet.org/",
            "sort_order": 30,
        },
    ],
    "atlanta-history-center": [
        {
            "slug": "swan-house",
            "title": "Swan House",
            "feature_type": "attraction",
            "description": "Historic house experience that gives the campus one of its strongest destination anchors.",
            "price_note": "Included with campus admission as offered",
            "url": "https://www.atlantahistorycenter.com/",
            "sort_order": 10,
        },
        {
            "slug": "tullie-smith-farm",
            "title": "Tullie Smith Farm",
            "feature_type": "attraction",
            "description": "Living-history farm environment that makes Atlanta History Center more flexible for family visits than a standard museum-only stop.",
            "price_note": "Included with campus admission as offered",
            "url": "https://www.atlantahistorycenter.com/",
            "sort_order": 20,
        },
        {
            "slug": "goizueta-gardens",
            "title": "Goizueta Gardens",
            "feature_type": "amenity",
            "description": "Garden and grounds experience that supports lower-lift family visits and mixed-age pacing.",
            "price_note": "Included with campus admission as offered",
            "url": "https://www.atlantahistorycenter.com/",
            "sort_order": 30,
        },
    ],
    "chattahoochee-nature-center": [
        {
            "slug": "wildlife-walk",
            "title": "Wildlife Walk",
            "feature_type": "attraction",
            "description": "Core wildlife-viewing path that gives the Nature Center a clearer durable family outing identity.",
            "price_note": "Included with admission",
            "url": "https://www.chattnaturecenter.org/",
            "sort_order": 10,
        },
        {
            "slug": "river-boardwalk-trails",
            "title": "River Boardwalk Trails",
            "feature_type": "attraction",
            "description": "Boardwalk and trail experience that supports low-effort outdoor family visits, especially on no-school and weekend days.",
            "price_note": "Included with admission",
            "url": "https://www.chattnaturecenter.org/",
            "sort_order": 20,
        },
        {
            "slug": "interactive-nature-play",
            "title": "Interactive Nature Play",
            "feature_type": "amenity",
            "description": "Hands-on family-friendly nature play and exploration areas that help younger kids stay engaged during visits.",
            "price_note": "Included with admission",
            "url": "https://www.chattnaturecenter.org/",
            "sort_order": 30,
        },
    ],
    "lego-discovery-center-atlanta": [
        {
            "slug": "miniland-atlanta",
            "title": "MINILAND Atlanta",
            "feature_type": "attraction",
            "description": "Indoor LEGO cityscape attraction that helps make the venue feel specific to Atlanta rather than a generic play center.",
            "price_note": "Included with attraction admission",
            "url": "https://www.legolanddiscoverycenter.com/atlanta/",
            "sort_order": 10,
        },
        {
            "slug": "build-and-play-zones",
            "title": "Build and Play Zones",
            "feature_type": "experience",
            "description": "Open building and activity zones that make this a strong rainy-day and energy-burn family option.",
            "price_note": "Included with attraction admission",
            "url": "https://www.legolanddiscoverycenter.com/atlanta/",
            "sort_order": 20,
        },
        {
            "slug": "creative-workshops",
            "title": "Creative Workshops",
            "feature_type": "experience",
            "description": "Guided creative building moments that add more structure for families with elementary-age kids.",
            "price_note": "Availability varies by day",
            "url": "https://www.legolanddiscoverycenter.com/atlanta/",
            "sort_order": 30,
        },
    ],
    "stone-mountain-park": [
        {
            "slug": "summit-trail",
            "title": "Summit Trail",
            "feature_type": "attraction",
            "description": "Hike-based summit experience that complements the park's paid attractions with a strong outdoor family challenge option.",
            "price_note": "Park entry / parking may still apply",
            "url": "https://www.stonemountainpark.com/",
            "sort_order": 40,
        },
        {
            "slug": "lakeside-and-trail-outings",
            "title": "Lakeside and Trail Outings",
            "feature_type": "amenity",
            "description": "Lower-lift outdoor outing value that makes Stone Mountain useful even when families are not buying a full attraction ticket pack.",
            "price_note": "Parking and park access policies vary",
            "url": "https://www.stonemountainpark.com/",
            "sort_order": 50,
        },
    ],
    "fernbank-science-center": [
        {
            "slug": "planetarium-shows",
            "title": "Planetarium Shows",
            "feature_type": "experience",
            "description": "Planetarium programming that gives Fernbank Science Center unusually strong free or low-cost family learning value.",
            "price_note": "Check current public schedule and admission rules",
            "url": "http://www.fernbank.edu/",
            "sort_order": 10,
        },
        {
            "slug": "science-exhibit-halls",
            "title": "Science Exhibit Halls",
            "feature_type": "collection",
            "description": "Interactive science exhibits that work well for school-break and rainy-day family visits.",
            "price_note": "Check current public access details",
            "url": "http://www.fernbank.edu/",
            "sort_order": 20,
        },
        {
            "slug": "observatory-programming",
            "title": "Observatory Programming",
            "feature_type": "experience",
            "description": "Observatory-led science viewing that gives the venue a distinct educational destination identity within Atlanta.",
            "price_note": "Availability varies by public program schedule",
            "url": "http://www.fernbank.edu/",
            "sort_order": 30,
        },
    ],
}


def seed_overlays(apply: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    if not venues_support_features_table():
        logger.error("venue_features table missing; run migration 275_venue_features.sql first.")
        return

    configure_write_mode(apply, "" if apply else "dry-run")

    client = get_client()
    total = 0

    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS.items():
        venue_res = (
            client.table("venues")
            .select("id,name,slug")
            .eq("slug", venue_slug)
            .limit(1)
            .execute()
        )
        if not venue_res.data:
            logger.warning("Venue slug '%s' not found; skipping", venue_slug)
            continue

        venue = venue_res.data[0]
        logger.info(
            "%s (%s): processing %d features",
            venue["name"],
            venue["slug"],
            len(features),
        )

        for feature in features:
            result = upsert_venue_feature(venue["id"], feature)
            action = "upserted" if apply else "would upsert"
            logger.info("  %s feature '%s' (id=%s)", action, feature["title"], result)
            total += 1

    mode = "APPLIED" if apply else "DRY RUN"
    logger.info("[%s] Processed %d venue feature overlays", mode, total)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Atlanta venue_features overlays for the first 12 family activity destinations"
    )
    parser.add_argument("--apply", action="store_true", help="Commit writes (default: dry-run)")
    args = parser.parse_args()
    seed_overlays(apply=args.apply)


if __name__ == "__main__":
    main()
