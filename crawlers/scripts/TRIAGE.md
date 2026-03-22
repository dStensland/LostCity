# Scripts Triage (2026-03-21)

291 Python scripts audited. Categorized by reading docstrings and first 15–20 lines.

---

## Category A: Already Run Once (→ archive/)

One-time migrations, seed operations, data fixes for specific historical issues, and
source-registration scripts whose work is done (source records now exist in the DB).

### Source Registration (add_* / activate_*)
These scripts insert or activate specific sources. Once the DB has the record, they're done.

| Script | Description |
|--------|-------------|
| `activate_bar_sources.py` | Activated inactive Atlanta bar/nightlife sources |
| `activate_mudfire.py` | Activated MudFire Pottery Studio source |
| `activate_sources.py` | Activated midway-pub and wild-heaven |
| `add_7_stages_source.py` | Registered 7 Stages source |
| `add_atlanta_humane_source.py` | Registered Atlanta Humane Society (Eventbrite org) |
| `add_barnes_noble_source.py` | Registered Barnes & Noble Atlanta source |
| `add_best_restaurants_bars.py` | Added "Best Of" restaurant/bar venues (Thrillist/Atlanta Magazine) |
| `add_breweries_nightlife.py` | Added top breweries and nightlife spots |
| `add_buddhist_sources.py` | Registered 2 Buddhist meditation center sources |
| `add_class_sources.py` | Registered class venue sources (Candlelit ATL etc.) |
| `add_coffee_shops.py` | Added top Atlanta coffee shops as venues |
| `add_college_park_source.py` | Registered City of College Park source |
| `add_eater_venues.py` | Added Eater Atlanta best restaurant/bar venues |
| `add_empowerline_source.py` | Registered Empowerline (Atlanta Regional Commission seniors) |
| `add_environmental_sources.py` | Registered Chattahoochee Riverkeeper and other env orgs |
| `add_essential_spots.py` | Added iconic Atlanta spots as venues |
| `add_exhibition_hub.py` | Registered Exhibition Hub Atlanta source |
| `add_hammonds_house_source.py` | Registered Hammonds House Museum source |
| `add_hospital_sources.py` | Registered NGHS and other hospital system crawlers |
| `add_hotel_sources.py` | Registered hotel venue sources (Hotel Clermont etc.) |
| `add_lego_discovery_center.py` | Registered LEGO Discovery Center Atlanta |
| `add_missing_sources.py` | Batch-registered ~10 major Atlanta venue sources |
| `add_must_toolbank_sources.py` | Registered MUST Ministries and Atlanta ToolBank |
| `add_nashville_suburbs.py` | Registered Nashville suburban sources (Visit Franklin etc.) |
| `add_new_sources_batch2.py` | Batch 2: LGBTQ+ venues and others |
| `add_new_sources_batch3.py` | Batch 3: haunted attractions and others |
| `add_new_sources_batch4.py` | Batch 4: more haunted attractions |
| `add_paws_atlanta.py` | Registered PAWS Atlanta |
| `add_reddit_restaurants.py` | Added ~31 Atlanta restaurants from Reddit thread |
| `add_sandler_hudson_source.py` | Registered Sandler Hudson Gallery source |
| `add_schr_source.py` | Registered Southern Center for Human Rights |
| `add_sources.py` | Batch-registered 30 new sources (Aurora Theatre, Horizon, etc.) |
| `add_support_group_sources.py` | Registered DBSA Atlanta and Ridgeview Institute |
| `add_tea_venues.py` | Added tea room venues as destinations |
| `add_venues.py` | Added parks, music venues, maker spaces, bookstores |
| `add_veteran_sources.py` | Registered VETLANTA, Warrior Alliance, ATLVets |
| `add_wrcdv_source.py` | Registered Women's Resource Center to End Domestic Violence |

### One-Time Data Migrations and Fixes

