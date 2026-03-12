# Government Meeting Calendar Source Audit
## HelpATL Participate Mode — Research 1D

**Date:** 2026-03-08
**Scope:** Atlanta City, Fulton County, DeKalb County — government meetings, school boards, NPUs

---

## Executive Summary

**Immediately crawlable via Legistar REST API:** DeKalb County, Fulton County
**Broken/blocked:** Atlanta City (Legistar API misconfigured), all Simbli-based school boards (Incapsula WAF)
**Manual/scattered:** NPU meetings (no central machine-readable source)

Estimated total monthly meeting volume across all jurisdictions: **30-40 meetings/month** from the two crawlable county sources alone, with potential for 60-80/month if Atlanta City and school boards are added.

---

## 1. Atlanta City (Legistar) — BLOCKED

### Platform
- **Legistar** (Granicus) at `atlanta.legistar.com`
- Both the REST API (`webapi.legistar.com/v1/atlanta/...`) and the web frontend are **completely broken**

### API Status
```
Error: "LegistarConnectionString setting is not set up in InSite for client: atlanta"
```

Tested all plausible slugs: `atlanta`, `atlantaga`, `atlantacityga`, `cityofatlanta`, `cityatlanta`, `councilatlanta`, `atlanta-ga`. All return the same `LegistarConnectionString` error.

The web frontend (`atlanta.legistar.com/Calendar.aspx`) returns `Invalid parameters!` — a 19-character response with no HTML structure. The RSS feed at `Feed.ashx` returns `"This feed is no longer valid."` This appears to be a systemic configuration failure on the Granicus/Legistar side, not a client-access issue.

### City Website
- `atlantaga.gov` returns HTTP 403 on most subpages (Akamai/CDN blocking)
- `citycouncil.atlantaga.gov` returns a 379-byte stub page

### Atlanta City — Bodies (Known from Prior Data)
Atlanta City Council has approximately 15-20 active bodies including:
- City Council (Full Council)
- Finance/Executive Committee
- Community Development/Human Resources Committee
- Public Safety & Legal Administration Committee
- Transportation Committee
- Zoning Review Board
- Board of Zoning Adjustment
- NPU liaison meetings
- Urban Design Commission

### Crawlability Verdict: NOT CRAWLABLE
The Legistar instance is completely non-functional. No API, no working web pages, no valid RSS feed. The city website blocks automated access. This would require either:
1. Granicus fixing the Atlanta Legistar API configuration (contact their support)
2. Browser-based scraping of `atlantaga.gov` calendar pages (if they unblock or we use residential proxies)
3. A headless browser crawler hitting Legistar with full JS rendering (may still fail given the backend error)

**Recommendation:** File a support request with Granicus about the broken API. Atlanta is the highest-value source for HelpATL and currently the most broken.

---

## 2. DeKalb County (Legistar) — FULLY CRAWLABLE

### Platform
- **Legistar** (Granicus) at `dekalbcountyga.legistar.com`
- REST API: `webapi.legistar.com/v1/dekalbcountyga/`
- **API is fully functional** — tested events, bodies, eventitems, matters endpoints

### API Slug
`dekalbcountyga`

### Bodies/Committees (8 total, all active)

| Body | Type | ID |
|------|------|----|
| Board of Commissioners | Primary Legislative Body | 138 |
| Committee of the Whole | Committee of the Whole | 139 |
| Planning Commission | Planning Commission | 171 |
| Zoning Board of Appeals | Zoning Board of Appeals | 172 |
| Historic Preservation Commission | Historic Preservation Commission | 179 |
| Sketch Plat Review | Sketch Plat Review | 180 |
| Special Called Meeting | Special Called Meeting | 235 |
| Board of Commissioners - Zoning Meeting | BOC Zoning | 287 |

### Field Inventory (Event Record)

| Field | Populated? | Notes |
|-------|-----------|-------|
| EventId / EventGuid | Always | Unique identifiers |
| EventBodyId / EventBodyName | Always | Committee/body reference |
| EventDate | Always | `YYYY-MM-DDT00:00:00` format |
| EventTime | Always | Human-readable: "9:00 AM", "6:00 PM" |
| EventLocation | Always (100%) | Full address with room info |
| EventAgendaFile | Always (100%) | Direct PDF URL to agenda |
| EventAgendaStatusName | Always | "Final" or "Draft" |
| EventMinutesFile | 36% | PDF URL, often published weeks after meeting |
| EventMinutesStatusName | Always | "Final", "Draft", or status indicator |
| EventVideoStatus | Always | "Public" |
| EventVideoPath | 0% | Not used — video likely hosted elsewhere |
| EventComment | 1% | Rarely used |
| EventInSiteURL | Always | Deep link to Legistar meeting detail page |
| EventItems | Available via sub-endpoint | Agenda line items (see below) |

