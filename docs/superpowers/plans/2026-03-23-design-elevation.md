# Design Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Atlanta feed from flat event listings into a culturally-voiced, visually-tiered, emotionally-engaging experience — with data seeding, API changes, new components, and drift fixes.

**Architecture:** Dual-path tier assignment (intrinsic quality + personalized signals) determines card rendering. Editorial voice via template + data assembly (no LLM). Social proof via existing RSVP/friends infrastructure. All component drift fixed as part of rebuild.

**Tech Stack:** Next.js 16, Tailwind v4, Supabase, CityPulse feed pipeline (`web/lib/city-pulse/`), Pencil MCP for design system updates

**Spec:** `docs/superpowers/specs/2026-03-23-design-elevation.md`

---

## Task 1: Data Seeding — Users, Friends, RSVPs

**Purpose:** Populate the social layer with realistic test data so social proof features can be developed and tested. Without this, friends_going is always empty.

**Files:**
- Create: `web/scripts/seed-elevation-data.ts`
- Reference: `web/lib/supabase/service.ts` (createServiceClient)
- Reference: `web/lib/types/profile.ts` (profile types)
- Reference: `web/lib/types/hangs.ts` (RSVP types)

- [ ] **Step 1: Create seed script skeleton**

Create `web/scripts/seed-elevation-data.ts` with:
- Import `createServiceClient` from `@/lib/supabase/service`
- Idempotent design: check if seed data exists before inserting (use known UUIDs)
- CLI: `npx tsx web/scripts/seed-elevation-data.ts [--clean]` (clean flag removes seeded data)
- **IMPORTANT**: Must create `auth.users` entries first via `supabase.auth.admin.createUser()` before inserting `profiles`, since `profiles.id` has a FK to `auth.users.id`. Use the admin API with known UUIDs and dummy emails (e.g., `sarahchen-seed@test.local`).

- [ ] **Step 2: Seed 12 test user profiles**

Insert into `profiles` table with fixed UUIDs (for idempotency):
```
Sarah Chen (@sarahchen) - Music, comedy, nightlife lover
Mike Johnson (@mikej) - Outdoor enthusiast, craft beer
Lisa Park (@lisapark) - Art galleries, food scene
James Williams (@jamesw) - Jazz, blues, dive bars
Ana Rodriguez (@anar) - Latin music, dance, festivals
David Kim (@davidk) - Tech events, comedy, gaming
Emma Thompson (@emmat) - Theatre, classical, museums
Chris Jackson (@chrisj) - Hip-hop, nightlife, sports bars
Maya Patel (@mayap) - Yoga, wellness, brunch
Tyler Brooks (@tylerb) - Rock, punk, indie venues
Zoe Carter (@zoec) - Photography, street art, hidden gems
Jordan Lee (@jordanl) - Food trucks, farmers markets, cooking
```

Each with `user_preferences` populated (favorite_categories, favorite_neighborhoods, favorite_genres).

- [ ] **Step 3: Seed friend connections (mutual follows)**

Insert into `user_follows` table. Create 3-4 friend groups:
- **The Night Owls**: Sarah, Mike, Lisa, James (all mutual follows)
- **The Culture Crew**: Ana, David, Emma (mutual)
- **The Explorers**: Chris, Maya, Tyler, Zoe (mutual)
- **Cross-group**: Sarah↔Ana, Mike↔Chris (bridge connections)

~35 mutual follow pairs total.

- [ ] **Step 4: Seed RSVPs across 60+ events**

Query the database for real upcoming events (next 2 weeks, Atlanta portal, with images preferably).

Insert into `event_rsvps`:
- **Big events** (festivals, tentpoles): 6-8 RSVPs each, mix of going/interested, cluster friend groups
- **Popular events** (score 60+): 3-4 RSVPs each
- **Regular events**: 1-2 RSVPs scattered
- Total: 200-250 RSVP rows across 60-80 events

Pattern: friend groups tend to RSVP together (Night Owls go to comedy + music, Culture Crew goes to galleries + theatre).

- [ ] **Step 5: Seed regular spots**

Insert into `user_regular_spots`:
- 3-5 venues per active user (8 of 12 users)
- Overlap some venues within friend groups (creates "crew's spot" badges)
- Mix: Eddie's Attic, Laughing Skull, Ponce City Market, Piedmont Park, High Museum, Blind Willie's, The Earl, Variety Playhouse, etc.