| Script | Description |
|--------|-------------|
| `apply_closed_venues.py` | Applied closed-venue registry to DB (deactivate known-closed venues) |
| `apply_method_audit_fixes.py` | Applied targeted fixes from `tmp/method_audit.json` (profile method routing) |
| `apply_portal_assignments.py` | Assigned source owner portals and backfilled NULL portal_id |
| `backfill_blurhash.py` | Computed BlurHash strings for existing event/venue images |
| `backfill_event_genres.py` | One-time: re-inferred genres on recurring events with empty genres |
| `backfill_experience_flag.py` | Backfilled `is_experience` flag on qualifying venues |
| `backfill_experience_images.py` | Fetched Google Places images for experience-type venues with no image |
| `backfill_festival_links_by_source.py` | Backfilled `festival_id` links for dedicated festival source slugs |
| `backfill_festival_program_series.py` | Reassigned events into per-program series buckets |
| `backfill_film_identity.py` | Backfilled `film_title`, `film_imdb_id` etc. on film events |
| `backfill_film_metadata.py` | Fetched OMDB metadata for series where `series_type='film'` |
| `backfill_genres.py` | Full genre/tag backfill including subcategory→genre migration |
| `backfill_hands_on_atlanta_titles.py` | Fixed generic "Volunteer: Volunteer" titles from HOA source |
| `backfill_historic_landmarks.py` | Corrected venue types for historic sites/landmarks |
| `backfill_hooky_programs.py` | Backfilled `programs` rows from existing family event inventory |
| `backfill_images.py` | Fetched movie posters and artist images for events missing them |
| `backfill_museum_exhibits.py` | Added canonical "current exhibitions" events for museum sources failing exhibit goals |
| `backfill_post_categories.py` | One-time: reclassified network_posts using keyword matching |
| `backfill_series_data.py` | Enriched series records by inheriting descriptions/images from events |
| `backfill_source_data_goals.py` | Backfilled/normalized `data_goals` in source profiles |
| `backfill_tags.py` | One-time: added inferred tags to existing events |
| `backfill_tentpole_source_provenance.py` | Set `source_id` on tentpole events with `source_id=NULL` |
| `backfill_trail_venues.py` | Backfilled `venue_type='trail'` on trail/outdoor venues |
| `backfill_yonder_destination_details.py` | Converted Yonder seed metadata into `venue_destination_details` rows |
| `batch_insert_restaurants_bars.py` | Batch-inserted missing restaurants/bars cross-referenced against existing 841 |
| `canonicalize_cross_source_duplicates.py` | Marked cross-source duplicates as non-canonical (one-time backfill pass) |
| `canonicalize_same_source_exact_duplicates.py` | Canonicalized exact same-source duplicates (one-time backfill pass) |
| `classify_demoted_festival_actions.py` | Classified demoted festival sources into archive vs rebuild actions |
| `cleanup_data_quality.py` | Deleted Summit Skyride fake events, stale past events, duplicates |
| `cleanup_duplicate_activity_venues.py` | Deactivated duplicate Atlanta activity venue shell rows |
| `cleanup_festivals.py` | One-time cleanup for bad `festival_program` series data |
| `cleanup_major_hotel_aliases.py` | Merged major hotel alias/rebrand venue records into canonical slugs |
| `cleanup_museum_aliases.py` | Merged duplicate museum venue rows into canonical Atlanta slugs |
| `cleanup_no_coords.py` | Deactivated junk venues and geocoded ~657 venues missing lat/lng |
| `cleanup_placeholder_events.py` | Removed "Coming Soon" / TBA cinema events |
| `cleanup_venue_data.py` | Deactivated non-destination venues, merged exact-name duplicates |
| `cleanup_vibes.py` | Normalized venue vibes to canonical VALID_VIBES taxonomy |
| `deactivate_events_on_inactive_venues.py` | Deactivated events linked to inactive venues |
| `deactivate_exhibit_spam.py` | Reclassified Stone Mountain / Chattahoochee permanent attractions as `content_kind='exhibit'` |
| `deactivate_tba_events.py` | Moved TBA events with no start_time to year 2099 |
| `demote_inactive_tentpoles.py` | Demoted `is_tentpole` flags on inactive event rows |
| `disable_broken_sources.py` | Disabled sources with 0% success rate or consistent 0-event yield |
| `extract_yonder_ga_state_park_inventory.py` | Read-only extraction of GA State Parks inventory summaries (no DB writes) |
| `fix_atlanta_activity_quality_metadata.py` | Applied targeted venue metadata fixes from activity quality audit |
| `fix_broken_image_urls.py` | Fixed empty, protocol-relative, relative, data URI image URLs |
| `fix_college_park_geocoding.py` | Fixed geocoding for College Park/East Point/Hapeville venues |
| `fix_critical_crawler_issues.py` | Fixed category mismatches found in audit (file edits, not DB) |
| `fix_data_quality.py` | Fixed P0 issues: duplicates, permanent attractions, invalid categories |
| `fix_exhibit_data.py` | Fixed events with exhibit signals mistyped as `content_kind='event'` |
| `fix_exhibition_data.py` | Fixed the Serial Killer exhibit data (one specific event record) |
| `fix_experience_venue_types.py` | Fixed venue_type misclassifications breaking Experience feed chips |
| `fix_hours_day_keys.py` | One-time: converted full-name day keys to 3-letter abbreviated keys in ~111 venues |
| `fix_invalid_categories.py` | Fixed non-standard categories: outdoor→outdoors, museums→art etc. |
| `fix_music_venue_quality.py` | Fixed duplicate events and garbage descriptions at music venues |
| `fix_recurrence_day_mismatch.py` | Fixed recurring events where RRULE BYDAY didn't match start_date's day |
| `fix_remaining_issues.py` | Fixed remaining P0 issues after initial cleanup pass |
| `fix_sf_venue_leak.py` | Suppressed two San Francisco bar crawl events leaking into Atlanta feed |
| `fix_spelman_exhibitions.py` | Fixed Spelman College exhibition dates and added "Repossessions" |
| `fix_streets_alive_dedup.py` | Deduplicated Streets Alive March 22 event (5 records → 1 canonical) |
| `fix_times.py` | Identified and fixed events with time extraction issues |
| `generate_action_items.py` | Generated CSV export of specific fix lists after data_quality_report.py |
| `import_all_venues.py` | Master script to import all curated Atlanta venues + Foursquare hydration |
| `import_alpharetta_roswell_destinations.py` | Imported curated Alpharetta/Roswell destinations |
| `import_cabbagetown_destinations.py` | Imported Cabbagetown restaurants, bars, shops |
| `import_class_venues.py` | Imported ~45 class/studio venues (pottery, art, makerspaces, etc.) |
| `import_cocktail_bars.py` | Imported ~10 cocktail bars and speakeasies |
| `import_college_park_destinations.py` | Imported College Park priority destinations |
| `import_college_park_orgs.py` | Imported College Park community organizations to `event_producers` |
| `import_decatur_destinations.py` | Imported 65+ Decatur destinations (restaurants, bars, coffee, breweries) |
| `import_duluth_destinations.py` | Imported Duluth destinations (known for Korean community) |
| `import_eater_nashville.py` | Imported Eater Nashville Essential 38 venues |
| `import_escape_rooms.py` | Imported ~10 escape room venues |
| `import_faith_venues.py` | Imported Tier 2 faith-based venues |
| `import_food_venues.py` | Imported food halls and food truck parks (~5 venues) |
| `import_karaoke_venues.py` | Imported ~6 karaoke venues |
| `import_kennesaw_acworth_destinations.py` | Imported Kennesaw/Acworth destinations |
| `import_lawrenceville_snellville_destinations.py` | Imported Lawrenceville/Snellville destinations |
| `import_madison_yards_destinations.py` | Imported Madison Yards mixed-use development venues |
| `import_major_atlanta_hotels_destinations.py` | Imported major Atlanta hotels as destination venues |
| `import_minor_sports.py` | Imported minor league/semi-pro sports venues (Gladiators, Stripers etc.) |
| `import_nashville_comprehensive.py` | Imported comprehensive Nashville bars, coffee, breweries, attractions |
| `import_nashville_destinations.py` | Imported top Nashville Metro destinations |
| `import_nashville_orgs.py` | Imported Nashville Metro organizations to `event_producers` |
| `import_outdoor_recreation.py` | Imported outdoor recreation venues (Stone Summit, Sweetwater Creek etc.) |
| `import_reynoldstown_destinations.py` | Imported Reynoldstown Georgia Ave corridor venues |
| `import_workshop_studios.py` | Imported ~10 workshop/creative studio venues |
| `migrate_exhibit_events_to_exhibitions.py` | **Pending, not yet run.** Migrates false-positive `content_kind='exhibit'` events back to `content_kind='event'`, and promotes true exhibition events to the `exhibitions` table. Left in `scripts/` until executed. |
| `migrate_exhibits_to_features.py` | Migrated `content_kind='exhibit'` events to `venue_features` rows |
| `migrate_specials_to_events.py` | Migrated venue_specials that are really recurring events into `events` table |
| `normalize_atlanta_activity_legacy_packs.py` | Normalized legacy activity feature packs to modern three-row overlay standard |
| `normalize_categories.py` | Normalized non-standard event categories to valid taxonomy |
| `normalize_orphan_festival_sources.py` | Reclassified incorrectly typed festival sources to organization sources |
| `normalize_venue_types.py` | Normalized non-standard venue types to valid taxonomy |
| `promote_preferred_sources.py` | Promoted historical aggregator-owned events to preferred source in duplicate groups |
| `reactivate_inactive_venues_with_future_events.py` | Reactivated inactive venues that have valid future events |
| `remediate_festival_tentpole_foundation.py` | Targeted root-cause fixes for festival/tentpole coverage quality |
| `remediation_phase1.py` | Phase 1 remediation: AA/NA portal scope, dead domains, Stone Mountain attractions |
| `repair_event_images.py` | Replaced broken event images with fallbacks (venue image, OG image) |
| `repair_nonzero_quality_gaps.py` | In-place repair for sources failing data goals: images, tickets, lineup |
| `repair_program_identities.py` | Backfilled content hashes and pruned duplicate program rows |
| `seed_metalsome_karaoke.py` | Seeded Metalsome Live Band Karaoke recurring events at Dark Horse Tavern |
| `tag_structural_festival_sources.py` | Tagged inactive festival source rows that are structural containers |
| `update_venue_data.py` | Updated specific venue records with corrected coordinates and vibes |

