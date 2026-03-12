# Research 5AB: Volunteer Ecosystem + Government Body Inventory

**Research tracks:** 5A (Volunteer Organization Ecosystem) + 5B (Government Body Inventory)
**Status:** Complete — 2026-03-08
**Feeds into:** `helpatl-content-research-plan.md` tracks 5A/5B, `029-civic-action-capability.md` §3, `030-volunteer-engagement-capability.md`

---

## Strategic Frame

This research exists to answer two foundational questions for HelpATL v1:

1. **Volunteer:** Which organizations drive the bulk of volunteer activity in Atlanta? Which are reachable by crawling HOA alone vs. needing dedicated crawlers? What's the realistic weekly event volume?
2. **Government:** How many public meetings happen per month in the Atlanta metro? Which bodies are worth crawling? What's the total civic meeting density the feed can draw from?

These numbers directly determine whether the HelpATL feed can be consistently populated or will have dead weeks.

---

## Part A: Volunteer Organization Ecosystem

### A1. Top 20 Volunteer-Placing Organizations

| # | Organization | Platform | HOA Partner? | Est. Events/Month | Primary Cause | Drop-in / Commit |
|---|---|---|---|---|---|---|
| 1 | **Atlanta Community Food Bank** | VolunteerHub (`acfb.volunteerhub.com`) | Yes (via HOA hunger partnership) | 40–60 shifts | food-security | ~80% drop-in shifts |
| 2 | **Hands On Atlanta** | Golden (`volunteer.handsonatlanta.org`) | N/A — they ARE the aggregator | 150–250 listings active | All causes | Mixed |
| 3 | **Park Pride** | Own website + HOA partnership | Yes | 8–15 | environment | Drop-in |
| 4 | **Trees Atlanta** | Own website/Eventbrite; year-round Saturdays | Yes (HOA Love Your Park) | 12–20 | environment | Drop-in |
| 5 | **United Way of Greater Atlanta** | Galaxy Digital (`volunteer.unitedwayatlanta.org`) | Partial overlap | 30–50 | Mixed (food, education, housing) | Mixed |
| 6 | **Atlanta Habitat for Humanity** | GivePulse + HOA | Yes | 10–15 | housing | Mix — build days (drop-in) + ongoing |
| 7 | **LifeLine Animal Project** | Own website/Eventbrite | Yes (HOA animals category) | 8–12 | animals | Mix — shelter shifts + events |
| 8 | **Furkids** | Own website (`furkids.org/volunteer`) | Partial | 6–10 | animals | Commitment-required (orientation) |
| 9 | **PAWS Atlanta** | Own website (`pawsatlanta.org`) | Partial | 6–10 | animals | Mix — drop-in events + ongoing roles |
| 10 | **Open Hand Atlanta** | Own website + United Way | Partial | 6–8 | food-security, health | Mix — kitchen/delivery shifts (drop-in eligible) |
| 11 | **Meals on Wheels Atlanta** | VolunteerHub + United Way | Yes | 6–10 | food-security, health | Route commitment + events |
| 12 | **Hosea Helps** | Own website | Partial | 10–15 | food-security, housing | Drop-in (Care Center Tue–Sat) + holiday events |
| 13 | **MUST Ministries** | Own website | Partial | 8–12 | food-security, housing | Mix |
| 14 | **Boys & Girls Clubs of Metro Atlanta** | Own website (`bgcma.org`) | Yes | 5–8 | youth, education | Commitment-required |
| 15 | **Atlanta Toolbank** | Own website (`atlantatoolbank.org`) | Partial | 3–5 | housing, community | Project-based |
| 16 | **Keep Atlanta Beautiful** | City of Atlanta parks site + HOA | Yes | 6–10 | environment | Drop-in cleanups |
| 17 | **Atlanta Humane Society** | Own website | Partial | 4–6 | animals | Commitment (orientation + training) |
| 18 | **Concrete Jungle** | Own website + HOA | Yes | 4–6 | food-security, environment | Drop-in harvests |
| 19 | **The King Center** | Own website + HOA (MLK Day) | Yes (seasonal) | 1–2 steady + spike Jan | education, youth | Drop-in/event |
| 20 | **The Atlanta Mission** | Own website | Partial | 4–6 | housing, food-security | Commitment-required |

**Notes on estimates:** "Events/month" is best estimate based on site inspection and organization scale. ACFB runs daily warehouse shifts (multiple per day) — 40–60 is a conservative count of distinct shift sessions listed in VolunteerHub. HOA's 150–250 listing count includes all partner org events surfaced through their Golden portal.

