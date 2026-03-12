# Research: School Board Profile Validation + P2/P3 Volunteer Source Assessment

**Date:** 2026-03-08  
**Context:** HelpATL civic content pipeline — evaluating crawler readiness for school board meetings and secondary volunteer platforms.  
**Related PRDs:** 029-civic-action-capability.md, 030-volunteer-engagement-capability.md

---

## Part 1: School Board Profile Validation

### Current Profile State

All three YAML profiles are near-identical minimal stubs. Each contains:
- One discovery URL
- Default category/tags
- No calendar URL, no agenda URL, no meeting type filter, no public comment metadata

This is not enough to build a crawler from. A crawler needs to know where meetings are listed, what cadence to expect, whether agenda links are available, and how to parse the date format. None of that is in the profiles.

---

### APS: Atlanta Public Schools Board of Education

**Profile URL:** `https://www.atlantapublicschools.us/boe`  
**URL validity:** Valid — page is live.

**What we found:**

| Dimension | Finding |
|-----------|---------|
| Calendar URL | `/boe/boe-calendar` (interactive month/week/day widget, requires JS) and `/fs/pages/17848` (same widget, confirmed live) |
| Agenda system | External: Simbli eBoard at `https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031014` — **blocked by Incapsula bot protection** |
| Meeting frequency | Monthly regular board meetings. Additional: Audit Committee, Budget Commission, Accountability Commission, community meetings |
| Public comment | "Let's Talk" mechanism exists. Not explicitly confirmed as a standing agenda item on the calendar page — listed as a separate channel |
| Meeting venue | 130 Trinity Ave SW, Atlanta, GA 30303 (Alonzo A. Crim Center) |
| Scraping difficulty | Calendar is JavaScript-rendered. Simbli (agenda source) is bot-blocked. Main calendar page is scrapable but only shows meeting titles and times, no agenda links |

**Crawler assessment:**

The calendar page at `/fs/pages/17848` is scrapable with Playwright (JS required) and yields clean structured data: meeting type, date, time, location. No agenda links on the calendar — those sit in Simbli which actively blocks scrapers.

**Profile status: Needs update.** Add `calendar_url`, `meeting_types` filter, `public_comment: unconfirmed`. Note that agenda source (Simbli) is bot-protected — agenda URLs may need to be manually constructed from meeting dates.

---

### FCS: Fulton County Schools Board of Education

**Profile URL:** `https://www.fultonschools.org/fcs-board-of-education`  
**URL validity:** Valid — page is live.

**What we found:**

| Dimension | Finding |
|-----------|---------|
| Calendar URL | `/fcs-board-of-education/meeting-calendar` |
| Agenda system | External: Simbli at `https://simbli.eboardsolutions.com/fulton` — **redirect loop or connection failure, unscrapable** |
| Meeting frequency | Not explicitly stated on the page. Two meeting types: Work Sessions (daytime, North Learning Center) and Board Meetings (evening, South Learning Center). Schedule lives in a PDF/image — dates are NOT in HTML |
| Public comment | Not a standing agenda item on the calendar. Addressed via "Let's Talk!" and "Addressing The Board" mechanisms separately |
| Meeting venue | Work Sessions: 450 Northridge Pkwy. Board Meetings: 4025 Flat Shoals Rd |
| Scraping difficulty | High. Meeting dates are embedded in a calendar image + PDF. The HTML calendar page contains no parseable date text — only image download links |

**Crawler assessment:**

This is the most difficult of the three. The only machine-readable date source would be the Simbli agenda system, which is not accessible. The primary calendar page encodes dates in an image. A reliable crawler would require PDF parsing of the annual calendar document — feasible but brittle. Could alternatively scrape the Simbli page with Playwright if the block can be bypassed.

**Profile status: Needs update.** Critical gap: no HTML-parseable meeting list. Must add `calendar_pdf_url`, note image/PDF dependency. Mark agenda source as inaccessible pending Simbli bypass.

---

### DCSD: DeKalb County School District Board of Education

**Profile URL:** `https://www.dekalbschoolsga.org/board/board-meetings`  
**URL validity:** Valid — page is live.

**What we found:**