### Yonder Seed Scripts (all waves, all types — one-time data loads)

| Script | Description |
|--------|-------------|
| `seed_atlanta_activity_overlays.py` | Seeded wave 1 of 12 family activity `venue_features` overlays |
| `seed_atlanta_activity_overlays_wave2.py` | Seeded activity overlays wave 2 |
| `seed_atlanta_activity_overlays_wave3.py` | Seeded activity overlays wave 3 |
| `seed_atlanta_activity_overlays_wave4.py` | Seeded activity overlays wave 4 + venue rows |
| `seed_atlanta_activity_overlays_wave5_catch_air.py` | Seeded Catch Air Georgia locations |
| `seed_atlanta_activity_overlays_wave6_family_fun.py` | Seeded family fun wave |
| `seed_atlanta_activity_overlays_wave7_family_outings.py` | Seeded family outings wave |
| `seed_atlanta_activity_overlays_wave8_water_farm_fun.py` | Seeded water/farm/fun wave |
| `seed_atlanta_activity_overlays_wave9_trampoline_and_farms.py` | Seeded trampoline and farms wave |
| `seed_atlanta_activity_overlays_urban_air.py` | Seeded Urban Air location overlays |
| `seed_atlanta_activity_overlays_wave10_destinations.py` | Seeded final destination batch overlays |
| `seed_yonder_wave1_destinations.py` | Seeded Yonder Wave 1 regional destinations |
| `seed_yonder_wave2_destinations.py` | Seeded Yonder Wave 2 |
| `seed_yonder_wave5_destinations.py` | Seeded Yonder Wave 5 |
| `seed_yonder_wave6_ring1_gapmatch.py` | Seeded Ring 1 (0-1hr Atlanta) gap-fill |
| `seed_yonder_wave7_ring2_gapmatch.py` | Seeded Ring 2 (1-2hr Atlanta) gap-fill |
| `seed_yonder_wave8_ring3_multistate.py` | Seeded Ring 3 (2-3hr) multi-state expansion |
| `seed_yonder_wave9_ring4_smokies.py` | Seeded Ring 4 (3-4hr): Smokies / Asheville / Pisgah |
| `seed_yonder_wave10_hidden_gems.py` | Seeded hidden gems and specialty destinations across all rings |
| `seed_yonder_wave11_ga_state_parks.py` | Seeded GA state parks and major trails |
| `seed_yonder_wave12_ga_waterfalls_nature.py` | Seeded GA waterfalls, lakes, mountains, urban nature |
| `seed_yonder_wave13_tn_ky_expansion.py` | Seeded Tennessee state parks + Kentucky gorges |
| `seed_yonder_wave14_nc_expansion.py` | Seeded NC mountains / waterfalls / Asheville orbit |
| `seed_yonder_wave15_sc_al_expansion.py` | Seeded SC parks and Alabama canyons/caverns |
| `seed_yonder_wave16_research_gaps.py` | Seeded MTB trails, waterfalls, rivers, agritourism, disc golf |
| `seed_yonder_federal_backbone_wave1.py` | Seeded federal park/rec-area backbone wave 1 |
| `seed_yonder_federal_backbone_wave2.py` | Seeded federal backbone wave 2 (Corps lake anchors) |
| `seed_yonder_federal_backbone_wave3.py` | Seeded federal backbone wave 3 (hiking/paddling/wildlife) |
| `seed_yonder_nps_campgrounds_wave1.py` | Seeded NPS campground wave 1 |
| `seed_yonder_campgrounds_wave_review1.py` | Seeded highest-confidence needs_review campground rows |
| `seed_yonder_private_campgrounds_wave1.py` | Seeded private/operator campground wave 1 |
| `seed_yonder_private_campgrounds_wave2.py` | Seeded private campground wave 2 |
| `seed_yonder_private_campgrounds_wave3.py` | Seeded private campground wave 3 |
| `seed_yonder_private_campgrounds_wave4.py` | Seeded private campground wave 4 |
| `seed_yonder_private_campgrounds_wave5.py` | Seeded private campground wave 5 |
| `seed_yonder_private_campgrounds_wave6.py` | Seeded private campground wave 6 |
| `seed_yonder_private_campgrounds_wave7.py` | Seeded private campground wave 7 |
| `seed_yonder_private_campgrounds_wave8.py` | Seeded private campground wave 8 |
| `seed_yonder_public_land_campgrounds_wave1.py` | Seeded public-land campground wave 1 |
| `seed_yonder_public_land_campgrounds_wave2.py` | Seeded public-land campground wave 2 |
| `seed_yonder_public_land_campgrounds_wave3.py` | Seeded public-land campground wave 3 |
| `seed_yonder_public_land_campgrounds_wave4.py` | Seeded public-land campground wave 4 |
| `seed_yonder_public_land_campgrounds_wave5.py` | Seeded public-land campground wave 5 |
| `seed_yonder_public_land_campgrounds_wave6.py` | Seeded public-land campground wave 6 (special-case official campgrounds) |
| `seed_yonder_public_land_campgrounds_wave7.py` | Seeded public-land campground wave 7 (Ocmulgee Flats normalization) |
| `seed_yonder_public_land_campgrounds_wave8.py` | Seeded public-land campground wave 8 |
| `seed_yonder_public_land_campgrounds_wave9.py` | Seeded public-land campground wave 9 (state-park special-permit inventory) |
| `seed_yonder_public_land_campgrounds_wave10.py` | Seeded public-land campground wave 10 (campground-child depth gap) |
| `seed_yonder_public_land_trails_wave1.py` | Seeded public-land trail wave 1 |
| `seed_yonder_public_land_trails_wave2.py` | Seeded public-land trail wave 2 |
| `seed_yonder_public_land_trails_wave3.py` | Seeded public-land trail wave 3 |
| `seed_yonder_public_land_trails_wave4.py` | Seeded public-land trail wave 4 (Tallulah Gorge normalization) |
| `seed_yonder_public_land_trails_wave5.py` | Seeded public-land trail wave 5 (USFS-import provenance routes) |
| `seed_yonder_state_park_hiking_wave1.py` | Seeded state-park hiking wave 1 (FDR State Park + Pine Mountain Trail) |
| `enrich_yonder_wave1_images_google.py` | Backfilled images for Wave 1 destinations via Google Places |
| `enrich_yonder_wave2_images_google.py` | Backfilled images for Wave 2 via Google Places |
| `enrich_yonder_wave3_images_google.py` | Backfilled images for Wave 3 support nodes |
| `enrich_yonder_wave3_support_nodes.py` | Enriched Wave 3 support nodes already in venue graph |
| `enrich_yonder_wave4_images_google.py` | Backfilled images for Wave 4 support nodes |
| `enrich_yonder_wave4_support_nodes.py` | Enriched Wave 4 support nodes |
| `enrich_yonder_wave5_images_google.py` | Backfilled images for Wave 5 destinations |
| `enrich_yonder_weekend_booking_support.py` | Added booking-aware planning metadata to Yonder weekend destinations |
| `enrich_yonder_campgrounds_review_wave1_images_google.py` | Backfilled images for review-wave campgrounds |
| `enrich_yonder_federal_backbone_images_google.py` | Backfilled images for federal backbone anchors |
| `enrich_yonder_nps_campground_images_google.py` | Backfilled images for NPS campground rows |
| `enrich_yonder_private_campground_images_google.py` | Backfilled images for private campground rows |
| `enrich_yonder_private_campground_wave2_images_google.py` | Backfilled images for private campground wave 2 |
| `enrich_yonder_private_campground_wave3_images_google.py` | Backfilled images for private campground wave 3 |
| `enrich_yonder_private_campground_wave4_images_google.py` | Backfilled images for private campground wave 4 |
| `enrich_yonder_private_campground_wave5_images_google.py` | Backfilled images for private campground wave 5 |
| `enrich_yonder_private_campground_wave6_images_google.py` | Backfilled images for private campground wave 6 |
| `enrich_yonder_private_campground_wave7_images_google.py` | Backfilled images for private campground wave 7 |
| `enrich_yonder_private_campground_wave8_images_google.py` | Backfilled images for private campground wave 8 |
| `enrich_yonder_public_land_campground_images_google.py` | Backfilled images for public-land campground rows |
| `enrich_yonder_public_land_trail_images_google.py` | Backfilled images for public-land trail rows |
| `enrich_yonder_state_park_hiking_wave1_images_google.py` | Backfilled images for state-park hiking wave 1 |
| `link_yonder_federal_children.py` | Attached campground child rows to Yonder federal parent anchors |
| `qualify_yonder_public_land_camp_queue.py` | Classified remaining public-land campground queue into tiers |
| `qualify_yonder_public_land_trail_queue.py` | Classified remaining public-land trail queue into tiers |

