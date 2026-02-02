# Nashville Metro Swarm Playbook (AI-First)

**Target:** Launch Nashville Metro portal in **4-6 hours** (half day)
**Methodology:** Curators-First + Massive Parallel Swarms
**Based on:** Geographic Expansion Playbook v3.0 (validated 30-50 min suburb launches)

---

## Critical Learning: It's Nashville METRO, Not Just Nashville

### The Atlanta Lesson
We initially launched Atlanta focusing on the city proper and missed:
- Marietta (59K people, distinct identity)
- Decatur (walkable arts scene)
- Alpharetta (families, corporate)

**67% of Nashville metro population lives OUTSIDE the city proper.**

### Nashville Metro Structure

| Geography | Population | % of Metro |
|-----------|------------|------------|
| Nashville proper (consolidated) | 705K | 33% |
| Suburban cities (Tier 1-2) | ~500K | 23% |
| Extended metro | ~950K | 44% |
| **Total MSA (14 counties)** | **2.15M** | 100% |

### Tier 1 Cities (MUST COVER)

| City | Pop | Distance | Character |
|------|-----|----------|-----------|
| **Nashville** | 705K | Core | Downtown, neighborhoods, culture |
| **Murfreesboro** | 157K | 34mi SE | College town (MTSU), 2nd largest |
| **Franklin** | 86K | 22mi S | Historic charm, wealthy families |
| **Hendersonville** | 64K | 20mi N | Family suburb, riverfront |
| **Spring Hill** | 59K | 30mi S | Fastest growing, GM plant |
| **Smyrna** | 55K | 25mi SE | Nissan plant, working families |
| **Gallatin** | 52K | 30mi NE | #31 fastest growing US suburb |
| **Lebanon** | 51K | 30mi E | Wilson County seat, 23.7% growth |

### Nashville Neighborhoods (Within City Proper)

| Neighborhood | Character | Event Density |
|--------------|-----------|---------------|
| Downtown/Broadway | Tourist honky-tonks, major venues | Very High |
| East Nashville | Creative, restaurants, artists | High |
| The Gulch | Urban trendy, listening rooms | High |
| 12South/Belmont | Walkable, hip, young pros | Medium |
| Germantown | Historic, breweries | Medium |
| Green Hills | Upscale shopping/dining | Medium |
| Belle Meade | Wealthy enclave | Low |
| Antioch | Diverse, affordable | Medium |
| Music Row | Industry/studios | Low |
| Midtown | Vanderbilt area | Medium |
| Sylvan Park | Neighborhood feel | Low |

### Key Corridors

```
I-65 SOUTH (Wealthy Corridor)     I-24 SOUTHEAST (Growth Engine)
Nashville                          Nashville
  ↓ 15 min                           ↓ 12 mi
Brentwood ($$$, families)          Antioch (diverse neighborhood)
  ↓ 25 min                           ↓ 25 mi
Franklin (historic, must-have)     La Vergne → Smyrna (Nissan)
  ↓ 30 mi                            ↓ 34 mi
Spring Hill (explosive growth)     Murfreesboro (MTSU, 2nd largest)

I-65 NORTH (Family Corridor)      I-40 EAST (Wilson County)
Nashville                          Nashville
  ↓ 15 mi                            ↓ 25 mi
Goodlettsville                     Mount Juliet (fast growth)
  ↓ 20 mi                            ↓ 30 mi
Hendersonville (riverfront)        Lebanon (county seat)
  ↓ 30 mi
Gallatin (fastest growing)
```

---

## Why Nashville Metro is Different (But Doable)

| Factor | Atlanta Suburb | Nashville Metro | Scaling Strategy |
|--------|----------------|-----------------|------------------|
| Market size | ~100K | 2.15M (14 counties) | Parallel city swarms |
| Event sources | 5-10 | 100-150 | Batched crawler creation |
| Destinations | 14-71 | 300-400 | Bulk import from curators |
| Organizations | 10-20 | 75-100 | Same pattern, larger list |
| Geographic areas | 1 city | 8 cities + 11 neighborhoods | Parallel discovery |
| Cultural identity | Single theme | Multi-faceted by area | Curators reveal each |
| **Proven time** | 30-50 min | **4-6 hours** | Parallel everything |

---

## Pre-Flight (Before Swarm) - 15 min

### Critical: Fix Security Vulnerability

