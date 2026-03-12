# HelpATL Content Strategy

**Portal:** `/helpatl`
**Version:** 1.3 — Full source expansion, all channels launch-ready
**Last Updated:** 2026-03-08

---

## Executive Summary

HelpATL is not a volunteer directory. It's a civic engagement layer for Atlanta — a single surface that answers "what can I do for my city today?" across volunteering, local government, and advocacy.

The content strategy balances three tensions:

1. **Breadth vs. Signal** — We aggregate from many sources, but users need clear paths based on their intent, not a firehose of listings.
2. **Events vs. Commitments** — Drop-in service events have dates; ongoing volunteer roles and advocacy campaigns don't. The feed must handle both without pretending they're the same thing.
3. **Neutral platform vs. Civic mission** — We surface government meetings and activist rallies without editorial slant, but we're not neutral about whether people should show up. The product's stance is: participation matters.

The voice is direct, warm, and civic-minded. A neighbor who knows what's going on — not a government website, not an activist newsletter, not a corporate CSR dashboard.

**Key differentiator (validated by competitive audit):** No platform currently surfaces volunteer events, government meetings, and advocacy events in a single feed. HOA does volunteering only. Idealist does volunteering only. Mobilize does advocacy only. The City of Atlanta does government meetings only, badly. The person who wants to sort food Saturday, attend school board Tuesday, and join a transit rally Thursday has no single place to go. That cross-mode integration is HelpATL's unique position.

---

## 1. Content Taxonomy

### Philosophy

HelpATL content is organized by **user intent**, not editorial category. The same organization (Sierra Club Atlanta) might run a park cleanup (Serve), attend an EPA hearing (Participate), and organize a rally (Organize). The user's mode determines what they see, not the org's identity.

### Three Intent Modes

| Mode | User Intent | Core Question | What It Contains |
|------|------------|---------------|-----------------|
| **Serve** | "I want to give my time to help" | What can I do? | Volunteer events, service projects, ongoing roles |
| **Participate** | "I want to engage with how my city runs" | What's being decided? | Government meetings, school boards, public comment, NPU meetings |
| **Organize** | "I want to push for change with others" | Who's taking action? | Advocacy events, rallies, organizing meetings, canvassing |

**Why three, not two or four:**
- Volunteering and activism feel similar but serve different intents. Sorting food at a food bank vs. attending a housing rally are both "doing good" but the user's mindset, time commitment, and information needs are different.
- "Community building" (block parties, mutual aid, neighborhood cookouts) is absorbed into Serve. The test: if someone organized it for the benefit of others, it's Serve. If it's purely social, it belongs on the Atlanta portal, not HelpATL.
- We explicitly exclude job postings, paid internships, and stipended positions. If it pays, it's not HelpATL content.

---

## 2. Content Types Per Mode

### Serve: Volunteering

#### Drop-In Events (Platform-native — has date/time/place)

Events you can show up to with little or no preparation. The core of v1.

| Content Type | Examples | Data Shape | Sources |
|---|---|---|---|
| Service projects | Food sort, park cleanup, trail maintenance, build day | Event with date, time, venue, org | Hands On Atlanta, Eventbrite Charity |
| Donation drives | Food drive, coat drive, school supply collection | Event with date, time, venue | Hands On Atlanta, org calendars |
| Community service events | Neighborhood cleanup, river sweep, tree planting | Event with date, time, venue | Park Pride, Trees Atlanta, Keep Atlanta Beautiful |
| Fundraising events | Charity walk/run, gala, benefit concert | Event with date, time, venue, price | Eventbrite Charity, org calendars |

**Card info hierarchy:**
1. Event name + org name
2. Date + time + location
3. Commitment badge: `Drop-in` (green chip)
4. Cause tag (food security, environment, education, etc.)

#### Commitment Roles (New content type — ongoing, no single date)

Roles requiring training, onboarding, background checks, or recurring availability. NOT events — they're role postings with availability windows.

| Content Type | Examples | Data Shape | Sources |
|---|---|---|---|
| Mentoring / tutoring | After-school tutoring, adult literacy, STEM mentoring | Role with schedule pattern, training req | United Way, Idealist |
| Crisis / health support | Crisis hotline, hospital companion, hospice support | Role with certification req, schedule pattern | United Way, Idealist |
| Animal care | Shelter shifts, foster coordination, transport | Role with orientation req, schedule pattern | LifeLine, Atlanta Humane, Furkids |
| Ongoing service | Meals on Wheels delivery, food pantry shifts | Role with recurring schedule | ACFB, Meals on Wheels, Open Hand |

**v1 treatment:** These don't fit the event model. For v1, we do NOT surface commitment roles in the feed. They live on organization detail pages as "Ongoing Opportunities" once the `volunteer_opportunities` table (PRD 030) is built and populated. The feed stays event-only until we have reliable data for both sides of the drop-in/commitment split.

**v2 treatment:** Commitment roles get a dedicated discovery view with filters for cause, time commitment, skills, and accessibility. The `commitment_level` field on `volunteer_opportunities` enables the split.

### Participate: Civic Involvement

#### Government Meetings (Platform-native — has date/time/place)

