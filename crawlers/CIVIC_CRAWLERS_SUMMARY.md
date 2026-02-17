# Civic Engagement Crawlers - Implementation Summary

## Overview

Built three crawlers for civic engagement organizations in Atlanta to fill gaps in activism and civic engagement coverage.

## Sources Implemented

### 1. League of Women Voters of Atlanta-Fulton County
- **File**: `crawlers/sources/lwv_atlanta.py`
- **Slug**: `lwv-atlanta`
- **URL**: https://lwvaf.org/calendar
- **Method**: Playwright (Squarespace)
- **Events**: Voter education, candidate forums, public meetings
- **Test Results**: 5 events found, 4 added (1 rejected for being >270 days out)
- **Volume**: 3-8 events/month expected

### 2. Center for Civic Innovation
- **File**: `crawlers/sources/civic_innovation_atl.py`
- **Slug**: `civic-innovation-atl`
- **URL**: https://civicatlanta.org/events
- **Method**: Playwright (Squarespace)
- **Events**: Town halls, panel discussions, policy forums
- **Venue**: 104 Trinity Ave SW, Downtown Atlanta
- **Test Results**: 1 event found and added
- **Volume**: 3-6 events/month expected

### 3. Georgia Equality
- **File**: `crawlers/sources/georgia_equality.py`
- **Slug**: `georgia-equality`
- **URL**: https://georgiaequality.org/communitycalendar/
- **Method**: iCal feed from Google Calendar
- **Events**: LGBTQ+ advocacy, lobby days, voter registration
- **Test Results**: 0 current events (calendar appears historical)
- **Volume**: 3-8 events/month expected (when active)

## Technical Implementation

### Squarespace Pattern (LWV, CCI)

These sites use Squarespace's event calendar system with JavaScript rendering:

**Key Selectors**:
- Event items: `.summary-item-record-type-event`
- Date month: `.summary-thumbnail-event-date-month`
- Date day: `.summary-thumbnail-event-date-day`
- Title: `.summary-title` or `a.summary-title-link`
- Description: `.summary-excerpt` or `.summary-content`
- Image: `img.summary-thumbnail-image`

**Challenges**:
- Requires Playwright for JS rendering
- Date/time parsing from separate month/day elements
- Time often embedded in HTML, needs regex extraction

### iCal Pattern (Georgia Equality)

Uses public Google Calendar feed accessed via iCal format:

**Feed URL**: `https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics`

**Benefits**:
- Structured data (no HTML parsing)
- Reliable date/time formats
- Supports multi-venue events

**Venue Intelligence**:
- Auto-detects Georgia State Capitol from location strings
- Falls back to Georgia Equality office as default venue

## Event Categorization

All events tagged with:
- **Base tags**: `["civic-engagement"]`
- **Org-specific tags**: `["lwv"]`, `["cci"]`, `["lgbtq"]`

**Content-based tags**:
- Voter-related → `"voter-registration"`, `"voter-education"`
- Forums/panels → `"town-hall"`
- Training → `"education"`
- Advocacy → `"advocacy"`

**Categories**:
- LWV events → `"community"`
- CCI events → `"community"`
- Georgia Equality events → `"activism"`

## Database Registration

Sources registered with:
- `crawl_frequency`: "daily"
- `source_type`: "civic_organization"
- `integration_method`: "playwright" or "ical"
- `is_active`: true

Registration script: `crawlers/register_civic_sources.py`

## Testing Commands

```bash
# Test individual crawlers
python3 main.py --source lwv-atlanta
python3 main.py --source civic-innovation-atl
python3 main.py --source georgia-equality

# Check logs
LOG_LEVEL=INFO python3 main.py --source lwv-atlanta
```

## Data Quality

### LWV Atlanta
- ✅ 4 events successfully added
- ⚠️ 1 event rejected (>270 days in future)
- ⚠️ Missing start times (Squarespace doesn't always display time)
- ✅ Good title and description quality
- ✅ Source URLs captured

### Center for Civic Innovation
- ✅ 1 event successfully added
- ⚠️ Missing start time
- ✅ Image captured
- ✅ Good description quality

### Georgia Equality
- ⚠️ No current events in calendar
- ✅ Crawler tested successfully with historical data
- ✅ Will capture events when calendar is updated
- ✅ Multi-venue support (Capitol detection)

## Known Limitations

1. **Time Parsing**: Squarespace sites don't always include times in event listings - may need to visit detail pages
2. **Far-Future Events**: LWV includes election dates 9+ months out which trigger validation warnings
3. **Georgia Equality Calendar**: Currently historical data only; awaiting new event postings
4. **Small Volume**: These are smaller organizations (3-8 events/month each) so may have periods with no upcoming events

## Next Steps

1. **Monitor**: Check these sources weekly to ensure they continue working
2. **Detail Pages**: Consider fetching event detail pages for better time/description data
3. **Recurring Events**: Set up series detection for regular meetings (e.g., "Good Trouble Tuesdays")
4. **Validation Tuning**: May need to adjust >270 day validation for election calendars

## Files Modified

- Created: `crawlers/sources/lwv_atlanta.py`
- Created: `crawlers/sources/civic_innovation_atl.py`
- Created: `crawlers/sources/georgia_equality.py`
- Created: `crawlers/register_civic_sources.py`
- Database: 3 sources registered in `sources` table

## Venue Records Created

- League of Women Voters of Atlanta-Fulton County (Midtown)
- Center for Civic Innovation (Downtown)
- Georgia Equality (organization)

All venues include:
- Full address and coordinates
- Neighborhood
- venue_type and spot_type
- Website URL
