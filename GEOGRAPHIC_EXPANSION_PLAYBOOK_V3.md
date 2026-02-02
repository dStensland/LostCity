# Geographic Expansion Playbook v3.0 (AI-First)

**Purpose:** Rapidly expand LostCity coverage to new geographic areas using parallel AI agents. A living document that evolves with each expansion.

**Last Updated:** 2026-01-31
**Version:** 3.0 - Curators-First Methodology
**Maintainer:** AI + Human collaborative process

---

## Validated Expansions

| City | Date | Components | Time | Events | Destinations | Orgs | Key Learning |
|------|------|------------|------|--------|--------------|------|--------------|
| Marietta | 2026-01-31 | Events only | 30 min | 6 crawlers | - | - | Parallel agents work |
| Decatur | 2026-01-31 | Events + Destinations | 45 min | 5 crawlers | 71 spots | - | Destinations matter |
| College Park | 2026-01-31 | Full suite | 50 min | 5 crawlers | 14 spots | 11 orgs | Curators-first is key |

---

## Core Methodology: Curators-First

### Why Curators First?

After three expansions, we learned that **starting with curators changes everything**:

```
WITHOUT CURATORS-FIRST:
├── Agents search blindly
├── May miss key venues
├── No quality signals
├── No cultural narrative
└── Duplicated research effort

WITH CURATORS-FIRST:
├── Curators reveal the narrative ("Soul Food Capital")
├── Curators identify anchor venues (Virgil's, Breakfast Boys)
├── Curators surface key organizations (CPMSA, Black Restaurant Week)
├── All subsequent agents are INFORMED
└── More targeted, higher quality results
```

### The Curator Advantage

| What Curators Provide | Example (College Park) |
|-----------------------|------------------------|
| **Cultural Narrative** | "More Black restaurants than any other place in America" |
| **Anchor Venues** | Virgil's Gullah Kitchen, The Breakfast Boys, Brake Pad |
| **Key Organizations** | CPMSA, Black Restaurant Week, ATL Airport District |
| **Quality Signals** | James Beard mentions, Atlanta Magazine features |
| **Category Expertise** | Soul food specialists, brunch destinations |

---

## The Four Components

Every expansion now covers:

### 1. Events (Crawlers)
Sources that produce recurring events we can crawl.
- City/government calendars
- Venues with event pages
- Arts organizations
- Community calendars

### 2. Destinations (Spots/Places)
Static venues people want to discover.
- Restaurants, bars, coffee shops
- Entertainment venues
- Local favorites by category

### 3. Organizations (Community Groups)
Groups that host events or serve communities.
- Arts councils, theater companies
- Civic groups, neighborhood associations
- Nonprofits, faith communities
- Recreation departments

### 4. Curators (Best-Of Sources)
People/publications who've already done curation.
- Food critics (Eater, Infatuation)
- Local media (Atlanta Magazine, Creative Loafing)
- Tourism boards
- Niche bloggers

---

## Phase 1: Discovery Swarm

### Step 1: Curators Agent (FIRST - Informs Everything)

```
PROMPT:
Use web search to find established CURATORS and "best of" lists for [CITY], GA.

Find:
- Eater Atlanta coverage of [CITY]
- The Infatuation [CITY] guides
- Atlanta Magazine [CITY] features
- Local food bloggers
- James Beard nominees in the area
- Creative Loafing coverage
- Tourism board recommendations
- TripAdvisor/Yelp curated lists
- Niche experts (beer, coffee, music)
- Local Instagram/social accounts

For EACH curator/list:
- Source name and URL
- What they curated
- Date published
- Venues mentioned (extract actual names)

Also identify:
- The area's CULTURAL IDENTITY (what makes it unique?)
- KEY ANCHOR VENUES (the must-haves)
- IMPORTANT ORGANIZATIONS mentioned

This informs all other searches.
```

**Agent:** Explore (with web search)
**Time:** ~3 minutes
**Output:** Cultural narrative, anchor venues, key orgs, best-of lists

### Step 2: Parallel Discovery (Informed by Curators)

Launch these 5 agents simultaneously, each informed by curator findings:

**Agent 2: Event Sources**
```
CONTEXT FROM CURATORS:
[Paste key findings - anchor venues, key orgs, cultural identity]

Find ALL event sources in [CITY], GA:
1. City/government calendars
2. Venues identified by curators (do they have events?)
3. Organizations mentioned by curators
4. Additional theaters, music venues
5. Libraries, community centers
6. Parks, farmers markets

For EACH: name, URL, events page, event types, scrapable calendar
```

