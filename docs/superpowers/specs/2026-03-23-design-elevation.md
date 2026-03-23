# Atlanta Portal Design Elevation

**Date**: 2026-03-23
**Status**: Review
**Goal**: Transform the Atlanta portal from "functional event app" to "Atlanta's cultural companion" through tiered content hierarchy, editorial voice, and emotional design moments.

## Context

The Atlanta portal has a solid visual foundation — the token system, component library, and cinematic minimalism aesthetic are working. But the content presentation is flat (a 50,000-person festival looks identical to Tuesday trivia) and the emotional register doesn't create a feeling about going out.

This spec addresses three interconnected gaps:
1. Content has no visual hierarchy — everything gets the same card treatment
2. The feed has no voice — it lists events but doesn't editorialize
3. The app informs but doesn't create belonging, discovery, or anticipation

## Design Principles

1. **Cultural identity over software aesthetics.** Lost City should feel like Atlanta has a voice, not like a SaaS dashboard. The design *is* the brand.
2. **Visual weight matches significance.** Big things look big. The scoring data already exists — surface it visually.
3. **Template-driven editorial, never AI-generated.** All editorial voice comes from structured data assembled into templates. No LLM-generated blurbs. The editorial_mentions table (193 rows from Eater, Infatuation, Rough Draft, Atlanta Eats) provides real press quotes. No hallucination risk.
4. **Belonging first, discovery second, urgency last.** The emotional priority mirrors the north star: community → curiosity → FOMO.
5. **Drift fixes are absorbed, not separate.** Every component rebuilt as part of this elevation uses the Pencil design spec. The audit's 20+ drift issues disappear as a side effect.

## Part 1: Tiered Content Hierarchy

### Three Card Tiers

Events and venues get visual weight proportional to their significance. Tier assignment is driven by existing scoring data, editorial signal, and social signal.

**Tier 1: Hero Card**
- **Trigger**: Intrinsic quality score (see below) qualifies as hero, OR `is_tentpole = true`, OR `festival_type IS NOT NULL`
- **Visual treatment**: Full-width image with gradient overlay. Large title (heading/2xl, 24px). Contextual label (e.g., "FESTIVAL" or "TENTPOLE" in gold mono). Venue + time + price below title. Optional editorial callout beneath.
- **Frequency**: Max 1 per feed section. If no event qualifies, skip — never force a hero.
- **Size**: Full content width (~768px in feed column), height ~200-240px with image

**Tier 2: Featured Card**
- **Trigger**: Intrinsic quality score qualifies as featured, OR friends going > 0 (personalized), OR venue has editorial_mention
- **Visual treatment**: Existing FeaturedCard pattern but corrected to Pencil spec — 288px wide, 12px radius, 128px image, 12px padding. Displayed in horizontal carousel (2-4 cards).
- **Frequency**: 2-4 per feed section
- **Size**: 288x~220px

**Tier 3: Standard Row**
- **Trigger**: Everything else
- **Visual treatment**: Compact row — no image rail. Event name + venue + time on one line, badges on right. Scannable, dense, efficient. Accent left-border color by category.
- **Frequency**: Unlimited, shows remaining events
- **Size**: Full-width, ~48-56px height

### Dual-Path Tier Assignment

Tier assignment uses TWO score paths to avoid the cold-start problem (anonymous/new users seeing 100% standard rows):

**Path 1: Intrinsic Quality Score (all users)**
Objective signals that don't require user data:
- `is_tentpole` (+40, already in scoring)
- `is_featured` (+20, already in scoring)
- `festival_type IS NOT NULL` (+30)
- Venue has `editorial_mentions` (+15)
- Event has image (+10)
- Source quality tier (+5/10/15 based on source reliability)

Thresholds: intrinsic >= 30 → Hero eligible, intrinsic >= 15 → Featured eligible.

**Path 2: Personalized Score (authenticated users)**
Social/preference signals layered on top:
- Friends going (+20 per friend, cap 60)
- Followed venue (+15)
- Category match (+10)

Either path can promote a tier. An event can be Hero via intrinsic quality alone (a festival with press mentions) or via social signal (3 friends going to a bar trivia).

```
function getCardTier(event, user):
  intrinsic = computeIntrinsicScore(event)
  personal = user ? computePersonalScore(event, user) : 0

  if intrinsic >= 30 OR event.is_tentpole OR event.is_festival:
    return HERO
  if intrinsic >= 15 OR personal >= 20 OR event.friends_going > 0:
    return FEATURED
  return STANDARD
```

