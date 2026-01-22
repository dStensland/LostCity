#!/usr/bin/env python3
"""
Lost City Crawler - Main entry point.
Orchestrates crawling, extraction, and storage of event data.
"""

import argparse
import logging
import sys
from importlib import import_module
from typing import Optional

from config import get_config
from db import get_active_sources, get_source_by_slug, create_crawl_log, update_crawl_log, refresh_available_filters
from utils import setup_logging, slugify

logger = logging.getLogger(__name__)


# Map source slugs to their crawler modules
SOURCE_MODULES = {
    "eventbrite": "sources.eventbrite",
    "terminal-west": "sources.terminal_west",
    "the-earl": "sources.the_earl",
    "dads-garage": "sources.dads_garage",
    "atlanta-botanical-garden": "sources.atlanta_botanical",
    "high-museum": "sources.high_museum",
    "ticketmaster": "sources.ticketmaster",
    # Phase 1 - Critical Aggregators
    "gwcc": "sources.gwcc",
    "hands-on-atlanta": "sources.hands_on_atlanta",
    "discover-atlanta": "sources.discover_atlanta",
    # Phase 2 - High-Volume Aggregators
    "access-atlanta": "sources.access_atlanta",
    "fancons": "sources.fancons",
    "10times": "sources.tentimes",
    "beltline": "sources.beltline",
    # Phase 3 - Major Venues
    "eddies-attic": "sources.eddies_attic",
    "smiths-olde-bar": "sources.smiths_olde_bar",
    "city-winery-atlanta": "sources.city_winery",
    "laughing-skull": "sources.laughing_skull",
    "punchline": "sources.punchline",
    "atlanta-ballet": "sources.atlanta_ballet",
    "atlanta-opera": "sources.atlanta_opera",
    "puppetry-arts": "sources.puppetry_arts",
    # Film - Cinemas & Festivals
    "plaza-theatre": "sources.plaza_theatre",
    "tara-theatre": "sources.tara_theatre",
    "landmark-midtown": "sources.landmark_midtown",
    "atlanta-film-festival": "sources.atlanta_film_festival",
    "out-on-film": "sources.out_on_film",
    "ajff": "sources.ajff",
    "atlanta-film-society": "sources.atlanta_film_society",
    "atlanta-film-series": "sources.atlanta_film_series",
    "buried-alive": "sources.buried_alive",
    # Phase 4 - Additional Music Venues
    "529": "sources.five29",
    # Meetups
    "meetup": "sources.meetup",
    # Bookstores
    "a-cappella-books": "sources.a_cappella_books",
    "charis-books": "sources.charis_books",
    "little-shop-of-stories": "sources.little_shop_of_stories",
    "eagle-eye-books": "sources.eagle_eye_books",
    "foxtale-books": "sources.foxtale_books",
    # Libraries
    "fulton-library": "sources.fulton_library",
    "dekalb-library": "sources.dekalb_library",
    # Electronic/DJ
    "resident-advisor": "sources.resident_advisor",
    # Farmers Markets
    "farmers-markets": "sources.farmers_markets",
    # New Venues - Phase 1
    "the-masquerade": "sources.the_masquerade",
    "fox-theatre": "sources.fox_theatre",
    "monday-night": "sources.monday_night",
    "atlanta-pride": "sources.atlanta_pride",
    "alliance-theatre": "sources.alliance_theatre",
    "creative-loafing": "sources.creative_loafing",
    "variety-playhouse": "sources.variety_playhouse",
    "tabernacle": "sources.tabernacle",
    # ===== NEW CRAWLERS - Major Arenas & Convention Centers =====
    "state-farm-arena": "sources.state_farm_arena",
    "mercedes-benz-stadium": "sources.mercedes_benz_stadium",
    "cobb-energy": "sources.cobb_energy",
    "gas-south": "sources.gas_south",
    "cobb-galleria": "sources.cobb_galleria",
    "gicc": "sources.gicc",
    # ===== Music Venues =====
    "aisle5": "sources.aisle5",
    "wild-heaven": "sources.wild_heaven",
    "coca-cola-roxy": "sources.coca_cola_roxy",
    "blind-willies": "sources.blind_willies",
    "the-loft": "sources.the_loft",
    "center-stage": "sources.center_stage",
    "buckhead-theatre": "sources.buckhead_theatre",
    # ===== Comedy Venues =====
    "helium-comedy": "sources.helium_comedy",
    "uptown-comedy": "sources.uptown_comedy",
    "whole-world-improv": "sources.whole_world_improv",
    "atlanta-comedy-theater": "sources.atlanta_comedy_theater",
    # ===== Suburban Venues =====
    "ameris-bank-amphitheatre": "sources.ameris_bank_amphitheatre",
    "strand-theatre": "sources.strand_theatre",
    "roswell-cultural-arts": "sources.roswell_cultural_arts",
    "sandy-springs-pac": "sources.sandy_springs_pac",
    # ===== Museums =====
    "fernbank": "sources.fernbank",
    "atlanta-history-center": "sources.atlanta_history_center",
    "carlos-museum": "sources.carlos_museum",
    "childrens-museum": "sources.childrens_museum",
    "civil-rights-center": "sources.civil_rights_center",
    "college-football-hof": "sources.college_football_hof",
    "world-of-coca-cola": "sources.world_of_coca_cola",
    # ===== Food Halls & Markets =====
    "ponce-city-market": "sources.ponce_city_market",
    "krog-street-market": "sources.krog_street_market",
    "sweet-auburn-market": "sources.sweet_auburn_market",
    # ===== Breweries & Distilleries =====
    "sweetwater": "sources.sweetwater",
    "orpheus-brewing": "sources.orpheus_brewing",
    "three-taverns": "sources.three_taverns",
    "pontoon-brewing": "sources.pontoon_brewing",
    "asw-distillery": "sources.asw_distillery",
    # ===== Sports & Entertainment =====
    "truist-park": "sources.truist_park",
    "live-at-battery": "sources.live_at_battery",
    "atlanta-motor-speedway": "sources.atlanta_motor_speedway",
    # ===== Tech & Community Organizations =====
    "atlanta-tech-village": "sources.atlanta_tech_village",
    "render-atl": "sources.render_atl",
    "atlanta-tech-week": "sources.atlanta_tech_week",
    "ypa-atlanta": "sources.ypa_atlanta",
    # ===== Festivals & Conventions =====
    "dragon-con": "sources.dragon_con",
    "momocon": "sources.momocon",
    "atlanta-dogwood": "sources.atlanta_dogwood",
    "inman-park-festival": "sources.inman_park_festival",
    "shaky-knees": "sources.shaky_knees",
    "atlanta-jazz-festival": "sources.atlanta_jazz_festival",
    "decatur-arts-festival": "sources.decatur_arts_festival",
    # ===== Additional Theaters =====
    "aurora-theatre": "sources.aurora_theatre",
    "horizon-theatre": "sources.horizon_theatre",
    "actors-express": "sources.actors_express",
    "out-of-box-theatre": "sources.out_of_box_theatre",
    "stage-door-players": "sources.stage_door_players",
    # ===== Additional Music Venues =====
    "the-eastern": "sources.the_eastern",
    "venkmans": "sources.venkmans",
    "northside-tavern": "sources.northside_tavern",
    "red-light-cafe": "sources.red_light_cafe",
    "apache-xlr": "sources.apache_xlr",
    # ===== Additional Breweries =====
    "scofflaw-brewing": "sources.scofflaw_brewing",
    "second-self-brewing": "sources.second_self_brewing",
    "bold-monk-brewing": "sources.bold_monk_brewing",
    "reformation-brewery": "sources.reformation_brewery",
    # ===== University Venues =====
    "ferst-center": "sources.ferst_center",
    "schwartz-center": "sources.schwartz_center",
    "rialto-center": "sources.rialto_center",
    # ===== Additional Festivals =====
    "atlanta-food-wine": "sources.atlanta_food_wine",
    "peachtree-road-race": "sources.peachtree_road_race",
    "decatur-book-festival": "sources.decatur_book_festival",
    "sweet-auburn-springfest": "sources.sweet_auburn_springfest",
    "grant-park-festival": "sources.grant_park_festival",
    "candler-park-fest": "sources.candler_park_fest",
    "east-atlanta-strut": "sources.east_atlanta_strut",
    # ===== Attractions =====
    "georgia-aquarium": "sources.georgia_aquarium",
    "zoo-atlanta": "sources.zoo_atlanta",
    "chattahoochee-nature": "sources.chattahoochee_nature",
    # ===== Nightlife =====
    "opera-nightclub": "sources.opera_nightclub",
    "district-atlanta": "sources.district_atlanta",
    "ravine-atlanta": "sources.ravine_atlanta",
    # ===== Trade & Convention =====
    "americasmart": "sources.americasmart",
    # ===== LGBTQ+ Venues =====
    "blakes-on-park": "sources.blakes_on_park",
    "the-heretic": "sources.the_heretic",
    "my-sisters-room": "sources.my_sisters_room",
    "marys-bar": "sources.marys_bar",
    "atlanta-eagle": "sources.atlanta_eagle",
    "future-atlanta": "sources.future_atlanta",
    "bulldogs-atlanta": "sources.bulldogs_atlanta",
    "lips-atlanta": "sources.lips_atlanta",
    "joystick-gamebar": "sources.joystick_gamebar",
    "southern-fried-queer-pride": "sources.southern_fried_queer_pride",
    # ===== Additional Nightclubs =====
    "tongue-and-groove": "sources.tongue_and_groove",
    "believe-music-hall": "sources.believe_music_hall",
    "gold-room": "sources.gold_room",
    "domaine-atlanta": "sources.domaine_atlanta",
    "lyfe-atlanta": "sources.lyfe_atlanta",
    "church-atlanta": "sources.church_atlanta",
    # ===== Additional Theaters =====
    "seven-stages": "sources.seven_stages",
    "theatrical-outfit": "sources.theatrical_outfit",
    "true-colors-theatre": "sources.true_colors_theatre",
    "synchronicity-theatre": "sources.synchronicity_theatre",
    "atlanta-lyric-theatre": "sources.atlanta_lyric_theatre",
    # ===== Art Galleries =====
    "whitespace-gallery": "sources.whitespace_gallery",
    "abv-gallery": "sources.abv_gallery",
    "atlanta-contemporary": "sources.atlanta_contemporary",
    "moca-ga": "sources.moca_ga",
    "zucot-gallery": "sources.zucot_gallery",
    # ===== Gaming & Eatertainment =====
    "battle-and-brew": "sources.battle_and_brew",
    "puttshack": "sources.puttshack",
    "painted-pin": "sources.painted_pin",
    # ===== Haunted Attractions =====
    "netherworld": "sources.netherworld",
    # ===== Record Stores =====
    "criminal-records": "sources.criminal_records",
    "wax-n-facts": "sources.wax_n_facts",
    # ===== Yoga & Wellness =====
    "highland-yoga": "sources.highland_yoga",
    # ===== Sports Bars =====
    "brewhouse-cafe": "sources.brewhouse_cafe",
    # ===== Community Centers =====
    "l5p-community-center": "sources.l5p_community_center",
    # ===== Additional Haunted Attractions =====
    "13-stories": "sources.thirteen_stories",
    "folklore-haunted": "sources.folklore_haunted",
    # ===== Additional Yoga & Wellness =====
    "yonder-yoga": "sources.yonder_yoga",
    "dancing-dogs-yoga": "sources.dancing_dogs_yoga",
    "vista-yoga": "sources.vista_yoga",
    # ===== Cooking Schools =====
    "sur-la-table": "sources.sur_la_table",
    "publix-aprons": "sources.publix_aprons",
    "irwin-street-cooking": "sources.irwin_street_cooking",
    # ===== Additional Eatertainment =====
    "painted-duck": "sources.painted_duck",
    "punch-bowl-social": "sources.punch_bowl_social",
    "fowling-warehouse": "sources.fowling_warehouse",
    # ===== Coworking & Community =====
    "switchyards": "sources.switchyards",
    "piedmont-park": "sources.piedmont_park",
    # ===== Additional Record Stores =====
    "moods-music": "sources.moods_music",
    # ===== Additional Gaming =====
    "activate-games": "sources.activate_games",
    # ===== Batch 4: Remaining Crawlers =====
    # Haunted Attractions
    "paranoia-haunted": "sources.paranoia_haunted",
    "nightmares-gate": "sources.nightmares_gate",
    # Art Events
    "atlanta-art-fair": "sources.atlanta_art_fair",
    "forward-warrior": "sources.forward_warrior",
    # Gaming Expo
    "southern-fried-gaming": "sources.southern_fried_gaming",
    # Yoga
    "evolation-yoga": "sources.evolation_yoga",
    # Cooking Classes
    "williams-sonoma": "sources.williams_sonoma",
    # Coworking
    "wework-atlanta": "sources.wework_atlanta",
    "industrious-atlanta": "sources.industrious_atlanta",
    # Community Centers
    "decatur-recreation": "sources.decatur_recreation",
    # Sports Bar Networks
    "atlutd-pubs": "sources.atlutd_pubs",
    "hawks-bars": "sources.hawks_bars",
    # ===== NEW: Running & Outdoor Clubs =====
    "atlanta-track-club": "sources.atlanta_track_club",
    "atlanta-outdoor-club": "sources.atlanta_outdoor_club",
    "blk-hiking-club": "sources.blk_hiking_club",
    # ===== NEW: Dance Studios =====
    "pasofino-dance": "sources.pasofino_dance",
    "salsa-atlanta": "sources.salsa_atlanta",
    # ===== NEW: Black-Owned Venues =====
    "the-gathering-spot": "sources.gathering_spot",
    # ===== NEW: Food Events =====
    "taste-of-atlanta": "sources.taste_of_atlanta",
    "atl-food-wine": "sources.atl_food_wine",
    # ===== NEW: Art Galleries =====
    "sandler-hudson": "sources.sandler_hudson",
    # ===== NEW: Community Centers =====
    "callanwolde": "sources.callanwolde",
    "marcus-jcc": "sources.marcus_jcc",
    # ===== NEW: LGBTQ+ Organizations =====
    "atlanta-black-pride": "sources.atlanta_black_pride",
    # ===== NEW: Theater Venues =====
    "shakespeare-tavern": "sources.shakespeare_tavern",
    # ===== NEW BATCH: Music Venues =====
    "st-james-live": "sources.st_james_live",
    "basement-atlanta": "sources.basement_atlanta",
    "johnnys-hideaway": "sources.johnnys_hideaway",
    "sound-table": "sources.sound_table",
    "compound-atlanta": "sources.compound_atlanta",
    "mjq-concourse": "sources.mjq_concourse",
    # ===== NEW BATCH: LGBTQ+ Venues =====
    "lore-atlanta": "sources.lore_atlanta",
    "friends-on-ponce": "sources.friends_on_ponce",
    "woodys-atlanta": "sources.woodys_atlanta",
    "jungle-atlanta": "sources.jungle_atlanta",
    "pisces-atlanta": "sources.pisces_atlanta",
    "club-wander": "sources.club_wander",
    # ===== NEW BATCH: Dance Studios =====
    "academy-ballroom": "sources.academy_ballroom",
    "ballroom-impact": "sources.ballroom_impact",
    "dancing4fun": "sources.dancing4fun",
    "atlanta-dance-ballroom": "sources.atlanta_dance_ballroom",
    "arthur-murray-atlanta": "sources.arthur_murray_atlanta",
    "terminus-modern-ballet": "sources.terminus_modern_ballet",
    # ===== NEW BATCH: Breweries =====
    "steady-hand-beer": "sources.steady_hand_beer",
    "cherry-street-brewing": "sources.cherry_street_brewing",
    "round-trip-brewing": "sources.round_trip_brewing",
    "halfway-crooks": "sources.halfway_crooks",
    "fire-maker-brewing": "sources.fire_maker_brewing",
    "eventide-brewing": "sources.eventide_brewing",
    # ===== NEW BATCH: Farmers Markets =====
    "eav-farmers-market": "sources.eav_farmers_market",
    "decatur-farmers-market": "sources.decatur_farmers_market",
    "morningside-farmers-market": "sources.morningside_farmers_market",
    "grant-park-farmers-market": "sources.grant_park_farmers_market",
    "peachtree-road-farmers-market": "sources.peachtree_road_farmers_market",
    "freedom-farmers-market": "sources.freedom_farmers_market",
    # ===== NEW BATCH: Running/Cycling =====
    "big-peach-running": "sources.big_peach_running",
    "ptc-running-club": "sources.ptc_running_club",
    "monday-night-run-club": "sources.monday_night_run_club",
    "atlanta-cycling": "sources.atlanta_cycling",
    "bicycle-tours-atlanta": "sources.bicycle_tours_atlanta",
    # ===== NEW BATCH: Esports/Gaming =====
    "eeg-arena": "sources.eeg_arena",
    "level-up-gaming": "sources.level_up_gaming",
    "token-gaming-pub": "sources.token_gaming_pub",
    "atl-gaming": "sources.atl_gaming",
    # ===== NEW BATCH: Art Galleries =====
    "poem88-gallery": "sources.poem88_gallery",
    "kai-lin-art": "sources.kai_lin_art",
    "marcia-wood-gallery": "sources.marcia_wood_gallery",
    "hathaway-contemporary": "sources.hathaway_contemporary",
    "mason-fine-art": "sources.mason_fine_art",
    # ===== NEW BATCH: Theaters =====
    "onstage-atlanta": "sources.onstage_atlanta",
    "pushpush-theater": "sources.pushpush_theater",
    "working-title-playwrights": "sources.working_title_playwrights",
    "pinch-n-ouch-theatre": "sources.pinch_n_ouch_theatre",
    # ===== Healthcare: Piedmont =====
    "piedmont-healthcare": "sources.piedmont_healthcare",
    "piedmont-auxiliary": "sources.piedmont_auxiliary",
    "piedmont-foundation": "sources.piedmont_foundation",
    "piedmont-cancer-support": "sources.piedmont_cancer_support",
    "piedmont-classes": "sources.piedmont_classes",
    "piedmont-fitness": "sources.piedmont_fitness",
    "piedmont-cme": "sources.piedmont_cme",
    "piedmont-heart-conferences": "sources.piedmont_heart_conferences",
    "piedmont-womens-heart": "sources.piedmont_womens_heart",
    "piedmont-luminaria": "sources.piedmont_luminaria",
    "piedmont-transplant": "sources.piedmont_transplant",
    "piedmont-athens": "sources.piedmont_athens",
    "piedmonthealthcare-events": "sources.piedmonthealthcare_events",
    # ===== Colleges & Universities =====
    "georgia-tech-athletics": "sources.georgia_tech_athletics",
    "georgia-tech-events": "sources.georgia_tech_events",
    "emory-events": "sources.emory_events",
    "gsu-athletics": "sources.gsu_athletics",
    "spelman-college": "sources.spelman_college",
    "morehouse-college": "sources.morehouse_college",
    "clark-atlanta": "sources.clark_atlanta",
    "kennesaw-state": "sources.kennesaw_state",
    "scad-atlanta": "sources.scad_atlanta",
    "agnes-scott": "sources.agnes_scott",
    "spivey-hall": "sources.spivey_hall",
    "oglethorpe-university": "sources.oglethorpe_university",
    # ===== New Venues =====
    "knock-music-house": "sources.knock_music_house",
    "side-saddle": "sources.side_saddle",
    "woofs-atlanta": "sources.woofs_atlanta",
    "sports-social": "sources.sports_social",
    "park-tavern": "sources.park_tavern",
    "midway-pub": "sources.midway_pub",
    "spaceman-rooftop": "sources.spaceman_rooftop",
    "rowdy-tiger": "sources.rowdy_tiger",
    # ===== Bookstores =====
    "bookish-atlanta": "sources.bookish_atlanta",
    "wild-aster-books": "sources.wild_aster_books",
    "book-boutique": "sources.book_boutique",
    # ===== Organizations =====
    "arts-atl": "sources.arts_atl",
    "atlanta-cultural-affairs": "sources.atlanta_cultural_affairs",
    "community-foundation-atl": "sources.community_foundation_atl",
    # ===== Tier 2 Sports Bars & Venues =====
    "fado-irish-pub": "sources.fado_irish_pub",
    "stats-downtown": "sources.stats_downtown",
    "meehans-pub": "sources.meehans_pub",
    "urban-grind": "sources.urban_grind",
    "kats-cafe": "sources.kats_cafe",
    "gypsy-kitchen": "sources.gypsy_kitchen",
    "sun-dial-restaurant": "sources.sun_dial_restaurant",
    # ===== Gaming & Barcades =====
    "battle-and-brew": "sources.battle_and_brew",
    "joystick-gamebar": "sources.joystick_gamebar",
    # ===== Poker & Chess =====
    "freeroll-atlanta": "sources.freeroll_atlanta",
    "georgia-chess": "sources.georgia_chess",
}


