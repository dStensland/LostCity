# Lost Arts Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Lost Arts portal — Atlanta's underground art scene, surfaced — with Open Calls as the adoption wedge, exhibitions as the feed, artist profiles as the retention layer, and studios as a static directory.

**Architecture:** Five screens (Open Calls Board, Feed/Discovery, Exhibition Detail, Artist Profile, Studios Directory) served under the existing `arts-atlanta` portal slug. Open Calls data flows from crawled sources through `db/open_calls.py` → `/api/open-calls` → frontend. Exhibitions flow through `db/exhibitions.py` → `/api/exhibitions` → frontend. Artist profiles are auto-generated from exhibition data via `exhibition_artists` → `artists` table, claimable by artists. The "Underground Gallery" design aesthetic (dark warm canvas, copper accent, IBM Plex Mono, zero corner radius, stroke-defined cards) is applied via the existing portal theme system.

**Tech Stack:** Next.js 16, Supabase (Postgres + RLS), Python crawlers (BeautifulSoup + LLM extraction), Tailwind v4, Phosphor Icons

---

## Infrastructure Assessment

The following already exists and does NOT need to be rebuilt:

| Component | Status | Location |
|-----------|--------|----------|
| `exhibitions` table | Ready | `supabase/migrations/20260314183002_exhibitions_table.sql` |
| `exhibition_artists` junction | Ready | Same migration |
| `open_calls` table | Ready | `supabase/migrations/20260314183003_open_calls_table.sql` |
| `artists` table | Ready | `database/migrations/127_artists_table.sql` |
| Arts portal registration | Ready | `database/migrations/447_arts_atlanta_portal.sql` (40+ source subscriptions) |
| `insert_exhibition()` + dedup | Ready | `crawlers/db/exhibitions.py` |
| `insert_open_call()` + dedup | Ready | `crawlers/db/open_calls.py` |
| `_upsert_exhibition_artists()` | Ready | `crawlers/db/exhibitions.py` (resolves to canonical artist via `get_or_create_and_enrich`) |
| `GET /api/exhibitions` | Ready | `web/app/api/exhibitions/route.ts` (portal-scoped, paginated, filterable) |
| `GET /api/open-calls` | Ready | `web/app/api/open-calls/route.ts` (portal-scoped, deadline-sorted) |
| Exhibition TS types | Ready | `web/lib/types/exhibitions.ts` |
| Open Call TS types | Ready | `web/lib/types/open-calls.ts` |
| Artist detail page | Ready | `web/app/[portal]/artists/[slug]/page.tsx` |
| `open_calls` entity lane | Ready | `crawlers/entity_lanes.py` line 20 |
| Portal theme (copper/monospace) | Ready | Migration 447 branding config |

**What needs to be built:**

1. Open Calls crawlers (data sources — the wedge)
2. Exhibition crawlers (expand from 2 to 20+)
3. Arts portal frontend pages (5 screens)
4. Open Calls personal pipeline (save, remind, track — authenticated)
5. Artist profile "claim" flow
6. Studios directory (linked to venues table, not a separate table)
7. Confidence tier system for Open Calls
8. Arts-specific feed section configuration
9. Arts portal font loading (IBM Plex Mono, Playfair Display, Space Grotesk)
10. Exhibition detail API route (slug lookup)
11. `artist_id` in exhibition_artists API select (for profile links)

---

## File Structure

### Crawlers (new files)
- `crawlers/sources/open_calls_burnaway.py` — Burnaway monthly roundups
- `crawlers/sources/open_calls_bakery_atl.py` — The Bakery ATL opportunities
- `crawlers/sources/open_calls_cafe.py` — CaFE (callforentry.org) Atlanta-tagged
- `crawlers/sources/open_calls_atlanta_contemporary.py` — Atlanta Contemporary calls
- `crawlers/sources/open_calls_fulton_arts.py` — Fulton County arts grants
- `crawlers/sources/open_calls_moca_ga.py` — MOCA GA submissions
- `crawlers/sources/whitespace_gallery.py` — Whitespace exhibitions
- `crawlers/sources/marcia_wood_gallery.py` — Marcia Wood exhibitions
- `crawlers/sources/sandler_hudson.py` — Sandler Hudson exhibitions
- `crawlers/sources/mason_fine_art.py` — Mason Fine Art exhibitions
- `crawlers/sources/high_museum.py` — High Museum exhibitions (federates to Atlanta)
- `crawlers/sources/atlanta_contemporary_exhibitions.py` — Atlanta Contemporary exhibitions
- `crawlers/sources/moca_ga_exhibitions.py` — MOCA GA exhibitions
- `crawlers/sources/get_this_gallery.py` — Get This Gallery exhibitions
- `crawlers/sources/kai_lin_art.py` — Kai Lin Art exhibitions

