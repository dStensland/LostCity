# Weekly Events Report: February 9-15, 2026

## Executive Summary

**Total Events: 1,000**

This week shows strong event coverage across Atlanta with a heavy concentration of film screenings (27.8%), followed by community events (18.7%) and music (14.7%). The data reveals some interesting patterns and potential data quality opportunities.

## Key Findings

### Category Distribution
1. **Film** - 278 events (27.8%) - Heavy concentration from cinema crawlers
2. **Community** - 187 events (18.7%) - Volunteer opportunities, meetups
3. **Music** - 147 events (14.7%) - Concerts, open mics, live performances
4. **Art** - 84 events (8.4%) - Gallery shows, paint & sip classes
5. **Words** - 67 events (6.7%) - Library events, book clubs, author talks

### Daily Activity Patterns
- **Monday (Feb 9)**: 275 events - Busiest day of the week
- **Tuesday (Feb 10)**: 196 events
- **Wednesday (Feb 11)**: 231 events
- **Thursday (Feb 12)**: 271 events - Second busiest day
- **Friday (Feb 13)**: 27 events - **Data quality issue: significantly under-indexed**

**ALERT**: Friday showing only 27 events is a major red flag. This suggests:
- Crawlers may not be capturing weekend events properly
- Date parsing issues for multi-day events
- Some sources may only be crawled early in the week

### Neighborhood Coverage

**Top 5 Neighborhoods:**
1. Sandy Springs - 164 events (16.4%)
2. Midtown - 117 events (11.7%)
3. Unknown - 108 events (10.8%) - **Data quality issue**
4. Cheshire Bridge - 48 events (4.8%)
5. Downtown - 45 events (4.5%)

**Data Quality Note**: 108 events (10.8%) have "Unknown" neighborhood, indicating venue geocoding or neighborhood assignment needs improvement.

## Notable Events This Week

### High-Profile Venues
- **Fox Theatre**: School Daze 38th Anniversary Screening (Feb 10), Alvin Ailey Dance Theater (Feb 11-12)
- **Alliance Theatre**: Duel Reality (Feb 11-12)
- **Coca-Cola Roxy**: Miguel: CAOS Tour (Feb 10)
- **Truist Park**: Stadium tours daily
- **State Farm Arena**: Member Open Gym (Feb 10)

### Major Film Series
- **Zootopia 2** - 7 screenings
- **Send Help** - 31 screenings (most popular film this week)
- **The Housemaid** - 20 screenings
- **Hamnet** - 14 screenings

### Recurring Programs
- Multiple fitness class series (Boot Camp, Aerial Yoga, Zumba, etc.)
- Weekly open mic nights (comedy, music)
- Library programs and book clubs
- Community volunteer opportunities

## Data Quality Assessment

### Completeness Scores
- **Missing start_time**: 61 events (6.1%) ✅ Excellent
- **Missing image**: 238 events (23.8%) ⚠️ Needs improvement
- **Missing description**: 102 events (10.2%) ⚠️ Needs improvement
- **Free events**: 275 events (27.5%)

### Issues Identified

1. **Friday Under-Coverage (CRITICAL)**
   - Only 27 events on Friday vs 275 on Monday
   - Suggests systematic date parsing or crawl timing issues
   - Recommendation: Audit crawlers that produce weekend events

2. **Unknown Neighborhoods (MEDIUM)**
   - 108 events without neighborhood assignment
   - Likely caused by venues missing lat/lng coordinates
   - Recommendation: Run venue enrichment script on these venues

3. **Missing Images (MEDIUM)**
   - 23.8% of events lack images
   - Higher rate for community/library events (expected)
   - Film events should have near-100% coverage from TMDB
   - Recommendation: Check film poster fetching pipeline

4. **Missing Descriptions (LOW)**
   - 10.2% missing descriptions
   - Many library/community events naturally have sparse descriptions
   - Synthetic description generation appears to be working

5. **Cinema Showtimes Dominating**
   - Film events make up 27.8% of all events
   - Heavy concentration from The Springs Cinema & Taphouse (Sandy Springs)
   - Tara Theatre (Cheshire Bridge) also contributing significant volume
   - This is likely accurate for a weekday period

## Crawler Health Notes

### High-Performing Sources
- **Cinema crawlers**: Excellent coverage with full schedules
- **Library systems**: DeKalb County Library showing strong event data
- **Fitness centers**: Piedmont Wellness Center classes well-represented
- **Painting With a Twist**: Multiple locations with detailed class schedules

### Potential Issues
- **Weekend event gap**: Need to investigate Friday/Saturday/Sunday coverage
- **Venue normalization**: Some venues appearing as "Unknown Venue" or "Venue TBA"
- **Time zones**: Some events showing unusual early morning times (3:00 AM, 4:00 AM for painting classes)

## Recommendations for crawler-dev

1. **Investigate Friday event gap**
   - Check date parsing logic for events that span multiple days
   - Verify crawl scheduling doesn't skip late-week updates
   - Review sources that typically post weekend events

2. **Run venue enrichment batch**
   - Target 108 events with "Unknown" neighborhood
   - Use `venue_enrich.py` to add lat/lng and neighborhoods

3. **Audit time extraction**
   - Painting classes showing 3:00 AM, 4:00 AM start times
   - Likely AM/PM parsing issue or timezone confusion

4. **Verify film poster pipeline**
   - 278 film events should have near-100% image coverage via TMDB
   - Check why 23.8% overall are missing images

5. **Festival coverage check**
   - Most series detected are films and fitness classes
   - Verify no major festivals happening this week that were missed

## SQL Queries Used

```sql
-- Core query for this report
SELECT 
  e.*,
  v.name as venue_name,
  v.neighborhood,
  v.venue_type,
  v.address,
  v.city
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE start_date >= '2026-02-09' 
  AND start_date <= '2026-02-15'
ORDER BY start_date, start_time;
```

## Next Steps

1. Re-run this report on Friday to see if weekend events get populated
2. Fix Friday coverage gap before next weekly snapshot
3. Coordinate with venue enrichment to resolve "Unknown" neighborhoods
4. Review painting class time parsing (AM/PM issues)

---

*Report generated: 2026-02-09*
*Script: `/Users/coach/Projects/LostCity/crawlers/weekly_events_report.py`*