```
BEFORE ANY NASHVILLE WORK:

Fix /web/app/api/admin/portals/[id]/sections/route.ts
- Replace isAdmin() always-true with canManagePortal(portalId)
- This is blocking for any new portal launch
```

### Verify Swarm Infrastructure

- [ ] Claude Code agents available
- [ ] Database connection working
- [ ] Crawler environment ready (`cd crawlers && python -c "import db"`)
- [ ] Web dev server can start

---

## Phase 0: Curators Discovery (10 min)

### Launch: Master Curators Agent

**This informs EVERYTHING else. Run first, review before proceeding.**

```
PROMPT:

Research Nashville, Tennessee to build a comprehensive curator map.

FIND ALL OF THESE:

1. FOOD & DRINK CURATORS
   - Eater Nashville
   - The Infatuation Nashville
   - Nashville Scene food coverage
   - Nashville Lifestyles dining
   - Edible Nashville
   - Local food bloggers/Instagram
   - James Beard nominees/winners in Nashville
   - Nashville Guru restaurant guides

2. MUSIC & ENTERTAINMENT CURATORS
   - Nashville Scene music coverage
   - No Depression (Americana music)
   - CMT/Country Music coverage
   - Nashville Music Guide
   - Live music venue aggregators
   - Songwriter round schedules

3. TOURISM & LIFESTYLE
   - Visit Music City (official tourism)
   - Nashville Convention & Visitors Corp
   - TripAdvisor Nashville guides
   - Southern Living Nashville features
   - Garden & Gun Nashville coverage

4. LOCAL MEDIA
   - Nashville Scene (alt-weekly)
   - The Tennessean (daily paper)
   - Nashville Post (business)
   - Nashville Parent (family events)

5. NICHE CURATORS
   - Nashville Brew (craft beer)
   - Nashville Coffee Culture
   - Nashville LGBTQ+ guides
   - Nashville outdoor/adventure

FOR EACH CURATOR SOURCE:
- Name and URL
- What they curate (food, music, events, etc.)
- Recent "best of" lists (extract venue names!)
- Last updated date
- Quality signal (James Beard, local favorite, etc.)

EXTRACT THE CULTURAL IDENTITY:
- What is Nashville KNOWN for? (Music City, honky-tonks, etc.)
- What makes it DIFFERENT from Atlanta?
- What's the VISUAL VIBE? (neon signs, country aesthetic, etc.)
- What NEIGHBORHOODS matter? (Downtown, East Nashville, The Gulch, etc.)
- What UNIQUE EVENT TYPES exist? (songwriter rounds, honky-tonk music, etc.)

OUTPUT FORMAT:
1. Cultural Identity Summary (use for portal branding)
2. Anchor Venues (the MUST-HAVES - Ryman, Bluebird, etc.)
3. Key Organizations (CMA, Nashville Scene, etc.)
4. Curator Sources with extracted venue lists
5. Neighborhood Map with character descriptions
```

### Human Checkpoint #1 (5 min)

Review curator output:
- [ ] Cultural identity clear? ("Music City" + food renaissance + etc.)
- [ ] Anchor venues identified? (Ryman, Grand Ole Opry, Bluebird Cafe, etc.)
- [ ] Neighborhood list complete? (Downtown, East Nashville, Gulch, 12 South, etc.)
- [ ] Approve moving to parallel discovery

---

## Phase 1: Parallel Discovery Swarm (15 min)

**Launch 8 agents simultaneously:**

### Agent 1: Aggregator Sources
```
Find Nashville event AGGREGATORS - sites that list many events:
1. Nashville Scene events calendar
2. Do615 (if exists)
3. Visit Music City events
4. Nashville.com events
5. Eventbrite Nashville
6. Meetup Nashville
7. Facebook Events Nashville (note: not crawlable)

For each: URL, events page, volume estimate, scrapability
```

### Agent 2: Major Venue Sources
```
CONTEXT FROM CURATORS: [paste anchor venues]

Find EVENT PAGES for Nashville's top 30 venues:

MUSIC VENUES (Priority 1):
- Ryman Auditorium
- Grand Ole Opry
- Bridgestone Arena
- Bluebird Cafe
- Station Inn
- Exit/In
- The Basement East
- Marathon Music Works
- Ascend Amphitheater
- Brooklyn Bowl Nashville

THEATERS:
- TPAC (Tennessee Performing Arts Center)
- Belcourt Theatre
- Nashville Repertory Theatre

HONKY-TONKS (Broadway):
- Tootsie's Orchid Lounge
- Robert's Western World
- Layla's
- The Stage
- Nudie's Honky Tonk

For each: venue name, events page URL, event types, calendar format
```

