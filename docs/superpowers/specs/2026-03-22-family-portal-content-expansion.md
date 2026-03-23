# Family Portal Content Expansion — Design Spec

**Goal:** Make Lost Youth the comprehensive source for youth activities across all ages in metro Atlanta. No dead ends by age, neighborhood, or activity type.

**Strategy:** Platform-Pattern Leverage — exploit existing crawler infrastructure first, build new patterns second, one-off crawlers last. Maximize events-per-hour-of-work.

**Current State:** 7,316 future events, 4,054 programs, 160 subscribed sources. Three structural problems: 3,400+ events invisible (missing subscriptions), 3 library systems dead (short crawl window), 110 nightlife events leaking into children's portal.

---

## Phase 1: Fix & Unlock (migrations only, no crawler work)

### 1.1 Subscribe missing program sources
17 active sources produce family content but aren't subscribed to the family portal. Single migration with INSERT INTO source_subscriptions.

Sources to subscribe (all with `subscription_scope = 'all'`):
- atlanta-family-programs (113 events, 728 programs)
- dekalb-family-programs (292 events, 451 programs)
- club-scikidz-atlanta (308 events, 308 programs)
- gwinnett-family-programs (77 events, 281 programs)
- woodward-summer-camps (249 events, 246 programs)
- mjcca-day-camps (181 events, 173 programs)
- walker-summer-programs (87 events, 78 programs)
- pace-summer-programs (87 events, 75 programs)
- lovett-summer-programs (71 events, 71 programs)
- gwinnett-ehc (96 events, 58 programs)
- girl-scouts-greater-atlanta-camps (89 events, 49 programs)
- cobb-family-programs (195 events, 44 programs)
- wesleyan-summer-camps (43 events, 43 programs)
- marist-school (56 events, 37 programs)
- callanwolde-fine-arts-center (836 events)
- trinity-summer-camps (110 events)
- gwinnett-adult-swim-lessons (72 events)

Expected yield: +3,400 events, +2,622 programs immediately visible.

### 1.2 Fix nightlife content gate
110 nightlife events from Battle & Brew, Believe Music Hall, Painted Duck, Krog Street Market appearing in family portal. The portal config has `exclude_categories: ['nightlife']` but it's not enforced at the query layer for all code paths.

Fix: Add category exclusion filter in the family portal's feed/timeline query path. Events with `category_id = 'nightlife'` must be excluded for family vertical portals.

### 1.3 Reactivate dormant family sources
- Sky Zone Atlanta: reactivate source
- Gigi's Playhouse: reactivate source
- Decatur Recreation: reactivate source
- LEGOLAND Atlanta: check crawler, 0 future events

---

## Phase 2: Exploit Existing Patterns (reuse proven crawler infrastructure)

### 2.1 Rec1 Expansion
Pattern: `crawlers/sources/_rec1_base.py` — already powers Cobb, Gwinnett, Milton.

New tenants (one file each, copy Milton config pattern):
- **Forsyth County Parks & Rec** — `secure.rec1.com/GA/forsyth-county-parks-recreation`. 300K residents, fastest-growing GA county. Est. +100-200 programs.
- **Cherokee County Parks & Rec** — `secure.rec1.com/GA/cherokee-county`. Canton/Woodstock/Acworth dead zone. Est. +80-150 programs.

### 2.2 Library Crawl Horizon Fix
Cobb, DeKalb, Gwinnett library crawlers run daily but only pull ~1 week forward. Fulton correctly pulls 519 future events. Fix the date range parameter to pull 90 days forward.

Crawlers to fix:
- `crawlers/sources/cobb_library.py`
- `crawlers/sources/dekalb_library.py`
- `crawlers/sources/gwinnett_library.py`

Expected yield: +600-1,200 storytimes, homeschool programs, teen clubs, makerspace sessions.

### 2.3 Franchise HTML Crawlers
Pattern: `crawlers/sources/the_coder_school.py` (franchise location pages with program tables).

New crawlers:
- **Code Ninjas Atlanta** — 4 metro locations (Alpharetta, East Cobb, Duluth, Kennesaw). codeninjas.com/[city]-ga. Est. +40-80 STEM sessions.
- **School of Rock Atlanta** — Multiple locations. schoolofrock.com/locations/[slug]/music-camps. Est. +40-60 camp sessions.

### 2.4 Extend Existing Playwright Crawlers
Aurora Theatre and Horizon Theatre have existing Playwright crawlers for shows. Extend to cover their /education pages for youth programs.

- `aurora_theatre.py` → add education section crawl (+30-50 youth theater programs)
- `horizon_theatre.py` → add youth workshops (+20-30 programs)

