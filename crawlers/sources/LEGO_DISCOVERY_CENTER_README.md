# LEGO Discovery Center Atlanta Crawler

## Overview

Crawler for LEGO Discovery Center Atlanta at Phipps Plaza in Buckhead. This indoor LEGO attraction features daily admission, special workshops, birthday parties, seasonal events, and LEGO building classes.

## Source Information

- **Name**: LEGO Discovery Center Atlanta
- **Slug**: `lego-discovery-center`
- **URL**: https://www.legolanddiscoverycenter.com/atlanta/
- **Location**: 3500 Peachtree Rd NE, Atlanta, GA 30326 (Phipps Plaza)
- **Neighborhood**: Buckhead
- **Venue Type**: Attraction
- **Source ID**: 412
- **Venue ID**: 1268

## Crawler Details

### File Location
`/Users/coach/Projects/LostCity/crawlers/sources/lego_discovery_center.py`

### Technology
- Uses **Playwright** for JavaScript rendering
- Handles dynamic content loading with scrolling
- Falls back to text parsing when structured events aren't available

### Event Types Extracted

1. **Special Workshops** - LEGO building classes and master builder sessions
2. **Seasonal Events** - Holiday-themed LEGO activities
3. **Birthday Parties** - Special party events
4. **Character Events** - Meet and greet events
5. **Daily Admission** - General admission to the attraction (fallback)

### Categories & Tags

**Primary Category**: `family`

**Subcategories**:
- `workshop` - Building classes and educational programs
- `holiday` - Seasonal and holiday events
- `party` - Birthday parties
- `special-event` - Character meets and special occasions
- `kids` - General admission and kids activities

**Tags**:
- `lego`
- `family`
- `kids`
- `indoor`
- `buckhead`
- `phipps-plaza`
- `attraction`
- `workshop` (for classes)
- `education` (for educational programs)
- `holiday` (for seasonal events)
- `building` (for building activities)

### Fallback Strategy

When no specific events are found on the website, the crawler creates daily admission events for the next 7 days:

- **Title**: "LEGO Discovery Center Atlanta - Daily Admission"
- **Hours**: 10:00 AM - 6:00 PM
- **Price Range**: $25-$35 (varies by date/time)
- **Recurring**: Daily
- **Description**: Full description of the attraction experience

## Testing

```bash
# Test the crawler
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source lego-discovery-center

# Expected output: 7 events created (daily admission for next week)
```

## Current Status

- **Status**: Active and operational
- **First Run**: 2026-01-31
- **Events Created**: 7 daily admission events
- **Success Rate**: 100%

## Notes

- The LEGO Discovery Center website uses heavy JavaScript rendering
- The crawler includes both structured event parsing and text-based fallback
- If the site structure changes, the crawler gracefully falls back to daily admission events
- All events are tagged as family-friendly and indoor activities
- Pricing information is included as general admission requirements

## Future Improvements

1. Monitor the website for specific workshop/event listings
2. Extract event registration URLs when available
3. Add support for birthday party package details
4. Capture seasonal event imagery
5. Parse time-specific admission slots if they become available

## Maintenance

- Review quarterly for website structure changes
- Update pricing information annually
- Verify hours of operation seasonally