### Database (new migrations)
- `supabase/migrations/YYYYMMDD_open_call_confidence_tier.sql` — Add `confidence_tier` column
- `supabase/migrations/YYYYMMDD_user_open_call_tracking.sql` — Personal pipeline tables
- `supabase/migrations/YYYYMMDD_venue_studio_fields.sql` — Studio-specific fields on venues table (availability_status, monthly_rate_range, application_url, studio_type)
- `supabase/migrations/YYYYMMDD_artist_claim.sql` — Artist claim fields + verified badge
- `supabase/migrations/YYYYMMDD_arts_feed_sections.sql` — Feed section configuration

### Web frontend (new files)
- `web/lib/types/open-call-tracking.ts` — Personal pipeline types
- `web/lib/open-calls.ts` — Server-side Open Call data fetching
- `web/lib/open-calls-utils.ts` — Client-safe Open Call helpers
- `web/lib/exhibitions.ts` — Server-side exhibition data fetching (single + list)
- `web/lib/exhibitions-utils.ts` — Client-safe exhibition helpers
- `web/app/api/exhibitions/[slug]/route.ts` — Single exhibition by slug (with venue + artists including artist_id)
- `web/app/api/open-calls/track/route.ts` — Save/unsave/mark-applied
- `web/app/api/open-calls/reminders/route.ts` — Deadline reminders
- `web/app/api/studios/route.ts` — Studios directory API (queries venues with studio_type)
- `web/app/api/artists/claim/route.ts` — Artist claim flow
- `web/components/arts/OpenCallsBoard.tsx` — Main Open Calls view
- `web/components/arts/OpenCallCard.tsx` — Individual call card (monospace, stroke, tiers)
- `web/components/arts/OpenCallFilters.tsx` — Filter bar (discipline, type, deadline, tier)
- `web/components/arts/OpenCallPipeline.tsx` — Personal pipeline sidebar/section
- `web/components/arts/ExhibitionFeed.tsx` — Exhibition discovery feed
- `web/components/arts/ExhibitionCard.tsx` — Typography-forward exhibition card
- `web/components/arts/ExhibitionDetail.tsx` — Full exhibition page content
- `web/components/arts/ArtistExhibitionTimeline.tsx` — Living CV timeline component
- `web/components/arts/ArtistClaimBanner.tsx` — "Claim your profile" CTA
- `web/components/arts/StudiosDirectory.tsx` — Studios listing (from venues with studio_type)
- `web/components/arts/StudioCard.tsx` — Individual studio card
- `web/components/arts/ArtsSecondaryNav.tsx` — Arts portal sub-navigation (like CivicTabBar pattern)
- `web/app/[portal]/exhibitions/page.tsx` — Exhibitions browse page
- `web/app/[portal]/exhibitions/[slug]/page.tsx` — Exhibition detail page
- `web/app/[portal]/open-calls/page.tsx` — Open Calls board page
- `web/app/[portal]/studios/page.tsx` — Studios directory page

### Modify (existing files)
- `web/app/[portal]/artists/[slug]/page.tsx` — Add exhibition history (Living CV) section
- `web/app/[portal]/layout.tsx` — Add font loading for arts vertical (IBM Plex Mono, Playfair Display, Space Grotesk) + `isArts` conditional
- `web/lib/artists.ts` — Add `getArtistExhibitions()` function
- `web/lib/types/exhibitions.ts` — Add `artist_id` to `ExhibitionArtist` interface
- `web/lib/types/open-calls.ts` — Add `confidence_tier` field + types
- `web/app/api/exhibitions/route.ts` — Add `artist_id` to exhibition_artists select
- `web/app/api/open-calls/route.ts` — Add `confidence_tier` to select + tier filter param

---

## Task 1: Schema + Infrastructure Prerequisites

**Files:**
- Create: `supabase/migrations/YYYYMMDD_open_call_confidence_tier.sql`
- Modify: `web/app/[portal]/layout.tsx` — arts font loading
- Modify: `web/lib/types/exhibitions.ts` — add `artist_id` to `ExhibitionArtist`
- Modify: `web/app/api/exhibitions/route.ts` — add `artist_id` to select
- Test: Manual DB verification + `npx tsc --noEmit`

- [ ] **Step 1: Write the migration**

```sql
-- Add confidence tier to open_calls for source quality signal
ALTER TABLE open_calls
  ADD COLUMN IF NOT EXISTS confidence_tier TEXT
    CHECK (confidence_tier IN ('verified', 'aggregated', 'discovered'))
    DEFAULT 'discovered';

-- Add source_type to help crawlers auto-set tier
COMMENT ON COLUMN open_calls.confidence_tier IS
  'verified = crawled from issuing org, aggregated = from CaFE/EntryThingy/etc, discovered = social/newsletters/less structured';
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard
Expected: Column added, existing rows default to 'discovered'

- [ ] **Step 3: Update TypeScript types**

In `web/lib/types/open-calls.ts`, add:

```typescript
export type ConfidenceTier = "verified" | "aggregated" | "discovered";

// Add to OpenCall interface:
confidence_tier: ConfidenceTier;

