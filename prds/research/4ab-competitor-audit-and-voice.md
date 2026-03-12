# Research 4A/4B: Competitor Content Audit & Voice Benchmarking

**Purpose:** Research Track 4 from `helpatl-content-research-plan.md` — competitor content organization, UX patterns, voice/tone samples, and HelpATL differentiation opportunities.

**Status:** Complete — 2026-03-08

**Informs:** `helpatl-content-strategy.md` §1 (executive summary), §6 (voice & tone), §9 (exclusions)

---

## Research Methodology

Five platforms audited via direct page fetching and web research. VolunteerMatch is no longer a separate platform — it merged with Idealist in January 2025, with full platform consolidation completed September 8, 2025. All VolunteerMatch URLs redirect to Idealist.org. The combined platform is treated as a single entry below.

---

## Competitor Profiles

### 1. Hands On Atlanta (handsonatlanta.org + volunteer.handsonatlanta.org)

**What it is:** Atlanta's primary volunteer-placement broker, connecting individuals and corporate groups with 500+ nonprofit partner organizations. Their technology stack is Golden Volunteer (goldenvolunteer.com), a third-party volunteer management platform they white-label. As of March 2026, HOA has engaged 75,000+ volunteers per year — a 3x increase since adopting Golden in late 2021.

#### Content Organization Model

HOA's information architecture splits across two surfaces:

- `handsonatlanta.org` — marketing site. Three issue-based cause categories (Food, Education, Environment). Navigation paths for individual, team/corporate, and mandatory service volunteers. No browse-in-place; everything funnels to the portal.
- `volunteer.handsonatlanta.org` (Golden portal) — actual opportunity discovery. Calendar-based, searchable, filterable by date, impact area, and location.

The cause categories on the marketing site are conspicuously thin: only Food, Education, and Environment appear as primary entry points. Animals, Health, Housing, and other causes are subordinate or absent from the marketing navigation — they exist in the portal but not in the top-level IA.

#### Filters Available

From Golden portal and search result documentation:
- Date range
- Impact area / cause (Food, Education, Environment, plus additional categories in portal)
- Location / distance
- Group-friendly vs. individual

There is no structured commitment-level filter (drop-in vs. ongoing) visible at the surface. Distinction is present in individual listings but not a browseable dimension.

#### Dated Events vs. Ongoing Roles

HOA skews heavily toward dated, time-specific volunteer events (a food sort on Saturday at 9am, a park cleanup on a specific date). This matches their model: they are a project-placement org, not a role-placement org. Ongoing/recurring commitments exist (AmeriCorps) but are treated as a program pathway, not browseable opportunities.

**Key structural insight:** HOA has solved the drop-in/dated-event problem because their entire inventory IS drop-in events. They have essentially curated away the ambiguity by only hosting organizations whose opportunities have specific dates and times. This is a feature, not an accident — and it limits their ability to surface ongoing commitment roles at scale.

#### UX Strengths

- Golden's opportunity listings are visually clean and performant
- Cause filtering works for the three primary categories
- Strong social proof (75,000+ volunteers/year, named corporate partners)
- Clear accessibility messaging ("navigating the perfect project to fit your schedule, interests and accessibility")
- Multiple entry points (individual, team, corporate, mandatory service)

#### UX Weaknesses

- Two-site split creates friction: the main site markets, the portal delivers, and they feel disconnected
- Cause taxonomy is artificially narrow (3 causes on marketing site vs. broader reality)
- No commitment-level signal on browse/search — you can't filter "show me only events I can drop into today"
- Portal login requirement for certain actions creates drop-off
- As of March 3, 2026: "TEMPORARY ISSUE WITH VOLUNTEER REGISTRATION SYSTEM" — a visible failure state on the homepage, which is damaging for a platform whose job is to be reliable
- Geographic browsing is not intuitive — you need to know what you want before the UI helps you find it
- No civic event content at all — HOA is purely volunteering, not participation or advocacy

#### Voice & Tone

HOA leans energetic and mission-adjacent corporate. Key patterns:

- "Do Something Good" — tagline. Catchy but abstract. Gives you no sense of scale or specificity.
- "Now is the time to serve! Help us tackle Atlanta's most pressing needs" — urgency framing bordering on guilt
- "Rally your team" — action-oriented but vague
- "Luckily, we've got your back!" — reassuring but slightly condescending
- "Made by volunteer + service rockstars in Atlanta, GA" — insider-y, tries to be informal
- "a more engaged and equitable atlanta" — lowercase hero text, social-mission signaling

**Pattern diagnosis:** HOA oscillates between corporate-friendly ("serve with coworkers", partner logos, "corporate activations") and grassroots-warm. The result is a voice that is neither fully one nor the other. The word "equitable" in the hero is doing heavy strategic lifting but is not earned by the content around it. The blog is titled "Stories of Service — The Citizen Blog," which is the best voice choice on the site: it positions the reader as a civic actor, not a charity consumer.

---

### 2. Idealist.org (formerly + VolunteerMatch, merged September 2025)

**What it is:** Post-merger, the largest volunteer opportunity platform in the US, combining Idealist's jobs/roles database with VolunteerMatch's AI matching. Serves 200,000+ organizations. Atlanta listings: 2,396 opportunities as of research date.

#### Content Organization Model