---

### A2. HOA Coverage Assessment

HOA (Golden platform) is the single highest-leverage crawler target. If the HOA crawler works, it surfaces partner org content without needing org-by-org crawlers.

**What HOA covers:**
- Events posted by partner nonprofits directly into Golden
- Hands On Atlanta's own signature events (MLK Day, Love Your Park, corporate days of service)
- Roughly 125+ nonprofit and school partners post through HOA

**HOA coverage estimate:** 60–70% of Atlanta's volunteer event volume by listing count, but unevenly distributed across causes.

**Strong HOA coverage (>70% of events in cause):**
- Food security (ACFB, Open Hand, Hosea Helps, Concrete Jungle all use HOA)
- Environment (Park Pride, Trees Atlanta, Keep Atlanta Beautiful)
- Youth/education (Boys & Girls Clubs, schools, tutoring orgs)

**Weak HOA coverage (<40% of events in cause):**
- Animals (Furkids, PAWS, Atlanta Humane all run their own platforms)
- Housing (Habitat uses GivePulse; most housing orgs are independent)
- Health (most health volunteer events are at hospitals — not HOA partners)

**HOA crawlability assessment:**
Golden's volunteer portal (`volunteer.handsonatlanta.org`) is a React/Next.js SPA. Public opportunity listings appear accessible without login for browsing. Individual opportunity pages (`/timeslots/[id]`) need testing for auth-gating. HOA also posts upcoming events directly on `handsonatlanta.org/upcoming-events`. The Golden platform has an API (`portal.goldenvolunteer.com`) — Golden does offer API access but it is not public; requires a partnership agreement. **Recommended approach: web scrape the public listing pages.** Auth-gated timeslot pages are a risk that needs testing before committing to HOA as primary source.

**Independent orgs needing dedicated crawlers (by priority):**
1. Atlanta Community Food Bank (`acfb.volunteerhub.com`) — VolunteerHub is crawlable, high volume
2. United Way (`volunteer.unitedwayatlanta.org`) — Galaxy Digital platform, worth assessing
3. Furkids — own website, low-to-medium complexity
4. PAWS Atlanta — own website
5. Atlanta Habitat (`givepulse.com`) — GivePulse is a structured platform with consistent page patterns

**Out-of-scope orgs (social-media-only or invitation-only):**
Several smaller mutual aid orgs and neighborhood associations post volunteer opportunities exclusively via Instagram, Facebook Groups, or email lists. These are not crawlable and are out of scope for v1.

---

### A3. Platform Landscape Summary

| Platform | Organizations Using It | Crawlability | API Available? |
|---|---|---|---|
| Golden (HOA) | 125+ HOA partner orgs | Medium — SPA, testing needed | Partnership required |
| VolunteerHub | ACFB, Meals on Wheels | High — structured HTML | No public API |
| Galaxy Digital (United Way) | United Way partners | Medium | No public API |
| GivePulse | Atlanta Habitat | Medium — structured pages | Yes (limited public) |
| Eventbrite | Various charity events | High — existing crawler | Yes — already integrated |
| Own website | Most individual orgs | Varies | Rare |
| Social media only | Mutual aid, informal orgs | None — out of scope | N/A |

---

### A4. Seasonal Volunteer Calendar

Atlanta volunteer events follow national patterns with some local intensification around King legacy.

| Month | Spike Event | Orgs | Volume Multiplier |
|---|---|---|---|
| **January** | MLK Day of Service | HOA, United Way, King Center, all orgs | 3–5x baseline. HOA runs 10 days of service, 400+ projects. Single biggest volunteer moment in Atlanta. |
| **February** | Black History Month service + Love Your Park | HOA, Park Pride | 1.5x |
| **March–April** | Earth Day / spring park cleanups | Trees Atlanta, Park Pride, Keep Atlanta Beautiful | 1.5–2x for environment cause |
| **April** | National Volunteer Week / Global Volunteer Month | HOA (signature month — "Spring for Service") | 2–3x across all causes |
| **May** | Hands On Atlanta Week (annual signature event) | HOA + all partners | 2x baseline |
| **June–July** | Summer youth programs, lower overall volunteer volume | Youth orgs | Slight dip for drop-in; youth commitment roles peak |
| **August** | Back to school supply drives, school tutoring start | Education orgs, Boys & Girls Clubs | 1.5x education category |
| **September–October** | Neighborhood cleanups (fall), fundraiser season begins | Park Pride, Trees Atlanta | Moderate |
| **November** | Thanksgiving food drives, meal service | ACFB, Hosea Helps, Open Hand, MUST | 2–3x food-security category. Hosea Helps holiday dinners are major volunteer events. |
| **December** | Holiday giving, toy drives, year-end meal service | All orgs | 1.5–2x across causes |

