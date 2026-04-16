# My Plans — Design Spec

**Date:** 2026-04-15
**Replaces:** Calendar workstream (sections 4.1–4.9 of atlanta-launch-readiness-design.md)
**Philosophy:** Calendar is downstream of discovery, not parallel to it. The feed handles temporal discovery. This surface shows what you've committed to, who else is going, and where your week is open.

---

## 0. Core Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Route structure | Collapse /calendar into /plans | Calendar as separate primitive doesn't earn its slot; commitments are the real primitive |
| Tier philosophy | Strict commitments + friends overlay | No soft tiers (interested, saved) — if it's on here, you said yes. Friends are visually distinct |
| Structural primitive | Chronological agenda | Day headers, entries, gap rows. Scroll = forward in time |
| Calendar view | Month-only minimap | Density scan + navigation aid. No week view, no event chips in cells |
| Series model | RSVP to series, materialize individual RSVPs | Commit once, calendar fills. Gated on series_type |
| Gap mechanic | Day-level inline CTAs | Empty day = gap row linking to Explore with date pre-filled |
| Plan rendering | Single row, expandable | Multi-stop plans collapsed by default; 1-stop plans render flat |
| Friends overlay | Avatar-stack shared events, dimmer standalone rows | Dedup on shared; friend-only rows at 70% opacity below yours |
| Navigation | 4th top tab: Discover / Explore / Plans / People | Funnel ordering: discover → explore → commit → connect |
| Empty state | Honest first-session, sparse-week suggestions | First visit: CTA to Explore. After first RSVP: ghost rows for thin weeks |
| /saved page | Simplified to bookmarks only | Strip RSVPs and Invites tabs; flat stash, not a planning surface |

---

## 1. Data Model

### 1.1 New Table: `user_series_subscriptions`

```sql
create table user_series_subscriptions (
  user_id uuid references auth.users not null,
  series_id uuid references series(id) not null,
  portal_id text not null,
  subscribed_at timestamptz default now(),
  primary key (user_id, series_id)
);

alter table user_series_subscriptions enable row level security;

create policy subs_select_own on user_series_subscriptions
  for select using (user_id = auth.uid());
create policy subs_insert_own on user_series_subscriptions
  for insert with check (user_id = auth.uid());
create policy subs_delete_own on user_series_subscriptions
  for delete using (user_id = auth.uid());
```

Subscription affordance gated on `series.series_type IN ('recurring_show', 'class_series')`. Film, festival_program, tour, other are per-instance RSVP only. Enforce at DB level with a before-insert trigger that validates the series type.

### 1.2 New Column: `event_rsvps.source`

```sql
alter table event_rsvps add column source text default 'manual'
  check (source in ('manual', 'subscription'));
```

Discriminates subscription-materialized RSVPs from manual ones. Required for safe unsubscribe (only delete `source = 'subscription'` rows). When a user manually flips a subscription-created RSVP back to going, set `source = 'manual'` to protect it from unsubscribe cleanup.

### 1.3 Materialization Strategy

**On subscribe:**
- Insert `event_rsvps` rows with `status='going', source='subscription'` for all future instances of the series
- Skip events where the user already has an RSVP (ON CONFLICT DO NOTHING)

**Postgres trigger on `events` insert:**
- When `new.series_id` matches an active subscription, auto-insert `event_rsvps(user_id, event_id, status='going', source='subscription')`
- Use `INSERT ... ON CONFLICT DO NOTHING` to handle race conditions
- **Migration ordering:** (a) add `source` column to `event_rsvps`, (b) THEN alter the existing `create_rsvp_activity()` trigger to add `WHEN (NEW.source != 'subscription')` condition. The trigger guard references the `source` column and will fail if it doesn't exist yet.

**Subscribe activity:** The `/api/series/:id/subscribe` endpoint creates a single "subscribed to [Series Name]" activity row after materialization completes. This replaces the N individual RSVP activities that the trigger would have generated.

**Post-subscribe reconciliation:** After the subscribe transaction commits, run a reconciliation query that picks up any events inserted in the last 60 seconds for that series. Handles the narrow race window between subscribe and trigger.

**On unsubscribe:**
- Delete the subscription row
- Bulk-delete future `event_rsvps` where `source = 'subscription'` AND `status = 'going'` for that user + series
- Rows where `source = 'manual'` (user independently RSVPed or manually re-committed) are preserved
- Confirmation UX: "Unsubscribe from Trivia Tuesday? This removes N upcoming RSVPs."

### 1.4 API Changes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/series/:id/subscribe` | POST | Create subscription + materialize RSVPs |
| `/api/series/:id/subscribe` | DELETE | Unsubscribe + bulk cleanup |

No changes to:
- `/api/rsvp` — individual flips work as today
- `/api/user/calendar` — materialized RSVPs appear in existing `event_rsvps` query
- `/api/user/calendar/friends` — already returns friends' RSVPs
- Feed queries — untouched