### Data Sources

- `is_tentpole`, `is_featured` — exist on events table, already used in scoring
- `festival_type` — exists on events table
- `editorial_mentions` — 193 rows, keyed on `venue_id`. **NOT currently joined in feed queries** — needs to be added as a venue-level join (event → venue → editorial_mentions). The signal applies to the venue, not the event — a Tuesday trivia at an Eater-reviewed venue gets a Featured bump, not a Hero bump.
- `friends_going` — from RSVP + hangs social layer (exists)
- `event.image_url` — exists
- `source.quality_tier` — does not exist as a field, but source reliability can be inferred from source type and historical data quality. Can be a simple lookup table added later; omit from v1 and use image presence as the proxy.

### New Components Needed

**HeroCard** — New component. Full-width image card with gradient overlay, large title, contextual label, metadata. Not the same as DetailHero (which is for detail pages). HeroCard is a feed-level component.

**StandardRow** — New component. Compact single-line event row. Simpler than EventCard — no image rail, no multi-line layout. Just: accent border + title + venue/time + badge.

**FeaturedCard corrections** — Existing component, fix to match Pencil spec (288px width, 12px radius, 128px image height, 12px padding, body font for metadata).

### Feed Section Changes

Each feed section (Tonight, Coming Up, Trending, etc.) renders its events through the tier system:
1. If any event qualifies as Hero, render it first as a HeroCard
2. Featured events render in a carousel row of FeaturedCards
3. Remaining events render as StandardRows
4. "+N more →" link at bottom if truncated

This replaces the current approach where sections either show all carousels or all list rows.

## Part 2: Editorial Voice Layer

### Three Voice Patterns

All patterns are template-driven, assembled from structured data. No generative AI.

**Pattern 1: Contextual Callout**

A gold-accented editorial aside that appears above hero events or at the top of time-based sections.

Templates (priority order — first match wins per section):
1. `"[City]'s biggest [category] [event_type] starts [timing]."` — Trigger: is_tentpole or festival in section
2. `"[Holiday/occasion] [timing]. [Count] events celebrating."` — Trigger: known holiday/occasion within 2 days
3. `"[Count] [category] events [timing_period]."` — Trigger: category count > 10 in section
4. Weather template — **deferred to v2**. Requires weather-to-occasion mapping table not yet built.

Data sources: event scoring, category counts, occasion taxonomy, calendar awareness.

Visual: Left border accent (gold), subtle gold-tinted background, 14-15px body text. The callout *replaces* a generic section header when triggered.

Trigger: Only appears when there's genuinely notable context. Max 1 per feed section. If no template condition is met, the section renders with a standard FeedSectionHeader.

**Pattern 2: Press Attribution**

A short quote from a real publication, displayed on venue cards or event cards that have editorial_mentions.

Format: `"[snippet]" — [publication_name]`

Data source: `editorial_mentions` table (193 rows across Eater Atlanta, The Infatuation, Rough Draft Atlanta, Atlanta Eats). The `snippet` field already contains extracted quotes.

Visual: Small italic text below the venue/event name. Quote mark icon. Muted color. Subtle — adds credibility without dominating the card.

Trigger: Only shown when an `editorial_mention` exists for the venue. Never fabricated.

**Pattern 3: Social Proof**

Friend-aware context shown on events and venues.

Templates:
- `"[Friend] and [N] friends are going"` (with friend avatar stack)
- `"[Friend] was here [timeago]"` (on venue cards)
- `"You went to [N] events here this month"` (on venue cards, personal)
- `"[N] people going"` (generic, when no friend overlap)

Data source: RSVPs, hangs, friend graph (all exist in the social layer).

Visual: Small avatar stack (3-4 overlapping 24px circles) + text. Appears as a row within the card, below the primary metadata.

Trigger: Only shown when there's actual social data. No friends going = no social proof shown (don't fake it with "0 people going").

### Editorial Component

**EditorialCallout** — New component. Gold left-border card with template-rendered text. Takes a `template` string and `data` object, renders the assembled sentence. Used in feed sections.

**PressQuote** — New component. Inline italic quote with publication attribution. Used within EventCard and VenueCard when editorial_mentions data exists.

