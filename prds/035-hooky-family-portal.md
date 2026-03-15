# PRD-035: Lost Youth — Family Portal

**Status:** Strategy Lock
**Portal Slug:** `family` (vertical subdomain: `family.lostcity.ai`)
**Brand Name:** Lost Youth
**Tagline:** "Play hooky."
**Type:** Family activity coordination portal (Metro Atlanta)

---

## Mission

Hooky is a coordination engine for families. It answers: **"What are we doing this weekend?"** and **"Who's doing what when?"**

Not a mommy blog. Not a directory. A data-powered, age-aware, calendar-integrated platform that reduces the decision fatigue and logistics friction of keeping a family active.

## What Makes Hooky Different

| Layer | What it does | vs. what exists |
|-------|-------------|----------------|
| Data breadth | 20+ library/museum/parks crawlers in one surface | Fragmented across 30 websites |
| Programs | Camps, enrichment, leagues with structured enrollment data | Listicles, Facebook groups |
| Age filtering | Per-kid profiles shape everything | Generic "family-friendly" tag |
| Registration intelligence | Open/waitlist/closing soon/sold out status | Check each site individually |
| School calendar awareness | Teacher workdays, breaks auto-trigger alerts | Parents scramble every time |
| Coordination | Multi-kid scheduling, gap-filling, shared calendar | Group texts, spreadsheets |
| Compare | Side-by-side camps/programs on 5+ dimensions | Opening 20 tabs |

No parenting site does even three of these together.

## Brand Identity

**Vibe:** Warm, playful, hip. Treats parents as cool adults — not infantilizing them alongside their kids. The person using Hooky Saturday morning is the same person using the Atlanta portal Friday night and Yonder on Sunday.

**What Hooky is NOT:** Pastel. Cartoon. Mommy-blog aesthetic. Stock photos of "happy families." Cutesy language. Talking down to parents.

**What Hooky IS:** A well-designed coffee shop that happens to have a great kids area. Kinfolk magazine meets a really good task management app.

---

## Visual Identity

**Theme mode:** Light
**Fonts:** Outfit (headlines — geometric, warm personality), DM Sans (body)

| Token | Value | Usage |
|-------|-------|-------|
| background | #F3EEE8 | Page canvas (warm cream) |
| card_color | #FFFFFF | Cards |
| primary_color | #C48B1D | Warm amber/honey — CTAs, active states, urgency |
| secondary_color | #7D8B72 | Warm sage — success, "open" status |
| text_color | #1F2023 | Primary text (warm charcoal) |
| muted_color | #9B9590 | Secondary text, labels, inactive states |
| border_color | #E8E4DF | Soft warm gray borders |
| accent_light | #FDF5E6 | Light amber for banners, highlights |

**Design Language:**
- Moderate corners (12-14px radius) — friendly, not bubbly
- Subtle borders (1px), soft warm shadows
- Generous white space — parents are scanning fast, don't make them work
- Photography-forward when available (warm lifestyle, not stock "happy family")
- No illustrations, no mascots, no cartoon anything
- Amber as the consistent accent: conditions banner, active tabs, age pills, urgency alerts

---

## Primary Users

1. **The Family Coordinator** — Usually one parent (often mom) who manages the family's activity calendar. Plans weekends, books camps, tracks registration deadlines. Hooky's core user.
2. **The Co-Parent** — Second parent who needs visibility into the plan but doesn't drive it. Shared calendar consumer.
3. **The Grandparent/Caregiver** — Needs to find activities for a visit or a specific day. Simpler discovery use case.

## Core Jobs To Be Done

1. "What are we doing this weekend?" — The Thursday night question, every week.
2. "Camp signup is coming — what are our options?" — Seasonal planning (Jan-Mar for summer).
3. "Teacher workday next Friday — now what?" — Panic-moment coverage.
4. "Bug has soccer 10-12 — what can Rocket do nearby?" — Multi-kid coordination.
5. "How do these three camps compare?" — Decision support for enrollment.

---

## Data Model

### Existing Infrastructure (events, venues, sources)

