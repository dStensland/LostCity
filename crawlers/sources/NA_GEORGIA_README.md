# Narcotics Anonymous Metro Atlanta Crawler

## Overview

The `na_georgia.py` crawler fetches Narcotics Anonymous meeting data for the Metro Atlanta region from the Georgia Regional Service Committee's BMLT (Basic Meeting List Toolbox) server.

## Data Source

- **API**: BMLT JSON API at `https://bmlt.sezf.org/main_server`
- **Coverage**: 6 Metro Atlanta service bodies
  - Midtown Atlanta Area (ID: 64)
  - North Atlanta Area (ID: 65)
  - South Atlanta Area (ID: 69)
  - Marietta Area (ID: 63)
  - Southwest Atlanta Area (ID: 168)
  - West Georgia Area (ID: 123)

## Key Features

- Fetches ~211 weekly recurring meetings across Metro Atlanta
- Generates events for the next 4 weeks
- Creates proper venue records for all meeting locations
- Handles meeting formats (Open, Closed, Discussion, Spanish, LGBTQ+, etc.)
- Links meetings to series for recurring show management
- Properly tags meetings with wellness, support-group, free

## Source Status

**INACTIVE** - This source is registered in the database but marked as `is_active = False`. Support group meetings are stored for completeness but not surfaced in public feeds.

## Running the Crawler

```bash
# To test (temporarily activate first):
python3 -c "from db import get_client; client = get_client(); client.table('sources').update({'is_active': True}).eq('slug', 'na-georgia').execute()"
python3 main.py --source na-georgia

# Then deactivate again:
python3 -c "from db import get_client; client = get_client(); client.table('sources').update({'is_active': False}).eq('slug', 'na-georgia').execute()"
```

## Meeting Format Codes

The crawler parses BMLT format codes:
- O = Open
- C = Closed
- D = Discussion
- SP/ES = Spanish
- LGBTQ = LGBTQ+
- W = Women
- M = Men
- B/BEG = Beginners
- Y/YP = Young People

## Venue Types

Meeting locations are classified as:
- `church` - Churches and religious buildings
- `community_center` - Recovery clubs (Galano Club, Triangle Club, NABA Club, 8111 Clubhouse, etc.)
- `library` - Public libraries

## Tags Applied

All events get:
- `support-group`
- `free`
- `wellness`

Additional tags based on meeting format:
- `lgbtq` (for LGBTQ+ meetings)
- `spanish` (for Spanish-language meetings)
- `women` (for women-only meetings)

## Known Recovery Venues

The crawler recognizes these recovery-focused community centers:
- 365 Center Inc
- Galano Club (LGBTQ+ recovery center)
- Triangle Club
- NABA Club
- 8111 Clubhouse

## Pattern Comparison

This crawler follows the same pattern as `aa_atlanta.py` (Alcoholics Anonymous Atlanta Intergroup), using JSON API instead of HTML scraping.