### Other One-Time Operations

| Script | Description |
|--------|-------------|
| `align_profiles_to_integration_method.py` | One-time: corrected profile configs to match their integration_method |
| `backfill_descriptions.py` | Backfilled missing event descriptions (film OMDB, music Wikipedia, OG scrape) — note: crawler should now do this |
| `check_path_programs.py` | One-time Playwright probe of PATH Foundation programs pages |
| `check_path_site.py` | One-time Playwright probe of PATH Foundation site structure |
| `discover_family_venues_from_ap.py` | One-time: mined Atlanta Parent API for family venue leads (not a source) |
| `fix_exhibit_data.py` | Fixed `content_kind` and bad descriptions/images on exhibit events |
| `generate_profile_stubs.py` | Generated profile YAML stubs for sources missing them |
| `harden_profile_targets.py` | Validated profile-backed crawlers and activated non-zero sources |
| `infer_integration_methods_from_code.py` | One-time: inferred `integration_method` from profiles + legacy crawler code |
| `probe_yonder_ga_state_parks.py` | Read-only probe of ReserveAmerica park handles (no DB writes) |
| `probe_yonder_nps_coverage.py` | Read-only probe of NPS API coverage (no DB writes) |
| `probe_yonder_public_land_coverage.py` | Read-only probe of OSM Overpass for public-land trails/camps |
| `probe_yonder_ridb_coverage.py` | Read-only probe of RIDB/Recreation.gov coverage (no DB writes) |
| `scaffold_inactive_crawler_targets.py` | Generated profile stubs from inactive no-module sources |
| `sync_integration_methods.py` | One-time: synced `sources.integration_method` from pipeline profiles |

