# Exhibition Hub Atlanta Investigation

## Summary

Exhibition Hub is a global immersive art exhibition company that hosts rotating exhibits like Bubble Planet, Van Gogh experiences, and other Instagram-worthy installations.

## Findings

### Website Structure
- **Main Site**: https://exhibitionhub.com
- **Type**: WordPress-based, heavily JavaScript-driven 3D interface
- **Content**: Global company showcasing 400+ exhibitions across 100+ cities
- **Challenge**: Site uses complex JavaScript rendering that makes traditional scraping difficult

### Atlanta Presence
- **Location**: Mentioned to be in Atlanta Art Center area (1280 Peachtree St NE, Midtown)
- **Status**: Unclear if currently active or seasonal
- **Exhibits**: Known to host Bubble Planet, Van Gogh experiences, and other immersive installations

### Eventbrite Status
- **Search URL**: https://www.eventbrite.com/d/ga--atlanta/exhibition-hub/
- **Found Events**: Found "Deadly Attraction Immersive Art Exhibition" but organized by different entity
- **Organizer Page**: Tested Exhibition Hub organizer page but returned 404
- **Conclusion**: They may not currently have active Eventbrite events, or use different ticketing

### Social Media
- **Instagram**: @exhibitionhub_eh (mentions @bubbleplanetexperience)
- **Facebook**: facebook.com/exhibitionhub
- **LinkedIn**: linkedin.com/company/exhibitionhub

## Current Status

**Crawler Created**: `/Users/coach/Projects/LostCity/crawlers/sources/exhibition_hub.py`
**Venue Created**: Exhibition Hub Atlanta (ID: 308, venue created in database)
**Status**: Crawler runs but finds 0 events due to:
1. Eventbrite organizer page not found/inactive
2. Main website requires complex JavaScript interaction
3. May be seasonal or between exhibitions

## Recommendations

### Short-term (Now)
1. **Monitor manually** - Check their Instagram/Facebook for Atlanta exhibit announcements
2. **Alternative source** - They may ticket through Fever, See Tickets, or direct sales
3. **Keep crawler** - Leave in place to catch future Eventbrite events

### Medium-term (Next 2-4 weeks)
1. **Direct website scraping** - Build more sophisticated JavaScript scraper for main site
2. **Multi-platform approach** - Check Fever, See Tickets, Goldstar for their events
3. **Contact venue** - Reach out to confirm current/upcoming Atlanta exhibitions

### Long-term (Future enhancement)
1. **API integration** - If they develop a public API
2. **Email alerts** - Subscribe to their mailing list and create email scraper
3. **Partner status** - Establish partnership for event data feed

## Event Characteristics

When active, Exhibition Hub events typically feature:
- **Category**: Arts (immersive) or Family (kids) depending on exhibit
- **Duration**: Multi-month runs (typically 3-6 months per exhibit)
- **Pricing**: Usually $25-45 per person
- **Tags**: immersive, instagram-worthy, art-installation, bubble-planet, van-gogh, etc.
- **Type**: Timed entry tickets, typically hourly slots
- **Audience**: Families, date nights, Instagram enthusiasts

## Data Quality Notes

- **Seasonality**: HIGH - Exhibitions rotate every few months
- **Reliability**: MEDIUM - Depends on their ticketing platform
- **Volume**: LOW - 1-2 active exhibitions at a time
- **Uniqueness**: HIGH - Exclusive immersive experiences not found elsewhere

## Next Steps

1. Monitor their social media for Atlanta exhibit announcements
2. Test crawler weekly to catch new Eventbrite events
3. Consider adding Fever/See Tickets integrations
4. Flag for manual review when new exhibits launch

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26
**Status**: Active monitoring, awaiting next Atlanta exhibition
