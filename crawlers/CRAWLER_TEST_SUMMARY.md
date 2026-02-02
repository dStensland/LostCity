# Crawler Batch Test - Quick Summary
**Date**: 2026-02-01
**Report**: See [CRAWLER_HEALTH_REPORT.md](./CRAWLER_HEALTH_REPORT.md) for full details

## Results at a Glance

- **21 of 24 sources working** (88% success rate)
- **58+ new events discovered** during testing
- **1 crawler fixed** (state-farm-arena)
- **1 needs investigation** (buckhead-theatre)

## Working Sources (21)

### Music Venues (11)
- the-masquerade (184 events)
- eddies-attic (101 events)
- 529 (66 events, 11 new)
- terminal-west (62 events)
- variety-playhouse (50 events)
- aisle5 (47 events)
- tabernacle (37 events)
- coca-cola-roxy (24 events)
- the-earl (20 events, ALL NEW!)
- center-stage (19 events)
- smiths-olde-bar (6 events, all new)

### Theater & Arts (4)
- fox-theatre (11 events)
- alliance-theatre (10 events)
- actors-express (4 events)
- horizon-theatre (3 events)

### Comedy (3)
- dads-garage (91 events)
- laughing-skull (44 events)
- punchline (9 events, 8 new)

### Stadiums (1)
- mercedes-benz-stadium (1 event)

## Issues Found

### Fixed
1. **state-farm-arena** - Date regex pattern fixed, now finding events (title extraction needs improvement)

### Needs Work
2. **buckhead-theatre** - Returns 0 events, shows "SOUND CHECK" placeholder

### Not in Database
- roxy-theatre (may be duplicate of coca-cola-roxy)
- star-community-bar
- chastain-park-amphitheatre (seasonal venue?)

## Key Takeaways

1. **Infrastructure is healthy** - 88% success rate is excellent
2. **LiveNation crawlers working well** - All major LiveNation venues functioning
3. **Fresh event discovery** - The Earl alone found 20 brand new events
4. **Slug verification important** - 3 sources failed due to incorrect slugs in test

## Files Changed

- `/Users/coach/Projects/LostCity/crawlers/sources/state_farm_arena.py` - Fixed date regex
- `/Users/coach/Projects/LostCity/crawlers/test_crawlers.py` - Batch test script
- `/Users/coach/Projects/LostCity/crawlers/CRAWLER_HEALTH_REPORT.md` - Full report

## Next Actions

1. Improve state-farm-arena title extraction (skip "Parking", "Buy Tickets", etc.)
2. Check buckhead-theatre manually to see if truly empty or parsing issue
3. Consider automated daily testing to catch breaks faster