---

## Category B: Active Enrichment Covering Crawler Gap (→ crawler debt)

These scripts fetch or derive data that crawlers should be capturing on first pass.
Each represents a crawler gap. Per the crawler-first-pass rule, the fix belongs upstream.

| Script | Related Source / Domain | Missing Data | Crawler Fix Needed |
|--------|------------------------|--------------|-------------------|
| `backfill_event_artists.py` | All music/comedy/nightlife sources | `event_artists` rows — lineup parsing not running at crawl time | `extract.py` LLM prompt and post-save step should extract lineup and call `upsert_event_artists()` for every music/comedy event |
| `backfill_event_show_signals.py` | All event sources | Show signals (`headliner`, `support_acts`, `show_type`) not populated during crawl | `extract.py` should derive show signals in the extraction pass; `db.py` `save_event()` should call `derive_show_signals()` |
| `backfill_descriptions.py` | All sources (especially film, music) | Event descriptions missing or too short | Crawlers should fetch description from detail page; film sources should call OMDB; music sources should call Wikipedia/MusicBrainz |
| `enrich_eventbrite_descriptions.py` | `eventbrite` | Eventbrite detail-page FAQ content not fetched | Eventbrite crawler should hit the event detail API endpoint for description |
| `enrich_festival_descriptions.py` | Festival sources | Festival event descriptions thin | Festival crawlers should extract schedule/context on first pass |
| `enrich_non_eventbrite_descriptions.py` | `ticketmaster`, `ticketmaster-nashville`, `gsu-athletics`, `emory-healthcare-community`, `atlanta-recurring-social`, `team-trivia`, `meetup` | Short/missing descriptions | Each named source needs richer description extraction in its crawler |
| `enrich_tentpole_images.py` | Festival/tentpole sources | Tentpole events missing images after crawl | Tentpole events should get image from source page at crawl time; festival crawlers should extract og:image |
| `upgrade_venue_images.py` | Venue layer (all sources) | Venue images broken (logo/SVG) or missing | Venue creation flow in `db.py` should immediately fetch a quality image; `generic_venue_crawler.py` should include image fetch |
| `refresh_destination_signals.py` | `midway-pub`, `the-earl`, others | Venue specials and planning notes not updated after crawler improvements | After fixing a crawler, its venue signals should refresh automatically; specials/planning notes should be first-class output of the crawl |
| `repair_event_images.py` | All sources | Event images broken at time of crawl | Validation in `db.py` `save_event()` should reject invalid image URLs (empty, relative, data URI, protocol-relative) and attempt venue fallback |

