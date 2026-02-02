# Trampoline Parks - Quick Start Guide

## Setup (One Time)

```bash
# 1. Run database migration
psql $DATABASE_URL -f /Users/coach/Projects/LostCity/database/migrations/093_trampoline_parks.sql

# 2. Verify structure
cd /Users/coach/Projects/LostCity/crawlers
python3 test_trampoline_crawlers.py
```

## Testing

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Test individual crawlers (dry-run)
python3 main.py --source defy-atlanta --dry-run
python3 main.py --source urban-air-atlanta --dry-run
python3 main.py --source sky-zone-atlanta --dry-run
```

## Production Crawling

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Crawl individual source
python3 main.py --source defy-atlanta
python3 main.py --source urban-air-atlanta
python3 main.py --source sky-zone-atlanta

# Or crawl all at once (if added to batch)
python3 main.py
```

## Check Results

```sql
-- See latest crawl logs
SELECT source_id, status, events_found, events_new, error_message, created_at
FROM crawl_logs
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN ('defy-atlanta', 'urban-air-atlanta', 'sky-zone-atlanta')
)
ORDER BY created_at DESC
LIMIT 10;

-- See events from trampoline parks
SELECT e.title, e.start_date, v.name as venue, e.tags
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.slug IN (
  'defy-atlanta',
  'urban-air-snellville', 'urban-air-buford', 'urban-air-kennesaw',
  'sky-zone-roswell', 'sky-zone-alpharetta'
)
ORDER BY e.start_date DESC
LIMIT 20;
```

## Troubleshooting

### No events found?
1. Check if website is accessible
2. Look at crawl_logs for error messages
3. Run with --dry-run to see what's being parsed
4. Website may have changed structure

### Too many/wrong events?
1. Check event filtering logic in determine_tags()
2. Verify date parsing is working correctly
3. May need to update event type keywords

### Timeout errors?
1. Increase timeout in crawler (default 30s)
2. Check network connectivity
3. Site may be slow or down

## Event Types Captured

- **Toddler Time** - Ages 2-6, usually weekday mornings
- **Glow Nights** - Black light jumping, usually Friday/Saturday
- **Teen Nights** - Ages 13+, usually Friday nights
- **Fitness Classes** - SkyFit, workout sessions
- **Open Jump** - General admission sessions
- **Sensory-Friendly** - Autism/special needs events
- **Parents Night Out** - Drop-off events

## Tags Reference

Always applied: `family-friendly`, `kids`, `indoor`, `active`, `trampoline`

Contextual:
- `toddlers` - Ages 2-6
- `glow-night` - Black light events
- `fitness` - Workout classes
- `sensory-friendly` - Special needs
- `teens` - Ages 13+
- `sports` - Dodgeball, basketball
- `climbing` - Climbing walls (Urban Air)
- `parents-night-out` - Drop-off events

## Venues Created

| Venue Slug | Name | City | Chain |
|------------|------|------|-------|
| defy-atlanta | Defy Atlanta | Kennesaw | Defy |
| urban-air-snellville | Urban Air Snellville | Snellville | Urban Air |
| urban-air-buford | Urban Air Buford | Buford | Urban Air |
| urban-air-kennesaw | Urban Air Kennesaw | Kennesaw | Urban Air |
| sky-zone-roswell | Sky Zone Roswell | Roswell | Sky Zone |
| sky-zone-alpharetta | Sky Zone Alpharetta | Alpharetta | Sky Zone |

## Files

- Crawlers: `/Users/coach/Projects/LostCity/crawlers/sources/{defy,urban_air,sky_zone}_atlanta.py`
- Migration: `/Users/coach/Projects/LostCity/database/migrations/093_trampoline_parks.sql`
- Docs: `/Users/coach/Projects/LostCity/crawlers/TRAMPOLINE_PARKS_CRAWLERS.md`
- Registry: `/Users/coach/Projects/LostCity/crawlers/main.py` (SOURCE_MODULES)