| Dimension | Finding |
|-----------|---------|
| Calendar URL | `/board/meeting-calendar` |
| Agenda system | External: Simbli at `https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=4054` — **blocked by Incapsula** |
| Meeting frequency | Monthly. Confirmed dates visible: Feb 9, Mar 9, Apr 20, May 11, Jun 15, 2026 |
| Public comment | **Confirmed standing item.** "Community Input Session" at 5:45 PM. In-person and virtual. Speaker requests to `communityinputspeakerrequests@dekalbschoolsga.org`. Deadline: day of meeting by 5:30 PM (in-person); Sunday prior 5:30 PM (virtual) |
| Meeting venue | AIC, 1701 Mountain Industrial Blvd, Stone Mountain, GA 30083 |
| Scraping difficulty | Low. The `/board/meeting-calendar` page renders a clean list: date, title, time, location, "Read More" link. Scrapable with BeautifulSoup |

**Crawler assessment:**

This is the most crawler-ready of the three. The calendar page at `/board/meeting-calendar` is a clean server-rendered list with consistent date/time/venue structure. No JS required. Agenda links require Simbli (blocked), but meeting events themselves can be created from the calendar page alone. Public comment metadata is well-documented and can be hardcoded.

**Profile status: Needs update.** Add `calendar_url`, `public_comment: confirmed`, `action_type: public_comment`, action deadline logic (day-of, 5:30 PM). This one is ready to build.

---

### Profile Validation Summary

| Profile | URL Valid | Calendar Scrapable | Agenda Access | Public Comment | Build Ready? |
|---------|-----------|-------------------|---------------|----------------|-------------|
| Atlanta Public Schools | Yes | Partial (JS required) | Blocked (Simbli/Incapsula) | Unconfirmed | Needs update — medium effort |
| Fulton County Schools | Yes | No (dates in image/PDF) | Blocked (Simbli redirect) | Not standing item | Needs update — high effort |
| DeKalb County Schools | Yes | Yes (clean HTML list) | Blocked (Simbli/Incapsula) | Confirmed standing item | Needs update — lowest effort |

### Simbli Blocker Assessment

All three districts use Simbli eBoard Solutions for agenda management. Simbli actively blocks non-browser requests via Incapsula. This is a shared blocker across all three sources. Options:

1. **Playwright with stealth** — possible, not guaranteed. Requires maintaining a browser pool for each source.
2. **Agenda URL construction** — if meeting IDs are predictable, can construct direct links from meeting date without scraping Simbli.
3. **Accept the gap** — create meeting events from calendar pages (date, time, type, venue, public comment flag) without agenda detail. Sufficient for HelpATL civic feed v1.

Recommendation: Accept the gap for v1. Meeting events without full agenda links still serve the core use case (know what is happening, when to show up, how to speak). Agenda links can be added manually or via admin enrichment.

---

### Updated Profile Requirements

Each profile needs these additional fields to be crawler-ready:

```yaml
# Fields to add to all three profiles
calendar_url: [primary listing page]
agenda_source: simbli
agenda_access: blocked  # or: playwright-required
meeting_frequency: monthly
meeting_types:
  - regular_board_meeting
  # plus district-specific types
public_comment:
  confirmed: true/false/unconfirmed
  action_type: public_comment
  deadline_notes: [district-specific]
primary_venue:
  name: [venue name]
  address: [address]
```

---

## Part 2: P2/P3 Volunteer Source Assessment

### Key Finding: VolunteerMatch No Longer Exists

VolunteerMatch completed a full merger with Idealist in early 2025. As of September 8, 2025, `volunteermatch.org` redirects to `idealist.org`. The developer portal at `developers.volunteermatch.org` now serves Idealist's API documentation under the "Volunteer Match, powered by Idealist" brand. **These are the same platform.**

---

### Source 1: Idealist / VolunteerMatch (Combined)

**Access method:** API (GraphQL) — requires API key  
**Developer portal:** `developers.volunteermatch.org/api-docs`  
**API page:** `idealist.org/en/open-network-api`

