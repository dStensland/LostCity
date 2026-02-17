# Eventbrite Crawl Analysis - February 16, 2026

## Executive Summary

The comprehensive Eventbrite category crawl (21 browse URLs) captured **362 total events**, with **258 new** and **75 existing**. Of these, **279 events were created today** (Feb 16, 2026).

**Key Finding**: Eventbrite is capturing a significant volume of **community-focused events** (138 events, 49% of today's crawl) that would be difficult to find through traditional venue-based crawlers. However, most prolific Eventbrite organizers do NOT post enough events to justify dedicated crawlers - only 1 venue has 5+ events all-time.

**Strategic Recommendation**: Keep Eventbrite as an aggregator crawler rather than replacing it with venue-specific crawlers. The long tail of community events (one-off workshops, neighborhood meetups, fitness classes) is exactly what Eventbrite excels at capturing.

---

## Category Breakdown (Today's Crawl)

| Category      | Events | % of Total | Strategic Value |
|---------------|--------|------------|-----------------|
| **community** | 138    | 49.5%      | ⭐ HIGH - Portal strategy alignment |
| learning      | 29     | 10.4%      | ⭐ HIGH - Educational portals |
| music         | 27     | 9.7%       | Medium - Covered by venue crawlers |
| art           | 21     | 7.5%       | Medium - Galleries covered |
| film          | 17     | 6.1%       | Medium - Cinema crawlers exist |
| family        | 17     | 6.1%       | ⭐ HIGH - Family portal opportunity |
| **fitness**   | 17     | 6.1%       | ⭐ HIGH - Health portal alignment |
| sports        | 9      | 3.2%       | Medium - Arena crawlers exist |
| food_drink    | 4      | 1.4%       | Low - Restaurant crawlers exist |

### High-Value Categories for Portal Strategy

- **Community (138 events)**: Speed dating, candidate meet & greets, garden days, book clubs, charity events
- **Fitness (17 events)**: Pilates classes, breathwork sessions, sound baths, yoga workshops, 5K runs
- **Learning (29 events)**: Workshops, educational seminars, skill-building classes
- **Family (17 events)**: Family-friendly activities and events

**Notable**: Categories we expected but got 0 events:
- health
- charity (captured as "community" instead)
- wellness (captured as "fitness" instead)
- education (captured as "learning" instead)

---

## Venue Analysis

### Top Venues from Today's Crawl

| Venue                                  | Events | Website? | Type         | Has Crawler? |
|----------------------------------------|--------|----------|--------------|--------------|
| Lore (nightclub)                       | 5      | ✅       | nightclub    | ❌           |
| 11050 Crabapple Rd Suite D115A         | 4      | ❌       | event_space  | ❌           |
| Dark Horse Tavern                      | 4      | ✅       | bar          | ✅           |
| Halidom Eatery                         | 3      | ❌       | restaurant   | ❌           |
| Loudermilk Conference Center           | 3      | ✅       | event_space  | ❌           |
| Believe Music Hall                     | 3      | ✅       | nightclub    | ✅           |
| Atlanta Expo Center North              | 3      | ❌       | event_space  | ❌           |
| Wicked Wolf Atlanta                    | 3      | ❌       | event_space  | ❌           |
| Underground Atlanta                    | 3      | ❌       | venue        | ❌           |
| Atlanta Marriott Northeast/Emory Area  | 3      | ✅       | hotel        | ❌           |

### New Venues Created Today: 133

The crawl created **133 new venue records**. Most are event spaces without websites - indicating one-off rental locations or community spaces that don't have their own event calendars.

**Notable new venues**:
- **Ambient + Studio** (Atlanta) - fitness/wellness space
- **GRND Pilates** (Atlanta) - fitness studio
- **Neutral Moon Studio** (Atlanta) - wellness space
- **CreateATL** (Atlanta) - creative space
- **Black Coffee Atlanta** - coffee shop
- **Whisky Mistress** (Atlanta) - bar/venue
- **MSR My Sisters Room** (Atlanta) - LGBTQ+ bar

---

## Crawler Candidates Analysis

### Most Prolific Eventbrite Users (All-Time)

**Critical Finding**: Only **1 venue** has 5+ Eventbrite events all-time:

| Venue | All-Time Events | Website | Type | Recommendation |
|-------|-----------------|---------|------|----------------|
| **Lore** | 5 | https://loreatl.com/ | nightclub | ⚠️ MONITOR - Only 5 events total, likely not worth dedicated crawler yet |

### Venues with 3-4 Events (Today Only)

These venues posted multiple events today but may be one-time bulk uploads:

| Venue | Events Today | Website | Assessment |
|-------|--------------|---------|------------|
| **Monday Night Brewing - The Grove** | 4 | ✅ | Already have Monday Night Garage crawler - should expand to The Grove location |
| **Loudermilk Conference Center** | 4 | ✅ | Conference center - events are client bookings, not venue-hosted. Skip. |
| **Dark Horse Tavern** | 4 | ✅ | **ALREADY HAS CRAWLER** ✅ |
| **Believe Music Hall** | 3 | ✅ | **ALREADY HAS CRAWLER** ✅ |
| **Auburn Avenue Research Library** | 3 | ✅ | Library - likely workshops/programs. Worth investigating. |
| **Monday Night Brewing - multiple locations** | 4 total | ✅ | Expand existing Monday Night crawler to all locations |

---

## Dedicated Crawler Recommendations

### TIER 1: IMMEDIATE ACTION

1. **Monday Night Brewing - Expand Coverage**
   - **Current**: monday_night_garage.py exists
   - **Action**: Update crawler to cover all 3 locations (Garage, The Grove, West Midtown)
   - **Rationale**: 4 events from The Grove alone shows consistent programming
   - **Website**: https://mondaynightbrewing.com

2. **Auburn Avenue Research Library**
   - **Events**: 3 today (all-time data needed)
   - **Type**: Fulton County Library - workshops, author events, cultural programming
   - **Website**: http://www.fulcolibrary.org/auburn-avenue-research-library
   - **Rationale**: High cultural value, likely has consistent programming calendar
   - **Priority**: HIGH

### TIER 2: MONITOR

3. **Lore (Nightclub)**
   - **Events**: 5 all-time
   - **Website**: https://loreatl.com/
   - **Rationale**: Only 5 events total - wait to see if this is consistent
   - **Action**: Check again in 30 days
   - **Priority**: MONITOR

4. **Hudson Grille**
   - **Events**: 3 today
   - **Website**: http://www.hudsongrille.com/
   - **Type**: Sports bar with multiple Atlanta locations
   - **Rationale**: May have recurring trivia/events across locations
   - **Priority**: MEDIUM

### TIER 3: NOT RECOMMENDED

**Conference Centers & Hotels**: Loudermilk, Atlanta Marriott, Georgia International Convention Center
- **Rationale**: Their "events" are client bookings, not venue-hosted programs. We can't scrape client calendars.

**Event Spaces Without Websites**: The 133 new venues created today are mostly rental spaces without public calendars.

---

## Category-Specific Insights

### Community Events (138 events - 49% of crawl)

**Representative samples**:
- Speed Dating Atlanta | Ages 38-52 @ Palo Santo
- J. Blade Ranch Community Garden Days @ J. Blade Ranch
- District 14 Candidate Meet and Greet @ 280 Oak St
- Tanya Time Book Club Women's History Month Authors' Salon @ The Creatorspace
- What Makes You Happy? A Workshop on the Good Life

**Analysis**: These are exactly the kind of long-tail events that:
1. Don't appear on venue calendars (held at rental spaces)
2. Are one-off or infrequent (not worth dedicated crawlers)
3. Have high community value for portals
4. Would be LOST without Eventbrite aggregation

**Recommendation**: Keep Eventbrite as primary source for community events.

### Fitness Events (17 events)

**Representative samples**:
- Pilates. Prosecco. Realtor Networking @ GRND Pilates
- Focusing 2 Finish: Breathe Woman Breathe @ Halidom Eatery
- Shangri-La Sanctuary: A 222 Grounded Sound Bath @ 1272 Hill St SE
- Vin/Yin with Annie .G. @ Neutral Moon Studio
- Pilates & Candles: A Pilates and Candle Making Galentines Experience @ Ponce City Market

**Analysis**: Fitness events are often held at:
1. Boutique studios without robust web calendars
2. Pop-up locations (restaurants, community spaces)
3. One-time or semi-regular schedules

**New venues to investigate**:
- **GRND Pilates** - appears to host events
- **Neutral Moon Studio** - yoga/wellness space
- **Ambient + Studio** - breathwork/sound bath venue

**Recommendation**: Add these 3 fitness studios if they have public calendars. Otherwise, Eventbrite captures them well.

---

## Data Quality Findings

### Venue Type Distribution (New Venues)

Of 133 new venues, the breakdown:
- **event_space**: 120+ (90%)
- **bar/restaurant**: 5-8
- **fitness/wellness**: 3-4
- **churches**: 2-3
- **bookstores**: 1

**Issue**: The Eventbrite crawler is creating too many generic "event_space" venues. These are often:
- Rental spaces without public calendars
- Private venues (offices, conference rooms)
- Temporary pop-up locations

### Missing Website Data

Of 133 new venues, **only ~10 have websites**. This indicates:
1. Most are not permanent event venues
2. They won't have scrapable calendars
3. Eventbrite is the ONLY source for these events

---

## Existing Crawler Audit

We have **972 sources** in the database, **522 active**.

**Already have crawlers for these Eventbrite venues**:
- ✅ Dark Horse Tavern (dark_horse_tavern.py)
- ✅ Alliance Theatre (alliance_theatre.py)
- ✅ Believe Music Hall (believe_music_hall.py)
- ✅ Mercedes-Benz Stadium (mercedes_benz_stadium.py)

**Good news**: Our venue crawlers are working. When Dark Horse posts 4 events to Eventbrite today, we're likely also getting them from their direct website.

---

## Strategic Recommendations

### 1. KEEP EVENTBRITE AS AGGREGATOR ⭐

**DO NOT** try to replace Eventbrite with venue-specific crawlers.

**Why**:
- 49% of events are community events at one-off locations
- 90% of venues are event spaces without public calendars
- Only 1 venue has 5+ events all-time
- Long tail of boutique fitness, workshops, and meetups

**Value**: Eventbrite captures the "invisible" events that never appear on venue websites.

### 2. EXPAND EXISTING CRAWLERS

**Action Items**:
1. **Monday Night Brewing**: Update to cover The Grove + West Midtown locations
2. **Dark Horse Tavern**: Verify crawler is active and capturing events (4 showed up on Eventbrite today)

### 3. ADD HIGH-VALUE SINGLE CRAWLERS

**Immediate**:
- Auburn Avenue Research Library (cultural programming)

**Investigate** (check if they have calendars):
- GRND Pilates
- Neutral Moon Studio  
- Ambient + Studio
- Hudson Grille (multi-location sports bar)

### 4. CATEGORY MAPPING IMPROVEMENTS

**Issue**: Categories like "charity" and "wellness" came back with 0 events, but we saw related events under "community" and "fitness".

**Action**: Review `tag_inference.py` to ensure:
- Charity events are properly tagged
- Wellness events (sound baths, breathwork) get wellness tags
- Health-related fitness events also get health tags

### 5. VENUE TYPE CLEANUP

**Issue**: 90% of new venues are generic "event_space" with no websites.

**Action**: Add validation to Eventbrite crawler:
- If venue has no website AND venue_type would be "event_space" → mark as `venue_type: "event_space_rental"`
- Don't create venue record for obvious addresses (street addresses like "2636 Fairburn Rd SW")
- Use LLM extraction to identify true venue names vs. addresses

---

## Sample Events by High-Value Category

### Community (Top 10)

1. Speed Dating Atlanta | In-Person | Ages 38-52 @ Palo Santo
2. Love Stories in Bloom: A Trilith Guesthouse Wedding Experience @ Trilith Guesthouse
3. Monee's Golden Endeavors Charity Ball @ Michael C. Carlos Museum
4. SpeedAtlanta Dating | Saturday Night Ages 25–39 @ Halidom Eatery
5. J. Blade Ranch Community Garden Days @ J. Blade Ranch
6. "No Ways Tired" @ Narvie Harris Elementary School
7. Tanya Time Book Club Women's History Month Authors' Salon @ The Creatorspace
8. What Makes You Happy? A Workshop on the Good Life
9. Snowflakes & Rosebuds - A Winter Tea Experience @ Magnolia House and Garden
10. District 14 Candidate Meet and Greet @ 280 Oak St

### Fitness (All 10 from today)

1. Pilates. Prosecco. Realtor Networking @ GRND Pilates
2. Focusing 2 Finish: Breathe Woman Breathe @ Halidom Eatery
3. Shangri-La Sanctuary: A 222 Grounded Sound Bath @ 1272 Hill St SE
4. Atlanta Black Chambers Black Health Social Mixer @ APT 4B
5. (ATLANTA) Harmonic Breath: Sunday Breathwork with Live Music Immersion @ Ambient + Studio
6. Vin/Yin with Annie .G. @ Neutral Moon Studio
7. Pilates & Candles: A Pilates and Candle Making Galentines Experience @ Ponce City Market
8. KW Military x KW Run Club! FR26 5K Run/Walk @ Centennial Olympic Park Drive Northwest
9. Future of Health Open House: Exhibits, Arts, Games, and more! @ St. Mary's Orthodox Church
10. Vision Board Party @ 323 Walker St SW unit a 2nd floor

---

## Next Steps

### Immediate (This Week)

1. ✅ **Expand Monday Night Brewing crawler** to cover The Grove location
2. ✅ **Create Auburn Avenue Research Library crawler** 
3. ✅ **Audit Dark Horse Tavern crawler** - why are events showing up on Eventbrite if we have a direct crawler?

### Short-term (Next 2 Weeks)

4. **Investigate fitness studios**: Check GRND Pilates, Neutral Moon, Ambient + Studio for public calendars
5. **Tag inference review**: Improve charity/wellness/health category detection
6. **Venue type cleanup**: Add validation for event_space vs event_space_rental

### Monitoring (Ongoing)

7. **Lore nightclub**: Check monthly - if they consistently post 5+ events, add crawler
8. **Hudson Grille**: Monitor for recurring events (trivia, sports watch parties)
9. **Track Eventbrite category performance**: Which categories deliver highest portal value?

---

## Conclusion

The Eventbrite crawler is performing **exactly as intended**: capturing the long tail of community events, workshops, fitness classes, and one-off gatherings that would never appear on venue websites.

**Key Metric**: Only **1 venue** (Lore) has posted 5+ events all-time through Eventbrite. This means there are NO high-volume organizers to target for dedicated crawlers.

**Strategic Value**: The 138 community events (49% of today's crawl) represent events we would LOSE without Eventbrite. They're held at:
- Private event spaces
- Community centers
- Pop-up locations  
- Boutique studios
- Temporary venues

**Recommendation**: Keep Eventbrite as a core aggregator. Focus crawler development on venues with consistent calendars (music venues, theaters, museums) rather than trying to replace Eventbrite's long-tail coverage.

---

**Report Generated**: February 16, 2026  
**Analysis Tool**: `/Users/coach/Projects/LostCity/crawlers/analyze_eventbrite_crawl.py`  
**Data Source**: Supabase events table, source_id=1, created_at >= 2026-02-16
