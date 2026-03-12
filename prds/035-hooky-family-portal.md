# PRD-035: Hooky — Family Portal

**Status:** Strategy Lock
**Portal Slug:** `hooky`
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

## Feature Specifications

### F1: The Feed (Weekly Rhythm)

The return driver. Every Thursday, Hooky gives you the weekend shaped by your family.

**Sections (each earns its place):**

| Section | When it appears | Content |
|---------|----------------|---------|
| Conditions Banner | Always | Weather + contextual copy ("Perfect weather to play hooky outdoors") |
| This Weekend | Always | 5-8 events/activities filtered by crew ages, weather-aware |
| Heads Up | When relevant | Teacher workdays, registration deadlines, school breaks approaching |
| For [Nickname] | If crew set up | Per-kid recs based on interests ("For Bug: robotics workshop") |
| Programs Starting Soon | When enrollment open | Classes, enrichment, leagues with upcoming start dates |
| Free This Week | Always | Budget-friendly, always populated |

### F2: Programs Browser

Browse, filter, and compare structured programs. The feature that no parenting blog can replicate.

**Filters:**
- Type: Camps | Enrichment | Leagues | Classes | All
- Age: auto-set from crew profile, manually adjustable
- Season: Summer | Fall | Spring | Year-round
- Cost: Free | Under $100 | Under $250 | Any
- Registration: Open only | Include waitlist

**Program Cards show:**
- Name + provider
- Age range + schedule + cost
- Registration status pill (OPEN / CLOSING SOON / WAITLIST / SOLD OUT)
- Session dates

### F3: Camp Season (Seasonal Flagship)

January through March, camp planning dominates. Hooky becomes the camp comparison engine.

- Dedicated "Camp Season" section in feed
- Side-by-side camp comparison on: dates coverage, age fit, cost, before/after care, lunch, location
- Registration deadline alerts for saved camps
- Filter by: type (STEM, sports, arts, nature, general), week coverage, cost range

### F4: Compare

Side-by-side comparison of up to 4 items. The feature ZERO competitors offer.

**MVP dimensions:**

| Dimension | Source | Display |
|-----------|--------|---------|
| Age Range | program/event age_min/age_max | Band labels, green check per kid |
| Cost | cost_amount + cost_period | $/wk or "Free" |
| Schedule | session dates + schedule times | Calendar snippet |
| Location | venue address | Neighborhood + drive time |
| Registration | registration_status | Status pill |
| Freshness | crawl timestamp | "Updated 2 days ago" |

State in localStorage. Share via link (existing share_token pattern).

### F5: My Crew (Family Profile)

Per-kid profiles that power everything else.

**MVP:** Inline setup on first visit. "Who's in your crew?" with:
- Nickname + emoji picker
- Age band selector (infant/toddler/preschool/elementary/tween/teen)
- Interest chips (STEM, art, music, sports, outdoors, animals, reading, cooking, dance, theater)

**V1.5:** Full household with co-parent invite, home neighborhood, drive radius, dietary/accessibility needs at household level.

### F6: School Calendar Integration

Public school system calendar awareness. The panic-preventer.

- Select your school system (APS, DeKalb, Cobb, Gwinnett, private, homeschool)
- "Heads Up" section auto-populates with upcoming no-school days
- Teacher workday → auto-attach activity suggestions for your crew's ages
- Spring/winter/summer break → surface relevant programs and camps

### F7: Gap Filler (V1.5)

The coordination killer feature: "Bug has soccer 10-12 at Chastain. What can Rocket do within 10 minutes of there?"

- Pulls from committed/saved activities per kid
- Finds open time gaps
- Suggests activities filtered by: other kid's age, proximity to committed venue, time window
- Extends existing venue location data with drive-time calculations

### F8: Family Calendar (V1.5)

Unified view of the family's committed + saved activities.

- Color-coded lanes per kid
- Committed (enrolled programs) vs. saved (considering) visual distinction
- Conflict detection for overlapping times
- iCal export for any view (week, month, single kid)

### F9: Cross-Portal Federation

- **Yonder:** Family-friendly trails, outdoor adventures, nature programs
- **HelpATL:** Youth volunteer hours (teen programs), school board meetings
- **Atlanta:** All-ages events, festivals, free community events
- **Pack ATL:** Dog-friendly family activities (when active)

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

### Phase 1: Foundation (Portal + Core Data)
- [ ] Create portal record (slug: `hooky`, status: `draft`)
- [ ] Create visual preset / branding configuration
- [ ] Subscribe to existing family sources via federation
- [ ] Create interest channels (camps, enrichment, leagues, classes, free_events, outdoor_family)
- [ ] Create `programs` table + migration
- [ ] Seed school calendar data (APS, DeKalb, Cobb, Gwinnett 2025-26)
- [ ] Add `family_kids` JSONB to portal preferences
- [ ] Basic feed template with This Weekend + Heads Up + Free sections

### Phase 2: Programs + Age Filtering
- [ ] Programs API routes (list, detail, search with filters)
- [ ] Programs browser view with type/age/cost/registration filters
- [ ] Age-filtered discovery (events + programs shaped by crew ages)
- [ ] Registration status pills on program/event cards
- [ ] P0 crawler gaps (5 new crawlers)
- [ ] Seed 20+ programs with structured data

### Phase 3: Compare + Camp Season
- [ ] Compare tray (add/remove items, persistent in localStorage)
- [ ] Compare view with 6 dimensions
- [ ] Camp Season feed section (Jan-Mar seasonal)
- [ ] Camp comparison extensions (before/after care, lunch, week coverage)
- [ ] Registration deadline alerts for saved items

### Phase 4: Crew + School Calendar
- [ ] My Crew profile setup (inline, not onboarding flow)
- [ ] School calendar import (4 systems)
- [ ] "Heads Up" section driven by school calendar
- [ ] Per-kid "For [Nickname]" feed sections
- [ ] Teacher workday → activity suggestions

### Phase 5: Coordination (V1.5)
- [ ] Full household model (tables, co-parent invite)
- [ ] Family Calendar view (per-kid lanes, committed vs. saved)
- [ ] Gap Filler ("Kid A is busy, what can Kid B do nearby?")
- [ ] iCal export
- [ ] Household-level needs (dietary, accessibility)

### Phase 6: Trust + Distribution
- [ ] Freshness badges (Live/Recent/Stale/Unverified)
- [ ] Source authority scoring on sources table
- [ ] Source transparency on event/program detail
- [ ] SEO landing pages (/this-weekend, /summer-camps, /free-events)
- [ ] Cross-portal federation setup

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
