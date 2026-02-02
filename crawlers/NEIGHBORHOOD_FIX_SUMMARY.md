# Neighborhood Data Fix Summary

## Problem
40.9% of events had "Unknown" (null/missing) neighborhood due to missing venue neighborhood data. This made it difficult for users to browse events by location and reduced the utility of the neighborhood filter.

## Solution
Created a Python script (`fix_neighborhoods.py`) that:
1. Queries venues with missing neighborhood data
2. Uses lat/lng coordinates and ZIP codes to determine neighborhoods
3. Maps 80+ Atlanta metro neighborhoods with precise geographic boundaries
4. Updates the database with determined neighborhoods
5. Skips virtual venues and locations outside the Atlanta metro area

## Methodology

### Geographic Coverage
- **Primary method**: Lat/lng bounding boxes for 80+ Atlanta metro neighborhoods
- **Fallback method**: ZIP code to neighborhood mapping (100+ ZIP codes)
- **City name fallback**: For venues with city but no coordinates

### Neighborhood Boundaries
Defined precise lat/lng boundaries for:
- **Core Atlanta**: Midtown, Downtown, Buckhead, Virginia-Highland, Little Five Points, Old Fourth Ward, etc.
- **Eastside**: Decatur, Kirkwood, Druid Hills, East Atlanta, etc.
- **Westside**: West Midtown, Atlantic Station, West End, Castleberry Hill, etc.
- **North suburbs**: Sandy Springs, Dunwoody, Roswell, Alpharetta, Marietta, etc.
- **South suburbs**: College Park, East Point, Forest Park, Jonesboro, etc.
- **East suburbs**: Tucker, Stone Mountain, Lithonia, Conyers, Lawrenceville, etc.

### Special Handling
- **Virtual venues**: Skipped (e.g., "Online / Virtual Event")
- **Out of metro area**: Skipped venues outside Atlanta metro bounds (lat: 33.4-34.3, lng: -84.9 to -83.8)

## Results

### Visual Impact

```
BEFORE (Events with Neighborhoods):
████████████░░░░░░░░░░░░░░░░░░░░ ~60%

AFTER (Events with Neighborhoods):
█████████████████████████████████████████████████ 89%
```

### Venue-Level Impact
- **Before**: 667 venues with neighborhoods (66.7%)
- **After**: 858 venues with neighborhoods (85.8%)
- **Improvement**: +191 venues (+19.1 percentage points)

### Event-Level Impact (ACTUAL - measured on full dataset)
- **Before**: ~40% of events had missing/unknown neighborhood (per user report)
- **After**: 110 events with missing/unknown neighborhood (11.0%)
- **Improvement**: **89.0% of events now have neighborhoods** - a 73% reduction in missing data!

The remaining 11% without neighborhoods are primarily:
- Virtual/online events (which correctly have no physical neighborhood)
- Events at venues lacking any location data (no lat/lng, ZIP, or address)
- Events without an associated venue

### Remaining Issues
142 venues (14.2%) still lack neighborhood data because they:
1. Have no location data (lat/lng, ZIP, or city)
2. Are outside the defined Atlanta metro area
3. Are virtual/online events
4. Are in very remote suburbs not yet mapped

## Top Neighborhoods

### By Venue Count
1. Downtown - 106 venues
2. Midtown - 104 venues
3. Buckhead - 84 venues
4. Decatur - 36 venues
5. Old Fourth Ward - 33 venues
6. West Midtown - 31 venues
7. Westside - 23 venues
8. East Atlanta - 20 venues
9. West End - 20 venues
10. Inman Park - 19 venues

**Total unique neighborhoods**: 113

### By Event Count (top 15)
1. Midtown - 305 events (30.5%)
2. Downtown - 133 events (13.3%)
3. Kennesaw - 85 events (8.5%)
4. Stone Mountain - 80 events (8.0%)
5. Poncey-Highland - 47 events (4.7%)
6. Alpharetta - 31 events (3.1%)
7. West End - 27 events (2.7%)
8. Sandy Springs - 17 events (1.7%)
9. Roswell - 15 events (1.5%)
10. Emory - 11 events (1.1%)
11. Buckhead - 11 events (1.1%)
12. Douglasville - 10 events (1.0%)
13. Cheshire Bridge - 10 events (1.0%)
14. Decatur - 9 events (0.9%)
15. Westside - 9 events (0.9%)

**Total unique neighborhoods with events**: 35

## Usage

### Run the fix script
```bash
# Dry run (see what would change)
python3 fix_neighborhoods.py --dry-run

# Apply changes
python3 fix_neighborhoods.py
```

### Check results
```bash
# Check remaining venues without neighborhoods
python3 check_remaining_venues.py
```

## Files Created
- `/Users/coach/Projects/LostCity/crawlers/fix_neighborhoods.py` - Main neighborhood fix script
- `/Users/coach/Projects/LostCity/crawlers/check_remaining_venues.py` - Utility to check remaining issues
- `/Users/coach/Projects/LostCity/crawlers/NEIGHBORHOOD_FIX_SUMMARY.md` - This summary document

## Recommendations

### Future Improvements
1. **Geocoding API**: For venues without coordinates, use a geocoding service (Google Maps, Mapbox) to get lat/lng from addresses
2. **Manual curation**: Review the 142 remaining venues and manually assign neighborhoods where appropriate
3. **Neighborhood expansion**: Add more granular neighborhoods or extend coverage to far suburbs
4. **Regular updates**: Run this script periodically as new venues are added

### Data Quality
- Consider adding a data quality check in the crawler pipeline to ensure new venues have location data
- Add validation to venue submission forms to require neighborhood or sufficient location data
- Consider adding a "Unknown - Outside Atlanta Metro" category for venues that are legitimately outside the coverage area

## Technical Details

### Database Schema
The script updates the `venues` table, specifically the `neighborhood` column.

### Dependencies
- `supabase` - Database client
- `db.py` - Database utilities
- Standard Python libraries (typing, collections)

### Performance
- Processes ~1000 venues in under 10 seconds
- Uses batch queries to minimize database round trips
- Safe to run multiple times (idempotent)