**SocialProofRow** — Variant of existing SocialProofStrip, adapted for inline card use (smaller, horizontal, no border). Friend avatars + text.

## Part 3: Emotional Moments

### Belonging (highest priority)

**Friend Activity Pulse**: When friends have recent activity (RSVPs, check-ins, saves), surface it contextually:
- Friend avatars appear on event cards they're attending
- "Your crew's spot" badge on venues where 3+ friends have the venue in `user_regular_spots` (query: `user_regular_spots WHERE user_id IN (friend_ids) GROUP BY venue_id HAVING COUNT(*) >= 3`)
- Gentle inline nudges: "Mike is going — join?" (only on events with friend RSVPs)

Implementation: Extend EventCard and VenueCard to accept optional `friendActivity` prop. Feed API already has `friends_going` data path.

**Scene Indicators**: Show that a venue/event has cultural weight:
- "Regular crowd" indicator on recurring events with consistent attendance
- Venue "vibe" tags surfaced from occasion taxonomy (date_night, live_music, etc.)

### Discovery (second priority)

**Rarity Signals**: Help users find things they wouldn't search for:
- "New venue" badge for places added to Lost City in last 60 days
- "Rare" indicator for events that happen less than 4x/year
- "One night only" for single-occurrence events
- "First time on Lost City" for newly crawled events

Implementation: All derivable from existing data (source.created_at, event recurrence patterns, occurrence count).

**Wildcard Section**: A single feed section that surfaces one unexpected, high-quality event outside the user's typical categories. Breaks filter bubbles. Algorithm: exclude user's top 2 categories (from `user_preferences.favorite_categories`), pick highest intrinsic-scored event with an image from remaining categories, insert after the 3rd feed section. For anonymous users, pick a random high-scoring event from a less-common category (not music, not comedy — the defaults).

### Urgency (lightest touch)

**Time-Aware Labels**: Replace static time displays with contextual language:
- "Starts in 2 hours" instead of "8:00 PM" (when < 4 hours away)
- "Happening now" with a subtle pulse indicator (when event is live)
- "Last chance" on exhibitions closing within 3 days
- "Tomorrow" instead of showing the date when it's tomorrow

Implementation: Client-side time formatting. No new data needed.

**Selling Fast**: Deferred to v2. Crawlers currently capture event listings but not ticket inventory or sales velocity. Would require new crawler capabilities to source this data reliably.

### Craft (polish layer)

**Staggered card animations**: Cards enter the viewport with a slight stagger (50ms between each). CSS-only, using `animation-delay` with `nth-child`. Already partially implemented with `animate-page-enter`.

**Save/bookmark animation**: When a user saves an event, the bookmark icon fills with a brief scale-up + settle animation. CSS keyframes, no JS animation library.

**Section transitions**: When scrolling past feed section headers, they get a subtle sticky treatment with a backdrop-blur underline. Already partially implemented.

**Pull-to-refresh**: Deferred. `PullToRefresh` component already exists. Skyline SVG animation is polish that can ship separately.

## Drift Fixes (absorbed into elevation)

All audit findings from the Pencil-vs-code comparison are fixed as part of rebuilding components:

| Component | Fixes Absorbed |
|-----------|---------------|
| Badge | font-bold, tracking-[1.2px], uppercase, py-1 (4px), remove border |
| FilterChip | bg-white/5 on inactive, text-soft instead of text-muted |
| FeaturedCard | w-72 (288px), rounded-xl (12px), h-32 image, p-3 padding, body font for metadata |
| EventCard | AM/PM font-bold, compact title font-semibold, compact time in body font |
| VenueCard | distance color neon-green (not cyan), description text-sm (not text-xs) |
| FeedSectionHeader | title text-xs (11px not 13px), icon 14px (not 20px) |
| DetailHero | title text-2xl (24px), rounded-xl (12px) |
| DetailStickyBar | Keep floating pill (current code) — the blur + shadow treatment works better on mobile than a flat bar. Update Pencil spec to match code. Fix: use `bg-[var(--void)]` instead of `bg-[var(--night)]/96`, keep rounded-2xl + shadow. |

## Implementation Strategy

### New Components (4)

1. **HeroCard** — Full-width image card for hero-tier events
2. **StandardRow** — Compact single-line event row for standard-tier events
3. **EditorialCallout** — Gold-bordered contextual editorial aside
4. **PressQuote** — Inline italic press attribution

### Modified Components (8+)