### Agent 3: Category Gap Sources
```
Find Nashville sources for UNDERSERVED categories:

FAMILY/KIDS:
- Nashville Zoo
- Adventure Science Center
- Nashville Children's Theatre
- Nashville Parent calendar

ARTS/CULTURE:
- Frist Art Museum
- Country Music Hall of Fame
- National Museum of African American Music
- Cheekwood Estate & Gardens

FOOD/DRINK:
- Nashville Food & Wine Festival
- Music City Food Tours events
- Craft beer festivals

SPORTS:
- Nashville Predators
- Tennessee Titans
- Nashville SC
- Nashville Sounds (baseball)

OUTDOOR:
- Nashville parks events
- Radnor Lake programs
- Percy Warner Park

For each: source name, URL, event types, calendar availability
```

### Agent 4: Neighborhoods Mapping
```
Map ALL Nashville neighborhoods with boundaries:

CORE DOWNTOWN:
- Downtown/Broadway (tourist district)
- SoBro (South of Broadway)
- The Gulch
- Germantown

EAST SIDE:
- East Nashville
- Five Points
- Inglewood
- Madison

WEST/SOUTH:
- 12 South
- Hillsboro Village
- Belmont/Lipscomb
- Berry Hill
- Sylvan Park
- The Nations

SUBURBS TO INCLUDE:
- Franklin
- Brentwood
- Belle Meade
- Green Hills

For each: name, approximate bounding box, character, key venues

Generate Python code for fix_neighborhoods.py
```

### Agent 5: Destinations Research
```
PRIORITIZE curator-vetted venues, then expand.

RESTAURANTS (50+):
- James Beard nominees
- Eater Nashville essentials
- Nashville Scene best-of winners
- Hot chicken spots (Prince's, Hattie B's, etc.)
- Meat & Three classics

BARS & NIGHTLIFE (30+):
- Craft cocktail bars
- Dive bars
- Rooftop bars
- Live music bars (non-Broadway)

COFFEE (15+):
- Barista Parlor locations
- Frothy Monkey
- Eighth & Roast
- Local favorites

BREWERIES (15+):
- Yazoo, Jackalope, etc.

For each: name, address, neighborhood, category, what makes it notable
Target: 150+ destinations
```

### Agent 6: Organizations Research
```
Find Nashville community ORGANIZATIONS:

MUSIC INDUSTRY:
- CMA (Country Music Association)
- Americana Music Association
- Nashville Songwriters Association
- Leadership Music

ARTS & CULTURE:
- Metro Arts
- Nashville Arts Coalition
- OZ Arts Nashville

COMMUNITY:
- Nashville Public Library (events)
- YMCA of Middle Tennessee
- Nashville Rescue Mission

BUSINESS:
- Nashville Area Chamber of Commerce
- Nashville Technology Council

LGBTQ+:
- Nashville Pride
- OUT Central

For each: name, URL, event types, calendar availability
Target: 50+ organizations
```

### Agent 7: Existing Coverage Check
```
Query our database for Nashville:
1. How many venues already have city='Nashville'?
2. Any existing crawlers covering Nashville area?
3. What Ticketmaster/Eventbrite coverage do we have?
4. Gap: curator anchor venues we're missing

SQL queries:
- SELECT COUNT(*) FROM venues WHERE city ILIKE '%nashville%';
- SELECT * FROM sources WHERE slug ILIKE '%nashville%';
- Check Ticketmaster Nashville venue IDs

Report: what we have vs what we need
```

### Agent 8: Honky-Tonk Special Research
```
NASHVILLE-SPECIFIC: The Honky-Tonk Problem

Most Broadway honky-tonks don't post "events" - they have CONTINUOUS live music.

Research:
1. Which honky-tonks have schedules vs continuous music?
2. How do other sites handle this? (Visit Music City, etc.)
3. What's the standard format? (Live music 11am-2am daily)

SOLUTION DESIGN:
- Should we create recurring daily "Live Music" events?
- Or just list as destinations with hours?
- How to handle "no cover" vs ticketed shows?

Recommend approach for honky-tonk coverage.
```

### Human Checkpoint #2 (10 min)

