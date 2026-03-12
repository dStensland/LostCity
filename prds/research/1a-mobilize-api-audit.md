# Mobilize.us API Audit — Source Profile 1A

**Audited:** 2026-03-08
**API version:** v1 (public, unauthenticated)
**Scope:** Atlanta metro civic/advocacy events
**Verdict:** Medium difficulty | Recommended approach: API-based crawler with city filtering

---

## 1. API Endpoint Documentation

**Base URL:** `https://api.mobilize.us/v1`

### Primary endpoint
```
GET /v1/events
```
No authentication required for public events. Rate limit: 15 requests/second (GET).

### Supported query parameters (events)

| Parameter | Type | Description |
|-----------|------|-------------|
| `timeslot_start` | comparison filter | Filter by timeslot start time. Use `gte_now` for future events. Format: `gte_UNIXTIMESTAMP` or `gte_now`. |
| `state` | string | Two-letter state code, e.g., `GA`. Filters by event location. |
| `city` | string | City name. **Does NOT work as a true filter** — returns all state results regardless. See geo section. |
| `zipcode` | string | Zip code for geo filtering. Works correctly when combined with `radius`. |
| `radius` | int | Radius in miles from zipcode centroid. **This is the correct geo approach.** |
| `is_virtual` | bool | Filter to `false` for in-person only, `true` for virtual only. |
| `event_type` | string | Single event type enum value. Does NOT accept comma-separated lists. |
| `organization_id` | int | Filter to a specific organization's events. |
| `updated_since` | int | Unix timestamp — return only events modified after this time. |
| `per_page` | int | Results per page. Max tested: 200. Default: 25. |
| `page` | int | Page number for offset pagination. |
| `cursor` | string | Cursor-based pagination token (preferred by API). Returned in `next`/`previous` links. |

### Pagination response structure
```json
{
  "count": 302,
  "next": "https://api.mobilize.us/v1/events?cursor=XXX...",
  "previous": null,
  "results_limited_to": 1000,
  "data": [...],
  "metadata": {
    "url_name": "public_events",
    "build_commit": "...",
    "page_title": null
  }
}
```
`results_limited_to: 1000` means the endpoint caps at 1000 results per query regardless of `count`. For GA, count is 302 so this is not a concern today.

### Organization events endpoint (alternative)
```
GET /v1/organizations/:org_id/events
```
Useful for crawling events from specific known orgs (e.g., Georgia Youth Justice Coalition). Requires knowing org IDs in advance.

---

## 2. Full Field Inventory

### Event object

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | int | `915572` | Stable unique ID |
| `title` | string | `"IND Cobb - Lecture Series with Dr. Eric Castater"` | Always present |
| `summary` | string | `""` | Usually empty string (not null); rarely populated |
| `description` | string | `"Back by popular demand..."` | Markdown-formatted; quality varies. Core extraction field. |
| `event_type` | enum | `"MEETING"` | See full enum list below |
| `created_date` | int | `1772641996` | Unix timestamp |
| `modified_date` | int | `1772992819` | Unix timestamp. Use `updated_since` param to detect changes. |
| `timezone` | string | `"America/New_York"` | Always present for GA events |
| `browser_url` | string | `"https://www.mobilize.us/indivisiblecobb/event/915572/"` | Canonical event URL |
| `featured_image_url` | string | `"https://mobilizeamerica.imgix.net/..."` | 91% of events have an image. Imgix CDN, can request resized versions. |
| `is_virtual` | bool | `false` | Reliable virtual flag |
| `virtual_action_url` | string\|null | `null` | Zoom/action URL; present for virtual events that expose it |
| `visibility` | enum | `"PUBLIC"` | `PUBLIC` or `PRIVATE`. API only returns PUBLIC. |
| `address_visibility` | enum | `"PUBLIC"` | Can be `PUBLIC` or `PRIVATE`. Private = venue shows as "This event's address is private." |
| `accessibility_status` | enum | `"NOT_SURE"` | `ACCESSIBLE`, `NOT_ACCESSIBLE`, or `NOT_SURE` |
| `accessibility_notes` | string | `""` | Usually empty |
| `approval_status` | enum | `"APPROVED"` | Only `APPROVED` events appear in public feed |
| `high_priority` | bool\|null | `null` | Rarely set |
| `instructions` | string\|null | `null` | Post-signup instructions, never visible pre-RSVP |
| `contact` | object\|null | `null` | **Always null in public API** — contact info gated behind auth |
| `created_by_volunteer_host` | bool | `false` | True for distributed/volunteer-hosted events |
| `event_campaign` | object\|null | `null` | Campaign context; never populated in observed data |
| `tags` | array | `[{"id": 541, "name": "School Board"}]` | Freeform org-defined tags. 38% of events have at least one. |

