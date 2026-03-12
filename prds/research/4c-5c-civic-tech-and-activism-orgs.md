# Research: Civic Tech Landscape + Atlanta Activism Organization Map

**Tasks:** 4C (Civic Tech Landscape) + 5C (Atlanta Activism Org Mapping)
**Date:** 2026-03-08
**Purpose:** Inform HelpATL source selection, positioning, political balance, and data infrastructure decisions.

---

## Strategic Warning Up Front

Before reading this as validation, read it as a caution: the civic tech landscape is littered with well-intentioned, well-funded products that found no sustainable business model and shut down. The pattern is remarkably consistent — strong early growth, grant dependency, no B2B revenue path, eventual discontinuation.

HelpATL must not replicate that model. Its survival depends on the LostCity B2B platform, not on civic engagement metrics. Every feature in this space should be evaluated against that constraint.

---

## Part 1: Civic Tech Landscape

### 1.1 Active Platforms (National)

#### Mobilize.us
- **Status:** Active. Acquired by EveryAction (2020), now part of Bonterra.
- **What it is:** Volunteer management and event hosting for campaigns and progressive orgs.
- **Coverage:** Explicit Democratic/progressive alignment. Designed for the 2018 Democratic midterm wave and Biden 2020. No equivalent Republican-side infrastructure.
- **For HelpATL:** The primary source for volunteer-driven civic events in Atlanta. Covers Democratic Party of Georgia, Indivisible Georgia Coalition, HRC Georgia, Working Families Party, DSA Atlanta, Third Act, and dozens of smaller orgs. Crawlable. But see Section 3 on political balance risks.

#### Action Network
- **Status:** Active. Nonprofit-operated, explicitly progressive.
- **What it is:** Email, advocacy, and event tools for progressive organizations. Strong among grassroots orgs that aren't affiliated with the Democratic Party.
- **Coverage:** Used by Atlanta DSA, housing justice orgs, and labor groups.
- **For HelpATL:** Secondary source to Mobilize. Harder to crawl systematically; orgs publish individual event pages without a central directory.

#### Resistbot
- **Status:** Active. 10M+ users, 50M+ letters sent since 2017.
- **What it is:** Text-to-contact-official tool. Not an event platform.
- **Relevance for HelpATL:** None for event discovery. Could be referenced as an "action tool" in event detail action context, but it doesn't produce crawlable event data.

#### 5Calls
- **Status:** Active.
- **What it is:** Phone call guidance for contacting legislators on specific issues. Script-driven, issue-based.
- **Relevance for HelpATL:** Same as Resistbot — an action tool, not an event source. Useful as a link from civic issue channels (housing, transit) to direct action.

#### Countable / Democracy.io
- **Status:** Both largely inactive or pivoted. Countable rebranded and shifted focus. Democracy.io had limited traction.
- **Lesson:** Consumer civic engagement apps have extremely low retention. Participating once in a legislative process does not create habit. These products couldn't solve the engagement loop.

#### EveryAction / Bonterra
- **Status:** Active. SaaS CRM for nonprofits and campaigns.
- **What it is:** Constituent relationship management, donor management, email, and event tools bundled together. Serves 20,000+ social-good organizations.
- **Relevance for HelpATL:** This is what well-funded nonprofits use internally. Not a public event directory. Not crawlable in any useful way.

#### Idealist + VolunteerMatch (merged 2025)
- **Status:** Active. Merged into single platform in early 2025.
- **What it is:** The largest volunteer opportunity directory in the US. Organizations post structured volunteer listings with roles, requirements, and schedules.
- **For HelpATL:** High-value source. Hands On Atlanta, Atlanta Habitat for Humanity, Atlanta Community Food Bank, and dozens of Atlanta nonprofits maintain active Idealist/VolunteerMatch profiles. Structured data makes crawling more reliable than social media. Should be in the source pipeline.

---

### 1.2 What Has Died or Failed