// Add display helpers:
export const CONFIDENCE_TIER_LABELS: Record<ConfidenceTier, string> = {
  verified: "Verified",
  aggregated: "Aggregated",
  discovered: "Discovered",
};

export const CONFIDENCE_TIER_DESCRIPTIONS: Record<ConfidenceTier, string> = {
  verified: "Crawled directly from the issuing organization",
  aggregated: "Found on a reputable aggregator like CaFE or EntryThingy",
  discovered: "Found via social media, newsletters, or community posts",
};
```

- [ ] **Step 4: Update crawler insert layer**

In `crawlers/db/open_calls.py`, add `"confidence_tier"` to `_OPEN_CALL_COLUMNS` set.

- [ ] **Step 5: Update API route select**

In `web/app/api/open-calls/route.ts`, add `confidence_tier` to the select string. Add `tier` query param filter:

```typescript
const tierFilter = searchParams.get("tier");
// ... in both count and data queries:
if (tierFilter && isValidString(tierFilter, 1, 20)) {
  query = query.eq("confidence_tier", tierFilter);
}
```

- [ ] **Step 6: Add arts font loading to portal layout**

In `web/app/[portal]/layout.tsx`, add font imports:
```typescript
import { IBM_Plex_Mono, Playfair_Display } from "next/font/google";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair-display",
});
```

Add `isArts` detection (follow existing pattern for `isAdventure`, `isFamily`, etc.) and apply font variables to the wrapper div class when arts vertical is active.

- [ ] **Step 7: Add `artist_id` to ExhibitionArtist type and API**

In `web/lib/types/exhibitions.ts`, add to `ExhibitionArtist`:
```typescript
export interface ExhibitionArtist {
  exhibition_id: string;
  artist_name: string;
  artist_url: string | null;
  artist_id: string | null;  // FK to artists table — enables profile links
  role: ArtistRole;
}
```

In `web/app/api/exhibitions/route.ts`, update the select to include `artist_id`:
```typescript
artists:exhibition_artists(exhibition_id, artist_name, artist_url, artist_id, role)
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/ web/lib/types/open-calls.ts web/lib/types/exhibitions.ts crawlers/db/open_calls.py web/app/api/open-calls/route.ts web/app/api/exhibitions/route.ts web/app/\[portal\]/layout.tsx
git commit -m "feat(arts): schema prerequisites — confidence tiers, font loading, artist_id in exhibitions"
```

---

## Task 2: Open Calls Crawlers — Burnaway (Verified Tier)

**Files:**
- Create: `crawlers/sources/open_calls_burnaway.py`
- Create: `crawlers/sources/profiles/open-calls-burnaway.yaml` (if using v2 profiles)
- Reference: `crawlers/editorial_ingest.py` (RSS/fetch pattern), `crawlers/sources/atlanta_printmakers_studio.py` (exhibition insert pattern)

- [ ] **Step 1: Research Burnaway's page structure**

Open https://burnaway.org/daily/call-for-artists/ in browser. Identify:
- Is it an RSS feed or HTML page?
- What's the structure of each call listing? (title, deadline, org, link, description)
- How often is it updated?
- Are there paginated archive pages?

- [ ] **Step 2: Write the crawler**

Follow the pattern from `editorial_ingest.py` for fetch + parse. Each extracted call feeds into `insert_open_call()` from `crawlers/db/open_calls.py`. Set `confidence_tier: "verified"` since Burnaway is a direct editorial source.

Key fields to extract per call:
- `title` — call name
- `application_url` — link to apply (REQUIRED)
- `deadline` — date (REQUIRED for urgency sort)
- `call_type` — infer from content (submission/residency/grant/commission/exhibition_proposal)
- `description` — brief summary
- `eligibility` — who can apply
- `fee` — if mentioned
- `_org_name` — for slug generation
- `source_url` — the Burnaway page itself
- `confidence_tier` — "verified"
- `portal_id` — arts portal UUID (look up from DB or hardcode)

```python
def crawl(source: dict) -> tuple[int, int, int]:
    # 1. Fetch Burnaway calls page
    # 2. Parse each call listing
    # 3. For each call: extract fields, call insert_open_call()
    # 4. Return counts
