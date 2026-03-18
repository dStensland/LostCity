# PRD-034: Lost Track — Adventure Portal

**Status:** Strategy Lock
**Portal Slug:** `adventure` (vertical subdomain: `adventure.lostcity.ai`)
**Brand Name:** Lost Track
**Tagline:** "Wander over yonder"
**Type:** Regional adventure discovery portal (Atlanta → Regional, 4-hour radius across GA, TN, NC, SC, AL, KY)

---

## Mission

Yonder is a motivation engine for outdoor exploration. It answers: **"What's out there this weekend?"**

Not a trail directory. Not an events calendar. A time-aware, weather-aware, social-first platform that gives people reasons to get outside — and tools to do it with their crew.

## What Makes Yonder Different

| Layer | What it does | vs. what exists |
|-------|-------------|----------------|
| Discovery | Trails, parks, water, climbing spots | AllTrails (static, solo) |
| Events | Group hikes, races, trail cleanups | Meetup (ugly, generic) |
| Artifacts | Hidden gems, landmarks, oddities | Geocaching (plastic containers) |
| Quests | Themed missions with progress tracking | Atlas Obscura (no tracking, no local depth) |
| Camp Finder | Aggregated camping from all sources | Fragmented across 5+ platforms |
| Trip Hangs | Crew planning + gear + carpool coordination | Group texts (chaos) |
| Out There Log | Personal adventure history + completions | Strava (fitness only) |
| Conditions | Weather-aware, seasonal intelligence | Nobody does this well |

No one platform does even three of these together.

## Geographic Scope

Yonder operates on a **commitment spectrum**, not a fixed radius:

| Tier | Range | Examples |
|------|-------|---------|
| Walk out your door | 0-15 min | BeltLine, city parks, outdoor fitness |
| Quick drive | 15-60 min | Sweetwater Creek, Arabia Mountain, Kennesaw Mountain, Blankets Creek, Lake Allatoona |
| Day trip | 1-2 hr | Amicalola Falls, Tallulah Gorge, Lake Rabun, Helen tubing, Bull Mountain MTB |
| Full day | 2-3 hr | Ocoee River, Lake Jocassee, Cheaha SP, Caesars Head, Cloudland Canyon, caves |
| Weekend trip | 3-4 hr | Great Smoky Mountains NP, Nantahala River, Blue Ridge Parkway, Pisgah NF, Mammoth Cave |

This is a fundamentally different data model from city-centric portals. Distance/commitment is the primary navigation axis.

## Activity Taxonomy

### Core Activities
- **Hiking & Walking** — Day hikes, backpacking, nature walks, waterfall hikes
- **Water** — Kayaking, paddleboarding, rafting, packrafting, tubing, swimming holes
- **Climbing** — Bouldering (Boat Rock, Rocktown), sport climbing, indoor gyms
- **Cycling** — Mountain biking, gravel, road, BeltLine/PATH
- **Running** — Trail running, group runs, races
- **Camping** — Car camping, backcountry, glamping, cabins

### Extended Activities
- Ropes courses, zip lines, via ferrata
- Fishing, stargazing, birding
- Outdoor fitness (park yoga, boot camps)
- Stewardship (trail maintenance, river cleanups)

## Feature Specifications

### F1: Commitment Filter (Primary Nav)

The primary UX control. Filters everything on the portal by time commitment:
- **AN HOUR** — Urban parks, quick trails, outdoor fitness nearby
- **HALF DAY** — Metro nature, day hikes, lake paddle
- **FULL DAY** — Mountain day trips, waterfalls, ropes courses
- **WEEKEND** — Camping, backpacking, whitewater, climbing trips

Implementation: Query parameter `commitment=hour|halfday|fullday|weekend` applied to all feed/search queries. Maps to drive-time ranges stored on venues/events.

### F2: Conditions Intelligence

