# Hands On Atlanta / Golden Volunteer Platform Audit

**Date**: 2026-03-08
**URL**: https://volunteer.handsonatlanta.org
**Platform**: Golden Volunteer (goldenvolunteer.com)
**Organization ID**: `L5kJQOKdEl`

---

## 1. Platform Technical Profile

### Framework & Architecture
- **Framework**: Next.js (React) with server-side rendering
- **Build ID**: `G8yOQu6gGwKB32mVE0IId` (changes per deploy)
- **Rendering model**: Hybrid SSR + client-side data fetching
  - Page shell (config, partners, tags) is SSR'd in `__NEXT_DATA__`
  - Opportunity listings fetched client-side via XHR to `api2.goldenvolunteer.com`
  - Opportunity detail data fetched client-side via XHR to `api.goldenvolunteer.com`
- **CDN**: `cdn.goldenvolunteer.com` for images, `golden-prod.s3.amazonaws.com` for assets
- **Maps**: Google Maps API (embedded in map view + opportunity detail pages)
- **Auth**: Public API key embedded in `__NEXT_DATA__.props.apiKey` -- used as a request header (not query param) for API calls. Not a user auth token; it's a portal-level key.
- **Analytics**: Google Analytics 4 (`G-6M95KG5X6Q`)
- **Chat**: Tawk.to widget
- **Payments**: Stripe integration (live key present)

### API Surface

**List endpoint** (opportunities):
```
GET https://api2.goldenvolunteer.com/v1/opportunities/available
  ?offset=0
  &limit=25
  &view=list
  &locale=en
  &search=
  &dosFilterCriteria=include-dos
  &location[searchRadius]=20
  &minimumAvailability=0
  &requireGuestsAllowed=false
```

**Calendar/timeslot endpoint**:
```
GET https://api2.goldenvolunteer.com/v1/timeslot/available
  ?locale=en
  &dosFilterCriteria=include-dos
  &start=2026-03-08T05:00:00.000Z
  &end=2026-06-01T03:59:59.999Z
  &location[searchRadius]=20
  &minimumAvailability=0
  &requireGuestsAllowed=false
```

**Opportunity detail endpoint**:
```
GET https://api.goldenvolunteer.com/api/v1/opportunity/{opportunityId}
  ?locale=en
  &includeWaitlisted=true
```

**Note**: Two different API hosts -- `api2` for list/calendar, `api` for detail. Both require the portal API key in a request header (exact header name not confirmed -- blocked by CORS when calling from outside page context).

### Bot Protection
- **None detected.** No Cloudflare challenge, no CAPTCHA, no rate limiting observed.
- All pages load without any bot challenge.
- The API requires an API key header, but the key is publicly embedded in every page load.

---

## 2. Field Inventory

### List View (per opportunity card)
| Field | Always Present | Example |
|-------|---------------|---------|
| Title | Yes | "ATL Food Pantry Fridays with Another Chance of Atlanta" |
| Organization name | Yes | "Another Chance of Atlanta, Inc" |
| Organization link | Yes | `/organizations/org-da2SPjApnW` |
| Next date + time | Yes | "Fri, Mar 20, 2026: 1:15PM - 4:30PM EDT" |
| Additional dates count | Sometimes | "(+ 10 more)" |
| Location (city, state) | Yes | "Atlanta, GA" |
| Capacity | Yes | "6 Spots Available" |
| Rating | Sometimes | "Rating: 5.0" |
| Badge | Sometimes | "Recommended" |
| Image | Most (~80%) | CDN URL from `cdn.goldenvolunteer.com/images-prod/` |
| Opportunity ID | Yes | `1yHiOhv2Rt` (alphanumeric, 10 chars) |

