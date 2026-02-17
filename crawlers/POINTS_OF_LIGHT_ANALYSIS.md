# Points of Light Crawler Analysis

## Date: 2026-02-16

## Summary

**NO CRAWLER NEEDED** - Points of Light does not have a crawlable Atlanta-area event feed. Their local volunteer work is already covered by our existing Hands On Atlanta crawler.

## Organization Details

- **Name**: Points of Light
- **Type**: National/international volunteer organization
- **HQ Location**: 101 Marietta Street NW, Suite 3100, Atlanta, GA 30303
- **Website**: https://www.pointsoflight.org
- **Venue ID**: 4288 (created as reference only)

## Event Types

Points of Light's events fall into three categories:

1. **National Conferences** - Held in Washington, D.C.
   - The George H.W. Bush Points of Light Awards (October, DC)
   - Points of Light Conference (June, DC)

2. **Virtual Webinars** - Online professional development
   - "Building AI Confidence Across the Social Impact Sector" (Feb 25)
   - Corporate/nonprofit training sessions

3. **Awareness Campaigns** - Not physical events
   - National Volunteer Week (April)
   - Global Volunteer Month
   - Days of Service

## Why No Crawler?

1. **No Atlanta-specific event feed** - Their events page (https://www.pointsoflight.org/events/) only lists national programs
2. **No Eventbrite presence** - Checked for Points of Light Eventbrite org, none found
3. **Local volunteer work flows through Hands On Atlanta** - Which we already crawl

## Hands On Atlanta Coverage

We already have comprehensive Atlanta volunteer opportunity coverage:

- **Source ID**: 13 (hands-on-atlanta)
- **Status**: Active, crawl frequency = daily
- **Crawler**: `crawlers/sources/hands_on_atlanta.py`
- **Methods**:
  - Golden Volunteer API
  - Page scraping fallback with Playwright
  - Comprehensive volunteer shift parsing

## Relationship Between Organizations

Points of Light is the national parent organization. Hands On Atlanta is their local Atlanta affiliate that handles ground-level volunteer coordination. The volunteer opportunities that would be relevant to Atlanta users all flow through Hands On Atlanta's volunteer.handsonatlanta.org platform, which we already crawl.

## Recommendation

- **Do NOT create a points-of-light crawler** - No local event feed to crawl
- **Venue record created** - For reference/completeness (ID 4288)
- **Keep hands-on-atlanta crawler active** - This covers all local volunteer work
- **No action needed** - Current setup is optimal

## Data Quality Check

To verify Hands On Atlanta crawler is working well:
```bash
python3 main.py --source hands-on-atlanta --verbose
```

Check recent volunteer opportunities:
```sql
SELECT
    title,
    start_date,
    venue_id,
    category,
    subcategory
FROM events
WHERE source_id = 13
  AND start_date >= CURRENT_DATE
ORDER BY start_date
LIMIT 20;
```