Review all discovery outputs:
- [ ] Aggregators identified (Nashville Scene, Do615, etc.)
- [ ] Top 30 venues have event pages found
- [ ] Category gaps covered (family, arts, sports, outdoor)
- [ ] 15+ neighborhoods mapped
- [ ] 150+ destinations researched
- [ ] 50+ organizations found
- [ ] Existing coverage understood
- [ ] Honky-tonk strategy decided

**PRIORITIZE:** Pick top 20 crawler sources for Phase 2

---

## Phase 2: Build Swarm (2-3 hours)

### Crawler Swarm (Parallel Batches of 5)

**Batch 1: Aggregators (5 agents, 15 min)**
```
Create crawlers for:
1. Nashville Scene Events
2. Visit Music City Events
3. Do615 (if viable)
4. Ticketmaster Nashville config
5. Eventbrite Nashville config
```

**Batch 2: Major Music Venues (5 agents, 15 min)**
```
Create crawlers for:
1. Ryman Auditorium
2. Grand Ole Opry
3. Bridgestone Arena
4. Bluebird Cafe
5. Station Inn
```

**Batch 3: More Music Venues (5 agents, 15 min)**
```
Create crawlers for:
1. Exit/In
2. The Basement East
3. Marathon Music Works
4. Ascend Amphitheater
5. Brooklyn Bowl Nashville
```

**Batch 4: Arts & Culture (5 agents, 15 min)**
```
Create crawlers for:
1. TPAC
2. Belcourt Theatre
3. Frist Art Museum
4. Country Music Hall of Fame
5. Cheekwood
```

**Batch 5: Family & Sports (5 agents, 15 min)**
```
Create crawlers for:
1. Nashville Zoo
2. Adventure Science Center
3. Nashville Predators
4. Tennessee Titans
5. Nashville SC
```

**Batch 6-8: Category Fill (15 agents, 30 min)**
```
Remaining prioritized sources from discovery...
```

### Parallel Support Agents

**Portal Configuration Agent**
```
Create Nashville portal based on cultural identity:

IDENTITY FROM CURATORS:
- "Music City" - live music capital
- Honky-tonk heritage meets modern urban
- Hot chicken and Southern food
- Emerging craft/artisan scene

CREATE:
1. database/migrations/105_nashville_portal.sql
2. Visual preset: nashville_music (gold/turquoise palette)
3. Neighborhoods in filters
4. Sections: Live Tonight, Broadway Guide, This Weekend, etc.

Tagline: "Live music, hot chicken & culture in Music City"
```

**Destinations Import Agent**
```
Create import_nashville_destinations.py with ALL curator-vetted venues.

STRUCTURE:
- Prioritize James Beard / Eater / Infatuation venues first
- Include all anchor venues from curators
- Add discovered restaurants, bars, coffee, breweries
- Target: 150+ destinations

Use pattern from import_decatur_destinations.py
```

**Organizations Import Agent**
```
Create import_nashville_orgs.py with ALL discovered orgs.

Include:
- Music industry orgs (CMA, etc.)
- Arts & culture orgs
- Community organizations
- Target: 50+ organizations

Use pattern from import_college_park_orgs.py
```

**Neighborhood Mapping Agent**
```
Add Nashville to fix_neighborhoods.py:
- All 15+ discovered neighborhoods
- Proper bounding boxes
- ZIP code mappings

Run with --dry-run first
```

### Human Checkpoint #3 (15 min)

- [ ] Review crawler batch outputs
- [ ] Fix any import errors
- [ ] Verify portal migration looks correct
- [ ] Spot-check destinations list
- [ ] Approve moving to QA

---

## Phase 3: QA & Activation (1 hour)

### Crawler Verification Swarm (30 min)

**Launch verification agent for each crawler batch:**

```
For each crawler in batch:
1. python -c "import sources.[crawler]" (syntax check)
2. python main.py --source [slug] --dry-run (execution check)
3. Report: pass/fail, events found, any errors

Fix any failures immediately.
```

### Data Import Execution

```bash
# 1. Apply portal migration
psql $DATABASE_URL -f database/migrations/105_nashville_portal.sql

# 2. Run destination import
cd crawlers
python import_nashville_destinations.py

# 3. Run organization import
python import_nashville_orgs.py

# 4. Run neighborhood mapping
python fix_neighborhoods.py --city Nashville

# 5. Run geocoding fixes
python fix_geocoding.py --city Nashville
```

### Crawler Activation