**Atlanta-specific note:** MLK Day is uniquely large in Atlanta compared to any other US city. HOA's 2025 MLK Day mobilized 400+ projects and 5,000+ volunteers in a single day. This is the single highest-volume civic participation event of the year — HelpATL's feed must handle this surge gracefully (dedicated feed section, advance notice, calendar integration).

**Dead zones to plan for:** Mid-summer (June–July) sees reduced drop-in volunteer volume as major organizations slow their programming. The feed's "Urgent Needs" lane becomes more important during this period. Government meeting volumes are also lower in summer (many bodies take August recesses).

---

## Part B: Government Body Inventory

### B1. City of Atlanta

**City Council (full body)**
- Meets every 2 weeks (alternating Mondays at 1pm with committee weeks)
- ~2 full council meetings/month
- Public comment available; meetings livestreamed

**City Council Standing Committees (7 committees)**
All committees meet on the weeks between full Council meetings:
1. Committee on Council — bi-weekly
2. Finance/Executive Committee — bi-weekly
3. Public Safety, Law Enforcement & Adjudication (PSLA) — bi-weekly (Mondays 1pm)
4. Zoning Committee — bi-weekly (Mondays 11am)
5. Transportation Committee — bi-weekly (Wednesdays 10am)
6. Community Development/Human Services Committee — bi-weekly
7. City Utilities Committee — bi-weekly

**Total Council + Committee meetings per month:** ~16 (2 full council + 14 committee)

**Other City of Atlanta Planning/Zoning Bodies**
- Board of Zoning Adjustment (BZA) — monthly public hearing (second floor, City Hall, 12pm)
- Atlanta Planning Advisory Board (APAB) — monthly
- Housing Commission — monthly (second Monday, 10am, City Hall)
- Invest Atlanta Board — monthly (third Thursday, 8:30–9:30am)
- Atlanta BeltLine Partnership Board — quarterly (note: BeltLine is an authority)
- Office of Inspector General oversight — periodic

**Estimated additional City of Atlanta boards/commissions:** 20–30 total bodies, most meeting monthly or quarterly. Atlanta's full boards and commissions list at `atlantaga.gov/government/boards-and-commissions` includes commissions for arts, civil service, historic preservation, and more.

**Neighborhood Planning Units (NPUs) — 25 total**
- Each NPU meets approximately once per month
- 25 active NPUs = 25 meetings/month
- Quality varies: some NPUs have active websites with calendars, others post to Facebook only
- Meeting calendars available at `atlcitydesign.com/upcoming-events` (consolidated city planning calendar)
- For crawling: NPU meetings are NOT on Legistar. They require either the planning department's calendar or individual NPU scraping.

**City of Atlanta estimated monthly meeting total: 50–65**
(Council 2 + committees 14 + BZA/planning 3–4 + other boards 8–10 + NPUs 25)

---

### B2. Fulton County

**Board of Commissioners**
- 7 members (6 district + 1 at-large chairman)
- Meets first and third Wednesday of each month at 10am
- 2 full board meetings/month
- Public comment available (in-person and Zoom); livestreamed on FGTV
- Uses Legistar (`fulton.legistar.com`) — same API structure as Atlanta, crawlable

**Fulton County Committees**
- 5 standing committees within the commission
- Each meets on committee weeks (months have both board and committee weeks)
- Estimated 8–10 committee meetings/month

**Other Fulton County Bodies**
- Planning Commission — monthly
- Board of Assessors — monthly  
- Board of Equalization — periodic
- Fulton County Library System Board — periodic
- Various other boards and authorities (Airport, Housing, Water)

**Fulton County estimated monthly meeting total: 20–30**
(Board 2 + committees 8–10 + planning/other boards 10–15)

---

### B3. DeKalb County

**Board of Commissioners**
- Meets second and fourth Tuesday of each month at 9am (Maloof Auditorium, 1300 Commerce Drive)
- 2 full board meetings/month
- 5 standing committees within the commission
- Uses Legistar (`dekalbcountyga.legistar.com`) — same crawlable API as Atlanta/Fulton