Idealist operates a single unified search/browse experience with robust filters. Their inventory mixes:
- Paid nonprofit jobs (clearly labeled, separate content type)
- Volunteer opportunities (the focus for HelpATL comparison)
- Internships (paid and unpaid)

The volunteer search is functionally a database query engine with filters — there is no editorial curation, no feed composition, no contextual ordering. You get a list sorted by recency or relevance depending on your query.

The "Done in a Day" checkbox is a smart acknowledgment that commitment level is the primary UX friction point for new volunteers. It filters to one-time, time-bounded activities.

#### Filters Available

- **Location type:** On-site, Hybrid, Remote
- **Cause areas:** 50+ categories (Agriculture, Animals, Arts & Music, Children & Youth, Climate Change, Education, Health & Medicine, Housing & Homelessness, Human Rights & Civil Liberties, and many more)
- **Good For:** Age 55+, Families, International Volunteers, Private Corporate Groups, Public Groups, Teens
- **Skills:** 40+ options (Accounting to Youth Services)
- **Date range:** specific date picker
- **Listing Language:** English, Español, Português
- **Recency:** Any time, Past 24 hours, Past week, Past month
- **Done in a Day:** checkbox filter

**This is the most comprehensive filter set of any platform in this audit.** The skills filter is particularly notable — it lets a volunteer self-identify as a nurse, accountant, or carpenter and find opportunities where those skills are needed.

#### Dated Events vs. Ongoing Roles

Idealist handles this through UI convention, not a hard filter: dated events show specific times (e.g., "3/28/2026 9:45 AM - 12:15 PM EDT"), while ongoing roles omit dates entirely. The "Done in a Day" filter captures the dated/event side. But there is no equivalent filter for "show me only ongoing weekly commitments." The platform defaults to a mix — no mode filtering by intent.

**The content density problem:** 2,396 Atlanta results includes a meaningful percentage of noise: paid jobs mislabeled as volunteer, remote roles that are functionally recruiting for national organizations, and opportunities with poor descriptions ("Grant Writer (Virtual) (Volunteer) — A&N Career Services Project"). The signal-to-noise ratio for a first-time visitor is poor without knowing how to use the filters.

#### UX Strengths

- Most comprehensive filter set in the space
- "Done in a Day" filter is the right UX for commitment-level filtering
- Skills matching is genuinely useful for people with specific expertise
- Clear visual differentiation between paid jobs and volunteer opportunities
- 2,396 Atlanta listings represents real breadth
- Badges ("Training Provided," "Family Friendly") surface key attributes at card level
- Organization images make the list feel more alive

#### UX Weaknesses

- No editorial composition — it's a database, not a feed. There is no "here's what's happening this week in Atlanta" moment.
- Ongoing vs. one-time is handled inconsistently — no dedicated filter, just a workaround checkbox
- Content density is overwhelming. 2,396 results before any filtering is not a feature — it's paralysis.
- Platform serves national audience, not Atlanta-specific. "Atlanta" results include opportunities based anywhere near Atlanta or posting remotely.
- No civic/government meeting content whatsoever
- No advocacy/organizing content — purely service-oriented
- Voice is antiseptic. The platform is a transactional search tool, not a civic community.
- Post-merger integration has rough edges: some listings feel like VolunteerMatch imports with different card formatting

#### Voice & Tone

Idealist's voice is professional-editorial on the marketing side and nearly voiceless on the listing side (because listings are written by organizations, not Idealist).

Platform-generated copy:
- "Kindness builds bridges and breaks down barriers." — tagline. Warm but generic.
- "Idealist has your back" — informal, reassuring
- Opportunity descriptions are org-written and vary wildly in quality

**Real listing examples collected:**

| Listing | Problems |
|---|---|
| "Volunteers needed for concerts and sporting events at State Farm Arena 2026" — Society for Charity. "This is a great you can give back to the community and have some fun." | Grammatically broken. Tagged as Housing & Homelessness cause despite being a stadium concession job. Cause tags clearly wrong. |
| "Looking for help at 2026 Bruno Mars World Tour in Atlanta" — Alenza Wellness Community Outreach | Description framing is commercial event staffing, not civic service |
| "Judges needed for High School DECA conference in Atlanta!" | The exclamation point in the title suggests desperation. Legitimate need, but the framing is more like a LinkedIn post than a volunteer listing. |

**Pattern diagnosis:** Idealist's voice problem is that there IS no platform voice at the point of discovery. The platform is transparent to the organization's voice — which means the quality of what you see depends entirely on whether the posting org is a sophisticated content writer. The result is highly uneven. "Kindness builds bridges" is the only Idealist voice the user hears.

---

### 3. Mobilize.us

**What it is:** A progressive organizing and volunteer recruitment platform primarily used by political campaigns, advocacy organizations, and nonprofit coalitions. It powers event pages for organizations like Indivisible, Common Cause, and hundreds of local advocacy groups. Mobilize is the dominant infrastructure for progressive grassroots organizing events in the US.

#### Content Organization Model

Mobilize is org-first. The primary consumer discovery path is finding your organization (Common Cause, local Indivisible chapter, etc.) and then seeing their events. The cross-org browseable feed (`mobilize.us/events/`) exists but is not the primary UX.

The cross-org event feed supports:
- Geo filtering by zipcode + radius
- Free-text search (event title and description)
- Language filter (English / Spanish)
- Event type (from the full taxonomy, available as consumer filter)

