# Eventbrite Crawl - Immediate Actions

## TL;DR

The Eventbrite crawl captured **279 events today** (Feb 16). **Key finding**: Only 1 venue has 5+ events all-time, so there are NO high-volume organizers to replace with dedicated crawlers. Keep Eventbrite as aggregator for community long-tail.

## Immediate Actions (This Week)

### 1. Expand Monday Night Brewing Crawler

**Current**: `crawlers/sources/monday_night_garage.py` only covers the Garage location  
**Need**: Expand to cover The Grove location (4 events posted today)  
**Website**: https://mondaynightbrewing.com/location/atlanta-the-grove

**Code location**: `/Users/coach/Projects/LostCity/crawlers/sources/monday_night_garage.py`

### 2. Create Auburn Avenue Research Library Crawler

**Events**: 3 events today  
**Type**: Fulton County Library - cultural programming, author events, workshops  
**Website**: http://www.fulcolibrary.org/auburn-avenue-research-library  
**Value**: HIGH - cultural events, community programming

**Action**: Create `/Users/coach/Projects/LostCity/crawlers/sources/auburn_avenue_research_library.py`

### 3. Audit Dark Horse Tavern Crawler

**Issue**: Dark Horse posted 4 events to Eventbrite today, but we have an existing crawler  
**File**: `/Users/coach/Projects/LostCity/crawlers/sources/dark_horse_tavern.py`

**Questions**:
- Is the crawler active?
- Is it running regularly?
- Are we getting duplicate events (from both Eventbrite and direct source)?

## Venues to Investigate (Next 2 Weeks)

Check if these have public event calendars:

1. **GRND Pilates** - fitness studio (multiple events posted)
2. **Neutral Moon Studio** - yoga/wellness space
3. **Ambient + Studio** - breathwork/sound bath venue
4. **Hudson Grille** - sports bar (may have recurring trivia/events)

## Venues to Monitor (Monthly Check-ins)

- **Lore** (nightclub) - 5 events all-time. Check if this becomes consistent.

## Data Quality Improvements

### Category Mapping

**File**: `/Users/coach/Projects/LostCity/crawlers/tag_inference.py`

**Issues found**:
- "charity" events → 0 results (likely tagged as "community")
- "wellness" events → 0 results (likely tagged as "fitness")
- "health" events → 0 results (fitness/wellness events should also get health tags)

**Action**: Review and update category inference rules

### Venue Type Cleanup

**Issue**: 90% of new venues are generic "event_space" with no websites (addresses, not venues)

**Examples**:
- "2636 Fairburn Rd SW" (street address, not a venue name)
- "11050 Crabapple Rd Suite D115A, Roswell, GA 30007" (full address as venue name)

**Action**: Add validation to Eventbrite crawler:
1. Detect when "venue name" is actually just an address
2. Use LLM to extract real venue name from event description
3. Mark as `venue_type: "event_space_rental"` if no website

## Strategic Insight

**DO NOT** try to replace Eventbrite with venue-specific crawlers.

**Why**: 
- 49% of events are community events at one-off locations
- Only 1 venue has 5+ events (Lore with 5)
- Most venues are rental spaces without public calendars
- Eventbrite captures the "invisible" long-tail events

**Value**: 138 community events today that would be LOST without Eventbrite:
- Speed dating events
- Book clubs
- Community garden days
- Candidate meet & greets
- Pop-up fitness classes
- Workshops at rental spaces

## Files Modified

- `/Users/coach/Projects/LostCity/crawlers/analyze_eventbrite_crawl.py` - Analysis script
- `/Users/coach/Projects/LostCity/crawlers/EVENTBRITE_CRAWL_ANALYSIS_2026-02-16.md` - Full report
- `/Users/coach/Projects/LostCity/crawlers/EVENTBRITE_QUICK_ACTIONS.md` - This file