| Content Type | Examples | Data Shape | Sources |
|---|---|---|---|
| City council | Atlanta City Council sessions, committee hearings | Event with date, time, venue, agenda_url | atlanta-city-meetings (Legistar — **currently broken**, needs alternative source) |
| County commission | Fulton/DeKalb commission meetings, work sessions | Event with date, time, venue, agenda_url | fulton-county-meetings, dekalb-county-meetings |
| School boards | APS, Fulton, DeKalb board meetings | Event with date, time, venue, agenda_url | School board profiles (YAML) |
| NPU meetings | Neighborhood Planning Unit monthly meetings | Event with date, time, venue | atlanta-city-meetings |
| Zoning / planning | Zoning hearings, variance requests, planning commission | Event with date, time, venue, public comment flag | Legistar |

**Card info hierarchy:**
1. Meeting name + jurisdiction badge (City / County / School Board)
2. Date + time + location
3. Action type: `Public Comment Open` (amber chip) or `Informational` (grey chip)
4. Agenda link (if available)

#### Public Comment Deadlines (Partial fit — has deadline, not event time)

| Content Type | Examples | Data Shape | Sources |
|---|---|---|---|
| Comment periods | Zoning variance, environmental review, budget input | Deadline date + submission URL + context | Legistar agenda items, government portals |
| Input windows | Community survey, planning input, feedback period | Deadline date + URL | City/county websites |

**v1 treatment:** Surface via the Deadlines Module (PRD 029). Uses `action_deadline_at` field on events. Shown as countdown cards, not event cards. Limited to deadlines extractable from Legistar and government meeting agendas — no manual editorial curation.

### Organize: Activism & Advocacy

#### Advocacy Events (Platform-native — has date/time/place)

| Content Type | Examples | Data Shape | Sources |
|---|---|---|---|
| Rallies / marches | Housing march, transit rally, climate action | Event with date, time, venue/route | Mobilize.us, Eventbrite |
| Organizing meetings | Coalition meetings, chapter meetings, planning sessions | Event with date, time, venue | Mobilize.us, org calendars |
| Canvassing / outreach | Door-to-door, phone banking, voter registration | Event with date, time, meeting point | Mobilize.us |
| Town halls / forums | Community forums, candidate events, issue panels | Event with date, time, venue | Mobilize.us, Eventbrite |
| Public testimony | Showing up to testify at hearings, public comment events | Event with date, time, venue | Cross-listed from Participate |

**Card info hierarchy:**
1. Event name + organizing group
2. Date + time + location
3. Cause tag (housing, transit, environment, education, public safety)
4. Action type: `Show Up` / `Speak` / `Volunteer`

#### Campaigns (Does NOT fit event model — ongoing)

"Stop the highway expansion" or "Fund public transit" are causes, not events. They have associated events over time but are not themselves time-bounded.

**v1 treatment:** Campaigns are NOT a content type. They're represented as **interest channels**. A "Transit" channel aggregates transit-related events across all three modes (Serve: bike lane cleanup, Participate: MARTA board meeting, Organize: transit rally). Users follow causes via channels, not campaign pages.

**Hard exclusion:** No petition hosting, no donation collection, no endorsements. HelpATL surfaces where to show up, not what position to take.

**Electoral and partisan content:** Mobilize.us is 88% electoral/partisan (party committees, campaigns, coordinated political groups). Electoral content is NOT excluded — it's gated behind opt-in interest channels. Users who want to see candidate events or party organizing follow a "Political Campaigns" or specific candidate/party channel. This content never appears in the default Organize feed section or ungated channel views. Non-electoral civic advocacy (housing, transit, environment orgs) flows into cause channels normally even if the org leans politically — the test is whether the event is issue-focused or candidate-focused.

---

## 3. Interest Group Architecture

### Philosophy

Interest groups are how users tell HelpATL "what I care about." They cross-cut all three intent modes. Someone who follows "Education" sees tutoring events (Serve), school board meetings (Participate), and education funding rallies (Organize) — all in one channel.

### Three Interest Axes

#### Axis 1: Cause / Issue (Cross-mode)

The primary organizing principle for activism and the secondary one for volunteering.

| Channel | Serve Events | Participate Events | Organize Events |
|---|---|---|---|
| **Food Security** | Food bank sorts, meal prep, food drives | USDA hearings, nutrition program budgets | Food access rallies, policy advocacy |
| **Housing** | Habitat builds, shelter volunteering | Zoning hearings, housing authority meetings | Housing justice rallies, tenant organizing |
| **Environment** | Park cleanups, tree planting, river sweeps | EPA hearings, environmental review | Climate marches, conservation advocacy |
| **Education** | Tutoring, mentoring, school supply drives | School board meetings, budget hearings | Education funding advocacy |
| **Transit & Mobility** | Bike lane cleanups, pedestrian safety | MARTA board, DOT hearings | Transit advocacy rallies |
| **Public Safety** | Community watch, crisis intervention training | Police oversight board, court watch | Criminal justice reform events |
| **Health & Wellness** | Health fair volunteering, blood drives | Public health board meetings | Healthcare access advocacy |
| **Animals** | Shelter shifts, foster, transport | Animal control hearings | Animal welfare advocacy |
| **Arts & Culture** | Arts education volunteering, mural projects | Arts funding hearings | Cultural preservation advocacy |