No cause/issue filters on the consumer browse experience — cause is implied by which organizations you follow, not exposed as a browse dimension. This is a significant gap for HelpATL's use case.

#### Event Type Taxonomy (from API documentation)

The complete Mobilize event_type enum (as of 2025):

```
CANVASS, PHONE_BANK, TEXT_BANK, MEETING, COMMUNITY, FUNDRAISER, MEET_GREET,
HOUSE_PARTY, VOTER_REG, TRAINING, FRIEND_TO_FRIEND_OUTREACH, DEBATE_WATCH_PARTY,
ADVOCACY_CALL, RALLY, TOWN_HALL, OFFICE_OPENING, BARNSTORM, SOLIDARITY_EVENT,
COMMUNITY_CANVASS, SIGNATURE_GATHERING, CARPOOL, WORKSHOP, PETITION,
AUTOMATED_PHONE_BANK, LETTER_WRITING, LITERATURE_DROP_OFF, VISIBILITY_EVENT, OTHER
```

This taxonomy is detailed and HelpATL-relevant. The following map cleanly to our engagement tags:
- `CANVASS`, `COMMUNITY_CANVASS` → `canvass`
- `RALLY` → `rally`
- `MEETING`, `TOWN_HALL`, `BARNSTORM` → `organize`
- `PHONE_BANK`, `TEXT_BANK`, `ADVOCACY_CALL` → remote action (new tag needed)
- `TRAINING`, `WORKSHOP` → depends on content

**Key finding for HelpATL:** Mobilize does NOT expose a "cause" field in its public API. Events can have tags (assigned by the posting organization), but there is no standardized cause taxonomy. Cause inference for HelpATL will require NLP on title + description, not field mapping.

#### Dated Events vs. Ongoing Roles

Mobilize is exclusively event-based. Every listing has a specific date, time, and timeslot. No ongoing role model exists on Mobilize. This is fully aligned with HelpATL v1's event-only model.

#### UX Strengths

- Event type taxonomy is granular and useful for HelpATL tagging
- Map view + list view with persistent filters
- Geo filtering is native and functional
- Spanish-language filter
- Timeslot model (one event can have multiple available slots) is sophisticated
- org-level pages give context and mission before the event list

#### UX Weaknesses

- Consumer discovery is weak without an org to follow — the cross-org browse is sparse
- No cause/issue filtering on consumer browse (org-first model means discovery is siloed)
- Not designed for a city-level portal — it's a widget that embeds in org pages
- No civic/government meeting content (strictly advocacy/organizing)
- No volunteer service content (no food bank sorts, park cleanups, etc.)
- Voice is invisible — events are written by organizers, quality varies wildly

#### Voice & Tone

Mobilize has no consumer-facing editorial voice because the platform is infrastructure, not a brand. Event descriptions are written by the hosting organizations and vary from polished coalition communications to basic logistics ("We'll be canvassing from 10am–1pm. Meet at X corner.").

**Representative org-voice patterns on Mobilize events:**

- Coalition/issue advocacy: "Join us as we fight for [cause]. Your presence matters." — moral urgency, collective framing
- Canvass events: "Knock on doors in [neighborhood]. Training provided." — logistics-first, specific
- Town halls: "Community members and elected officials will discuss [topic]." — civic but passive

**Pattern diagnosis:** Mobilize has no brand voice problem because it has no brand voice at all. Organizations write their own events. The platform's voice is the aggregate of its organizers, which skews toward activist urgency. This is appropriate for organizing contexts but would be inappropriate as the default tone for HelpATL's mixed-mode content.

---

### 4. Idealist / Civic Comparator: City of Atlanta (atlantaga.gov + citycouncil.atlantaga.gov)

**What it is:** The official City of Atlanta civic participation infrastructure. Covers boards, commissions, NPU meetings, public hearings, and council sessions. Multiple separate sites and departments manage different parts of this landscape.

#### Content Organization Model

Atlanta's civic participation information is fractured across multiple surfaces:

| Surface | What it covers | Usability |
|---|---|---|
| `atlantaga.gov/residents/public-participation` | Boards and commissions overview | 403 — inaccessible as of research date |
| `atlantaga.gov/government/departments/city-planning/public-meetings-boards-commissions` | Planning-specific public meetings | Structured but text-heavy |
| `atlantaga.gov/government/departments/city-planning/neighborhood-planning-units` | NPU system overview | Informational, low action-orientation |
| `citycouncil.atlantaga.gov/other/events/public-meetings` | Council public meetings | 403 — inaccessible as of research date |
| `citycouncil.atlantaga.gov/other/neighborhood-planning-unit/npu-schedule` | NPU schedule | Schedule table format |
| `atlcitydesign.com/upcoming-events` | DCP events calendar (interactive) | Separate domain, inconsistent branding |

**The fragmentation problem:** A citizen trying to find their NPU meeting, understand what public comment opportunities exist this week, and attend a zoning hearing must navigate three different domains with inconsistent branding, no shared search, and no unified calendar. This is a fundamental structural failure — and HelpATL's most obvious opportunity.

#### Finding Your NPU: The Actual Process