#### Code for America Brigade Program
- **Status:** Sunset June 2023. CfA ended fiscal sponsorship of all ~60 local brigades.
- **What happened:** CfA decided to focus its resources on direct government programs (safety net, criminal justice) and cut the volunteer network model. Not a product failure — a strategic pivot.
- **Code for Atlanta (Civic Tech Atlanta):** Still active. Rebranded, now affiliated with Alliance of Civic Technologists (ACT). Holds hack nights twice monthly at Tech Square ATL. Active on GitHub and Mastodon. Small but technically serious community.
- **Lesson:** The volunteer civic tech model is fragile when institutional support withdraws. CivicTechAtlanta survived by restructuring, but many brigades dissolved entirely.

#### Neighborland
- **Status:** Acquired by Nextdoor in 2020, operated until ~2023, then shut down.
- **What it was:** Community engagement platform for city planning and neighborhood input. Served 200+ city agencies; 3M+ residents participated.
- **What happened:** Acquired as a civic features play for Nextdoor. Nextdoor's core use cases (recommendations, crime reports, local ads) did not integrate well with structured civic engagement. The feature set was deprioritized and eventually shuttered.
- **Lesson:** Nextdoor tried civic features and couldn't make them stick. The platform's social dynamics (hyperlocal, complaint-oriented, demographic skew toward white homeowners) actively work against structured civic participation.

#### Nextdoor Civic Features
- **Status:** Still alive but marginal. Polling features exist; government agency profiles exist. Usage is low compared to core social features.
- **What doesn't work:** Nextdoor neighborhoods skew white, wealthy, homeowner — excluding the residents most affected by civic decisions. The platform's culture is complaint-driven, not action-oriented. Government agency posts compete with lost pet notices.
- **Lesson:** Civic engagement doesn't survive being bundled with social noise. Dedicated surfaces win over embedded features on general social platforms.

#### Citizinvestor
- **Status:** Shut down. Co-founders departed; CEO couldn't sustain it.
- **What it was:** Crowdfunding for local government projects. Civic participation through small donations to city initiatives.
- **Lesson:** Crowdfunding civic infrastructure requires sustained government partnership. When the champion inside a city government leaves, the project dies.

#### Pattern Across Failures: The Sustainability Problem
The Knight Foundation / Rita Allen Foundation's research on civic tech is unambiguous: "Few civic tech organizations have identified repeatable and reliable revenue sources that fully cover their costs." The common failure modes:

1. **Grant dependency** — no path to earned revenue.
2. **Government as customer** — procurement cycles destroy momentum.
3. **Engagement without habit** — a civic action is a one-time event, not a daily behavior.
4. **No network effect** — civic tools get more useful as government capacity grows, not as user count grows. The loop doesn't compound the way social products do.

HelpATL avoids most of these because it is funded by B2B portal subscriptions, not civic participation metrics. The civic content is a vertical within a platform, not a standalone product. This structural difference is the key.

---

### 1.3 What's Thriving

#### B2G (Government-as-Customer) GovTech
The segment with the clearest product-market fit is selling software *to* government agencies, not building consumer civic engagement. GovTech (Granicus, Socrata, OpenGov) has found repeatable revenue. This is not our model, but it's relevant to know.

#### Volunteer Platforms with Structure
Idealist/VolunteerMatch have found PMF in a specific niche: structured volunteer matching where organizations post listings and individuals browse. The structured data model — unlike social media posts — creates search and recommendation surfaces that feel useful. This maps well to HelpATL's volunteer engagement capability (PRD 030).

#### Issue-Based Action Tools (Resistbot, 5Calls)
These work because they reduce a complex civic action (call your representative) to a single step. The user doesn't need to discover the issue, look up contacts, or write a script. The insight: civic engagement fails when friction is high. Tools that ruthlessly eliminate friction (even at the cost of depth) outperform comprehensive civic information platforms.