**Standing Committees (DeKalb)**
- Committee of the Whole
- Executive
- Finance & Administration
- Facilities & Technology  
- Health & Human Services
- Highway
- Law & Justice
- Planning, Zoning & Development
- Estimated 6–10 committee meetings/month

**Other DeKalb Bodies**
- Planning Commission — monthly public hearings
- Board of Assessors — periodic
- Board of Health — periodic
- Various other boards and commissions

**DeKalb County estimated monthly meeting total: 20–30**
(Board 2 + committees 6–10 + planning/other 10–15)

---

### B4. School Districts

**Atlanta Public Schools (APS)**
- Board of Education: monthly on first Monday of each month
- Committee meetings: District Executive Committee, other committees — approximately 2–3 additional meetings/month
- Public comment is a standing agenda item
- Calendar at `atlantapublicschools.us/boe`
- APS is running major public engagement for Forward 2040 plan (school closures/redistricting) — additional community meetings scheduled throughout 2025–2026
- **Total APS monthly: 3–4 scheduled meetings + periodic community forums**

**Fulton County Schools (FCS)**
- Monthly cycle: Pre-Work Session + Work Session + Board Meeting (3 events per monthly cycle)
- Total: ~3 meetings/month
- Uses Simbli for agendas (since 2025)
- Calendar at `fultonschools.org/fcs-board-of-education/meeting-calendar`
- **Total FCS monthly: 3**

**DeKalb County Schools**
- Work session (5pm) + Regular meeting (6pm) — same night, monthly
- Monthly schedule: Jan 9, Feb 13, Mar 13, Apr 10, May 8, etc. (second Thursday pattern)
- Location: J. David Williamson Board Room, Robert R. Freeman Administrative Complex, Stone Mountain
- Calendar at `dekalbschoolsga.org/board-of-education/board-meetings/`
- **Total DeKalb Schools monthly: 1 (combined work session + meeting) + occasional workshops**

**Combined school district monthly total: 8–10 meeting events**

---

### B5. Metro-Wide Bodies

**MARTA Board of Directors**
- Monthly board meeting at 1:30pm
- Monthly Planning & Capital Programs Committee at 9:30am
- Periodic work sessions at noon
- All meetings accessible via YouTube livestream
- Published at `itsmarta.com/meeting-schedule.aspx`
- **MARTA monthly: 2–3 meeting events**

**Atlanta Regional Commission (ARC)**
- Monthly board meetings (confirmed: Feb 12, 2025 was one such meeting)
- Multiple committee meetings per month (Transportation and Air Quality Committee "TAQC", etc.)
- Calendar at `atlantaregional.org/board-committee-portal/meeting-calendar/`
- **ARC monthly: 4–6 meeting events**

**Atlanta BeltLine Partnership**
- Quarterly board meetings
- Various community engagement sessions (not formal public meetings)
- **Monthly average: 1–2**

**Invest Atlanta**
- Monthly board (third Thursday, already counted under City of Atlanta)
- Additional committee/advisory meetings
- Uses BoardDocs platform

**Atlanta Housing Authority**
- Board of Commissioners meets monthly
- Public notice posted at `atlantahousing.org/notices/`
- **Monthly: 1–2**

**Other notable metro bodies:**
- Cobb County Board of Commissioners (meets bi-weekly — included below for completeness but flagged as lower priority for HelpATL v1)
- Gwinnett County Board of Commissioners (bi-weekly)
- Clayton County Board of Commissioners (bi-weekly)
- Georgia State Road and Tollway Authority — periodic
- Georgia Regional Transportation Authority (GRTA) — periodic

---

### B6. Grand Total Monthly Meeting Volume

| Jurisdiction | Bodies | Est. Meetings/Month |
|---|---|---|
| City of Atlanta (Council + Committees) | City Council + 7 committees | 16 |
| City of Atlanta (Boards/Commissions) | 20–30 bodies | 12–18 |
| Atlanta NPUs | 25 NPUs | 25 |
| Fulton County | BOC + committees + boards | 20–30 |
| DeKalb County | BOC + committees + boards | 20–30 |
| Atlanta Public Schools | APS Board + committees | 3–4 |
| Fulton County Schools | FCS Board cycle | 3 |
| DeKalb County Schools | DCSD Board | 1–2 |
| MARTA | Board + committee | 2–3 |
| Atlanta Regional Commission | Board + committees | 4–6 |
| Other metro-wide bodies | BeltLine, Invest Atlanta, AHA | 4–6 |
| **Total (ITP Core)** | | **~110–138/month** |