1. **FeaturedCard** — Fix proportions to Pencil spec
2. **Badge** — Fix weight, tracking, padding, uppercase
3. **FilterChip** — Add inactive background
4. **EventCard** — Add SocialProofRow support, fix compact variant, add friend avatars
5. **VenueCard** — Fix distance color, add PressQuote support, add friend activity
6. **FeedSectionHeader** — Fix font size, icon size
7. **DetailHero** — Fix title size, radius
8. **Feed sections** — Implement tiered rendering (hero → featured → standard)

### API Changes

1. **Feed API** — Return `card_tier` per event (hero/featured/standard) based on scoring
2. **Feed API** — Include `editorial_mentions` and `friends_going` in event/venue responses (may already be partially there)
3. **Time formatting** — Client-side utility for contextual time labels ("Starts in 2 hours")

### Design System Updates

1. Build HeroCard, StandardRow, EditorialCallout, PressQuote in Pencil
2. Update existing components in Pencil to match corrected specs
3. Rebuild Atlanta Feed page in Pencil showing the tiered layout
4. Update `web/.claude/rules/figma-design-system.md` with new components

## Success Criteria

1. A stranger looking at the Atlanta feed can immediately tell which events are the biggest deal
2. The feed feels like it's written by someone who knows Atlanta — not like a database dump
3. Friends' activity is woven naturally into the content (not a separate social tab)
4. At least 3 events/venues per feed load show editorial voice (press quote or contextual callout)
5. All component drift from the audit is resolved
6. The feed makes you want to go out — not just know what's out there

## Data Seeding (Pre-requisite)

The social layer infrastructure is built but unpopulated. Before the elevation features can be developed and tested, seed the database with realistic test data:

### Seed Requirements

**Users (10-15 test accounts):**
- Mix of active and casual users
- Each with populated `user_preferences` (favorite_categories, favorite_genres, favorite_neighborhoods)
- Realistic display names and usernames

**Friend Graph (30-40 connections):**
- 3-4 "friend groups" of 3-5 people with mutual connections
- Creates realistic "Sarah and 2 friends are going" scenarios

**RSVPs (200-300 rows):**
- Spread across 50-80 events over the next 2 weeks
- Mix of "going" and "interested" statuses
- Cluster some RSVPs (5-10 people going to the same big event)
- Include some friend-group clustering (friends going to the same events)

**Regular Spots (30-50 rows):**
- 3-5 regular spots per active test user
- Overlap some venues across friend groups (creates "crew's spot" badges)
- Mix of venue types (bars, music venues, restaurants, parks)

**Editorial Mentions — Feed Integration:**
- Add `editorial_mentions` join to the feed API (event → venue → editorial_mentions)
- No new data needed — 193 rows already exist across 139 venues

**Importance/Flagship Backfill:**
- Audit current `importance` field population
- Ensure 15-20 events in the next 2 weeks have `importance = 'flagship'` with images
- Ensure 40-60 events have `importance = 'major'` or `featured_blurb` populated

### Seed Script Location
Create: `web/scripts/seed-elevation-data.ts` — idempotent, uses service client, tagged with a seed marker so data can be cleaned up later.

## Risks

- **Editorial template quality**: Templates need to feel natural, not robotic. A bad template ("Atlanta's biggest comedy comedy starts today") is worse than no template. Need careful template authoring + data validation.
- **Social proof cold start**: Until the social layer has critical mass, social proof rows will be sparse. Graceful degradation: don't show social proof when there's no data. Never show "0 friends going."
- **Tier gaming**: If venues learn that higher scores = hero treatment, there's incentive to game scoring. Mitigated by the existing scoring algorithm being opaque and multi-factor.
- **Performance**: Adding editorial_mentions and social joins to feed queries could slow the API. Use existing data paths where possible; add joins only where needed.
- **Over-editorializing**: Too many callouts and the feed feels noisy. Cap contextual callouts at 1 per feed section, press quotes at ~30% of eligible cards.
- **Seed data realism**: Test data must feel realistic enough to validate UX decisions. Bad seed data (random RSVPs, nonsensical friend groups) will produce misleading results. Use real event IDs and plausible user behavior patterns.
- **Image coverage**: Hero tier requires images. If <30% of flagship events have images, hero cards will need a strong fallback design (gradient + icon + title, similar to DetailHero fallback mode). Run coverage audit before building.
