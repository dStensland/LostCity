# HelpATL Civic Feed Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the HelpATL civic portal feed from 10 sections to 5, with civic news source expansion, channel-boosted ordering, and intent-based event badges.

**Architecture:** Data layer changes first (migration, crawler fixes, API modifications), then new shared utilities (intent mapping, hero scoring), then UI components rebuilt bottom-up, then CivicFeedShell reassembled. Each task is independently testable and committable.

**Tech Stack:** Next.js 16, Supabase/PostgREST, React, Tailwind v4, Python crawlers, feedparser

**Spec:** `docs/superpowers/specs/2026-03-22-helpatl-civic-feed-redesign.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `web/lib/civic-intent.ts` | `inferCivicIntent()` — tag-based intent badge mapping |
| `web/lib/civic-hero-priority.ts` | Hero priority scoring (elections > channel-matched > volume > fallback) |
| `web/components/feed/civic/ThisWeekSection.tsx` | Unified timeline with intent badges + channel boost |
| `web/components/feed/civic/WaysToHelpSection.tsx` | Two-door card (volunteer + support) |
| `web/components/feed/civic/CivicNewsSection.tsx` | Consolidated news section with server-side filtering |
| `web/components/feed/civic/ChannelsStrip.tsx` | Compact channel pills with activity counts |
| `supabase/migrations/YYYYMMDD_helpatl_wave1_news_sources.sql` | Wave-1 network sources |
| `supabase/migrations/YYYYMMDD_channel_activity_summary.sql` | Precomputed channel activity counts |

### Modified Files
| File | Change |
|------|--------|
| `web/components/feed/CivicFeedShell.tsx` | Rebuild — 5 sections replacing 10 |
| `web/components/feed/civic/CivicHero.tsx` | Priority-based contextual headline |
| `web/app/api/portals/[slug]/network-feed/route.ts` | Add `civic_filter` query param |
| `web/app/api/portals/[slug]/channels/route.ts` | Return `event_count_this_week` per channel |
| `web/app/api/cron/interest-channel-matches/route.ts` | Extend to write channel activity summary |
| `crawlers/sources/atlanta_community_food_bank.py` | Strip "Volunteer: " prefix from titles |
| `crawlers/scrape_network_feeds.py` | No changes — existing classifier handles new sources |

### Files to Delete (dead code after rebuild)
| File | Reason |
|------|--------|
| `web/components/feed/civic/CommitmentOpportunitiesCard.tsx` | Section removed — data too thin |
| `web/components/feed/civic/SupportResourcesCard.tsx` | Merged into WaysToHelpSection |
| `web/components/feed/civic/UpcomingDeadlinesCard.tsx` | Deadlines surface in This Week + Hero |
| `web/components/feed/civic/CivicImpactStrip.tsx` | "Groups Joined: 0" problem — removed |
| `web/components/feed/civic/VolunteerThisWeekCard.tsx` | Replaced by ThisWeekSection which includes volunteer events |

### Files NOT Deleted (still used elsewhere)
| File | Reason |
|------|--------|
| `web/components/feed/sections/InterestChannelsSection.tsx` | Removed from CivicFeedShell only — still used by CityPulseShell |
| `web/components/feed/sections/NetworkFeedSection.tsx` | Removed from CivicFeedShell only — still used by other portals |

### Important: Migration Pairs
Every Supabase migration needs a corresponding `database/migrations/NNN_*.sql` file. Use `create_migration_pair.py` or manually create both files for each migration task.

---

## Task 1: Add Wave-1 Civic News Sources (migration + first fetch)

**Files:**
- Create: `supabase/migrations/20260322500010_helpatl_wave1_news_sources.sql`
- Reference: `supabase/migrations/20260311131301_atlanta_policy_watch_network_sources.sql` (pattern to follow)
- Reference: `crawlers/scrape_network_feeds.py` (fetcher)

This is a **launch prerequisite** — without it, the Civic News section can't reliably render.

- [ ] **Step 1: Write the migration**

```sql
-- Add Wave-1 civic news sources for HelpATL.
--
-- IMPORTANT: Some of these sources (saporta-report, urbanize-atlanta, decaturish,
-- atlanta-community-press-collective) already exist under the Atlanta portal.
-- DO NOT reassign portal_id — that would remove them from the Atlanta feed.
-- Instead, subscribe HelpATL to the existing Atlanta sources, and only create
-- new source records for sources that don't exist yet.

-- 1. Subscribe HelpATL to existing Atlanta sources that have civic content
INSERT INTO source_subscriptions (portal_id, source_id, subscription_scope)
SELECT
  (SELECT id FROM portals WHERE slug = 'helpatl'),
  ns.id,
  'all'
FROM network_sources ns
WHERE ns.slug IN ('saporta-report', 'urbanize-atlanta', 'decaturish', 'atlanta-community-press-collective')
ON CONFLICT DO NOTHING;