### Detail View (opportunity page)
| Field | Fill Rate | Example |
|-------|-----------|---------|
| Title | 100% | Always present |
| Organization name + link | 100% | Links to org profile page |
| Description | ~70% | Free-text, 1-3 paragraphs |
| Purpose | ~50% | Short mission statement |
| Role | ~50% | What volunteers will do |
| Vibe | ~40% | Tone/atmosphere description |
| Eligibility | ~30% | "Ages: 21+" |
| Location (city, state, zip) | 100% | "Atlanta, GA 30318" |
| Exact address | Behind auth | "sign up to see exact location" |
| Google Map embed | When location set | Embedded Google Maps |
| Timeslots | 100% | Date + start/end time + timezone |
| Additional availabilities | When >1 slot | Dropdown: "10 Other Availabilities" |
| Rating | ~20% | Star rating (1-5) |
| Image (hero) | ~60% | Large hero image |
| Share button | 100% | "Share with Friends" |
| Sign-up form | 100% | Date selection + guest count |

### Organization Profile Page
| Field | Example |
|-------|---------|
| Organization name | "Open Hand Atlanta" |
| Rating (Opportunity Average) | 5 stars |
| EIN number | "58--1816778" |
| Description | Free text about the org |
| Website URL | "https://openhandatlanta.org/" |
| Upcoming opportunities | List of their active opportunities |

---

## 3. Volume Estimates

### Timeslot Counts (March 2026, unfiltered, 20-mile radius from Atlanta)
- **~851 timeslots** visible across 27 days in March
- **Average 32 timeslots/day** (weekdays higher, Sundays ~4-9)
- **Peak days**: 50-55 timeslots (Wednesdays/Thursdays)

### Unique Opportunity Estimate
Many opportunities have multiple recurring timeslots:
- Some have 1 date (one-off events)
- Some have 10-15 dates (weekly recurring)
- Some have 45-73 dates (daily recurring)

**Estimated unique opportunities**: 150-250 active at any given time

### Partner Organizations
- **5,198 partner organizations** listed in the platform config
- Most are corporate/school group partners (not nonprofits)
- Active posting orgs likely ~50-100 at any time

---

## 4. Cause Category Distribution (March 2026 timeslot counts)

| Category | Timeslots/Month | % of Total | Active Days |
|----------|----------------|------------|-------------|
| Hunger + Food Insecurity | 517 | 60.8% | 24 |
| Court Ordered Approved | 187 | 22.0% | 24 |
| Education | 154 | 18.1% | 19 |
| Civic + Community | 118 | 13.9% | 19 |
| Family Friendly | 109 | 12.8% | 17 |
| Environment + Sustainability | 78 | 9.2% | 16 |
| Health + Wellness | 26 | 3.1% | 7 |
| Youth + Family Services | 19 | 2.2% | 5 |
| Arts + Culture | 8 | 0.9% | 2 |
| Civil + Human Rights | 3 | 0.4% | 1 |
| Senior Services | 0 | 0% | 0 |
| LOVE Your Park | 0 | 0% | 0 |
| Virtual Opportunities | 0 | 0% | 0 |

**Note**: Categories overlap -- one opportunity can have multiple tags. The sum exceeds 100% because of multi-tagging. Hunger/food dominates massively (~61% of all timeslots).

### HelpATL Relevance Assessment
For the HelpATL civic volunteer portal, the most relevant categories are:
- **Hunger + Food Insecurity**: Huge volume, strong community action signal
- **Civic + Community**: Good volume, directly aligns with civic engagement
- **Environment + Sustainability**: Moderate, park cleanups and gardens
- **Education**: Moderate, after-school programs and tutoring
- **Family Friendly**: Cross-cutting tag, useful for filtering

Categories with zero or near-zero activity (Senior Services, LOVE Your Park, Virtual) suggest seasonal programs (LOVE Your Park likely activates for specific events).

---

## 5. Drop-in vs. Commitment Ratio

Based on 25 sampled opportunities from the default list view:

| Pattern | Count | % | Example |
|---------|-------|---|---------|
| **Recurring (10+ dates)** | 10 | 40% | "Food Pantry Volunteer" (74 dates), "Pick Up and Pitch In" (11 dates) |
| **Short series (2-9 dates)** | 8 | 32% | "Shop Welcome" (2 dates), "Donation Pickup" (3 dates) |
| **One-off (1 date)** | 7 | 28% | "Woodland Restoration at Deepdene Park", "Clean Up Crew" |

