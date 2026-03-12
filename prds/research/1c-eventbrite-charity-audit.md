# Research: Eventbrite Charity & Causes — Atlanta Coverage Audit

**Date:** 2026-03-08  
**Purpose:** Assess whether adding the Eventbrite Charity & Causes category to our Atlanta crawler is worth the effort, and document the required changes.

---

## Current Crawler Implementation

We have two Eventbrite crawlers:

- `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py` — Atlanta metro
- `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite_nashville.py` — Nashville

Both use a **hybrid pattern**: Playwright browses category-filtered listing pages to collect event IDs via regex on `href` attributes (`/e/...-{event_id}`), then the Eventbrite REST API (`https://www.eventbriteapi.com/v3/events/{id}/`) fetches structured data with `expand=venue,organizer,category,format,ticket_availability`.

The Atlanta crawler currently browses four category URLs:

```
https://www.eventbrite.com/d/ga--atlanta/all-events/
https://www.eventbrite.com/d/ga--atlanta/food-and-drink/
https://www.eventbrite.com/d/ga--atlanta/classes/
https://www.eventbrite.com/d/ga--atlanta/hobbies/
```

The "Charity & Causes" URL is **not** in `BROWSE_URLS`. The `CATEGORY_MAP` already includes an entry for this Eventbrite category: `"Charity & Causes": ("community", ["volunteer"])`.

Key quality mechanisms:

- **GA region filter**: Events with venue addresses outside `GA` or `Georgia` are dropped in `process_event()`.
- **Content hash dedup**: `generate_content_hash(title, venue_name, start_date)` catches re-crawled events.
- **Description enrichment**: Short descriptions are expanded with FAQ-based content from the detail page.
- **Price handling**: Eventbrite's `is_free` flag is used; actual price tiers are not extracted (set to `"See Eventbrite"` note).

---

## Eventbrite Charity & Causes — Atlanta Data Profile

**Methodology:** Downloaded 4 pages (80 events) from `https://www.eventbrite.com/d/ga--atlanta/charity-and-causes/` on 2026-03-08. Extracted structured data from the `window.__SERVER_DATA__` JSON payload.

**Volume:** Eventbrite reports **429 events across 22 pages** for this search as of the audit date.

### Format Breakdown (80-event sample)

| Format | Count | % |
|--------|-------|---|
| Dinner or Gala | 20 | 25% |
| Race or Endurance Event | 15 | 19% |
| Party or Social Gathering | 12 | 15% |
| Meeting or Networking Event | 7 | 9% |
| Seminar or Talk | 6 | 8% |
| Class, Training, or Workshop | 6 | 8% |
| Other | 5 | 6% |
| Tournament | 4 | 5% |
| Conference | 3 | 4% |
| Concert or Performance | 1 | 1% |
| Game or Competition | 1 | 1% |

### Subcategory Breakdown (80-event sample)

| Subcategory | Count | % |
|-------------|-------|---|
| Other | 20 | 25% |
| Education | 13 | 16% |
| Running | 11 | 14% |
| Poverty | 8 | 10% |
| Healthcare | 7 | 9% |
| Human Rights | 6 | 8% |
| Animal Welfare | 6 | 8% |
| Environment | 3 | 4% |
| Career | 1 | 1% |
| Mental Health | 1 | 1% |

### Pricing

**0 of 80 events are free.** Every event in the sample had a ticket price or donation amount. This category skews almost entirely paid, even for events that may be low-cost.

---

## Content Mix Analysis

### Fundraiser Galas / Benefit Events (~48%)

The dominant event type. These are Black-tie galas, scholarship luncheons, banquets, and benefit concerts organized by nonprofits to raise money. Examples from the sample:

- "NBCFAE Atlanta Chapter's 7th Annual Casino Night Scholarship Fundraiser"
- "2026 ACE Mentor of Atlanta Banquet"
- "Art Jazz Gala"
- "The Dr. Alieka Anderson - Henry Foundation Inaugural Chairwoman's Ball"
- "Autism Awareness Sunday's Best Fundraiser Luncheon"

These are **technically public** (anyone can buy a ticket on Eventbrite) but are niche. A hotel guest would have little use for them. A HelpATL user might find them relevant as community events. Signal quality is moderate — real events, real venues, but narrow audience.

### Virtual / National 5K Races (~14%)

A significant noise source. These are national virtual race operators (e.g., "We Lost Our Cents 1 Mile Virtual Race", "2026 International Women's Day 1M, 5K, 10K, 13.1, 26.2") that bill themselves as Atlanta-associated but have no physical Atlanta venue. They flood the charity category via organizer tags.