```bash
# Run all Nashville crawlers
python main.py --tag nashville

# Or run individually for monitoring
python main.py --source nashville_scene_events
python main.py --source ryman_auditorium
# ... etc
```

### Verification Queries

```sql
-- Events created
SELECT COUNT(*) FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city = 'Nashville';

-- By category
SELECT e.category, COUNT(*) FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city = 'Nashville'
GROUP BY e.category;

-- Venues with events
SELECT v.name, COUNT(e.id) as event_count
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id
WHERE v.city = 'Nashville'
GROUP BY v.id
ORDER BY event_count DESC
LIMIT 20;
```

### Portal Verification

```bash
# Start dev server
cd web && npm run dev

# Test portal
open http://localhost:3000/nashville
```

- [ ] Portal loads without errors
- [ ] Events appear in feed
- [ ] Neighborhoods filter works
- [ ] Categories filter works
- [ ] Map shows Nashville area
- [ ] Search returns Nashville events

---

## Phase 4: Launch (30 min)

### Production Deployment

```bash
# 1. Push migration to production
# 2. Deploy web changes
# 3. Run production crawlers
# 4. Verify at nashville.lostcity.ai
```

### Monitoring Setup

- [ ] Add Nashville to Sentry project tags
- [ ] Create Nashville crawler alert group
- [ ] Set up daily coverage check

### Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Total crawlers | 40+ | |
| Events (next 30 days) | 500+ | |
| Destinations | 150+ | |
| Organizations | 50+ | |
| Neighborhoods | 15+ | |
| Geocoding % | 95%+ | |

---

## Swarm Execution Summary

| Phase | Time | Agents | Human Time |
|-------|------|--------|------------|
| Pre-flight | 15 min | 1 | 15 min (security fix) |
| Curators | 10 min | 1 | 5 min review |
| Discovery | 15 min | 8 parallel | 10 min review |
| Build | 2-3 hr | 30+ (batched) | 15 min checkpoints |
| QA | 1 hr | 5-10 parallel | 30 min execution |
| Launch | 30 min | 1 | 30 min |
| **TOTAL** | **4-6 hours** | **50+ agents** | **~2 hours active** |

---

## Quick Start Command

```
"Launch Nashville portal using the swarm playbook:

1. FIRST: Fix the security vulnerability in portal admin API
2. Run curators agent to discover Nashville's cultural identity
3. Run 8-agent discovery swarm in parallel
4. Run 30+ crawler agents in batches of 5
5. Run support agents (portal, destinations, orgs, neighborhoods)
6. QA all crawlers and data
7. Activate and verify

Target: Nashville live in 4-6 hours with 500+ events"
```

---

## Appendix: Agent Prompt Templates

### Crawler Creation Template

```
Create a crawler for [VENUE_NAME] in Nashville.

SOURCE INFO:
- URL: [URL]
- Events page: [EVENTS_URL]
- Event types: [TYPES]

VENUE DATA:
- Name: [VENUE_NAME]
- Address: [ADDRESS]
- City: Nashville
- State: TN
- Neighborhood: [NEIGHBORHOOD]
- Venue type: [TYPE]

EXISTING PATTERN TO FOLLOW:
Look at crawlers/sources/[similar_crawler].py

CREATE:
1. crawlers/sources/[slug].py with crawl() function
2. Register in main.py SOURCE_MODULES
3. Test with: python -c "import sources.[slug]"

Return the complete crawler code.
```

### Portal Creation Template

```
Create Nashville portal with this identity:

CULTURAL IDENTITY:
[paste from curators]

VISUAL PRESET: nashville_music
- Primary: #D4A574 (gold)
- Accent: #4ECDC4 (turquoise)
- Background: #1A1F3A (midnight)
- Font: Bebas Neue for display

NEIGHBORHOODS:
[list all discovered neighborhoods]

SECTIONS:
1. Live Tonight (real-time music)
2. Broadway & Honky-Tonks
3. This Weekend
4. East Nashville Picks
5. Food & Drink Events

Create: database/migrations/105_nashville_portal.sql
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Crawler failures | Batch testing, circuit breaker pattern |
| Missing venues | Curator-first ensures anchors covered |
| Geo errors | Bulk geocoding pass, manual fixes |
| Portal bugs | Staging test before production |
| Overload | Stagger crawler execution |

---

*This playbook applies the validated v3.0 curators-first methodology at Nashville scale.*
*Update after completion with actual timings and learnings.*