1. Go to `atlantaga.gov/government/departments/city-planning/neighborhood-planning-units`
2. Navigate to the NPU Directory
3. Find your neighborhood in an accordion list (or use the GIS property map at `gis.atlantaga.gov/propinfo`)
4. Map your neighborhood to one of the 25 NPUs
5. Navigate to that NPU's individual meeting page
6. Find the meeting date (typically third Wednesday of each month at 7pm)
7. Navigate to `atlcitydesign.com/upcoming-events` for the interactive calendar (separate site)

This is 5-7 clicks and two domain changes to find out if there's a meeting near you this week. For most citizens, this is fatal friction.

#### What Public Meeting Information Looks Like

From the Atlanta City Council public meetings page (via third-party reporting):
- Atlanta City Council meets first and third Mondays at City Hall, 1pm
- Citizens can address the commission directly or submit a speaker request to the City Clerk before the meeting
- Recordings available via the city's public meeting portal and Channel 26 LIVE

The format is informational: date, time, location, participation mechanism. There are no cause tags, no urgency indicators, no "public comment open" flags, no agenda summaries. It is a schedule, not a participation interface.

#### NPU Meeting Calendar Reality

25 NPUs × 1 meeting per month = 25 meetings per month minimum. Many have subcommittee meetings, land use reviews, and special sessions. This is real, ongoing civic activity — and virtually none of it is discoverable by an ordinary Atlanta resident who doesn't already know the system.

#### UX Strengths

- The information eventually exists if you're determined
- NPU system description is thorough and historically grounded
- City Council meeting format (address in person or submit speaker request) is clearly explained
- Virtual attendance options are available

#### UX Weaknesses

- Multi-domain fragmentation: `atlantaga.gov`, `citycouncil.atlantaga.gov`, `atlcitydesign.com` — three domains for city meetings
- No unified search across meeting types
- No filtering by cause or topic — you must browse by body (planning, council, NPU)
- No public-comment signal — no way to know in advance which meetings have open comment without reading each agenda
- No urgency indicators — deadlines buried in agenda PDFs, not surfaced in the calendar
- Agenda PDFs available but often posted late (days before meetings)
- NPU membership requires annual registration renewal — barrier to participation
- The GIS address-to-NPU lookup is functional but requires a separate tool
- Voice is bureaucratic: "Membership is open to anyone 18 years or older whose primary residence is within the NPU, as well as to any corporation, organization, institution, or agency which owns property or has a place of business within the NPU" — technically accurate, practically alienating

#### Voice & Tone

The City's civic participation content uses a register that could be called administrative-neutral: accurate, complete, legally precise, and essentially inhospitable to a first-time participant.

**Representative government copy:**

- "The City of Atlanta is divided into twenty-five Neighborhood Planning Units or NPUs, which are citizen advisory councils that make recommendations to the Mayor and City Council on zoning, land use, and other planning issues." — bureaucratic definition, not an invitation
- "Membership is open to anyone 18 years or older whose primary residence is within the NPU..." — legal eligibility language, not welcoming
- "To view an interactive calendar including each NPU's meeting details, virtual meeting links, and all other events from the Department of City Planning, visit atlcitydesign.com/upcoming-events." — navigation instruction, not engagement

The city's communications treat participation as a right to be claimed by people who already understand the system, not an activity to be facilitated for people who don't.

**Center for Civic Innovation** (civicatlanta.org), which is a nonprofit, not a government entity, has markedly better voice:
- "Learn about Atlanta so you can change it" — empowering framing
- Frames civic knowledge as prerequisite for influence, not just compliance
- But CCI is a bridge organization, not a discovery platform — they explain government, they don't surface individual meetings

---

## Competitive Feature Matrix

| Dimension | HOA | Idealist (+ VolunteerMatch) | Mobilize | ATL Gov | HelpATL (proposed) |
|---|---|---|---|---|---|
| **Content types** | Volunteer events only | Volunteer roles + jobs | Advocacy events only | Government meetings only | Volunteer + civic + advocacy |
| **Dated events** | Yes | Yes (primary) | Yes (only) | Yes (primary) | Yes |
| **Ongoing roles** | Rarely, programs only | Yes (core) | No | No | v2 only |
| **Cause/issue filters** | 3 categories | 50+ | None | None | 9 channels (v1) |
| **Commitment filter** | No | "Done in a Day" | N/A (all dated) | N/A | v1: implied by event type |
| **Skills filter** | No | 40+ options | No | No | No (v1) |
| **Geographic filter** | Yes | Yes | Yes (zipcode + radius) | None | Yes (city + neighborhood) |
| **Atlanta-specific** | Yes (mission) | No (national platform) | No (national) | Yes (government) | Yes (mission) |
| **Cross-mode content** | No | No | No | No | Yes — unique differentiator |
| **Public comment signal** | No | No | No | Buried in PDFs | v1: action_type field |
| **Deadline surfacing** | No | No | No | No | v1: Deadlines Module |
| **Interest channels** | No | Some (cause filters) | None | None | Yes — core feature |
| **Mobile experience** | Adequate | Good | Good | Poor | TBD |
| **Atlanta data breadth** | 75,000+ volunteers served | 2,396 listings | Varies by org | 25 NPUs + council | Target: all modes |
| **Editorial voice** | Corporate-warm | Absent | Absent | Bureaucratic | Civic-local |
| **Non-partisan** | Yes | Yes | No — skews left | Yes | Yes — required |

---

## Voice Samples Table

### Collection & Ratings