### Agenda Items (EventItems)

Accessed via `GET /events/{id}/eventitems`. **Rich structured data:**

| Field | Description |
|-------|-------------|
| EventItemTitle | Agenda item title (e.g., "COMMENTS FROM THE PUBLIC", "10:00 A.M. PUBLIC HEARING") |
| EventItemAgendaSequence | Order on agenda |
| EventItemAgendaNumber | Section letter (A, B, C, D...) |
| EventItemConsent | Boolean — part of consent agenda |
| EventItemMatterId / MatterFile | Link to legislation/matter record |
| EventItemMatterType | Type of legislation |
| EventItemMatterStatus | Current status |
| EventItemPassedFlag / PassedFlagName | Vote result (Pass/Fail) |
| EventItemActionName | Action taken |
| EventItemMover / Seconder | Motion maker info |
| EventItemMatterAttachments | Attached documents |

A typical Board of Commissioners meeting has **100-120 agenda items** including public comment sections, public hearings, departmental items, and votes.

### Public Comment Identification

Public comment is **clearly identifiable in structured data:**
- Agenda item title: `"COMMENTS FROM THE PUBLIC"` (section C on BOC meetings)
- Includes full procedural text about speaker cards, time limits, residency priority
- Public hearings also identified: `"10:00 A.M. PUBLIC HEARING"` (section D)
- Both BOC and Committee of the Whole meetings have public comment

**Rules from the data:**
- Speakers get 3 minutes each (Committee of the Whole) or per-topic time (BOC)
- Speaker cards required before meeting starts
- DeKalb County residents prioritized over non-residents
- Public comment limited to 30 minutes at Committee of the Whole

### Meeting Volume (2025 Calendar Year)

**74 total meetings** across all bodies:
- Board of Commissioners: 24 (twice monthly)
- Committee of the Whole: 23 (twice monthly, alternating with BOC)
- Special Called Meeting: 15 (as needed)
- Planning Commission: 6 (monthly)
- Board of Commissioners - Zoning: 6 (monthly)

**Average: 6.2 meetings/month**

### 2026 YTD (Jan-Mar)

17 meetings in Q1 2026:
- Committee of the Whole: 5
- Board of Commissioners: 5
- Special Called Meeting: 4
- Planning Commission: 2
- BOC Zoning: 1

### Agenda Lead Time

**Average: 3.0 days** before meeting (range: 0-13 days)
- Agendas are typically finalized 2-4 business days before the meeting
- Some are published same-day (day 0)
- Furthest in advance: 13 days

### Future Calendar Horizon

Only 1 future meeting published as of 2026-03-08 (the next BOC meeting on 2026-03-10). DeKalb publishes meetings ~2-4 weeks ahead at most.

### Matters/Legislation API

Fully functional. Sample matter record includes:
- `MatterFile`: Reference number (e.g., "2025-1189")
- `MatterTitle`: Full description with commission district
- `MatterTypeName`: "Resolution", contract types, appointments
- `MatterStatusName`: "Action", "Agenda Ready"
- `MatterBodyName`: Originating body
- `MatterIntroDate` / `MatterAgendaDate`: Timeline
- `MatterRequester`: Sponsoring commissioner/district

### Crawlability Verdict: EXCELLENT

REST API is fully functional with rich data. All fields we need (title, body, date, time, location, agenda PDF, agenda items, public comment, legislation) are available. The eventitems endpoint provides individual agenda items with vote outcomes. This is the gold-standard government meeting data source.

**Crawler approach:** JSON API crawler hitting `/events` with date filters, enriched with `/events/{id}/eventitems` for agenda detail. No authentication required.

---

## 3. Fulton County (Legistar) — FULLY CRAWLABLE

### Platform
- **Legistar** (Granicus) at `fulton.legistar.com`
- REST API: `webapi.legistar.com/v1/fulton/`
- **API is fully functional**

### API Slug
`fulton` (NOT `fultoncountyga` — that slug fails)

### Bodies/Committees

Only **1 active body** on Legistar:

| Body | Type | ID |
|------|------|----|
| Board of Commissioners | Primary Legislative Body | 138 |

