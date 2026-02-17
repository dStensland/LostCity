# Eventbrite Crawl Analysis - Executive Summary

**Date**: February 16, 2026  
**Crawl Results**: 362 events total (258 new, 75 existing, 279 created today)  
**Analysis Query**: Events from source_id=1, created_at >= 2026-02-16

---

## Strategic Recommendation: KEEP EVENTBRITE AS AGGREGATOR

**Bottom Line**: Do NOT try to replace Eventbrite with venue-specific crawlers.

**Why**: 
- Only **1 venue** has 5+ events all-time (Lore with 5 events)
- **49% of events** are community events at one-off rental spaces
- **90% of new venues** have no websites (can't be crawled directly)
- Eventbrite captures the "invisible" long-tail: speed dating, book clubs, pop-up fitness, workshops

**Value Delivered**: 138 community events today that would be **LOST** without Eventbrite.

---

## Key Findings

### Category Distribution

| Category      | Events | Strategic Value |
|---------------|--------|-----------------|
| **community** | 138    | ⭐ HIGH - Portal alignment |
| learning      | 29     | ⭐ HIGH - Educational portals |
| music         | 27     | Medium - Venue crawlers exist |
| art           | 21     | Medium - Gallery crawlers exist |
| film          | 17     | Medium - Cinema crawlers exist |
| family        | 17     | ⭐ HIGH - Family portal opportunity |
| **fitness**   | 17     | ⭐ HIGH - Health portal alignment |
| sports        | 9      | Medium - Arena crawlers exist |
| food_drink    | 4      | Low - Restaurant crawlers exist |

**High-Value Portal Categories**: Community (138), Fitness (17), Learning (29), Family (17)

### Venue Analysis

**Top Organizers (Today's Crawl)**:
1. Lore (nightclub) - 5 events
2. Dark Horse Tavern - 4 events (already have crawler ✅)
3. Monday Night Brewing - The Grove - 4 events
4. Believe Music Hall - 3 events (already have crawler ✅)

**Critical Finding**: Only **1 venue** (Lore) has 5+ events all-time. No high-volume organizers to justify dedicated crawlers.

**New Venues Created**: 133 total
- 90%+ are generic event spaces with no websites
- Cannot be crawled directly
- Rental spaces, pop-up locations, private venues

---

## Immediate Actions (This Week)

### 1. ✅ Update Monday Night Brewing Crawler

**Current State**: 
- File: `/Users/coach/Projects/LostCity/crawlers/sources/monday_night.py`
- Covers West Midtown location (670 Trabert Ave)

**Action Needed**: Update to also cover The Grove location
- Address: TBD (need to look up)
- Website: https://mondaynightbrewing.com/location/atlanta-the-grove
- Events: 4 posted to Eventbrite today

**Note**: The `monday_night.py` crawler scrapes from the events page, which may already cover all locations. Need to verify.

### 2. ✅ Create Auburn Avenue Research Library Crawler

**Venue**: Auburn Avenue Research Library (Fulton County Library)  
**Events**: 3 today (cultural programming, author events, workshops)  
**Website**: http://www.fulcolibrary.org/auburn-avenue-research-library  
**Value**: HIGH - cultural events, community programming  
**File to create**: `/Users/coach/Projects/LostCity/crawlers/sources/auburn_avenue_research_library.py`

### 3. ⚠️ Audit Dark Horse Tavern Crawler

**Issue**: Dark Horse posted 4 events to Eventbrite today, but we have an existing crawler  
**File**: `/Users/coach/Projects/LostCity/crawlers/sources/dark_horse_tavern.py`

**Questions**:
- Is crawler active? Check sources table
- Is it running on schedule?
- Are we getting duplicate events?
- Is their website calendar broken/empty?

---

## Data Quality Improvements (Next 2 Weeks)

### Category Mapping Issues

**File**: `/Users/coach/Projects/LostCity/crawlers/tag_inference.py`

**Problems Found**:
- "charity" → 0 events (likely tagged as "community")
- "wellness" → 0 events (likely tagged as "fitness")  
- "health" → 0 events (fitness events should also get health tags)

**Action**: Review category inference rules to ensure:
- Charity events get proper tags
- Wellness events (sound baths, breathwork) tagged correctly
- Health-related fitness events get dual tags

### Venue Type Cleanup

**Problem**: 90% of new venues are "event_space" with address-as-name

**Bad Examples**:
- "2636 Fairburn Rd SW" (street address, not venue name)
- "11050 Crabapple Rd Suite D115A, Roswell, GA 30007" (full address)

**Action**: Add validation to Eventbrite crawler:
1. Detect when venue name is actually an address
2. Use LLM to extract real venue name from event context
3. Mark as `venue_type: "event_space_rental"` if no website
4. Consider NOT creating venue records for obvious addresses

---

## Sample High-Value Events Captured

### Community Events (Representative)
- Speed Dating Atlanta | Ages 38-52
- J. Blade Ranch Community Garden Days
- District 14 Candidate Meet and Greet
- Tanya Time Book Club - Women's History Month Authors' Salon
- What Makes You Happy? A Workshop on the Good Life

### Fitness Events (Representative)
- Pilates. Prosecco. Realtor Networking @ GRND Pilates
- Shangri-La Sanctuary: A 222 Grounded Sound Bath
- (ATLANTA) Harmonic Breath: Sunday Breathwork with Live Music Immersion
- Vin/Yin with Annie .G. @ Neutral Moon Studio
- Pilates & Candles: Galentines Experience @ Ponce City Market

**Key Insight**: These events happen at boutique studios, rental spaces, and pop-up locations that don't have scrapable calendars. Eventbrite is the ONLY way to capture them.

---

## Venues to Investigate (Optional)

Check if these have public event calendars worth crawling:

1. **GRND Pilates** - fitness studio (multiple Pilates events)
2. **Neutral Moon Studio** - yoga/wellness space
3. **Ambient + Studio** - breathwork/sound bath venue
4. **Hudson Grille** - sports bar chain (may have recurring trivia)

**Priority**: LOW - Only pursue if they have robust public calendars

---

## Venues to Monitor (Monthly)

- **Lore** (nightclub) - 5 events all-time. Check if this becomes consistent pattern.

---

## Why Eventbrite is Essential

### The Long Tail Problem

**Traditional venue crawlers capture**: 
- Concert venues → touring bands
- Theaters → shows
- Museums → exhibitions
- Arenas → sports/concerts

**Eventbrite captures**:
- Speed dating at restaurants
- Book clubs at coffee shops
- Community garden meetups
- Pop-up fitness classes in parks
- Candidate meet & greets at rental spaces
- Workshops at private studios
- Charity events at hotels

**These events**:
- Don't appear on venue websites (venues are just rental spaces)
- Are one-off or infrequent (not worth dedicated crawlers)
- Have high community value for portals
- Would be completely invisible without Eventbrite

### The Numbers

- **138 community events** today (49% of crawl)
- **133 new venues** created (90% with no websites)
- **Only 1 venue** with 5+ events all-time
- **88 venues** with websites posting to Eventbrite (but averaging <3 events each)

**Conclusion**: The long tail is real. Keep Eventbrite.

---

## Already Have Crawlers For

These venues appeared in Eventbrite results, but we already have dedicated crawlers:

- ✅ Dark Horse Tavern (`dark_horse_tavern.py`)
- ✅ Alliance Theatre (`alliance_theatre.py`)
- ✅ Believe Music Hall (`believe_music_hall.py`)
- ✅ Mercedes-Benz Stadium (`mercedes_benz_stadium.py`)
- ✅ Monday Night Brewing (`monday_night.py`)

**Good**: Our venue crawlers are working. Eventbrite serves as backup/validation.

---

## Next Steps Summary

### This Week
1. Verify Monday Night Brewing crawler covers all locations
2. Create Auburn Avenue Research Library crawler
3. Audit Dark Horse Tavern crawler status

### Next 2 Weeks
4. Fix category mapping (charity, wellness, health tags)
5. Add venue type validation to Eventbrite crawler
6. Investigate fitness studios (GRND, Neutral Moon, Ambient+)

### Ongoing
7. Monitor Lore nightclub monthly
8. Track Eventbrite category performance for portal value

---

## Files Generated

- `/Users/coach/Projects/LostCity/crawlers/analyze_eventbrite_crawl.py` - Analysis script
- `/Users/coach/Projects/LostCity/crawlers/EVENTBRITE_CRAWL_ANALYSIS_2026-02-16.md` - Full detailed report
- `/Users/coach/Projects/LostCity/crawlers/EVENTBRITE_QUICK_ACTIONS.md` - Action items reference
- `/Users/coach/Projects/LostCity/crawlers/EVENTBRITE_EXECUTIVE_SUMMARY.md` - This document

---

**Conclusion**: The Eventbrite crawler is performing exactly as designed - capturing the long tail of community events that would be impossible to find through venue-specific crawlers. Keep it running and focus crawler development on high-volume venues with consistent calendars.