**The existing GA venue region filter in `process_event()` will catch most of these.** Virtual/online events with no physical venue will produce `venue_id = None` rather than being filtered directly, but they also lack a venue region field, so they pass through as venue=TBA events (which we accept). This is a gap.

### Workshops, Classes, Training (~16%)

CPR/First Aid classes (Red Cross), professional development seminars, advocacy training. These are legitimate, genuinely public, and high-quality. Examples:

- "Red Cross Adult & Pediatric First Aid/CPR/AED class in Marietta"
- "Root Cause Analysis & Problem-Solving: 1 Day Training in Atlanta, GA"
- "Beyond the Code: Identity, Income & Impact in Social Work"
- "From Silence to Support: A Conversation on Suicide Prevention"

This is the highest-quality slice of the category. These events have clear times, real venues, public registration, and serve a real user need.

### Volunteer / Service Events (~6%)

Events where people show up to do something (cleanup days, volunteer orientations, food distribution). Examples:

- "Hashtag Lunchbag ATL: March Service Event"
- "B Local Georgia Castleberry Hill Cleanup Day"
- "ROHA - HUB VOLUNTEERS"
- "CALLING ALL VOLUNTEERS"
- "Restoring One's Hope of Atlanta, Inc: Feed the Hungry (Saturdays)"

**High overlap risk** with our direct volunteer-org crawlers. See overlap assessment below.

### Advocacy / Awareness Events (~8%)

Panels, talks, awareness days, and community forums. Examples:

- "An Evening with Robin Greenfield, Activist and Forager"
- "Alopecian Beauty Co Day at the Georgia Capitol"
- "PACC Presents 2nd Annual Advocacy Bash"

Moderate quality. Many are single-org events that may already be covered by direct crawlers (e.g., `aclu_georgia.py`, `indivisible_atl.py`).

### Animal Adoption Events (~8%)

PetSmart adoption events hosted by Lifeline Animal Project and PAWS Atlanta, plus independent rescue events. **Directly covered by `lifeline_animal_project.py` and `paws_atlanta.py`.**

---

## Overlap Risk Assessment

### High overlap: Direct nonprofit crawlers

We have a substantial nonprofit/volunteer/cause crawler inventory. Spot-checking the 80-event sample against known source files:

| Eventbrite Event | Our Direct Crawler |
|---|---|
| PanCAN PurpleStride Atlanta 2026 | `pancan_atlanta.py` |
| Fiercely Protect Our Mascot: Tigers United × Zoo Atlanta | `zoo_atlanta.py` |
| PetSmart Dog Adoption Events (x3) | `lifeline_animal_project.py` |
| Paws & Paths: An Adoption Event | `paws_atlanta.py` |
| Hashtag Lunchbag ATL | `hands_on_atlanta.py` |
| ROHA Community Fair / HUB Volunteers | `lake_claire_land_trust.py` |
| Making Strides Against Breast Cancer | `acs_georgia.py` or `komen_atlanta.py` |
| HMHBGA's Inspiring Mothers Luncheon | `healthy_mothers_ga.py` |
| B Local Georgia Castleberry Hill Cleanup | `keep_atlanta_beautiful.py` |

Estimated **10-15% of Eventbrite Charity events are duplicates** our content hash dedup will catch. This is not a bug — dedup handles it — but it means the actual net-new yield is lower than the 429 headline number.

### Mobilize overlap

The `mobilize.py` and `mobilize_api.py` crawlers cover volunteer/advocacy organizations that use Mobilize.us for event management. Mobilize organizers **do not typically cross-post to Eventbrite** — they are separate platforms. Overlap here is low (maybe 2-3%).

### HOA / neighborhood events

Civic/neighborhood crawlers (`ansley_park_civic.py`, `morningside_civic.py`, etc.) do not overlap with Eventbrite. HOAs use their own websites or Nextdoor, not Eventbrite. Overlap is negligible.

---

## Volume Estimate

| Segment | Count (est.) | Notes |
|---|---|---|
| Total Eventbrite Charity (Atlanta) | 429 | Per Eventbrite's pagination as of 2026-03-08 |
| Filtered by GA venue check | ~60 | Virtual races, national events with no GA venue |
| Duplicate with direct crawlers | ~51 | Content hash catches these |
| Net unique events ingested | ~318 | |
| Galas / private fundraisers (niche) | ~150 | Public tickets but narrow audience |
| High-quality net-new events | ~150-170 | Workshops, advocacy, community events, genuine walk/runs |

These numbers refresh each crawl cycle. At ~350 net events per run with a bi-weekly crawl schedule, this adds roughly 150-170 genuinely useful events per cycle to the Atlanta catalog.