This is notably sparse compared to DeKalb. Fulton County likely has additional committees/boards that are not tracked in Legistar, or they operate as subsections of BOC meetings.

### Field Inventory (Same Schema as DeKalb)

| Field | Populated? | Notes |
|-------|-----------|-------|
| EventDate / EventTime | Always | Same format as DeKalb |
| EventLocation | Always (100%) | Usually "Assembly Hall" |
| EventAgendaFile | Always (100%) | Direct PDF URL |
| EventMinutesFile | 0% | Fulton does not publish minutes PDFs through Legistar |
| EventMedia | 96% | Numeric media ID (video reference) |
| EventComment | 96% | Contains ratification schedule + disclaimer text |
| EventInSiteURL | Always | Deep link to meeting detail |

### Agenda Items (EventItems)

Same rich structure as DeKalb. Sample BOC meeting has **75 agenda items** including:
- Call to Order, Roll Call, Invocation
- **Consent Agenda** with multiple items (contracts, grants, appointments)
- **PUBLIC HEARINGS** section
- **Public Comment** with full procedural rules
- County Manager's Items (by department: Open Government, Arts/Libraries, Health/Human Services, Justice/Safety)
- Commissioners' Action Items (resolutions, motions)
- Executive Session
- Board Appointments

### Public Comment Identification

**Clearly structured in agenda items:**
- `"Public Comment - Citizens are allowed to voice County related opinions, concerns, requests..."`
- Rules: 2 minutes per speaker, Fulton County residents/businesses prioritized
- First Regular Meeting: 60-minute limit
- Second Regular Meeting: 60-minute limit
- Zoom participation available
- Data includes speaker count and topics: e.g., "12 Speakers: [names and topics]" and "4 Zoom Speakers: [names and topics]"

### Meeting Volume (2025 Calendar Year)

**26 total meetings** — all Board of Commissioners:
- Twice monthly, mostly 2 per month
- Occasional 3rd meeting in January and August

**Average: 2.2 meetings/month**

### 2026 YTD (Jan-Mar)

5 meetings, all Board of Commissioners.

### Agenda Lead Time

**Average: 3.7 days** before meeting (range: 0-6 days)
- Tighter window than DeKalb, max 6 days ahead

### Future Calendar Horizon

**0 future meetings** published as of 2026-03-08. Fulton publishes meetings only 1-2 weeks in advance.

### Matters/Legislation API

Fully functional. Same schema as DeKalb. Rich data including:
- Commissioner District Board Appointments
- Contract approvals with dollar amounts
- Resolutions (e.g., ICE enforcement, affordable housing)
- Grant agreements

### Crawlability Verdict: EXCELLENT

Same quality as DeKalb. Lower volume (BOC only) but very rich agenda item data with vote outcomes, public comment records, and legislation detail. Note: Only 1 body tracked, so total volume is lower.

**Crawler approach:** Same as DeKalb — JSON API crawler, no auth required.

---

## 4. School Boards

### 4a. Atlanta Public Schools (APS)

| Attribute | Value |
|-----------|-------|
| Platform | **Simbli** (eboardsolutions.com) |
| Simbli ID | `S=36031014` |
| URL | `simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031014` |
| Meeting Frequency | Monthly (Board Meeting + Work Sessions/Committee meetings) |
| API Available? | **No public API** — Simbli is ASP.NET WebForms with Incapsula WAF |
| Agenda Format | Published on Simbli portal |
| Video | YouTube channel (@aboetv8227) |
| Public Comment | Via "Let's Talk!" portal |
| Contact | 404-802-3500 |

**Observed meeting types:** Board of Education Meeting, Board Meeting, Board Development Committee Meeting, Board Organizational Meeting

**Volume estimate:** ~4-6 meetings/month (regular + committee + work sessions)

**Crawlability verdict: DIFFICULT.** Simbli blocks automated access with Incapsula WAF. Options:
1. Browser-based crawler with Playwright (most reliable)
2. Scrape the APS website calendar page directly
3. YouTube video scraping for meeting dates (unreliable)

### 4b. DeKalb County Schools

| Attribute | Value |
|-----------|-------|
| Platform | **Simbli** (eboardsolutions.com) |
| Simbli ID | `S=4054` |
| URL | `simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=4054` |
| Meeting Frequency | Monthly (Regular + Work Sessions) |
| API Available? | **No** — Simbli with Incapsula WAF |
| Website | `dekalbschoolsga.org/board-of-education/board-meetings/` |