| Dimension | Finding |
|-----------|---------|
| Volume — Atlanta | 2,396 volunteer opportunities listed for Atlanta, GA |
| Date specificity | Mixed. Sample shows roughly 40-60% with specific dates/times. Tags like "Done in a Day" help filter time-specific events |
| Data freshness | Very fresh. Active listings show "Posted 11 minutes ago," "Posted 1 day ago" |
| Access method | GraphQL API — `searchOpportunities` query. API key required via application form |
| Key data fields | ID, title, location (city, postal code), date posted, categories/causes, shifts (if applicable), org details |
| Cost | Not public. "Plans and pricing" page exists but details require inquiry. Likely tiered — free for nonprofits/community, paid for commercial/CSR platforms |
| Application timeline | Unknown. Contact form inquiry → commercial negotiation. No self-serve API key for general access |
| Rate limits | Not documented publicly |
| Scraping alternative | Possible but terms of service likely prohibit it. 2,396 results suggests pagination is available |

**Date-specificity assessment:**

Idealist distinguishes "Done in a Day" (one-time, specific date) from ongoing roles. Filtering to `Done in a Day` + date-specific shifts would concentrate on actionable events. Rough estimate: 30-40% of Atlanta listings would have a specific date, yielding ~700-900 date-specific opportunities.

**For HelpATL fit:**

Strong fit in principle — large volume, current data, good categorization. The blocker is API access cost. Idealist positions this as a B2B API for CSR platforms and government agencies. A community platform like LostCity/HelpATL may qualify for a nonprofit/mission-aligned tier, but this needs direct outreach to confirm.

**Recommendation:** Apply. Position LostCity as a civic engagement platform, not a commercial aggregator. Reference HelpATL's mission. Even if we get a free-tier key, the API gives us the cleanest, largest source of dated volunteer opportunities in the market.

---

### Source 2: United Way of Greater Atlanta (Galaxy Digital)

**URL:** `volunteer.unitedwayatlanta.org/need/`  
**Access method:** Scrape (no API visible)

| Dimension | Finding |
|-----------|---------|
| Volume | ~48 total opportunities (4 pages × 12 per page) |
| Date specificity | Low. 92% of visible listings marked "Is Ongoing." Only 8% (roughly 4 listings) have specific end dates |
| Data freshness | Not visible from listing page — requires clicking into detail |
| Listing fields | Title, organization, ongoing/end-date status. Description and location require `need/detail/?need_id=[ID]` |
| Access method | Scrapable HTML. URL pattern is clean: `need_id` integers, sequential |
| Login required | No — listings accessible without account |
| Platform | Galaxy Digital (volunteer management SaaS used by United Way chapters) |

**Date-specificity problem:**

At 92% ongoing listings, this source would produce almost no date-specific events. For HelpATL's civic feed, ongoing roles create noise rather than signal. A "volunteer this Saturday" lane requires events with actual dates. United Way Atlanta is not a good primary source for that use case.

**However:** United Way has organizational credibility. Their ~4 date-specific listings per crawl cycle are high-trust. Could be included as a supplemental source with date-specificity filter, not a primary.

**Recommendation:** Defer. Build after date-specific Idealist pipeline is working. Low volume + low date-specificity makes this a poor use of crawler build time.

---

### Source 3: Idealist Standalone (Note: Same as Source 1)

Already covered under the combined Idealist/VolunteerMatch analysis above. The public-facing `idealist.org/en/volunteer-in-atlanta-ga` page shows 2,396 Atlanta listings. This is the same inventory as the API.

**Scraping the public site** is possible but not recommended — the API gives cleaner structured data, and scraping at scale likely violates ToS. The API application is the right path.

---

### Source 4: JustServe

**URL:** `justserve.org`  
**API:** `api.justserve.org` — connection refused (not publicly accessible)

| Dimension | Finding |
|-----------|---------|
| Volume — Atlanta | Unknown — site loads via JavaScript, fetch returned only config data |
| Date specificity | Unknown |
| Access method | JavaScript-rendered SPA. API infrastructure exists at `api.justserve.org` but returns ECONNREFUSED — not publicly exposed |
| Organizational backing | The Church of Jesus Christ of Latter-day Saints (free service, community focus) |
| Data quality | Unknown from web access alone |
| Login required | Unknown |

**Assessment:**

JustServe is a black box from an external access standpoint. Their API is internal-only. The site requires JavaScript rendering. Scraping is possible with Playwright but the volume and date-specificity are unknown without hands-on testing in a real browser.

