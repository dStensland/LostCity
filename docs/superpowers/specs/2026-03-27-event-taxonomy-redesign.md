# Event Taxonomy Redesign

## Problem

The current event categorization system conflates four different questions into one field: what kind of thing is it, who is it for, where does it happen, and what source did it come from. This produces systemic misclassification — 500+ upcoming events are miscategorized from bugs like substring matching ("BlazeSports" triggers "esports"), artist bio contamination (Spotify bios adding false genres), and catch-all categories ("community", "nightlife", "words") that have no coherent definition.

19 current categories include fake categories that describe context rather than content (nightlife = time + venue, outdoors = location, family = audience, community = nothing). Meanwhile real kinds of things have no home — games, workshops, dance, conventions all get shoved into wrong buckets.

## Design

### Three-axis taxonomy

| Axis | Answers | Example |
|---|---|---|
| **Category** (18) | What kind of thing is this? | Music, Games, Dance |
| **Genre** (per-category) | What flavor of that thing? | Music:jazz, Games:trivia, Dance:salsa |
| **Tags** (cross-cutting) | What else should I know? | free, outdoor, date-night, 21+ |

### Categories (18)

**Performance & Entertainment**

| Category | Covers |
|---|---|
| Music | Concerts, DJ sets, live bands, karaoke, listening sessions |
| Film | Screenings, premieres, watch parties (fallback when subject unclear) |
| Comedy | Standup, improv, sketch |
| Theater | Plays, musicals, drag, burlesque, puppetry, immersive, dance performances (watching) |
| Art | Exhibitions, galleries, installations, art fairs |
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
| Workshops | Pottery, paint-and-sip, blacksmithing, cooking, crafts, jewelry — make/do something hands-on |
| Education | Seminars, ESL, career development, medical lectures, tech classes — learn something |
| Books | Book clubs, readings, signings, literary events |

**Civic & Service**

| Category | Covers |
|---|---|
| Volunteer | Service shifts, food pantries, tree planting, meal delivery |
| Civic | Government sessions, political organizing, public meetings |
| Support | Recovery meetings, support groups |

### Dance rule

The same physical activity (dance) splits across three categories based on context:

- **Doing it for fun** -> Dance (salsa night, kids' ballet class, line dancing)
- **Doing it for exercise** -> Fitness (Zumba, dance cardio)
- **Watching it on stage** -> Theater (ballet performance, dance recital)

### Watch party rule

Categorize by the subject being watched, with Film as fallback:

- Drag Race viewing party -> Theater (drag is theater)
- Super Bowl watch party -> Sports
- Random movie night at a bar -> Film

### Theme park attractions

Not events. Convert to venue attributes (same pattern as specials). Strip from event feed, surface on venue detail pages. Includes: Dinotorium, 4D Theater, Adventure Outpost, and similar permanent attractions.

### Dissolved categories

| Old Category | Reclassification |
|---|---|
| Nightlife | DJs/karaoke -> Music, drag/burlesque -> Theater, trivia/poker -> Games, dance parties -> Dance |
| Community | Every event reclassifies to actual type (yoga -> Fitness, hike -> Outdoors, concert -> Music, commission meeting -> Civic) |
| Words | Book clubs -> Books, crochet/jewelry -> Workshops, trivia -> Games, tech help/Medicare talks -> Education |
| Family | Storytime -> Books, LEGO builds -> Workshops, Sky Zone/gymnastics/skating -> Fitness. Audience captured by audience tags. |
| Recreation | Open gym/pickleball -> Fitness, board games -> Games |
| Wellness | Meditation/yoga -> Fitness, health talks -> Education or Support |
| Fitness (duplicate of exercise) | Merged into single Fitness category |

## Genres (per-category)

Genres are scoped to their category. `Music:jazz` and `Dance:jazz` are different things, both valid. The category provides the frame that disambiguates.

A genre answers "what flavor of [category]?" — not "what format is it?" Format-like values (workshop, seminar, lecture, networking, meetup) migrate to tags.

### Genre lists by category

**Music:** rock, indie, hip-hop, r-and-b, jazz, blues, country, folk, electronic, pop, soul, metal, punk, latin, classical, alternative, singer-songwriter, house, reggae, gospel, opera, world, jam, cover, edm, funk, bluegrass, ambient

**Film:** action, comedy, documentary, drama, horror, sci-fi, thriller, animation, romance, classic, foreign, indie

**Comedy:** standup, improv, sketch, open-mic, roast, storytelling

**Theater:** musical, drama, immersive, puppet, burlesque, drag, spoken-word, ballet, shakespeare

**Art:** exhibition, sculpture, photography, painting, mixed-media, digital, mural, textile, ceramics, printmaking

**Dance:** salsa, swing, bachata, line-dancing, ballroom, hip-hop, contemporary, folk, latin, afrocentric, social-dance, ballet, jazz, tap, modern

**Sports:** baseball, basketball, football, soccer, hockey, mma, racing, tennis, golf, lacrosse, rugby, motorsports, wrestling, boxing, cricket, esports

**Fitness:** yoga, running, cycling, swimming, crossfit, pilates, climbing, martial-arts, gymnastics, barre, hiit, dance-fitness

**Outdoors:** hiking, paddling, birding, fishing, camping, gardening, foraging, stargazing, trail-running, rock-climbing

**Games:** trivia, bingo, board-games, poker, dnd, warhammer, bar-games, escape-room, esports, card-games, pub-quiz

**Food & Drink:** tasting, wine, beer, cocktails, cooking-class, pop-up, food-festival, brunch, seafood, southern, mexican, italian, asian, coffee, farmers-market

**Conventions:** fan, tech, professional, trade, hobby, academic

**Workshops:** pottery, painting, blacksmithing, woodworking, jewelry, textiles, glassblowing, printmaking, floral, candle-making, resin

**Education:** seminar, lecture, certification, language, career, medical, technology, financial

**Books:** book-club, reading, signing, poetry, zine, literary-festival

**Volunteer:** food-bank, habitat, cleanup, mentoring, animal-shelter, tutoring, tree-planting, meal-delivery

**Civic:** legislation, town-hall, public-comment, advocacy, organizing, voter-registration, commission

**Support:** recovery, grief, caregiver, chronic-illness, mental-health, peer-support

## Tags (cross-cutting attributes)

### Audience (first-class, drives feed filtering)

| Tag | Age Range | Default Feed Behavior |
|---|---|---|
| toddler | 0-3 | Hidden — Family portal / opt-in |
| preschool | 3-5 | Hidden — Family portal / opt-in |
| kids | 6-11 | Hidden — Family portal / opt-in |
| teen | 12-17 | Hidden — Family portal / opt-in |
| (none) | General / all ages | Shown by default |
| 18+ | 18+ | Hidden — opt-in |
| 21+ | 21+ | Hidden — opt-in |

**Default anonymous feed = General audience only.** No kid-specific content, no 21+ content. Logged-in users unlock relevant bands based on preferences. Portals override defaults (Family portal shows kid content by default, excludes 21+).

**Audience assignment:** Per-event is the source of truth. Venue type is an inference hint (bar -> 21+ unless overridden, library children's room -> kids unless overridden).

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

### High value

| Attribute | Type | Derivation |
|---|---|---|
| **duration** | short (<1hr) / medium (1-3hr) / half-day / full-day / multi-day | Start/end times when available, LLM estimate from description, source-level defaults |
| **cost_tier** | free / $ / $$ / $$$ | Price field when available, LLM from description, venue-type hints |
| **skill_level** | beginner / intermediate / advanced / all-levels | Keywords ("intro", "level 1", "all levels"), LLM for ambiguous |
| **booking_required** | boolean | Keywords ("RSVP", "register", "tickets required"), ticket URL presence |
| **indoor_outdoor** | indoor / outdoor / both | Venue type, description keywords, LLM fallback |

### Medium value

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
  - `known_name` — LLM recognizes performer/org as notable
  - `championship` — playoff, championship, rivalry, final

### Scoring layer (separate system, per-portal)

- Consumes significance + signals + portal context
- Produces: `featured_score` (continuous)
- Portal editors can pin/boost/override
- What counts as "tentpole" varies by portal: main feed cares about venue size and artist fame; Arts portal cares about opening nights and visiting exhibitions; Family cares about seasonal festivals

## Classification engine

### Architecture: Hybrid (rules + LLM)

```
Event input (title, description, venue_type, source metadata)
    |
    v
[Rules layer] — fast, deterministic, handles ~70% of events
    |-- Venue type -> category hints (cinema -> Film, stadium -> Sports)
    |-- Source-level defaults (AMC -> Film, Callanwolde -> Workshops)
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
    |-- Prompt includes: 18 categories, genre lists, audience bands, derived attributes
    |-- Returns: category, genres[], audience, derived attributes, significance, confidence
    |-- Cost model: ~30% of ~1000 events/day = ~300 LLM calls/day
    |
    v
[Validation layer] — catches conflicts
    |-- Genre must belong to assigned category
    |-- Category + genre conflicts flagged (category=Music + genre=ballet)
    |-- Audience + venue conflicts flagged (kids event at 21+ venue)
    |-- Significance signals cross-checked against category
    |-- Invalid combinations rejected, sent to review queue
```

### Key rules for the rules layer

1. **Word-boundary matching** for all keyword patterns. No more substring contamination ("BlazeSports" != "esports", "about" != "bout").
2. **Title-only for genre inference** in music category. Artist bios (Spotify, Wikipedia) are enrichment data — they describe the artist's career, not this specific event. Only use title + explicitly provided genre metadata from the source.
3. **Per-category genre scoping.** A genre pattern can only fire within its assigned category. No cross-contamination between music genres and sports genres.
4. **Venue type as hint, not override.** Venue type suggests a default category but individual events override. A food festival at a brewery is Food & Drink, not Music.
5. **Source-level defaults with event-level override.** AMC events default to Film, but a special live event at AMC could be Music or Comedy.

### LLM prompt design

The LLM receives:
- Event title
- Event description (truncated to relevant portion, excluding enrichment bios)
- Venue name and type
- Source name
- The full taxonomy (18 categories with descriptions, genre lists, audience bands)
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

## Migration strategy

### Database changes

- Add new category values to categories table (dance, games, workshops, education, books, conventions, support)
- Remove dissolved categories (nightlife, community, words, recreation, wellness)
- Rename fitness/exercise to single `fitness` category
- Add derived attribute columns to events table: duration, cost_tier, skill_level, booking_required, indoor_outdoor, social_format, language, weather_dependent
- Add significance columns: significance (enum), significance_signals (text[])
- Migrate genre arrays: remove format-like genres (workshop, seminar, lecture, networking, meetup, activism, cultural, volunteer, recovery), move to tags

### Reclassification

- Run all active events through new classification pipeline
- Reclassify dissolved categories using the rules in the "Dissolved categories" section
- Validate with spot checks per category

### Web app changes

- Update category filter UI with new 18 categories
- Update category-config.ts colors and labels
- Update search-constants.ts
- Update map pin color groupings
- Add audience-based feed filtering (anonymous = general only)
- Update portal taxonomy to reference new categories

### Crawler changes

- Replace tag_inference.py genre inference with new hybrid engine
- Remove legacy category aliases from event-taxonomy.ts
- Update genre_normalize.py with per-category genre lists
- Add LLM classification call for low-confidence events
- Add validation layer
- Strip theme park attractions from event pipeline, route to venue attributes

## Out of scope

- Feed ranking algorithm changes (beyond audience gating)
- Portal-specific scoring weights
- Editorial featuring UI
- Personalization / user preference UI
- Historical event reclassification (only active/future events)
