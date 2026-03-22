# HelpATL Civic Portal Feed Redesign

**Date:** 2026-03-22
**Status:** Draft
**Author:** Human + Claude

## Problem Statement

The HelpATL civic portal feed has 10 sections, many with thin or no data. The civic news section shows 1 article. "Groups Joined: 0" embarrasses logged-out users. CommitmentOpportunitiesCard renders sparse stats. The feed tries to be a deep civic platform when it should be an on-ramp — an aggregation layer that reduces friction and routes users to external platforms (Hands On Atlanta, Mobilize, Legistar, etc.).

## Identity

HelpATL is the civic on-ramp for Lost City users. It aggregates volunteer opportunities, government meetings, advocacy events, civic news, and support resources into one editorial feed. It doesn't compete with Hands On Atlanta, Mobilize, or Legistar — it routes users to them. The value is breadth in one place, low friction, and contextual relevance.

## Design Principles

1. **On-ramp, not destination** — Aggregate, overview, route outward. Don't replicate volunteer management, meeting agendas, or advocacy tools.
2. **Single editorial feed, contextually ordered** — No mode tabs. One feed that adapts to who's looking and when.
3. **Scoring influences order, never exclusion** — Channel subscriptions boost relevance but never hide content.
4. **Depth only where no external destination exists** — Support directory yes (no single external source to route to). Volunteer management no (HOA/Eventbrite own that).
5. **Suppress rather than embarrass** — If a section has too little data to be credible, don't render it. "Groups Joined: 0" is worse than no section.

## User Modes

The portal serves five user modes, defined by trigger rather than persona:

| Mode | Trigger | What the feed does | Volume |
|------|---------|-------------------|--------|
| **Browse & Do** | Free time, goodwill | Surface the easiest volunteer shifts this week | High |
| **React** | News event, local issue | Show the relevant meeting, org, or action | Medium, spiky |
| **Onboard** | New to giving back | Curated starting points, channel suggestions | Medium |
| **Get Help** | Personal need | Fast path to support directory | Lower but critical |
| **Stay Informed** | Civic curiosity | Meetings, elections, policy news | Highest potential |

These are not exclusive — a user may be in multiple modes across visits. The feed doesn't ask which mode you're in; it serves all five simultaneously through section ordering and contextual emphasis.

## Feed Sections (5, down from 10)

### 1. Civic Hero

**Purpose:** The portal's editorial voice. Tells you what matters right now.

**Content:**
- Contextual headline driven by priority logic:
  1. Upcoming election or registration deadline (if within 14 days)
  2. Channel-relevant event for subscribed users (meeting/deadline matching their causes)
  3. Highest-attendance or editorially weighted event this week
  4. Fallback: event count summary ("43 ways to get involved this week")
- Pathway pills (quick-jump entry points):
  - Amber: "X events this week" → Happening view
  - Teal: "Next deadline: [date]" → filtered timeline (if election/deadline exists)
  - Emerald: "X channels" → Groups page
  - Sky: "Support resources" → `/helpatl/support`
- Dynamic dateline (date, weather)

**Data requirements:**
- Priority scoring function that checks: elections within 14 days > deadlines > channel-matched events > volume count
- Channel-aware: if user subscribes to "Transit" and MARTA board meets this week, that becomes the headline

**Renders:** Always.

### 2. This Week

**Purpose:** Unified timeline of civic events across all three intents — serve, participate, organize. Not siloed by type.

**Content:**
- 5-8 events shown inline, ordered by:
  1. Channel boost (events matching subscribed causes float up)
  2. Editorial weight (elections > deadlines > meetings > volunteer shifts)
  3. Time proximity (sooner = higher)
- Each card shows:
  - Title (with "Volunteer:" prefix stripped in civic context)
  - Organization/venue name
  - Date and time
  - Intent badge: `volunteer` / `meeting` / `action` (inferred from category + tags)
  - Direct link out to source (`ticket_url` or `source_url`)
- "See all →" links to the Happening view filtered to civic events
- Events grouped into series show "See all dates" affordance (e.g., Open Hand shifts)

**Intent badge mapping (tag-based only — no `category=government` exists in the schema; all civic events use `category=community`):**
```
tags include "volunteer","volunteer-opportunity","drop-in" → volunteer (green badge)
tags include "government","school-board","zoning","public-meeting","board-meeting","city-council" → meeting (blue badge)
tags include "advocacy","rally","canvassing","organizing","civic-engagement" → action (amber badge)
fallback → event (neutral badge)
```
Priority: if tags match multiple intents, prefer meeting > action > volunteer (meetings are time-sensitive).