**v1 channels (all 9 launch — channels fill out as crawlers ship):**

| Channel | Source Coverage | What Fills It |
|---|---|---|
| **Food Security** | 517 HOA timeslots/month + ACFB crawler | Strongest single-cause volume by far. |
| **Education** | HOA + 3 school boards + Mobilize | Best cross-mode coverage. School board crawlers are the Participate anchor. |
| **Environment** | HOA + Park Pride + Trees Atlanta + Keep Atlanta Beautiful + Mobilize + Eventbrite | Org-specific crawlers diversify beyond HOA. Seasonal peaks Mar-Apr. |
| **Housing** | Mobilize + Eventbrite + Legistar (zoning hearings) | Thin on Serve until Habitat/GivePulse explored. Participate + Organize carry it. |
| **Health & Wellness** | HOA (26/month) + Eventbrite + Mobilize | 40-50 events/month. Grows with org crawlers (Open Hand, hospitals). |
| **Animals** | LifeLine + Atlanta Humane + Furkids + Eventbrite Charity | Org crawlers unlock this channel. Near-zero without them — they're the priority. |
| **Transit & Mobility** | MARTA board + Mobilize transit events | MARTA board crawler is the anchor. ThreadATL/CFPT add occasional events. |
| **Arts & Culture** | ArtsATL + Eventbrite Charity + HOA (8/month) | Thinnest channel. ArtsATL crawler is the key unlock. |
| **Public Safety** | Source-based only (oversight boards from Legistar when Atlanta is fixed) | No keyword tagging — "police" is ambiguous across orgs. Grows only with structured sources. |

All 9 channels seeded from day one. Thin channels are honest about it — better to have a channel with 2 upcoming events than to hide the category. Channels with 0 matches for 30+ days get flagged for source investigation.

#### Axis 2: Geography / Jurisdiction (Civic-primary)

Determines which government meetings matter to you. This is the primary axis for Participate mode.

| Level | What It Covers | Example Channels |
|---|---|---|
| **City** | City council, municipal agencies, NPUs | City of Atlanta Government |
| **County** | County commission, county services | Fulton County Government, DeKalb County Government |
| **District** | School districts, state legislature districts | APS Board, Fulton County Schools, DeKalb County Schools |
| **Neighborhood** | NPU, civic associations, local orgs | NPU-N (Midtown), Virginia-Highland Civic |

**v1 implementation:** Geography channels use `source` rules (one source per government body). The `geo` rule type exists in the schema but is not yet implemented in the matching engine — this must be built before onboarding multi-city sources like Mobilize.us.

**How users set jurisdiction:** During onboarding or in settings: "Where do you live?" → city + county auto-detected from address or zip. School district asked separately ("Do you have kids in public school? Which district?"). This populates default channel subscriptions, not hard filters — users can always follow channels outside their jurisdiction.

#### Axis 3: Life Stage / Identity (Discovery layer)

Not a filtering mechanism — a channel recommendation engine. "Tell us about yourself" at onboarding surfaces relevant channels.

| Signal | Recommended Channels |
|---|---|
| "I have kids in school" | School Board Watch, Education, youth program orgs |
| "I'm a homeowner" | Zoning/planning, neighborhood civic associations, property tax hearings |
| "I'm new to Atlanta" | Broad civic overview, neighborhood NPU, community events |
| "I'm a renter" | Housing, tenant rights, city housing authority |
| "I'm retired" | Meals on Wheels, hospital companion, civic meeting attendance (more availability) |
| "I'm a student" | Campus-adjacent volunteering, civic engagement orgs, activism |

**v1 treatment:** Life stage is a future UX concern. For v1, users discover channels by browsing the channel directory or being prompted by the feed. No onboarding quiz needed — that's v2 personalization built on real usage data.

---

## 4. Tag Vocabulary

### Philosophy

Tags serve two purposes: (1) interest channel matching, and (2) user-facing filtering. Every tag must have a clear meaning, be inferrable from crawled data, and enable useful filtering. Tags that require editorial judgment or manual curation are out of scope.

### Cause Tags (Applied to events across all modes)

| Machine Name | Display Label | Applies To |
|---|---|---|
| `food-security` | Food Security | Food bank events, food drives, meal programs |
| `housing` | Housing | Habitat builds, zoning hearings, housing rallies |
| `environment` | Environment | Cleanups, tree planting, EPA hearings, climate events |
| `education` | Education | Tutoring, school boards, education funding |
| `transit` | Transit & Mobility | MARTA events, bike/ped safety, transit advocacy |
| `public-safety` | Public Safety | Community watch, court watch, oversight boards |
| `health` | Health & Wellness | Health fairs, blood drives, public health boards |
| `animals` | Animals | Shelter events, foster, animal welfare |
| `arts-culture` | Arts & Culture | Arts education, mural projects, cultural events |
| `youth` | Youth & Families | Youth programs, family events, child welfare |

