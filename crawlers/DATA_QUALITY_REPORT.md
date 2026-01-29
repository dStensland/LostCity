# Lost City Data Quality Audit Report
**Generated:** 2026-01-29

## Executive Summary

**Total Events in Database:** 9,120

### Critical Findings

1. **23.7% of events missing start_time** (2,162 events) - TBA times impact user experience
2. **41.9% of events missing ticket_url** (3,821 events) - Reduces conversion opportunities
3. **47.0% of events missing images** (4,284 events) - Significantly impacts visual appeal
4. **26.1% of events are past-dated** (2,382 events) - Stale data cluttering the database
5. **91 duplicate events detected** - Content needs deduplication

---

## 1. Time/Date Quality Analysis

### NULL start_time Issues (2,162 events)

**Top Offenders:**
- Generic Venue Crawler: 184 events (high rate for small source)
- Eventbrite: 134 events
- Landmark Midtown Art Cinema: 121 events
- Georgia Tech Athletics: 116 events (100% missing times)
- 529: 56 events

**Root Cause Hypothesis:**
- Some sources don't publish times for certain event types (all-day, TBA)
- Extraction prompts may need refinement for time detection
- Film sources often list only dates (showtime selection happens at checkout)

**Recommendations:**
1. Review Georgia Tech Athletics crawler - appears to never extract times
2. For film venues, consider extracting "Multiple showtimes" pattern
3. Add validation to flag sources with >30% missing times
4. UI should clearly indicate "Time TBA" rather than showing blank

### Past Events (2,382 events - 26.1%)

**Distribution by Source:**
- Landmark Midtown Art Cinema: 107 past events
- Piedmont Healthcare: 86 past events
- Georgia State University: 83 past events
- Meetup: 68 past events (41% of all Meetup events)

**Recommendation:** Implement automated cleanup to archive events >30 days old.

---

## 2. Source URL Quality

### Missing source_url: 0 events ✓
Excellent - all events have source URLs.

### Missing ticket_url: 3,821 events (41.9%)

**Completely missing ticket_urls:**
- Georgia Tech Athletics: 116/116 events (100%)
- Atlanta-Fulton Public Library: 104/104 events (100%)
- Kennesaw State Athletics: 61/61 events (100%)
- Georgia State University: 72/82 events (88%)

**Context:** Many events are free or registration-based (libraries, university athletics) and may not need ticket URLs. However:
- Sports events could link to ticket sales
- University events could link to RSVP systems
- Library events could link to registration pages

**Recommendation:**
- Mark event types that don't require tickets (free_admission + community category)
- For paid events, missing ticket_url should trigger quality alert
- Consider tracking this metric separately for paid vs free events

---

## 3. Content Quality Analysis

### Empty Descriptions: 108 events (1.2%)

**Top Offenders:**
- Generic Venue Crawler: 63/91 events (69%)
- Meetup: 27/27 events (100% of remaining Meetup)
- words category: 23 events
- Ticketmaster: 4/8 events (50%)

**Critical Issue:** Generic Venue Crawler has 69% empty description rate - this source needs immediate attention.

### Missing Images: 4,284 events (47.0%)

**By Source:**
- Generic Venue Crawler: 91/91 events (100%)
- Atlanta Recurring Social Events: 43/43 events (100%)
- Meetup: 20/27 events (74%)

**By Category:**
- nightlife: 32/32 events (100%)
- meetup: 22/29 events (76%)
- family: 22/42 events (52%)

**Recommendations:**
1. **URGENT:** Fix Generic Venue Crawler - it has critical quality issues
2. Enable auto-fetch for film posters (already implemented in db.py)
3. Enable auto-fetch for music artist images (already implemented)
4. Consider placeholder images for categories (nightlife, social events)
5. Meetup may require special handling if their image API is limited

---

## 4. Stale Data Issues

### Inactive Sources with Events

**High Priority:**
- ArtsATL Calendar: 45 events (inactive but has data)
- Creative Loafing: 49 events (inactive)
- Meetup: 165 events (inactive source)
- Georgia State University: 83 events (inactive)
- FanCons Georgia: 30 events (inactive)

**71 total inactive sources** - most have 0 events, but several have significant data.

**Recommendations:**
1. Review and potentially reactivate:
   - ArtsATL Calendar (45 events)
   - Creative Loafing (49 events) - may have shut down
   - Georgia State University (83 events) - why inactive?