Weather-aware banner on feed. Contextual, not just a forecast:
- "Great waterfall weekend — 2" rain this week, flows are up"
- "Too hot to hike — here are water activities instead"
- "Peak foliage this weekend in North GA"
- "First freeze tonight — last chance before winter"

Implementation: Weather API integration (OpenWeather or similar). Rules engine that maps conditions → editorial copy + activity recommendations. Stored as portal-level content that refreshes daily.

### F3: Artifacts

Discoverable things with a story. The atomic unit of exploration content.

**Data Model:**
```
artifacts
  id UUID PK
  portal_id UUID FK portals
  name TEXT NOT NULL
  slug TEXT UNIQUE
  description TEXT
  story TEXT (longer editorial content)
  artifact_type TEXT (waterfall, viewpoint, swimming_hole, historic_site, rock_formation, hidden_trail, fire_tower, art_installation)
  location GEOGRAPHY(POINT, 4326)
  address TEXT
  region TEXT (urban, metro, mountains, river_corridor)
  difficulty TEXT (easy, moderate, hard, expert)
  drive_time_minutes INT (from Atlanta)
  best_season TEXT[] (spring, summer, fall, winter)
  features JSONB (height_ft, trail_distance_mi, permit_required, etc.)
  hero_image_url TEXT
  created_by UUID FK profiles (editorial at launch)
  status TEXT (active, draft, archived)
```

**Launch target:** 50-100 artifacts seeded editorially. Focus on waterfalls, viewpoints, swimming holes, and hidden trails within 2 hours of Atlanta.

### F4: Quests

Themed collections of artifacts with progress tracking.

**Data Model:**
```
quests
  id UUID PK
  portal_id UUID FK portals
  name TEXT NOT NULL
  slug TEXT UNIQUE
  description TEXT
  quest_type TEXT (collection, circuit, seasonal, challenge)
  difficulty TEXT (beginner, intermediate, advanced)
  artifact_count INT (denormalized)
  hero_image_url TEXT
  seasonal_window JSONB (optional: {start_month, end_month})
  badge_name TEXT (e.g., "Waterfall Hunter")
  badge_icon TEXT
  status TEXT (active, draft, archived)

quest_artifacts
  quest_id UUID FK quests
  artifact_id UUID FK artifacts
  position INT (display order)
  hint TEXT (optional clue)
```

**Out There Log (Discovery Tracking):**
```
artifact_discoveries
  id UUID PK
  user_id UUID FK profiles
  artifact_id UUID FK artifacts
  quest_id UUID FK quests (optional — which quest context)
  discovered_at TIMESTAMPTZ
  photo_url TEXT (self-reported photo)
  notes TEXT
  UNIQUE(user_id, artifact_id)
```

Quest progress is derived: `COUNT(artifact_discoveries) WHERE quest_id = X / quest.artifact_count`.

**Launch quests (editorial):**
1. "Hidden Waterfalls of North Georgia" — 10 waterfalls
2. "Atlanta's Secret Green Spaces" — 8 parks most people don't know
3. "BeltLine Complete" — Walk every segment
4. "Chattahoochee River Crossings" — Every access point
5. "Fire Tower Circuit" — Historic lookout towers

### F5: Camp Finder

Aggregated camping from all sources in one search surface.

**Source Types:**
| Source | Data Method | Examples |
|--------|-----------|---------|
| GA State Parks | Scrape/API | Sweetwater Creek, Vogel, Cloudland Canyon |
| USFS / National Forest | recreation.gov data | Cohutta, Chattahoochee NF dispersed sites |
| Hipcamp | Link-out + metadata | Private land glamping/tent sites |
| Private campgrounds | Manual seed + enrich | KOA, independent campgrounds |
| Glamping | Manual seed | Collective Retreats, AutoCamp, local glamping |
| Cabins | Manual seed | State park cabins, mountain rentals |