### Engagement Tags (Applied to events to describe what you do there)

| Machine Name | Display Label | Mode | Applies To |
|---|---|---|---|
| `volunteer` | Volunteer | Serve | Any hands-on service event |
| `donate` | Donate | Serve | Donation drives, fundraisers |
| `public-comment` | Public Comment | Participate | Meetings with open comment periods |
| `attend` | Attend & Listen | Participate | Informational meetings, town halls |
| `rally` | Rally / March | Organize | Rallies, marches, demonstrations |
| `canvass` | Canvass | Organize | Door-to-door, phone banking, outreach |
| `organize` | Organizing Meeting | Organize | Coalition meetings, planning sessions |

### Commitment Tags (Applied to volunteer opportunities)

| Machine Name | Display Label | Meaning |
|---|---|---|
| `drop-in` | Drop-in | No prep required, show up and help |
| `orientation-required` | Orientation Required | Brief training or orientation first |
| `training-required` | Training Required | Formal training program before you can serve |
| `background-check` | Background Check | Background check required (youth-serving, etc.) |
| `recurring` | Recurring Commitment | Ongoing weekly/monthly schedule |

### Jurisdiction Tags (Applied to civic events)

| Machine Name | Display Label | Applies To |
|---|---|---|
| `city-atlanta` | City of Atlanta | City council, municipal agencies |
| `fulton-county` | Fulton County | County commission, county services |
| `dekalb-county` | DeKalb County | County commission, county services |
| `aps` | Atlanta Public Schools | APS board meetings |
| `fulton-schools` | Fulton County Schools | Fulton board meetings |
| `dekalb-schools` | DeKalb County Schools | DeKalb board meetings |

### Tag Application Guidelines

**At crawl time:** Cause tags are inferred from source identity (Hands On Atlanta food sort → `food-security`, `volunteer`) and event description keywords. Jurisdiction tags are assigned from source identity (Legistar source → corresponding jurisdiction tag). Engagement tags are inferred from event type fields in source APIs (Mobilize.us provides event_type).

**Manual tagging is NOT a content strategy.** If a tag can't be reliably inferred at crawl time, it doesn't exist in v1. Tags that require human judgment (like commitment level on ambiguous events) are deferred to the `volunteer_opportunities` enrichment layer (PRD 030).

---

## 5. Source-to-Taxonomy Mapping

### How sources feed the taxonomy (Updated with Wave 1 audit data)

| Source | Primary Mode | Confirmed Volume | Cause Skew | Crawlability | Priority |
|---|---|---|---|---|---|
| **Hands On Atlanta** (Golden) | Serve | ~851 timeslots/month, ~150-250 active opps | 61% food, 18% education, 9% environment | Medium — Playwright (React SPA, no bot protection) | P0 |
| **Legistar** (DeKalb + Fulton) | Participate | ~8 meetings/month (DeKalb 6, Fulton 2) | All civic | Easy — public REST API, no auth | P0 |
| **DeKalb School Board** | Participate | ~2 meetings/month | Education | Easy — clean HTML, BeautifulSoup | P0 |
| **Eventbrite Charity** | Serve + Organize | ~429 events, ~150-170 net-new after dedup | 48% galas, 16% workshops, 8% animal | Easy — extend existing crawler (10 min) | P0 |
| **Mobilize.us** | Organize | ~30-50 civic events/month (GA), ~36 Atlanta city | 88% partisan/electoral, 12% non-electoral civic | Easy — public REST API | P1 |
| **APS School Board** | Participate | ~2 meetings/month | Education | Medium — JS widget, Playwright required | P1 |
| **MARTA Board** | Participate | ~2-3 meetings/month | Transit | TBD — public meeting page, likely scrapable | P1 |
| **Park Pride** | Serve | TBD — public event calendar | Environment | TBD — org website | P1 |
| **Trees Atlanta** | Serve | TBD — public event calendar | Environment | TBD — org website | P1 |
| **Keep Atlanta Beautiful** | Serve | TBD — public event calendar | Environment | TBD — org website | P1 |
| **ACFB** (Atlanta Community Food Bank) | Serve | TBD — volunteer calendar | Food Security | TBD — org website | P1 |
| **LifeLine Animal Project** | Serve | TBD — volunteer/adopt events | Animals | TBD — org website | P1 |
| **Atlanta Humane Society** | Serve | TBD — events page | Animals | TBD — org website | P1 |
| **Furkids** | Serve | TBD — events/volunteer page | Animals | TBD — org website | P1 |
| **United Way** (Galaxy Digital) | Serve | ~48 listings, 92% ongoing | Broad | Easy — scrapable HTML | P2 |
| **Idealist** (absorbed VolunteerMatch) | Serve | ~2,400 listings, ~35-40% date-specific | Broad | Pending — API application required | P2 |
| **JustServe** | Serve | TBD | Broad | Medium — JS SPA, Playwright | P2 |
| **Fulton School Board** | Participate | ~2 meetings/month | Education | Hard — dates may be in PDF/image, investigate first | P2 |
| **NPU meetings** | Participate | ~25/month | Local civic | Hard — no confirmed central source, needs crawler for `atlcitydesign.com` or similar | P2 |
| **ArtsATL** | Serve + Organize | TBD — event calendar | Arts & Culture | TBD — org website | P2 |