---

## Recommended Crawler Modification

**Effort level: Config change only. No new crawler logic required.**

### Change 1: Add the charity-and-causes browse URL

In `crawlers/sources/eventbrite.py`, add one URL to `BROWSE_URLS`:

```python
BROWSE_URLS = [
    "https://www.eventbrite.com/d/ga--atlanta/all-events/",
    "https://www.eventbrite.com/d/ga--atlanta/food-and-drink/",
    "https://www.eventbrite.com/d/ga--atlanta/classes/",
    "https://www.eventbrite.com/d/ga--atlanta/hobbies/",
    "https://www.eventbrite.com/d/ga--atlanta/charity-and-causes/",  # ADD THIS
]
```

The existing `CATEGORY_MAP` already maps `"Charity & Causes"` to `("community", ["volunteer"])`. Category tagging works as-is.

### Change 2: Filter virtual/online events explicitly

The current `process_event()` drops events where the venue region is not GA. However, virtual race events may have no venue set at all, slipping through as `venue_id=None` with no region check. Add a filter for Eventbrite's `is_online_event` flag:

```python
# In process_event(), after extracting event_data:
if event_data.get("is_online_event", False):
    logger.debug(f"Skipping online-only event: {title}")
    return None
```

This stops virtual 5K races and online-only events from entering the Atlanta catalog regardless of their organizer tags.

### Change 3: Improve genre tagging for charity subcategory

The current mapping assigns `["volunteer"]` as the genre for all Charity & Causes events. Most galas and fundraisers are not volunteer events. Add subcategory-aware genre assignment:

```python
# In process_event(), after extracting category and subcategory:
category_data = event_data.get("category") or {}
category_name = category_data.get("name") if category_data else None

# Get sub_category for finer genre assignment
sub_category_data = event_data.get("subcategory") or {}
sub_category_name = sub_category_data.get("name") if sub_category_data else None

if category_name == "Charity & Causes":
    CHARITY_SUBCAT_GENRES = {
        "Running": ["5k", "run"],
        "Animal Welfare": ["animals"],
        "Environment": ["environment"],
        "Human Rights": ["activism"],
        "Healthcare": ["health"],
        "Education": ["education"],
    }
    genres = CHARITY_SUBCAT_GENRES.get(sub_category_name, ["charity"])
else:
    category, genres = get_category(category_name)
```

Note: The Eventbrite API's `expand=` parameter does not include `subcategory` by default. You'd need to add `subcategory` to the expand list, or use the `sub_category_id` from the tag data available on the listing page. This is a nice-to-have, not a blocker.

---

## Effort Estimate

| Task | Effort |
|---|---|
| Add charity browse URL to BROWSE_URLS | 2 minutes |
| Add `is_online_event` filter | 5 minutes |
| (Optional) Subcategory genre mapping | 30 minutes including API testing |
| Validation query to confirm ingestion | 5 minutes |

**Total: 10 minutes for the core change.** The optional genre improvement is 30 minutes.

This is genuinely a config change with one small quality guard. The existing pipeline handles everything else correctly.

---

## Verdict

Add the URL. The change is trivial, the dedup system handles overlaps cleanly, and ~150 net-new events per cycle from a category with real user demand (community events, fundraisers, service events) is a solid return on 10 minutes of work.

The category is not a high-priority gap — we have substantial direct nonprofit coverage already, and galas are niche. But for HelpATL in particular, this category is a direct fit. It is also relevant for any hotel portal where guests might want to attend a charity event during their stay.

The only real risk is virtual race pollution, which the `is_online_event` filter eliminates before it reaches the DB.

**Do not** attempt to crawl the Eventbrite Charity category as a standalone new source/crawler. One URL addition to the existing Atlanta crawler is the correct approach.

---

## Validation Query

After adding the URL and running a crawl cycle, confirm intake:

```sql
-- Events added from Eventbrite with community category (post-charity URL addition)
SELECT 
    e.title,
    e.start_date,
    e.genres,
    v.name AS venue_name,
    v.neighborhood
FROM events e
JOIN venues v ON e.venue_id = v.id
JOIN sources s ON e.source_id = s.id
WHERE s.name ILIKE '%eventbrite%'
  AND e.category = 'community'
  AND e.start_date >= CURRENT_DATE
ORDER BY e.created_at DESC
LIMIT 50;

-- Check for virtual event bleed-through (should be 0 after fix)
SELECT COUNT(*) as virtual_events_in_catalog
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE s.name ILIKE '%eventbrite%'
  AND e.venue_id IS NULL
  AND e.title ILIKE '%virtual%';
```