**Assessment**: ~72% of visible opportunities are recurring (have multiple scheduled dates). This is a strong signal -- most HOA volunteering is recurring commitment, not one-off events. However, volunteers sign up for individual timeslots, so each appearance IS a drop-in from the volunteer's perspective.

**Key insight for crawling**: The "opportunity" is the parent entity with a description/org/location, and "timeslots" are the individual date+time instances. We should model this as one event per opportunity (not one event per timeslot) with a recurring schedule.

---

## 6. Tags/Filters Available on Platform

### Primary Filters (sidebar)
1. **Search** -- free text search box
2. **Location** -- address/postal code with geocoding
3. **Distance** -- radius slider (default 20 miles, max unclear)
4. **Age Eligibility** -- numeric input for volunteer age
5. **Category Tags** -- 13 checkboxes (listed in Section 4)

### More Filters (modal)
6. **Guest-friendly** -- "Only show opportunities that allow guests" toggle
7. **Minimum spots** -- minimum available capacity threshold
8. **Availability matrix** -- 7 days x 3 time periods (Morning/Afternoon/Evening) checkbox grid

### View Modes
- **List view** -- paginated cards (25 per page, infinite scroll)
- **Calendar view** -- month/week/day views with event blocks
- **Map view** -- Google Maps with opportunity pins

### Opportunity Types (color-coded)
- **Open** (blue) -- publicly available
- **Recommended** (green) -- platform-suggested
- **Private** (yellow) -- requires account/invitation

---

## 7. Bot Protection Assessment

| Check | Result |
|-------|--------|
| Cloudflare | Not detected |
| reCAPTCHA | Not detected |
| hCaptcha | Not detected |
| Rate limiting | Not observed |
| Bot meta tags | None |
| robots.txt | Not checked |
| JavaScript challenge | None |
| Cookie requirement | Optional (cookie banner present, declining works) |
| API auth | Portal API key required in header (publicly available in page source) |

**Verdict**: No meaningful bot protection. The platform relies on the API key for access control, but that key is embedded in every public page load.

---

## 8. Partner Organization Data Structure

Partners are structured data embedded in `__NEXT_DATA__`:
```json
{
  "id": "0047HiYK0Q",
  "name": "Georgia Tech - 2024 Week of Service"
}
```

Organization profile pages provide richer data:
- Name, EIN, description, website, rating, upcoming opportunities
- URL pattern: `/organizations/org-{orgId}`

The 5,198 partners include a mix of:
- Corporate volunteer groups (MetLife, Georgia Tech)
- Nonprofits (Open Hand Atlanta, Piedmont Park Conservancy)
- Schools and universities
- Individual registrants ("Not Employed", personal names)

**For crawling**: The org data on opportunity cards is sufficient (name + link). We don't need to crawl org profile pages unless we want EIN/website/description for venue matching.

---

## 9. Sample Opportunity Data (10 examples)

### 1. ATL Food Pantry Fridays with Another Chance of Atlanta
- **ID**: `1yHiOhv2Rt`
- **Org**: Another Chance of Atlanta, Inc (`org-da2SPjApnW`)
- **Location**: Atlanta, GA 30336
- **Date**: Fri, Mar 20, 2026, 1:15PM-4:30PM EDT (+10 more)
- **Capacity**: 6 spots
- **Rating**: 5.0
- **Badge**: Recommended
- **Description**: Food distribution at warehouse in SW Atlanta, serves ~300 families/week
- **Purpose**: Help distribute food to local community
- **Role**: Pack food bags, assist registration, load vehicles, organize warehouse
- **Vibe**: Empower the community while having fun!

### 2. Woodland Restoration at Deepdene Park
- **ID**: `1JZA718fVl`
- **Org**: Olmsted Linear Park Alliance (`org-UKImVeXoG7`)
- **Location**: Atlanta, GA
- **Date**: Sat, Mar 21, 2026, 9:00AM-12:00PM EDT (1 date)
- **Capacity**: 10 spots
- **Badge**: Recommended
- **Description**: Remove non-native species (English ivy, privet, cherry laurel)
- **Purpose**: Enhance wildlife habitats and native plants
- **Role**: Small groups with park staff direction, light physical tasks

