# Playbook — Product Requirements Document

**Product**: LostCity Playbook
**Version**: 1.1 (Post-Design Review)
**Date**: 2026-02-23
**Status**: Design Phase — Phase 1 approved for implementation

---

## 1. Overview

### What is Playbook?

Playbook is a guided outing planning experience built into LostCity. It helps users answer three questions: **who's coming**, **when are we going**, and **what are we doing** — then turns those answers into a living, shareable itinerary with smart timing, walking directions, and real venue data.

It is NOT a browse/discovery view. It's a **planning document with a lifecycle** — from first idea to post-outing wrap-up.

### Why build this?

Group outing planning currently happens in group chats. It's chaotic, nothing gets decided, and the person who ends up planning does all the work. Playbook replaces that with a structured-but-flexible tool where:

- One person can plan solo and invite others to a finished plan
- A group can collaboratively build a plan together with polls and proposals
- Anyone can join the whole outing or just the parts they want
- The system does the hard work (timing, walkability, meal math, venue hours)

### Design philosophy

**"Fluid with rails."** Not a strict wizard. The UI adapts to the entry point and how much the user already knows. Someone who taps "Plan around this" on a concert listing skips straight to itinerary building. Someone starting cold gets a gentle interview. A group that needs to poll availability gets that flow. The rails keep things moving; the fluidity means no dead ends.

---

## 2. Core Decision Framework

Every Playbook resolves three dimensions. Each can be **decided** (one person chooses) or **collaborative** (the group decides together):

| Dimension | Decided Mode | Collaborative Mode |
|-----------|-------------|-------------------|
| **Who** (people) | Add people upfront — plan together from the start | Plan solo first, invite once it's set — "join my plan" |
| **When** (time) | Set a specific date or date range | Poll the group for availability |
| **What** (activity) | Propose a concrete agenda (anchor event + stops) | Poll for vibes and preferences, let the system suggest |

Any combination is valid:

- **Solo + decided everything** = fastest path. "I'm going to this show Saturday, need dinner before and drinks after."
- **Group + poll everything** = full collaborative. "Let's do something this weekend. When are people free? What are we in the mood for?"
- **Solo start, invite later** = hybrid. Plan it out, then share. Friends can propose changes.

---

## 3. User Roles

| Role | Description | Capabilities |
|------|-------------|-------------|
| **Instigator** | Person who creates the Playbook | Full control: add/remove stops, accept/deny proposals, set times, invite people, finalize plan |
| **Invitee** | Person invited to the Playbook | RSVP (whole plan or per-stop), propose changes, vote on proposals, submit vibes, set arrival time + commitment level |
| **Viewer** | Person with a shared link (not yet joined) | View the plan, join specific stops, request to join |

---

## 4. Playbook Lifecycle

```
draft → polling → planning → ready → live → complete
```

| Status | Description | What's happening |
|--------|-------------|-----------------|
| **Draft** | Just created, instigator is building | Adding stops, setting times, maybe solo |
| **Polling** | Sent to group for input | Availability polls open, vibes being collected |
| **Planning** | Group input received, finalizing | Instigator reviewing proposals, locking in stops |
| **Ready** | Plan is set | All stops confirmed, everyone knows the deal |
| **Live** | It's happening right now | Day-of view with real-time status |
| **Complete** | Outing is over | Ratings, photos, "do this again" prompt |

Not every Playbook hits every status. A solo plan goes draft → ready → live → complete. A group plan with polls goes through all six.

---

## 5. Entry Points

These are the moments where a user's planning intent is captured. Each should feel natural, not forced.

| Entry Point | Context | What happens |
|-------------|---------|-------------|
| **"Plan around this"** | On event cards, event detail pages, venue pages | Creates Playbook with that event/venue as the anchor. Opens outing builder with before/after suggestions. |
| **Post-RSVP CTA** | After user RSVPs "going" to an event | Prompt: "Make a night of it?" → creates Playbook with that event as anchor |
| **Cold start** | Playbook tab, empty state, or "Plan an outing" button | Starts the guided interview flow (who, when, what) |
| **Shared link** | Friend texts a Playbook link | Opens the plan view. Can join whole plan or specific stops. |
| **"Add to Playbook"** | From any event/venue/special card in the What's On view | Adds item to active Playbook, or creates new one if none active |

---

## 6. Screens & Flows

### 6.1 Cold Start Flow (no anchor) — Phase 2+