**Volume estimate:** ~3-4 meetings/month

**Crawlability verdict: DIFFICULT.** Same Simbli + Incapsula situation as APS.

### 4c. Fulton County Schools

| Attribute | Value |
|-----------|-------|
| Platform | **Simbli** (eboardsolutions.com), replaced BoardDocs in Jan 2025 |
| Simbli ID | `S=36031609` |
| URL | `simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031609` |
| Meeting Frequency | Monthly Work Sessions + Board Meetings |
| Work Session Location | North Learning Center, 450 Northridge Pkwy, Sandy Springs 30350 |
| Board Meeting Location | South Learning Center, 4025 Flat Shoals Rd, Union City 30291 |
| Work Session Schedule | 12:30pm Executive, 2pm Workshop, 4:30pm Agenda Review, 6pm Public Comment |
| Board Meeting Schedule | 4:30pm Executive Session, 6pm Meeting |
| API Available? | **No** — Simbli with Incapsula WAF |
| Calendar Downloads | 2025-26, 2026-27, 2027-28 board calendars available as PDFs |
| Video Archive | Available on website |

**Volume estimate:** ~2-4 meetings/month

**Crawlability verdict: MODERATE.** The district website (`fultonschools.org/fcs-board-of-education/meeting-calendar`) provides some meeting info and downloadable calendars. The Simbli portal blocks automated access. Best approach: scrape the FCS website meeting calendar page, supplement with downloadable PDF calendars for forward scheduling.

### School Board Summary

All three districts use **Simbli by eBoardSolutions**, which employs aggressive bot protection (Incapsula WAF). None offer public APIs. The most viable crawling approach for all three is a **Playwright browser-based crawler** that can handle the WAF challenge, or direct scraping of the school district websites' own meeting pages.

**Existing profiles:** Crawler profiles exist for all three (`atlanta-public-schools-board.yaml`, `dekalb-county-schools-board.yaml`, `fulton-county-schools-board.yaml`) targeting the district website pages, not Simbli. These are the right approach.

---

## 5. NPU Meetings

### Structure

Atlanta has **25 Neighborhood Planning Units**, designated A through Z (skipping U). Each represents a geographic cluster of neighborhoods within the City of Atlanta.

### How NPU Meetings Are Published

**There is no central machine-readable source.** NPU meeting information is scattered across:
1. **City of Atlanta website** (`atlantaga.gov/...neighborhood-planning-units`) — currently returning HTTP 403
2. **Individual NPU websites/social media** — many NPUs have their own websites, Facebook pages, or Nextdoor groups
3. **City Planner assignments** — each NPU has an assigned City of Atlanta Planner who attends monthly meetings

### Meeting Pattern

Every NPU meets **once per month**, typically on the same day/time each month (e.g., "third Monday at 7pm"). Meeting dates vary by NPU. That's 25 meetings/month if all NPUs meet.

### What NPUs Review

Per established guidelines:
- Rezoning applications
- Zoning variance requests
- Liquor license applications
- Land use changes
- Community concerns
- City policy input

### NPU List (25 units, A-Z minus U)

NPU-A through NPU-Z (excluding U). Each has elected leadership and covers specific Atlanta neighborhoods. The full mapping is available on the Atlanta city website (when accessible) and Wikipedia.

### Crawlability Verdict: NOT CURRENTLY CRAWLABLE

The city website blocks automated access. NPU meetings are not on Legistar. Meeting schedules are published through a patchwork of:
- City website calendar (blocked)
- Individual NPU communications
- City Planner notifications

**Best approach for HelpATL:**
1. **Seed as recurring events:** Create 25 recurring series (one per NPU) with known monthly meeting days/times. These are highly predictable.
2. **Manual enrichment:** Populate from city website when accessible, or from NPU leadership contacts
3. **Future automation:** If/when `atlantaga.gov` becomes accessible, scrape the NPU calendar pages

---

## 6. Cross-Cutting Analysis

### Legistar API Capabilities

| Endpoint | DeKalb | Fulton | Atlanta |
|----------|--------|--------|---------|
| `/events` | Yes | Yes | BROKEN |
| `/bodies` | Yes | Yes | BROKEN |
| `/events/{id}/eventitems` | Yes (rich) | Yes (rich) | BROKEN |
| `/matters` | Yes | Yes | BROKEN |
| OData filtering (`$filter`, `$top`, `$orderby`) | Yes | Yes | BROKEN |

### Agenda Item Detail