-- 2. Ensure Atlanta Civic Circle has correct feed_url
-- (already exists but may have wrong URL — only 10 posts suggests misconfiguration)
UPDATE network_sources
SET feed_url = 'https://atlantaciviccircle.org/feed/',
    is_active = true
WHERE slug = 'atlanta-civic-circle';

-- 3. If any wave-1 sources don't exist yet, create them under HelpATL.
-- Check first — the implementing agent should verify which sources already exist
-- by querying: SELECT slug FROM network_sources WHERE slug IN (...);
-- Only insert sources that are genuinely missing.
```

**Note for implementing agent:** Before running this migration, check which network_sources already exist. Sources like `saporta-report`, `urbanize-atlanta`, `decaturish`, and `atlanta-community-press-collective` were seeded in migration 264 under the Atlanta portal. The correct approach is to subscribe HelpATL to them via `source_subscriptions`, NOT to create duplicates or reassign ownership. The network feed API respects portal inheritance (`parent_portal_id`), so HelpATL already sees Atlanta's sources — but explicit subscriptions ensure they appear even if inheritance logic changes.

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/coach/Projects/LostCity && supabase db push` or apply via Supabase dashboard.

- [ ] **Step 3: Run the network feed fetcher for new sources**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scrape_network_feeds.py --source saporta-report --dry-run
python3 scrape_network_feeds.py --source urbanize-atlanta --dry-run
python3 scrape_network_feeds.py --source atl-press-collective --dry-run
python3 scrape_network_feeds.py --source decaturish --dry-run
```

Expected: Each source fetches articles, classifies them by category, reports counts. Verify civic-relevant articles are being classified correctly.

- [ ] **Step 4: Production fetch for all new sources**

```bash
python3 scrape_network_feeds.py --source saporta-report
python3 scrape_network_feeds.py --source urbanize-atlanta
python3 scrape_network_feeds.py --source atl-press-collective
python3 scrape_network_feeds.py --source decaturish
```

- [ ] **Step 5: Verify article counts**

Query the API: `curl localhost:3000/api/portals/helpatl/network-feed?limit=20 | jq '.posts | length'`
Expected: 15+ articles (up from ~3-5 before).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260322500010_helpatl_wave1_news_sources.sql
git commit -m "feat(helpatl): add wave-1 civic news sources (Saporta, Urbanize, APC, Decaturish)"
```

---

## Task 2: Add `civic_filter` to Network Feed API

**Files:**
- Modify: `web/app/api/portals/[slug]/network-feed/route.ts`
- Reference: `web/components/feed/sections/NetworkFeedSection.tsx:296-330` (existing client-side filter to port)
- Test: Manual API test via curl

- [ ] **Step 1: Read the existing route**

Read `web/app/api/portals/[slug]/network-feed/route.ts` fully. Note the query param parsing (lines ~28-34) and the category filter (line ~129).

- [ ] **Step 2: Add the civic_filter param and server-side keyword filtering**

In the route's GET handler, after parsing existing params:

```typescript
const civicFilter = searchParams.get("civic_filter") === "true";
```

After fetching posts from Supabase, before returning the response, add:

```typescript
if (civicFilter) {
  // Port the isCivicRelevant() logic from NetworkFeedSection.tsx
  const CIVIC_INCLUDE = [
    "government", "council", "vote", "election", "housing", "transit",
    "school", "zoning", "ordinance", "community", "volunteer", "nonprofit",
    "budget", "tax", "policy", "legislation", "public safety", "police",
    "fire", "ems", "infrastructure", "water", "sewer", "park", "library",
    "health", "education", "affordable", "displacement", "gentrification",
    "development", "planning", "commission", "board", "hearing", "marta",
    "beltline", "equity", "justice", "immigration", "refugee",
  ];
  const CIVIC_EXCLUDE_TITLE = [
    "restaurant", "dining", "bar", "cocktail", "hawks", "falcons",
    "braves", "united", "concert", "festival", "nightlife", "recipe",
    "wine", "beer", "chef",
  ];

  posts = posts.filter((post: any) => {
    const title = (post.title || "").toLowerCase();
    const summary = (post.summary || "").toLowerCase();
    const text = `${title} ${summary}`;
    if (CIVIC_EXCLUDE_TITLE.some((kw: string) => title.includes(kw))) return false;
    return CIVIC_INCLUDE.some((kw: string) => text.includes(kw));
  });
}
```

When `civic_filter=true`, override the limit to fetch 20 from DB (to have enough after filtering), then slice to the requested limit after filtering.

- [ ] **Step 3: Test the endpoint**

```bash
curl "localhost:3000/api/portals/helpatl/network-feed?civic_filter=true&limit=6" | jq '.posts | length'
```

Expected: 6 articles, all civic-relevant (no restaurant/sports articles).