~40 rows total.

- [ ] **Step 6: Run and verify seed script**

```bash
cd web && npx tsx scripts/seed-elevation-data.ts
```

Verify:
- `SELECT COUNT(*) FROM profiles WHERE id IN (<seed-uuids>)` → 12
- `SELECT COUNT(*) FROM user_follows WHERE follower_id IN (<seed-uuids>)` → ~70 (bidirectional)
- `SELECT COUNT(*) FROM event_rsvps WHERE user_id IN (<seed-uuids>)` → 200+
- `SELECT COUNT(*) FROM user_regular_spots WHERE user_id IN (<seed-uuids>)` → ~40

- [ ] **Step 7: Commit**

```bash
git add web/scripts/seed-elevation-data.ts
git commit -m "feat: add elevation data seed script (users, friends, RSVPs, regular spots)"
```

---

## Task 2: Data Seeding — Importance Backfill + Image Audit

**Purpose:** Ensure enough events qualify for Hero and Featured tiers with images.

**Files:**
- Create: `web/scripts/audit-elevation-readiness.ts`
- Modify: Events data via Supabase (manual or script)

- [ ] **Step 1: Create readiness audit script**

Create `web/scripts/audit-elevation-readiness.ts` that reports:
```
HERO TIER READINESS:
  Events with importance='flagship': N
  Events with is_tentpole=true: N
  Events with festival_id set (linked to festival): N
  Of those, with image_url: N (N%)

FEATURED TIER READINESS:
  Events with importance='major': N
  Events with featured_blurb: N
  Venues with editorial_mentions: N
  Events at venues with editorial_mentions: N

IMAGE COVERAGE:
  Total active events (next 2 weeks): N
  With image_url: N (N%)
  With venue.image_url (fallback): N (N%)
```

- [ ] **Step 2: Run audit and assess gaps**

```bash
cd web && npx tsx scripts/audit-elevation-readiness.ts
```

If Hero tier has <10 events with images, backfill:
- Set `importance = 'flagship'` on 5-10 major upcoming events (festivals, big concerts, tentpole community events)
- Set `importance = 'major'` on 30-40 notable events (popular venues, recurring highlights)
- Ensure each has `image_url` or `venue.image_url`

- [ ] **Step 3: Commit audit script**

```bash
git add web/scripts/audit-elevation-readiness.ts
git commit -m "feat: add elevation readiness audit script"
```

---

## Task 3: Feed API — Editorial Mentions Join + Card Tier

**Purpose:** Add editorial_mentions data and card_tier assignment to the feed API response so the frontend can render tiered cards.

**Files:**
- Create: `web/lib/city-pulse/tier-assignment.ts`
- Modify: `web/lib/city-pulse/scoring.ts` (add intrinsic score function)
- Modify: `web/lib/city-pulse/section-builders.ts` (add tier to event items)
- Modify: `web/lib/city-pulse/types.ts` (add CardTier type, editorial types)
- Modify: Feed API pipeline to join editorial_mentions

- [ ] **Step 1: Add CardTier type**

In `web/lib/city-pulse/types.ts`, add:
```typescript
export type CardTier = "hero" | "featured" | "standard";

export interface EditorialMention {
  source_key: string;
  snippet: string;
  article_url: string;
  guide_name?: string;
}
```

Add `card_tier?: CardTier` and `editorial_mentions?: EditorialMention[]` to `CityPulseEventItem.event`.

