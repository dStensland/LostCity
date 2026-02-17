# Fernbank Science Center Crawler

## Overview

Built a crawler for **Fernbank Science Center** in Atlanta's Druid Hills neighborhood. This is distinct from Fernbank Museum of Natural History (which already has a crawler).

**Important**: Fernbank Science Center is operated by DeKalb County Schools and offers FREE admission to all programs.

## Implementation

### Files Created

1. **`sources/fernbank_science_center.py`** - Main crawler implementation
2. **`register_fernbank_science_center.py`** - Database registration script

### Technical Details

- **Venue ID**: 225
- **Source ID**: 1074
- **Slug**: `fernbank-science-center`
- **Portal**: Atlanta (74c2f211-ee11-453d-8386-ac2861705695)
- **Method**: `requests` + `BeautifulSoup` (no Playwright needed - static HTML site)
- **Website**: http://www.fernbank.edu

### Crawler Strategy

The crawler focuses on special time-based events from the homepage "Upcoming Events" section. It does NOT crawl:

- Regular planetarium shows (recurring)
- Permanent exhibits (no dates)
- Daily operations

### Event Categories

The crawler intelligently categorizes events:

- **Learning** - Cosmic Conversations (astronomy talks)
- **Music** - Music Under the Moon (planetarium concerts)
- **Family** - Fernbank Goes Wild (nature events)
- **Community** - Retro Science Night (adults-only events)
- **Wellness** - Planetarium Sound Baths (meditation)

### Tags

All events are tagged with:
- `fernbank-science-center`
- `science`
- `planetarium`
- `druid-hills`
- `free`

Plus category-specific tags (e.g., `astronomy`, `concert`, `nature`, `sound-bath`)

## Current Data (as of 2026-02-16)

Successfully crawled **5 events**:

1. **Cosmic Conversations** - Feb 26, 2026 (learning)
2. **Music Under the Moon** - Feb 27, 2026 @ 7pm (music)
3. **Fernbank Goes Wild** - Mar 7, 2026 @ 10:30am (family)
4. **Retro Science Night** - Mar 13, 2026 @ 6pm (community)
5. **Planetarium Sound Baths** - Mar 19, 2026 @ 6pm (wellness)

All events correctly marked as `is_free: true`.

## Testing

```bash
# Run the crawler
python3 main.py --source fernbank-science-center

# Check results
python3 -c "
from db import get_client
supabase = get_client()
result = supabase.table('events').select('*').eq('venue_id', 225).execute()
print(f'Found {len(result.data)} events')
"
```

## Notes

- The site is built with Mobirise (static HTML generator)
- Date formats vary: "Feb 26th, April 30th" vs "Friday, February 27, 7:00 PM"
- Some events have multiple dates (handled by taking first date)
- Extraction confidence: 0.88
- Free admission funded by DeKalb County Schools system
