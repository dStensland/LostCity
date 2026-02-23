# Playbook Phase 1 — Implementation Plan

**Goal**: One person can plan an outing around an anchor event with smart before/after suggestions, a visual timeline with danger zone warnings, and a shareable link.

**Key constraint**: No group features. Solo planning only. Authentication required (no localStorage fallback — Playbook is a premium feature).

---

## Relationship to Existing Systems

### Existing `plans` system
The codebase has an existing group plans system (`plans`, `plan_items`, `plan_participants`, `plan_suggestions` tables + `usePlans.ts` hook + `/api/plans/` routes). This system has participants, suggestions, and RLS policies.

**Strategy**: Playbook Phase 1 creates its own `playbooks` table that wraps `itineraries` (for walk time/distance calculations). In Phase 3, we'll merge the `plans` system into Playbook or deprecate it. For now, they coexist — `plans` is lightweight group coordination, Playbook is structured outing planning with venue intelligence.

### Existing itinerary system
`itineraries` + `itinerary_items` tables have all the spatial/temporal columns we need (walk_distance_meters, walk_time_minutes, duration_minutes, lat/lng). The `useItinerary` hook handles CRUD. Playbook wraps this — `playbooks` table adds lifecycle status, share tokens, and (later) group features on top.

### Existing scaffolding
Current files (`OutingDrawer.tsx`, `OutingSuggestions.tsx`, `OutingFAB.tsx`, `PlaybookView.tsx`) are Phase 1 scaffolding. Most will be refactored or replaced:
- `OutingSuggestions.tsx` — **KEEP** (fetches and displays before/after suggestions)
- `OutingFAB.tsx` — **KEEP** (floating action button pattern)
- `OutingDrawer.tsx` — **REPLACE** with full-page PlaybookEditor
- `PlaybookView.tsx` — **KEEP as-is** (this is the "What's On" discovery feed, not the planning tool)

---

## Build Order (6 steps)

### Step 1: Database Migration

**New file**: `supabase/migrations/YYYYMMDD_playbooks.sql`

```sql
CREATE TABLE playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'polling', 'planning', 'ready', 'live', 'complete')),
  date DATE,
  share_token TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_playbooks_creator ON playbooks(creator_id, status);
CREATE INDEX idx_playbooks_portal ON playbooks(portal_id);
CREATE UNIQUE INDEX idx_playbooks_share_token ON playbooks(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_playbooks_itinerary ON playbooks(itinerary_id);

-- RLS
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playbooks_select" ON playbooks FOR SELECT USING (
  auth.uid() = creator_id
  OR share_token IS NOT NULL -- public via share link (Phase 2 will add member check)
);
CREATE POLICY "playbooks_insert" ON playbooks FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "playbooks_update" ON playbooks FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "playbooks_delete" ON playbooks FOR DELETE USING (auth.uid() = creator_id);
```

Phase 1 only needs `playbooks`. Group tables (`playbook_members`, `playbook_item_participants`, `playbook_proposals`, etc.) are deferred to Phase 3.

---

### Step 2: Types & Utilities

**New file**: `web/lib/playbook-types.ts`

Core TypeScript types for the Playbook system:

```typescript
export type PlaybookStatus = 'draft' | 'polling' | 'planning' | 'ready' | 'live' | 'complete';

export type Playbook = {
  id: string;
  itinerary_id: string;
  portal_id: string;
  creator_id: string;
  title: string;
  status: PlaybookStatus;
  date: string | null;
  share_token: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PlaybookStop = {
  id: string;
  item_type: 'event' | 'venue' | 'custom';
  position: number;
  start_time: string | null;
  duration_minutes: number;
  walk_distance_meters: number | null;
  walk_time_minutes: number | null;
  notes: string | null;
  is_anchor: boolean;
  // Joined data
  event?: { id: number; title: string; start_time: string | null; image_url: string | null; venue: VenueInfo } | null;
  venue?: VenueInfo | null;
  custom_title?: string | null;
  custom_lat?: number | null;
  custom_lng?: number | null;
};

export type VenueInfo = {
  id: number;
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  venue_type: string | null;
  neighborhood: string | null;
};

export type PlaybookDetail = Playbook & {
  stops: PlaybookStop[];
};

export type DangerZoneLevel = 'safe' | 'warning' | 'danger';

export type ConnectorStatus = {
  walk_minutes: number;
  buffer_minutes: number;
  level: DangerZoneLevel;
};
```