Content rated 1–5 on four dimensions: **Clarity** (is it immediately understood?), **Warmth** (does it invite participation without pressure?), **Specificity** (does it tell you exactly what you'd do?), **Actionability** (does it make taking action easy?).

#### HOA Samples

| Sample | Context | Clarity | Warmth | Specificity | Actionability | Notes |
|---|---|---|---|---|---|---|
| "Do Something Good" | Tagline | 4 | 4 | 1 | 1 | Universally applicable, which makes it say nothing |
| "Now is the time to serve! Help us tackle Atlanta's most pressing needs by signing up to volunteer with a trusted partner and a meaningful project." | Hero body copy | 3 | 3 | 1 | 3 | Urgency without cause. "Pressing needs" is unspecified. |
| "Rally your team" | Team CTA | 4 | 4 | 2 | 3 | Action-oriented but scope unclear |
| "Luckily, we've got your back!" | Support section | 5 | 4 | 1 | 2 | Warm but oddly informal for an organization this large |
| "STORIES OF SERVICE — THE CITIZEN BLOG" | Blog title | 5 | 4 | 3 | 2 | "Citizen" framing is good — places the volunteer in a civic context |
| "MADE BY VOLUNTEER + SERVICE ROCKSTARS IN ATLANTA, GA" | Footer | 2 | 4 | 2 | 1 | "Rockstars" is dated. Trying too hard. |

**HOA voice summary:** Energetic but vague. The urgency is aspirational rather than specific. "Atlanta's most pressing needs" could mean anything. At their best (the Citizen Blog title), HOA frames volunteers as civic actors. At their worst ("service rockstars"), they're using corporate-inspiration language that doesn't age well.

#### Idealist / VolunteerMatch Samples

| Sample | Context | Clarity | Warmth | Specificity | Actionability | Notes |
|---|---|---|---|---|---|---|
| "Kindness builds bridges and breaks down barriers." | Platform tagline | 3 | 4 | 1 | 1 | Metaphorically nice, practically empty |
| "Volunteers needed for concerts and sporting events at State Farm Arena 2026" | Listing title | 5 | 2 | 4 | 4 | Clear and specific, but the org framing ("Society for Charity") is misleading |
| "This is a great you can give back to the community and have some fun." | Listing description (broken grammar) | 1 | 3 | 2 | 2 | Grammatical error, vague, "give back" is a red flag phrase |
| "Judges needed for High School DECA conference in Atlanta!" | Listing title | 5 | 3 | 4 | 4 | Clear and specific. Exclamation suggests urgency-inflation. |
| "Friends of Zonolite Park Spring Clean Up Day" | Listing title | 5 | 3 | 5 | 4 | Best example in the dataset — specific, evokes place, implies action |
| "Done in a Day" | Filter label | 5 | 4 | 4 | 5 | Best UX copy in any platform reviewed. Exactly right. |
| "Bilingual Spanish/English Wish Granting Volunteers Needed!" | Listing title | 4 | 3 | 4 | 3 | The exclamation point is jarring, but the bilingual specification adds genuine value |

**Idealist voice summary:** The platform has no consistent voice — listings are org-written and wildly inconsistent in quality. The best listings ("Friends of Zonolite Park Spring Clean Up Day") are specific and place-named. The worst ("give back to the community") use exhausted nonprofit tropes. "Done in a Day" is the standout platform-generated copy: four words that do exactly the job they need to do.

#### Mobilize Samples (org-generated, representative of platform content)

| Sample | Context | Clarity | Warmth | Specificity | Actionability | Notes |
|---|---|---|---|---|---|---|
| "Join us as we fight for [cause]. Your presence matters." | Typical coalition event description | 3 | 3 | 1 | 3 | "Fight" is polarizing. "Your presence matters" is mild guilt. |
| "Knock on doors in [neighborhood]. Training provided. Meet at X corner." | Canvass event | 5 | 2 | 5 | 5 | Logistics-first. Cold but functional. |
| "Community members and elected officials will discuss [topic]." | Town hall description | 4 | 2 | 3 | 2 | Passive framing — does not invite participation, just announces it |
| "RSVP to show your support and help us build power." | Generic advocacy CTA | 3 | 2 | 1 | 4 | "Build power" is insider language. RSVP-ing is framed as political statement. |
| "Phone bank for [candidate/cause]. No experience necessary." | Phone bank event | 5 | 3 | 4 | 4 | "No experience necessary" is a good inclusion signal |

**Mobilize voice summary:** Activist-urgency is the dominant register. "Fight," "build power," and "your presence matters" are organizing-community conventions that will alienate the broad civic middle. For HelpATL's non-partisan civic audience, this voice register is too hot. The exception is the logistics-first canvass description, which is appropriately functional. We can learn from the specificity ("Knock on doors in [neighborhood]") without adopting the urgency framing.

#### City of Atlanta Samples

| Sample | Context | Clarity | Warmth | Specificity | Actionability | Notes |
|---|---|---|---|---|---|---|
| "The City of Atlanta is divided into twenty-five Neighborhood Planning Units or NPUs, which are citizen advisory councils that make recommendations to the Mayor and City Council on zoning, land use, and other planning issues." | NPU intro | 5 | 1 | 5 | 1 | Technically precise, participatory warmth absent |
| "Membership is open to anyone 18 years or older whose primary residence is within the NPU..." | Eligibility | 5 | 1 | 5 | 1 | Legal language. Makes participation feel like a legal process. |
| "To view an interactive calendar including each NPU's meeting details, virtual meeting links, and all other events from the Department of City Planning, visit atlcitydesign.com/upcoming-events." | Finding meetings | 4 | 1 | 3 | 2 | Sends you to a different domain. Navigation instruction, not invitation. |
| "Stay informed and engaged with your local government" | Meeting calendar CTA | 4 | 3 | 1 | 2 | Generic civic boilerplate |
| "Citizens can add their names to the e-mail list to begin receiving monthly NPU notices." | Participation path | 4 | 2 | 3 | 3 | Passive participation option. Low urgency. |
| "Address the commission directly at the meeting" | Public comment instruction | 5 | 2 | 4 | 4 | Functional. The most actionable copy in the City's civic participation content. |

**City voice summary:** Government-speak is not a stylistic preference — it's what happens when organizations optimize for legal precision over human comprehension. The City's civic content is technically accurate and participatively alienating. A first-time resident reading "Membership is open to anyone 18 years or older whose primary residence is within the NPU" will not feel invited to their NPU meeting. They will feel like they stumbled into a legal document. HelpATL's opportunity is simply to say what the city says, but in a voice that treats the reader as a neighbor, not a legal entity.

#### Center for Civic Innovation (comparative, non-platform)

| Sample | Context | Clarity | Warmth | Specificity | Actionability | Notes |
|---|---|---|---|---|---|---|
| "Learn about Atlanta so you can change it" | Tagline | 5 | 4 | 3 | 3 | Best civic tagline in Atlanta's landscape — empowering, not intimidating |
| "Atlanta's historic...system...created in 1974" | NPU description | 4 | 3 | 4 | 2 | Historical framing gives weight without jargon |
| "The City's formal avenue for community engagement" | NPU description | 4 | 3 | 3 | 2 | "Formal avenue" feels bureaucratic — nearly as stiff as the City itself |

**CCI voice summary:** CCI's best copy ("Learn about Atlanta so you can change it") is the closest existing benchmark to HelpATL's target voice. But CCI is an educational organization, not a discovery platform — they explain structures, not events. We should borrow their empowering framing without their explanatory mode.

---

## Voice Anti-Patterns to Avoid

Patterns found across all five competitors that HelpATL must not replicate:

### 1. Abstract mission language as a substitute for specificity

**Examples:**
- "Help us tackle Atlanta's most pressing needs" (HOA)
- "Kindness builds bridges and breaks down barriers" (Idealist)
- "Do Something Good" (HOA)
- "Make a difference in your community" (ubiquitous)

**Why it fails:** When everything is framed as "making a difference," nothing feels concrete. The user cannot evaluate whether they are the right person for this opportunity from this framing alone. It signals that the platform or org hasn't thought hard enough about what the work actually is.

**HelpATL alternative:** "Sort food at the Atlanta Community Food Bank, Saturday 9–11am. No experience required."

### 2. Guilt as an engagement strategy

**Examples:**
- "Your community needs you!" (implied across HOA, common volunteer email)
- "Your presence matters" (Mobilize events)
- "Give back to the community" (Idealist listings, HOA)

**Why it fails:** "Give back" implies the user is in debt to their community. "Your presence matters" is a mild guilt trip. Guilt may generate one-time participation, but it creates resentment and does not build habits or repeat behavior. HelpATL is trying to build civic regulars, not one-time guilt purchasers.

**HelpATL alternative:** "Fulton County Commission meets Thursday. Public comment is open." (Informational. No pressure. The decision is the user's.)

### 3. Activist urgency in non-partisan contexts

**Examples:**
- "Join us as we fight for [cause]" (Mobilize events)
- "Help us build power" (Mobilize)
- "RSVP to show your support" (implicit political framing)

**Why it fails:** HelpATL must be non-partisan by design. Activist-urgency language ("fight," "build power," "show your support") signals a political stance and will alienate the broad civic middle — exactly the people who should attend a school board meeting but don't see themselves as activists.

**HelpATL alternative:** "Atlanta Housing Authority is seeking public input on the Westside redevelopment plan. Public comment period open through Friday." (Neutral, informative, specific.)

### 4. Exclamation inflation

**Examples:**
- "Judges needed for High School DECA conference in Atlanta!" (Idealist)
- "Now is the time to serve!" (HOA)
- "Volunteers needed for concerts and sporting events at State Farm Arena 2026" (does not have exclamation — correctly formatted)

**Why it fails:** Exclamation points in opportunity titles signal desperation, not excitement. They train users to discount emphasis. "Judges needed!" sounds like a flyer posted at 11pm. "Judges needed for the DECA High School Competition, March 22" is more authoritative and equally compelling.

**HelpATL alternative:** Never use exclamation points in event titles or section headers. Use them sparingly (once per screen maximum) in specific, earned moments only.

### 5. Platform voice disappearing behind org voice

**Examples:**
- Idealist's 2,396 listings have 2,396 different voices
- Mobilize events read like their hosting orgs (which vary from polished coalitions to informal neighborhood groups)
- Both platforms are invisible at the moment of discovery

**Why it fails:** When the platform has no voice of its own, the user experience is determined by whoever posted last. Quality floors hit zero. A listing with a grammatical error ("This is a great you can give back") damages trust in the platform, not just the org.

**HelpATL alternative:** HelpATL controls the interface copy — section headers, card metadata labels, CTAs, empty states, and the hero greeting. We cannot control org-written descriptions (nor should we rewrite them — see content strategy §4), but we can frame them with consistent platform voice so the degraded-description cases are isolated to the description field, not the entire discovery experience.

### 6. Location-agnostic framing for a local platform

**Examples:**
- Idealist: 2,396 "Atlanta" results include remote roles and national orgs with Atlanta presence
- VolunteerMatch (pre-merger): similar national leakage
- Mobilize: org-level pages feel Atlanta-specific but cross-org browse does not

**Why it fails:** "Atlanta" as a geographic tag means very different things to these platforms. For a national platform, Atlanta is a filter parameter. For HelpATL, Atlanta is the mission. Users notice when results don't feel local — when the "Atlanta" channel is full of remote grant-writing roles for organizations headquartered in San Francisco.

**HelpATL alternative:** Every event that appears on HelpATL has been verified to be geographically in the Atlanta metro. The platform's editorial positioning ("what's happening in your city") is backed by geographic integrity.

---

## HelpATL Differentiation Opportunities

### Opportunity 1: Cross-mode content — nobody does this

No competitor surfaces volunteer events, government meetings, and advocacy events in a single unified feed. HOA does volunteering only. Idealist/VolunteerMatch does volunteering only. Mobilize does advocacy only. The City of Atlanta does government meetings only — and badly.

The citizen who wants to be broadly civic — sorting food on Saturday, attending their school board meeting on Tuesday, and joining a transit advocacy rally on Thursday — has no single place to track all three modes. HelpATL is uniquely positioned to be that place.

**This is the platform's strongest differentiator. It should be the first thing mentioned in any positioning statement.**

### Opportunity 2: Public meeting discoverability

The City of Atlanta's civic participation UX is functionally broken for an ordinary resident. Getting from "I want to attend my NPU meeting" to having the date, time, and Zoom link on your calendar requires navigating three domains and understanding a 50-year-old neighborhood planning taxonomy.

HelpATL can surface that NPU meeting in the user's feed, tagged by neighborhood, with the date and location, on the same page where they see Saturday's food bank shift and Thursday's transit rally. This is categorically better than the city's own infrastructure.

**The competitive moat here is not just data — it's the interface layer on top of existing government data.**

### Opportunity 3: Drop-in / dated-event signal done right

The best filter innovation across all reviewed platforms is Idealist's "Done in a Day" checkbox. It's clever but a workaround for a structural problem — their database is full of ongoing roles that look like events.

HelpATL v1 sidesteps this problem by design: the feed is event-only (dated, time-bounded). Every item in the feed is inherently "done in a day." We don't need a filter because we don't have the content-type confusion that requires the filter.

**This simplicity is a feature. Don't add commitment-level filters until there is commitment-role content to filter.**

### Opportunity 4: Non-partisan civic voice in a market dominated by activist framing

Mobilize.us is the primary platform for progressive organizing. Idealist skews toward liberal-leaning nonprofit work. The City's communications are legally precise but civic-engagement-hostile. There is no neutral, inviting, locally-grounded civic voice in Atlanta's information landscape.

HelpATL's proposed voice — direct, warm, civic-minded, non-partisan — is not just a stylistic choice. It is a market position. A resident who would attend a school board meeting but does not see themselves as an activist has nowhere to go. HelpATL can serve this person. Mobilize cannot.

**The non-partisan framing is a feature for the civic middle, not a compromise. Own it explicitly.**

### Opportunity 5: Quality floor through platform curation

The content quality problem on Idealist (where a listing can say "This is a great you can give back") or Mobilize (where description quality depends entirely on the posting org) is a platform design choice. These platforms decided that scale was more important than quality floors.

HelpATL can enforce a quality floor at the crawler/source level: every source we crawl has been evaluated, and we reject bad data at ingestion. The user never sees a listing with a grammatical error in the description if we're generating descriptions from structured data. And for HOA/Mobilize events where we're passing through org descriptions, we can clearly attribute ("via Hands On Atlanta") so the user understands the source.

**Quality floors are a trust signal. They matter especially in civic contexts where trust is the product.**

### Opportunity 6: Interest channels as a product feature (no competitor has this)

None of the reviewed platforms have anything equivalent to HelpATL's interest channels — a subscription-based topic layer that cross-cuts content types and surfaces matched events in a personalized feed.

Idealist has cause filters. That's a search dimension, not a subscription. The difference: a filter helps you find things you're actively looking for. A channel surfaces things you care about even when you're not actively looking. The channel model is closer to a newsletter subscription than a search filter.

This is a genuine product innovation in the civic engagement space. It should be built with that in mind.

---

## Refined Voice Recommendations

Based on the competitive landscape, the HelpATL voice principles from `helpatl-content-strategy.md` §6 are validated and refined:

### Validated Principles (keep as written)

1. **Agency, not guilt** — Competitor evidence confirms that guilt ("give back," "your presence matters") is the dominant industry pattern. HelpATL should explicitly avoid it.

2. **Specific, not abstract** — The best listings across all platforms share one quality: specificity. "Food sort at East Point warehouse. 3 shifts available." beats "Help your community" in every UX metric.

3. **Inclusive, not performative** — "No experience necessary" performs better than "Everyone can be a hero!" The former is useful information; the latter is marketing fluff.

4. **Informative, not prescriptive** — Government copy is too passive-neutral ("membership is open to..."). Activist copy is too directive ("join us as we fight"). HelpATL's middle path is correct.

### Refinements Based on Research

**5. Add: Local, not generic**

Every competitor researched has a localization failure: either they serve a national audience with Atlanta as a filter (Idealist, VolunteerMatch, Mobilize) or they're so inside Atlanta's government vocabulary that they're inaccessible (City of Atlanta). HelpATL should explicitly localize: neighborhood names, institution names, local organizations. "Food sort at the Atlanta Community Food Bank on Marietta St." not "Food sort at a local food bank."

**6. Add: Readable, not bureaucratic**

The City of Atlanta's participation language actively discourages participation by using legal/administrative register. Any time HelpATL copy sounds like it could appear on a city website, rewrite it. The test: would a 25-year-old who just moved to Atlanta understand this without prior civic knowledge? If not, rewrite.

**7. Add: Earned urgency, not inflation**

Exclamation points and "urgent" language are devalued by overuse on every platform reviewed. HelpATL should use urgency language only when it is earned: a public comment deadline closing in 48 hours, a meeting where a decision will be made that directly affects a neighborhood, a volunteer opportunity that genuinely has limited capacity. The Deadlines Module is where urgency language belongs. The main feed should be matter-of-fact.

### Priority Anti-Pattern Watch List

| Pattern | Example to reject | Replacement |
|---|---|---|
| "Give back" | "Give back to your community" | "Sort food at the Atlanta Community Food Bank" |
| "Make a difference" | "Make a difference in Atlanta" | "Park Pride needs volunteers for the Piedmont Park cleanup, April 5" |
| "Join the fight" | "Join us as we fight for housing" | "Atlanta Housing Authority public hearing, Thursday 6pm" |
| "Your presence matters" | "Your presence matters to us!" | "30 volunteers needed. 12 spots left." |
| "Most pressing needs" | "Atlanta's most pressing needs" | "The Community Assistance Center sorts 40,000 pounds of food per week. They need help Saturday." |
| Bureaucratic eligibility | "Membership open to anyone 18+" | "All Atlanta residents are welcome." |
| Exclamation inflation | "Volunteers needed!" | "Volunteers needed — 8 spots available" |

---

## Summary Findings for Strategy Update

The following findings should be used to update `helpatl-content-strategy.md`:

**§1 Executive Summary:** Add that cross-mode content (volunteer + civic + advocacy in a single feed) is HelpATL's primary differentiator — no competitor does this.

**§6 Voice & Tone:** Add "Local, not generic" and "Readable, not bureaucratic" and "Earned urgency, not inflation" as explicit principles. Add the anti-pattern watch list as a reference table in the content operations section.

**§9 What HelpATL Is NOT:** Add "VolunteerMatch-style database search" as an explicit anti-pattern. HelpATL is a feed with editorial composition, not a filter interface over a large database. The distinction matters for product direction.

**Source-specific:** Mobilize event_type taxonomy documents that CANVASS, RALLY, MEETING, TOWN_HALL, PHONE_BANK, TEXT_BANK, SOLIDARITY_EVENT, VISIBILITY_EVENT, WORKSHOP, BARNSTORM, SIGNATURE_GATHERING are all available as structured fields — this validates that engagement tag inference from Mobilize data is structural (field mapping), not NLP-dependent. HelpATL's engagement tags map directly to Mobilize's event_type enum. Cause tags do NOT map to a Mobilize field — cause inference for Mobilize events will require title/description text analysis.

---

*Sources:*

- [Hands On Atlanta](https://www.handsonatlanta.org/)
- [Hands On Atlanta — Golden Volunteer case study](https://goldenvolunteer.com/success-stories/hands-on-atlanta/)
- [Idealist.org Atlanta volunteer opportunities](https://www.idealist.org/en/volunteer-in-atlanta-ga)
- [VolunteerMatch and Idealist merger — now one platform](https://www.idealist.org/en/about/volunteermatch-and-idealist-are-now-one-platform)
- [Mobilize.us API documentation — GitHub](https://github.com/mobilizeamerica/api)
- [Mobilize — events and actions overview](https://help.mobilize.us/en/articles/4195485-overview-of-mobilize-events-and-actions)
- [City of Atlanta — Neighborhood Planning Units](https://www.atlantaga.gov/government/departments/city-planning/neighborhood-planning-units)
- [City of Atlanta — NPU Directory and contacts](https://www.atlantaga.gov/government/departments/city-planning/neighborhood-planning-units/neighborhood-and-npu-contacts)
- [Atlanta City Council — NPU Schedule](https://citycouncil.atlantaga.gov/other/neighborhood-planning-unit/npu-schedule)
- [Center for Civic Innovation — How Atlanta Works](https://civicatlanta.org/atlanta-101)
- [Rough Draft Atlanta — City Council and Public Meetings Schedule](https://roughdraftatlanta.com/atlanta-city-council-and-public-meetings-schedule/)
- [Idealist — State Farm Arena volunteer listing](https://www.idealist.org/en/volunteer-opportunity/7e0ce8c34d3647668bd3744ebd682b81-volunteers-needed-for-concerts-and-sporting-events-at-state-farm-arena-2026-society-for-charity-atlanta)