---

## 2. Surface Architecture

### 2.1 Route Structure

| Route | Purpose |
|-------|---------|
| `/[portal]/plans` | Commitment surface (replaces /calendar) |
| `/[portal]/plans/[id]` | Group Plan detail (unchanged) |
| `/[portal]/plans/share/[token]` | Shared Plan landing (unchanged) |
| `/calendar`, `/[portal]/calendar` | Redirect to `/[portal]/plans` |
| `/saved` | Simplified to bookmarks only |

### 2.2 Navigation

Top nav: **Discover | Explore | Plans | People**

- "Plans" links to `/[portal]/plans`
- "People" replaces "Your People" (parallel single-word labels)
- Funnel ordering: discover → explore → commit → connect

### 2.3 Views

**Primary: Agenda view.** Chronological list of commitments, friends' overlapping RSVPs, gap rows. Loads on tab click.

**Secondary: Month minimap.** Toggle in page header. Density-first month grid — dot counts per cell, no event chips. Tap cell = smooth-scroll agenda to that day. Navigation aid, not a second primary view.

No week view. No separate mobile view (agenda is mobile-first).

**Find surface calendar mode:** `web/components/find/EventsCalendarMode.tsx` currently imports `CalendarView` and `MobileCalendarView` (both deleted in this spec). Strip the calendar mode toggle from the Find/Explore surface entirely — the Find page uses list and grid modes only. The agenda lives on /plans, not embedded in Explore.

**Film portal calendar:** `/[portal]/calendar/page.tsx` has film-specific chrome (`FilmPortalNav`, `resolveFilmPageRequest`). Film portals collapse into /plans like all other portals. Any film-specific navigation chrome on the Plans surface is handled by the portal theming system, not a separate route.

### 2.4 Header Bar

- Left: "Plans" title + current month context (visible in month view, hidden in agenda)
- Right: agenda/month toggle icon, "New Plan" button (existing group Plan creation flow)
- Friends filter: icon that opens existing `FilterSheet` for friend selection

---

## 3. Agenda Entry Types

Five entry types share the timeline. Visual differentiation uses **two semantic tiers** (yours vs. theirs), not five colors. The left-edge indicator's job is "mine vs not mine" — zero-learning on first load. Entry subtype differentiation is handled by tag pills and row treatment.

### 3.0 Visual Tier System

- **Yours tier:** Solid left-edge indicator in `var(--coral)`. All your commitments (RSVP, series, Plan) share this accent. Subtype differences communicated via tag pill (none for RSVP, "weekly" for series, "plan" for Plan) and row structure (expandable for multi-stop Plans).
- **Theirs tier:** Solid left-edge indicator in `var(--vibe)`. 70% opacity, lighter font weight. All friend entries use this treatment.
- **Gap:** No left-edge indicator. Dashed border. Visually distinct from both tiers.

### 3.1 RSVP (yours tier, no tag pill)

Your commitment to a single event. Standard row: title, time, venue. Friend avatars stack on the right when friends are also going to the same event (dedup — no separate friend row for shared events). `role="listitem"` with `aria-label` including event title and date.

### 3.2 Series (yours tier, frequency tag pill)

Same visual weight as RSVP — it IS an RSVP, just recurring. Distinguished by a frequency tag pill derived from `series.frequency` (e.g., "weekly", "biweekly", "monthly"). The tag pill is the only differentiator at a glance.

### 3.3 Plan (yours tier, "plan" tag pill, expandable)

Group Plan objects. Multi-stop plans render as a single collapsed row: "ATLFF Opening Night · 3 stops · 6pm – late" with "plan" tag pill and participant avatar cluster. Tap to expand stops inline (time + venue per stop). Single-stop plans render as a flat row with participant avatars — no expand affordance needed.

### 3.4 Friend (theirs tier)

