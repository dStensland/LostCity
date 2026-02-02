#!/usr/bin/env python3
"""
Lost City Crawler - Main entry point.
Orchestrates crawling, extraction, and storage of event data.

Features:
- Circuit breaker pattern to skip consistently failing sources
- Parallel execution for faster crawls
- Auto-discovery of crawler modules
"""

import argparse
import logging
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from importlib import import_module

from db import get_active_sources, get_source_by_slug, create_crawl_log, update_crawl_log, refresh_available_filters
from utils import setup_logging
from circuit_breaker import should_skip_source, get_all_circuit_states
from fetch_logos import fetch_logos
from crawler_health import (
    record_crawl_start as health_record_start,
    record_crawl_success as health_record_success,
    record_crawl_failure as health_record_failure,
    get_recommended_workers,
    get_recommended_delay,
    should_skip_crawl,
    get_system_health_summary,
    print_health_report,
)
from data_quality import print_quality_report, get_cinema_quality_report
from post_crawl_report import save_report as save_html_report
from event_cleanup import run_full_cleanup
from analytics import record_daily_snapshot, print_analytics_report

logger = logging.getLogger(__name__)

# Parallel execution settings
MAX_WORKERS = 2  # Number of concurrent crawlers (reduced to avoid macOS socket limits)
TIMEOUT_SECONDS = 300  # 5 minute timeout per source