**Venue Metadata Extension (for camping):**
```
-- Add to venues or create camping_sites table
camp_type TEXT (tent, rv, backcountry, glamping, cabin)
camp_source TEXT (ga_state_parks, usfs, hipcamp, private)
price_per_night NUMERIC
reservation_required BOOLEAN
reservation_url TEXT
amenities TEXT[] (showers, flush_toilets, fire_pit, water, electric)
max_occupancy INT
dog_friendly BOOLEAN  -- feeds into Pack ATL
```

**Filters:** Type (tent/backcountry/glamping/cabin/rv), distance, price range, amenities, dog-friendly.

### F6: Trip Hangs (Crew Planning)

Extends the existing hangs system for multi-day trip coordination.

**Data Model:**
```
trip_hangs
  id UUID PK
  creator_id UUID FK profiles
  portal_id UUID FK portals
  title TEXT NOT NULL
  destination_venue_id INT FK venues (optional)
  destination_name TEXT (fallback if no venue)
  status TEXT (planning, confirmed, active, completed, cancelled)
  start_date DATE
  end_date DATE
  notes TEXT
  visibility TEXT (private, friends, public)

trip_hang_members
  trip_hang_id UUID FK trip_hangs
  user_id UUID FK profiles
  role TEXT (organizer, member)
  rsvp TEXT (going, maybe, declined)
  joined_at TIMESTAMPTZ

trip_hang_gear
  id UUID PK
  trip_hang_id UUID FK trip_hangs
  item_name TEXT NOT NULL
  claimed_by UUID FK profiles (nullable = unclaimed)
  is_packed BOOLEAN DEFAULT false
  position INT

trip_hang_carpools
  id UUID PK
  trip_hang_id UUID FK trip_hangs
  driver_id UUID FK profiles
  departure_location TEXT
  departure_time TIMESTAMPTZ
  total_seats INT
  notes TEXT

trip_hang_carpool_riders
  carpool_id UUID FK trip_hang_carpools
  rider_id UUID FK profiles
```

### F7: Cross-Portal Federation

**Pack ATL Integration:**
- Trail/park data shared via source federation
- Dog-specific metadata (leash_policy, water_bowls, dog_friendly) on venues
- "Certified Pup Explorer" badge earned by completing dog-friendly trail quests on Yonder
- Pack ATL surfaces Yonder trail data filtered by `dog_friendly = true`

**Badge System (Platform-Wide):**
```
user_badges
  id UUID PK
  user_id UUID FK profiles
  portal_id UUID FK portals (which portal granted it)
  badge_slug TEXT (e.g., "waterfall-hunter", "certified-pup-explorer")
  badge_name TEXT
  badge_icon TEXT
  earned_at TIMESTAMPTZ
  context JSONB (e.g., {quest_id: "...", artifacts_found: 10})
  UNIQUE(user_id, badge_slug)
```

---

## Visual Identity

**Preset:** Custom (Nordic Brutalist adaptation)
**Theme mode:** Light
**Fonts:** Space Grotesk (headlines), Inter (body)

| Token | Value | Usage |
|-------|-------|-------|
| background | #F5F2ED | Page canvas (warm cream) |
| card_color | #FFFFFF | Cards (when needed) |
| primary_color | #C45A3B | Terracotta — CTAs, active states |
| secondary_color | #6B8E5E | Olive green — nature, success, positive |
| text_color | #1A1A1A | Primary text, borders, dark inversions |
| muted_color | #888888 | Secondary text, inactive states |
| border_color | #1A1A1A | Heavy borders (1.5-2px) |