Hooky consumes the existing LostCity event/venue infrastructure via source federation. 15-20 active crawlers already produce family content:
- Libraries (Atlanta-Fulton, DeKalb, Gwinnett, Cobb)
- Museums (Fernbank, Children's Museum, Zoo Atlanta, Georgia Aquarium)
- Parks & Rec (Atlanta, Cobb, DeKalb, Gwinnett)
- Enrichment (Piedmont classes, Alliance Theatre)
- Outdoor (Trees Atlanta, Park Pride, Yonder trails)

### New Entity: Programs

Events are one-off. Programs are structured commitments with enrollment. This is Hooky's differentiating data layer.

```sql
programs
  id UUID PK
  portal_id UUID FK portals
  source_id INT FK sources
  venue_id INT FK venues (nullable)
  name TEXT NOT NULL
  slug TEXT UNIQUE
  description TEXT
  program_type TEXT NOT NULL
    -- camp, enrichment, league, club, class, rec_program
  provider_name TEXT
  age_min INT
  age_max INT
  season TEXT (summer, fall, spring, winter, year_round)
  session_start DATE
  session_end DATE
  schedule_days INT[] (ISO 8601 day numbers)
  schedule_start_time TIME
  schedule_end_time TIME
  cost_amount NUMERIC
  cost_period TEXT (per_session, per_week, per_month, per_season)
  cost_notes TEXT (e.g., "before/after care $50 extra")
  registration_status TEXT
    -- open, waitlist, closed, walk_in, sold_out, upcoming, unknown
  registration_opens DATE
  registration_closes DATE
  registration_url TEXT
  last_status_check_at TIMESTAMPTZ
  before_after_care BOOLEAN
  lunch_included BOOLEAN
  tags TEXT[]
  status TEXT (active, draft, archived)
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
```

### Family Profiles

Per-kid profiles power age filtering and personalization. Child data is kept non-identifiable (nicknames, age bands, interests only).

**MVP: Lightweight profile (on user record)**
```sql
-- Add to portal_preferences or user profile
family_kids JSONB
  -- [{nickname: "Bug", age_band: "elementary", interests: ["stem", "animals", "outdoors"]}]
```

**V1.5: Full household model**
```sql
households
  id UUID PK
  owner_id UUID FK profiles
  name TEXT
  home_neighborhood TEXT
  school_system TEXT (aps, dekalb, cobb, gwinnett, private, homeschool)
  -- NOTE: school system is public calendar selection, NOT per-child school affiliation
  created_at TIMESTAMPTZ

household_members
  id UUID PK
  household_id UUID FK households
  member_type TEXT (parent, child, caretaker)
  nickname TEXT
  age_band TEXT (infant, toddler, preschool, elementary, tween, teen)
  interests TEXT[]
  user_id UUID FK profiles (nullable — only for adults)
  invite_status TEXT (active, pending, declined)

household_preferences
  household_id UUID FK households PK
  budget_preference TEXT (free_only, budget, moderate, any)
  max_drive_minutes INT
  needs_accessibility TEXT[] -- wheelchair, sensory, etc.
  needs_dietary TEXT[] -- nut_free, gluten_free, etc.
  -- NOTE: needs live HERE, never on household_members (COPPA design-around)
```

### School Calendars

Public school system calendars stored as reference data. NOT per-child school affiliation — just which system's calendar to display.

```sql
school_calendar_events
  id UUID PK
  school_system TEXT (aps, dekalb, cobb, gwinnett)
  event_type TEXT (no_school, half_day, break, holiday, early_release)
  name TEXT
  start_date DATE
  end_date DATE
  school_year TEXT (2025-26)
```

---

## Privacy & COPPA

### Design Principle: Stay Outside the COPPA Perimeter

Hooky is a parent-facing planning tool. Children never create accounts or interact with the app. Parents manage data about their children.

**Safe per-child data:**
- Nickname (not real name) — "Bug" and "Rocket" are not identifiable
- Age band (not birthday) — broad bands are not PII
- Interest categories — "likes STEM and animals" is not sensitive

**Household-level only:**
- Medical/dietary needs — health data + age + neighborhood = identifiable
- Accessibility needs — same reason
- School affiliation — school + age + neighborhood = identifiable child

**Required at launch:**
1. Signup age gate: "I confirm I am 18 or older"
2. Privacy policy with household data section
3. Parent can delete all family data at any time

**Deferred to V1.5+ (requires legal review):**
- School/group affinity features ("5 families from your school interested")
- Co-parent consent audit trail

---

## Information Architecture

The portal navigation is organized around **family decision moments**, not generic discovery tabs.

### Primary Navigation (5 tabs)

| Tab | Purpose | Why it earns its place |
|-----|---------|----------------------|
| **Today** | What matters right now | Immediate utility — operational dashboard |
| **Weekend** | The highest-frequency planning surface | Habitual discovery — the Thursday night question |
| **Programs** | Structured, recurring activities | Deep utility moat — camps, classes, leagues |
| **Calendar** | The command center | Retention anchor — replaces Google Calendar for family activities |
| **Plans** | Coordination and social layer | Coordination moat — replaces group text chaos |

**Today** is the default landing — not because it's the biggest moat, but because it's the most useful opening state.

---

## Feature Specifications

### T1: Today (Default Landing)

The operational dashboard. What a parent needs to know right now.

**Modules:**

| Module | Content | When shown |
|--------|---------|-----------|
| Family Snapshot | What's on calendar today + registrations opening soon + next plan | Always |
| Heads Up | No-school days, registration deadlines, school breaks approaching | When relevant (school calendar set up) |
| After School / Today With Kids | Time-aware recommendations (after school, tonight, rainy-day, nearby) | Always |
| Registration Radar | Opening soon / Closing soon / Filling fast | When registrations are active |
| For [Nickname] | Per-kid recs based on interests | If crew set up |

### T2: Weekend Planner

The highest-repeat discovery surface. Answers: "What should we do this weekend?"

**Filter bar:**
- Kid selector (from crew)
- Indoor / Outdoor
- Free / Paid
- Age range
- Distance
- Morning / Afternoon / Evening

**Sections:**

| Section | Content |
|---------|---------|
| Best Bets This Weekend | Data-driven ranking of top family activities |
| For [Kid Name] | Child-specific recommendations when crew is set up |
| Easy Wins | Under 20 min away, under 2 hours, cheap/free |
| Big Outings | Destination-style: zoo, hike, festival, museum day |
| Free Activities | Budget-friendly, always populated |

**Every card supports:** Save, Add to Calendar, Create Plan, Share.

### T3: Programs Browser

Browse structured, recurring activities. This is the deep utility moat.

**This should NOT feel like an event feed.** It should feel like a course catalog meets registration intelligence.

**Filters:**
- Type: Camps | Enrichment | Leagues | Classes | Rec Programs | All
- Age: auto-set from crew profile, manually adjustable
- Season: Summer | Fall | Spring | Winter | Year-round
- Cost: Free | Under $100 | Under $250 | Any
- Registration: Open only | Include waitlist
- Day of week
- Neighborhood / radius

**Sub-tabs:**
- **Browse** — General discovery
- **Opening Soon** — Registration Radar view
- **Seasonal** — Camp Season (Jan-Mar) / Break programs

**Program Cards show:**
- Name + provider
- Age range + schedule summary + cost
- Registration status pill (OPEN / CLOSING SOON / WAITLIST / SOLD OUT)
- Session dates + day/time
- Distance

**Program Detail Page (critical):**
- Above fold: title, age range, schedule summary, registration state, location, "Add all sessions to Calendar", "Follow for registration alerts"
- Mid-page: session schedule, requirements, map, similar programs
- Bottom: related weekend ideas nearby, save/share/register actions

### T4: Family Calendar (V1.5)

The most strategic page in the portal. A family activity operating system, not a passive grid.

**Default view:** Agenda / Week hybrid (not month grid — parents need "what's next" and "where are conflicts").

**Calendar layers:**
1. Family Plans — created inside Lost City
2. Programs — recurring structured sessions
3. School Calendar — no-school days, breaks, early dismissals
4. Suggested Activities — soft overlays for open time blocks

**Key features (phased):**
- MVP: View all family activities in one place, school calendar overlay
- V1.5: Add all program sessions in one tap, conflict detection, open-time suggestions
- V2: Registration deadlines as calendar objects, iCal export

### T5: Plans (Coordination Layer)

Turn "we might do this" into "we're doing this." Leverages Groups infrastructure (PRD-036).

**Sections:**
- Upcoming Plans (this weekend, next week, school break)
- Recurring Plans (weekly activities, monthly meetups)
- Draft Plans (saved but not finalized ideas)

**Core actions:** Create plan from event/program/destination, invite family or other parents, mark recurring, add to calendar, coordinate logistics.

**Design principle:** Plans must be lightweight. "Lock this in" not "administer a system."

### T6: My Crew (Family Profile)

Per-kid profiles that power everything else.

**MVP:** Inline setup on first visit. "Who's in your crew?" with:
- Nickname + emoji picker
- Age band selector (infant/toddler/preschool/elementary/tween/teen)
- Interest chips (STEM, art, music, sports, outdoors, animals, reading, cooking, dance, theater)

**V1.5:** Full household with co-parent invite, home neighborhood, drive radius, dietary/accessibility needs at household level.

### T7: School Calendar Integration

Public school system calendar awareness. The panic-preventer.

- Select your school system (APS, DeKalb, Cobb, Gwinnett, private, homeschool)
- "Heads Up" section auto-populates with upcoming no-school days
- Teacher workday → auto-attach activity suggestions for your crew's ages
- Spring/winter/summer break → surface relevant programs and camps

### T8: Registration Radar

Alert parents about program registration windows. Prevent missed signups.

- Accessible from: Today, Programs, Calendar
- Three urgency tiers: Opening Soon / Closing Soon / Filling Fast
- Parents can follow venues, program types, or specific programs
- Notifications when registration windows open/close

### T9: Compare (V1.5)

Side-by-side comparison of up to 4 programs/camps. Zero competitors offer this.

**Dimensions:** Age range, cost, schedule, location, registration status, before/after care, freshness.

State in localStorage. Share via link.

### T10: Cross-Portal Federation

- **Adventure:** Family-friendly trails, outdoor activities, nature programs
- **HelpATL:** Youth volunteer hours (teen programs), school board meetings
- **Atlanta:** All-ages events, festivals, free community events

---

## Content Coverage

### P0 Sources (MVP) — Already Active
- Atlanta-Fulton Library (BiblioCommons API)
- DeKalb Library, Gwinnett Library, Cobb Library
- Fernbank Museum
- Zoo Atlanta, Georgia Aquarium
- Atlanta Parks & Rec
- Alliance Theatre
- Piedmont classes
- Eventbrite (family filter)

### P0 Gaps — Need Before Launch
- Center for Puppetry Arts
- Cobb Parks & Rec
- DeKalb Parks & Rec
- Gwinnett Parks & Rec
- Children's Museum of Atlanta

### P1 Sources (V1.5)
- YMCA / community centers
- Youth sports leagues (AYSO, Little League, metro rec)
- After-school enrichment studios
- Summer camp aggregation (manual seed + enrich)

### Launch Content Gates
- >=200 family-tagged events with age data populated
- >=50 events per age band (toddler, preschool, elementary, tween)
- >=20 programs with structured enrollment data
- >=30 events with registration status != unknown
- 4 school system calendars loaded (APS, DeKalb, Cobb, Gwinnett)

---

## Build Phases

### Phase 1: Foundation [DONE]
- [x] Create portal record (slug: `hooky`, status: `draft`) — migration 322
- [x] Create visual preset / branding configuration — `family_friendly` preset
- [x] Subscribe to 42 family sources via federation — migration 324
- [x] Create `programs` table + migration — migration 307
- [x] Seed school calendar data (APS, DeKalb, Cobb, Gwinnett 2025-26) — 62 events
- [x] Add `age_min`/`age_max` to events table
- [x] Build 28+ family-focused crawlers

### Phase 2: Weekend Planner + Programs Browser [ACTIVE]
- [ ] TypeScript types for programs (`web/lib/types/programs.ts`)
- [ ] FamilyFeed shell with 5-tab nav (Today/Weekend/Programs/Calendar/Plans)
- [ ] Today view — Family Snapshot, Registration Radar, After School suggestions
- [ ] Weekend Planner — filter bar (age/distance/indoor-outdoor/free), result sections
- [ ] Programs API route with age/type/season/registration filters
- [ ] Weekend API route (Fri-Sun events + programs, age-filtered)
- [ ] Programs Browser — structured filters, Browse/Opening Soon/Seasonal sub-tabs
- [ ] ProgramCard component — age range, schedule, registration badge, cost
- [ ] RegistrationBadge component — open/closing-soon/waitlist/sold-out states

### Phase 3: Kid Profiles + School Calendar
- [ ] My Crew inline setup ("Who's in your crew?" — nickname, age band, interests)
- [ ] ChildChip selector — persistent, reflows content when switched
- [ ] School calendar overlay on Today + Calendar tabs
- [ ] "Heads Up" alerts — registration opening/closing, no-school days
- [ ] Per-kid "For [Nickname]" sections in Today + Weekend
- [ ] Teacher workday → activity suggestions

### Phase 4: Calendar + Plans
- [ ] Family Calendar — agenda/week view with layers (plans, programs, school events)
- [ ] Program → Calendar — "Add all sessions" one-tap scheduling
- [ ] Plans integration — leverage Groups infrastructure (PRD-036)
- [ ] Plan creation from event/program/destination cards

### Phase 5: Compare + Camp Season
- [ ] Compare tray (add/remove up to 4 items, localStorage)
- [ ] Compare view with 6+ dimensions
- [ ] Camp Season section (Jan-Mar) with camp-specific filters
- [ ] Registration deadline alerts for saved programs

### Phase 6: Coordination (V1.5)
- [ ] Full household model (tables, co-parent invite)
- [ ] Conflict detection in calendar
- [ ] Open-time suggestions
- [ ] Gap Filler ("Kid A is busy, what can Kid B do nearby?")
- [ ] iCal export

### Phase 7: Trust + Distribution
- [ ] Freshness badges (Live/Recent/Stale/Unverified)
- [ ] Source transparency on program/event detail
- [ ] SEO landing pages (/this-weekend, /summer-camps, /free-events)
- [ ] Cross-portal federation activation

---

## Monetization Path

**Primary: Activity Provider Partnerships (V1.5+)**

The paying market is private enrichment providers, sports leagues, and camp operators — NOT public institutions (libraries, parks). These businesses have registration, pricing, and would pay for qualified leads.

- **Validated before building:** Interview 20 providers, get 5 LOIs at target pricing
- **Visibility tiers:** Free (standard listing) → Verified ($0, trust badge + edit) → Featured ($99/mo, priority + analytics) → Premium ($249/mo, sponsored placement)
- **Click-through attribution:** Track all registration_url clicks from compare/detail/feed views. This data proves Hooky's referral value.

**Secondary: Seasonal Sponsorships**
- Camp season partnerships (Jan-Mar)
- Back-to-school partnerships (Aug-Sep)
- Natural fit because the sponsorship IS useful content

## Success Metrics

### Launch (Month 0)
- 200+ family-tagged events with age data
- 20+ structured programs
- 4 school calendars loaded
- 5+ P0 sources active
- Feed loads with real, relevant, age-filtered content

### Month 1
- 300+ unique visitors
- 15%+ return rate (weekly rhythm drives this)
- 10+ crew profiles created
- 5+ camp comparisons used

### Month 3
- 1,500+ monthly uniques
- 25%+ return rate
- 50+ crew profiles
- 1+ provider partnership inquiry
- Camp season drove measurable traffic spike

## Non-Goals
- Booking engine (link out to providers — attribution, not transaction)
- Marketplace / payment processing
- AI concierge (prove planning fundamentals first)
- User-generated content / reviews (no user base yet)
- Healthcare / medical provider integration
- Social features / friend networks (V2 at earliest)
- Per-child behavioral profiling
- School affiliation without legal review

## Relationship to Existing PRDs

PRD-024 and PRD-025 covered the family portal under the names `atlanta-families` and `ATLittle`. This PRD supersedes both with:
- New brand identity (Hooky)
- Programs as a first-class data entity (not in original PRDs)
- School calendar integration as a core feature (not in original PRDs)
- Sharper scope (fewer feature areas, clearer phasing)
- Aligned visual identity with the portal family
- COPPA approach refined (per-kid interests OK, sensitive data household-only)

The strategic thesis from PRD-024 (better decisions, better planning, better trust) still holds. The execution plan is rebuilt.

---

## Design Reference

Pencil screens designed in active `.pen` file:
- **Hooky — Feed**: Conditions banner, This Weekend cards, Heads Up alerts, For Bug section, tab bar
- **Hooky — Programs**: Type/age filters, structured program cards with registration status pills
- **Hooky — My Crew**: Per-kid profiles with emoji + age band + interest chips, school calendar