**Note on the `backfill_event_artists.py` script:** This script is currently modified (appears in `git status` as `M`). It is still active as enrichment debt while the crawler fix is being implemented. Keep it in place until `extract.py` handles lineup extraction natively.

---

## Category C: Operational Utility (→ keep)

Scripts used for ongoing operations, diagnostics, health checks, and repeatable
maintenance. These run regularly or on-demand as part of platform operations.

### Health Checks and Audits

| Script | Description |
|--------|-------------|
| `audit_atlanta_activity_quality.py` | Audits Atlanta activity overlay layer quality; can write markdown report |
| `audit_closed_venues.py` | Audits venue/source closure health: registry drift, closure candidates |
| `audit_data_quality.py` | Comprehensive events DB quality audit: garbage events, duplicates, anomalies |
| `audit_experience_coverage.py` | Cross-references Atlanta experience venues against editorial lists |
| `audit_inactive_sources.py` | Classifies inactive sources (festival containers vs broken crawlers) |
| `audit_profile_batch.py` | Audits a batch of sources and updates `integration_method` |
| `audit_source_data_goals.py` | Audits active sources against declared data goals |
| `audit_source_entity_capabilities.py` | Audits declared typed-entity lane capabilities across crawlers |
| `audit_yonder_federal_backbone_coverage.py` | Audits federal park backbone coverage for Yonder |
| `audit_yonder_federal_campground_coverage.py` | Audits federal campground coverage via live NPS/RIDB APIs |
| `audit_yonder_inventory_snapshots.py` | Audits persisted Yonder inventory snapshots by provider/freshness |
| `audit_yonder_trail_camp_coverage.py` | Audits current Yonder trail/camping coverage in the venue graph |
| `check_bar_sources.py` | Checks which Atlanta bar/nightlife crawlers exist and their status |
| `check_event_images.py` | Analyzes event image health: coverage, URL patterns, reachability |
| `check_event_images_deep.py` | Deep-dives broken/suspect image patterns (protocol-relative, relative, etc.) |
| `check_festival_dates.py` | Scans festival websites for newly announced dates (runs daily via cron) |
| `check_festival_health.py` | Festival health check with enforced positive-state gates (exit 1 on failure) |
| `check_profile_consistency.py` | Validates profile configs are consistent with their `integration_method` |
| `check_remaining_venues.py` | Reports venues missing neighborhood assignments |
| `check_sources.py` | Checks for crawlers missing from sources table |
| `check_venue_specials.py` | Reports `venue_specials` table data |
| `check_yonder_inventory_freshness.py` | Checks whether Yonder inventory snapshots are fresh enough for runtime |
| `city_readiness_check.py` | Passes/fails minimum viable criteria before a city goes live (exit 0/1) |
| `content_health_audit.py` | Formal content health audit: JSON metrics + markdown report |
| `crawl_frequency_optimizer.py` | Analyzes crawl_logs history and recommends optimal `crawl_frequency` per source |
| `data_quality_dashboard.py` | Weekly visual dashboard for data quality metrics |
| `data_quality_health_check.py` | Comprehensive data quality metrics: completeness, categories, sources |
| `data_quality_report.py` | Post-crawl data quality analysis: enrichment coverage, issues |
| `data_quality_triage.py` | Phase B diagnostic report: actionable data quality issues across crawlers |
| `destination_signal_audit.py` | Audits product-critical venue signals: specials, exhibits, hours, images |
| `export_profile_urls.py` | Exports profile slugs + URLs to CSV for external review |
| `family_civic_health_sweep.py` | Grouped health sweep for Hooky's civic/public family-program sources |
| `festival_extraction_benchmark.py` | Benchmarks festival schedule extraction quality across LLM providers |
| `launch_health_check.py` | Launch health gate wrapper: runs content_health_audit, fails CI if gate not PASS |
| `post_crawl_analysis.py` | Reads SQLite health DB and generates actionable regression/failure report |
| `qa_dry_run.py` | Runs pipeline dry-run across integration methods; saves results to JSON |
| `source_audit.py` | Audits a single source URL and recommends integration method |
| `surface_quality_audit.py` | Audits user-facing surfaces (feed, cards) from the user's perspective |