```

- [ ] **Step 3: Register source in DB**

```sql
INSERT INTO sources (name, slug, url, source_type, integration_method, owner_portal_id, is_active)
VALUES (
    'Burnaway Open Calls',
    'open-calls-burnaway',
    'https://burnaway.org/daily/call-for-artists/',
    'organization',
    'html',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta'),
    true
);
```

- [ ] **Step 4: Test with dry-run**

Run: `cd crawlers && python3 main.py --source open-calls-burnaway --dry-run`
Expected: Calls found, logged but not written

- [ ] **Step 5: Run production write**

Run: `cd crawlers && python3 main.py --source open-calls-burnaway --allow-production-writes`
Expected: Open calls inserted into DB

- [ ] **Step 6: Verify via API**

Run: `curl "http://localhost:3000/api/open-calls?portal=arts-atlanta&status=open" | jq '.open_calls | length'`
Expected: Non-zero count of open calls

- [ ] **Step 7: Commit**

```bash
git add crawlers/sources/open_calls_burnaway.py
git commit -m "feat(arts): add Burnaway open calls crawler"
```

---

## Task 3: Open Calls Crawlers — Additional Sources

**Files:**
- Create: `crawlers/sources/open_calls_bakery_atl.py`
- Create: `crawlers/sources/open_calls_atlanta_contemporary.py`
- Create: `crawlers/sources/open_calls_moca_ga.py`
- Create: `crawlers/sources/open_calls_fulton_arts.py`
- Create: `crawlers/sources/open_calls_cafe.py`

Each follows the same pattern as Task 2. Research page structure, write crawler, register source, test, verify. Confidence tiers:
- Atlanta Contemporary, MOCA GA, Fulton Arts → `"verified"` (direct from org)
- The Bakery ATL → `"verified"` (curated by local arts org)
- CaFE → `"aggregated"` (national aggregator, Atlanta-filtered)

- [ ] **Step 1: Research each source's page structure** (parallel — one sub-step per source)
- [ ] **Step 2: Write crawlers** (each source is independent, can be parallelized)
- [ ] **Step 3: Register sources in DB**
- [ ] **Step 4: Test all with dry-run**
- [ ] **Step 5: Production write + API verify**
- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/open_calls_*.py
git commit -m "feat(arts): add open calls crawlers for Bakery ATL, Atlanta Contemporary, MOCA GA, Fulton Arts, CaFE"
```

---

## Task 4: Exhibition Crawlers — Major Galleries

**Files:**
- Create: One crawler per gallery (see file structure above)
- Reference: `crawlers/sources/atlanta_printmakers_studio.py` (exhibition insert pattern)

Target galleries for launch (from portal source subscriptions in migration 447):
1. High Museum of Art (federates to Atlanta portal)
2. Atlanta Contemporary
3. MOCA GA
4. Whitespace Gallery
5. Marcia Wood Gallery
6. Sandler Hudson Gallery
7. Mason Fine Art
8. Get This Gallery
9. Kai Lin Art
10. Hammonds House Museum

Each crawler:
- Fetches gallery exhibitions page
- Extracts: title, artist(s), dates (opening/closing), description, image, medium, exhibition_type
- Calls `insert_exhibition(record, artists=[...])` from `crawlers/db/exhibitions.py`
- Artist names are auto-resolved to canonical records via `_upsert_exhibition_artists()`

**CRITICAL: Crawlers MUST extract and pass artist names.** The Living CV (Task 8) depends on `exhibition_artists` rows having `artist_id` populated, which only happens when crawlers pass artist data to `insert_exhibition(data, artists=[{artist_name: "...", role: "artist"}])`. If a crawler doesn't extract artists, those exhibitions will be invisible on artist profiles. Every gallery page lists artists — extract them.

