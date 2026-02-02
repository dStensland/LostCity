# Geographic Expansion Playbook v2.2 (AI-First)

**Purpose:** Rapidly expand LostCity coverage to new geographic areas using parallel AI agents. Covers **events**, **destinations**, **organizations**, and **curated best-of lists**.

**Last Updated:** 2026-01-31
**Version:** 2.2 - Full Discovery Suite
**Validated:**
- Marietta: ~30 minutes (events only)
- Decatur: ~45 minutes (events + destinations)
- Full suite: ~60 minutes (all 4 components)

---

## Executive Summary

This playbook replaces the traditional human-driven research approach with an AI-first methodology that achieves **60x faster expansion** through parallel agent orchestration.

| Metric | Traditional | AI-First | Improvement |
|--------|-------------|----------|-------------|
| Total time | 2-4 weeks | 2-4 hours | 60x faster |
| Human hours | 30-40 hrs | 2-3 hrs | 90% reduction |
| Sources discovered | 10-15 | 50+ | 3-5x more |
| Destinations found | 20-30 | 60-80 | 2-3x more |
| Crawler quality | Variable | Pattern-matched | Consistent |

**Key Insight:** The human role shifts from *doing work* to *reviewing outputs* and *approving deployments*.

---

## What Gets Expanded

An area expansion now includes FOUR components:

### 1. Events (Crawlers)
- Theaters, music venues, festivals
- Community calendars, library programs
- City/government event calendars
- Recurring events (farmers markets, concerts)

### 2. Destinations (Spots/Places)
- **Food & Drink**: Restaurants, bars, coffee shops, breweries
- **Nightlife**: Live music venues, late-night spots
- **Entertainment**: Comedy clubs, theaters, arcades
- **Local Favorites**: Brunch spots, date night, family-friendly

### 3. Organizations (Community Groups)
- **Arts & Culture**: Arts councils, theater companies, music societies
- **Community**: Neighborhood associations, civic groups, chambers of commerce
- **Nonprofits**: Local charities, volunteer organizations
- **Interest Groups**: Running clubs, book clubs, meetup groups
- **Faith/Spiritual**: Churches, temples, spiritual centers with public events

### 4. Curators & Best-Of Lists
- **Food Critics**: Eater, Infatuation, local food bloggers
- **Local Media**: Atlanta Magazine, Creative Loafing, neighborhood papers
- **Travel/Tourism**: TripAdvisor, Yelp Elite, tourism boards
- **Niche Experts**: Beer bloggers, coffee reviewers, music critics
- **Social Influencers**: Local Instagram accounts, TikTok creators

**Why Curators Matter:** They've already vetted quality. Their "Best of" lists give us:
- Pre-prioritized destinations (saves research time)
- Quality signals (awards, recognition)
- Category organization (best brunch, best date night, etc.)
- Local credibility (trusted sources)

All four are discovered in parallel during Phase 1.

---

## The AI-First Process

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 1: DISCOVERY SWARM                                      │
│                                   (10-15 minutes)                                          │
│                                                                                           │
│  STEP 1: CURATORS FIRST (informs all other searches)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Curators Agent - Find Eater, Atlanta Mag, local bloggers, "best of" lists          │  │
│  │ Output: Pre-vetted venue lists, quality signals, category organization              │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                                 │
│                    ┌────────────────────┼────────────────────┐                           │
│                    ▼                    ▼                    ▼                           │
│  STEP 2: PARALLEL DISCOVERY (informed by curator findings)                               │
│  ┌───────────────┬───────────────┬───────────────┬───────────────┬───────────────┐      │
│  │ Sources       │ Neighborhoods │ Gap Analyzer  │ Destinations  │ Organizations │      │
│  │ (events)      │ (mapping)     │ (current DB)  │ (spots)       │ (community)   │      │
│  │               │               │               │               │               │      │
│  │ • Use curator │ • Research    │ • Query DB    │ • Start with  │ • Arts orgs   │      │
│  │   venues as   │   boundaries  │ • Count data  │   curator     │ • Nonprofits  │      │
│  │   source hints│ • Gen code    │ • Find gaps   │   lists first │ • Civic groups│      │
│  └───────────────┴───────────────┴───────────────┴───────────────┴───────────────┘      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                         HUMAN CHECKPOINT #1: Review Discovery                              │
│  • Review curator lists first  • Cross-reference destinations  • Prioritize crawlers     │
│  • Validate neighborhoods      • Check org calendars           • Spot duplicates          │
└───────────────────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 2: BUILD SWARM                          │
│                      (20-30 minutes)                            │
├────────┬────────┬────────┬────────┬────────┬────────┬──────────┤
│Crawler │Crawler │Crawler │Crawler │Crawler │Crawler │ Portal   │
│Agent 1 │Agent 2 │Agent 3 │Agent 4 │Agent 5 │Agent 6 │ Config   │
│        │        │        │        │        │        │ Agent    │
│Source 1│Source 2│Source 3│Source 4│Source 5│Source 6│          │
└────────┴────────┴────────┴────────┴────────┴────────┴──────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 3: DATA ENRICHMENT                          │
│                     (10 minutes)                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Neighborhood  │    Geocoding    │      Venue Enrichment       │
│   Assignment    │     Agent       │         Agent               │
│                 │                 │                             │
│ fix_neighbor-   │ hydrate_venues  │    venue_enrich.py          │
│ hoods.py        │ _foursquare.py  │    (Google + Claude)        │
└─────────────────┴─────────────────┴─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 HUMAN CHECKPOINT #2: QA & Deploy                 │
│         • Review crawlers      • Test portal                    │
│         • Run dry-run          • Approve activation             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Discovery Swarm