**Design Language:**
- Sharp corners (0px radius default) — brutalist, bold
- Heavy borders (1.5-2px) for structure, not shadows
- Dark inversions (#1A1A1A) for emphasis: header, featured cards, tab bar
- Uppercase tracked labels (Space Grotesk, +1px letter-spacing)
- No glass, no glow, no blur — architectural precision
- Earth tone gradients for image placeholders

**Ambient Effect:** None or `noise_texture` at very low intensity. Yonder is functional, not decorative.

---

## Data Seeding Plan

### Trails & Parks (Phase 1 — 30+ venues)
Already seeded in migration 274:
- Atlanta BeltLine (Eastside, Westside, Southside segments)
- Sweetwater Creek State Park
- East Palisades Trail
- Cascade Springs Nature Preserve
- Arabia Mountain PATH
- Cochran Shoals Trail
- Stone Mountain Walk-Up Trail
- Kennesaw Mountain Trail
- Morningside Nature Preserve

**Need to add (Waves 6-10):**
- Wave 6 — Ring 1 gap-fill (10 destinations): Panola Mountain, Boat Rock (bouldering), Chattahoochee River access points (6+), additional metro green spaces
- Wave 7 — Ring 2 gap-fill (15 destinations): Amicalola Falls, Tallulah Gorge, Raven Cliff Falls, DeSoto Falls, Helton Creek Falls, Blood Mountain / AT approach, Springer Mountain (AT southern terminus), Lake Rabun, Helen tubing corridor, Bull Mountain MTB, additional North GA destinations
- Wave 8 — Ring 3 multi-state expansion (20 destinations): Cloudland Canyon, Ocoee River (TN), Lake Jocassee (SC), Cheaha State Park (AL), Caesars Head (SC), Table Rock (SC), Desoto Falls (AL), caves (Manitou Cave AL, Raccoon Mountain TN), additional TN/NC/SC/AL destinations
- Wave 9 — Ring 4 Smokies / Pisgah / national parks (15 destinations): Great Smoky Mountains NP, Nantahala River (NC), Blue Ridge Parkway overlooks, Pisgah National Forest, Linville Gorge, Waterrock Knob, Mammoth Cave (KY), additional national forest destinations
- Wave 10 — Hidden gems and specialty (10 destinations): lesser-known waterfalls, fire towers, swimming holes, and climbing areas across the 6-state radius

### Camping Sites (Phase 2 — 20+ sites)
- GA State Parks with camping (Sweetwater Creek, Vogel, Cloudland Canyon, Amicalola, Black Rock Mountain, Fort Mountain)
- USFS dispersed sites (Cohutta Wilderness, Chattahoochee NF)
- Hipcamp links for North GA private land
- Glamping options near Dahlonega, Helen, Blue Ridge

### Artifacts (Phase 2 — 50+)
- 10 waterfalls (Amicalola, Raven Cliff, Tallulah, DeSoto, Helton Creek, Toccoa, Minnehaha, Anna Ruby, Dukes Creek, Long Creek)
- 8 viewpoints / fire towers (Brasstown Bald, Blood Mountain, Springer, Rabun Bald, Black Rock Mountain, Cohutta Overlook)
- 8 swimming holes / river spots
- 8 hidden trails / secret green spaces
- 8 historic/geological oddities
- 8+ urban artifacts (BeltLine art, hidden parks, overlooks)

### Outdoor Events (Existing Crawlers)
- Atlanta Outdoor Club — group hikes, paddles
- BLK Hiking Club — group hikes
- Piedmont Park — outdoor events
- Park Pride — stewardship events
- Trees Atlanta — volunteer trail work

---

## Build Phases

### Phase 1: Foundation (Portal + Core Data)
- [ ] Create portal record (slug: `yonder`, status: `draft`)
- [ ] Create visual preset / branding configuration
- [ ] Subscribe to existing outdoor sources via federation
- [ ] Create interest channels (trails, parks, camping, climbing, water, running)
- [ ] Seed additional trail/park venues with outdoor metadata
- [ ] Extend venue metadata for outdoor attributes (difficulty, distance, elevation, drive_time)
- [ ] Basic feed template using existing portal infrastructure

### Phase 2: Artifacts + Quests
- [ ] Create `artifacts` table + migration
- [ ] Create `quests`, `quest_artifacts` tables + migration
- [ ] Create `artifact_discoveries` table + migration
- [ ] Seed 50+ artifacts (editorial)
- [ ] Seed 5 launch quests
- [ ] API routes: GET/POST artifacts, quests, discoveries
- [ ] Quest detail view (progress bar, artifact checklist, next suggested)
- [ ] Out There Log view (personal discovery history)

### Phase 3: Camp Finder
- [ ] Extend venues or create `camping_sites` table with camping metadata
- [ ] Seed 20+ camping sites across all source types
- [ ] Camp finder search/filter API
- [ ] Camp finder view (type filters, source badges, aggregated results)
- [ ] Link-out to booking sources (GA State Parks, recreation.gov, Hipcamp)

### Phase 4: Trip Hangs
- [ ] Create `trip_hangs`, `trip_hang_members`, `trip_hang_gear`, `trip_hang_carpools` tables
- [ ] Trip creation + invitation flow
- [ ] Gear checklist (claim/unclaim items)
- [ ] Carpool coordination (driver/rider, seats, departure)
- [ ] Conditions widget (weather API integration)
- [ ] Trip hang detail view

### Phase 5: Conditions + Seasonal Intelligence
- [ ] Weather API integration (OpenWeather or similar)
- [ ] Conditions rules engine (weather → editorial copy + recommendations)
- [ ] Seasonal content calendar (spring waterfalls, fall foliage, etc.)
- [ ] Commitment filter implementation (drive-time ranges on all venues)

### Phase 6: Cross-Portal + Badges
- [ ] `user_badges` table + migration
- [ ] Badge earning logic (quest completion → badge)
- [ ] Pack ATL federation setup (dog-friendly trail data)
- [ ] Badge display on user profile
- [ ] "Certified Pup Explorer" quest on Yonder (dog-friendly trails)

---

## Monetization Path

**Primary: Outfitter & Guide Partnerships**
- Rafting companies (NOC, Wildwater, Rolling Thunder) — trip listings + booking links
- Ropes courses (Historic Banning Mills, Treetop Quest) — event listings
- Outdoor gear rental (REI rentals, local outfitters) — directory listings
- Guided tours (fishing guides, climbing guides) — event/service listings

These are natural partners: they have schedules, pricing, and would pay for qualified leads. Cleaner monetization than sponsorship because the listings ARE the content.

**Secondary: Camping Referrals**
- Hipcamp affiliate/referral for private land bookings
- State park reservation link-outs (potential partnership)

## Success Metrics

### Launch (Month 0)
- 30+ trail/park venues with outdoor metadata
- 50+ artifacts seeded
- 5 quests active
- 20+ camping sites
- 3+ outdoor event sources active
- Feed loads with real, relevant content

### Month 1
- 500+ unique visitors
- 20%+ return rate (quests drive this)
- 5+ quest completions
- 1+ trip hang created by real users

### Month 3
- 2,000+ monthly uniques
- 50+ quest completions
- 10+ trip hangs
- 1+ outfitter partnership inquiry
- Conditions intelligence live and accurate

## Non-Goals
- E-commerce / gear sales
- Medical/safety advice (liability)
- Trail rating/review system (AllTrails does this fine)
- Permit booking engine (link out to recreation.gov)
- Social media features (no posting, no feed of user content)
- Competitive leaderboards (satisfaction > competition)

## Expansion Play

If Yonder works in Atlanta, the model ports to every city near nature: Denver, Portland, Austin, Asheville, Chattanooga, Nashville, Boise, Salt Lake City. The data model (trails + events + artifacts + quests + camping + conditions) is location-agnostic. This could be the first portal vertical that scales nationally because outdoor adventure isn't hyper-local the way nightlife or civic engagement is.

---

## Design Reference

Pencil screens designed in active `.pen` file:
- **Yonder — Feed**: Conditions banner, commitment filter, quest progress, weekend events
- **Yonder — Quest Detail**: Artifact checklist with found/unfound states, progress bar, "Next Up" CTA
- **Yonder — Camp Finder**: Aggregated search with source badges (GA State Parks, USFS, Hipcamp)
- **Yonder — Trip Hang**: Crew list, gear checklist, carpool coordination, conditions forecast