**Channel-boosted ordering (post-processing, not pipeline modification):**
- The CityPulse pipeline (`fetchEventPools` → `buildSections` → `assembleResponse`) remains unchanged. It returns events sorted by `start_date ASC, data_quality DESC`.
- After CivicFeedShell receives the CityPulse response, it extracts event IDs from the `this_week` section.
- For authenticated users with channel subscriptions, a lightweight lookup checks `event_channel_matches` (precomputed by the existing cron job at `/api/cron/interest-channel-matches`) for the user's subscribed channel IDs against those event IDs.
- Events with matches get a boost score. The "This Week" section re-sorts client-side: `boost_score (desc) → editorial_weight (desc) → start_date (asc)`.
- This avoids coupling civic personalization into the shared CityPulse pipeline. The CityPulse cache key already includes userId, so the re-sort doesn't invalidate shared responses.
- Unsubscribed users get editorial_weight → start_date ordering (no penalty).

**Relationship to existing LineupSection:** The current CivicFeedShell renders `<LineupSection>` with tab navigation (Today / This Week / Coming Up). The "This Week" section in this design replaces the inline LineupSection in the feed with a curated, channel-boosted view of 5-8 events. The full tabbed LineupSection remains accessible via the "See all →" link and the Happening view. This is a structural change: the feed becomes editorial (curated subset), while the Happening view remains comprehensive (full timeline with tabs).

**Data requirements:**
- Intent mapping function (pure tag-based logic, no schema change)
- `event_channel_matches` lookup for boost scores (table exists, cron exists)
- ACFB title prefix stripping (UI-layer or crawler fix)

**Renders:** If 3+ events exist for the week. (Should always render given current 556+ events/week.)

### 3. Ways to Help

**Purpose:** Two clear doors — one for giving time, one for getting help. Bridges Browse & Do and Get Help modes.

**Content:**
- Two cards side by side (desktop) or stacked (mobile):
  - **"Volunteer this week"** — Brief copy ("X drop-in opportunities, no training required"), links to Happening view filtered to volunteer events. Shows 1-2 org logos (HOA, Trees Atlanta) for credibility.
  - **"Find support resources"** — Brief copy ("Food, housing, legal aid, health, and family support"), links to `/helpatl/support`. Shows category count ("6 categories, 600+ organizations").
- No inline role listings, no commitment level stats, no "Active Roles: 60" numbers.

**Data requirements:** Volunteer event count for the week. Support directory category/org count (can be hardcoded or derived from support-source-policy.ts).

**Renders:** Always. The support directory is always valid, and volunteer events should always exist.

### 4. Civic News

**Purpose:** What's happening in Atlanta civic life. Policy, development, government decisions. The "Stay Informed" section.

**Content:**
- 4-6 articles from network_posts, ordered by published_at desc
- Each article: headline, source name + logo, published date, 1-2 line summary, link out
- Source attribution is prominent — we never reproduce content, we surface and credit
- "More civic news →" links to a full news view or the network page

**Civic relevance filtering:**
- Server-side: query network_posts where categories overlap with `['news', 'civic', 'politics', 'community']`
- Post-fetch: apply civic keyword filter (existing `isCivicRelevant()` logic) but do it server-side with a larger fetch pool (fetch 15, filter to top 6)
- Result: only articles about government, policy, housing, transit, education, public safety, elections

**Data requirements:**
- Minimum 3 articles to render; suppress section if fewer pass the filter
- 12 network sources (see News Sources section below) provide sufficient volume

**Renders:** If 3+ articles pass civic relevance filter. With 12 sources, this should reliably render.

### 5. Channels Strip

**Purpose:** Personalization hook. Shows what you follow and what's active. The "Onboard" mode entry point for new users.

**Content:**
- **Subscribed users:** Horizontal scroll of subscribed channels with activity counts. "Education · 3 this week" / "Transit · 1 this week". Tap → filtered Happening view for that cause.
- **Unsubscribed users:** Top 4-5 channels by activity count, shown as suggestions. "Popular channels: Food Security (12 this week), Education (5 this week)..." with "Subscribe" affordance on each.
- Compact — one row, pill-style. Not a section that dominates the page.

**Data requirements:**
- Channel activity counts: count events matching each channel's rules for the current week. New query needed — either in the channels API or as part of the feed data load.
- Channel rules already exist (tag-match and source-match types). Geo rules deferred.

**Renders:** Always. Shows subscriptions or suggestions.

## Sections Removed