**New file**: `web/lib/playbook-utils.ts`

Pure utility functions:

- `getBufferLevel(bufferMinutes: number): DangerZoneLevel` — 15+ green, 5-15 yellow, <5 red
- `getDefaultDuration(category: string): number` — maps venue type to default minutes
- `computeTimeline(stops: PlaybookStop[], anchorIndex: number): ComputedStop[]` — backward/forward time calculation from anchor
- `computeConnectors(stops: ComputedStop[]): ConnectorStatus[]` — walk time + buffer between each pair
- `formatPlaybookTime(time: string | null): string` — format for display

These build on existing functions from `itinerary-utils.ts` (`haversineDistanceMeters`, `estimateWalkMinutes`).

---

### Step 3: API Routes

Follow the existing pattern from `/api/itineraries/route.ts` — `withAuth`, `serviceClient`, rate limiting, input validation.

**New file**: `web/app/api/playbooks/route.ts`

```
GET  /api/playbooks?portal_id={id}     — List user's playbooks
POST /api/playbooks                     — Create playbook (creates underlying itinerary too)
```

POST creates both an itinerary and a playbook in one call. Generates a share token. If `anchor_event_id` is provided, adds it as the first itinerary item.

**New file**: `web/app/api/playbooks/[id]/route.ts`

```
GET    /api/playbooks/{id}              — Full playbook with stops (joined event/venue data)
PATCH  /api/playbooks/{id}              — Update title, status, date
DELETE /api/playbooks/{id}              — Delete playbook + itinerary
```

GET returns `PlaybookDetail` — the playbook row + all itinerary items with their event/venue joins, ordered by position.

**New file**: `web/app/api/playbooks/[id]/items/route.ts`

```
POST /api/playbooks/{id}/items          — Add stop
```

Accepts: `{ item_type, event_id?, venue_id?, custom_title?, start_time?, duration_minutes?, position? }`
Auto-calculates walk time from previous stop.

**New file**: `web/app/api/playbooks/[id]/items/[itemId]/route.ts`

```
PATCH  /api/playbooks/{id}/items/{itemId}   — Update stop (time, duration, notes)
DELETE /api/playbooks/{id}/items/{itemId}   — Remove stop
```

**New file**: `web/app/api/playbooks/[id]/items/reorder/route.ts`

```
PATCH /api/playbooks/{id}/items/reorder     — Reorder stops
```

Accepts: `{ item_ids: string[] }` — array of item IDs in new order. Recalculates walk times between all stops.

**New file**: `web/app/api/playbooks/share/[token]/route.ts`

```
GET /api/playbooks/share/{token}            — Public playbook view via share link
```

No auth required. Returns read-only `PlaybookDetail`. This powers the Phase 2 invitee view and the immediate share-link preview.

**Extend existing**: `web/app/api/portals/[slug]/outing-suggestions/route.ts`

Add `user_id` optional parameter to incorporate user preferences from `user_preferences` table when available. Add meal timing logic (backward calculation from anchor time).

---

### Step 4: `usePlaybook` Hook

**New file**: `web/lib/hooks/usePlaybook.ts`

TanStack Query-based hook following the `usePlans.ts` pattern:

```typescript
// Core queries
export function usePlaybook(id: string | null)           // GET /api/playbooks/{id}
export function usePlaybooks(portalId: string)            // GET /api/playbooks?portal_id=
export function usePlaybookByShareToken(token: string)    // GET /api/playbooks/share/{token}

// Mutations
export function useCreatePlaybook()                       // POST /api/playbooks
export function useAddPlaybookStop(playbookId: string)    // POST /api/playbooks/{id}/items
export function useUpdatePlaybookStop(playbookId: string) // PATCH /api/playbooks/{id}/items/{itemId}
export function useRemovePlaybookStop(playbookId: string) // DELETE /api/playbooks/{id}/items/{itemId}
export function useReorderPlaybookStops(playbookId: string) // PATCH /api/playbooks/{id}/items/reorder
export function useUpdatePlaybook(playbookId: string)     // PATCH /api/playbooks/{id}
```

Each mutation uses `queryClient.invalidateQueries({ queryKey: ["playbook", playbookId] })` on success. Phase 2+ will add optimistic updates.

---

### Step 5: Playbook Page & Components

**Route**: `web/app/[portal]/playbook/[id]/page.tsx`

Full-page route following the event detail page pattern:
- `generateMetadata()` for OG tags (title, date, anchor image)
- `PortalHeader` with back navigation
- `PlaybookEditor` as main content

**New components** under `web/components/playbook/`:

| Component | Purpose |
|-----------|---------|
| `PlaybookEditor.tsx` | Main layout: header + timeline + suggestions panel |
| `PlaybookTimeline.tsx` | Vertical timeline rendering all stops with connectors |
| `TimelineBlock.tsx` | Single stop: venue info, time, duration, category badge, anchor star |
| `TimelineConnector.tsx` | Walk time + buffer + danger zone indicator between blocks |
| `TimelineAddButton.tsx` | "+" button between blocks to add a stop |
| `StopEditSheet.tsx` | Bottom sheet for editing a stop: time stepper, duration, move, delete |
| `PlaybookSuggestionPanel.tsx` | Wraps existing OutingSuggestions with collapsible container |
| `PlaybookHeader.tsx` | Title (editable), date, share button, status badge |
| `DangerZoneInline.tsx` | Color-coded warning with math display |

**Component tree**:
```
PlaybookEditor
  PlaybookHeader          (title, date, share, back)
  PlaybookTimeline        (scrollable)
    TimelineBlock[]       (tap opens StopEditSheet)
    TimelineConnector[]   (walk time + DangerZoneInline)
    TimelineAddButton[]   (between each pair of blocks)
  PlaybookSuggestionPanel (collapsible, Before/After tabs)
    OutingSuggestions      (existing component, reused)
  StopEditSheet           (portal/sheet, opens on block tap)
```

**Desktop layout** (1024px+): Two-column. Timeline left, suggestions sidebar right (sticky).

**Visual identity**:
- Timeline spine: thin vertical line in `--neon-cyan` at 20% opacity
- Blocks: `--night` background, `--twilight` border, left-edge accent bar in category color
- Anchor block: gold left border, `--gold` star badge, `--gold` glow shadow
- Connectors: color transitions (green → yellow → red) with 300ms ease
- Block entrance animation: `contentReveal` keyframe (existing)
- Danger pulse: existing `pulse-glow` keyframe on red state only

---

### Step 6: Wire Entry Points

**Modify**: `web/components/find/FindShell.tsx`

Update `handlePlanAroundEvent`:
1. Call `useCreatePlaybook` mutation with anchor event data
2. On success, navigate to `/${portalSlug}/playbook/${playbook.id}`
3. The FAB (OutingFAB) updates to show active playbook with stop count

**Modify**: `web/components/find/PlaybookCard.tsx`

Update "Plan around this" button:
- Currently only visible on hover — add always-visible small icon button on mobile (no hover on touch)
- OnClick calls `handlePlanAroundEvent` (already wired)

**Post-RSVP CTA** (if time permits):

Find where RSVP confirmation happens and add a "Make a night of it?" prompt that creates a Playbook with the RSVP'd event as anchor.

---

## Files Summary