2. Clean up Meetup data:
   - 165 total events (108 past, 57 future)
   - If API is deprecated, mark events with special flag
   - Consider manual review of future events for quality

3. Bulk deactivate sources with 0 events to reduce clutter

---

## 5. Duplicate Analysis

### Content Hash Duplicates: 91 events

**44 unique content_hash values** appear multiple times (47 duplicate instances).

**Most duplicated:**
- The Wonder Years on 2026-03-10: 3 duplicates
- Badflower on 2026-02-10: 3 duplicates  
- Glitterer on 2026-02-06: 3 duplicates

**Root Cause:** Multiple sources (Ticketmaster, venue websites) list the same events.

### Title + Venue + Date Duplicates: 74 events

**Top patterns:**
- "h is for hawk" at venue_id=199: 12 duplicates (4 dates × 3 duplicates each)
- "hamnet" at venue_id=199: 9 duplicates
- "arco" at venue_id=199: 9 duplicates

**venue_id=199 appears problematic** - need to investigate which venue this is.

**Query to identify venue:**
```sql
SELECT id, name, slug FROM venues WHERE id = 199;
```

**Recommendations:**
1. Review deduplication logic in `crawlers/dedupe.py`
2. Investigate venue_id=199 - may need better duplicate detection
3. Consider using `canonical_event_id` to link duplicates
4. For same title+venue+date from different sources:
   - Keep the one with most complete data
   - Or merge data (best image, best description, all ticket URLs)

---

## 6. Source-Specific Issues

### Generic Venue Crawler - CRITICAL
- 91 total events
- 63/91 empty descriptions (69%)
- 91/91 missing images (100%)
- 184 missing times (based on overall stats)

**Status:** This source has severe quality issues and may need to be disabled or completely rewritten.

### Meetup - DEPRECATED?
- Marked as inactive
- 165 total events (108 past, 57 future)
- 27 events with empty descriptions
- 20 events missing images

**Status:** If Meetup API is deprecated, consider:
1. Removing all Meetup events
2. Or marking with special "Archived Source" flag
3. Do not run Meetup crawler going forward

### Ticketmaster
- Only 8 events total (very low)
- 2 missing source_url (25%)
- 4 empty descriptions (50%)

**Status:** Either crawler is broken or needs broader event filtering.

### Film Venues (Landmark, Plaza, Tara)
- High rates of NULL start_time (expected - showtimes vary)
- Generally good description/image coverage

**Status:** Working as expected, but could add "Multiple showtimes" indicator.

---

## 7. Recommended Actions

### Immediate (This Week)

1. **Investigate Generic Venue Crawler**
   - Review code in `crawlers/sources/`
   - Check extraction prompts
   - Consider disabling until fixed

2. **Clean up past events**
   - Archive events with start_date < TODAY - 30 days
   - Create archival table or delete after export

3. **Fix duplicates at venue_id=199**
   - Identify the venue
   - Run deduplication on these specific events
   - Update dedupe.py if needed

4. **Review inactive sources with events**
   - Reactivate valuable sources (ArtsATL, Georgia State)
   - Clean up Meetup data if API is dead

### Short Term (This Month)

5. **Improve image coverage**
   - Verify auto-fetch for film/music is working
   - Add placeholder images for categories
   - Target nightlife/social events

6. **Enhance time extraction**
   - Review Georgia Tech Athletics crawler
   - Add "TBA" flag to events schema
   - Improve UI messaging for timeless events

7. **Ticket URL strategy**
   - Categorize events by ticket-ability
   - Don't penalize free community events
   - Focus extraction on paid events

### Long Term (Next Quarter)

8. **Automated monitoring**
   - Run this audit weekly
   - Alert on sources with >20% quality issues
   - Dashboard in Supabase for key metrics

9. **Source documentation**
   - Document quirks in each crawler
   - Standardize extraction prompts
   - Create testing framework

10. **Advanced deduplication**
    - Implement canonical_event_id system
    - Merge data from multiple sources
    - Track source hierarchy (prefer official > aggregator)

---

## Appendix: SQL Queries

See `data_quality_queries.sql` for detailed investigation queries.

## Appendix: Tools

- **Audit Script:** `crawlers/audit_data_quality.py`
- **Run Command:** `cd crawlers && source venv/bin/activate && python audit_data_quality.py`
- **Frequency:** Weekly (Sundays after major crawl runs)