def run_crawler(source: dict) -> tuple[int, int, int]:
    """
    Run crawler for a single source.

    Args:
        source: Source record from database

    Returns:
        Tuple of (events_found, events_new, events_updated)
    """
    slug = source["slug"]

    if slug not in SOURCE_MODULES:
        logger.warning(f"No crawler implemented for source: {slug}")
        return 0, 0, 0

    try:
        module = import_module(SOURCE_MODULES[slug])
        return module.crawl(source)
    except ImportError as e:
        logger.error(f"Failed to import crawler module for {slug}: {e}")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Crawler failed for {slug}: {e}")
        raise


def run_source(slug: str) -> bool:
    """
    Run crawler for a specific source by slug.

    Args:
        slug: Source slug to crawl

    Returns:
        True if successful, False otherwise
    """
    source = get_source_by_slug(slug)

    if not source:
        logger.error(f"Source not found: {slug}")
        return False

    if not source["is_active"]:
        logger.warning(f"Source is not active: {slug}")
        return False

    logger.info(f"Starting crawl for: {source['name']}")
    log_id = create_crawl_log(source["id"])

    try:
        found, new, updated = run_crawler(source)
        update_crawl_log(
            log_id,
            status="success",
            events_found=found,
            events_new=new,
            events_updated=updated
        )
        logger.info(
            f"Completed {source['name']}: "
            f"{found} found, {new} new, {updated} updated"
        )
        return True

    except Exception as e:
        update_crawl_log(log_id, status="error", error_message=str(e))
        logger.error(f"Failed {source['name']}: {e}")
        return False