**Agent 3: Neighborhoods**
```
Research and map ALL neighborhoods in [CITY], GA.
For each: name, bounding box (lat/lng), landmarks, character
Generate Python code for fix_neighborhoods.py
Include ZIP code mappings
```

**Agent 4: Gap Analysis**
```
Check existing database for [CITY]:
1. Current venues and events
2. Existing crawlers covering this area
3. What curator-vetted venues are MISSING?
   - Check: [list anchor venues from curators]
4. Category gaps

Report: what we have vs what curators say we need
```

**Agent 5: Destinations**
```
CONTEXT: Curators identified these as key venues:
[List curator-vetted venues]

START with curator lists, then expand:
1. All curator-mentioned venues (highest priority)
2. Additional restaurants, bars, coffee by category
3. Entertainment venues
4. Local favorites

For each: name, address, category, what makes it notable
Target: 50-80 destinations
```

**Agent 6: Organizations**
```
CONTEXT: Curators identified these orgs:
[List from curator research]

Find community organizations:
1. All curator-mentioned orgs (highest priority)
2. Arts & culture orgs
3. Civic/community groups
4. Nonprofits
5. Recreation departments
6. Faith communities with public events

For each: name, URL, event types, calendar availability
Target: 20-40 organizations
```

### Human Checkpoint #1 (5-10 minutes)

Review discovery outputs:
- [ ] Cultural identity captured correctly?
- [ ] Anchor venues all identified?
- [ ] Prioritize which crawlers to build (top 5-6)
- [ ] Neighborhood boundaries reasonable?
- [ ] Curator-vetted venues ready for import?
- [ ] Approve proceeding to build phase

---

## Phase 2: Build Swarm

Launch 10+ agents in parallel:

### Crawler Agents (5-8 parallel)

```
PROMPT TEMPLATE:
Create a crawler for [SOURCE_NAME].

CONTEXT:
- This is part of the [CITY] expansion
- Cultural identity: [from curators]
- This venue/org is: [description from research]

Source URL: [URL]
Events page: [EVENTS_URL]

Look at existing patterns in crawlers/sources/
(especially [similar_crawler].py).

Create crawler that:
1. Fetches events
2. Extracts: title, date, time, description, category
3. Uses VENUE_DATA with:
   - city: "[CITY]"
   - neighborhood: "[NEIGHBORHOOD]"
4. Follows exact patterns from similar crawlers

Save to: crawlers/sources/[slug].py
Register in main.py
```

### Portal Configuration Agent

```
Create [CITY] portal with CULTURAL IDENTITY from curators:

Identity: [paste cultural narrative]
Anchor venues: [list]

Create:
1. Database migration (migrations/XXX_[city]_portal.sql)
2. Portal with appropriate branding:
   - Colors that reflect cultural identity
   - Tagline that captures the narrative
   - Hero section highlighting key themes
3. All discovered neighborhoods in filters
4. Update Atlanta portal to include these neighborhoods
```

### Destinations Import Agent

```
Create import script for [CITY] destinations.

PRIORITIZE curator-vetted venues:
[List anchor venues first]

Then additional discoveries:
[List other destinations]

Follow pattern from import_decatur_destinations.py
Save to: crawlers/import_[city]_destinations.py
```

### Organizations Import Agent

```
Create import script for [CITY] organizations.

Include:
[List all discovered orgs]

Follow pattern from import_college_park_orgs.py
Save to: crawlers/import_[city]_orgs.py
```

### Neighborhood Mapping Agent

```
Add [CITY] neighborhoods to fix_neighborhoods.py:

[Paste neighborhood code from discovery]

Run with --dry-run first, then apply.
Report: venues updated, remaining gaps
```

### Geocoding Agent

```
Fix geocoding for [CITY] venues.
Query all venues in this city.
Run geocoding for missing lat/lng.
Report: fixed count, any needing manual attention
```

---

## Phase 3: QA & Deploy

### Activation Checklist

**Crawlers**
- [ ] All files exist in `crawlers/sources/`
- [ ] All registered in `main.py`
- [ ] `python -c "import sources.[crawler]"` works for each
- [ ] `python main.py --source [slug] --dry-run` succeeds

**Data Imports**
- [ ] Destinations import script created
- [ ] Organizations import script created
- [ ] Scripts run without errors

**Portal**
- [ ] Migration file exists
- [ ] Branding reflects cultural identity
- [ ] All neighborhoods included
- [ ] Atlanta portal updated