### Operational / Pipeline Scripts

| Script | Description |
|--------|-------------|
| `activate_dormant_crawlers.py` | Reactivates dormant crawlers + creates new source records (used when deploying new crawlers) |
| `cleanup_stale_crawl_logs.py` | Cancels stale `crawl_logs` rows stuck in "running" status (runs after failures) |
| `post_crawl_maintenance.py` | One-command post-crawl maintenance: closed venues, deactivations, dedupe, health gate |
| `run_atlanta_launch.py` | Full Atlanta launch-quality crawl + maintenance + health gate in one command |
| `run_yonder_inventory_cycle.py` | Full Yonder inventory cycle: sync, freshness check, optional prune |
| `sync_yonder_ga_state_park_inventory.py` | Persists GA State Parks inventory snapshots (runs on crawl cycle) |
| `sync_yonder_inventory.py` | Runs all current Yonder provider inventory sync jobs |
| `sync_yonder_unicoi_inventory.py` | Persists Unicoi Lodge inventory snapshots |
| `sync_yonder_whitewater_express_inventory.py` | Persists Whitewater Express inventory snapshots |
| `prune_yonder_inventory_snapshots.py` | Prunes older Yonder inventory snapshots (retention management) |
| `upgrade_playwright_candidates.py` | Upgrades source profiles to Playwright (used when promoting crawlers) |