| Old Section | Reason |
|---|---|
| **CommitmentOpportunitiesCard** | Data too thin (sparse opportunities table). On-ramp model routes to external platforms. Stats like "Active Roles: 60, Ongoing: 54" are meaningless to a first-time visitor. |
| **SupportResourcesCard** (standalone) | Merged into "Ways to Help" as one of two paths. |
| **InterestChannelsSection** (large grid) | Replaced by compact Channels Strip. Full channel management lives on the Groups page. |
| **CivicImpactStrip / sidebar stats** | "Groups Joined: 0" for new users. Impact metrics serve returning power users, not the on-ramp audience. Could resurface on profile/settings later. |
| **UpcomingDeadlinesCard** (standalone) | Deadlines surface in "This Week" timeline with urgency styling. Election deadlines surface in the Hero. Separate card is redundant. |
| **"Policy Watch" section** | Merged into single "Civic News." Users don't distinguish "policy watch" from "civic updates." |
| **"Civic Updates" section** | Same as above — merged. Two thin news sections are worse than one healthy one. |

## Layout

### Desktop (lg+)

Two-column:
- **Main (left, ~65%):** Hero → This Week → Ways to Help → Civic News
- **Sidebar (right, ~35%):** Channels Strip (sticky top) → "About HelpATL" compact explainer (first-time visitors only, dismissible)

### Mobile

Single column: Hero → Channels Strip → This Week → Ways to Help → Civic News

CivicTabBar at bottom: Act (feed) / Calendar / Groups

### Responsive behavior
- Channels Strip: horizontal scroll on mobile, vertical list in sidebar on desktop
- Ways to Help: side-by-side cards on sm+, stacked on xs
- This Week: full-width cards on all breakpoints

## Civic News Sources

### Currently Active (3)

| Source | Feed URL | Beat |
|--------|----------|------|
| Georgia Recorder | georgiarecorder.com/feed/ | State politics, elections, courts |
| Capitol Beat | capitol-beat.org/feed/ | State legislature, bills, policy |
| GBPI | gbpi.org/feed/ | Budget analysis, education funding, Medicaid |

### Add Immediately — Wave 1 (5)

| Source | Feed URL | Beat | Categories |
|--------|----------|------|------------|
| Atlanta Civic Circle | atlantaciviccircle.org/feed/ | City Council, housing policy, TAD financing, neighborhood reinvestment | news, civic, politics |
| Saporta Report | saportareport.com/feed/ | Civic affairs, transportation, community development | news, civic, community |
| Urbanize Atlanta | atlanta.urbanize.city/rss.xml | BeltLine, MARTA, housing development, urban planning, zoning | news, civic, community |
| Atlanta Community Press Collective | atlpresscollective.com/feed/ | Investigative — MARTA accountability, housing equity, police oversight | news, civic, politics |
| Decaturish | decaturish.com/search/?f=rss&t=article | DeKalb County schools, city governance, Tucker, public safety | news, civic, community |

### Add — Wave 2 (4)

| Source | Feed URL | Beat | Categories |
|--------|----------|------|------------|
| Rough Draft Atlanta | roughdraftatlanta.com/feed/ | Suburban municipal governance (Sandy Springs, Dunwoody, Brookhaven) | news, civic, community |
| The Atlanta Voice | theatlantavoice.com/feed/ | Community equity, education, local government (needs keyword filtering) | news, civic, community |
| Georgia Watch | georgiawatch.org/feed/ | Consumer protection, utility regulation, healthcare affordability | news, civic, politics |
| ACLU of Georgia | acluga.org/en/news/feed | Civil liberties, legislative tracking, criminal justice | news, civic, politics |

### Not Viable (skipped)

| Source | Reason |
|--------|--------|
| AJC | No RSS, paywalled |
| Axios Atlanta | Killed RSS feeds |
| WABE | Cloudflare blocks all automated access |
| GPB | Feed is 95% national NPR, no GA-specific RSS |
| City of Atlanta press releases | 403, no public feed |
| Atlanta Magazine | Lifestyle/dining, not civic |
| Patch Atlanta | Too much noise, low signal-to-noise |

### Expected Volume

With 12 sources (8 existing/wave-1 + 4 wave-2), estimated 40-60 civic-relevant articles per week. The civic keyword filter reduces this to ~25-35 that pass relevance. The feed section shows 4-6, with "More" linking to the full set. This is a reliable, credible volume — no more 1-article sections.

## Channel Mechanics

### Subscription model
- Users subscribe during onboarding or via the Channels Strip / Groups page
- 20 active channels across three axes: cause/issue, geography/jurisdiction, and institution
- Subscriptions are lightweight — toggle on/off, no commitment

### Feed influence
- Channels affect **ordering, not filtering**
- Events matching subscribed channel rules get a boost score added to their sort key
- Boost is additive: event matching 2 subscribed channels ranks higher than 1
- No subscriptions = no penalty; feed falls back to editorial_weight → time ordering

### Hero personalization
- If a subscribed channel has a high-priority event (meeting, deadline), the hero headline reflects it
- Example: Transit subscriber sees "MARTA board meets Thursday at 1 PM" instead of generic count
- Falls back to most broadly relevant item for unsubscribed users