**Critical gap: Atlanta City Legistar is broken.** The API returns a server configuration error. This is the highest-value civic source (city council, committees, zoning, NPUs) and produces zero data. Requires either outreach to Granicus or finding an alternative calendar source (possibly `atlcitydesign.com/upcoming-events`).

### Source gap analysis by mode (Updated)

| Mode | Source Coverage | Remaining Gap |
|---|---|---|
| **Serve** | HOA covers the core (~851 timeslots/month). Eventbrite Charity adds ~150 net-new. Org-specific crawlers (Park Pride, Trees Atlanta, Keep Atlanta Beautiful, ACFB, LifeLine, Atlanta Humane, Furkids) diversify beyond HOA's food skew. United Way and JustServe add breadth. | Food skew reduces as org crawlers come online. Idealist API (if approved) would add the most breadth. |
| **Participate** | DeKalb + Fulton Legistar give ~8 meetings/month. School boards (DeKalb, APS, Fulton) add ~4-6/month. MARTA board adds ~2-3/month. | **Atlanta City Legistar is broken** — 0 meetings available via API. This is the biggest single content gap. NPU meetings (25/month) need a crawlable source. |
| **Organize** | Mobilize has ~30-50 civic events/month for GA. Electoral content gated behind opt-in channels. Eventbrite Charity supplements. | Non-electoral supply is thin (~37 events). Will strengthen as Mobilize crawler matures and cause-based Eventbrite events flow in. |

---

## 6. Voice & Tone

### Brand Personality

HelpATL is:
- **Direct** — Clear about what's happening and what you can do about it
- **Warm** — Welcoming to newcomers, encouraging to regulars
- **Civic-minded** — Believes participation matters, without telling you what to think
- **Local** — Knows Atlanta neighborhoods, institutions, and rhythms

HelpATL is NOT:
- A government website (no bureaucratic language)
- An activist newsletter (no editorial positions on issues)
- A corporate CSR dashboard (no "impact metrics" theater)
- A guilt trip (no "your community needs you" pressure)

### Voice Principles

1. **Agency, not guilt**
   - "School board meeting Tuesday — public comment is open"
   - NOT "Your school board needs to hear from you!"

2. **Specific, not abstract**
   - "Sort food at the Community Assistance Center, Saturday 9am"
   - NOT "Make a difference in your community"

3. **Inclusive, not performative**
   - "All skill levels welcome"
   - NOT "No experience necessary — everyone can be a hero!"

4. **Informative, not prescriptive**
   - "Fulton County is voting on the transit plan Thursday"
   - NOT "Don't miss this critical vote on our city's future"

5. **Local, not generic**
   - "Sort food at the Community Assistance Center in East Point"
   - NOT "Find volunteer opportunities in your area"

6. **Readable, not bureaucratic**
   - "DeKalb County commissioners meet Tuesday at 6:30pm"
   - NOT "The Board of Commissioners of DeKalb County will convene a Regular Session"

7. **Earned urgency, not inflation**
   - Urgency language is reserved for the Deadlines Module (countdown to public comment close)
   - NOT scattered through the feed as exclamation marks and "don't miss" phrasing

### Tone Spectrum

| Context | Tone | Example |
|---------|------|---------|
| Feed section header | Inviting, matter-of-fact | "This Week" / "Public Meetings" / "Taking Action" |
| Event card | Informative | "Food sort at East Point warehouse. 3 shifts available." |
| Empty state | Encouraging, honest | "No upcoming events from this source yet." |
| Channel description | Clear, specific | "City of Atlanta council sessions, committee hearings, and municipal meetings." |
| Deadline card | Urgent but not alarmist | "Public comment closes Friday. 3 days left." |
| Error state | Calm | "Something went wrong. Try again." |
| Onboarding | Welcoming | "What's going on in your part of the city?" |

### Word Choices

**Use:**
- Show up, participate, get involved (active, non-judgmental)
- Volunteer, serve (for service events specifically)
- Public meeting, hearing, session (for government)
- Advocate, organize (for activism)
- Your neighborhood, your district (geographic specificity)

**Avoid:**
- "Make a difference" (vague, overused — every competitor uses it)
- "Give back" (implies debt — found on HOA and Idealist)
- "Hero" / "warrior" / "champion" (performative)
- "Your presence matters" (mild guilt trip, not an invitation)
- Exclamation marks in event titles (signals desperation, not urgency)
- "Slacktivism" or any judgment of effort levels
- "Woke" / "progressive" / "conservative" (no political framing)
- "Underserved" (deficit framing — use specific community names)

**Gold standard:** Idealist's "Done in a Day" tag — four words, does exactly its job. That's the clarity bar for all HelpATL copy.

---

## 7. Feed Composition

### HelpATL Feed Sections

The feed answers: "What's happening this week that I can show up to?"