def run_all_sources() -> dict[str, bool]:
    """
    Run crawlers for all active sources.

    Returns:
        Dict mapping source slug to success status
    """
    sources = get_active_sources()
    results = {}

    logger.info(f"Running crawlers for {len(sources)} active sources")

    for source in sources:
        slug = source["slug"]
        results[slug] = run_source(slug)

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(f"Crawl complete: {success} succeeded, {failed} failed")

    # Refresh available filters for UI
    logger.info("Refreshing available filters...")
    if refresh_available_filters():
        logger.info("Available filters refreshed successfully")
    else:
        logger.warning("Failed to refresh available filters")

    return results


def main():
    """Main entry point."""
    setup_logging()

    parser = argparse.ArgumentParser(
        description="Lost City Event Crawler",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--source", "-s",
        help="Specific source slug to crawl (default: all active sources)"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List available sources and exit"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Fetch and extract but don't save to database"
    )

    args = parser.parse_args()

    if args.list:
        sources = get_active_sources()
        print("\nActive sources:")
        for source in sources:
            implemented = "✓" if source["slug"] in SOURCE_MODULES else "✗"
            print(f"  [{implemented}] {source['slug']}: {source['name']}")
        print(f"\nTotal: {len(sources)} sources")
        return 0

    if args.source:
        success = run_source(args.source)
        return 0 if success else 1
    else:
        results = run_all_sources()
        failed = sum(1 for v in results.values() if not v)
        return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
