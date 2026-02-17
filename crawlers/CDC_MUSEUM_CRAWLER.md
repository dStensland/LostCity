# CDC Museum Crawler

## Summary

Created a crawler for the David J. Sencer CDC Museum at CDC headquarters in Atlanta.

## Implementation

**File**: `/Users/coach/Projects/LostCity/crawlers/sources/cdc_museum.py`

**Approach**: The CDC Museum website structure was analyzed and found to have:
- Permanent exhibitions (like "The Story of CDC")
- Occasional temporary exhibitions (like "A Collection of Curiosities")
- No programmatic events calendar

Exhibitions at the CDC Museum are long-running displays (months to years) rather than scheduled events. The website doesn't maintain a structured events calendar with dates for programming.

Given this, the crawler takes a minimal approach:
1. Ensures the venue exists in the database as a free public museum destination
2. Checks the exhibitions page to detect if the museum is temporarily closed
3. Returns (0, 0, 0) since there are no crawlable events

## Venue Details

- **Name**: David J. Sencer CDC Museum
- **ID**: 3786 (pre-existing in database)
- **Slug**: `cdc-museum`
- **Address**: 1600 Clifton Rd NE, Atlanta, GA 30329
- **Neighborhood**: Druid Hills
- **Venue Type**: museum
- **Website**: https://www.cdc.gov/museum
- **Free admission**: Yes
- **Current status**: Temporarily closed (as of Feb 2026)

## Source Registration

**Source ID**: 1072
- **Slug**: `cdc-museum`
- **URL**: https://www.cdc.gov/museum
- **Type**: venue
- **Crawl frequency**: monthly
- **Owner portal**: Atlanta (`74c2f211-ee11-453d-8386-ac2861705695`)
- **Status**: Active

## Testing

```bash
python3 main.py --source cdc-museum
```

Result:
```
INFO:sources.cdc_museum:CDC Museum venue created/verified (ID: 3786)
INFO:sources.cdc_museum:CDC Museum is currently temporarily closed
INFO:sources.cdc_museum:CDC Museum: Venue exists as free public health museum. No programmatic events to crawl (exhibitions are permanent/long-running).
INFO:__main__:Completed David J. Sencer CDC Museum: 0 found, 0 new, 0 updated
```

## Future Enhancements

If the CDC Museum adds:
- A structured calendar page for tours, lectures, or special events
- Programmatic events with specific dates
- Temporary exhibitions with clear start/end dates

The crawler can be enhanced to create events for those activities. For now, it ensures the museum exists as a destination in our database.

## Related Files

- Crawler: `/Users/coach/Projects/LostCity/crawlers/sources/cdc_museum.py`
- Registration script: `/Users/coach/Projects/LostCity/crawlers/register_cdc_museum.py`