---

## Phase 3: Build New Platform Patterns (one scraper → many sources)

### 3.1 MindBody/Jackrabbit API Scraper
Build a generic scraper for the two dominant class management platforms in the youth enrichment space. One pattern unlocks dozens of studios.

**MindBody** — used by dance studios, yoga studios, martial arts, some gymnastics. Has a public-facing schedule widget that can be scraped.

Target studios (initial batch):
- Dance 411 Studios (multiple locations)
- Atlanta Dance Arts (Smyrna/Marietta)
- Stage Door Dance (East Cobb)
- Level 10 Gymnastics
- Tumblin Tots

**Jackrabbit** — dominant in dance, gymnastics, swim, cheer. No public API but has HTML enrollment pages per provider.

Target studios (initial batch):
- Gymnastics Zone (Alpharetta, Roswell)
- Georgia Gymnastics Academy (Smyrna, East Cobb)
- Additional swim schools and cheer programs

### 3.2 Youth Sports League Pattern
**AYSO Regional** — BlueStar software for registration/schedules. Regions 60 (North Fulton), 75 (Cobb), 112 (DeKalb). +100-200 registration/tryout events.

**i9 Sports** — Franchise location pages at i9sports.com. Flag football, basketball, soccer. +50-100 season events.

### 3.3 Suburban Parks Expansion
- **Sandy Springs Parks & Rec** — audit platform (likely CivicRec), build crawler. +80-150 programs.
- **Henry County Parks & Rec** — audit platform, build crawler. +60-100 programs.

---

## Phase 4: Unique Sources & Camp Season Inventory

One-off crawlers for high-value sources. These build the private enrichment camp inventory for January 2027 camp season and fill long-tail gaps no competitor covers.

### 4.1 Youth Organizations
- Georgia FIRST Robotics (firstgeorgia.org) — tournament/competition events. +30-50.
- Georgia 4-H (georgia4h.org) — county extension programs. +50-80.
- BSA Atlanta Area Council (atlantabsa.org) — camporees, recruitment. +40-80.
- Junior Achievement of Georgia — BizTown, Finance Park. +20-30.

### 4.2 STEM & Enrichment
- Play-Well TEKnologies (play-well.org) — LEGO STEM camps at school sites. +20-40.
- Mad Science of Atlanta — STEM camps and birthday parties. +15-30.
- Snapology Dunwoody — STEM franchise. +15-25.
- Engineering for Kids Atlanta — franchise STEM. +20 events.

### 4.3 Premium Camp Operators
For January 2027 camp season readiness:
- Alliance Theatre summer/teen programs
- Woodruff Arts Center programs
- iD Tech camps (if Atlanta locations exist)
- Steve & Kate's Camp (if Atlanta locations exist)
- First Tee of Atlanta — youth golf. +20-40.

---

## Phase 5: Data Quality (parallel to Phases 2-4)

### 5.1 Age Tag Inference
85% of events have no age_min/age_max. Build an inference engine that bulk-tags events from:
- Title patterns ("ages 5-12", "for kids", "teen", "preschool")
- Venue type (children's museum → age 0-12, library storytime → age 0-5)
- Category signals (learning + library = likely youth)
- Source-level defaults (family program sources → age 0-17)

Target: 85% untagged → 40% untagged (tag ~3,300 events).

### 5.2 Fall Program Parity
Only 7 fall programs exist. County parks systems run fall sports leagues and enrichment. Ensure crawlers capture fall semester with same intensity as summer. This may require re-running county crawlers after fall registration opens (typically August).

### 5.3 Venue Image Enrichment
51% venue image coverage. Extract og:image from venue websites during re-crawl. Target 80%.

### 5.4 Birthday Party Venue Tagging
Add `birthday_party_venue` as an occasion tag in `venue_occasions` table. Enrich existing venues: Sky Zone, LEGOLAND, bowling alleys, Andretti, escape rooms, art studios. Not a crawler — a venue attribute enrichment.

### 5.5 Price/Cost Gap Fill
55% price coverage. Flag `is_free=true` on library and parks events that are missing price data. Extract prices from paid program descriptions. Target 75%.

---

## Success Criteria

After all phases:
- Every age band (0-2, 3-5, 6-10, 11-13, 14-17) has 100+ results
- Every major suburb (Alpharetta, Roswell, Decatur, Marietta, Sandy Springs, Johns Creek, Dunwoody, Kennesaw, Woodstock, Canton) has 50+ results
- Zero nightlife content in family portal
- 60%+ events have age tags
- Summer camp inventory covers both public (parks & rec) and private (specialty) camps
- 15,000+ total accessible events, 8,000+ programs