- [ ] **Step 4: Commit**

```bash
git add web/app/api/portals/[slug]/network-feed/route.ts
git commit -m "feat(api): add civic_filter param to network-feed endpoint"
```

---

## Task 3: Intent Mapping Utility

**Files:**
- Create: `web/lib/civic-intent.ts`
- Create: `web/lib/__tests__/civic-intent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/lib/__tests__/civic-intent.test.ts
import { inferCivicIntent, INTENT_CONFIG } from "../civic-intent";

describe("inferCivicIntent", () => {
  it("returns 'volunteer' for volunteer-tagged events", () => {
    expect(inferCivicIntent(["volunteer", "food"])).toBe("volunteer");
    expect(inferCivicIntent(["volunteer-opportunity"])).toBe("volunteer");
    expect(inferCivicIntent(["drop-in"])).toBe("volunteer");
  });

  it("returns 'meeting' for government-tagged events", () => {
    expect(inferCivicIntent(["government", "city-council"])).toBe("meeting");
    expect(inferCivicIntent(["school-board"])).toBe("meeting");
    expect(inferCivicIntent(["zoning", "public-meeting"])).toBe("meeting");
  });

  it("returns 'action' for advocacy-tagged events", () => {
    expect(inferCivicIntent(["advocacy", "rally"])).toBe("action");
    expect(inferCivicIntent(["canvassing"])).toBe("action");
    expect(inferCivicIntent(["organizing", "civic-engagement"])).toBe("action");
  });

  it("returns 'event' as fallback", () => {
    expect(inferCivicIntent(["food", "charity"])).toBe("event");
    expect(inferCivicIntent([])).toBe("event");
  });

  it("prefers meeting > action > volunteer when multiple match", () => {
    expect(inferCivicIntent(["volunteer", "government"])).toBe("meeting");
    expect(inferCivicIntent(["volunteer", "advocacy"])).toBe("action");
    expect(inferCivicIntent(["advocacy", "government"])).toBe("meeting");
  });

  it("exports badge config for each intent", () => {
    expect(INTENT_CONFIG.volunteer.label).toBe("Volunteer");
    expect(INTENT_CONFIG.meeting.label).toBe("Meeting");
    expect(INTENT_CONFIG.action.label).toBe("Action");
    expect(INTENT_CONFIG.event.label).toBe("Event");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/civic-intent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```typescript
// web/lib/civic-intent.ts

export type CivicIntent = "volunteer" | "meeting" | "action" | "event";

const MEETING_TAGS = new Set([
  "government", "school-board", "zoning", "public-meeting",
  "board-meeting", "city-council", "commission", "hearing",
]);

const ACTION_TAGS = new Set([
  "advocacy", "rally", "canvassing", "organizing",
  "civic-engagement", "protest", "march",
]);

const VOLUNTEER_TAGS = new Set([
  "volunteer", "volunteer-opportunity", "drop-in", "service",
]);

export const INTENT_CONFIG = {
  volunteer: { label: "Volunteer", color: "emerald" },
  meeting: { label: "Meeting", color: "sky" },
  action: { label: "Action", color: "amber" },
  event: { label: "Event", color: "zinc" },
} as const;

/**
 * Infer civic intent from event tags.
 * Priority: meeting > action > volunteer (meetings are time-sensitive).
 */
