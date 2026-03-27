# Event Taxonomy Redesign

## Problem

The current event categorization system conflates four different questions into one field: what kind of thing is it, who is it for, where does it happen, and what source did it come from. This produces systemic misclassification — 500+ upcoming events are miscategorized from bugs like substring matching ("BlazeSports" triggers "esports"), artist bio contamination (Spotify bios adding false genres), and catch-all categories ("community", "nightlife") that have no coherent definition.

19 current categories include fake categories that describe context rather than content (nightlife = time + venue, outdoors = location, family = audience, community = nothing). Meanwhile real kinds of things have no home — games, workshops, dance, conventions all get shoved into wrong buckets. The genre layer has 105+ values with no mapping, and the classification engine (2,183 lines of regex/substring matching) is the root cause of most data quality issues.

## Design

### Three-axis taxonomy

| Axis | Answers | Example |
|---|---|---|
| **Category** (19) | What kind of thing is this? | Music, Games, Dance |
| **Genre** (per-category) | What flavor of that thing? | Music:jazz, Games:trivia, Dance:salsa |
| **Tags** (cross-cutting) | What else should I know? | free, outdoor, date-night, 21+ |

### Categories (19)

**Performance & Entertainment**

| Category | Covers |
|---|---|
| Music | Concerts, DJ sets, live bands, karaoke, listening sessions |
| Film | Screenings, premieres, watch parties (fallback when subject unclear) |
| Comedy | Standup, improv, sketch |
| Theater | Plays, musicals, drag, burlesque, puppetry, immersive, dance performances (watching) |
| Art | Exhibitions, galleries, installations, art fairs. NOT paint-and-sip (that's Workshops). |
| Dance | Social dance, latin night, swing, line dancing, dance classes — doing it for fun |

**Active & Outdoors**

| Category | Covers |
|---|---|
| Sports | Spectator events, matches, races |
| Fitness | Gym classes, yoga, run clubs, swim lessons, Zumba, gymnastics — exercise intent |
| Outdoors | Hiking, nature walks, garden tours, paddling — the activity IS being outside |
| Games | Trivia, bingo, board games, poker, Warhammer, esports |

**Food & Social**

| Category | Covers |
|---|---|
| Food & Drink | Tastings, food festivals, happy hours, pop-ups |
| Conventions | Expos, conferences, trade shows, fan conventions |

**Learning & Making**

| Category | Covers |
|---|---|
| Workshops | Pottery, paint-and-sip, blacksmithing, cooking, crafts, jewelry — make/do something hands-on (creative/physical output) |
| Education | Seminars, ESL, career development, medical lectures, tech classes — learn something (intellectual output) |
| Words | Book clubs, poetry readings, author signings, literary events, spoken word, zines |

**Civic & Service**

| Category | Covers |
|---|---|
| Volunteer | Service shifts, food pantries, tree planting, meal delivery |
| Civic | Government sessions, political organizing, public meetings |
| Support | Recovery meetings, support groups. **Suppressed by default** in all portals except HelpATL. |
| Religious | Worship services, faith-based gatherings, spiritual events |

### Disambiguation rules

**Dance rule** — the same physical activity splits across three categories based on context:

- **Doing it for fun** -> Dance (salsa night, kids' ballet class, line dancing)
- **Doing it for exercise** -> Fitness (Zumba, dance cardio)
- **Watching it on stage** -> Theater (ballet performance, dance recital)
- **Tiebreaker for rec center classes**: title contains "bachata", "salsa", "ballroom", "line dancing" -> Dance. Title contains "dance cardio", "dance fitness", "Zumba" -> Fitness. Venue type `dance_studio` biases toward Dance; `fitness_center` biases toward Fitness.

**Watch party rule** — categorize by the subject being watched, Film as fallback:

- Drag Race viewing party -> Theater (drag is theater)
- Super Bowl watch party -> Sports
- Random movie night at a bar -> Film

**Workshops vs Education** — the distinction is output type:

- **Workshops** = creative or physical output. You leave with something you made (pottery, painting, jewelry) or a physical skill practiced (cooking, blacksmithing).
- **Education** = intellectual output. You leave with knowledge (seminar, certification, lecture, language class).
- Tiebreaker: if the title contains "class" + a creative medium (pottery, painting, cooking), it's Workshops. If it contains "class" + an academic subject (ESL, coding, finance), it's Education.

### Theme park attractions

Not events. Convert to venue attributes (same pattern as specials). Strip from event feed, surface on venue detail pages. Filter by title keywords (not source-level) to avoid stripping legitimate events like festivals at the same venue. Includes: Dinotorium, 4D Theater, Adventure Outpost, SkyHike, and similar permanent attractions.

### Dissolved categories

| Old Category | Reclassification |
|---|---|
| Nightlife | DJs/karaoke -> Music, drag/burlesque -> Theater, trivia/poker -> Games, dance parties -> Dance, latin night -> Dance |
| Community | Every event reclassifies to actual type (yoga -> Fitness, hike -> Outdoors, concert -> Music, commission meeting -> Civic, dance recital -> Theater) |
| Family | Storytime -> Words, LEGO builds -> Workshops, Sky Zone/gymnastics/skating -> Fitness. Audience captured by audience tags. |
| Recreation | Open gym/pickleball -> Fitness, board games -> Games, spectator sports -> Sports |
| Wellness | Meditation/yoga -> Fitness (at gym/studio) or Support (at spiritual/medical center), health talks -> Education or Support |
| Fitness (duplicate of exercise) | Merged into single Fitness category |

## Genres (per-category)

Genres are scoped to their category. `Music:jazz` and `Dance:jazz` are different things, both valid. The category provides the frame that disambiguates.

A genre answers "what flavor of [category]?" — not "what format is it?" Format-like values (workshop, seminar, lecture, networking, meetup) migrate to tags.

**Implementation prerequisite:** A comprehensive genre migration mapping document must be produced before migration, mapping every one of the 450+ current genre normalization entries to their new category-scoped home. Unmapped genres = data loss.

### Genre lists by category

**Music:** rock, indie, hip-hop, r-and-b, jazz, blues, country, folk, electronic, pop, soul, metal, punk, latin, classical, alternative, singer-songwriter, house, reggae, gospel, opera, world, jam, cover, edm, funk, bluegrass, ambient, dj, karaoke, vinyl, listening-party

**Film:** action, comedy, documentary, drama, horror, sci-fi, thriller, animation, romance, classic, foreign, indie

**Comedy:** standup, improv, sketch, open-mic, roast, storytelling

**Theater:** musical, drama, immersive, puppet, burlesque, drag, spoken-word, ballet, shakespeare

**Art:** exhibition, sculpture, photography, painting, mixed-media, digital, mural, textile, ceramics, printmaking

**Dance:** salsa, swing, bachata, line-dancing, ballroom, hip-hop, contemporary, folk, latin, afrocentric, social-dance, ballet, jazz, tap, modern

**Sports:** baseball, basketball, football, soccer, hockey, mma, racing, tennis, golf, lacrosse, rugby, motorsports, wrestling, boxing, cricket, esports, volleyball, roller-derby, nascar, dirt-track, gymnastics, figure-skating

**Fitness:** yoga, running, cycling, swimming, crossfit, pilates, climbing, martial-arts, gymnastics, barre, hiit, dance-fitness, aerial

**Outdoors:** hiking, paddling, birding, fishing, camping, gardening, foraging, stargazing, trail-running, rock-climbing, nature

**Games:** trivia, bingo, board-games, poker, dnd, warhammer, bar-games, escape-room, esports, card-games, pub-quiz, game-night

**Food & Drink:** tasting, wine, beer, cocktails, cooking-class, pop-up, food-festival, brunch, seafood, southern, mexican, italian, asian, coffee, farmers-market, happy-hour

**Conventions:** fan, tech, professional, trade, hobby, academic

**Workshops:** pottery, painting, blacksmithing, woodworking, jewelry, textiles, glassblowing, printmaking, floral, candle-making, resin, crafts

**Education:** seminar, lecture, certification, language, career, medical, technology, financial, science

**Words:** book-club, reading, signing, poetry, zine, literary-festival, storytime, spoken-word

**Volunteer:** food-bank, habitat, cleanup, mentoring, animal-shelter, tutoring, tree-planting, meal-delivery

**Civic:** legislation, town-hall, public-comment, advocacy, organizing, voter-registration, commission

**Support:** recovery, grief, caregiver, chronic-illness, mental-health, peer-support, meditation

**Religious:** worship, prayer, bible-study, interfaith, revival, choir, ministry

## Tags (cross-cutting attributes)

### Audience (first-class, drives feed filtering)

| Tag | Age Range | Default Feed Behavior |
|---|---|---|
| toddler | 0-3 | Hidden — Family portal / opt-in |
| preschool | 3-5 | Hidden — Family portal / opt-in |
| kids | 6-11 | Hidden — Family portal / opt-in |
| teen | 12-17 | Hidden — Family portal / opt-in |
| (none) | General / all ages | **Shown by default** |
| 18+ | 18+ | Hidden — explicit only (see below) |
| 21+ | 21+ | Hidden — explicit only (see below) |

**Default anonymous feed = General audience only.** No kid-specific content, no age-restricted content, no Support category. Logged-in users unlock relevant bands based on preferences. Portals override defaults (Family portal shows kid content by default, excludes 21+).

**Events can have multiple audience tags.** A "family day" at a museum gets toddler + preschool + kids + teen. Filtering shows events matching ANY of the user's selected bands.

**Critical: venue-inferred vs event-explicit age gating.** Only **event-explicit** 21+/18+ tags gate content from the anonymous feed. Venue-inferred 21+ (bar, nightclub) becomes a soft label displayed on the event card, NOT a feed gate. This prevents trivia nights, pub quizzes, open mics, and board game nights at bars from being hidden — these are effectively all-ages activities that happen to be at 21+ venues. Without this distinction, the data audit shows ~38% of events would be hidden from anonymous users, destroying the feed.

**Audience assignment:** Per-event is the source of truth. Venue type is an inference hint for soft labeling (bar -> "21+ venue" label). Crawlers can set explicit age gates. LLM fallback for ambiguous cases.

**Support category suppression:** Support is suppressed from all portal feeds by default. Visible only in HelpATL (Civic portal) and when explicitly enabled in user preferences. This is content routing, not hiding — recovery meetings belong in HelpATL, not alongside tonight's music shows. A hotel concierge portal must never surface AA meetings to guests.

### Vibe tags
date-night, chill, high-energy, intimate, rowdy

### Format tags
live, outdoor, indoor, virtual, recurring, one-night-only, opening-night, closing-night, seasonal, holiday

### Access tags
free, ticketed, rsvp-required, sold-out, limited-seating, accessible, all-ages, family-friendly

### Source tags
local-artist, touring, debut, album-release

## Derived attributes

Extracted during classification in the same pipeline pass.

### High value (first-class columns)

| Attribute | Type | Derivation |
|---|---|---|
| **duration** | short (<1hr) / medium (1-3hr) / half-day / full-day / multi-day | Start/end times when available, LLM estimate from description, source-level defaults |
| **cost_tier** | free / $ / $$ / $$$ | Price field when available, LLM from description, venue-type hints |
| **skill_level** | beginner / intermediate / advanced / all-levels | Keywords ("intro", "level 1", "all levels"), LLM for ambiguous |
| **booking_required** | boolean | Keywords ("RSVP", "register", "tickets required"), ticket URL presence |
| **indoor_outdoor** | indoor / outdoor / both | Venue type, description keywords, LLM fallback |

### Medium value (JSONB `derived_attributes` column)

| Attribute | Type | Derivation |
|---|---|---|
| **social_format** | solo-friendly / couples / group / spectator | Event type hints, LLM inference |
| **language** | ISO language code(s) | Title/description language detection |
| **weather_dependent** | boolean | Indoor/outdoor + "rain or shine" / "weather permitting" keywords |

## Significance scoring

The classification pipeline outputs raw significance signals. A separate scoring layer (per-portal) consumes them to determine featuring.

### Pipeline outputs

- `significance`: low | medium | high (LLM estimate based on overall read of the event)
- `significance_signals[]`: discrete flags extracted from the event:
  - `touring` — nationally/internationally touring act
  - `large_venue` — venue capacity above threshold
  - `festival` — multi-act, multi-day, or large-scale event
  - `limited_run` — one night only, closing weekend, final performance
  - `opening` — opening night, premiere, grand opening, first annual
  - `high_price` — cost tier $$$ suggests premium event
  - `known_name` — LLM recognizes performer/org as notable. **Lowest-confidence signal** — supplement with external validation (Spotify monthly listeners, Wikipedia existence) before relying on this for B2B.
  - `championship` — playoff, championship, rivalry, final

### Scoring layer (separate system, per-portal)

- Consumes significance + signals + portal context
- Produces: `featured_score` (continuous)
- Portal editors can pin/boost/override
- What counts as "tentpole" varies by portal: main feed cares about venue size and artist fame; Arts portal cares about opening nights and visiting exhibitions; Family cares about seasonal festivals
- **Note:** The per-portal scoring layer is a hard dependency for B2B value (FORTH concierge). Raw significance signals in the DB are not demo-able until this layer exists.

## Classification engine

### Architecture: Hybrid (rules + LLM)

```
Event input (title, description, venue_type, source metadata)
    |
    v
[Source-level defaults] — highest confidence, no further classification needed
    |-- Painting With a Twist (source 554) -> Workshops
    |-- AMC theaters -> Film
    |-- Callanwolde (source 809) -> check title for class vs exhibition
    |-- Spruill Center (source 808) -> Workshops
    |-- theCoderSchool (source 1318) -> Education, genre=technology
    |
    v
[Rules layer] — fast, deterministic, handles ~70% of remaining events
    |-- Venue type -> category hints (cinema -> Film, stadium -> Sports)
    |-- Title keyword patterns with WORD-BOUNDARY matching
    |-- Per-category genre scoping
    |-- Confidence score output
    |
    v
Confidence >= threshold? ──yes──> [Validation layer]
    |
    no
    |
    v
[LLM layer] — accurate, handles ambiguous ~30%
    |-- Runs async during ingestion (not at query time)
    |-- Input: title + description + venue_type + source metadata
    |-- NOT artist bios (enrichment data, not classification data)
    |-- Prompt includes: 19 categories, genre lists, audience bands, derived attributes
    |-- Returns: category, genres[], audience, derived attributes, significance, confidence
    |-- Cost model: ~30% of ~1000 events/day = ~300 LLM calls/day
    |-- Scales to ~1000 calls/day at 3 cities — validate cost model before multi-city expansion
    |
    v
[Validation layer] — catches conflicts
    |-- Genre must belong to assigned category — cross-category genres SILENTLY STRIPPED, not queued
    |-- True ambiguities (no confident category) sent to review queue
    |-- Audience + venue conflicts logged as warnings (kids event at 21+ venue)
    |-- Significance signals cross-checked against category
    |-- Auto-resolution fallback: if review queue > 50/day, strip conflicting data and accept category
```

### Confidence threshold

The threshold for rules-layer-to-LLM routing is the most important parameter in the system. Initial value: **0.7** (calibrated against a golden test set of 200 manually classified events). Tuning plan:

1. Log confidence scores for all events during first 2 weeks
2. Sample accuracy at 0.6, 0.7, 0.8 thresholds
3. Adjust to minimize total error (rules misclassification + LLM cost)
4. Re-evaluate quarterly as new sources are added

### Key rules for the rules layer

1. **Word-boundary matching** for all keyword patterns. No more substring contamination ("BlazeSports" != "esports", "about" != "bout").
2. **Title-only for genre inference** in music category. Artist bios (Spotify, Wikipedia) are enrichment data — they describe the artist's career, not this specific event. Only use title + explicitly provided genre metadata from the source.
3. **Per-category genre scoping.** A genre pattern can only fire within its assigned category. No cross-contamination between music genres and sports genres.
4. **Venue type as hint, not override.** Venue type suggests a default category but individual events override. A food festival at a brewery is Food & Drink, not Music.
5. **Source-level defaults with event-level override.** AMC events default to Film, but a special live event at AMC could be Music or Comedy.
6. **Description provenance tracking.** Distinguish between "event description from the source" and "enrichment description from Spotify/Wikipedia/TMDB." Only the former is classification input.

### LLM prompt design

The LLM receives:
- Event title
- Event description (truncated to relevant portion, excluding enrichment bios)
- Venue name and type
- Source name
- The full taxonomy (19 categories with descriptions, genre lists, audience bands)
- Derived attribute definitions

It returns a structured JSON:
```json
{
  "category": "workshops",
  "genres": ["pottery"],
  "audience": "general",
  "duration": "medium",
  "cost_tier": "$",
  "skill_level": "beginner",
  "booking_required": true,
  "indoor_outdoor": "indoor",
  "social_format": "group",
  "weather_dependent": false,
  "significance": "low",
  "significance_signals": [],
  "confidence": 0.92
}
```

**Prompt versioning:** Prompts are versioned and stored alongside a golden test set of 200 manually classified events. Any prompt change must pass the golden set at >= 90% accuracy before deployment. The `classification_prompt_version` is stored on each event record for auditability.

## Migration strategy

### Phased rollout (not single cutover)

The migration MUST be phased to avoid breaking the live system. Crawlers need new categories to exist before they can emit them, but old categories must remain until all queries are updated.

**Phase 1: Expand** — Add new category values alongside existing ones. Add `legacy_category_id` column to preserve rollback capability. Add derived attribute columns (high-value as first-class, medium-value as JSONB). Add `classification_prompt_version` column.

**Phase 2: Dual-write** — Deploy updated crawlers that emit new categories. Old crawlers continue working with old values. Both old and new category values coexist in the database.

**Phase 3: Backfill** — Run all active/future events through new classification pipeline. Reclassify dissolved categories. Produce genre migration mapping. Validate with spot checks per category (minimum 20 events per category manually reviewed).

**Phase 4: Switch** — Update all API routes, feed sections, portal queries, search constants, category-config, map pin colors. Update `nightlife_mode` compound filter. Update Family portal from category-based to audience-tag-based filtering. Rebuild search index / materialized views.

**Phase 5: Cleanup** — Remove old category values from categories table. Drop `legacy_category_id` after 30-day soak period. Remove dead code paths.

### Database changes

- Add new category values: dance, games, workshops, education, words, conventions, support, religious
- Add `legacy_category_id` column (text, nullable) for rollback
- Merge exercise + fitness into single `fitness` category
- Add first-class columns: duration (enum), cost_tier (enum), skill_level (enum), booking_required (boolean), indoor_outdoor (enum)
- Add JSONB column: `derived_attributes` (social_format, language, weather_dependent)
- Add significance columns: significance (enum), significance_signals (text[])
- Add `classification_prompt_version` (text)
- Migrate genre arrays: remove format-like genres (workshop, seminar, lecture, networking, meetup, activism, cultural, volunteer, recovery), move to tags

### Genre migration mapping (prerequisite)

Every current genre normalization entry (450+) must be mapped to its new category-scoped home. Key migrations:

| Current genre | Current category | New category | New genre |
|---|---|---|---|
| karaoke | nightlife | music | karaoke |
| dj | nightlife | music | dj |
| drag | nightlife | theater | drag |
| burlesque | nightlife | theater | burlesque |
| trivia | nightlife | games | trivia |
| poker | nightlife | games | poker |
| line-dancing | nightlife | dance | line-dancing |
| latin-night | nightlife | dance | latin |
| science | learning | education | science |
| storytime | family | words | storytime |
| crafts | various | workshops | crafts |
| workshop | learning | (tag: format) | — |
| seminar | learning | (tag: format) | — |
| activism | community/civic | (tag: format) | — |
| volunteer | volunteer | (tag: format) | — |
| recovery | support_group | support | recovery |
| meditation | wellness | support | meditation |
| happy-hour | food_drink | food_drink | happy-hour |

Full mapping document to be produced during Phase 2.

### Source-level reclassification

High-volume sources that need explicit defaults to avoid LLM waste:

| Source | Events | Current | New Default |
|---|---|---|---|
| Painting With a Twist (#554) | ~651 | art | workshops |
| Callanwolde (#809) | ~661 | learning | workshops (classes) / art (exhibitions) |
| Spruill Center (#808) | ~281 | learning | workshops |
| theCoderSchool (#1318) | ~345 | learning | education |
| Gwinnett School of Dance | ~422 | dance | dance |
| BlazeSports America | ~174 | exercise | fitness (with genre fix) |
| Stone Mountain Park | ~57 attractions | outdoors | strip attractions -> venue attributes |

### Web app changes

- Update category filter UI with 19 categories
- Update category-config.ts colors and labels
- Update search-constants.ts
- Update map pin color groupings
- Add audience-based feed filtering (anonymous = general only, Support suppressed)
- Implement venue-inferred vs event-explicit 21+ distinction
- Update portal taxonomy to reference new categories
- Update Family portal queries from category-based to audience-tag-based
- Rebuild nightlife_mode compound filter as time + venue-type + vibe filter
- Rebuild search index / materialized views

### Crawler changes

- Replace tag_inference.py genre inference with new hybrid engine
- Remove legacy category aliases from event-taxonomy.ts
- Update genre_normalize.py with per-category genre lists
- Add LLM classification call for low-confidence events
- Add validation layer with silent cross-category genre stripping
- Track description provenance (source description vs enrichment bio)
- Strip theme park attractions from event pipeline, route to venue attributes
- Fix word-boundary matching for all keyword patterns

## Out of scope

- Feed ranking algorithm changes (beyond audience gating)
- Portal-specific scoring weights (noted as hard dependency for B2B)
- Editorial featuring UI
- Personalization / user preference UI
- Historical event reclassification (only active/future events)
- Human review queue UI (auto-resolution fallback covers this for v1)