Also add these fields to `FeedEventData` type in `web/components/EventCard.tsx` (they're fetched from DB but not on the type):
- `importance?: 'flagship' | 'major' | 'standard' | null`
- `is_featured?: boolean`
- `festival_id?: number | null`

**Note**: The events table has `festival_id` (FK to festivals), NOT `festival_type`. The spec incorrectly references `festival_type` — use `festival_id` throughout. An event with a `festival_id` is a festival event.

- [ ] **Step 2: Create tier assignment module**

Create `web/lib/city-pulse/tier-assignment.ts`:

```typescript
import { CardTier } from './types';

interface TierableEvent {
  is_tentpole?: boolean;
  is_featured?: boolean;
  festival_id?: number | null; // FK to festivals table — NOT festival_type
  image_url?: string | null;
  featured_blurb?: string | null;
  importance?: 'flagship' | 'major' | 'standard' | null;
  venue_has_editorial?: boolean;
  friends_going_count?: number;
}

export function computeIntrinsicScore(event: TierableEvent): number {
  let score = 0;
  if (event.is_tentpole) score += 40;
  if (event.importance === 'flagship') score += 40;
  if (event.importance === 'major') score += 20;
  if (event.is_featured || event.featured_blurb) score += 15;
  if (event.festival_id) score += 30; // linked to a festival
  if (event.venue_has_editorial) score += 15;
  if (event.image_url) score += 10;
  return score;
}

export function getCardTier(event: TierableEvent, friendsGoingCount = 0): CardTier {
  const intrinsic = computeIntrinsicScore(event);

  if (intrinsic >= 30 || event.is_tentpole || event.festival_id) {
    return 'hero';
  }
  if (intrinsic >= 15 || friendsGoingCount > 0) {
    return 'featured';
  }
  return 'standard';
}
```

- [ ] **Step 3: Write tests for tier assignment**

Create `web/lib/city-pulse/__tests__/tier-assignment.test.ts`:
- Test: festival → hero
- Test: tentpole + image → hero
- Test: editorial mention venue + image → featured
- Test: friends going → featured
- Test: plain event → standard
- Test: flagship importance → hero
- Test: no signals → standard

```bash
cd web && npx vitest run lib/city-pulse/__tests__/tier-assignment.test.ts
```

- [ ] **Step 4: Add editorial_mentions to venue data in feed queries**

The feed pipeline fetches events with a nested venue join via `EVENT_SELECT` constant. The venue select pattern is: `venue:venues(id, name, slug, neighborhood, ...)`.

**Approach: parallel query, not nested join.** PostgREST double-nested joins (event → venue → editorial_mentions) are unreliable. Instead:

1. After fetching events, collect unique `venue_id` values
2. Run a separate query: `supabase.from('editorial_mentions').select('venue_id, source_key, snippet, article_url, guide_name').in('venue_id', venueIds).limit(3)`
3. Build a lookup map: `Record<number, EditorialMention[]>`
4. Attach to events in `makeEventItem()` via the lookup

This adds one extra query but avoids nested join complexity. The editorial_mentions table is small (193 rows) so the query is fast.

Find where `EVENT_SELECT` is defined and where events are fetched. Add the parallel query in the same data-fetching step (before scoring/section building).

- [ ] **Step 5: Integrate tier assignment into section builders**

In `web/lib/city-pulse/section-builders.ts`, modify `makeEventItem()` to compute and attach `card_tier`:

```typescript
import { getCardTier } from './tier-assignment';

function makeEventItem(event, opts) {
  const friendsGoingCount = opts.friendsGoing?.length ?? 0;
  const venueHasEditorial = event.venue?.editorial_mentions?.length > 0;

  return {
    ...existingLogic,
    card_tier: getCardTier({
      ...event,
      venue_has_editorial: venueHasEditorial,
    }, friendsGoingCount),
    editorial_mentions: event.venue?.editorial_mentions ?? [],
  };
}
```

- [ ] **Step 6: Verify feed API returns card_tier**

```bash
curl -s http://localhost:3000/api/feed?portal=atlanta | jq '.sections[0].items[0].event.card_tier'
```

Should return `"hero"`, `"featured"`, or `"standard"`.

- [ ] **Step 7: Commit**

```bash
git add web/lib/city-pulse/tier-assignment.ts web/lib/city-pulse/__tests__/tier-assignment.test.ts
git add web/lib/city-pulse/types.ts web/lib/city-pulse/section-builders.ts
git commit -m "feat: add card tier assignment and editorial mentions to feed pipeline"
```

---

## Task 4: Component Drift Fixes

**Purpose:** Fix all 8 component drift issues identified in the Pencil vs. code audit. These are small, targeted changes.

**Files:**
- Modify: `web/components/ui/Badge.tsx`
- Modify: `web/components/filters/FilterChip.tsx`
- Modify: `web/components/feed/FeaturedCarousel.tsx`
- Modify: `web/components/EventCard.tsx` + `web/components/event-card/EventCardImage.tsx`
- Modify: `web/components/VenueCard.tsx`
- Modify: `web/components/feed/FeedSectionHeader.tsx`
- Modify: `web/components/detail/DetailHero.tsx`
- Modify: `web/components/detail/DetailStickyBar.tsx`

- [ ] **Step 1: Fix Badge**

In `Badge.tsx`:
- Change `font-medium` → `font-bold`
- Add `tracking-[1.2px] uppercase`
- Change `py-0.5` → `py-1` (both sizes)
- Remove `border` from base classes (design has no border on default variant)

- [ ] **Step 2: Fix FilterChip**

In `FilterChip.tsx`:
- Add `bg-white/5` to inactive state (currently transparent)
- Change inactive text from `text-[var(--muted)]` to `text-[var(--soft)]`

- [ ] **Step 3: Fix FeaturedCarousel card**

In `FeaturedCarousel.tsx`:
- Change card width `w-80` (320px) → `w-72` (288px)
- Change `rounded-2xl` → `rounded-xl` (12px)
- Change image `h-44` → `h-32` (128px)
- Change content padding `p-4` → `p-3` (12px)
- Change metadata font from `font-mono text-xs` → `text-sm` (body font, 13px)
- Change border from `border-[var(--gold)]/20` → `border-[var(--twilight)]/40`

- [ ] **Step 4: Fix EventCard**

In `EventCard.tsx` / sub-components:
- In `EventCardImage.tsx`: Change AM/PM `font-medium` → `font-bold`
- In compact variant: Change title `font-medium` → `font-semibold`
- In compact variant: Change time metadata from `font-mono` to body font

- [ ] **Step 5: Fix VenueCard**

In `VenueCard.tsx`:
- Change distance color from `text-[var(--neon-cyan)]` → `text-[var(--neon-green)]`
- Change description from `text-xs` (11px) → `text-sm` (13px)

- [ ] **Step 6: Fix FeedSectionHeader**

In `FeedSectionHeader.tsx`:
- Secondary title: Change `text-sm` (13px) → `text-xs` (11px)
- Secondary icon: Change `w-5 h-5` (20px) → `w-3.5 h-3.5` (14px)

- [ ] **Step 7: Fix DetailHero**

In `DetailHero.tsx`:
- Title: Change `text-xl sm:text-3xl` → `text-xl sm:text-2xl` (20px mobile, 24px desktop)
- Corner radius: Change `sm:rounded-lg` → `sm:rounded-xl` (12px)

- [ ] **Step 8: Fix DetailStickyBar**

In `DetailStickyBar.tsx`:
- Background: Change `bg-[var(--night)]/96` → `bg-[var(--void)]`
- Keep `rounded-2xl` and shadow (design decision: floating pill is better on mobile)

- [ ] **Step 9: Run full test suite**

```bash
cd web && npx vitest run
```

All tests should still pass. These are visual-only changes.

- [ ] **Step 10: Browser-test drift fixes**

Open `http://localhost:3000/atlanta` and verify:
- Badges look punchier (bold, tracked, uppercase)
- FeaturedCards are tighter (288px, shorter images, 12px radius)
- Feed section headers are smaller (11px mono)
- Venue distance shows in green (not cyan)

- [ ] **Step 11: Commit**

```bash
git add web/components/ui/Badge.tsx web/components/filters/FilterChip.tsx
git add web/components/feed/FeaturedCarousel.tsx web/components/EventCard.tsx
git add web/components/event-card/EventCardImage.tsx web/components/VenueCard.tsx
git add web/components/feed/FeedSectionHeader.tsx
git add web/components/detail/DetailHero.tsx web/components/detail/DetailStickyBar.tsx
git commit -m "fix: align 8 components to Pencil design spec (drift fixes)"
```

---

## Task 5: New Components — HeroCard + StandardRow

**Purpose:** Build the two new card tiers for the feed.

**Files:**
- Create: `web/components/feed/HeroCard.tsx`
- Create: `web/components/feed/StandardRow.tsx`
- Reference: `web/components/SmartImage.tsx` (for images)
- Reference: `web/components/ui/Badge.tsx`
- Reference: Design system rules (`web/.claude/rules/figma-design-system.md`)

- [ ] **Step 1: Build HeroCard component**

**IMPORTANT**: An existing `HeroEventCard` component exists in `web/components/EventCard.tsx` and is used by `FeedSection.tsx`, `ForYouView.tsx`, and `sections/HeroBanner.tsx`. The new `HeroCard` REPLACES `HeroEventCard`. After building `HeroCard`, update all imports of `HeroEventCard` to use `HeroCard` instead. If `HeroEventCard` has behavior not covered by the new component, port it over. Eventually remove the old `HeroEventCard` export.

Create `web/components/feed/HeroCard.tsx`:

Props:
```typescript
interface HeroCardProps {
  event: FeedEventData & { card_tier: 'hero'; editorial_mentions?: EditorialMention[] };
  portalSlug?: string;
  friendsGoing?: FriendGoingInfo[];
}
```

Layout (matching Pencil spec):
- Full content width, 200-240px height, `rounded-card` (12px), overflow hidden
- SmartImage fills the card with gradient overlay (`from-[var(--night)] via-[var(--night)]/60 to-transparent`)
- Bottom-left overlay content:
  - Contextual label: "FESTIVAL" or "TENTPOLE" — `font-mono text-2xs font-bold uppercase tracking-[1.2px] text-[var(--gold)]`
  - Title: `text-2xl font-semibold text-[var(--cream)]` (24px)
  - Metadata: venue + date + price — `text-sm text-[var(--soft)]`
- Fallback when no image: gradient bg (`from-[var(--dusk)] to-[var(--night)]`) + CategoryIcon centered

- [ ] **Step 2: Build StandardRow component**

Create `web/components/feed/StandardRow.tsx`:

Props:
```typescript
interface StandardRowProps {
  event: FeedEventData & { card_tier: 'standard' };
  portalSlug?: string;
}
```

Layout:
- Single line, ~48-56px height, `rounded-lg` (8px), `bg-[var(--night)]`
- Left: 2px accent border (category color)
- Content: horizontal flex, justify-between, align-center, padding [8, 12]
  - Left: title (`text-sm font-medium text-[var(--cream)]`) + venue/time (`text-xs text-[var(--muted)]`) with Dot separator
  - Right: badges (Free, price, etc.)

- [ ] **Step 3: Browser-test both components**

Create a temporary test route or render both in a feed section to verify they look correct at desktop (1440px) and mobile (375px).

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/HeroCard.tsx web/components/feed/StandardRow.tsx
git commit -m "feat: add HeroCard and StandardRow feed components"
```

---

## Task 6: New Components — EditorialCallout + PressQuote + SocialProofRow

**Purpose:** Build the three editorial voice components.

**Files:**
- Create: `web/components/feed/EditorialCallout.tsx`
- Create: `web/components/feed/PressQuote.tsx`
- Create: `web/components/feed/SocialProofRow.tsx`
- Reference: `web/lib/city-pulse/types.ts` (EditorialMention, FriendGoingInfo)

- [ ] **Step 1: Build EditorialCallout**

Create `web/components/feed/EditorialCallout.tsx`:

Props:
```typescript
interface EditorialCalloutProps {
  text: string; // Pre-assembled template string
  accentColor?: string; // defaults to --gold
}
```

Layout:
- Left border: 3px, gold accent
- Background: gold at 5% opacity
- Text: `text-sm sm:text-base text-[var(--cream)]`, first sentence bold in gold, rest in soft
- Rounded right corners: `rounded-r-lg`
- Padding: [12, 16]

- [ ] **Step 2: Build PressQuote**

Create `web/components/feed/PressQuote.tsx`:

Props:
```typescript
interface PressQuoteProps {
  snippet: string;
  source: string; // "Eater Atlanta"
  articleUrl?: string;
}
```

Layout:
- Inline component (goes inside EventCard/VenueCard)
- Left: quote mark (`"`) in gold, 14px
- Text: snippet in italic, `text-xs text-[var(--muted)]`
- Attribution: `— ${source}` in `text-2xs text-[var(--muted)]`
- Minimal height, no background, no border

- [ ] **Step 3: Build SocialProofRow**

Create `web/components/feed/SocialProofRow.tsx`:

Props:
```typescript
interface SocialProofRowProps {
  friendsGoing: FriendGoingInfo[];
  goingCount?: number;
  interestedCount?: number;
}
```

Layout:
- Horizontal flex, gap 8, align center
- Avatar stack: 3-4 overlapping 24px circles (`-ml-2` for overlap), `bg-[var(--dusk)]` placeholder
- Text: "[Friend] and [N] friends are going" — `text-xs text-[var(--soft)]`
- If no friends but has counts: "[N] going" in muted
- Returns null if no data (graceful degradation)

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/EditorialCallout.tsx web/components/feed/PressQuote.tsx web/components/feed/SocialProofRow.tsx
git commit -m "feat: add EditorialCallout, PressQuote, SocialProofRow components"
```

---

## Task 7: Editorial Template Engine

**Purpose:** Build the template assembly logic that generates editorial callout text from structured data.

**Files:**
- Create: `web/lib/editorial-templates.ts`
- Create: `web/lib/__tests__/editorial-templates.test.ts`

- [ ] **Step 1: Define templates and matching logic**

Create `web/lib/editorial-templates.ts`:

```typescript
interface TemplateContext {
  events: Array<{ category: string; is_tentpole?: boolean; festival_type?: string | null; title: string }>;
  sectionType: string; // "tonight", "this_weekend", etc.
  categoryCounts: Record<string, number>;
  holidays: Array<{ name: string; date: string }>;
}

interface EditorialResult {
  text: string;
  highlightText: string; // The bold/gold portion
  remainderText: string; // The soft portion
}

export function generateEditorialCallout(ctx: TemplateContext): EditorialResult | null
```

Template priority (first match wins):
1. **Tentpole/festival**: `"Atlanta's biggest [category] festival starts [timing]."` → triggered when section contains a tentpole or festival event
2. **Holiday/occasion**: `"[Holiday] [timing]. [Count] events celebrating."` → triggered when active holiday within 2 days
3. **High density**: `"[Count] [category] events [timing]."` → triggered when category count > 10 in section

Return null if no template matches (section gets standard FeedSectionHeader).

- [ ] **Step 2: Write tests**

```typescript
// tentpole event triggers callout
test('generates callout for tentpole event', () => {
  const result = generateEditorialCallout({
    events: [{ category: 'food_drink', is_tentpole: true, festival_type: 'food', title: 'Atlanta Food & Wine Festival' }],
    sectionType: 'tonight',
    categoryCounts: { food_drink: 3 },
    holidays: [],
  });
  expect(result).not.toBeNull();
  expect(result!.highlightText).toContain('food');
  expect(result!.highlightText).toContain('festival');
});

// no signals returns null
test('returns null when no template matches', () => {
  const result = generateEditorialCallout({
    events: [{ category: 'music', title: 'Open Mic' }],
    sectionType: 'tonight',
    categoryCounts: { music: 3 },
    holidays: [],
  });
  expect(result).toBeNull();
});
```

- [ ] **Step 3: Run tests**

```bash
cd web && npx vitest run lib/__tests__/editorial-templates.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add web/lib/editorial-templates.ts web/lib/__tests__/editorial-templates.test.ts
git commit -m "feat: add editorial template engine for feed callouts"
```

---

## Task 8: Time-Aware Labels + Rarity Signals

**Purpose:** Client-side utilities for contextual time formatting and discovery signals.

**Files:**
- Create: `web/lib/time-labels.ts`
- Create: `web/lib/rarity-signals.ts`
- Create: `web/lib/__tests__/time-labels.test.ts`

- [ ] **Step 1: Build time-aware label utility**

Create `web/lib/time-labels.ts`:

```typescript
export function getContextualTimeLabel(startDate: string, startTime: string | null, isAllDay: boolean): string
```

Logic:
- If event is happening now (started < 2h ago, not ended): `"Happening now"`
- If starts within 4 hours: `"Starts in [N] hours"` or `"Starts in [N] min"`
- If tomorrow: `"Tomorrow"` + time
- If within 3 days of ending (exhibitions): `"Last chance"` or `"Closes [day]"`
- Otherwise: standard date/time format

- [ ] **Step 2: Build rarity signal utility**

Create `web/lib/rarity-signals.ts`:

```typescript
export type RaritySignal = 'one_night_only' | 'rare' | 'new_venue' | 'first_on_lc' | null;

export function getRaritySignal(event: {
  start_date: string;
  end_date?: string | null;
  series_id?: number | null;
  is_recurring?: boolean;
  venue?: { created_at?: string } | null;
  source?: { created_at?: string } | null;
}): RaritySignal
```

Logic:
- Single occurrence (no series, no recurrence, start = end): `"one_night_only"`
- Venue added in last 60 days: `"new_venue"`
- Non-recurring and not part of series: candidates for `"rare"` (would need occurrence count, defer to v2)

- [ ] **Step 3: Write tests for both**

Test time labels: happening now, starts in 2 hours, tomorrow, last chance, standard.
Test rarity: one night only, new venue, recurring (no signal).

- [ ] **Step 4: Commit**

```bash
git add web/lib/time-labels.ts web/lib/rarity-signals.ts web/lib/__tests__/time-labels.test.ts
git commit -m "feat: add contextual time labels and rarity signal utilities"
```

---

## Task 9: Tiered Feed Rendering

**Purpose:** Wire everything together — feed sections render hero → featured → standard cards with editorial callouts.

**Files:**
- Modify: Feed section rendering components (wherever sections map items to cards)
- Modify: `web/components/feed/FeaturedCarousel.tsx` (or create new TieredFeedSection)
- Reference: All new components from Tasks 5-8

- [ ] **Step 1: Map the feed rendering architecture**

The feed has TWO rendering paths:
1. **CityPulseSection.tsx** — Section router that dispatches to specific components (`TrendingSection`, `ComingUpSection`, `WeatherDiscoverySection`, etc.)
2. **LineupSection** — Handles tonight/this_week/coming_up tabs with its own rendering, rendered directly in `CityPulseShell.tsx`

Read both to understand how events map to cards. The tiered rendering needs to work in BOTH paths.

**Strategy**: Create `TieredFeedSection` as a utility that individual section components can opt into, NOT as a replacement for the section router. Each section component decides whether to use tiered rendering based on its content type.

- [ ] **Step 2: Create TieredEventList component**

Create `web/components/feed/TieredEventList.tsx` — a reusable renderer that takes a list of events with `card_tier` and renders hero → featured → standard. Individual section components and LineupSection can both use this:

```typescript
interface TieredEventListProps {
  events: Array<FeedEventData & { card_tier?: CardTier; editorial_mentions?: EditorialMention[] }>;
  portalSlug?: string;
  friendsGoingMap?: Record<number, FriendGoingInfo[]>;
  maxHero?: number; // default 1
  maxFeatured?: number; // default 4
}

function TieredEventList({ events, portalSlug, friendsGoingMap, maxHero = 1, maxFeatured = 4 }: TieredEventListProps) {
  const heroEvents = events.filter(e => e.card_tier === 'hero').slice(0, maxHero);
  const featuredEvents = events.filter(e => e.card_tier === 'featured').slice(0, maxFeatured);
  const standardEvents = events.filter(e => e.card_tier === 'standard');

  return (
    <div className="space-y-3">
      {/* Hero card (max 1) */}
      {heroEvents.map(e => <HeroCard key={e.id} event={e} portalSlug={portalSlug} />)}

      {/* Featured carousel */}
      {featuredEvents.length > 0 && (
        <ScrollableRow>
          {featuredEvents.map(e => <FeaturedCard key={e.id} event={e} />)}
        </ScrollableRow>
      )}

      {/* Standard rows */}
      <div className="card-stagger">
        {standardEvents.map(e => <StandardRow key={e.id} event={e} portalSlug={portalSlug} />)}
      </div>
    </div>
  );
}

Then update existing section components (TrendingSection, ComingUpSection, etc.) and LineupSection to use `<TieredEventList>` instead of rendering EventCards directly. Each section passes its events list — the tier is already on each event from Task 3.
```

- [ ] **Step 3: Integrate PressQuote into EventCard and VenueCard**

Add optional `editorialMentions` prop to EventCard. If present and non-empty, render `<PressQuote>` below the venue name.

Same for VenueCard — if venue has editorial_mentions, show the first snippet.

- [ ] **Step 4: Integrate SocialProofRow into EventCard**

Add optional `friendsGoing` prop rendering. If `friendsGoing.length > 0`, render `<SocialProofRow>` below metadata.

- [ ] **Step 5: Browser-test the full tiered feed**

Open `http://localhost:3000/atlanta` logged in as one of the seed users.

Verify:
- Hero card appears for flagship/festival events (full-width, image, large title)
- Featured cards show in carousel for editorial/social events (288px, corrected proportions)
- Standard rows show for everything else (compact, single line)
- Editorial callout appears when conditions are met (festival in section)
- Press quotes show on venues with editorial_mentions
- Social proof shows friend avatars on events with RSVPs
- Time-aware labels show ("Starts in 2 hours", "Tomorrow")
- Rarity badges show where applicable ("One night only")

- [ ] **Step 6: Browser-test as anonymous user**

Open `http://localhost:3000/atlanta` in incognito.

Verify:
- Hero cards still appear for festivals/tentpoles (intrinsic quality, not personalized)
- Featured cards appear for editorial-mentioned venues
- No social proof rows (no friends = no social proof, correctly hidden)
- No "0 people going" showing anywhere

- [ ] **Step 7: Commit**

```bash
git add web/components/feed/TieredFeedSection.tsx
git add web/components/EventCard.tsx web/components/VenueCard.tsx
git commit -m "feat: implement tiered feed rendering with editorial voice and social proof"
```

---

## Task 10: Motion & Polish

**Purpose:** Add the craft layer — animations, transitions, micro-interactions.

**Files:**
- Modify: `web/app/globals.css` (animation keyframes)
- Modify: Feed section components (stagger classes)
- Modify: Save/bookmark interaction component

- [ ] **Step 1: Add staggered card entrance animation**

In `globals.css`, add:
```css
@keyframes card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-stagger > * {
  animation: card-enter 0.3s ease-out both;
}
.card-stagger > *:nth-child(1) { animation-delay: 0ms; }
.card-stagger > *:nth-child(2) { animation-delay: 50ms; }
.card-stagger > *:nth-child(3) { animation-delay: 100ms; }
.card-stagger > *:nth-child(4) { animation-delay: 150ms; }
.card-stagger > *:nth-child(5) { animation-delay: 200ms; }
.card-stagger > *:nth-child(n+6) { animation-delay: 250ms; }
```

Add `card-stagger` class to TieredFeedSection content containers.

- [ ] **Step 2: Add save/bookmark animation**

```css
@keyframes bookmark-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.bookmark-animate {
  animation: bookmark-pop 0.3s ease-out;
}
```

Apply `.bookmark-animate` class on save action (toggle on click, remove after animation ends).

- [ ] **Step 3: Add "Happening now" pulse**

```css
@keyframes pulse-live {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.pulse-live {
  animation: pulse-live 2s ease-in-out infinite;
}
```

Apply to the "Happening now" time label indicator dot.

- [ ] **Step 4: Browser-test animations**

Verify:
- Cards stagger in smoothly on page load
- Bookmark icon pops on save
- "Happening now" pulses subtly
- No janky or stuttery animations
- Animations are CSS-only (no JS animation libraries)

- [ ] **Step 5: Commit**

```bash
git add web/app/globals.css
git commit -m "feat: add card stagger, bookmark pop, and live pulse animations"
```

---

## Task 11: Design System Updates + Final Commit

**Purpose:** Update Pencil design system and rules file with all new components.

**Files:**
- Modify: `docs/design-system.pen` (via Pencil MCP)
- Modify: `web/.claude/rules/figma-design-system.md`

- [ ] **Step 1: Build HeroCard, StandardRow, EditorialCallout, PressQuote in Pencil**

Using `batch_design` in the open Pencil file:
- HeroCard: full-width, image + gradient + title overlay, gold contextual label
- StandardRow: compact single-line row, accent left border, title + venue/time + badge
- EditorialCallout: gold left border, gold-tinted bg, template text
- PressQuote: inline italic quote with attribution

- [ ] **Step 2: Update corrected components in Pencil**

Fix Badge, FeaturedCard, FeedSectionHeader, VenueCard, EventCard, DetailHero, DetailStickyBar to match the drift-fixed code.

- [ ] **Step 3: Rebuild Atlanta Feed page in Pencil showing tiered layout**

Update the Feed Homepage composition to show:
- EditorialCallout replacing a section header
- HeroCard for the biggest event
- FeaturedCard carousel (corrected proportions)
- StandardRows for remaining events
- PressQuote on a venue card
- SocialProofRow on an event card

- [ ] **Step 4: Update design system rules**

Add new component entries and patterns to `web/.claude/rules/figma-design-system.md`.

- [ ] **Step 5: Commit everything**

```bash
git add web/.claude/rules/figma-design-system.md
git commit -m "docs: update design system with elevation components and corrected specs"
```

---

## Parking Lot (deferred to v2)

- **Weather-based editorial template** — needs weather-to-occasion mapping table
- **Selling Fast badge** — needs crawler changes for ticket inventory
- **Pull-to-refresh animation** — polish, not structural
- **Wildcard section** — algorithm specified in spec, implement when feed has enough content diversity
- **"Rare" rarity signal** — needs occurrence count data not currently tracked
- **Source quality tier** — needs source reliability scoring system