Both DeKalb and Fulton provide **individual agenda items** (motions, resolutions, appointments) with:
- Title and description
- Sequence number on agenda
- Consent agenda flag
- Vote outcome (Pass/Fail)
- Mover and seconder names
- Linked matter/legislation records
- Attached documents

This is sufficient to build a "what's being decided" feature showing upcoming votes and resolutions.

### Public Comment Identification

| Jurisdiction | Public Comment in Structured Data? | How Identified |
|-------------|-----------------------------------|----------------|
| DeKalb County | **Yes** | EventItemTitle = "COMMENTS FROM THE PUBLIC" (section C) |
| Fulton County | **Yes** | EventItemTitle contains "Public Comment" with full rules |
| Atlanta City | Unknown | API broken |
| School Boards | Unknown | Simbli blocked |
| NPUs | N/A | All NPU meetings inherently include public comment |

Both DeKalb and Fulton include procedural rules in the agenda item text (speaker time limits, sign-up procedures, residency requirements).

### Agenda Publication Lead Time

| Jurisdiction | Avg Lead Time | Range |
|-------------|---------------|-------|
| DeKalb County | 3.0 days | 0-13 days |
| Fulton County | 3.7 days | 0-6 days |

Agendas are typically available **3-4 business days before the meeting**. For a "what's coming up this week" feature, we'd need to crawl daily to catch newly published agendas.

### Calendar Horizon (How Far Ahead Meetings Are Scheduled)

Both DeKalb and Fulton only publish meetings **1-4 weeks in advance** in Legistar. For longer-range scheduling, we'd need to supplement with published annual calendars (PDFs) that most bodies publish at the start of each calendar year.

---

## 7. Monthly Meeting Volume Estimate

### Immediately Crawlable (Legistar API)

| Source | Meetings/Month | Public Comment? |
|--------|---------------|-----------------|
| DeKalb County (all bodies) | ~6 | Yes |
| Fulton County (BOC) | ~2 | Yes |
| **Subtotal** | **~8** | |

### Crawlable with Browser Automation

| Source | Meetings/Month | Notes |
|--------|---------------|-------|
| APS Board | ~4-6 | Simbli via Playwright |
| DeKalb Schools Board | ~3-4 | Simbli via Playwright |
| Fulton Schools Board | ~2-4 | Simbli via Playwright or website scrape |
| **Subtotal** | **~10-14** | |

### Requires Resolution of Platform Issues

| Source | Meetings/Month | Notes |
|--------|---------------|-------|
| Atlanta City Council + Committees | ~15-25 | Legistar API broken |
| NPU Meetings | ~25 | No central source |
| **Subtotal** | **~40-50** | |

### Total Potential

**~60-70 government meetings per month** across all metro Atlanta jurisdictions.

---

## 8. Recommendations for HelpATL Participate Mode

### Phase 1: Quick Wins (Week 1)

1. **Build Legistar API crawler** for DeKalb County and Fulton County
   - Shared crawler module since they use identical API schemas
   - Pull events + eventitems for each meeting
   - Map to HelpATL event model with civic-specific fields (body, agenda PDF, public comment flag)
   - Run daily to catch newly published agendas

2. **Seed NPU meetings as recurring events**
   - 25 manual entries, one per NPU, with known monthly schedule
   - Mark as `is_recurring: true` with monthly frequency
   - Add NPU letter, neighborhoods, and meeting location

### Phase 2: School Boards (Week 2-3)

3. **Playwright-based Simbli crawler** or **direct website scrapers**
   - Start with FCS (most accessible website)
   - APS and DCSD follow same pattern
   - Existing crawler profiles point to the right URLs

### Phase 3: Atlanta City (Requires External Action)

4. **Contact Granicus support** about the broken Atlanta Legistar API
   - Reference error: `LegistarConnectionString setting is not set up in InSite for client: atlanta`
   - This may be a known issue or require the City of Atlanta IT to act

5. **If Legistar stays broken:** Build a headless browser crawler for `atlanta.legistar.com` — the website may work with full JS rendering even though simple HTTP requests fail

### Data Model Additions

For civic meetings, each event should capture:
- `body_name` — which committee/board
- `agenda_pdf_url` — direct link to agenda document
- `has_public_comment` — boolean, derived from eventitems
- `public_comment_rules` — text (time limits, sign-up process)
- `matter_count` — number of items on the agenda
- `legistar_event_id` — for dedup and deep linking
- `meeting_type` — regular, special, zoning, work session