### Launch 3 Parallel Agents

**Agent 1: Source Discovery**
```
Prompt: "Use web search to discover ALL event sources in [CITY], GA. Find:
1. Performing Arts - theaters, concert venues
2. Museums & Galleries
3. Music Venues - bars with live music
4. Breweries & Nightlife
5. Community - libraries, city calendars
6. Parks & Outdoor - farmers markets

For EACH source: venue name, website URL, events page URL, event types,
whether they have a scrapable calendar. Output prioritized list by category."

Agent: Explore (with web search)
Time: ~2 minutes
Output: 50+ sources with URLs, categorized and prioritized
```

**Agent 2: Neighborhood Research**
```
Prompt: "Research and map ALL neighborhoods in [CITY], GA. For each:
1. Name (official and common)
2. Bounding box (lat/lng corners)
3. Key landmarks
4. Character/vibe

Use web search for city maps, real estate definitions, Wikipedia.
Generate Python code to add to fix_neighborhoods.py with bounding boxes.
Include ZIP code mappings."

Agent: Explore (with web search)
Time: ~2 minutes
Output: 15-25 neighborhoods with Python code ready to paste
```

**Agent 3: Gap Analysis**
```
Prompt: "Check existing database coverage for [CITY]:
1. Query venues with city containing '[CITY]'
2. Check existing crawlers that might cover this area
3. Count current events
4. Identify category gaps

Provide: what we have vs what we need."

Agent: data-specialist
Time: ~2 minutes
Output: Current state metrics, gap analysis, prioritized recommendations
```

### Human Checkpoint #1 (5-10 minutes)

Review the three agent outputs and decide:
- [ ] Which sources to prioritize for crawlers (pick top 6-8)
- [ ] Validate neighborhood boundaries look reasonable
- [ ] Confirm gap analysis matches expectations
- [ ] Approve proceeding to build phase

---

## Phase 2: Build Swarm

### Launch Parallel Crawler Agents (6-8 simultaneously)

**Crawler Agent Template**
```
Prompt: "Create a crawler for [SOURCE_NAME].

Source URL: [URL]
Events page: [EVENTS_URL]

Look at existing crawler patterns in crawlers/sources/
(especially [SIMILAR_CRAWLER].py).

Create a working crawler that:
1. Fetches events from their calendar
2. Extracts: title, date, time, description, location, category
3. Uses VENUE_DATA with city='[CITY]', neighborhood='[NEIGHBORHOOD]'
4. Follows exact patterns (imports, db.py usage, etc.)

Save to: crawlers/sources/[slug].py
Register in main.py
Test import works."

Agent: crawler-dev
Time: ~3-5 minutes each (parallel = same wall clock time)
Output: Working crawler file, registered in main.py
```

**Portal Configuration Agent**
```
Prompt: "Create [CITY] portal configuration:
1. Check existing portal patterns
2. Create database migration for portal
3. Create TypeScript setup script
4. Configure filters with all discovered neighborhoods
5. Set appropriate branding
6. Update parent portal (e.g., Atlanta) to include new neighborhoods

Save migration and scripts with documentation."

Agent: full-stack-dev
Time: ~5 minutes
Output: Migration file, setup script, documentation
```

### Parallel Execution Example (Marietta)

