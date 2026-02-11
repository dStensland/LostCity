# Atlanta Volunteer Organizations Crawlers

Three new crawlers for Atlanta's most popular volunteer activities.

## Crawlers Created

### 1. Atlanta Community Food Bank
- **File**: `sources/atlanta_community_food_bank.py`
- **Slug**: `atlanta-community-food-bank`
- **Website**: https://www.acfb.org
- **Calendar**: EventON WordPress plugin
- **Venue**: 3400 N Desert Dr, East Point, GA 30344
- **Type**: nonprofit
- **Events**: Warehouse packing shifts, food sorting, community distributions

### 2. Habitat for Humanity Atlanta
- **File**: `sources/habitat_for_humanity_atlanta.py`
- **Slug**: `habitat-for-humanity-atlanta`
- **Website**: https://atlantahabitat.org
- **Calendar**: Webflow (custom JS)
- **Venue**: 824 Memorial Dr SE, Atlanta, GA 30316
- **Type**: nonprofit
- **Events**: House builds, ReStore volunteering, community events

### 3. Park Pride
- **File**: `sources/park_pride.py`
- **Slug**: `park-pride`
- **Website**: https://parkpride.org
- **Calendar**: The Events Calendar REST API
- **Venue**: 233 Peachtree St NE #900, Atlanta, GA 30303
- **Type**: nonprofit
- **Events**: Park cleanups, community gardens, tree plantings, park improvement projects

## Activation Steps

To activate these crawlers in production:

1. **Add sources to database** (via Supabase SQL editor or admin panel):

```sql
-- Atlanta Community Food Bank
INSERT INTO sources (slug, name, url, city, state, is_active, integration_method, crawl_frequency_hours)
VALUES (
  'atlanta-community-food-bank',
  'Atlanta Community Food Bank',
  'https://www.acfb.org',
  'Atlanta',
  'GA',
  true,
  'playwright',
  24
);

-- Habitat for Humanity Atlanta
INSERT INTO sources (slug, name, url, city, state, is_active, integration_method, crawl_frequency_hours)
VALUES (
  'habitat-for-humanity-atlanta',
  'Habitat for Humanity Atlanta',
  'https://atlantahabitat.org',
  'Atlanta',
  'GA',
  true,
  'playwright',
  24
);

-- Park Pride
INSERT INTO sources (slug, name, url, city, state, is_active, integration_method, crawl_frequency_hours)
VALUES (
  'park-pride',
  'Park Pride',
  'https://parkpride.org',
  'Atlanta',
  'GA',
  true,
  'rest_api',
  24
);
```

2. **Test individual crawlers**:

```bash
# Test Park Pride (REST API - most reliable)
python main.py --source park-pride --verbose

# Test Atlanta Community Food Bank
python main.py --source atlanta-community-food-bank --verbose

# Test Habitat for Humanity Atlanta
python main.py --source habitat-for-humanity-atlanta --verbose
```

3. **Verify results**:
- Check crawl_logs table for success/failure
- Check events table for new volunteer events
- Check venues table for venue records

## Features

All three crawlers include:

- **Public event filtering**: Skip internal staff meetings and board meetings
- **Volunteer tagging**: Auto-tag events with "volunteer", "volunteer-opportunity", "nonprofit"
- **Category inference**: Classify as "community" (volunteer) or "learning" (workshops)
- **Free events**: Most volunteer opportunities are marked as free
- **Family-friendly detection**: Tag events appropriate for families
- **Proper venue data**: Complete venue records with coordinates, neighborhoods, types

## Event Quality

These crawlers follow all data health requirements:

- Complete venue data (name, address, coordinates, neighborhood, type)
- Valid event titles (no generic "Volunteer" - actual event names)
- Start dates always present
- Start times when available
- Descriptions from source
- Source URLs for all events
- Category and tags for discoverability
- Content hash deduplication

## Testing Results

Park Pride crawler tested successfully:
- Fetched 3 events from REST API
- Parsed dates, times, descriptions
- Generated proper tags and categories
- Created venue record

## Notes

- **Park Pride** uses The Events Calendar REST API - most reliable of the three
- **ACFB** uses EventON plugin - requires Playwright for JS rendering
- **Habitat** uses Webflow - requires Playwright for JS rendering
- All crawlers handle pagination if present
- All crawlers skip internal/staff events
- Default crawl frequency: 24 hours (volunteer opportunities don't change frequently)
