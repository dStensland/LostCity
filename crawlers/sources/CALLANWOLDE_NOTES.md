# Callanwolde Fine Arts Center Crawler

**File**: `/Users/coach/Projects/LostCity/crawlers/sources/callanwolde_fine_arts_center.py`

**Source ID**: 809 (slug: `callanwolde-fine-arts-center`)

## Overview

Callanwolde Fine Arts Center is a historic Gothic-Revival mansion in Druid Hills offering extensive arts education programs including pottery, dance, yoga, painting, drawing, jewelry, photography, writing, and kids programs.

## Integration Details

- **Method**: REST API (WordPress Events Calendar)
- **API Endpoint**: `https://callanwolde.org/wp-json/tribe/events/v1/events`
- **Pagination**: 50 events per page
- **Pattern**: Follows `park_pride.py` pattern
- **Frequency**: Daily

## Data Quality

### Event Volume
- **Total events in API**: 1,518+ (as of Feb 2026)
- **Events captured**: 648+ in initial crawl
- **Date range**: Upcoming events only (filtered by `start_date`)

### Categories
- **Learning**: 95% (pottery, painting, drawing, photography, writing, jewelry workshops)
- **Fitness**: 5% (yoga, tai chi, wellness classes)

### Pricing
- **API limitation**: The `cost` field is usually empty even for paid classes
- **Solution**: Infer pricing from registration URLs
  - If `website` field contains `campscui.active.com` → mark as paid with "Registration required"
  - Otherwise → assume free
- **Result**: Most classes correctly identified as paid

### Venue Handling
- **Main venue**: Callanwolde Fine Arts Center (980 Briarcliff Rd NE, Druid Hills)
- **Satellite locations**: API includes venue data for off-site events
- **Crawler behavior**: Creates separate venue records for satellite locations, falls back to main venue

## Category Logic

```python
# Pottery/ceramics → learning/workshop + ["pottery", "ceramics", "hands-on"]
# Dance → learning/class + ["dance"]
# Yoga/wellness → fitness/yoga or fitness/class + ["yoga", "wellness"]
# Painting/drawing → learning/workshop + ["painting", "art-class"]
# Photography → learning/workshop + ["photography"]
# Writing → learning/workshop + ["writing", "creative-writing"]
# Kids programs → learning/class + ["family-friendly"]
# Concerts/performances → music/performance or art/performance
# Default → learning/class
```

## Special Handling

1. **HTML Entity Decoding**: Titles contain HTML entities (e.g., `&#8211;` for em-dash) which are handled by BeautifulSoup
2. **Registration Links**: Events link to `campscui.active.com` for registration, which we use as `ticket_url`
3. **Internal Events**: Filters out staff meetings, board meetings, and internal events
4. **Recurring Classes**: Most classes are multi-session series, but API returns each instance separately

## Sample Events

```
- WELL 04 – Wednesday Gentle Yoga (Mittleman) | 2026-02-11 | fitness
- POT 15 – Beginning Wheel (Roberts) | 2026-06-04 | learning/workshop
- DAP 15 – Class Portraiture (Holston) | 2026-06-03 | learning/workshop
- Introduction/Intermediate Blacksmithing (Teens & Adults) | 2026-06-04 | learning/workshop
```

## Testing

```bash
# Run crawler
python3 main.py --source callanwolde-fine-arts-center

# Check database
python3 -c "
from db import get_client
client = get_client()
result = client.table('events').select('count', count='exact').eq('source_id', 809).execute()
print(f'Total events: {result.count}')
"
```

## Notes

- This is a high-value source for arts education and wellness programming
- Events are well-structured with clear dates, times, and descriptions
- The API is reliable and includes proper pagination
- Most events are workshops/classes requiring advance registration
- Good coverage of pottery (their signature program) and visual arts