| Section | Content | Source | Mode |
|---|---|---|---|
| **Civic Hero** | Editorial masthead — greeting + dateline + action counts | Computed | All |
| **Your Groups** | Interest channels the user follows, with match counts | Interest channels | All |
| **Upcoming Deadlines** | Next 3 civic deadlines with countdown | `action_deadline_at` field | Participate |
| **This Week: Volunteer** | Drop-in service events in the next 7 days | HOA, Eventbrite Charity | Serve |
| **Public Meetings** | Government meetings in the next 14 days | Legistar, school boards | Participate |
| **Taking Action** | Advocacy events in the next 14 days | Mobilize.us, Eventbrite | Organize |
| **Your Neighborhood** | Events near user's location or followed NPU | Geo-filtered | All |

**Volume asymmetry:** Serve produces 200-230 items/week from HOA + Eventbrite Charity alone. Participate produces 8-9 meetings per 14-day window. Organize produces 10-20 events/week. Despite this 20-30x gap between Serve and Participate, all three sections are treated equally in the feed — each shows a representative sample (6-8 cards) with "See all" routing to filtered views. The volunteer section must sample across causes, not just sort by date, or it will look like a food bank directory (61% of HOA = food).

**Section ordering logic:**
- Your Groups always appears near the top (personalization anchor)
- Upcoming Deadlines appears when deadlines exist within 7 days
- The three mode sections (Volunteer, Public Meetings, Taking Action) rotate based on what has the most upcoming content
- Your Neighborhood only appears if we have location or NPU subscription

**Empty state policy:** Sections with zero upcoming events are hidden, not shown empty. The feed should never show a mode with no content — that communicates "nothing is happening" which is always false.

### Section Copy

#### Civic Hero

**Greeting pattern:** `Good [morning/afternoon/evening], Atlanta.`
**Dateline:** `[Day of week], [Month] [Date]`
**Stat line:** `[N] volunteer events · [N] public meetings · [N] actions this week`
**Empty stat:** Omit the stat line if totals are below 5 combined.

#### This Week: Volunteer

**Title:** This Week
**Subtitle:** Volunteer opportunities you can drop into
**See all:** "See all volunteer events"
**Empty state:** *(section hidden)*

#### Public Meetings

**Title:** Public Meetings
**Subtitle:** What's being decided in your city
**See all:** "See all meetings"
**Empty state:** *(section hidden)*

#### Taking Action

**Title:** Taking Action
**Subtitle:** Rallies, organizing, and advocacy
**See all:** "See all actions"
**Empty state:** *(section hidden)*

#### Upcoming Deadlines

**Title:** Deadlines
**Subtitle:** Comment periods and action windows closing soon
**Card format:** `[Meeting name] — [Action type] · [N] days left`
**Empty state:** *(section hidden)*

#### Your Groups

**Title:** Your Groups
**Subtitle:** Topics and jurisdictions you follow
**Card format:** Channel name + `[N] upcoming` count
**Empty state (no subscriptions):** "Follow topics to see what matters to you. Browse groups."
**CTA:** "Browse all groups"

---

## 8. Data Model Requirements

### What fits today (no schema changes)

| Content | Model | Notes |
|---|---|---|
| Drop-in volunteer events | `events` table | Category: community, tags: [volunteer, cause] |
| Government meetings | `events` table | Category: community, tags: [jurisdiction, public-comment?] |
| Advocacy events | `events` table | Category: community, tags: [cause, rally/canvass/organize] |
| Interest channels | `interest_channels` + `interest_channel_rules` | Source and tag rules work today |

### What needs building (PRD 029 — Civic Action)

| Field | Table | Purpose | Priority |
|---|---|---|---|
| `action_deadline_at` | events | Public comment deadline dates | P0 — headline feature |
| `agenda_url` | events | Link to meeting agenda PDF | P1 — action path for civic |
| `action_type` | events | attend / comment / signup / testify | P1 — CTA differentiation |
| `action_url` | events | Where to take action (submit comment, register) | P1 — conversion path |

### What needs building (PRD 030 — Volunteer Engagement, v2)

| Field | Table | Purpose | Priority |
|---|---|---|---|
| `commitment_level` | volunteer_opportunities | drop_in / ongoing / lead_role | P2 — filter attribute |
| `skills_required` | volunteer_opportunities | Array of skill tags | P2 — fit scoring |
| `training_required` | volunteer_opportunities | Boolean + description | P2 — commitment ladder |
| `physical_demand` | volunteer_opportunities | low / moderate / high | P3 — accessibility |

### Technical blocker: geo rule implementation

The `geo` rule type exists in `interest_channel_rules.rule_type` enum but `ruleMatchesEvent()` in `interest-channel-matches.ts` does not implement it (falls through to `return false`). This MUST be built before activating multi-city sources like Mobilize.us — otherwise an "Atlanta Activism" channel would match events from other cities that flow through the same source.