> **Design decision**: Replaced three-way fork with single linear flow. Don't fork — funnel. The "I know what I want" user just searches from the top of the same screen.

**Screen: Playbook Home**

When a user opens Playbook with no active plan, they see a single linear flow — not a decision tree.

- **Search bar at top**: For users who already know what they want — search events/venues to pick an anchor
- **Below search**: Inline guided flow (not separate screens):
  1. **When?** — Date picker (today, tomorrow, this weekend, pick a date) + time-of-day
  2. **What vibe?** — Chip selector: Chill, High energy, Foodie, Outdoors, Cultural, Romantic, "Anything goes"
  3. **Budget?** — Three options: "Keep it cheap", "Treat ourselves", "No limit"
- **Below flow**: Any active/upcoming Playbooks the user has created or been invited to
- **Below that**: Curated templates ("Classic Date Night", "Bar Crawl", "Family Day Out") as fallback content

After answering: system generates 2-3 itinerary options. User picks one and customizes. Skippable at any point — picking a search result jumps straight to the anchor-based builder.

### 6.2 Anchor-Based Flow (from "Plan around this")

> **Design decision**: Full-page route, NOT a bottom sheet. The timeline + suggestions + danger zones exceed what a drawer can hold. Nested scrolling on mobile is a UX disaster. Brief confirmation sheet on initial tap, then transition to full page.

**Screen: Outing Builder** — Full page at `/{portal}/playbook/{id}`

**Entry transition**: User taps "Plan around this" → brief bottom sheet (1-2 sec) showing "Creating your plan..." with anchor event → transitions to full-page route.

**Layout (mobile):**
- **Sticky header**: Playbook title (editable), date, share button, back arrow
- **Timeline**: Full-width vertical timeline (see Section 8)
- **Suggestion Panel**: Collapsible section below timeline, "Before" and "After" tabs
- **"+" buttons**: Between blocks to add stops (search, custom, or from suggestions)
- **Empty suggestion fallback**: When engine returns nothing, show "Search for a spot" + "Add a custom stop" — never a dead end

**Layout (desktop, 1024px+):**
- **Two-column**: Timeline left (60%), suggestions + metadata sidebar right (40%, sticky)

**Interactions:**
- Tap a suggestion to add it to the timeline
- **Tap a timeline block** to open quick-edit sheet (time stepper, duration, move up/down, delete)
- Tap "+" between blocks to manually add a stop
- Tap "Share" to generate share link

**FAB persistence**: When navigating away from this page (back to browse), FAB shows "3 stops planned" — tap to navigate back.

### 6.3 Group Assembly

**Screen: Invite Friends**

Accessible from any Playbook via the "Invite" button.

- **Contact search**: Find friends by name or username (from LostCity user base)
- **Share link**: Generate a shareable link (works for non-users too)
- **Deep-link to stop**: "Invite just for dinner" — generates a link that opens to a specific stop
- **Current members list**: Shows all invitees with their status (going/likely/tentative), arrival time, which stops they're joining

### 6.4 Availability Polling

**Screen: When Works?**

When the instigator doesn't have a set date, they can poll the group.