### 3. Pre-Shop Set Up | Shop Welcome
- **ID**: `KfmSb5USrx`
- **Org**: The Welcome Co-Op (`org-VmXKMIYMGa`)
- **Location**: Clarkston, GA
- **Date**: Fri, Apr 10, 2026, 6:00PM-8:00PM EDT (+1 more)
- **Capacity**: 4 spots
- **Badge**: Recommended

### 4. Food Pickup Helper - Mondays 7am-11am
- **ID**: `DQukMSalSR`
- **Org**: Giving Hands Food Pantry (`org-ZCMcd5nalw`)
- **Location**: Covington, GA
- **Date**: Mon, Mar 9, 2026, 7:00AM-11:00AM EDT (+1 more)
- **Capacity**: 1 spot

### 5. EARLY MORNING Pick Up and Pitch In for Piedmont Park (Mondays)
- **ID**: `vrxWTDRDre`
- **Org**: Piedmont Park Conservancy (`org-x6KrXLhYMe`)
- **Location**: Atlanta, GA
- **Date**: Mon, Mar 9, 2026, 7:30AM-9:00AM EDT (+10 more)
- **Capacity**: 1 spot

### 6. Volunteer Driver Needed for Donated Food Pickup
- **ID**: `8z2jODUbbm`
- **Org**: Stella Love Non-Profit (`org-2LqKH3K9GK`)
- **Location**: Roswell, GA
- **Date**: Mon, Mar 9, 2026, 8:00AM-11:00AM EDT (+45 more)
- **Capacity**: 1 spot

### 7. Meal Delivery to Seniors
- **ID**: `SrIBrGlHd6`
- **Org**: Open Hand Atlanta (`org-qnerALijoh`)
- **Location**: Atlanta, GA 30318
- **Date**: Mon, Mar 9, 2026, 10:00AM-1:00PM EDT (+10 more)
- **Capacity**: 9 spots
- **Description**: Deliver meals using own vehicle, average route 2-3 hours
- **Purpose**: Improve health outcomes through kindness and nutrition
- **Vibe**: City Cruising, fresh air, great smiles
- **Eligibility**: Ages 21+

### 8. Star-C After-School Enrichment @Flats at Mt. Zion
- **ID**: `hZHadtsvAJ`
- **Org**: Star-C Programs (`org-iiwcbrOAMq`)
- **Location**: Stockbridge, GA
- **Date**: Mon, Mar 9, 2026, 2:30PM-5:30PM EDT (+14 more)
- **Capacity**: 3 spots

### 9. Food Pantry Volunteer
- **ID**: `TOxKqSI10t`
- **Org**: Helping Hands of Paulding County, Inc. (`org-OXx6b21iDU`)
- **Location**: Dallas, GA
- **Date**: Mon, Mar 9, 2026, 8:30AM-3:30PM EDT (+73 more)
- **Capacity**: 4 spots
- **Rating**: 5.0

### 10. StreetWise Client Serving & Warehouse Prep Weekdays
- **ID**: `XASKejuDBB`
- **Org**: StreetWise Georgia Inc (`org-0QuCriS67x`)
- **Location**: Lawrenceville, GA
- **Date**: Mon, Mar 9, 2026, 9:00AM-2:00PM EDT (+3 more)
- **Capacity**: 10 spots
- **Rating**: 4.5

---

## 10. Crawlability Verdict

### Difficulty: **MEDIUM**

### Recommended Approach: **Playwright (headless browser)**

### Rationale

**Why not BeautifulSoup/requests**:
- Opportunity data is NOT in the SSR HTML or `__NEXT_DATA__`
- Data is fetched client-side via XHR after page load
- The API requires a portal-specific key sent as a request header
- API endpoints use two different hosts (`api.` vs `api2.`)

**Why not direct API**:
- The API key is publicly embedded, but the exact auth header name is not confirmed
- CORS restrictions prevent calling from outside the page origin
- Could reverse-engineer the header from JS bundles, but fragile if they rotate keys