**Implementation scoped (from 6B audit):**
- Extend `MatchableEvent` type with `venue.city`, `venue.state`, `venue.lat`, `venue.lng`
- Add LEFT JOIN to venues table in event loading query (`refreshEventChannelMatchesForPortal`)
- Implement `case "geo"` switch with four subtypes: city match, state match, radius (Haversine via existing `lib/geo.ts`), neighborhood match
- Rule payload format: `{ "type": "city", "cities": ["atlanta"] }` or `{ "type": "radius", "center_lat": 33.749, "center_lng": -84.388, "radius_miles": 2.0 }`
- No database migrations needed — rule_type enum already includes `"geo"`
- Estimated effort: 2-3 hours including tests
- ~85% of venues have lat/lng populated; geo rules fail silently for events without venue (correct for virtual events)
- Files to modify: `interest-channel-matches.ts` (matching logic + type), `interest-channel-matches.test.ts` (new test cases)

---

## 9. What HelpATL Is NOT

Hard exclusions — things we will not build, and why.

| Exclusion | Why |
|---|---|
| **Job board** | Paid positions are a different product. HelpATL is for unpaid civic engagement. |
| **Resources directory** | Static links go stale. No crawler solution. Content maintenance trap. |
| **Campaign tracker** | Campaigns are a different entity type requiring editorial work. Causes live as interest channels. |
| **Petition hosting** | That's Action Network / Change.org territory. We show where to show up, not what position to take. |
| **Donation platform** | We link to org websites. We don't process money. |
| **Volunteer CRM** | Capacity tracking, reliability scoring, org dashboards — requires org adoption we don't have. |
| **Legislative document parsing** | Agenda analysis, bill tracking — different product category (GovTrack, LegiScan). |
| **Personalized recommendations** | Fit scoring, impact ledgers — requires user history that doesn't exist at launch. Defer to v2. |
| **Database search UX** | HelpATL is a feed with editorial composition, not a filter interface over 2,000 items. Idealist already does that. We surface what's happening, not what exists. |
| **Support group meetings** | AA/NA and similar recovery meetings are excluded (existing DB trigger). Anonymity is foundational to these programs. Orgs can be volunteer sources; their support meetings are never surfaced. |

---

## 10. Content Operations

### Crawler Build Priority

Organized by build complexity, not research readiness. All sources have been validated — this is a build sprint.

**Phase 1: Immediate (config changes + easy crawlers)**
1. Eventbrite Charity category extension — add one URL to `BROWSE_URLS` + virtual event filter (~10 min)
2. Implement geo rule matching in `interest-channel-matches.ts` (~2-3 hours)
3. DeKalb + Fulton County Legistar API crawlers — public REST API, structured data (~8 meetings/month)
4. DeKalb School Board crawler — clean HTML calendar, BeautifulSoup, template for other boards
5. Submit Idealist API inquiry (parallel — starts the 5-7 week clock). Frame as civic engagement platform. Idealist absorbed VolunteerMatch (merged Jan 2025, completed Sep 2025).
6. File Granicus support ticket about broken Atlanta City Legistar API (parallel — could unlock 15-25 meetings/month)

**Phase 2: High-leverage crawlers**
7. Hands On Atlanta (Golden Volunteer) Playwright crawler — React SPA, no bot protection, ~851 timeslots/month. Explore reverse-engineering `api2.goldenvolunteer.com` for direct API access.
8. Mobilize.us API crawler — public API, `state=GA` + city filter. Use `event_type` for engagement tags. Electoral content gated behind opt-in channels.
9. APS School Board crawler — JS-rendered widget, Playwright required

**Phase 3: Org-specific crawlers (channel fillers)**
These are the crawlers that unlock the thinner channels. Each is a single-org website scrape — crawler-dev agents can parallelize these.

10. **Animals cluster:** LifeLine Animal Project, Atlanta Humane Society, Furkids — unlocks Animals channel
11. **Environment cluster:** Park Pride, Trees Atlanta, Keep Atlanta Beautiful — diversifies Serve beyond HOA food skew
12. **Food Security:** ACFB (Atlanta Community Food Bank) — supplements HOA with direct food bank volunteer calendar
13. **Transit:** MARTA Board meeting page — anchor for Transit & Mobility channel
14. **Arts:** ArtsATL event calendar — anchor for Arts & Culture channel
15. **Broad:** United Way (Galaxy Digital) — scrapable HTML, 48 listings, adds breadth

**Phase 4: Harder sources (investigate + build)**
16. Fulton School Board — investigate whether calendar is in PDF/image or has a web-accessible version
17. JustServe — JS SPA, Playwright. Investigate internal API.
18. NPU meetings — find crawlable source (`atlcitydesign.com/upcoming-events` or similar)
19. Atlanta City Legistar — follow up on Granicus ticket, evaluate alternative sources

**Dropped from plan:**
- ~~VolunteerMatch~~ — merged into Idealist, no longer exists as separate platform

### Launch Content Thresholds (Updated with confirmed source volumes)

| Mode | Minimum for Launch | Target for Quality | Achievable With |
|---|---|---|---|
| Serve | 50 upcoming events from 2+ sources | 100+ events from 3+ sources | HOA (~200/week) + Eventbrite Charity (~35/week) easily clears this |
| Participate | 8 upcoming meetings from 3+ jurisdictions (14-day window) | 15+ meetings from 5+ jurisdictions (14-day window) | DeKalb + Fulton Legistar (~8/month) + school boards (~8-10/month) = ~8-9 per 14-day window. Meets minimum. **Atlanta City blocked until Legistar is fixed.** |
| Organize | 8 upcoming events from 2+ orgs | 15+ events from 3+ sources | Mobilize non-electoral (~15-20/week Atlanta metro) + Eventbrite advocacy meets minimum |
| Interest Channels | 3 channels with 5+ matches each | 6+ channels with 5+ upcoming matches | All 9 seeded; Food Security, Education, Environment, Housing confirmed viable. Others fill out as sources come online. |