export function inferCivicIntent(tags: string[]): CivicIntent {
  let hasVolunteer = false;
  let hasAction = false;
  let hasMeeting = false;

  for (const tag of tags) {
    if (MEETING_TAGS.has(tag)) hasMeeting = true;
    if (ACTION_TAGS.has(tag)) hasAction = true;
    if (VOLUNTEER_TAGS.has(tag)) hasVolunteer = true;
  }

  if (hasMeeting) return "meeting";
  if (hasAction) return "action";
  if (hasVolunteer) return "volunteer";
  return "event";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/civic-intent.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/civic-intent.ts web/lib/__tests__/civic-intent.test.ts
git commit -m "feat(helpatl): add inferCivicIntent tag-based intent mapping"
```

---

## Task 4: Hero Priority Scoring

**Files:**
- Create: `web/lib/civic-hero-priority.ts`
- Create: `web/lib/__tests__/civic-hero-priority.test.ts`
- Reference: `web/components/feed/civic/CivicHero.tsx` (current hero logic)

- [ ] **Step 1: Write failing tests**

```typescript
// web/lib/__tests__/civic-hero-priority.test.ts
import { pickHeroItem, HeroItem } from "../civic-hero-priority";

const today = new Date("2026-03-22");

const electionEvent: HeroItem = {
  id: 1, title: "Georgia General Primary", tags: ["election", "election-day"],
  start_date: "2026-04-07", start_time: "07:00", venue_name: "Polling Locations",
};

const meetingEvent: HeroItem = {
  id: 2, title: "MARTA Board Meeting", tags: ["government", "board-meeting"],
  start_date: "2026-03-25", start_time: "13:00", venue_name: "MARTA HQ",
};

const volunteerEvent: HeroItem = {
  id: 3, title: "Park Cleanup", tags: ["volunteer", "drop-in"],
  start_date: "2026-03-23", start_time: "09:00", venue_name: "Piedmont Park",
};

describe("pickHeroItem", () => {
  it("prioritizes elections within 14 days", () => {
    const result = pickHeroItem([volunteerEvent, meetingEvent, electionEvent], [], today);
    expect(result?.item.id).toBe(1);
    expect(result?.reason).toBe("election");
  });

  it("prioritizes channel-matched meetings when no election", () => {
    const subscribedChannelEventIds = new Set([2]);
    const result = pickHeroItem([volunteerEvent, meetingEvent], subscribedChannelEventIds, today);
    expect(result?.item.id).toBe(2);
    expect(result?.reason).toBe("channel_match");
  });

  it("falls back to soonest event when no election or channel match", () => {
    const result = pickHeroItem([volunteerEvent, meetingEvent], new Set(), today);
    expect(result?.item.id).toBe(3); // soonest
    expect(result?.reason).toBe("soonest");
  });

  it("returns null for empty events", () => {
    expect(pickHeroItem([], new Set(), today)).toBeNull();
  });

  it("skips elections more than 14 days out", () => {
    const farElection = { ...electionEvent, start_date: "2026-05-19" };
    const result = pickHeroItem([volunteerEvent, farElection], new Set(), today);
    expect(result?.item.id).toBe(3); // volunteer is soonest
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/civic-hero-priority.test.ts`

- [ ] **Step 3: Write implementation**

```typescript
// web/lib/civic-hero-priority.ts

export interface HeroItem {
  id: number;
  title: string;
  tags: string[];
  start_date: string;
  start_time: string | null;
  venue_name: string;
}

export interface HeroSelection {
  item: HeroItem;
  reason: "election" | "channel_match" | "soonest" | "count_fallback";
}

const ELECTION_TAGS = new Set([
  "election", "election-day", "voter-registration", "civic-deadline",
]);

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function pickHeroItem(
  events: HeroItem[],
  subscribedChannelEventIds: Set<number>,
  now: Date = new Date(),
): HeroSelection | null {
  if (events.length === 0) return null;

  // 1. Election/deadline within 14 days
  const electionEvents = events.filter((e) => {
    if (!e.tags.some((t) => ELECTION_TAGS.has(t))) return false;
    const eventDate = new Date(e.start_date);
    return eventDate.getTime() - now.getTime() <= FOURTEEN_DAYS_MS &&
           eventDate.getTime() >= now.getTime();
  });
  if (electionEvents.length > 0) {
    electionEvents.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return { item: electionEvents[0], reason: "election" };
  }

  // 2. Channel-matched meeting (only if user has subscriptions AND match exists)
  if (subscribedChannelEventIds.size > 0) {
    const channelMatched = events.filter((e) => subscribedChannelEventIds.has(e.id));
    if (channelMatched.length > 0) {
      channelMatched.sort((a, b) => a.start_date.localeCompare(b.start_date));
      return { item: channelMatched[0], reason: "channel_match" };
    }
  }

  // 3. Soonest event
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  return { item: sorted[0], reason: "soonest" };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/__tests__/civic-hero-priority.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/civic-hero-priority.ts web/lib/__tests__/civic-hero-priority.test.ts
git commit -m "feat(helpatl): add hero priority scoring for contextual headlines"
```

---

## Task 5: Channel Activity Counts (migration + cron extension + API)

**Files:**
- Create: `supabase/migrations/20260322500011_channel_activity_summary.sql`
- Modify: `web/app/api/cron/interest-channel-matches/route.ts` (extend to write counts)
- Modify: `web/app/api/portals/[slug]/channels/route.ts` (return counts)

- [ ] **Step 1: Write migration for channel activity summary table**

```sql
-- Precomputed channel activity counts, refreshed by the interest-channel-matches cron.
-- Avoids expensive live rule evaluation (20 channels x 556 events x 3 rules = 33K evaluations).

CREATE TABLE IF NOT EXISTS channel_activity_summary (
  channel_id UUID PRIMARY KEY REFERENCES interest_channels(id) ON DELETE CASCADE,
  event_count_this_week INT NOT NULL DEFAULT 0,
  event_count_next_7_days INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow the cron job (service role) to write
ALTER TABLE channel_activity_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage channel_activity_summary"
  ON channel_activity_summary FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read channel_activity_summary"
  ON channel_activity_summary FOR SELECT TO authenticated USING (true);

-- Allow anon to read (feed renders for logged-out users)
CREATE POLICY "Anon can read channel_activity_summary"
  ON channel_activity_summary FOR SELECT TO anon USING (true);
```

- [ ] **Step 2: Read the existing cron job**

Read `web/app/api/cron/interest-channel-matches/route.ts` fully. Understand how it evaluates channel rules against events and writes to `event_channel_matches`.

- [ ] **Step 3: Extend cron to write activity counts**

After the existing match computation loop, add a step that counts matches per channel for the current week and upserts into `channel_activity_summary`. The exact code depends on the cron's current structure — the implementing agent should read the file and add the count aggregation at the end of the main processing function.

The logic: for each channel, count rows in `event_channel_matches` where `start_date` is within the current week (Monday-Sunday or today+7). Upsert these counts into `channel_activity_summary`.

- [ ] **Step 4: Extend channels API to return counts**

In `web/app/api/portals/[slug]/channels/route.ts`, after fetching channels, join with `channel_activity_summary` to include `event_count_this_week` in the response. This is a single left join — channels without a summary row get 0.

- [ ] **Step 5: Test the channels API**

```bash
curl "localhost:3000/api/portals/helpatl/channels" | jq '.[0] | {name, event_count_this_week}'
```

Expected: Each channel has an `event_count_this_week` field (0 until cron runs).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260322500011_channel_activity_summary.sql \
  web/app/api/cron/interest-channel-matches/route.ts \
  web/app/api/portals/[slug]/channels/route.ts
git commit -m "feat(helpatl): precomputed channel activity counts via cron + API"
```

---

## Task 6: Strip ACFB "Volunteer:" Title Prefix

**Files:**
- Modify: `crawlers/sources/atlanta_community_food_bank.py`
- Reference: ACFB events have titles like "Volunteer: Jonesboro Community Food Center Morning Distr."

- [ ] **Step 1: Read the ACFB crawler**

Find the file — likely `crawlers/sources/atlanta_community_food_bank.py` or check `crawlers/sources/` for ACFB-related files. Find where event titles are set.

- [ ] **Step 2: Add title cleaning**

Where the title is assigned to the event record, strip the "Volunteer: " prefix:

```python
# Clean redundant "Volunteer: " prefix — the event category already signals this
title = title.removeprefix("Volunteer: ").removeprefix("Volunteer:").strip()
```

- [ ] **Step 3: Test with dry-run**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source atlanta-community-food-bank --dry-run --skip-run-lock 2>&1 | grep "Added:"
```

Expected: Titles no longer start with "Volunteer:".

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/atlanta_community_food_bank.py
git commit -m "fix(crawler): strip redundant 'Volunteer:' prefix from ACFB event titles"
```

---

## Task 7: ChannelsStrip Component

**Files:**
- Create: `web/components/feed/civic/ChannelsStrip.tsx`
- Reference: `web/components/civic/CivicOnboarding.tsx` (channel subscription patterns)
- Reference: `web/app/api/portals/[slug]/channels/route.ts` (data source)

- [ ] **Step 1: Build the component**

ChannelsStrip renders a compact horizontal scroll of channel pills.

Props:
```typescript
interface ChannelsStripProps {
  portalSlug: string;
  variant?: "horizontal" | "vertical"; // horizontal for mobile, vertical for sidebar
}
```

Behavior:
- Fetches from `/api/portals/{portalSlug}/channels`
- If user is authenticated and has subscriptions: shows subscribed channels with `event_count_this_week` (suppress count if 0)
- If no subscriptions: shows top 5 channels by activity count as suggestions with "+" subscribe affordance
- Each pill links to `/{portalSlug}/happening?channel={channelSlug}` (filtered Happening view)
- Use portal theme tokens (`--action-primary`, `--twilight`, `--void`)

Style: pill-style badges, one row. `overflow-x-auto` on mobile. `flex flex-col gap-2` for vertical sidebar variant.

- [ ] **Step 2: Verify it renders in isolation**

Add temporarily to a test page or Storybook-like context. Check both subscribed and unsubscribed states.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/civic/ChannelsStrip.tsx
git commit -m "feat(helpatl): add ChannelsStrip component for feed personalization"
```

---

## Task 8: ThisWeekSection Component

**Files:**
- Create: `web/components/feed/civic/ThisWeekSection.tsx`
- Reference: `web/lib/civic-intent.ts` (intent badges)
- Reference: `web/components/feed/civic/VolunteerThisWeekCard.tsx` (event card patterns)

- [ ] **Step 1: Build the component**

ThisWeekSection renders 5-8 civic events with intent badges, channel-boosted ordering.

Props:
```typescript
interface ThisWeekSectionProps {
  portalSlug: string;
  events: CityPulseEvent[]; // from CivicFeedShell's useCityPulseFeed
  subscribedChannelEventIds?: Set<number>; // from event_channel_matches lookup
  isLoading?: boolean;
}
```

Behavior:
- Takes events from CityPulse `this_week` section (passed down from CivicFeedShell)
- Re-sorts: events matching `subscribedChannelEventIds` get boost, then by `start_date`
- Strips "Volunteer: " prefix from titles in rendering (belt-and-suspenders with crawler fix)
- Each event card shows: title, venue name, date/time, intent badge via `inferCivicIntent(event.tags)`
- Intent badge: colored pill using `INTENT_CONFIG[intent].color` and `.label`
- "See all →" link to `/{portalSlug}/happening`
- Limit to 8 events, slice after sorting
- Skeleton loader while `isLoading`

- [ ] **Step 2: Verify with mock data, then real data**

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/civic/ThisWeekSection.tsx
git commit -m "feat(helpatl): add ThisWeekSection with intent badges and channel boost"
```

---

## Task 9: WaysToHelpSection Component

**Files:**
- Create: `web/components/feed/civic/WaysToHelpSection.tsx`

- [ ] **Step 1: Build the component**

Two cards side-by-side on sm+, stacked on xs.

Props:
```typescript
interface WaysToHelpProps {
  portalSlug: string;
  volunteerCount: number; // from CityPulse events
}
```

Card 1 — "Volunteer this week":
- Headline: "Volunteer this week"
- Body: "{volunteerCount} drop-in opportunities, no training required"
- Link: `/{portalSlug}/happening?intent=volunteer`
- Use `--action-primary` theme token

Card 2 — "Find support resources":
- Headline: "Find support resources"
- Body: "Food, housing, legal aid, health, and family support"
- Subtext: "6 categories, 600+ organizations"
- Link: `/{portalSlug}/support`
- Use `--twilight` theme token

- [ ] **Step 2: Verify it renders**

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/civic/WaysToHelpSection.tsx
git commit -m "feat(helpatl): add WaysToHelpSection two-door volunteer + support card"
```

---

## Task 10: CivicNewsSection Component

**Files:**
- Create: `web/components/feed/civic/CivicNewsSection.tsx`
- Reference: `web/components/feed/sections/NetworkFeedSection.tsx` (existing patterns)

- [ ] **Step 1: Build the component**

Fetches from `/api/portals/{portalSlug}/network-feed?civic_filter=true&limit=6`.

Props:
```typescript
interface CivicNewsSectionProps {
  portalSlug: string;
}
```

Behavior:
- Fetches articles from the network-feed API with `civic_filter=true`
- If fewer than 3 articles returned, renders `null` (suppression rule)
- Each article: headline (linked out), source name, published date, 1-2 line summary
- "More civic news →" link to `/{portalSlug}/network`
- No client-side filtering — the API handles it now

Style: Card-based, clean. Source attribution prominent. Use `text-xs` for source/date metadata.

- [ ] **Step 2: Test suppression**

Verify: with `civic_filter=true`, if API returns < 3 articles, section doesn't render. With wave-1 sources live, should reliably return 4+.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/civic/CivicNewsSection.tsx
git commit -m "feat(helpatl): add CivicNewsSection with server-side civic filtering"
```

---

## Task 11: Rebuild CivicHero with Priority Scoring

**Files:**
- Modify: `web/components/feed/civic/CivicHero.tsx`
- Reference: `web/lib/civic-hero-priority.ts`

- [ ] **Step 1: Read current CivicHero.tsx**

Understand current props, headline logic, and pill rendering.

- [ ] **Step 2: Integrate pickHeroItem for contextual headline**

Replace the static "Get involved in Atlanta" headline with dynamic content:
- Pass events from the `this_week` lineup section + `subscribedChannelEventIds` to `pickHeroItem()`
- If result.reason === "election": "Register to vote by {date}" or "Georgia {title} — {date}"
- If result.reason === "channel_match": "{title} — {day} at {time}"
- If result.reason === "soonest": "{title} — {day}"
- If null: "{count} ways to get involved this week"

Keep the pathway pills but update the teal pill to show deadline info if an election is within 14 days.

- [ ] **Step 3: Test with and without elections in the data**

The Georgia Elections crawler (source 1788) has events with `election` and `voter-registration` tags. Verify the hero picks these up when within 14 days.

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/civic/CivicHero.tsx
git commit -m "feat(helpatl): contextual hero headlines with election/channel priority"
```

---

## Task 12: Rebuild CivicFeedShell (Assembly)

**Files:**
- Modify: `web/components/feed/CivicFeedShell.tsx` (major rewrite)
- Reference: All components from Tasks 7-11
- Reference: `web/components/civic/CivicOnboarding.tsx` (stays)
- Reference: `web/components/civic/CivicTabBar.tsx` (stays)

This is the integration task. All components from previous tasks must be complete.

- [ ] **Step 1: Read the current CivicFeedShell.tsx fully**

Note: lines 1-387. Map every section being rendered and its data source.

- [ ] **Step 2: Plan the new section order**

Desktop main column:
1. CivicHero (existing, modified in Task 11)
2. ThisWeekSection (new, Task 8)
3. WaysToHelpSection (new, Task 9)
4. CivicNewsSection (new, Task 10)

Desktop sidebar:
1. ChannelsStrip variant="vertical" (new, Task 7)
2. AboutHelpATL card (new, simple static card, dismissible via localStorage)

Mobile:
1. CivicHero
2. ChannelsStrip variant="horizontal"
3. ThisWeekSection
4. WaysToHelpSection
5. CivicNewsSection
6. CivicTabBar (existing, stays)

- [ ] **Step 3: Implement the channel-boost data flow**

In CivicFeedShell, after receiving CityPulse data:
1. Extract `this_week` events from lineup sections
2. If user is authenticated, fetch their subscribed channel IDs
3. Fetch `event_channel_matches` for those channel IDs → build `subscribedChannelEventIds: Set<number>`
4. Pass to ThisWeekSection and CivicHero

This is a lightweight client-side operation — one additional fetch after CityPulse loads.

- [ ] **Step 4: Remove old sections**

Remove these from the shell's JSX:
- Two `NetworkFeedSection` instances (replaced by CivicNewsSection)
- `CommitmentOpportunitiesCard` (removed)
- `SupportResourcesCard` (merged into WaysToHelpSection)
- `InterestChannelsSection` (replaced by ChannelsStrip)
- `CivicImpactStrip` (removed — "Groups Joined: 0" problem)
- `UpcomingDeadlinesCard` (removed — deadlines in This Week + Hero)
- `VolunteerThisWeekCard` (replaced by ThisWeekSection which includes volunteer events)
- `LineupSection` in the feed (replaced by ThisWeekSection; full timeline stays in Happening view)

Keep:
- `CivicOnboarding` (first-run overlay)
- `CivicTabBar` (mobile nav)

- [ ] **Step 5: Add AboutHelpATLCard inline component**

A lightweight dismissible card for the sidebar. NOT a separate file — define it inline in CivicFeedShell or as a small function component at the bottom of the file:

```tsx
function AboutHelpATLCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--twilight)]/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">About HelpATL</h3>
        <button onClick={onDismiss} className="text-xs opacity-50 hover:opacity-100">Dismiss</button>
      </div>
      <p className="text-xs opacity-70">
        HelpATL aggregates volunteer opportunities, government meetings, and civic news across Atlanta. Find your way to get involved.
      </p>
    </div>
  );
}
```

Dismissal uses localStorage: `helpatl_about_dismissed`. Check on mount, set on dismiss.

- [ ] **Step 6: Implement two-column desktop layout**

```tsx
<div className="flex gap-8">
  {/* Main column */}
  <div className="flex-1 min-w-0 space-y-8">
    <CivicHero {...heroProps} />
    <ThisWeekSection {...thisWeekProps} />
    <WaysToHelpSection {...waysToHelpProps} />
    <CivicNewsSection portalSlug={portalSlug} />
  </div>
  {/* Sidebar — desktop only */}
  <div className="hidden lg:block w-80 space-y-6">
    <div className="sticky top-24">
      <ChannelsStrip portalSlug={portalSlug} variant="vertical" />
      {showAboutCard && <AboutHelpATLCard onDismiss={dismissAbout} />}
    </div>
  </div>
</div>
{/* Channels strip — mobile only, above main content */}
<div className="lg:hidden">
  <ChannelsStrip portalSlug={portalSlug} variant="horizontal" />
</div>
```

- [ ] **Step 6: Browser-test the full feed**

Load `http://citizen.localhost:3000/helpatl` and verify:
- [ ] 5 sections render with real data
- [ ] No empty/embarrassing sections
- [ ] Hero shows contextual headline (election date or event)
- [ ] This Week shows intent badges on events
- [ ] Civic News shows 4+ articles
- [ ] Ways to Help links work (volunteer → happening, support → /support)
- [ ] Channels Strip shows channels with counts (or suggestions for unsubscribed)
- [ ] Mobile layout (375px) — single column, CivicTabBar visible
- [ ] No console errors

- [ ] **Step 7: Commit**

```bash
git add web/components/feed/CivicFeedShell.tsx
git commit -m "feat(helpatl): rebuild civic feed — 5 sections, channel boost, intent badges"
```

---

## Task 13: Delete Dead Components

**Files:**
- Delete: `web/components/feed/civic/CommitmentOpportunitiesCard.tsx`
- Delete: `web/components/feed/civic/SupportResourcesCard.tsx`
- Delete: `web/components/feed/civic/UpcomingDeadlinesCard.tsx`
- Delete: `web/components/feed/civic/CivicImpactStrip.tsx`
- Delete: `web/components/feed/civic/VolunteerThisWeekCard.tsx` (replaced by ThisWeekSection)
- Do NOT delete: `web/components/feed/sections/InterestChannelsSection.tsx` (still used by CityPulseShell)
- Do NOT delete: `web/components/feed/sections/NetworkFeedSection.tsx` (still used by other portals)

- [ ] **Step 1: Verify no remaining imports**

```bash
cd /Users/coach/Projects/LostCity/web
grep -r "CommitmentOpportunitiesCard\|SupportResourcesCard\|UpcomingDeadlinesCard\|CivicImpactStrip\|VolunteerThisWeekCard" --include="*.tsx" --include="*.ts" -l
```

Expected: Only the files themselves (no imports from other files after CivicFeedShell rebuild). If any other file still imports them, fix that file first.

- [ ] **Step 2: Delete the files**

- [ ] **Step 3: Run TypeScript build check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git rm web/components/feed/civic/CommitmentOpportunitiesCard.tsx \
  web/components/feed/civic/SupportResourcesCard.tsx \
  web/components/feed/civic/UpcomingDeadlinesCard.tsx \
  web/components/feed/civic/CivicImpactStrip.tsx \
  web/components/feed/civic/VolunteerThisWeekCard.tsx
git commit -m "chore: remove dead civic feed components replaced by redesign"
```

---

## Task 14: Wave-2 News Sources (follow-up)

**Files:**
- Create: `supabase/migrations/20260322500012_helpatl_wave2_news_sources.sql`

- [ ] **Step 1: Write migration for wave-2 sources**

```sql
INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories, is_active)
VALUES
  ((SELECT id FROM portals WHERE slug = 'helpatl'),
   'Rough Draft Atlanta', 'rough-draft-atlanta-civic',
   'https://roughdraftatlanta.com/feed/',
   'https://roughdraftatlanta.com',
   'Suburban municipal governance — Sandy Springs, Dunwoody, Brookhaven',
   ARRAY['news', 'civic', 'community'], true),

  ((SELECT id FROM portals WHERE slug = 'helpatl'),
   'The Atlanta Voice', 'atlanta-voice',
   'https://theatlantavoice.com/feed/',
   'https://theatlantavoice.com',
   'Community equity, education, local government',
   ARRAY['news', 'civic', 'community'], true),

  ((SELECT id FROM portals WHERE slug = 'helpatl'),
   'Georgia Watch', 'georgia-watch',
   'https://georgiawatch.org/feed/',
   'https://georgiawatch.org',
   'Consumer protection, utility regulation, healthcare affordability',
   ARRAY['news', 'civic', 'politics'], true),

  ((SELECT id FROM portals WHERE slug = 'helpatl'),
   'ACLU of Georgia', 'aclu-georgia',
   'https://www.acluga.org/en/news/feed',
   'https://www.acluga.org',
   'Civil liberties, legislative tracking, criminal justice',
   ARRAY['news', 'civic', 'politics'], true)
ON CONFLICT (slug) DO UPDATE SET
  feed_url = EXCLUDED.feed_url,
  categories = EXCLUDED.categories,
  is_active = EXCLUDED.is_active;
```

- [ ] **Step 2: Fetch and verify**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scrape_network_feeds.py --source rough-draft-atlanta-civic
python3 scrape_network_feeds.py --source atlanta-voice
python3 scrape_network_feeds.py --source georgia-watch
python3 scrape_network_feeds.py --source aclu-georgia
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322500012_helpatl_wave2_news_sources.sql
git commit -m "feat(helpatl): add wave-2 civic news sources (Rough Draft, Atlanta Voice, GA Watch, ACLU)"
```

---

## Task 15: Full QA + Production Verification

**Files:** None — this is verification only.

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run
cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest -x
```

- [ ] **Step 2: TypeScript build check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 3: Browser QA at multiple breakpoints**

Load `http://citizen.localhost:3000/helpatl`:
- [ ] Desktop (1440px): Two-column layout, sidebar with channels + about card
- [ ] Tablet (768px): Single column, channels strip horizontal
- [ ] Mobile (375px): Single column, CivicTabBar visible, no horizontal overflow
- [ ] Verify: every link works (volunteer → happening, support → /support, news articles → external)
- [ ] Verify: no console errors
- [ ] Verify: hero shows contextual content (election date if within 14 days)
- [ ] Verify: Civic News has 4+ articles
- [ ] Verify: intent badges appear on This Week events

- [ ] **Step 4: Verify success criteria from spec**

1. ✅ Feed renders 5 sections with real data, no empty/embarrassing states
2. ✅ Civic News section shows 4+ articles reliably
3. ✅ First-time visitor can find a volunteer shift within 10 seconds
4. ✅ First-time visitor can reach support directory within 2 taps
5. ✅ Returning user with channel subscriptions sees a personalized hero and boosted timeline
6. ✅ Every event card links out to the source for sign-up/details
7. ✅ Page loads under 2 seconds on mobile