### New Files (13)

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_playbooks.sql` | Playbooks table + indexes + RLS |
| `web/lib/playbook-types.ts` | TypeScript type definitions |
| `web/lib/playbook-utils.ts` | Pure utility functions (timeline calc, danger zones, duration defaults) |
| `web/lib/hooks/usePlaybook.ts` | TanStack Query hooks for playbook CRUD |
| `web/app/api/playbooks/route.ts` | List + create playbooks |
| `web/app/api/playbooks/[id]/route.ts` | Get + update + delete playbook |
| `web/app/api/playbooks/[id]/items/route.ts` | Add stop |
| `web/app/api/playbooks/[id]/items/[itemId]/route.ts` | Update + delete stop |
| `web/app/api/playbooks/[id]/items/reorder/route.ts` | Reorder stops |
| `web/app/api/playbooks/share/[token]/route.ts` | Public share view |
| `web/app/[portal]/playbook/[id]/page.tsx` | Full-page playbook route |
| `web/components/playbook/PlaybookEditor.tsx` | Main editor layout |
| `web/components/playbook/PlaybookTimeline.tsx` | Timeline with blocks + connectors |

### Additional Components (6)

| File | Purpose |
|------|---------|
| `web/components/playbook/TimelineBlock.tsx` | Single stop block |
| `web/components/playbook/TimelineConnector.tsx` | Walk time + buffer + danger zone |
| `web/components/playbook/TimelineAddButton.tsx` | "+" insert button |
| `web/components/playbook/StopEditSheet.tsx` | Quick-edit bottom sheet |
| `web/components/playbook/PlaybookHeader.tsx` | Header with title, share, back |
| `web/components/playbook/PlaybookSuggestionPanel.tsx` | Wraps OutingSuggestions |
| `web/components/playbook/DangerZoneInline.tsx` | Inline timing warning |

### Modified Files (3)

| File | Change |
|------|--------|
| `web/components/find/FindShell.tsx` | Update `handlePlanAroundEvent` to create playbook + navigate to full page |
| `web/components/find/PlaybookCard.tsx` | Make "Plan around this" visible on mobile (not hover-only) |
| `web/app/api/portals/[slug]/outing-suggestions/route.ts` | Add user preferences + meal timing logic |

### Kept As-Is (3)

| File | Why |
|------|-----|
| `web/components/outing/OutingSuggestions.tsx` | Reused inside PlaybookSuggestionPanel |
| `web/components/outing/OutingFAB.tsx` | Updated to link to playbook page route |
| `web/components/find/PlaybookView.tsx` | This is the discovery feed, not the planning tool |

---

## Verification Checklist

1. Navigate to `/{portal}?view=find&type=playbook` — What's On feed works as before
2. Tap "Plan around this" on an event → creates playbook → navigates to `/{portal}/playbook/{id}`
3. Playbook page shows anchor event in timeline with gold treatment
4. Suggestion panel shows before/after suggestions with walk times
5. Tap a suggestion → adds it to timeline → walk time connector appears
6. Tap a timeline block → quick-edit sheet opens → can change time (15-min stepper), duration, reorder, delete
7. Danger zone: extend a pre-event stop → connector turns yellow/red with timing math
8. The "+" button between blocks → can search for a venue or add custom stop
9. Share button generates link → opening link shows read-only playbook view
10. FAB shows active playbook when navigating away → tap returns to playbook
11. `npm run build` passes — no TypeScript errors
12. `npm run lint` passes — no ESLint errors

---

## Scope Boundaries

**In scope for Phase 1:**
- Anchor-based flow (from "Plan around this" on event cards)
- Full-page timeline editor with tap-to-edit
- Before/after smart suggestions
- Danger zone warnings
- Share link (read-only view)
- OG meta tags for share link preview
- Manual stop addition (search + custom)

**Explicitly NOT in Phase 1:**
- Cold start flow (no anchor) — Phase 3
- Group features (invites, RSVP, participants) — Phase 2-3
- Drag-to-reorder — Phase 2
- Availability polling — Phase 3
- Proposals / suggestions / vibes — Phase 3
- Post-RSVP CTA — nice-to-have, add if time permits
- Live mode — Phase 4
- Post-outing flow — Phase 4