---

## Summary

| Category | Count | Location |
|----------|-------|---------|
| A: Already Run Once | 232 | `archive/` |
| B: Active Enrichment / Crawler Debt | 10 | `scripts/` (keep until crawlers fixed) |
| C: Operational Utility | 47 | `scripts/` |
| `__init__.py` | 1 | `scripts/` |
| Pending one-time (not yet run) | 1 | `scripts/migrate_exhibit_events_to_exhibitions.py` |
| **Total** | **291 original + 1 new** | |

---

## Crawler Debt Priority

From Category B, ranked by platform impact:

1. **`backfill_event_artists.py`** — Lineup data is critical for music event quality. Every music show in the Atlanta/FORTH feed should have artist data. Affects hotel guests asking "who's playing tonight."
2. **`repair_event_images.py`** + **`enrich_tentpole_images.py`** — Image quality directly affects FORTH demo and consumer product. Broken images at card-render time are embarrassing.
3. **`backfill_descriptions.py`** + **`enrich_eventbrite_descriptions.py`** + **`enrich_non_eventbrite_descriptions.py`** — Thin descriptions hurt the "live music tonight" search case and AI-query readiness.
4. **`backfill_event_show_signals.py`** — Show signals (`headliner`, `show_type`) power structured display. Needed for Arts portal and FORTH.
5. **`upgrade_venue_images.py`** — Venue image coverage is 13% for HelpATL and thin elsewhere. Venue images are destination-critical.