We launched these 9 agents simultaneously:
1. `marietta_city.py` crawler
2. `strand_theatre.py` crawler
3. `georgia_symphony.py` crawler
4. `marietta_main_street.py` crawler
5. `contrast_artisan_ales.py` crawler
6. `glover_park_concerts.py` crawler
7. Neighborhood mapping application
8. Portal configuration
9. Geocoding fixes

**Total wall-clock time: ~10 minutes** (all ran in parallel)

---

## Phase 3: Data Enrichment

### Launch Enrichment Agents

**Neighborhood Assignment**
```
Prompt: "Add [CITY] neighborhoods to fix_neighborhoods.py and run it.
[PASTE NEIGHBORHOOD CODE FROM PHASE 1]
Run --dry-run first, then apply.
Report how many venues got assignments."

Agent: full-stack-dev or data-specialist
```

**Geocoding**
```
Prompt: "Fix geocoding for [CITY] venues.
Query venues missing lat/lng.
Use hydrate_venues_foursquare.py or geocode_venues.py.
Report: missing before, fixed, still need attention."

Agent: data-specialist
```

---

## Human Checkpoint #2: QA & Deploy (15-20 minutes)

### Review Checklist

**Crawlers**
- [ ] All crawler files exist in `crawlers/sources/`
- [ ] All registered in `main.py` SOURCE_MODULES
- [ ] Syntax valid: `python -c "import sources.[crawler]"`
- [ ] Dry run works: `python main.py --source [slug] --dry-run`

**Neighborhood Mapping**
- [ ] Neighborhoods added to `fix_neighborhoods.py`
- [ ] ZIP codes mapped
- [ ] Run verified with `--dry-run`

**Portal**
- [ ] Migration file exists
- [ ] Portal slug and branding correct
- [ ] Parent portal updated to include new neighborhoods

**Data Quality**
- [ ] Geocoding coverage ≥ 95%
- [ ] Neighborhood assignment ≥ 85%

### Activation Commands

```bash
# 1. Apply database migration
psql $DATABASE_URL -f database/migrations/XXX_[city]_portal.sql

# 2. Run all new crawlers
python main.py --source [source-1]
python main.py --source [source-2]
# ... etc

# 3. Verify portal
open http://localhost:3000/[city]

# 4. Check event counts
python -c "
from db import get_supabase
sb = get_supabase()
result = sb.table('events').select('id', count='exact').eq('venue.city', '[CITY]').gte('start_date', 'today').execute()
print(f'Events: {result.count}')
"
```

---

## Agent Prompt Library

### Proven Prompts (Copy-Paste Ready)

These exact prompts were validated in the Marietta expansion:

<details>
<summary><b>Source Discovery Prompt</b></summary>

```
Use web search to discover ALL event sources in [CITY], GA. Find:

1. **Performing Arts** - theaters, concert venues, performance spaces
2. **Museums & Galleries** - art museums, history museums, galleries
3. **Music Venues** - bars with live music, concert halls
4. **Breweries & Nightlife** - breweries, bars with events, nightclubs
5. **Community** - libraries, community centers, city calendars
6. **Parks & Outdoor** - parks with events, farmers markets

For EACH source found, provide:
- Venue/org name
- Website URL
- Events page URL (if different)
- Type of events they host
- Whether they have a scrapable calendar

Be thorough - search multiple queries like "[CITY] GA events",
"[CITY] theaters", "[CITY] live music", "[CITY] breweries",
"things to do in [CITY] GA", etc.

Output a prioritized list of sources to add, organized by category.
```
</details>

<details>
<summary><b>Neighborhood Research Prompt</b></summary>

```
Research and map ALL neighborhoods in [CITY], GA.

For each neighborhood:
1. Name (official and common names)
2. Approximate bounding box (lat/lng corners)
3. Key landmarks or venues in that area
4. Character/vibe of the neighborhood

Use web search to find:
- City of [CITY] neighborhood maps
- Real estate neighborhood definitions
- Wikipedia/local wiki articles
- Tourism information

Then generate the Python code to add to fix_neighborhoods.py with
the [CITY]_NEIGHBORHOODS dictionary containing bounding boxes.

Also identify relevant ZIP codes and their neighborhood mappings.
```
</details>

<details>
<summary><b>Crawler Generation Prompt</b></summary>