**Data Quality**
- [ ] Geocoding ≥ 95%
- [ ] Neighborhood assignment ≥ 85%
- [ ] Curator-vetted venues all imported

### Activation Commands

```bash
# 1. Apply portal migration
psql $DATABASE_URL -f database/migrations/XXX_[city]_portal.sql

# 2. Import data
cd crawlers
python import_[city]_destinations.py
python import_[city]_orgs.py

# 3. Run crawlers
python main.py --source [source-1]
python main.py --source [source-2]
# ... etc

# 4. Verify
open http://localhost:3000/[city]
```

---

## Portal Identity Patterns

Each city gets distinct branding based on curator-discovered identity:

| City | Identity | Colors | Tagline |
|------|----------|--------|---------|
| **Marietta** | Historic/Traditional | Blue/Purple | "Events in historic Marietta" |
| **Decatur** | Artsy/Walkable | Orange/Amber | "Events & happenings in walkable Decatur" |
| **College Park** | Soulful/Heritage | Red/Gold | "Soul food, culture & history in Atlanta's airport city" |

### Identity Discovery Questions

When curators agent runs, look for:
1. What is this place KNOWN for? (soul food, arts, history, etc.)
2. What makes it DIFFERENT from nearby cities?
3. What NARRATIVE do curators tell about it?
4. What CULTURAL GROUPS are prominent?
5. What VISUAL STYLE matches the vibe?

---

## Lessons Learned

### From Marietta (Events Only)
- Parallel agents dramatically reduce wall-clock time
- Pattern-based crawler generation works reliably
- Always register crawlers in main.py

### From Decatur (Events + Destinations)
- Destinations add significant value to portals
- Curator lists (Eater, Infatuation) provide quality signals
- Import scripts should be reusable patterns

### From College Park (Full Suite + Curators-First)
- **Curators-first is transformative** - changes entire approach
- Cultural narrative informs portal branding
- Organizations are a distinct valuable component
- Pre-vetted venues should be imported first

---

## Continuous Improvement

### After Each Expansion, Update:

1. **Validated Expansions table** - Add timing and results
2. **Lessons Learned** - What worked, what didn't
3. **Prompt Library** - Refine prompts based on results
4. **Identity Patterns** - Add new city identity types
5. **Agent improvements** - Note any agent failures to fix

### Metrics to Track

| Metric | How to Measure | Target |
|--------|----------------|--------|
| Expansion time | Wall clock start to portal live | < 1 hour |
| Curator accuracy | % of curator venues actually good | > 90% |
| Crawler success | Crawlers working on first try | > 80% |
| Coverage completeness | Events found vs estimated | > 70% |

### Known Issues to Fix

1. **Some agents forget main.py registration** - Add explicit reminder
2. **Geocoding fallbacks needed** - Some addresses don't resolve
3. **Duplicate detection** - Need better cross-reference with existing data

---

## Quick Reference

### Single Command Expansion

```
"Expand LostCity to [CITY], GA using the curators-first methodology:
1. First find curators and best-of lists to understand the cultural identity
2. Then run parallel discovery for sources, destinations, neighborhoods, orgs
3. Build crawlers, portal, import scripts
4. Apply everything and verify"
```

### Time Budget (Full Suite)

| Phase | Time | Human |
|-------|------|-------|
| Curators (first) | 3 min | Review identity |
| Parallel discovery | 5 min | Review outputs |
| Build swarm | 15 min | Minimal |
| QA & Deploy | 15 min | Run commands |
| **Total** | **~40 min** | **~20 min active** |

---

## Appendix: Complete File Inventory

### Per-Expansion Files Created

**Crawlers** (5-8 per city)
- `crawlers/sources/[city]_city.py` - City calendar
- `crawlers/sources/[city]_main_street.py` - Main Street/downtown org
- `crawlers/sources/[venue].py` - Key venues (3-5)

**Data Imports**
- `crawlers/import_[city]_destinations.py`
- `crawlers/import_[city]_orgs.py`

**Database**
- `database/migrations/XXX_[city]_portal.sql`

**Documentation**
- `[CITY]_COVERAGE_GAP_ANALYSIS.md`
- `[CITY]_PORTAL_SETUP.md`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial human-centric playbook |
| 2.0 | 2026-01-31 | AI-first with parallel agents |
| 2.1 | 2026-01-31 | Added destinations |
| 2.2 | 2026-01-31 | Added organizations and curators |
| 3.0 | 2026-01-31 | Curators-first methodology, continuous learning |

---

*This is a living document. Update it after every expansion with new learnings.*