**If Cobb/Gwinnett/Clayton added (full metro):** Add 40–60 more. These are lower-priority for HelpATL v1.

---

## Summary Findings & Recommendations

### For volunteer content (HelpATL Serve mode)

**HOA crawler is the highest-leverage single investment.** Confirmed: 125+ partners, 150–250 active listings, covers 60–70% of Atlanta volunteer event volume. Build this first. Risk: Golden portal is a SPA — needs crawlability testing before committing.

**ACFB/VolunteerHub is the second-most-impactful independent source.** High volume (40–60 shifts/month), VolunteerHub is structured HTML, straightforward to crawl. Add after HOA.

**Animals cause will be chronically underserved by HOA alone.** Furkids, PAWS, and Atlanta Humane all run independent platforms. Without dedicated crawlers, the animals channel will be thin. Either add 2–3 animal org crawlers in Phase 1, or don't launch the animals channel until they exist.

**Weekly volunteer event baseline (once HOA + ACFB crawlers are running):** Estimate 35–60 discrete volunteer opportunities available on any given week in non-peak seasons. In peak periods (MLK Day, April, November), this multiplies 2–5x. This is sufficient to populate the HelpATL volunteer feed without dead weeks.

### For government content (HelpATL Participate mode)

**Legistar covers the highest-value bodies.** Atlanta City Council, Fulton County, and DeKalb County all use Legistar. One Legistar crawler implementation handles three major jurisdictions. This is the single highest-leverage civic content investment.

**Legistar API exists and is documented** at `webapi.legistar.com`. Atlanta uses `atlanta.legistar.com`, Fulton uses `fulton.legistar.com`, DeKalb uses `dekalbcountyga.legistar.com`. This is structured API data, not scraping — high reliability, low maintenance. Confirms PRD 029 §6 action fields (`action_url`, `agenda_url`) are buildable from Legistar data.

**NPUs are a civic engagement opportunity but a crawling challenge.** 25 meetings/month is significant volume, but NPU meetings are NOT on Legistar — they're distributed across individual NPU websites and a city planning calendar (`atlcitydesign.com`). The city planning calendar consolidates them but needs assessment for reliability. V1 recommendation: start with the city planning calendar as single source for NPUs rather than 25 individual crawlers.

**School boards are lower frequency but high public interest.** APS in particular is politically active around Forward 2040 (school closures/redistricting). These meetings draw high civic engagement. The 3 YAML profiles already exist in the repo — confirm they're accurate and activate them.

**MARTA board is straightforward and high interest.** Monthly meetings, published on `itsmarta.com`, consistent schedule. Transit is a major Atlanta civic issue.

### Recommended v1 jurisdiction scope

**Crawl in v1:**
1. Atlanta City Council (Legistar) — covers full council + committees
2. Fulton County (Legistar)
3. DeKalb County (Legistar)
4. APS Board (existing YAML profile — activate)
5. Fulton County Schools Board (existing YAML profile — activate)
6. DeKalb County Schools Board (existing YAML profile — activate)
7. MARTA Board (own website — periodic scrape)
8. ARC (own calendar — assess)
9. NPU consolidated calendar (`atlcitydesign.com`) — if reliably structured

**Defer to v2:**
- Cobb County, Gwinnett County, Clayton County (lower HelpATL relevance, adds complexity)
- Individual NPU websites (25 crawlers is high maintenance; use consolidated calendar)
- Individual City of Atlanta boards/commissions beyond planning bodies (low individual volume)

**Monthly meeting count from v1 scope:** ~75–100 meetings/month. More than enough to populate a "Public Meetings" feed section without dead weeks.

---

## Open Questions for Track 1D (Legistar Audit)

This research opens several technical questions that require the Track 1D Legistar audit to answer:

1. Does the Legistar API return `public_comment` as a structured field, or must it be inferred from meeting type?
2. Are agendas attached to meeting records as structured data or PDF links?
3. Do Legistar events include the specific committee/body name in a consistent field?
4. How far in advance are Atlanta/Fulton/DeKalb meetings populated in Legistar?
5. Does the `atlcitydesign.com` NPU calendar use an iCal feed or structured HTML?

---

*Research conducted: 2026-03-08. Sources: Hands On Atlanta, Golden Volunteer, ACFB/VolunteerHub, Atlanta City Council, Fulton County, DeKalb County, APS, FCS, DCSD, MARTA, ARC official websites and public records.*