### `location` object

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `venue` | string | `"Kirkwood Presbyterian Church"` | Venue name; sometimes empty for outdoors or private addresses |
| `address_lines` | array[2] | `["618 Acworth Due West Rd NW", ""]` | Street address. Second line usually empty. |
| `locality` | string | `"Kennesaw"` | City name. Reliable. |
| `region` | string | `"GA"` | State code |
| `country` | string | `"US"` | |
| `postal_code` | string | `"30152"` | Always present |
| `location.latitude` | float | `33.9700102` | Geocoded. Present even for virtual events (host's location). |
| `location.longitude` | float | `−84.6659817` | |
| `congressional_district` | string\|null | `"14"` | 72% of events have this. Useful for civic filtering. |
| `state_leg_district` | string\|null | `"34"` | State House district |
| `state_senate_district` | string\|null | `"37"` | State Senate district |

### `sponsor` (organization) object

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | int | `42562` | Stable org ID |
| `name` | string | `"Indivisible Cobb"` | Display name |
| `slug` | string | `"indivisiblecobb"` | URL-safe identifier. Used in `event_feed_url`. |
| `org_type` | enum | `"GRASSROOTS_GROUP"` | See org types below |
| `is_coordinated` | bool | `false` | Campaign finance flag |
| `is_independent` | bool | `true` | Opposite of `is_coordinated` |
| `is_nonelectoral` | bool | `false` | **Key field for LostCity.** True = civic/advocacy, False = electoral/partisan |
| `is_primary_campaign` | bool | `false` | |
| `race_type` | enum\|null | `null` | `GOVERNOR`, `CONGRESSIONAL`, `SENATE`, `STATE_SENATE`, `STATE_LEG`, etc. Null if not a campaign. |
| `state` | string | `""` | Org's home state. Often empty. |
| `district` | string | `""` | |
| `candidate_name` | string | `""` | Populated for CAMPAIGNs |
| `logo_url` | string | `"https://..."` | Org logo. Often empty for small groups. |
| `event_feed_url` | string | `"https://www.mobilize.us/indivisiblecobb/"` | Org's public event page |
| `created_date` | int | `1746557613` | Unix timestamp |
| `modified_date` | int | `1772994259` | |

### `timeslots` array (each timeslot)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | int | `5849510` | Unique timeslot ID |
| `start_date` | int | `1773007200` | Unix timestamp |
| `end_date` | int | `1773014400` | Unix timestamp |
| `instructions` | string\|null | `null` | |
| `is_full` | bool | `false` | True if timeslot is at capacity |

**Critical:** Events often have multiple timeslots (average 4.6 per event for GA). A CANVASS event might have 10 shifts. Each timeslot is a separate occurrence. The crawler must decide: emit one event per timeslot, or one event with multiple dates. Recommendation: emit one event per event ID (not per timeslot), using the earliest upcoming timeslot as `start_date`.

### Event type enum (complete list)

```
CANVASS, PHONE_BANK, TEXT_BANK, MEETING, COMMUNITY, FUNDRAISER, OTHER,
MEET_GREET, HOUSE_PARTY, VOTER_REG, TRAINING, FRIEND_TO_FRIEND_OUTREACH,
ADVOCACY_CALL, DEBATE_WATCH_PARTY, RALLY, TOWN_HALL, OFFICE_OPENING,
BARNSTORM, SOLIDARITY_EVENT, COMMUNITY_CANVASS, SIGNATURE_GATHERING,
CARPOOL, WORKSHOP, PETITION, AUTOMATED_PHONE_BANK, LETTER_WRITING,
LITERATURE_DROP_OFF, VISIBILITY_EVENT, PLEDGE, INTEREST_FORM,
DONATION_CAMPAIGN, SOCIAL_MEDIA_CAMPAIGN, POSTCARD_WRITING, GROUP,
VOLUNTEER_SHIFT, ADVOCACY, RELATIONAL, DATA_ENTRY, POLL_MONITORING,
HOTLINE, VOTER_PROTECTION
```

### Org type enum (observed)
`PARTY_COMMITTEE`, `GRASSROOTS_GROUP`, `C4`, `C3`, `CAMPAIGN`, `PAC`, `UNION`, `GOVERNMENT`, `OTHER`, `COORDINATED`, `INDEPENDENT`

---

## 3. Volume Counts

### Georgia statewide (as of 2026-03-08)

| Metric | Count |
|--------|-------|
| Total public future events | 302 |
| In-person | 275 (91%) |
| Virtual | 27 (9%) |
| With tags | 115 (38%) |
| With featured image | 275 (91%) |
| Electoral/partisan | 265 (88%) |
| Nonelectoral/civic | 37 (12%) |

### Atlanta metro scope

Using 24 metro cities (Atlanta + Decatur, Marietta, Smyrna, Kennesaw, Woodstock, Marietta, Roswell, Alpharetta, Duluth, Lawrenceville, Stone Mountain, Suwanee, Sandy Springs, Johns Creek, Dunwoody, Tucker, Chamblee, College Park, East Point, Doraville, Peachtree City, Norcross, Clarkston):

| Metric | Count |
|--------|-------|
| In-person metro events | ~125 of 275 (45%) |
| Atlanta city proper (in-person) | ~36 |

### By event type (all 302 GA events)

| Type | Count | LostCity Relevant? |
|------|-------|--------------------|
| MEETING | 88 | Yes (public meetings, board meetings) |
| COMMUNITY | 54 | Yes (primary target) |
| RALLY | 39 | Yes |
| VISIBILITY_EVENT | 30 | Yes (protests, vigils) |
| CANVASS | 16 | No (electoral operations) |
| OTHER | 15 | Partial |
| MEET_GREET | 13 | Yes (candidate/community meet-greets) |
| TRAINING | 10 | Partial (know-your-rights training = yes) |
| FRIEND_TO_FRIEND_OUTREACH | 7 | No (internal) |
| WORKSHOP | 6 | Yes |
| TOWN_HALL | 5 | Yes |
| RELATIONAL | 4 | No (internal organizing) |
| COMMUNITY_CANVASS | 4 | No |
| PHONE_BANK | 3 | No |
| FUNDRAISER | 3 | Partial |
| VOTER_REG | 2 | Yes |
| SOLIDARITY_EVENT | 1 | Yes |
| DEBATE_WATCH_PARTY | 1 | Yes |
| POSTCARD_WRITING | 1 | No |

**Truly public-facing types for LostCity:** COMMUNITY, RALLY, VISIBILITY_EVENT, MEETING (public meetings), WORKSHOP, TOWN_HALL, SOLIDARITY_EVENT, DEBATE_WATCH_PARTY, FUNDRAISER, MEET_GREET, VOTER_REG = **~220 of 302 GA events (73%)**.

---

## 4. Cause/Tag Analysis

### Built-in tags (org-defined, freeform)

Top tags across all 302 GA events:

| Tag | Count |
|-----|-------|
| Nk3 (No Kings 3.0 campaign) | 41 |
| National | 11 |
| School Board | 10 |
| Community Event | 10 |
| Public Comment | 9 |
| Youth Led | 9 |
| Get out the Vote | 6 |
| Black community | 6 |
| LGBTQ+ | 5 |
| Education | 3 |
| Latinx community | 3 |
| Lobby Day | 2 |
| Healthcare | 2 |
| Interfaith | 2 |
| Voting rights | 1 |
| Community Outreach | 1 |
| Women's Health | 1 |
| Jobs and the economy | 1 |

Tags are freeform, inconsistently applied, and org-specific. They are useful signals but cannot be relied on as a canonical taxonomy. `event_campaign` field is never populated in observed public data.

### Cause inference from description text

Keyword classification across 142 Atlanta metro events:

| Cause | Events | Notes |
|-------|--------|-------|
| Voting rights / elections | 39 (27%) | Reliable via keywords: "voter", "registr", "ballot", "GOTV" |
| Immigration / ICE | 38 (27%) | Very salient right now; reliable keywords |
| Education / school board | 23 (16%) | Reliable; board meeting events highly structured |
| Racial equity | 20 (14%) | Keyword match may overcount; multi-cause events |
| Housing | 19 (13%) | Some false positives from broad "affordable" keyword |
| LGBTQ | 18 (13%) | Reliable; clean keyword set |
| Transit | 16 (11%) | Mostly transportation keywords in general civic description text |
| Healthcare | 9 (6%) | |
| Environment | 7 (5%) | |
| General civic (unclassified) | 44 (31%) | No cause keyword match |

**Assessment:** Cause inference from description text is feasible and reasonably accurate for the major categories. Roughly 70% of events can be confidently tagged with at least one cause. Claude extraction would handle ambiguous cases well. The main failure mode is multi-cause events where a single "Liberty and Justice for ALL" rally touches 7 different issues — those need to be top-level tagged as "civic_action" with secondary cause tags.

---

## 5. Sample Events (10 Atlanta Events)

| # | Title | Org | Type | Date | Venue | Cause |
|---|-------|-----|------|------|-------|-------|
| 1 | Young People's Hearing | Georgia Youth Justice Coalition (C4) | WORKSHOP | 2026-03-11 18:00 | Atlanta City Hall | Education, Housing, Healthcare |
| 2 | Fulton County Board of Registrations Meeting | Common Cause (C4) | OTHER | 2026-03-12 11:00 | Fulton County Govt Center | Voting Rights |
| 3 | Pride to the Capitol 2026 | HRC in Georgia (C4) | COMMUNITY | 2026-03-10 08:00 | Georgia State Capitol | LGBTQ, Civic Action |
| 4 | Testimony Tuesdays | HRC in Georgia (C4) | SOLIDARITY_EVENT | 2026-03-10 12:00 | Central Presbyterian Church | Healthcare, LGBTQ |
| 5 | No Kings 3 - Bridge Banner Brigade | Indivisible ATL | RALLY | 2026-03-21 10:30 | 17th & I-75 | General Civic |
| 6 | Hands Off Africa March and Rally | Indivisible ATL | RALLY | 2026-03-22 14:30 | TBD, Atlanta | Racial Equity |
| 7 | NO KINGS Atlanta | 50501 Georgia (C4) | RALLY | 2026-03-28 12:00 | Atlanta | General Civic |
| 8 | IWR Member Meeting | Intown Womens Resistance | MEETING | 2026-03-19 18:30 | Manuel's Tavern - Meeting Room | General Civic |
| 9 | Knock Doors with GYJC in Atlanta | GA Youth Justice Coalition | CANVASS | 2026-03-28 10:00 | Atlanta | Education |
| 10 | TRIVIYAAAS with HRC and Lore | HRC in Georgia (C4) | COMMUNITY | 2026-03-18 20:00 | Lore (bar), Atlanta | LGBTQ, Community |

---

## 6. Geo Filtering Assessment

**The `city` param is broken for filtering.** When passing `city=Atlanta&state=GA`, the API returns 302 events — the same total as `state=GA` alone. The city parameter appears to be ignored or has no effect on results.

**The correct geo approach is `zipcode` + `radius`:**
- `zipcode=30303&radius=15` returns 29 events, all in Atlanta city proper.
- `zipcode=30303&radius=20` returns 29 events (Atlanta city + close suburbs).
- `zipcode=30303&radius=25` also returns 29 (the Atlanta-proper supply saturates before 25 miles).

**Lat/lon + radius does not work.** `latitude=33.749&longitude=-84.388&radius=25` returns 10,837 results including cities nationwide — the radius filter appears to behave as a national radius or is non-functional with lat/lon.

**Recommended approach for Atlanta crawler:**
1. Fetch `state=GA` with `per_page=100` (3 pages for current 302 events).
2. Filter results in Python by `location.locality` against a defined Atlanta metro city list.
3. This captures ~125 in-person metro events vs. ~29 from the zipcode approach, without missing suburbs.

**Alternative:** Use `zipcode=30303&radius=30` to catch the core city + immediate suburbs, then supplement with known metro zip codes (30301-30395 range) to catch Marietta, Decatur, etc. But this requires many API calls. The `state=GA` approach is simpler and the total volume (302) is small enough to paginate completely.

---

## 7. Organization Structure

Organizations are the top-level entities. Key fields for LostCity's purposes:

- **`is_nonelectoral`**: The single most useful filter for civic vs. political events. Only 37/302 current events come from `is_nonelectoral=True` orgs. This is a significant finding — most Mobilize events in Georgia right now are partisan/electoral.
- **`org_type`**: `C4` and `C3` orgs are civic advocacy nonprofits (the most relevant for HelpATL/civic portals). `GRASSROOTS_GROUP` orgs are mixed — some purely civic, some partisan progressive groups.
- **`is_coordinated`**: True = coordinated with a party campaign. These are the most electoral.

### Atlanta civic org inventory (from observed data)

| Org | Type | Notes |
|-----|------|-------|
| Georgia Youth Justice Coalition for Action | C4 | School board meetings, youth advocacy. High event volume. |
| HRC in Georgia | C4 | LGBTQ advocacy. Mix of lobby days and community events. |
| Common Cause | C4 | Election integrity, board of elections meetings. |
| Showing Up for Racial Justice (SURJ) | C4 | Racial equity organizing. |
| Indivisible ATL | GRASSROOTS_GROUP | Rallies, protests. Very active right now. |
| Intown Womens Resistance | GRASSROOTS_GROUP | Meetings, postcard events. |
| AFSC (American Friends Service Committee) | C3 | Quaker peace/justice org. |
| Necessary Trouble | GRASSROOTS_GROUP | Volunteer/community events. |

---

## 8. Virtual/Hybrid Events

27 virtual events in GA (9% of total). Key observations:

- Virtual events still have a `location` object with lat/lon — this reflects the host's location, not where attendees connect from. Cannot be used to infer "Atlanta" scope.
- `virtual_action_url` is null in all observed public events — the action URL is gated behind RSVP/auth.
- For LostCity purposes, virtual events from GA-based orgs are borderline relevant. A virtual town hall by Common Cause GA on Georgia voting rights is still relevant to Atlanta civic life. A virtual phone bank is not.
- Recommendation: Exclude `is_virtual=true` events by default; optionally include virtual events from `C3`/`C4`/`GRASSROOTS_GROUP` orgs with Georgia location.

---

## 9. Crawlability Assessment

**Verdict: EASY**

### What works well
- Fully public REST API, no authentication, no JavaScript rendering required.
- Stable JSON structure. Consistent field names.
- `modified_date` + `updated_since` param enables efficient incremental crawls (only fetch changed events).
- Rate limit (15 req/s) is generous. Full GA dataset (3 pages) fetches in under 1 second.
- Lat/lon in location enables distance calculations in Python.
- `browser_url` provides canonical event links.
- Images available via Imgix CDN (can request resized versions by modifying URL params).

### Challenges
- **Primarily electoral/partisan content.** 88% of events are from party committees, campaigns, or partisan grassroots groups. For the HelpATL civic portal specifically, only 12% (37 events statewide) qualify as strictly nonelectoral.
- **Multi-timeslot complexity.** Average 4.6 timeslots per event. Must decide how to handle recurring/multi-shift events. Recommend: one event record using earliest upcoming timeslot, with `description` noting additional dates.
- **Private addresses.** 21% of events have `address_visibility=PRIVATE`, which means the venue string shows "This event's address is private." These cannot be mapped or matched to a venue. Expose in feed but without map/directions.
- **Sparse tags.** Only 38% of events have tags; the tags are org-defined freeform strings with no normalization. Cause tags require inference from description text.
- **City filter broken.** Must use state filter + Python city filtering, or zipcode + radius approach.
- **Volume is modest.** 36 Atlanta-city in-person events right now. Even including metro, 125 events. This is a smaller source than Eventbrite or Ticketmaster, but uniquely covers civic/advocacy content no other source has.

### Recommended crawler approach

```python
# Strategy: state=GA filter, paginate all results, filter by metro city list in Python.
# Incremental: use updated_since for subsequent runs.

BASE_URL = "https://api.mobilize.us/v1/events"
PARAMS = {
    "state": "GA",
    "timeslot_start": "gte_now",
    "per_page": 100,
    "is_virtual": False,  # in-person only; reconsider for civic orgs
}

# In Python post-filter:
ATLANTA_METRO_CITIES = {
    "Atlanta", "Decatur", "Smyrna", "Marietta", "Sandy Springs",
    "Roswell", "Kennesaw", "Woodstock", "Acworth", "Alpharetta",
    "Duluth", "Lawrenceville", "Stone Mountain", "Suwanee",
    "Johns Creek", "Dunwoody", "Tucker", "Chamblee", "College Park",
    "East Point", "Doraville", "Norcross", "Clarkston",
}

# Event type exclude list (non-public-facing):
EXCLUDE_TYPES = {
    "PHONE_BANK", "TEXT_BANK", "AUTOMATED_PHONE_BANK", "DATA_ENTRY",
    "POLL_MONITORING", "HOTLINE", "LETTER_WRITING", "POSTCARD_WRITING",
    "PETITION", "PLEDGE", "INTEREST_FORM", "DONATION_CAMPAIGN",
    "SOCIAL_MEDIA_CAMPAIGN", "RELATIONAL", "FRIEND_TO_FRIEND_OUTREACH",
    "LITERATURE_DROP_OFF", "CARPOOL",
}
```

**Category mapping:**
- `COMMUNITY`, `SOLIDARITY_EVENT`, `VISIBILITY_EVENT` → `community` or `civic_action`
- `RALLY` → `civic_action`
- `MEETING`, `TOWN_HALL` → `civic_action` (with sub-tag `public_meeting`)
- `WORKSHOP`, `TRAINING` → `community` or `civic_action`
- `FUNDRAISER`, `MEET_GREET`, `DEBATE_WATCH_PARTY` → `community`
- `VOTER_REG` → `civic_action`

**Cause tag inference:** Run Claude extraction on `title + description + tags` to assign cause tags from: `{education, housing, transit, healthcare, immigration, lgbtq, racial_equity, environment, voting_rights, public_safety}`.

---

## 10. Strategic Assessment for LostCity

**Is this worth building?** Yes, but with calibrated expectations.

**What it uniquely provides:**
- School board meetings, public hearings, city government meetings — content no venue-based crawler produces
- Rallies, lobby days, and advocacy events that are genuinely "things happening in the city" worth knowing about
- Organizations like Georgia Youth Justice Coalition and Common Cause that consistently produce relevant civic content

**What it does not provide (and is a common misconception):**
- Most Mobilize events are partisan political operations (phone banks, canvassing, postcard writing). These are not "city happenings" for a general or hotel audience. Filtering is essential.
- The HelpATL civic portal is the primary use case. For the main Atlanta consumer feed or the FORTH Hotel portal, Mobilize events are niche — maybe 20-30 genuinely relevant events/month.

**Multi-city reusability:** The same crawler pattern works for any city — change `state=GA` to `state=TN` for Nashville, add Nashville metro cities to the filter list. The API structure is identical nationwide.

**Recommended portal assignment:**
- Primary: HelpATL civic portal (all civic types, explicit `is_nonelectoral` filter optional)
- Secondary: Main Atlanta feed (RALLY, TOWN_HALL, COMMUNITY, SOLIDARITY_EVENT only, strict metro filter)
- Exclude: FORTH Hotel portal (too niche/partisan for hospitality use case)