```
Create a crawler for [SOURCE_NAME].

Source URL: [URL]
Events page: [EVENTS_URL]

Look at existing crawler patterns in crawlers/sources/
(especially [similar_crawler].py for [type] venues).

Create a working crawler that:
1. Fetches events from their calendar
2. Extracts: title, date, time, description, location, category
3. Uses VENUE_DATA with:
   - name: "[VENUE_NAME]"
   - city: "[CITY]"
   - neighborhood: "[NEIGHBORHOOD]"
   - address: "[ADDRESS]"
4. Follows the exact patterns used in other crawlers

Save the crawler to: crawlers/sources/[slug].py
Register in main.py SOURCE_MODULES.
Test that it can be imported without errors.
```
</details>

<details>
<summary><b>Portal Configuration Prompt</b></summary>

```
Create a [CITY] portal configuration for LostCity.

1. Look at how other portals are configured:
   - Check web/lib/portal.ts
   - Check database/migrations for portal schema
   - Look at existing portal configurations

2. Create:
   - Database migration to add [CITY] portal
   - TypeScript setup script (optional)

The portal should have:
- slug: "[city-lowercase]"
- name: "Discover [CITY]" or "[CITY] Events"
- portal_type: "city"
- filters: {
    city: "[CITY]",
    neighborhoods: [LIST FROM PHASE 1]
  }
- Appropriate branding

3. Update the parent portal (e.g., Atlanta) to INCLUDE [CITY]
   neighborhoods so events show in both portals.

Save migrations/scripts and explain activation steps.
```
</details>

<details>
<summary><b>Destinations Discovery Prompt</b></summary>

```
Use web search to discover the BEST destinations in [CITY], GA. Find top venues:

**Food & Drink:**
1. **Restaurants** - Best restaurants, notable dining (15-20)
2. **Bars** - Best bars, cocktail spots, wine bars (10-15)
3. **Coffee Shops** - Best coffee, cafes (8-10)
4. **Breweries** - Craft breweries, taprooms (all)

**Nightlife & Entertainment:**
5. **Live Music Venues** - Regular live music spots
6. **Comedy/Entertainment** - Comedy clubs, entertainment venues
7. **Late Night** - Best late-night spots

**Local Favorites:**
8. **Brunch Spots** - Popular brunch destinations
9. **Date Night** - Romantic restaurants, upscale spots
10. **Family Friendly** - Kid-friendly restaurants

For EACH destination:
- Name
- Address (if findable)
- Category/type
- What makes it notable (awards, local favorite, unique feature)
- Google Maps searchable name

Search: "best restaurants [CITY] GA", "best bars [CITY]", "Eater [CITY]",
"Atlanta Magazine best [CITY]", "[CITY] food blog", etc.

Output organized by category with 60-80 total destinations.
```
</details>

<details>
<summary><b>Organizations Discovery Prompt</b></summary>

```
Use web search to discover community ORGANIZATIONS in [CITY], GA that host events.

**Arts & Culture:**
- Arts councils, arts alliances
- Theater companies, dance troupes
- Music societies, symphonies
- Film societies, photography clubs

**Community & Civic:**
- Neighborhood associations
- Chamber of commerce
- Rotary, Lions, Kiwanis clubs
- Historical societies, preservation groups

**Nonprofits & Causes:**
- Local charities and foundations
- Volunteer organizations
- Environmental groups
- Social justice organizations

**Interest & Hobby Groups:**
- Running clubs, cycling groups
- Book clubs, writing groups
- Garden clubs, nature groups
- Tech meetups, maker spaces

**Faith & Spiritual:**
- Churches with public events
- Temples, mosques, synagogues
- Meditation centers, yoga communities
- Interfaith organizations

For EACH organization:
- Name
- Website URL
- Type of events they host
- Event frequency (weekly, monthly, annual)
- Whether they have a public calendar

Search: "[CITY] arts council", "[CITY] chamber of commerce",
"[CITY] nonprofits", "[CITY] community organizations",
"[CITY] running club", "[CITY] meetup groups", etc.

Output organized by category with 20-40 organizations.
```
</details>

<details>
<summary><b>Curators & Best-Of Lists Prompt</b></summary>