- [ ] **Step 1: Research page structures** (parallel — divide among agents)
- [ ] **Step 2: Write crawlers** (independent, parallelizable)
- [ ] **Step 3: Register sources + test dry-run**
- [ ] **Step 4: Production write**
- [ ] **Step 5: Verify via API**: `curl "http://localhost:3000/api/exhibitions?portal=arts-atlanta&showing=current" | jq '.exhibitions | length'`
- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/*.py
git commit -m "feat(arts): add exhibition crawlers for 10 major Atlanta galleries"
```

---

## Task 5: Open Calls Board — Frontend

**Files:**
- Create: `web/app/[portal]/open-calls/page.tsx`
- Create: `web/components/arts/OpenCallsBoard.tsx`
- Create: `web/components/arts/OpenCallCard.tsx`
- Create: `web/components/arts/OpenCallFilters.tsx`
- Create: `web/lib/open-calls.ts` (server-side fetching)
- Create: `web/lib/open-calls-utils.ts` (client-safe helpers)

**Design:** Underground Gallery aesthetic — dark warm canvas, copper accent, IBM Plex Mono body, zero corner radius, stroke-defined cards. Typography-forward. No images required.

- [ ] **Step 1: Create server-side data fetching**

`web/lib/open-calls.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";

export async function getOpenCalls(portalSlug: string, filters?: {
  type?: string;
  tier?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  // Fetch from /api/open-calls with portal scope
  // Return typed OpenCallWithOrg[]
}
```

- [ ] **Step 2: Create the OpenCallCard component**

Typography-forward card with Arts portal aesthetic:
- Title in IBM Plex Mono (via portal theme)
- Organization name
- Deadline with urgency treatment (copper/warm-red for closing soon)
- Confidence tier badge (Verified ✓ / Aggregated / Discovered)
- Call type pill (Submission, Residency, Grant, Commission)
- Fee indicator
- Zero corner radius, stroke border, no fill
- Click-through to `application_url` (external link)

```typescript
// Key visual structure:
// ┌─────────────────────────────────────────┐
// │ // open submission          VERIFIED ✓  │
// │ Weight of Water Group Show              │
// │ Atlanta Contemporary                    │
// │                                         │
// │ Deadline: Apr 15, 2026    No fee        │
// │ [painting] [sculpture] [installation]   │
// └─────────────────────────────────────────┘
```

- [ ] **Step 3: Create filter bar**

`OpenCallFilters.tsx` — horizontal scrollable chips:
- Call type: All | Submission | Residency | Grant | Commission
- Deadline: All | This Week | This Month | 3+ Months
- Confidence: All | Verified | Aggregated | Discovered
- Use `FilterChip` from `web/components/filters/FilterChip.tsx`

- [ ] **Step 4: Create the board page**

`web/app/[portal]/open-calls/page.tsx`:
- Server component, fetches open calls via API
- Renders `OpenCallFilters` + list of `OpenCallCard`
- Sorted by deadline (soonest first, nulls last)
- Pagination (load more)
- Empty state: "No open calls right now. Check back soon — we crawl new opportunities daily."

- [ ] **Step 5: Browser-test**

Load the page at `http://localhost:3000/arts-atlanta/open-calls`. Verify:
- Cards render with real data from crawlers
- Filters work (client-side state, `replaceState`)
- Deadline urgency coloring works
- Confidence tier badges display correctly
- 375px mobile viewport works
- External links open in new tab

- [ ] **Step 6: Commit**

```bash
git add web/app/\[portal\]/open-calls/ web/components/arts/ web/lib/open-calls.ts web/lib/open-calls-utils.ts
git commit -m "feat(arts): Open Calls board — browse page, card component, filters"
```

---

## Task 6: Personal Pipeline — Save, Remind, Track

**Files:**
- Create: `supabase/migrations/YYYYMMDD_user_open_call_tracking.sql`
- Create: `web/app/api/open-calls/track/route.ts`
- Create: `web/lib/types/open-call-tracking.ts`
- Create: `web/components/arts/OpenCallPipeline.tsx`
- Modify: `web/components/arts/OpenCallCard.tsx` — add save/applied buttons

- [ ] **Step 1: Write tracking migration**

```sql
CREATE TABLE IF NOT EXISTS user_open_call_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  open_call_id UUID NOT NULL REFERENCES open_calls(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('saved', 'applied', 'dismissed')) DEFAULT 'saved',
  remind_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, open_call_id)
);

-- RLS: users can only see/modify their own tracking
ALTER TABLE user_open_call_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_open_call_tracking_own ON user_open_call_tracking
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_user_open_call_tracking_user ON user_open_call_tracking(user_id, status);
```

- [ ] **Step 2: Create TypeScript types**

`web/lib/types/open-call-tracking.ts`:
```typescript
export type TrackingStatus = "saved" | "applied" | "dismissed";

export interface OpenCallTracking {
  id: string;
  user_id: string;
  open_call_id: string;
  status: TrackingStatus;
  remind_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Create API route**

`web/app/api/open-calls/track/route.ts`:
- `POST` — save/applied/dismissed (upsert on user_id + open_call_id)
- `GET` — fetch user's tracked calls (with status filter)
- `DELETE` — remove tracking
- Uses `withAuth` middleware pattern

- [ ] **Step 4: Add save/applied buttons to OpenCallCard**

When logged in, show:
- Bookmark icon → save (toggles)
- "Applied" chip → mark as applied (toggles)
- Use `useAuthenticatedFetch` hook for mutations

- [ ] **Step 5: Create pipeline view**

`OpenCallPipeline.tsx` — shows user's tracked calls grouped by status:
- Saved (deadline countdown)
- Applied (date applied)
- Accessible from Open Calls page as a tab/toggle for logged-in users

- [ ] **Step 6: Browser-test the full flow**

1. Browse open calls (anonymous)
2. Click save → redirected to login
3. Log in → return to open calls
4. Save a call → bookmark fills
5. Mark as applied → status updates
6. Check pipeline view → shows saved + applied

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ web/app/api/open-calls/track/ web/lib/types/open-call-tracking.ts web/components/arts/OpenCallPipeline.tsx web/components/arts/OpenCallCard.tsx
git commit -m "feat(arts): personal pipeline — save, track, and manage open call applications"
```

---

## Task 7: Exhibition Feed & Detail Pages

**Files:**
- Create: `web/app/[portal]/exhibitions/page.tsx`
- Create: `web/app/[portal]/exhibitions/[slug]/page.tsx`
- Create: `web/app/api/exhibitions/[slug]/route.ts` — single exhibition by slug
- Create: `web/components/arts/ExhibitionFeed.tsx`
- Create: `web/components/arts/ExhibitionCard.tsx`
- Create: `web/components/arts/ExhibitionDetail.tsx`
- Create: `web/lib/exhibitions.ts` — server-side fetching (list + by-slug)

- [ ] **Step 1: Create ExhibitionCard component**

Typography-forward, images optional:
```
┌─────────────────────────────────────────┐
│ // exhibition · solo show               │
│                                         │
│ Weight of Water                         │  ← Playfair Display italic
│ SARAH CAIN                              │  ← IBM Plex Mono, copper
│ Whitespace · Inman Park                 │
│ Mar 14 – Apr 26                         │
│                                         │
│ [painting] [installation]     FREE      │
└─────────────────────────────────────────┘
```

If image is available, show it above the text content. If not, the card works purely on typography. Use stroke border, zero radius, no fill — per Underground Gallery aesthetic.

"Closing soon" treatment: warm red accent on date when closing within 7 days.

- [ ] **Step 2: Create ExhibitionFeed**

Filterable list of ExhibitionCards:
- Filters: Currently Showing / Opening Soon / Closing Soon
- Medium filter (painting, sculpture, photography, etc.)
- Exhibition type (solo, group, installation, etc.)
- Sorted by: closing soon first (urgency), then opening date

- [ ] **Step 3: Create exhibitions browse page**

`web/app/[portal]/exhibitions/page.tsx`:
- Server component, fetches via `/api/exhibitions?portal=arts-atlanta`
- Renders ExhibitionFeed
- Pagination

- [ ] **Step 4: Create exhibition detail API route**

`web/app/api/exhibitions/[slug]/route.ts`:
- `GET /api/exhibitions/:slug` — fetches single exhibition by slug
- Joins: venue (id, name, slug, neighborhood, address, city, lat, lng, image_url), exhibition_artists (including `artist_id` for profile links)
- Portal-scoped (requires `portal` query param)
- Rate limited, cached (5 min)

- [ ] **Step 5: Create exhibition detail page**

`web/app/[portal]/exhibitions/[slug]/page.tsx`:
- Server component, fetches single exhibition via `/api/exhibitions/:slug`
- Uses existing detail page pattern (DetailHero, InfoCard, MetadataGrid, SectionHeader)
- Sections: Description, Artists (linked to artist profiles via `artist_id` → `/[portal]/artists/[slug]`), Venue (with map), Related exhibitions at same venue
- "In the Press" section if editorial_mentions exist for the venue
- Schema.org ExhibitionEvent structured data

- [ ] **Step 5: Browser-test**

- Exhibition browse loads with real crawled data
- Filter interactions work
- "Closing soon" urgency treatment displays correctly
- Exhibition detail page renders
- Artist names link to artist profiles
- Venue links to venue detail
- 375px mobile viewport

- [ ] **Step 6: Commit**

```bash
git add web/app/\[portal\]/exhibitions/ web/components/arts/Exhibition*.tsx web/lib/exhibitions.ts
git commit -m "feat(arts): exhibition feed and detail pages"
```

---

## Task 8: Artist Profile — Living CV Enhancement

**Files:**
- Modify: `web/app/[portal]/artists/[slug]/page.tsx`
- Modify: `web/lib/artists.ts` — add `getArtistExhibitions()`
- Create: `web/components/arts/ArtistExhibitionTimeline.tsx`
- Create: `supabase/migrations/YYYYMMDD_artist_claim.sql`
- Create: `web/app/api/artists/claim/route.ts`
- Create: `web/components/arts/ArtistClaimBanner.tsx`

- [ ] **Step 1: Add getArtistExhibitions to artists.ts**

```typescript
export async function getArtistExhibitions(artistId: string): Promise<ExhibitionWithVenue[]> {
  // Query exhibition_artists WHERE artist_id = artistId
  // Join exhibitions + venues
  // Sort by opening_date DESC (newest first)
  // Return full exhibition records
}
```

- [ ] **Step 2: Create ArtistExhibitionTimeline component**

Chronological list of exhibitions an artist has been part of:
```
// exhibition history

2026
  ├─ Weight of Water · Whitespace · Mar 14 – Apr 26
  └─ Spring Group Show · Atlanta Contemporary · Feb 1 – Mar 15

2025
  ├─ Solo Exhibition · MOCA GA · Sep 1 – Nov 30
  └─ Flux Projects · BeltLine · Jun – Aug
```

- [ ] **Step 3: Add exhibition timeline to artist detail page**

In `web/app/[portal]/artists/[slug]/page.tsx`:
- After the existing "Upcoming Events" section, add "Exhibition History" section
- Only renders if artist has exhibition records
- Uses ArtistExhibitionTimeline component

- [ ] **Step 4: Artist claim migration**

```sql
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT;
```

- [ ] **Step 5: Create claim API route**

`web/app/api/artists/claim/route.ts`:
- `POST { artist_id }` — user claims an unclaimed artist profile
- Validates: artist exists, not already claimed, user is authenticated
- Sets `claimed_by = user.id`, `claimed_at = now()`
- Future: admin review step for verification

- [ ] **Step 6: Create ArtistClaimBanner**

Shown on unclaimed artist profiles:
"Is this you? Claim your profile to add your bio, links, and keep your exhibition record up to date."
[Claim This Profile] button → triggers claim flow

- [ ] **Step 7: Browser-test**

- Artist page shows exhibition timeline (if exhibitions exist)
- Unclaimed artist shows claim banner
- Claim flow works for logged-in users
- Claimed artist hides claim banner, shows "Verified" badge

- [ ] **Step 8: Commit**

```bash
git add web/app/\[portal\]/artists/ web/components/arts/Artist*.tsx web/lib/artists.ts web/app/api/artists/claim/ supabase/migrations/
git commit -m "feat(arts): Living CV — exhibition timeline on artist profiles + claim flow"
```

---

## Task 9: Studios Directory

Studios are venues — many already exist in the `venues` table (Goat Farm, Atlanta Contemporary, Spruill, Callanwolde). Instead of a separate table, we add studio-specific fields to venues and query by `venue_type`.

**Files:**
- Create: `supabase/migrations/YYYYMMDD_venue_studio_fields.sql`
- Create: `web/lib/types/studios.ts`
- Create: `web/lib/studios.ts`
- Create: `web/app/api/studios/route.ts`
- Create: `web/app/[portal]/studios/page.tsx`
- Create: `web/components/arts/StudiosDirectory.tsx`
- Create: `web/components/arts/StudioCard.tsx`

- [ ] **Step 1: Add studio fields to venues table**

```sql
-- Studio-specific fields on the existing venues table.
-- Many studios already exist as venues — this avoids data duplication.
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS studio_type TEXT
    CHECK (studio_type IN ('private', 'shared', 'coop', 'residency', 'makerspace')),
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IN ('open', 'waitlist', 'full', 'application_only')),
  ADD COLUMN IF NOT EXISTS monthly_rate_range TEXT,
  ADD COLUMN IF NOT EXISTS application_url TEXT;

-- Index for studios directory queries
CREATE INDEX IF NOT EXISTS idx_venues_studio_type
  ON venues(studio_type) WHERE studio_type IS NOT NULL AND is_active = true;

COMMENT ON COLUMN venues.studio_type IS 'Set for venues that function as artist studios/workspaces. NULL for non-studios.';
```

- [ ] **Step 2: Seed studio data on existing + new venues**

Research and update/insert 15-20 Atlanta studios. Many already exist as venues:
- Goat Farm Arts Center (waitlist) — likely already in venues table
- TILA Studios
- Dashboard Co-op
- Guardian Studios
- Atlanta Contemporary (Studio Program — 13 spots) — already in venues
- Creatives Project
- Mudfire Clayworks (makerspace) — already in venues
- Atlanta Clay Works
- Spruill Center for the Arts — already in venues
- Callanwolde Fine Arts Center — already in venues
- Chastain Arts Center — already in venues
- etc.

For existing venues: `UPDATE venues SET studio_type = '...', availability_status = '...', monthly_rate_range = '...', application_url = '...' WHERE slug = '...'`
For new venues: Use `get_or_create_venue()` with full venue data + studio fields.

- [ ] **Step 3: Create TypeScript types + API**

Types in `web/lib/types/studios.ts` (extends venue with studio fields). API at `web/app/api/studios/route.ts` — queries `venues WHERE studio_type IS NOT NULL`, portal-scoped via city filter.

- [ ] **Step 4: Create StudioCard + StudiosDirectory components**

StudioCard: name, studio_type, neighborhood, availability status badge, rate range, link
StudiosDirectory: filterable list (by studio_type, availability_status)

- [ ] **Step 5: Create studios page**

`web/app/[portal]/studios/page.tsx` — simple server-rendered directory

- [ ] **Step 6: Browser-test**

- Studios page renders with seeded data
- Availability badges display correctly
- Links work (website, application)
- Venue links to existing venue detail pages

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/ web/lib/types/studios.ts web/lib/studios.ts web/app/api/studios/ web/app/\[portal\]/studios/ web/components/arts/Studio*.tsx
git commit -m "feat(arts): studios & workspaces directory via venue fields"
```

---

## Task 10: Arts Portal Navigation & Feed Configuration

**Files:**
- Modify: `web/app/[portal]/layout.tsx` or nav configuration
- Create: `supabase/migrations/YYYYMMDD_arts_feed_sections.sql`
- Verify: Portal theme tokens apply correctly

- [ ] **Step 1: Verify nav labels from portal config**

The arts portal migration (447) sets custom nav labels:
- feed → "What's On"
- find → "Browse"
- community → "Artists"
- spots → "Venues"

Verify these are being applied in the portal layout. If the nav system doesn't support custom labels yet, add that support.

- [ ] **Step 2: Create ArtsSecondaryNav component**

Following the `CivicTabBar` pattern (used by HelpATL), create `web/components/arts/ArtsSecondaryNav.tsx`:
- Horizontal tab bar below the main portal header
- Tabs: What's On | Exhibitions | Open Calls | Artists | Studios
- Active state: copper accent underline
- `sm:hidden` on mobile (tabs go into mobile nav)
- Only renders when `vertical === "arts"` (conditionally included in portal layout)

This is the established pattern for portal-specific nav — HelpATL's `CivicTabBar` does the same thing for civic-specific sections.

- [ ] **Step 3: Configure feed sections for arts portal**

Insert feed section configurations for the arts portal feed ("What's On"):
- "Currently Showing" — exhibitions currently on view
- "Opening This Week" — exhibitions opening soon
- "Closing Soon" — exhibitions in final 7 days
- "Open Calls" — featured open calls with nearest deadlines
- "Upcoming Events" — arts events from subscribed sources

- [ ] **Step 4: Verify portal theme**

Load `http://localhost:3000/arts-atlanta`. Verify:
- Dark warm canvas background (#12100E / #141210)
- Copper accent (#D4944C / #C9874F) on CTAs and highlights
- Space Grotesk for headings
- IBM Plex Mono for body text
- Zero corner radius on cards
- Stroke-defined cards (border, no fill)
- No glass effects

If theme tokens aren't applying correctly, check `PortalTheme.tsx` and the portal's branding config.

- [ ] **Step 5: Browser-test full portal**

Navigate through all 5 screens:
1. Feed/What's On — exhibitions + events + open calls preview
2. Open Calls — full board with filters
3. Exhibitions — browse with filters
4. Artists (existing) — now with exhibition timeline
5. Studios — directory

Check at 375px mobile. Check that all links work. Check empty states.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ web/app/\[portal\]/
git commit -m "feat(arts): portal navigation, feed sections, and theme verification"
```

---

## Task 11: TypeScript Build + Final Verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build with no errors

- [ ] **Step 2: Run tests**

Run: `cd web && npx vitest run`
Run: `cd crawlers && python3 -m pytest`
Expected: All pass

- [ ] **Step 3: Verify data density**

Check that the portal has enough content to not feel empty:
- Open Calls: 10+ active listings
- Exhibitions: 20+ currently showing
- Artists: Auto-generated from exhibition data
- Studios: 15+ seeded

- [ ] **Step 4: Production-quality checklist**

- [ ] Every link works (no 404s)
- [ ] Empty states degrade gracefully
- [ ] Zero console errors
- [ ] Works at 375px mobile
- [ ] External links (application URLs) open in new tab
- [ ] Confidence tier badges render correctly
- [ ] Deadline urgency treatment works
- [ ] Artist profile links work from exhibition cards
- [ ] "Closing soon" treatment on exhibitions works

- [ ] **Step 5: Final commit**

```bash
git commit -m "feat(arts): Lost Arts portal — complete with Open Calls, exhibitions, artist profiles, studios"
```

---

## Execution Notes

### Parallelization Opportunities

Tasks 2-4 (crawlers) are fully independent and can run in parallel with each other AND with Tasks 5-6 (frontend components). Task 7 (exhibition pages) needs crawled data for browser testing but the code can be written in parallel. The dependency graph:

```
Task 1 (schema) ──┬── Tasks 2-4 (crawlers) ──────────┐
                  │                                    │
                  ├── Task 5 (Open Calls frontend) ───┤
                  │                                    ├── Task 10 (nav + feed)
                  ├── Task 6 (personal pipeline) ─────┤         │
                  │                                    │         │
                  ├── Task 7 (exhibitions frontend) * ─┤    Task 11 (verify)
                  │                                    │
                  ├── Task 8 (artist Living CV) * ─────┤
                  │                                    │
                  └── Task 9 (studios) ────────────────┘

  * Task 7 code can be written in parallel, but browser testing
    requires exhibition data from Tasks 2-4 crawlers.
  * Task 8 browser testing requires artist records from Task 4.
```

- **Wave 1:** Task 1 (schema + prerequisites — blocks everything)
- **Wave 2:** Tasks 2, 3, 4 (crawlers) + Tasks 5, 6, 7, 8, 9 (frontend — all code can be written) — all parallel
- **Wave 3:** Task 10 (navigation + feed integration) — needs all screens to exist
- **Wave 4:** Task 11 (verification + browser testing of data-dependent screens)

### Federation Rules

- High Museum exhibitions → federate to Atlanta portal (flagship, general interest)
- Art festivals (Atlanta Art Fair, Elevate ATL) → federate to Atlanta portal
- Gallery openings (Whitespace, Marcia Wood) → stay in Arts portal
- Public art, murals, installations → federate to Atlanta + Adventure portals
- Open calls → Arts portal only
- Studios → Arts portal only
- Artist profiles → accessible from any portal via `/[portal]/artists/[slug]`

### Design Language Reminders

The Arts portal has a **completely different visual language** from Atlanta:
- **No glass effects, no glow** — `data-glow="disabled"`
- **Zero corner radius** — all cards, buttons, containers
- **Stroke borders, no fills** — cards use `border` not `bg-[var(--night)]`
- **IBM Plex Mono everywhere** except exhibition titles (Playfair Display italic) and logo/stats (Space Grotesk)
- **`// code comment` section headers** — literally use `//` prefix for section labels
- **Art provides the only color** — UI is monochrome (copper accent only), color comes from artwork images
- **Dark warm canvas** — not blue-dark like Atlanta, warm-dark (#141210)