**Why Playwright**:
- Page renders fully in ~3-4 seconds
- No bot protection to bypass
- List view shows 25 results per page with infinite scroll
- Opportunity detail pages are clean, well-structured HTML
- All data is in accessible DOM elements (no shadow DOM, no canvas)
- Calendar view provides timeslot counts for volume estimation
- Organization pages are publicly accessible

### Recommended Crawl Strategy

1. **List page scrape**: Load `/?view=list`, scroll to trigger all 25 results. Extract opportunity IDs, titles, orgs, dates, locations, capacity from cards.
2. **Pagination**: Change `offset` parameter or scroll to load next batch of 25.
3. **Detail page enrichment**: For each opportunity ID, load `/opportunities/{id}` and extract description, purpose, role, vibe, eligibility, exact location, all timeslots.
4. **Frequency**: Weekly crawl (opportunities change slowly, most are recurring).
5. **Volume**: ~200 detail page loads per crawl cycle -- very manageable.

### Alternative: API Reverse Engineering
If we can identify the exact auth header from the JS bundles, direct API calls would be faster:
- `GET api2.goldenvolunteer.com/v1/opportunities/available?offset=0&limit=100` for bulk listing
- `GET api.goldenvolunteer.com/api/v1/opportunity/{id}` for details
- Pagination via offset/limit is standard REST
- This would avoid Playwright entirely -- just `requests` with the right headers

**Recommendation**: Start with Playwright for reliability, investigate API header for optimization later.

### Data Mapping to LostCity Schema

| HOA Field | LostCity Field | Notes |
|-----------|---------------|-------|
| Title | `events.title` | Direct map |
| Org name | `sources.name` or `venues.name` | One source per org |
| Description | `events.description` | Concatenate description + purpose + role |
| Location (city, zip) | `venues.address` | Partial -- exact address behind auth |
| Next date + time | `events.start_time`, `events.end_time` | Per timeslot |
| Additional dates | Recurring event pattern | Model as recurring or create multiple events |
| Capacity | `events.metadata.capacity` | Custom field |
| Tags | `events.category` | Map HOA tags to LostCity categories |
| Image URL | `events.image_url` | CDN URL, stable |
| Opportunity ID | `events.source_ref` | Unique, alphanumeric |
| Org ID | `sources.source_ref` | For dedup |
| Rating | `events.metadata.rating` | Optional enrichment |

### Category Mapping

| HOA Tag | LostCity Category |
|---------|------------------|
| Hunger + Food Insecurity | `community` (subcategory: `volunteer_food`) |
| Environment + Sustainability | `community` (subcategory: `volunteer_environment`) |
| Education | `community` (subcategory: `volunteer_education`) |
| Civic + Community | `community` (subcategory: `volunteer_civic`) |
| Health + Wellness | `community` (subcategory: `volunteer_health`) |
| Youth + Family Services | `community` (subcategory: `volunteer_youth`) |
| Arts + Culture | `community` (subcategory: `volunteer_arts`) |
| Family Friendly | Tag/flag, not category |
| Court Ordered Approved | Tag/flag, not category |
| Senior Services | `community` (subcategory: `volunteer_seniors`) |

---

## 11. Key Risks & Considerations

1. **Location data is partial**: Exact street addresses are hidden behind signup. We get city + state + zip, which is enough for neighborhood-level mapping but not precise geocoding. The Google Map embed on detail pages shows approximate location.

2. **Metro Atlanta sprawl**: Default 20-mile radius captures opportunities in Covington, Dallas, Roswell, Lawrenceville -- well outside ITP. Need to filter by distance or zip code for HelpATL relevance.

3. **Hunger dominance**: 61% of all timeslots are food-related. Need to decide if we want to show all or curate a diverse mix.

4. **API key rotation risk**: If Golden Volunteer rotates the portal API key, the Playwright approach still works (scraping DOM). Direct API approach would break.

5. **No public total count**: The platform doesn't expose a total opportunity count. We have to infer from pagination or calendar aggregation.

6. **"Private" opportunities**: Some are marked Private (yellow badge) and only visible to logged-in users. We only see public/open/recommended.

7. **Vibe/Purpose fill rate**: Only ~40-50% of opportunities have these fields. Many are bare-bones (title + org + date + location only). This affects how rich the LostCity event cards would look.