#### Change.org (Petitions)
Scale through virality, not depth. Petitions spread because signing takes 10 seconds and shares organically. No financial model to speak of (they've tried various paid features), but massive engagement. Lesson: reach through frictionless actions.

#### Chi Hack Night (Chicago)
Model civic tech meetup. Weekly, in-person, focused on a specific city, attracts developers AND city officials. Survived CfA brigade sunset by building its own identity and revenue. Cited as the template other brigades are following.

#### Local Civic Journalism (Block Club Chicago, Rough Draft Atlanta)
Not technology, but worth noting: local civic journalism has found a subscriber-funded model (Substack, membership). Rough Draft Atlanta is active in covering Atlanta civic issues. This matters for HelpATL — journalism is upstream of civic events. If we can surface Rough Draft Atlanta coverage alongside relevant events, that's differentiated.

---

### 1.4 Data Infrastructure Opportunities

#### OpenStates API
- **Status:** Active. Covers all 50 states including Georgia (GA).
- **Data:** State legislative bills, votes, sponsor info, session data. Normalized across all states via JSON API v3.
- **Georgia coverage:** Georgia General Assembly — full bill/vote history.
- **Access:** Free API key via open.pluralpolicy.com (now Plural Policy). Bulk CSV/JSON also available.
- **For HelpATL v1:** Low priority for v1. Useful for "track legislation" feature (follow a bill through committee, get notified of hearing dates). Hearing dates from OpenStates could feed into the Upcoming Deadlines module. Not actionable without crawler infrastructure for Georgia legislative calendar events.
- **Verdict:** Evaluate for v2. Build the school board / city council event crawlers first (they generate immediate attendance events). OpenStates adds legislative depth later.

#### Google Civic Information API
- **Status:** Partially deprecated. The Representatives API (elected official lookup by address) was turned down April 30, 2025. The Divisions API (OCD-ID lookup by address) and Elections API (voter info, polling places) remain active.
- **Impact:** "Who are my representatives?" is now answered by a two-step process: Divisions API for OCD-ID, then a separate data source for officials.
- **For HelpATL v1:** The Elections API remains useful for voter registration deadlines, polling place lookup during elections. Not worth building around given the Representatives deprecation.
- **Verdict:** Skip for v1. Cicero (below) is the better representative lookup solution.

#### Cicero API
- **Status:** Active. Acquired by Melissa Data.
- **Data:** Address to district matching + elected official contacts. Rooftop-level accuracy. Covers Congress, state legislature, city/county. 400+ cities and counties in US. Updated daily.
- **For HelpATL v1:** Useful for "who represents me at [jurisdiction]" on event detail pages (e.g., "This school board meeting affects your district — here are your board members"). 1000 free credits on trial; paid after that.
- **Verdict:** Worth a trial integration. Particularly useful for the civic reason layer (PRD 029 §3.2) — showing users which events are within their jurisdiction. Not blocking for v1; integrate when building jurisdiction-aware event filtering.

#### Idealist/VolunteerMatch API
- **Status:** Active. Merged platform now offers an API and syndication partners.
- **For HelpATL:** Direct crawling of volunteer opportunities with structured data (role, schedule, requirements, capacity). Hands On Atlanta and Atlanta's major nonprofits are already on this platform.
- **Verdict:** High priority for volunteer engagement capability (PRD 030). Build this crawler before the Mobilize crawler — the data quality is better.

---

## Part 2: Atlanta Activism Organization Map

### 2.1 Top 20 Advocacy Organizations Active in Atlanta

| # | Organization | Primary Causes | Event Frequency | Event Platforms | Size/Reach |
|---|---|---|---|---|---|
| 1 | **Hands On Atlanta** | Cross-cause volunteer coordination | Daily (400+ partner orgs) | Own platform, Idealist, VolunteerMatch | Very large — 42,000 volunteers/year |
| 2 | **Atlanta Community Food Bank** | Food security, hunger relief | Weekly volunteer events | Own calendar, Idealist, Eventbrite | Very large — 1,700 volunteers/month |
| 3 | **Democratic Party of Georgia** | Voter registration, elections | Weekly (higher near elections) | Mobilize.us (primary) | Large — statewide infrastructure |
| 4 | **Atlanta Habitat for Humanity** | Housing, affordable homeownership | Weekly (construction days) | Own site, Idealist | Large — 100+ build events/year |
| 5 | **Georgia Conservation Voters** | Environment, clean energy | Monthly + legislative sessions | Own site, email | Mid-size — policy-focused, lower public events |
| 6 | **Sierra Club Georgia / Metro Atlanta Group** | Environment, climate, outdoors | Monthly meetings + outings | Own site (sierraclub.org/georgia) | Mid-size — regular hikers + advocates |
| 7 | **Indivisible Georgia Coalition / North Metro Atlanta** | Democracy, voting rights, anti-GOP | Weekly (chapters vary) | Mobilize.us, Action Network | Mid-size — national org with local chapters |
| 8 | **Georgia Latino Alliance for Human Rights (GLAHR)** | Immigration, Latino rights, housing | Weekly hybrid meetings (avg 65/meeting), 7+ webinars/year | Own site, Facebook | Mid-size — established 1999, statewide |
| 9 | **New Georgia Project Action Fund** | Voter registration, underrepresented communities | Event-driven (registration drives) | Own site, Mobilize.us | Large — significant 2020 election impact |
| 10 | **Atlanta DSA (Metro Atlanta Democratic Socialists)** | Housing, labor, healthcare, economic justice | Weekly working groups, monthly general | Mobilize.us, Action Network, own site | Mid-size — largest socialist chapter in South |
| 11 | **Georgia Working Families Party** | Labor, living wage, economic justice | Monthly + election cycles | Mobilize.us, own site | Mid-size — multi-racial coalition |
| 12 | **HRC Georgia (Human Rights Campaign)** | LGBTQ rights, non-discrimination | Monthly events, annual gala | Mobilize.us, own site | Mid-size — national org with GA chapter |
| 13 | **Southerners On New Ground (SONG)** | LGBTQ justice, race, immigration | Monthly + campaigns | Action Network, own site | Mid-size — Southern-focused, non-electoral |
| 14 | **NAACP Atlanta / Georgia Conference** | Civil rights, voting, racial justice | Monthly branch meetings, annual conf | Own site, Eventbrite | Large — established institution |
| 15 | **Atlanta BeltLine Partnership** | Urban development, transit, equity | Monthly partner events, annual events | Own site, Eventbrite | Large — $5B+ project with broad coalition |
| 16 | **ThreadATL** | Transit, pedestrian safety, bike infrastructure | Monthly meetings, quarterly events | Own site (threadatl.org), Eventbrite | Small/Mid — policy wonk community |
| 17 | **Citizens for Progressive Transit (CFPT)** | MARTA, transit expansion | Monthly | Own site | Small — specialized, technically active |
| 18 | **Housing Justice League** | Housing, tenant rights, anti-displacement | Weekly organizing + monthly public | Action Network, own site | Small/Mid — confrontational organizing style |
| 19 | **Georgia Council on Developmental Disabilities** | Disability rights, inclusion | Annual advocacy days + monthly | Own site, event-specific | Mid-size — government-adjacent |
| 20 | **Civic Tech Atlanta (formerly Code for Atlanta)** | Open data, government tech, civic apps | Twice-monthly hack nights | Meetup.com, own site | Small — technical community, ~50-150 regulars |

Additional organizations worth monitoring: SOMOS Georgia (immigration/Latino), Third Act Initiative (older adults/climate), West Atlanta Watershed Alliance (environmental), Georgia Equality (LGBTQ + state politics), Open Door Community (homelessness/poverty).

---

### 2.2 Mobilize Coverage Assessment

**What Mobilize captures in Atlanta:**
- Democratic Party of Georgia (all electoral organizing)
- Indivisible Georgia Coalition chapters
- HRC Georgia
- Georgia Working Families Party
- Atlanta DSA
- Third Act Initiative
- New Georgia Project (partial — they also use own platform)
- One-off national organizations running Atlanta events (Hands Off, etc.)

**What Mobilize does not capture:**
- Hands On Atlanta and its 400+ partner nonprofits (not on Mobilize)
- Atlanta Community Food Bank volunteer events (Idealist, own platform)
- Habitat for Humanity build days (own platform)
- Sierra Club Georgia outings and meetings (own site)
- GLAHR community meetings (Facebook, own site)
- Atlanta BeltLine events (Eventbrite, own site)
- ThreadATL, CFPT (own sites)
- NAACP Atlanta chapter events (own site, Eventbrite)
- Civic Tech Atlanta hack nights (Meetup)
- All conservative and libertarian organizations (they don't use Mobilize)

**Estimated Mobilize coverage of Atlanta civic events:** Roughly 25-35% of total civic/advocacy events. Mobilize captures Democratic electoral organizing comprehensively but misses the entire nonpartisan nonprofit service sector, the environmental/outdoors community, and all conservative organizing.

If HelpATL's source mix is Mobilize-heavy, it will look and feel like a progressive political organizing hub, not a civic engagement platform.

---

### 2.3 Political / Ideological Balance Analysis

This is the most strategically important section for HelpATL.

**The Mobilize problem:** Mobilize.us was explicitly designed to serve Democratic campaigns and progressive organizations. Every organization on the platform is either a Democratic committee, a progressive advocacy org, or a left-leaning nonprofit. There are no conservative organizations on Mobilize.us because the platform was built as a partisan tool.

**The Action Network problem:** Explicitly progressive. Their own website states they build tools for "teams fighting for progressive change."

**What conservative civic engagement looks like in Atlanta:**
Conservative civic organizing in Atlanta does not use centralized platforms comparable to Mobilize. It flows through:
- Megachurch networks (First Baptist, North Point Community Church) — events on own sites
- Business associations (Metro Atlanta Chamber, Buckhead Coalition) — own sites, Eventbrite
- Republican Party of Georgia — own site, occasional Eventbrite
- Americans for Prosperity Georgia — own site
- Georgia Family Council (social conservative) — own site
- Tea Party successor groups — Facebook Groups, Meetup
- Neighborhood associations in suburban counties (Cobb, Gwinnett) — NextDoor, HOA email lists
- Gun rights orgs (Georgia Carry) — own site, Meetup

**The honest assessment:** If HelpATL crawls Mobilize + Action Network as primary sources and does not build explicit crawlers for conservative-adjacent civic organizations, the platform will be factually biased. This is not a subjective concern — the source mix determines the output.

**Why this matters beyond politics:** HelpATL's stated positioning is nonpartisan civic engagement. If a Republican Cobb County resident visits HelpATL looking for ways to get involved in their community and sees Democratic Party canvasses, DSA working groups, and Indivisible meetings with no counterparts, they will conclude the platform is not for them. That's a user loss problem, not a political neutrality problem.

**Recommended approach:** Build HelpATL's civic sources in three tiers:

*Tier 1 (Genuinely nonpartisan — all political contexts):*
- Idealist/VolunteerMatch (service volunteering)
- Eventbrite (civic category filter)
- Individual nonprofit sites: ACFB, Habitat, Hands On Atlanta, BeltLine, NAACP, Sierra Club, Civic Tech Atlanta
- Government calendar sources: APS, Fulton County, DeKalb County, City of Atlanta, MARTA board

*Tier 2 (Progressive-leaning but service-adjacent — acceptable with balance):*
- Mobilize.us (label as "civic organizing" not "civic engagement" generally)
- Action Network

*Tier 3 (Explicitly partisan — do not include without counterbalance):*
- Democratic Party of Georgia electoral organizing
- Republican Party of Georgia electoral organizing

The current PRD 028/029 work on interest channels and civic action capability should explicitly define which tier each source is assigned to. Without this, the platform will drift toward Mobilize-heavy progressive content by default because that's where structured event data is easiest to crawl.

---

### 2.4 Cause Channel Coverage by Organization Count

| Cause Channel | Active Atlanta Orgs | Top Organizations | Coverage Assessment |
|---|---|---|---|
| **Food / Hunger** | 4-5 | ACFB, Hands On Atlanta (hunger program), Atlanta Mission, Open Door Community | Strong — ACFB alone generates hundreds of events/year |
| **Housing** | 5-6 | Atlanta Habitat, Housing Justice League, Task Force for the Homeless, GLAHR (tenant rights), DSA (housing) | Strong — multiple orgs with regular cadence |
| **Environment / Climate** | 4-5 | Sierra Club GA, Georgia Conservation Voters, West Atlanta Watershed Alliance, Georgia Conservation Voters | Moderate — monthly meetings, fewer high-frequency events |
| **Education** | 3-4 | APS (school board meetings), Fulton/DeKalb school boards, community orgs | Moderate — institutional events from school boards; few advocacy orgs with public events |
| **Transit** | 3 | ThreadATL, CFPT, Atlanta BeltLine Partnership | Weak — small orgs, low event frequency. MARTA board meetings are the anchor |
| **Public Safety / Criminal Justice** | 3-4 | NAACP Atlanta, Atlanta Police Foundation (pro-police side), National Action Network | Mixed — politically charged; few neutral public engagement events |
| **Health / Disability** | 2-3 | Georgia Council on Developmental Disabilities, Project AFFIRM, Raksha | Weak for broad "health" channel; better for disability rights specifically |
| **Animals** | 2-3 | Lifeline Animal Project (largest no-kill shelter), LifeLine Community Animal Rescue | Moderate — high volunteer demand; Idealist will surface these |
| **Arts / Culture** | 5+ | Fulton County Arts & Culture, ArtsGeorgia, Atlanta Coalition of Performing Arts, Community Foundation for Greater Arts | Moderate — institutional funding advocacy; fewer grassroots advocacy orgs |

**Channels at risk of being empty or thin in v1:**
- **Transit:** ThreadATL and CFPT hold monthly meetings, which is not enough to sustain a "transit" channel that feels alive. The anchor should be MARTA board meeting crawls.
- **Health:** Too broad as defined. Needs narrowing to disability rights + healthcare access + mental health advocacy, or it will be a jumble.
- **Public Safety:** Politically loaded. "Community safety" orgs on Mobilize will be anti-policing; neighborhood watch and APF events will be on the other side. Consider whether this channel creates more editorial risk than value.

---

## Part 3: Strategic Recommendations for HelpATL

### 3.1 Source Prioritization (What to Build First)

Priority 1 — Government calendars (school boards, city council, county commission, MARTA):
These are genuinely nonpartisan, high-trust, and anchor the "civic legitimacy" of the platform. Already partially built (APS, DeKalb, Fulton board crawlers in progress). Finish these first.

Priority 2 — Idealist/VolunteerMatch:
Best structured data. Covers service volunteering across all causes. Nonpartisan. Hands On Atlanta alone connects to 400+ nonprofits. One crawler covers enormous ground.

Priority 3 — Individual nonprofit sites:
ACFB, Habitat for Humanity Atlanta, Sierra Club Georgia (events page), Atlanta BeltLine Partnership (Eventbrite). These are established orgs with regular event cadences and crawlable pages.

Priority 4 — Mobilize.us (with explicit labeling):
Useful for civil and political organizing events. Label these as "civic organizing" in the interest channel system so they appear under appropriate channels (housing, transit, voting rights) rather than polluting the neutral service volunteering feed.

Priority 5 — Eventbrite (civic/government/political filter):
Catches events from NAACP, arts advocacy, some conservative business events. Broader coverage but lower signal-to-noise ratio.

### 3.2 What to Avoid

**Do not** build HelpATL as a Mobilize aggregator with a civic skin. That's a progressive organizing hub, not a civic engagement platform. The political skew will be immediately obvious to any non-progressive visitor and will cap the audience.

**Do not** build a "public safety" channel without a clear definition of what it includes. This channel will immediately generate editorial controversy regardless of which organizations you surface.

**Do not** add OpenStates legislative bill tracking in v1. It requires building an entirely separate UI pattern (bill status, hearing schedule, committee assignments) and the audience for "track bills through the Georgia legislature" is tiny and highly political. This is a v3 feature for a policy-focused portal, not HelpATL.

### 3.3 Positioning Recommendation

HelpATL should position as: "A place to find ways to help your community — show up, volunteer, and participate in decisions that affect your neighborhood."

The frame is **civic participation as service**, not civic participation as political action. This positioning:
- Neutralizes the Mobilize skew (service volunteering dominates the feed, not political organizing)
- Matches the volunteer engagement capability (PRD 030) better than the civic action capability (PRD 029)
- Gives HelpATL genuine crossover appeal to residents who consider themselves nonpolitical but want to contribute
- Does not require resolving the conservative/progressive source balance before launch — service volunteering is genuinely nonpartisan

Political organizing events (DSA meetings, DPG canvasses, Indivisible rallies) can still appear in appropriate interest channels. But they should not define the platform's primary identity.

### 3.4 Civic Tech API Integration Sequence for HelpATL

| API | v1 | v2 | Notes |
|---|---|---|---|
| Idealist/VolunteerMatch crawl | Yes | — | High ROI, structured data |
| Mobilize.us crawl | Yes (labeled) | — | Politically skewed; label sources explicitly |
| OpenStates (Georgia) | No | Yes | Legislative bill tracking; complex UX |
| Google Civic Info Elections API | No | Maybe | Voter info; elections only |
| Cicero (district/rep lookup) | No | Yes | Adds jurisdiction context to event detail |
| Google Civic Info Representatives | No | Dead | Deprecated April 2025 |

---

## Appendix: Source Map for Interest Channel Crawlers

| Source | Channel Relevance | Platform | Crawlability |
|---|---|---|---|
| Hands On Atlanta | Food, housing, environment, education, animals, arts | Own platform + Idealist | Medium — need account for some listings |
| Atlanta Community Food Bank | Food | Own calendar + Idealist | High — structured calendar |
| Atlanta Habitat for Humanity | Housing | Own site + Idealist | High |
| GLAHR | Housing, immigration | Own site, Facebook | Medium — Facebook is unreliable |
| DSA Atlanta | Housing, labor, health | Mobilize, Action Network, own site | High via Mobilize |
| Sierra Club Georgia | Environment | Own site (sierraclub.org/georgia/atlanta/events) | High — clean events listing |
| Georgia Conservation Voters | Environment | Own site | Low — policy-focused, few public events |
| ThreadATL | Transit | Own site, Eventbrite | Medium |
| CFPT | Transit | Own site | Low — small org, infrequent events |
| Atlanta BeltLine Partnership | Transit, housing, arts | Eventbrite | High via Eventbrite |
| NAACP Atlanta | Public safety, voting, education | Own site, Eventbrite | Medium |
| HRC Georgia | Health (LGBTQ), public safety | Mobilize | High via Mobilize |
| Georgia Council on Developmental Disabilities | Health, education | Own site | Medium |
| Lifeline Animal Project | Animals | Own site, Idealist | Medium |
| Civic Tech Atlanta | Education, civic | Meetup | High via Meetup API |
| APS Board | Education | Crawled (in progress) | High |
| Fulton County Schools Board | Education | Crawled (in progress) | High |
| DeKalb County Schools Board | Education | Crawled (in progress) | High |
| City of Atlanta Council | Public safety, housing | Own calendar | High |
| Fulton County Commission | Housing, environment | Own calendar | Medium |
| MARTA Board | Transit | Own calendar | Medium |