JustServe tends to skew toward faith community service projects (local churches, meetups) rather than formal nonprofit volunteer shifts. This could be complementary to Idealist (which is nonprofit-heavy) but may also skew toward "ongoing/flexible" rather than date-specific events.

**Recommendation:** Investigate later. Requires a Playwright browser test to assess actual volume and date-specificity. Not worth allocating build time before Idealist API access is secured.

---

### Source Viability Matrix

| Source | Volume (Atlanta) | Date-Specific % | Access Method | Effort to Build | Priority |
|--------|-----------------|-----------------|---------------|----------------|----------|
| Idealist / VolunteerMatch API | ~2,400 listings | ~35-40% (est.) | API — key required | Medium (post-approval) | **P1** |
| Hands On Atlanta (Galaxy Digital) | TBD (established) | Higher est. | Scrape or Galaxy API | Low-Medium | **P1** |
| United Way Atlanta (Galaxy Digital) | ~48 listings | ~8% | Scrape (HTML) | Low | P3 — defer |
| JustServe | Unknown | Unknown | Playwright scrape | Medium (unknown complexity) | P3 — investigate |

*Note: Hands On Atlanta was listed as a P1 source in PRD 030 and not part of this assessment — included in matrix for comparison.*

---

### Priority Order with Justification

**Priority 1: Idealist/VolunteerMatch API**

Apply now. 2,400 Atlanta listings. Active data. Date-specific filtering available. This is the largest, cleanest source of volunteer opportunities available. The API application is a week of email, not a week of engineering. Apply with HelpATL's civic mission framing.

Application action items:
- Submit inquiry at `idealist.org/en/open-network-api`
- Frame as: civic engagement platform, community benefit, not commercial aggregator
- Request nonprofit/mission-aligned pricing
- Estimate 2-4 week response timeline based on typical API partnerships
- Parallel: test scraping the public site with rate limiting as a stopgap

**Priority 2: United Way Atlanta — defer until data need grows**

Volume is too low (48) and date-specificity too poor (8%) to justify build time now. Revisit if HelpATL's volunteer feed becomes thin. Their organizational credibility is worth having eventually, but it's not additive in v1.

**Priority 3: JustServe — investigate before committing**

Unknown volume, unknown date-specificity, opaque access method. Before allocating a crawler build, spend 30 minutes doing a real browser test and count listings. If date-specific volume is low, deprioritize indefinitely. If volume is meaningful, the Playwright build is straightforward.

---

### API Application Timeline Estimate

| Action | Owner | Timeline |
|--------|-------|----------|
| Submit Idealist API inquiry | Product/Founder | This week |
| Idealist review + response | Idealist | 2-4 weeks |
| API key provisioning (if approved) | Idealist | +1 week |
| Crawler build — Idealist | Engineering | 3-5 days |
| Crawler build — United Way scrape (if prioritized) | Engineering | 1-2 days |
| JustServe browser audit | Engineering | 2-3 hours |
| JustServe crawler build (if viable) | Engineering | 2-3 days |

**Realistic first data from Idealist:** 5-7 weeks from now if application starts immediately. Stopgap: scrape the public Idealist site with conservative rate limiting while API is in review.

---

## Summary and Recommendations

### School Boards

1. DeKalb is the only one ready to build today. Clean HTML calendar, confirmed public comment standing item, well-documented. Build the crawler against `/board/meeting-calendar`. Accept that agenda links require Simbli which is bot-blocked — that's a v2 problem.

2. APS can be built with Playwright against the JS calendar. Agenda access blocked. Build is medium effort.

3. Fulton is the hardest. Dates live in a PDF/image, not HTML. Either build a PDF parser for the annual calendar document or accept that Fulton's meetings will require manual backfill until a Simbli bypass exists. Lowest priority of the three.

4. All three YAML profiles need substantial updates before handing to the crawler-build agent. Do not build from the current stubs — they are placeholders, not specifications.

### P2/P3 Sources

1. Apply for Idealist API this week. It's the only source with enough Atlanta volume and data quality to matter. Everything else is secondary.

2. Don't build United Way or JustServe crawlers before Idealist API access is secured. Low volume + low date-specificity makes them premature.

3. VolunteerMatch no longer exists as a separate entity. Remove it from any planning docs that reference it as a distinct source.