**Gate:** Do not publicly promote HelpATL until all "minimum for launch" numbers are met. An empty feed communicates "nothing is happening" — the opposite of our mission.

**Risk:** Participate mode is the weakest. Without Atlanta City Legistar, we have only DeKalb + Fulton (~8 meetings/month). Adding school boards (~4-6/month) and seeded NPU recurring events (~25/month) could compensate, but the flagship jurisdiction (City of Atlanta) is missing.

### Data Quality Rules

**Inclusion criteria:**
- Must have a date in the future (no "ongoing" without a date anchor)
- Must have a location OR be explicitly virtual
- No price cap (charity galas, benefit walks, and fundraisers are valid civic engagement)
- Must be in the Atlanta metro area (ITP + near OTP)
- Must not be a job posting, internship, or paid position

**Exclusion criteria:**
- Events older than 24 hours past end time (auto-expire)
- Duplicate events from multiple sources (dedup by title + date + venue)
- Events requiring membership in a specific org to attend (unless the event is explicitly public)
- Sensitive support groups (AA/NA meetings — already excluded by existing trigger)

### Ongoing Content Cadence

**Automated (crawlers):**
- All sources crawled daily minimum
- High-volume sources (HOA, Mobilize) crawled every 6 hours
- Government meeting sources crawled weekly (meetings are scheduled far in advance)

**Manual review (quarterly):**
- Audit channel coverage — any channel with 0 matches in 30 days needs source investigation
- Review cause tag accuracy across sources
- Check for new Atlanta volunteer platforms not yet crawled

---

## 11. Success Metrics

### Content Coverage

| Metric | Target | Measurement |
|---|---|---|
| Serve events per week | 50+ (from 2+ sources) | Automated count from DB |
| Participate meetings per 14-day window | 8+ (from 3+ jurisdictions) | 14-day lookahead matches feed display |
| Organize events per week | 8+ (from 2+ orgs) | Automated count from DB |
| Active sources producing events | 10+ | Source quality dashboard |
| Interest channels with matches | 3+ channels with 5+ upcoming matches each | Channel coverage ratio |
| Cause tag coverage | 90%+ of events have at least one cause tag | Tag audit query |

### User Engagement (Post-Launch)

| Metric | Target | What It Tells Us |
|---|---|---|
| Feed scroll depth | 50%+ reach second mode section | Content hierarchy working |
| Channel subscription rate | 30%+ of returning users follow 1+ channel | Interest groups are useful |
| Event detail tap rate | 15%+ of visible event cards | Content is compelling |
| Source URL click-through | 10%+ of event detail views | Users are taking action |
| Mode distribution | No mode below 15% of taps | Balanced content, not just one bucket |

### What We Don't Measure (v1)

- Volunteer hours logged (we don't track post-event attendance)
- "Impact" metrics (no way to measure outcomes without org partnerships)
- Conversion to commitment roles (commitment roles not in v1)
- Political engagement (we don't track what people do at meetings)

We resist vanity metrics. Showing people what's happening and getting them to tap through to the source is the v1 success bar. Measuring "impact" requires organizational data we don't have and creates incentives to inflate numbers.

---

## Appendix: Copy Matrix

Quick reference for common UI strings.

| UI Element | Copy |
|---|---|
| Portal tagline | "Volunteer, show up, shape your city." |
| Mobile nav tab 1 | Act |
| Mobile nav tab 2 | Calendar |
| Mobile nav tab 3 | Groups |
| Feed greeting | "Good [morning/afternoon/evening], Atlanta." |
| Stat line | "[N] volunteer events · [N] public meetings · [N] actions this week" |
| Empty feed (pre-launch) | "We're getting HelpATL ready. Content is on the way." |
| Channel join CTA | "Follow" |
| Channel leave CTA | "Following" (toggles to unfollow on tap) |
| Channel empty state | "No upcoming events in this channel." |
| Deadline card | "[Meeting] — Public comment closes [date]. [N] days left." |
| Event card (Serve) | "[Event name] · [Org] · [Date] · Drop-in" |
| Event card (Participate) | "[Meeting name] · [Jurisdiction] · [Date]" |
| Event card (Organize) | "[Event name] · [Org] · [Date] · [Action type]" |
| See all (Serve) | "See all volunteer events" |
| See all (Participate) | "See all public meetings" |
| See all (Organize) | "See all actions" |
| Source attribution | "via [Source Name]" |
| Action CTA (attend) | "Details & Directions" |
| Action CTA (comment) | "Submit Comment" |
| Action CTA (signup) | "Sign Up" |
| Login prompt | "Log in to follow groups" |
| Error (generic) | "Something went wrong. Try again." |