# Map source slugs to their crawler modules
SOURCE_MODULES = {
    "eventbrite": "sources.eventbrite",
    "terminal-west": "sources.terminal_west",
    "the-earl": "sources.the_earl",
    "drunken-unicorn": "sources.drunken_unicorn",
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
    "barnes-noble-atlanta": "sources.barnes_noble_atlanta",
    # Libraries
    "fulton-library": "sources.fulton_library",
    "dekalb-library": "sources.dekalb_library",
    "gwinnett-library": "sources.gwinnett_library",
    "cobb-library": "sources.cobb_library",
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
    "theatre-for-young-audiences": "sources.theatre_for_young_audiences",
    "creative-loafing": "sources.creative_loafing",
    "variety-playhouse": "sources.variety_playhouse",
    "tabernacle": "sources.tabernacle",
    # ===== NEW CRAWLERS - Major Arenas & Convention Centers =====
    "state-farm-arena": "sources.state_farm_arena",
    "mercedes-benz-stadium": "sources.mercedes_benz_stadium",
    "gateway-center-arena": "sources.gateway_center_arena",
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
    "boot-barn-hall": "sources.boot_barn_hall",
    "trolley-barn": "sources.trolley_barn",
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
    "city-springs": "sources.city_springs",
    # ===== Museums =====
    "fernbank": "sources.fernbank",
    "atlanta-history-center": "sources.atlanta_history_center",
    "carlos-museum": "sources.carlos_museum",
    "breman-museum": "sources.breman_museum",
    "childrens-museum": "sources.childrens_museum",
    "lego-discovery-center": "sources.lego_discovery_center",
    "civil-rights-center": "sources.civil_rights_center",
    "college-football-hof": "sources.college_football_hof",
    "college-park-main-street": "sources.college_park_main_street",
    "world-of-coca-cola": "sources.world_of_coca_cola",
    # ===== Family Entertainment & Trampoline Parks =====
    "defy-atlanta": "sources.defy_atlanta",
    "urban-air-atlanta": "sources.urban_air_atlanta",
    "sky-zone-atlanta": "sources.sky_zone_atlanta",
    # ===== Historic Sites & Cultural Venues =====
    "oakland-cemetery": "sources.oakland_cemetery",
    "wrens-nest": "sources.wrens_nest",
    "shrine-cultural-center": "sources.shrine_cultural_center",
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
    "battery-atlanta": "sources.battery_atlanta",
    "atlanta-motor-speedway": "sources.atlanta_motor_speedway",
    # ===== Tech & Community Organizations =====
    "atlanta-tech-village": "sources.atlanta_tech_village",
    "render-atl": "sources.render_atl",
    "freeside-atlanta": "sources.freeside_atlanta",
    "decatur-makers": "sources.decatur_makers",
    "the-maker-station": "sources.maker_station",
    # ===== Art Studios & Creative Spaces =====
    "janke-studios": "sources.janke_studios",
    "mudfire": "sources.mudfire",
    "spruill-center": "sources.spruill_center",
    "atlanta-clay-works": "sources.atlanta_clay_works",
    "atlanta-tech-week": "sources.atlanta_tech_week",
    "ypa-atlanta": "sources.ypa_atlanta",
    # ===== Festivals & Conventions =====
    "dragon-con": "sources.dragon_con",
    "momocon": "sources.momocon",
    "anime-weekend-atlanta": "sources.anime_weekend_atlanta",
    "dreamhack-atlanta": "sources.dreamhack_atlanta",
    "atlanta-dogwood": "sources.atlanta_dogwood",
    "inman-park-festival": "sources.inman_park_festival",
    "shaky-knees": "sources.shaky_knees",
    "atlanta-jazz-festival": "sources.atlanta_jazz_festival",
    "sweetwater-420-fest": "sources.sweetwater_420_fest",
    "one-musicfest": "sources.one_musicfest",
    "juneteenth-atlanta": "sources.juneteenth_atlanta",
    "porchfest-vahi": "sources.porchfest_vahi",
    "breakaway-atlanta": "sources.breakaway_atlanta",
    "decatur-arts-festival": "sources.decatur_arts_festival",
    "bronzelens": "sources.bronzelens",
    # ===== Additional Theaters =====
    "aurora-theatre": "sources.aurora_theatre",
    "horizon-theatre": "sources.horizon_theatre",
    "georgia-ensemble-theatre": "sources.georgia_ensemble",
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
    "contrast-artisan-ales": "sources.contrast_artisan_ales",
    "scofflaw-brewing": "sources.scofflaw_brewing",
    "second-self-brewing": "sources.second_self_brewing",
    "bold-monk-brewing": "sources.bold_monk_brewing",
    "reformation-brewery": "sources.reformation_brewery",
    "wild-heaven-beer-avondale": "sources.wild_heaven_beer",
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
    "7-stages": "sources.seven_stages",
    "seven-stages": "sources.seven_stages",  # Alias for backward compatibility
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
    "atlanta-parks-rec": "sources.atlanta_parks_rec",
    # Sports Bar Networks
    "atlutd-pubs": "sources.atlutd_pubs",
    "hawks-bars": "sources.hawks_bars",
    # ===== NEW: Running & Outdoor Clubs =====
    "atlanta-track-club": "sources.atlanta_track_club",
    "atlanta-outdoor-club": "sources.atlanta_outdoor_club",
    "blk-hiking-club": "sources.blk_hiking_club",
    "trees-atlanta": "sources.trees_atlanta",
    # ===== NEW: Civic Engagement & Social Justice Nonprofits =====
    "new-georgia-project": "sources.new_georgia_project",
    "project-south": "sources.project_south",
    "song": "sources.song",
    "dogwood-alliance": "sources.dogwood_alliance",
    "c4-atlanta": "sources.c4_atlanta",
    "united-way-atlanta": "sources.united_way_atlanta",
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
    "pushpush-arts": "sources.pushpush_arts",
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
    "georgia-tech-arts": "sources.georgia_tech_arts",
    "emory-events": "sources.emory_events",
    "emory-schwartz-center": "sources.emory_schwartz_center",
    "gsu-athletics": "sources.gsu_athletics",
    "georgia-state-university": "sources.georgia_state_university",
    "spelman-college": "sources.spelman_college",
    "morehouse-college": "sources.morehouse_college",
    "clark-atlanta": "sources.clark_atlanta",
    "kennesaw-state": "sources.kennesaw_state",
    "ksu-athletics": "sources.ksu_athletics",
    "scad-atlanta": "sources.scad_atlanta",
    "agnes-scott": "sources.agnes_scott",
    "spivey-hall": "sources.spivey_hall",
    "georgia-symphony": "sources.georgia_symphony",
    "oglethorpe-university": "sources.oglethorpe_university",
    # ===== Community Centers =====
    "ymca-atlanta": "sources.ymca_atlanta",
    # ===== Faith Communities =====
    "ebenezer-baptist-church": "sources.ebenezer_church",
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
    "brick-store-pub": "sources.brick_store_pub",
    "brake-pad": "sources.brake_pad",
    "urban-grind": "sources.urban_grind",
    "kats-cafe": "sources.kats_cafe",
    "gypsy-kitchen": "sources.gypsy_kitchen",
    "sun-dial-restaurant": "sources.sun_dial_restaurant",
    # ===== Poker & Chess =====
    "freeroll-atlanta": "sources.freeroll_atlanta",
    "georgia-chess": "sources.georgia_chess",
    # ===== Attractions =====
    "fun-spot-america-atlanta": "sources.fun_spot_atlanta",
    "stone-mountain-park": "sources.stone_mountain_park",
    "six-flags-over-georgia": "sources.six_flags",
    "trap-music-museum": "sources.trap_music_museum",
    # ===== Hotel Venues =====
    "hotel-clermont": "sources.hotel_clermont",
    "georgian-terrace-hotel": "sources.georgian_terrace",
    "skylounge-glenn-hotel": "sources.skylounge_glenn",
    # ===== Restaurants =====
    "le-colonial-atlanta": "sources.le_colonial",
    # ===== Additional Music Venues =====
    "echo-room": "sources.echo_room",
    # ===== Historic Sites & Memorials =====
    "king-center": "sources.king_center",
    # ===== Libraries & Archives =====
    "auburn-ave-library": "sources.auburn_ave_library",
    # ===== Museums: African American History =====
    "apex-museum": "sources.apex_museum",
    # ===== City & Park Events =====
    "decatur-city": "sources.decatur_city",
    "visit-decatur": "sources.visit_decatur",
    "johns-creek": "sources.johns_creek",
    "marietta-city": "sources.marietta_city",
    "college-park-city": "sources.college_park_city",
    # ===== Recurring Social Events =====
    "atlanta-recurring-social": "sources.recurring_social_events",
    # ===== Activism Organizations =====
    "aclu-georgia": "sources.aclu_georgia",
    "glahr": "sources.glahr",
    "atlanta-liberation-center": "sources.atlanta_liberation_center",
    "indivisible-atl": "sources.indivisible_atl",
    "cair-georgia": "sources.cair_georgia",
    # ===== Historic Preservation =====
    "atlanta-preservation-center": "sources.atlanta_preservation_center",
    # ===== Community Radio =====
    "wrfg-radio": "sources.wrfg_radio",
    # ===== ArtsATL =====
    "artsatl-calendar": "sources.artsatl",
    # ===== Mobilize.us Organizations =====
    "mobilize-dekalb-dems": "sources.mobilize",
    "mobilize-ga-dems": "sources.mobilize",
    "mobilize-indivisible-atl": "sources.mobilize",
    "mobilize-indivisible-cobb": "sources.mobilize",
    "mobilize-indivisible-cherokee": "sources.mobilize",
    "mobilize-indivisible-ga10": "sources.mobilize",
    "mobilize-hrc-georgia": "sources.mobilize",
    "mobilize-50501-georgia": "sources.mobilize",
    "mobilize-necessary-trouble": "sources.mobilize",
    "mobilize-voteriders": "sources.mobilize",
    # ===== Arts Centers =====
    "goat-farm-arts-center": "sources.goat_farm",
    # ===== Creative Spaces & Venues =====
    "supermarket-atl": "sources.supermarket_atl",
    "oddities-museum": "sources.oddities_museum",
    "404-found-atl": "sources.four04_found_atl",
    "mass-collective": "sources.mass_collective",
    "avondale-arts": "sources.avondale_arts",
    "hambidge-center": "sources.hambidge",
    "blue-merle-studios": "sources.blue_merle",
    "south-river-art": "sources.south_river_art",
    # ===== Immersive Experiences =====
    "illuminarium-atlanta": "sources.illuminarium",
    # ===== Community Film =====
    "wewatchstuff": "sources.wewatchstuff",
    # ===== Museums =====
    "moda": "sources.moda",
    # ===== Art Galleries =====
    "eyedrum": "sources.eyedrum",
    # ===== NEW: Community Organizations & Nonprofits =====
    "atlanta-beltline": "sources.atlanta_beltline",
    "atlanta-freethought": "sources.atlanta_freethought",
    "atlanta-mission": "sources.atlanta_mission",
    "big-brothers-big-sisters-atl": "sources.big_brothers_big_sisters_atl",
    "carter-center": "sources.carter_center",
    "everybody-wins-atlanta": "sources.everybody_wins_atlanta",
    "faith-alliance": "sources.faith_alliance",
    "food-well-alliance": "sources.food_well_alliance",
    "georgia-organics": "sources.georgia_organics",
    "georgia-peace": "sources.georgia_peace",
    "giving-kitchen": "sources.giving_kitchen",
    "hosea-helps": "sources.hosea_helps",
    "madlife-stage": "sources.madlife_stage",
    "marietta-cobb-museum": "sources.marietta_cobb_museum",
    "marietta-main-street": "sources.marietta_main_street",
    "theatre-in-the-square": "sources.theatre_in_the_square",
    "meals-on-wheels-atlanta": "sources.meals_on_wheels_atlanta",
    "out-front-theatre": "sources.out_front_theatre",
    "perfect-note-atlanta": "sources.perfect_note_atlanta",
    "scad-fash": "sources.scad_fash",
    "schoolhouse-brewing": "sources.schoolhouse_brewing",
    "south-river-forest": "sources.south_river_forest",
    "urban-league-atlanta": "sources.urban_league_atlanta",
    "wonderroot": "sources.wonderroot",
    # ===== ITP Neighborhoods: Eastside Core =====
    "chomp-and-stomp": "sources.chomp_and_stomp",
    "cabbagetown-neighborhood": "sources.cabbagetown_neighborhood",
    "reynoldstown-rcil": "sources.reynoldstown_rcil",
    "star-community-bar": "sources.star_community_bar",
    # ===== ITP Neighborhoods: Eastside Extended =====
    "pullman-yards": "sources.pullman_yards",
    "lake-claire-land-trust": "sources.lake_claire_land_trust",
    "kirkwood-spring-fling": "sources.kirkwood_spring_fling",
    "our-bar-atl": "sources.our_bar_atl",
    # ===== ITP Neighborhoods: Southside Core =====
    "summerhill-neighborhood": "sources.summerhill_neighborhood",
    "southern-feedstore": "sources.southern_feedstore",
    "grant-park-conservancy": "sources.grant_park_conservancy",
    # ===== ITP Neighborhoods: Southside Extended =====
    "pittsburgh-yards": "sources.pittsburgh_yards",
    "ormewood-park-neighborhood": "sources.ormewood_park_neighborhood",
    "peoplestown-neighborhood": "sources.peoplestown_neighborhood",
    "mechanicsville-neighborhood": "sources.mechanicsville_neighborhood",
    # ===== ITP Neighborhoods: Northside =====
    "virginia-highland-civic": "sources.virginia_highland_civic",
    "morningside-civic": "sources.morningside_civic",
    "ansley-park-civic": "sources.ansley_park_civic",
    "piedmont-heights-civic": "sources.piedmont_heights_civic",
    # ===== ITP Commercial Corridors =====
    "atlantic-station": "sources.atlantic_station",
    "lindbergh-city-center": "sources.lindbergh_city_center",
    "cheshire-bridge-district": "sources.cheshire_bridge_district",
    # ===== ITP Historic/Cultural Districts =====
    "hammonds-house": "sources.hammonds_house",
    "castleberry-art-stroll": "sources.castleberry_art_stroll",
    "west-end-neighborhood": "sources.west_end_neighborhood",
    # ===== ITP Gap Cleanup =====
    "music-midtown": "sources.music_midtown",
    "east-lake-neighborhood": "sources.east_lake_neighborhood",
    "vine-city-neighborhood": "sources.vine_city_neighborhood",
    # ===== OTP: North Fulton (Alpharetta, Roswell) =====
    "alpharetta-city": "sources.alpharetta_city",
    "roswell-city": "sources.roswell_city",
    "canton-street-roswell": "sources.canton_street_roswell",
    "variant-brewing": "sources.variant_brewing",
    # ===== OTP: Gwinnett (Johns Creek, Duluth) =====
    "duluth-city": "sources.duluth_city",
    "hudgens-center": "sources.hudgens_center",
    "downtown-duluth": "sources.downtown_duluth",
    # ===== OTP: East Gwinnett (Lawrenceville, Snellville) =====
    "lawrenceville-city": "sources.lawrenceville_city",
    "snellville-city": "sources.snellville_city",
    "snellville-farmers-market": "sources.snellville_farmers_market",
    # ===== OTP: Cobb (Kennesaw, Acworth) =====
    "kennesaw-city": "sources.kennesaw_city",
    "acworth-city": "sources.acworth_city",
    "caffeine-octane": "sources.caffeine_octane",
    "southern-museum": "sources.southern_museum",
    # ===== Additional Venues (Feb 2026) =====
    "new-realm-brewing": "sources.new_realm_brewing",
    "the-porter": "sources.the_porter",
    "chastain-arts": "sources.chastain_arts",
    "mint-gallery": "sources.mint_gallery",
    # ===== NASHVILLE CRAWLERS =====
    "ticketmaster-nashville": "sources.ticketmaster_nashville",
    "eventbrite-nashville": "sources.eventbrite_nashville",
    # Nashville Aggregators - P0
    "nashville-scene": "sources.nashville_scene",
    "do615": "sources.do615",
    "visit-music-city": "sources.visit_music_city",
    "nashville-com": "sources.nashville_com",
    # Nashville Music Venues - Batch 1: P0 Iconic Venues
    "ryman-auditorium": "sources.ryman_auditorium",
    "grand-ole-opry": "sources.grand_ole_opry",
    "bluebird-cafe": "sources.bluebird_cafe",
    "bridgestone-arena": "sources.bridgestone_arena",
    "station-inn": "sources.station_inn",
    # Nashville Arts & Culture - P0 Venues
    "tpac": "sources.tpac",
    "schermerhorn": "sources.schermerhorn",
    "belcourt-theatre": "sources.belcourt_theatre",
    "frist-art-museum": "sources.frist_art_museum",
    "country-music-hof": "sources.country_music_hof",
    "franklin-theatre": "sources.franklin_theatre",
    # Nashville Music Venues - Batch 2
    "exit-in": "sources.exit_in",
    "basement-east": "sources.basement_east",
    "marathon-music-works": "sources.marathon_music_works",
    "brooklyn-bowl-nashville": "sources.brooklyn_bowl_nashville",
    "third-and-lindsley": "sources.third_and_lindsley",
    # ===== NASHVILLE SUBURBS =====
    # Franklin
    "visit-franklin": "sources.visit_franklin",
    "downtown-franklin": "sources.downtown_franklin",
    "factory-franklin": "sources.factory_franklin",
    # Murfreesboro
    "murfreesboro-city": "sources.murfreesboro_city",
    "main-street-murfreesboro": "sources.main_street_murfreesboro",
    "mtsu-events": "sources.mtsu_events",
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
    modules = get_source_modules()

    if slug not in modules:
        logger.warning(f"No crawler implemented for source: {slug}")
        return 0, 0, 0

    try:
        module = import_module(modules[slug])
        return module.crawl(source)
    except ImportError as e:
        logger.error(f"Failed to import crawler module for {slug}: {e}")
        return 0, 0, 0
    except Exception as e:
        logger.error(f"Crawler failed for {slug}: {e}")
        raise


def run_source(slug: str, skip_circuit_breaker: bool = False) -> bool:
    """
    Run crawler for a specific source by slug.

    Args:
        slug: Source slug to crawl
        skip_circuit_breaker: If True, bypass circuit breaker check

    Returns:
        True if successful, False otherwise
    """
    # Get recommended delay based on source health
    delay = get_recommended_delay(slug)
    # Add some randomness to spread out requests
    time.sleep(delay + random.uniform(0.0, 0.5))

    source = get_source_by_slug(slug)

    if not source:
        logger.error(f"Source not found: {slug}")
        return False

    if not source["is_active"]:
        logger.warning(f"Source is not active: {slug}")
        return False

    # Check circuit breaker (unless bypassed)
    if not skip_circuit_breaker:
        should_skip, reason = should_skip_source(source)
        if should_skip:
            logger.warning(f"Skipping {slug}: circuit breaker open ({reason})")
            return False

    # Check health-based skip
    health_skip, health_reason = should_skip_crawl(slug)
    if health_skip and not skip_circuit_breaker:
        logger.warning(f"Skipping {slug}: health check failed ({health_reason})")
        return False

    logger.info(f"Starting crawl for: {source['name']}")
    log_id = create_crawl_log(source["id"])

    # Record start in health tracker
    health_run_id = health_record_start(slug)

    try:
        found, new, updated = run_crawler(source)
        update_crawl_log(
            log_id,
            status="success",
            events_found=found,
            events_new=new,
            events_updated=updated
        )
        # Record success in health tracker
        health_record_success(health_run_id, found, new, updated)
        logger.info(
            f"Completed {source['name']}: "
            f"{found} found, {new} new, {updated} updated"
        )
        return True

    except Exception as e:
        update_crawl_log(log_id, status="error", error_message=str(e))
        # Record failure in health tracker
        health_record_failure(health_run_id, str(e))
        logger.error(f"Failed {source['name']}: {e}")
        return False


def run_all_sources(parallel: bool = True, max_workers: int = MAX_WORKERS, adaptive: bool = True) -> dict[str, bool]:
    """
    Run crawlers for all active sources.

    Args:
        parallel: If True, run crawlers in parallel (default: True)
        max_workers: Maximum number of parallel workers
        adaptive: If True, adjust workers based on health (default: True)

    Returns:
        Dict mapping source slug to success status
    """
    sources = get_active_sources()
    results = {}

    # Use adaptive worker count if enabled
    if adaptive:
        recommended = get_recommended_workers()
        if recommended < max_workers:
            logger.info(f"Adaptive: reducing workers from {max_workers} to {recommended} based on health")
            max_workers = recommended

    # Pre-filter sources with open circuit breakers
    active_sources = []
    skipped_sources = []

    for source in sources:
        should_skip, reason = should_skip_source(source)
        if should_skip:
            skipped_sources.append((source["slug"], reason))
            results[source["slug"]] = False
        else:
            active_sources.append(source)

    if skipped_sources:
        logger.warning(
            f"Skipping {len(skipped_sources)} sources due to circuit breaker: "
            f"{[s[0] for s in skipped_sources]}"
        )

    logger.info(
        f"Running crawlers for {len(active_sources)} sources "
        f"({len(skipped_sources)} skipped by circuit breaker)"
    )

    if parallel and len(active_sources) > 1:
        # Parallel execution
        logger.info(f"Using parallel execution with {max_workers} workers")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_slug = {
                executor.submit(run_source, source["slug"], True): source["slug"]
                for source in active_sources
            }

            # Collect results as they complete
            for future in as_completed(future_to_slug, timeout=TIMEOUT_SECONDS * len(active_sources)):
                slug = future_to_slug[future]
                try:
                    results[slug] = future.result(timeout=TIMEOUT_SECONDS)
                except Exception as e:
                    logger.error(f"Parallel execution failed for {slug}: {e}")
                    results[slug] = False
    else:
        # Sequential execution
        for source in active_sources:
            slug = source["slug"]
            results[slug] = run_source(slug, skip_circuit_breaker=True)

    # Summary
    success = sum(1 for v in results.values() if v)
    failed = len(results) - success
    logger.info(
        f"Crawl complete: {success} succeeded, {failed} failed, "
        f"{len(skipped_sources)} circuit-breaker skipped"
    )

    # Refresh available filters for UI
    logger.info("Refreshing available filters...")
    if refresh_available_filters():
        logger.info("Available filters refreshed successfully")
    else:
        logger.warning("Failed to refresh available filters")

    # Fetch logos for any producers missing them
    logger.info("Fetching logos for producers...")
    try:
        logo_results = fetch_logos()
        logger.info(
            f"Logo fetch complete: {logo_results['success']} new, "
            f"{logo_results['failed']} failed, {logo_results['skipped']} skipped"
        )
    except Exception as e:
        logger.warning(f"Logo fetch failed: {e}")

    # Log health summary
    try:
        health = get_system_health_summary()
        logger.info(
            f"Health summary: {health['sources']['healthy']} healthy, "
            f"{health['sources']['degraded']} degraded, "
            f"{health['sources']['unhealthy']} unhealthy sources"
        )
    except Exception as e:
        logger.debug(f"Could not get health summary: {e}")

    # ===== POST-CRAWL TASKS =====

    # 1. Clean up old events
    logger.info("Running post-crawl cleanup...")
    try:
        cleanup_results = run_full_cleanup(days_to_keep=7, dry_run=False)
        total_deleted = sum(r.get("deleted", 0) for r in cleanup_results.values())
        logger.info(f"Cleanup complete: {total_deleted} events removed")
    except Exception as e:
        logger.warning(f"Cleanup failed: {e}")

    # 2. Record daily analytics snapshot
    logger.info("Recording analytics snapshot...")
    try:
        snapshot = record_daily_snapshot()
        logger.info(f"Analytics: {snapshot.get('total_upcoming_events', 0)} upcoming events")
    except Exception as e:
        logger.warning(f"Analytics snapshot failed: {e}")

    # 3. Generate HTML report
    logger.info("Generating post-crawl report...")
    try:
        report_path = save_html_report()
        logger.info(f"Report saved: {report_path}")
    except Exception as e:
        logger.warning(f"Report generation failed: {e}")

    return results


def auto_discover_modules() -> dict[str, str]:
    """
    Auto-discover crawler modules from the sources directory.
    Maps slug (derived from filename) to module path.

    Filename convention: sources/<slug_with_underscores>.py
    Example: sources/terminal_west.py -> "terminal-west": "sources.terminal_west"
    """
    sources_dir = os.path.join(os.path.dirname(__file__), "sources")
    discovered = {}

    if not os.path.exists(sources_dir):
        logger.warning(f"Sources directory not found: {sources_dir}")
        return discovered

    for filename in os.listdir(sources_dir):
        if filename.endswith(".py") and not filename.startswith("_"):
            module_name = filename[:-3]  # Remove .py
            # Convert underscores to hyphens for slug
            slug = module_name.replace("_", "-")
            discovered[slug] = f"sources.{module_name}"

    return discovered


def get_source_modules() -> dict[str, str]:
    """
    Get all available source modules.
    Merges hardcoded SOURCE_MODULES with auto-discovered modules.
    Hardcoded takes precedence for explicit mappings.
    """
    discovered = auto_discover_modules()
    # Merge: hardcoded takes precedence
    merged = {**discovered, **SOURCE_MODULES}
    return merged


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
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Run crawlers sequentially instead of in parallel"
    )
    parser.add_argument(
        "--workers", "-w",
        type=int,
        default=MAX_WORKERS,
        help=f"Number of parallel workers (default: {MAX_WORKERS})"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force crawl even if circuit breaker is open"
    )
    parser.add_argument(
        "--circuit-status",
        action="store_true",
        help="Show circuit breaker status for all sources"
    )
    parser.add_argument(
        "--health",
        action="store_true",
        help="Show crawler health report and exit"
    )
    parser.add_argument(
        "--no-adaptive",
        action="store_true",
        help="Disable adaptive worker count (use fixed workers)"
    )
    parser.add_argument(
        "--quality",
        action="store_true",
        help="Show data quality report and exit"
    )
    parser.add_argument(
        "--quality-all",
        action="store_true",
        help="Show data quality report for all sources"
    )
    parser.add_argument(
        "--analytics",
        action="store_true",
        help="Show analytics report and exit"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate HTML report and exit"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Run event cleanup and exit"
    )
    parser.add_argument(
        "--cleanup-dry-run",
        action="store_true",
        help="Show what cleanup would delete without actually deleting"
    )

    args = parser.parse_args()

    # Health report
    if args.health:
        print_health_report()
        return 0

    # Data quality report
    if args.quality or args.quality_all:
        print_quality_report(days=30, show_all=args.quality_all)
        return 0

    # Analytics report
    if args.analytics:
        print_analytics_report()
        return 0

    # Generate HTML report
    if args.report:
        report_path = save_html_report()
        print(f"Report generated: {report_path}")
        return 0

    # Event cleanup
    if args.cleanup or args.cleanup_dry_run:
        dry_run = args.cleanup_dry_run
        results = run_full_cleanup(days_to_keep=7, dry_run=dry_run)
        if dry_run:
            total_would_delete = sum(r.get("would_delete", 0) for r in results.values())
            print(f"\n[DRY RUN] Would delete {total_would_delete} events")
        else:
            total_deleted = sum(r.get("deleted", 0) for r in results.values())
            print(f"\nDeleted {total_deleted} events")
        return 0

    # Circuit breaker status
    if args.circuit_status:
        states = get_all_circuit_states()
        print("\nCircuit Breaker Status:")
        print("-" * 60)
        open_circuits = [s for s in states if s.is_open]
        degraded = [s for s in states if not s.is_open and s.consecutive_failures > 0]
        healthy = [s for s in states if not s.is_open and s.consecutive_failures == 0]

        if open_circuits:
            print(f"\n🔴 OPEN ({len(open_circuits)} sources):")
            for s in open_circuits:
                print(f"  {s.slug}: {s.consecutive_failures} failures - {s.reason}")

        if degraded:
            print(f"\n🟡 DEGRADED ({len(degraded)} sources):")
            for s in degraded:
                print(f"  {s.slug}: {s.consecutive_failures} failures")

        print(f"\n🟢 HEALTHY: {len(healthy)} sources")
        print(f"\nTotal: {len(states)} sources")
        return 0

    # List sources
    if args.list:
        sources = get_active_sources()
        modules = get_source_modules()
        print("\nActive sources:")
        for source in sources:
            implemented = "✓" if source["slug"] in modules else "✗"
            print(f"  [{implemented}] {source['slug']}: {source['name']}")
        print(f"\nTotal: {len(sources)} sources")
        print(f"Crawler modules: {len(modules)} available")
        return 0

    # Single source
    if args.source:
        success = run_source(args.source, skip_circuit_breaker=args.force)
        return 0 if success else 1

    # All sources
    results = run_all_sources(
        parallel=not args.sequential,
        max_workers=args.workers,
        adaptive=not args.no_adaptive
    )
    failed = sum(1 for v in results.values() if not v)
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