Friend-only RSVPs (events you haven't committed to). 70% opacity, lighter font weight, `var(--vibe)` left-edge accent. Render below your entries for the same day. Tap opens event detail where you can RSVP yourself — this is the social conversion funnel. `aria-label` includes friend name and event title.

### 3.5 Gap (dashed border, warm CTA)

Day with zero personal commitments. Dashed border, Phosphor `Sparkle` icon in warm coral tint, "Friday is open" text with "Find something for Friday →" CTA. Links to `/[portal]/explore?date=YYYY-MM-DD`. Visually light but present. `role="listitem"` with `aria-label="Friday April 17 is open. Explore events."`

---

## 4. Month Minimap

- Cells show 1-3 dots for commitment count in `var(--cream)` at varying opacity. 4+ shows a small count badge.
- Days with friend-only events (no personal commitments): single dot in `var(--vibe)`.
- Today: ring highlight in `var(--gold)`.
- Tap cell: smooth-scroll agenda to that day.
- Header: month/year + left/right arrows. "Today" button always visible, dimmed when already on current month.
- No event chips, no titles, no hover previews.

---

## 5. Empty State

### 5.1 First-Session Empty State (zero RSVPs ever)

When the user has never RSVPed to anything, show an honest empty state that teaches the surface's job:
- Headline: "Your plans live here"
- Description: "RSVP to events, subscribe to series, build plans with friends. Everything you commit to shows up on this timeline."
- Primary CTA: "Explore what's happening →" linking to `/[portal]/explore`
- Secondary CTA: "Browse series →" linking to `/[portal]/explore?view=series`

No ghost rows. The spec's core principle is "if it's on here, you said yes" — fake suggestions on first load violate this and teach the wrong mental model.

### 5.2 Sparse-Week Suggestions (has RSVPs, thin week)

After a user has at least one RSVP (the surface shape is understood), seed empty weeks with up to 3 suggestion rows from the feed's Lineup pipeline, filtered to this week + next week, sorted by FORTH score. Render as ghost rows: lower opacity, dashed left indicator, "RSVP" action button per row (RSVPing converts the ghost row into a real agenda entry). Query is best-effort with a 2-second timeout; on failure, render gap rows normally.

Below ghost rows: "Browse more on Explore →" link.

### 5.3 Bare Fallback

If the feed pipeline returns no events (new portal, no data): gap rows render normally with Explore CTAs. No ghost rows.

---

## 6. /saved Simplification

- Strip RSVPs and Invites tabs from `DashboardPlanning`
- /saved becomes a single flat list of bookmarked events and venues
- Keep existing Upcoming/Past sub-filter
- Empty state: "Save events you're curious about. Your stash lives here." + Explore CTA

---

## 7. Component Reuse & Deletion

### Reuse as-is
- `CalendarProvider` (state management)
- `useCalendarData` hooks (`useCalendarEvents`, `useFriendCalendarEvents`, `useFriendsList`)
- All sheets: `CreatePlanSheet`, `AddToPlanSheet`, `EventPreviewSheet`, `ChangeRSVPSheet`, `ConflictSheet`, `FilterSheet`

### Reuse with modification
- `AgendaView` → refactor as primary view with entry type variants
- `MonthGrid` → strip to density-only (remove event chips path)
- `DayCell` → simplify to dot count rendering
- `EmptyState` → seeded suggestions variant
- `CalendarHeader` → new layout, remove `backdrop-blur-md`
- `OpenTimeBlock` → pattern becomes gap row component

### Build new
- Gap row component (dashed border, sparkle icon, explore link)
- Seeded empty state (ghost rows from feed query)
- Series subscribe button + confirmation sheet
- Agenda entry variants (RSVP, Plan expandable, series, friend)
- Month/agenda toggle
- Nav tab addition ("Plans")

### Delete
- `WeekView.tsx`
- `CalendarViewToggle.tsx` (replaced by simpler toggle)
- `CalendarSkeleton.tsx` (replaced with agenda-shaped skeleton)
- `HoverPreviewCard.tsx`
- `MobileCalendarView.tsx` (agenda is mobile-first)
- `EventsCalendarMode.tsx` (strip calendar mode from Find/Explore surface)
- Film-specific calendar page chrome (absorbed by portal theming on /plans)

---

## 8. Interactions & Behavior

**Agenda tap targets:**
- RSVP/series/friend row → event detail page (existing `EventDetailView`)
- Plan row body → expand/collapse stops inline (multi-stop); plan title link → Plan detail page
- Gap row → `/[portal]/explore?date=YYYY-MM-DD`
- Friend avatar on shared event → friend's profile

**Month minimap tap:**
- Cell → smooth-scroll agenda to that day
- Today button → scroll to today in current view

**Friends toggle:**
- Opens `FilterSheet` with friend selector
- Default: all friends visible
- Selected friends filter both agenda friend rows and month minimap friend dots

**Series subscription (from series detail page, not from /plans):**
- "I'm a regular" button on series detail for `recurring_show`/`class_series` types
- Confirmation: "Subscribe to Trivia Tuesday? You'll be RSVP'd to all upcoming dates."
- After subscribe: agenda populates with materialized instances
- Individual instance: can flip to "not going" without unsubscribing

---

## 9. Scope Boundaries

**In scope:**
- Route collapse (/calendar → /plans redirect)
- Navigation change (4th tab)
- Agenda view with 5 entry types
- Month minimap (density-only)
- Series subscription data model + API
- `event_rsvps.source` column migration
- /saved simplification
- Empty state with seeded suggestions

**Out of scope (future iterations):**
- Weekend-collapse gap rows (grouping consecutive empty days)
- Async materialization via pg_net/pgmq (not needed at current scale)
- Rate limiting on subscribe/unsubscribe (operational, not v1)
- Audit logging for bulk operations
- Series subscription from within /plans (subscribe lives on series detail page)
- Push notifications for friend activity on plans

**Implementation note:** `series.id` is confirmed UUID (migration 018).