- **Date grid**: Shows the next 7-14 days as a grid
- **Each invitee**: Taps dates that work for them (green = works, yellow = maybe, grey = can't)
- **Results view** (instigator sees): Heatmap showing overlap. "Saturday has 5/6 people available" — tap to lock in that date
- Polling has an optional deadline: "Vote by Thursday"
- Once instigator locks a date, all members are notified

### 6.5 Invitee View

> **Design decision**: Read-heavy, input-light. A person who just tapped a link has ~3 seconds to decide. Single primary CTA, everything else is progressive disclosure.

**Screen: You're Invited**

What an invitee sees when they open a Playbook link.

- **Beautiful plan display**: All stops on the timeline with times, venues, walking distances — read-optimized, visual, enticing
- **Single primary CTA**: **"I'm in"** button (defaults to going for whole plan, "likely" commitment)
- **"Customize" expander** (secondary, below CTA): Opens to reveal:
  - Per-stop RSVP: Going / Maybe / Skip per stop
  - Arrival time: "When can you get there?" — system auto-matches them to stops
  - Commitment level: Locked in / Likely / Tentative
- **Propose changes**: Accessible but not prominent — link at bottom of the view
- **No vibe chips on this screen** — those belong in the group activity feed, not the invitation card

### 6.6 Proposals

**Screen: Propose a Change**

Any invitee can propose changes to any stop (or the whole plan).

**Proposal types:**

| Type | Example | What it looks like |
|------|---------|-------------------|
| **Change time** | "Can we do 7pm instead of 6:30?" | Time picker targeting a specific stop |
| **Change venue** | "How about Sotto instead?" | Venue search/picker, links to venue detail |
| **Add stop** | "Let's hit rooftop drinks after" | Venue/event picker + suggested time slot |
| **Remove stop** | "Skip the bar, I have work early" | Select which stop to propose removing |
| **Vibe** | "Mexican for dinner", "somewhere with a patio" | Chip/tag input — no specific venue, just a preference filter |

**Proposal card (visible to all members):**
- Who proposed it
- What the change is (clear description)
- Vote tally: yay / nay from other invitees
- Instigator action: **Accept** / **Deny** / Pending
- Accepted proposals auto-update the timeline (recalculates walk times, danger zones, etc.)
- Denied proposals stay visible but greyed out — transparency, not deletion

**Vibe proposals** work differently from the other four: they don't need accept/deny. They automatically filter the suggestion engine results. If three people chip in "Mexican", the before/after suggestions prioritize Mexican restaurants. The instigator (or anyone browsing) sees filtered results.

### 6.7 Instigator View

> **Design decision**: No separate dashboard. Group management is inline on the timeline, not a separate screen. Headcount shows on each stop block. Proposals appear as notification badges on relevant stops. "Lock plan" surfaces when all invitees have responded.

**Instigator enhancements on the timeline view:**

- **Per-stop headcount inline**: Participant avatars + count on each timeline block ("4 locked, 2 likely")
- **Pending proposals badge**: Small badge on the relevant stop block — tap to review
- **Group vibes summary**: Shown above the suggestion panel as filter chips
- **Lock plan prompt**: Auto-surfaces when system detects all invitees have responded — not a button waiting to be found
- **Nudge**: As plan date approaches, system prompts instigator "2 people haven't confirmed — send a reminder?"

### 6.8 Live Mode

**Screen: It's Go Time**

Day-of view when the Playbook status is "live."

- **Current stop highlighted**: Which stop you're at (or should be heading to)
- **Next stop countdown**: "Leave in 12 min for an 8 min walk to The Tabernacle"
- **Who's where**: Real-time indicator of which friends have arrived (optional — based on app open, not GPS tracking)
- **Quick actions**: "Running late" button (notifies group), "Change of plans" (opens proposal flow)

### 6.9 Post-Outing

> **Design decision**: Stripped to essentials. Photo sharing duplicates Instagram — cut it. "Do this again" is the only high-value action.

**Screen: How Was It?**

After the plan's time window passes, status moves to "complete."

- **Rate each stop**: Quick thumbs up/down per venue/event (feeds into future suggestion ranking)
- **"Do this again"**: One-tap to clone the Playbook for a future date — the primary CTA
- ~~Photo wall~~: Cut — duplicates Instagram Stories
- ~~Share recap~~: Cut for now — reconsider in Phase 4

---

## 7. Suggestion Engine

The suggestion engine powers the "before" and "after" recommendations when building an itinerary around an anchor event.

### How it works

Given an anchor event (time, location, date), the engine finds nearby venues and events that fit into the timeline.

**"Before" logic:**
- Target time window: anchor_start minus 3 hours → anchor_start minus 30 min
- Prioritize by category: food first (dinner/lunch timing), then drinks, then activities
- Factor in meal duration: if suggesting dinner before an 8pm show, suggest a 6:00-6:30 arrival (allows 60-90 min for a meal + 15 min buffer + walk time)

**"After" logic:**
- Target time window: anchor_end → anchor_end plus 3 hours
- Prioritize: drinks first, then late-night food, then activities
- If anchor has no end_time, estimate from category defaults

### Ranking criteria (in priority order)

1. **Walking distance**: Walkability-first. Sort by walk time, not just proximity. Prefer venues within 15 min walk.
2. **Venue hours**: Only suggest places confirmed open at the target time (uses existing `isOpenAt()`)
3. **User preferences**: Dietary restrictions, price preference, favorite neighborhoods, preferred vibes/genres (from `user_preferences` table)
4. **Group vibes**: If invitees have submitted vibe preferences ("Mexican", "patio"), filter/boost matching venues
5. **Active specials**: Venues with active specials at the target time get a boost (happy hour, live music, etc.)
6. **Party size fit**: When group size is known, filter out venues too small for the party

### Timing calculations

| Stop type | Default duration |
|-----------|-----------------|
| Quick bite | 30-45 min |
| Casual dinner | 60-75 min |
| Nice dinner | 90-120 min |
| Drinks | 45-60 min |
| Activity/sight | 60 min |

**Walk speed**: ~1.34 m/s with 20% real-world buffer (accounts for crosswalks, terrain, etc.)

**Default buffer before anchor events**: 15 minutes (configurable by user)

### Suggestion card data

Each suggestion displays:
- Venue name + type badge (Restaurant, Bar, Gallery, etc.)
- Category icon (food, drinks, activity, sight)
- Walking time from anchor ("8 min walk")
- Suggested time ("6:30 PM")
- Active special if any ("Happy hour until 7pm")
- Reason text ("Great dinner spot, 8 min walk from the venue")
- Price indicator
- Image (venue hero image if available)

---

## 8. Itinerary Timeline

The timeline is the visual heart of the Playbook. It shows all stops in order with timing, walking connections, and status indicators.

### Layout

Vertical timeline, each stop is a **block**:

```
 6:30 PM ┌──────────────────────────────┐
         │  Osteria 832                 │
         │  Casual dinner               │
         │  $$ · Italian · 4.2 stars    │
         │  👤👤👤👤 (4 going)           │
 7:45 PM └──────────────────────────────┘
              │ 8 min walk (0.4 mi)
              │ 🟢 15 min buffer
 8:00 PM ┌──────────────────────────────┐
         │  ★ The Tabernacle            │  ← anchor (star badge)
         │  Live Music · Doors 8pm      │
         │  👤👤👤👤👤👤 (6 going)       │
10:30 PM └──────────────────────────────┘
              │ 5 min walk (0.2 mi)
10:35 PM ┌──────────────────────────────┐
         │  Sister Louisa's             │
         │  Drinks · Dive bar           │
         │  $ · Open until 2am          │
         │  👤👤 (2 going)              │
11:30 PM └──────────────────────────────┘
```

### Block contents

Each block shows:
- **Time**: Start time (left-aligned, monospace)
- **Venue name**: Primary text, bold
- **Type/category**: Subtitle line (cuisine, venue type)
- **Price + rating**: Metadata line
- **Participant avatars**: Stacked circles showing who's joining this stop (with count)
- **Duration bar**: Visual indicator of how long this stop lasts (the block height)
- **Active special badge**: If the venue has a relevant special at that time

### Connectors between blocks

Between each block:
- **Walk time**: "8 min walk (0.4 mi)" with a walking icon
- **Buffer indicator**: Color-coded (see Danger Zone below)
- **Arrival markers**: "Alex arrives at 7:45" — shows when late-joining invitees catch up

### Anchor event

The anchor event (the thing the whole plan is built around) has special treatment:
- **Star badge** on the position indicator
- **Immovable time**: Drag handles are greyed out — you can't move the anchor
- **Visual distinction**: Different background color or border (gold/accent)
- Everything before the anchor calculates **backwards** from anchor start
- Everything after calculates **forwards** from anchor end

### Editing interactions

> **Design decision**: Phase 1 uses tap-to-edit (accessible, mobile-friendly, no scroll/drag conflicts). Drag-to-reorder added as progressive enhancement in Phase 2+ via `@dnd-kit`.

**Phase 1 — Tap-to-edit:**
- **Tap a block**: Opens quick-edit sheet with: time stepper (15-min increments), duration picker, move up/move down buttons, delete action
- **Tap connector**: Opens quick-edit for the adjacent stop
- All timing recalculation happens client-side in pure JS (no API call during interaction)
- Reorder uses explicit move up/down buttons

**Phase 2+ — Drag enhancement (progressive):**
- **Long-press + drag** (mobile, 300ms activation): Reorders stops. Uses `@dnd-kit/sortable` with touch sensor.
- **Drag block edges**: Resize duration, snaps to 15-min increments. Raw pointer events with `setPointerCapture`.
- **Keyboard sensor**: Arrow keys to reorder for accessibility (`@dnd-kit` keyboard sensor).

### Danger Zone System

When timing gets tight between stops, the system warns the user — but never blocks them.

**Thresholds:**

| Buffer time | Level | Color | Message |
|------------|-------|-------|---------|
| 15+ min | Safe | Green | "You're good" |
| 5-15 min | Warning | Yellow | "Cutting it close" |
| <5 min or negative | Danger | Red | "You might be late" |

**Warning display:**
- Appears **inline between blocks**, not as a modal or toast
- Shows the math: "8 min walk + 0 min buffer = likely late"
- Two action buttons: **[Adjust times]** / **[I'll make it]**
- Respects user agency — warnings are informational, not blocking

**Warning triggers:**
- Extending a pre-event stop past the safe departure time
- Reordering stops in a way that breaks the timeline
- Adding a stop that doesn't physically fit in the available time window

---

## 9. Data Model

### Core tables

> **Design decision**: Add `portal_id` directly to playbooks (avoid constant joins through itineraries). Add `playbook_id` to `playbook_proposal_votes` for Supabase Realtime filtering. Route all mutations through service client (API-level auth, not RLS for multi-user writes).

> **Existing `plans` system**: The codebase already has a `plans` + `plan_items` + `plan_participants` + `plan_suggestions` schema (migration `20260216510001_plans.sql`) with hooks at `usePlans.ts`. Playbook should **evolve this system** rather than create a parallel one. Phase 1 migration extends these tables; Phase 3 adds the group-specific tables.

**`playbooks`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| itinerary_id | uuid | FK to existing `itineraries` table (Playbook wraps itinerary) |
| portal_id | uuid | FK to `portals` — direct reference for scoping |
| creator_id | uuid | FK to `profiles` — the instigator |
| title | text | Plan name ("Saturday Night Out") |
| status | enum | draft, polling, planning, ready, live, complete |
| date | date | Target date (nullable if polling) |
| date_range_start | date | For multi-day or flexible date plans |
| date_range_end | date | |
| share_token | text | Unique token for shareable links |
| settings | jsonb | Budget level, neighborhood preference, other config |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`playbook_members`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playbook_id | uuid | FK to `playbooks` |
| user_id | uuid | FK to `profiles` |
| role | enum | instigator, invitee, viewer |
| status | enum | invited, going, maybe, declined |
| commitment | enum | locked_in, likely, tentative |
| arrival_time | time | When they can get there (nullable) |
| invited_at | timestamptz | |
| responded_at | timestamptz | |

**`playbook_item_participants`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playbook_id | uuid | FK to `playbooks` |
| itinerary_item_id | uuid | FK to `itinerary_items` — which stop |
| user_id | uuid | FK to `profiles` |
| status | enum | going, maybe, skip |
| created_at | timestamptz | |

**`playbook_polls`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playbook_id | uuid | FK to `playbooks` |
| poll_type | enum | availability, venue_vote |
| title | text | Poll question / description |
| deadline | timestamptz | When voting closes (nullable) |
| status | enum | open, closed |
| created_at | timestamptz | |

**`playbook_poll_responses`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| poll_id | uuid | FK to `playbook_polls` |
| user_id | uuid | FK to `profiles` |
| response | jsonb | Flexible — dates for availability, venue_id for votes |
| created_at | timestamptz | |

**`playbook_proposals`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playbook_id | uuid | FK to `playbooks` |
| item_id | uuid | FK to `itinerary_items` (nullable — null for whole-plan or vibe proposals) |
| proposer_id | uuid | FK to `profiles` |
| type | enum | change_time, change_venue, add_stop, remove_stop, vibe |
| payload | jsonb | Type-specific data (new time, venue_id, vibe tags, etc.) |
| status | enum | pending, accepted, denied |
| created_at | timestamptz | |

**`playbook_proposal_votes`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| proposal_id | uuid | FK to `playbook_proposals` |
| user_id | uuid | FK to `profiles` |
| vote | boolean | true = yay, false = nay |
| created_at | timestamptz | |

### Existing tables used (no changes needed)

- **`itineraries`**: The underlying itinerary that Playbook wraps. All stop data, ordering, timing lives here.
- **`itinerary_items`**: Individual stops in the itinerary. Playbook adds participation data on top.
- **`user_preferences`**: Dietary restrictions, price preference, favorite neighborhoods, vibes. Fed into suggestion engine.
- **`venues`**: Venue data including hours, lat/lng, type, images. Powers suggestions.
- **`events`**: Event data including times, venue FK. Powers anchor events.
- **`venue_specials`**: Active specials. Enriches suggestion cards.

---

## 10. Phased Build Plan

> **Design decision**: Reordered phases. Sharing/invites moved ahead of Discovery Mode — sharing is the growth lever. Cold start is less critical than social spread.

### Phase 1 — Solo Playbook

**Goal**: One person can plan an outing around an anchor event with smart suggestions.

**Scope:**
- Entry points: "Plan around this" on event cards, post-RSVP CTA
- Full-page outing builder with timeline (`/{portal}/playbook/{id}`)
- Suggestion engine (before/after, walkability-first, meal timing, venue hours)
- Tap-to-edit interactions (quick-edit sheet with time stepper, reorder, delete)
- Danger zone warnings (inline, color-coded, informational)
- Share link (view-only for now) with OG card preview
- Manual stop addition (search + custom stop with just name + time)
- FAB persistence when navigating away

**Not in Phase 1:** Group features, polls, proposals, partial participation, drag-to-reorder, cold start flow.

### Phase 2 — Share & Invite

**Goal**: The shared link experience is compelling enough that friends want to join.

**Scope:**
- Beautiful invitee view (read-heavy, single "I'm in" CTA)
- OG card spec for link previews (plan title, date, stops, anchor image)
- Deep-link to specific stops ("Join us for drinks after the show?")
- Basic member tracking (who's going)
- Drag-to-reorder as progressive enhancement (`@dnd-kit`)
- Curated templates as fallback content

### Phase 3 — Discovery + Group Coordination

**Goal**: Cold start planning + friends can plan together with suggestions and flexible participation.

**Scope:**
- Cold start flow (linear: when → vibe → options)
- Per-stop RSVP (going / maybe / skip) + arrival time + commitment levels
- Availability polling (date grid with heatmap — vertical list on mobile)
- Suggestions with emoji reactions (not formal voting) — instigator accepts/dismisses
- Suggestion types: different spot, different time, add stop + vibes as preference filter
- Vibe chips that filter suggestion engine
- Per-stop headcount inline on timeline
- Notifications (per-stop: "Sarah joined you for dinner")
- Partial participation ("join for dinner and split")

### Phase 4 — Intelligence & Integrations

**Goal**: Personalization, real-world integrations, and the post-outing loop.

**Scope:**
- Personalized suggestions based on outing history and ratings
- Weather-aware recommendations ("Rain expected — suggesting indoor options")
- Reservation integration (OpenTable/Resy — "Book a table" CTA when stop + headcount locked)
- Party size-aware venue filtering
- Post-outing flow: rate stops, "do this again"
- Recurring Playbooks ("Taco Tuesday crew")
- ~~Smart nudges~~ — Cut. Passive-aggressive algorithmic behavior destroys trust.

---

## 11. Key Design Principles

1. **Aggressive defaults over empty states.** Never show a blank page. Pre-fill with smart suggestions. A single-stop Playbook is a valid Playbook.

2. **Inform, don't block.** Danger zone warnings tell users the math but let them decide. Proposals are suggestions, not vetoes. The instigator has final say.

3. **Solo first, group second.** The solo experience must be fast and excellent. Group features layer on top — they don't slow down the solo user.

4. **Walkability-first.** All suggestions sorted by walk time. The timeline shows walking connections between every stop. No one wants to Uber between dinner and a show 3 blocks away.

5. **Respect real human behavior.** Three commitment levels because "maybe" is honest and useful. Arrival times because not everyone can make dinner. Partial participation because adults have lives.

6. **The instigator is the benevolent dictator.** Anyone can propose, anyone can vote, but one person decides. This is how plans actually get made.

7. **Low friction to contribute.** Dropping a "Mexican" vibe chip is easier than finding a restaurant. Setting a commitment level is easier than writing "I'll try to make it" in a group chat. Meet people where their effort level is.

---

## 12. Competitive Context

| Product | What it does | Where Playbook differs |
|---------|-------------|----------------------|
| **Partiful** | Event invites + RSVP | Single event only, no itinerary. Playbook is multi-stop. |
| **IRL** | Group event planning | Calendar-focused, no venue intelligence. Playbook has real venue data, walking times, suggestions. |
| **Google Maps lists** | Save places to a list | No timing, no group coordination, no itinerary flow. |
| **Wanderlog** | Trip planning | Trip-scale (days/weeks), not outing-scale (one evening). Overkill for a night out. |
| **Group chat** | Free-form coordination | The thing Playbook replaces. No structure, no convergence, lots of "where should we go?" loops. |

Playbook's unique position: **outing-scale planning with real local intelligence**. It knows what's actually happening tonight, which venues are open, how far apart things are, and what your group is in the mood for. No other tool combines all of that.

---

## 13. Open Questions

- **Notifications**: Push notifications? SMS? In-app only? What's the right channel for plan updates?
- **Non-user invitees**: Can you invite someone who doesn't have a LostCity account? What's their experience? (Probably: view-only with a "join to RSVP" prompt)
- **Playbook limit**: How many active Playbooks can a user have? Probably unlimited but only one "live" at a time.
- **Privacy**: Are Playbooks private by default? Can other users discover public Playbooks? (Probably: private, share-link only)
- **Monetization**: Promoted suggestions? "Sponsored stop" in the suggestion engine? Reservation booking fees? TBD.

---

## 14. Success Metrics

| Metric | What it measures | Target |
|--------|-----------------|--------|
| Playbooks created / week | Adoption | Growing week-over-week |
| Stops per Playbook | Depth of planning | Avg 3+ stops |
| Invites sent per group Playbook | Social spread | Avg 3+ invites |
| Suggestion-to-add rate | Suggestion quality | >20% of suggestions get added |
| Playbook completion rate | Follow-through | >60% of "ready" plans go "live" |
| Proposal acceptance rate | Group collaboration health | 30-60% (too high = rubber stamp, too low = ignored) |
| Repeat Playbook creators | Habit formation | >40% create a second Playbook within 30 days |

---

## Appendix A: Design Review Decisions (v1.1)

Decisions from the product design, architecture, and frontend design review council.

### Visual Identity

- **Playbook accent**: `--neon-cyan` (#00D4E8) — distinct from coral-dominant browse views. Creates instant mode differentiation.
- **Anchor events**: `--gold` accent (star badge, gold left-border, subtle glow)
- **Timeline spine**: Thin vertical cyan line connects stops — the visual signature of planning mode
- **Surface treatment**: `--night` background with faint radial cyan bloom — "lit from within" workspace feel
- **Danger zone colors**: `--neon-green` (safe), `--neon-amber` (warning), `--neon-red` (danger)
- **Fix existing scaffolding**: Replace hardcoded `white/XX` and `#1a1a2e` values with design system tokens

### Architecture

- **State management**: TanStack Query (v5, already installed) for server state + `useReducer` for local UI state. No new libraries.
- **Real-time**: Supabase Realtime channels (existing pattern from `useRealtimeFriendRequests`). Not polling.
- **Auth pattern**: Service client for all mutations, API-level auth verification. Matches existing `CLAUDE.md` guidelines.
- **New dependency**: `@dnd-kit/core` + `@dnd-kit/sortable` (~12kB) for Phase 2+ drag. No Framer Motion.
- **Existing Plans system**: `plans` + `plan_items` + `plan_participants` + `plan_suggestions` tables already exist. Playbook evolves this system rather than creating a parallel one.

### Interaction Model

- **Phase 1**: Tap-to-edit only. Quick-edit sheet with time stepper (15-min increments), duration picker, move up/down, delete.
- **Phase 2+**: Drag-to-reorder as progressive enhancement. Long-press activation on mobile.
- **Proposals (Phase 3)**: Simplified to suggestions-with-reactions (emoji thumbs up/down), not formal voting. Reduced to 3 types: different spot, different time, add stop. Vibes remain as a separate lightweight mechanism.
- **Timeline**: Read-only visualization in Phase 1. Tap targets open edit sheets. Becomes a manipulation surface in Phase 2.

### UX Principles

- Invitee landing is read-heavy with single "I'm in" CTA. Granular input behind "Customize" expander.
- No separate instigator dashboard — group management inlines into timeline.
- Suggestion engine always has a fallback (search, custom stop, templates). Never a dead end.
- Single-stop Playbook is valid and should look complete, not empty.
- Quick Share OG card is critical for adoption — plan title, date, stops, anchor image.

### What Was Cut

- ~~Photo wall~~ (post-outing): Duplicates Instagram
- ~~Arrival timeline visualization~~ (instigator dashboard): Redundant with per-stop avatars
- ~~Smart nudges~~ (Phase 4): "Sarah usually bails" is passive-aggressive and destroys trust
- ~~Three-way cold start fork~~: Replaced with single linear flow
- ~~Formal proposal voting~~: Replaced with emoji reactions + instigator decides