### Activity counts
- Each channel displays "X this week" count in the Channels Strip
- Count = events matching that channel's rules with start_date in current week
- Requires new query: for each channel, evaluate rules against events table, count matches

## Data Layer Changes

### New: Intent mapping function
```
inferCivicIntent(event: { tags: string[] }): 'volunteer' | 'meeting' | 'action' | 'event'
```
Pure tag-based logic function (no `category` — all civic events are `category=community`). Uses the existing `CIVIC_SIGNAL_TAGS` taxonomy from `fetch-events.ts`. No schema change. Priority: meeting > action > volunteer when tags match multiple intents.

### New: Channel activity count query
Precompute via the existing cron job at `/api/cron/interest-channel-matches`. Extend the cron output to include a per-channel count view (either a summary row in `event_channel_matches` or a separate `channel_activity_summary` materialized view). The channels API (`/api/portals/[slug]/channels`) reads the precomputed counts. Do NOT evaluate channel rules live at request time — with 20 channels x 556 events x 3 rules each, that's 33K evaluations per request.

### New: Channel-boosted feed ordering
Post-processing layer in CivicFeedShell, NOT a CityPulse pipeline modification. After receiving the CityPulse response:
1. Extract event IDs from the `this_week` section
2. Lookup `event_channel_matches` for user's subscribed channels
3. Assign boost scores and re-sort the section client-side
This keeps the CityPulse pipeline shared and uncoupled from civic-specific personalization.

### New: Hero priority scoring
Function that evaluates lineup sections + channel subscriptions to pick the most important item for the hero headline.

**Election/deadline data source:** Events with tags `election`, `election-day`, `voter-registration`, or `civic-deadline` (from the Georgia Elections crawler, source_id=1788). The `school_calendar_events` table also has deadline-like dates. The priority function queries events with these tags where `start_date` is within 14 days.

**Priority cascade with null safety:**
1. Election/deadline event within 14 days → headline references the event
2. Channel-matched meeting for subscribed user (only if match exists — null check required to avoid "MARTA board meets..." when MARTA has nothing)
3. Highest-volume event this week
4. Fallback: event count summary

### Modified: Network feed API
Add a `civic_filter=true` query parameter to `/api/portals/[slug]/network-feed/route.ts`. When set:
- Fetch pool increases from default `limit` to 20
- Apply the existing `isCivicRelevant()` keyword logic server-side (in the API route, not the client)
- Return top 6 passing articles
This is a single new parameter on the existing route, not a new endpoint.

### Modified: ACFB title prefix
Strip "Volunteer: " prefix from ACFB event titles at crawler ingestion (preferred — first-pass rule). The prefix is redundant data that the source crawler captured verbatim. ACFB events are already grouped by series, so stripping the prefix does not create title collisions — series grouping differentiates shifts.

### Migration: Add wave-1 network sources
Insert 5 new `network_sources` records for the HelpATL portal. **Wave 1 sources are a launch prerequisite, not a follow-up.** With only 3 sources and a minimum-3 suppression threshold, a single RSS outage kills the Civic News section. 8 sources (3 existing + 5 wave-1) provide sufficient redundancy.

### Existing: CivicOnboarding overlay
The existing `CivicOnboarding` component (first-run channel selection overlay) remains. It complements the Channels Strip: onboarding handles initial channel selection, the strip handles ongoing visibility and discovery. The strip replaces the large `InterestChannelsSection` grid in the feed, not the onboarding flow.

### Existing: "About HelpATL" sidebar card
Uses `localStorage` for dismissal persistence (same pattern as CivicOnboarding). Will not persist across devices or incognito — acceptable for a low-priority explainer card.

### Channels Strip suppression edge case
If all channels show 0 activity this week, the strip still renders but suppresses the count display. Shows channel names only, without "0 this week" labels. This prevents the "Groups Joined: 0" anti-pattern from recurring.

## What This Design Does NOT Include

- **Issue Tracks UX** (Phase 2 from PRD 029) — deferred
- **Admin civic quality dashboard** — deferred
- **Reminder delivery / notifications** — deferred
- **Geo rule matching for channels** — deferred (tag/source rules sufficient for v1)
- **Full volunteer management** — explicitly out of scope (on-ramp model)
- **Social features / comments** — not appropriate for civic portal
- **Multi-city support** — deferred until geo rules and federation are hardened

## Success Criteria

1. Feed renders 5 sections with real data, no empty/embarrassing states
2. Civic News section shows 4+ articles reliably (never 1)
3. First-time visitor can find a volunteer shift within 10 seconds
4. First-time visitor can reach support directory within 2 taps
5. Returning user with channel subscriptions sees a personalized hero and boosted timeline
6. Every event card links out to the source for sign-up/details (not a dead end)
7. Page loads under 2 seconds on mobile (no Playwright dependencies, no heavy client-side filtering)