```
Use web search to find established CURATORS and "best of" lists for [CITY], GA.

**Food & Dining Critics:**
- Eater Atlanta coverage of [CITY]
- The Infatuation [CITY] guides
- Atlanta Magazine [CITY] features
- Local food bloggers covering [CITY]
- James Beard nominees/winners in [CITY]

**Local Media:**
- Creative Loafing [CITY] coverage
- [CITY] Patch or local newspaper
- Neighborhood-specific publications
- Local lifestyle magazines

**Travel & Tourism:**
- TripAdvisor top lists for [CITY]
- Yelp's curated collections
- Tourism board recommendations
- Travel blogger features

**Niche Experts:**
- Beer bloggers (breweries, beer bars)
- Coffee reviewers (cafes, roasters)
- Music critics (venues, scenes)
- Nightlife guides

**Social/Influencer Lists:**
- Local Instagram "best of" accounts
- TikTok creators featuring [CITY]
- YouTube local guides

For EACH curator/list found:
- Source name (e.g., "Eater Atlanta")
- URL to the list/article
- What they curated (e.g., "Best Restaurants in [CITY]")
- Date published (for freshness)
- Number of venues listed

Extract the actual venue names from their lists when possible.
This gives us pre-vetted, quality destinations.

Search: "best restaurants [CITY] GA 2025", "Eater [CITY]",
"Atlanta Magazine [CITY]", "[CITY] food blog", "best bars [CITY]", etc.
```
</details>

---

## Success Metrics

### Launch Criteria (Before Activation)

| Metric | Minimum | Target |
|--------|---------|--------|
| **Events** | | |
| Crawlers created | 5 | 8+ |
| Events discovered | 30 | 100+ |
| **Destinations** | | |
| Spots imported | 40 | 70+ |
| Categories covered | 4 | 6+ |
| **Organizations** | | |
| Orgs identified | 10 | 25+ |
| With event calendars | 5 | 15+ |
| **Curators** | | |
| Best-of lists found | 3 | 8+ |
| Venues from lists | 30 | 60+ |
| **Data Quality** | | |
| Geocoding coverage | 90% | 100% |
| Neighborhood coverage | 80% | 90%+ |
| Portal configured | ✓ | ✓ |

### Week 1 Monitoring

| Metric | Target | Check Command |
|--------|--------|---------------|
| Daily new events | 5+ | `SELECT COUNT(*) FROM events WHERE created_at > now() - interval '1 day'` |
| Crawler success rate | 95%+ | Check `crawl_logs` |
| Zero-error crawlers | 100% | `python main.py --source X --dry-run` |

---

## Lessons Learned (Marietta Case Study)

### What Worked Exceptionally Well

1. **Parallel agent execution** - 9 agents completed in ~10 minutes total
2. **Web search for discovery** - Found 50+ sources vs. ~15 with manual research
3. **Pattern-based crawler generation** - AI matched existing code patterns perfectly
4. **Neighborhood code generation** - Python code was copy-paste ready

### What Required Human Attention

1. **Crawler registration** - Some agents forgot to add to `main.py` (easy fix)
2. **Venue geocoding edge cases** - 2 venues needed manual coordinate lookup
3. **Portal branding decisions** - Human preference for colors/theming

### Optimizations for Next Time

1. **Batch crawler testing** - Create a script to test all new crawlers at once
2. **Auto-registration** - Modify agents to always register in main.py
3. **Geocoding fallbacks** - Pre-populate coordinates from Google Maps API

---

## Quick Reference

### Expansion in 4 Commands

```bash
# 1. Launch discovery swarm (in Claude Code)
"Discover all event sources, neighborhoods, and current coverage for [CITY], GA"

# 2. Launch build swarm (in Claude Code)
"Generate crawlers for: [source1], [source2], [source3]...
 Apply neighborhoods, configure portal, fix geocoding"

# 3. Activate
psql $DATABASE_URL -f database/migrations/XXX_[city]_portal.sql
for src in source1 source2 source3; do python main.py --source $src; done

# 4. Verify
open http://localhost:3000/[city]
```

### Time Budget

| Phase | Time | Human Involvement |
|-------|------|-------------------|
| Discovery | 5 min | Review outputs |
| Build | 15 min | None (agents working) |
| Review | 15 min | QA checklist |
| Activate | 10 min | Run commands |
| **Total** | **45 min** | **25 min active** |

---

## Appendix: Files Created (Marietta Example)

### Crawlers
- `crawlers/sources/marietta_city.py`
- `crawlers/sources/strand_theatre.py`
- `crawlers/sources/georgia_symphony.py`
- `crawlers/sources/marietta_main_street.py`
- `crawlers/sources/contrast_artisan_ales.py`
- `crawlers/sources/glover_park_concerts.py`

### Configuration
- `database/migrations/093_marietta_portal.sql`
- `web/scripts/create-marietta-portal.ts`

### Documentation
- `MARIETTA_PORTAL_SETUP.md`
- `MARIETTA_COVERAGE_GAP_ANALYSIS.md`
- `MARIETTA_GEOCODING_REPORT.md`

---

*This playbook was validated through the Marietta expansion on 2026-01-31, achieving 100% of targets in under 1 hour.*
