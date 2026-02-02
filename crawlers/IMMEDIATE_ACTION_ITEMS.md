# Immediate Action Items - Coverage Gaps
**Priority**: CRITICAL  
**Timeline**: Next 2 Weeks  
**Expected Impact**: 500+ additional events

---

## 1. Fix Decatur Coverage (HIGHEST PRIORITY)

**Current State**: 4 events from a major events destination  
**Expected State**: 50-100 events  
**ROI**: VERY HIGH - Decatur is one of Atlanta's top events hubs

### Sources to Debug:
```bash
# Test each crawler individually
python3 main.py --source decatur-city
python3 main.py --source visit-decatur  
python3 main.py --source decatur-arts-festival
python3 main.py --source decatur-book-festival
python3 main.py --source eddies-attic
```

### What to Check:
1. **decatur-city**: City calendar page structure may have changed
2. **visit-decatur**: Tourism site - should have comprehensive event listings
3. **eddies-attic**: Major music venue in Decatur - only 2 events in last month (should be 15+)

### Files:
- `/Users/coach/Projects/LostCity/crawlers/sources/decatur_city.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/visit_decatur.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/eddies_attic.py`

---

## 2. Fix Major Music Venue Crawlers

**Current State**: Combined 10 events from venues that should have 100+  
**Expected State**: 15-30 events per venue per month  
**ROI**: HIGH - These are marquee venues

### Underperforming Venues:

| Venue | Current | Expected | Slug |
|-------|---------|----------|------|
| Terminal West | 2 | 20+ | `terminal-west` |
| The Masquerade | 2 | 30+ | `the-masquerade` |
| Tabernacle | 2 | 10+ | `tabernacle` |
| Variety Playhouse | 1 | 15+ | `variety-playhouse` |
| The Earl | 1 | 20+ | `the-earl` |

### Test Commands:
```bash
python3 main.py --source terminal-west
python3 main.py --source the-masquerade
python3 main.py --source tabernacle
python3 main.py --source variety-playhouse
python3 main.py --source the-earl
```

### Potential Issues:
1. **Ticketmaster dependency**: Many venues feed from Ticketmaster API
2. **Calendar format changes**: Venue websites may have been redesigned
3. **Event visibility**: Some events may be hidden behind "load more" buttons
4. **Recurring events**: Weekly shows might not be captured

### Files:
- `/Users/coach/Projects/LostCity/crawlers/sources/terminal_west.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/the_masquerade.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/tabernacle.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/variety_playhouse.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/the_earl.py`

---

## 3. Fix Little Five Points Neighborhood Coverage

**Current State**: 0 events in neighborhood (venues producing elsewhere)  
**Expected State**: 50+ events from L5P  
**ROI**: HIGH - Major cultural district

### Issue:
Venues have crawlers but neighborhood geocoding may be wrong. Events from L5P venues appearing under different neighborhoods.

### Check These Venues:
```bash
# Verify venue records in database
psql -c "SELECT id, name, neighborhood, lat, lng FROM venues WHERE name IN ('The Earl', 'Variety Playhouse', 'Criminal Records', '529');"

# Test crawlers
python3 main.py --source the-earl
python3 main.py --source variety-playhouse
python3 main.py --source 529
python3 main.py --source criminal-records
```

### What to Fix:
1. Update venue records to set `neighborhood = 'Little Five Points'`
2. Verify lat/lng are within L5P boundaries (33.764, -84.349)
3. Ensure crawlers are capturing events correctly

---

## 4. Activate Alpharetta/Avalon Coverage

**Current State**: 29 events (mostly from one venue)  
**Expected State**: 80+ events  
**ROI**: MEDIUM-HIGH - Affluent suburb with major shopping/dining

### Source to Activate:
```bash
# Check if source exists and is active
psql -c "SELECT slug, name, is_active FROM sources WHERE slug = 'avalon-alpharetta';"

# If inactive, activate it:
psql -c "UPDATE sources SET is_active = true WHERE slug = 'avalon-alpharetta';"

# Test crawler
python3 main.py --source avalon-alpharetta
```

### Also Add:
- Alpharetta City events calendar
- Wills Park events

---

## 5. Fix Gas South Arena (Duluth)

**Current State**: 7 events (sporadic)  
**Expected State**: 20-40 events/year  
**ROI**: MEDIUM - Major OTP arena

### Test Command:
```bash
python3 main.py --source gas-south
```

### What to Check:
- Arena likely uses Ticketmaster or AXS for ticketing
- May need direct venue calendar scraping
- Check if crawler is capturing all event types (concerts, sports, family shows)

### File:
- `/Users/coach/Projects/LostCity/crawlers/sources/gas_south.py`

---

## 6. Fix YMCA Atlanta Syntax Error

**Current State**: Crawler failing due to syntax error  
**Expected State**: Running without errors  
**ROI**: MEDIUM - Multiple locations, family events

### Error:
```
unexpected indent (ymca_atlanta.py, line 176)
```

### Fix:
```bash
# Open file and fix indentation
nano /Users/coach/Projects/LostCity/crawlers/sources/ymca_atlanta.py
# Go to line 176 and fix indentation issue

# Test
python3 main.py --source ymca-atlanta
```

---

## 7. Debug Ticketmaster Integration

**Current State**: Multiple Ticketmaster-dependent venues underperforming  
**Expected State**: Consistent event streams from TM venues  
**ROI**: VERY HIGH - Affects 20+ venues

### Test Command:
```bash
python3 main.py --source ticketmaster
```

### What to Check:
1. API key validity
2. Rate limiting (may need to slow down requests)
3. Venue ID mapping (ensure all major venues are queried)
4. Event type filtering (capturing concerts, sports, theater, etc.)

### File:
- `/Users/coach/Projects/LostCity/crawlers/sources/ticketmaster.py`

---

## 8. Fix State Farm Arena & Mercedes-Benz Stadium

**Current State**: 1 event each in last month  
**Expected State**: 5-10 events/month (State Farm), 3-5/month (Mercedes-Benz)  
**ROI**: HIGH - Major Atlanta venues

### Test Commands:
```bash
python3 main.py --source state-farm-arena
python3 main.py --source mercedes-benz-stadium
```

### Likely Issue:
- Both likely feed from Ticketmaster
- May be related to Ticketmaster API issue (#7 above)
- Could also have venue-specific calendars worth scraping

---

## Priority Order

1. **Decatur Coverage** (30 min - 2 hours)
   - Impact: +50-100 events
   - Files: 4 crawlers to debug
   
2. **YMCA Syntax Error** (5 min)
   - Impact: Prevent crawler crashes
   - Files: 1 file to fix

3. **Ticketmaster Integration** (1-3 hours)
   - Impact: +200-300 events (affects many venues)
   - Files: 1 core crawler

4. **Major Music Venues** (2-4 hours)
   - Impact: +100-150 events
   - Files: 5 crawlers to debug

5. **Little Five Points Geocoding** (30 min)
   - Impact: +50 events (reclassified)
   - Action: Database updates

6. **Alpharetta/Avalon** (1 hour)
   - Impact: +50 events
   - Action: Activate + test

7. **Gas South Arena** (1 hour)
   - Impact: +20-30 events
   - Files: 1 crawler

8. **Major Stadiums** (1-2 hours)
   - Impact: +20-30 events
   - Files: 2 crawlers

---

## Testing Checklist

After each fix, verify:

```bash
# 1. Crawler runs without errors
python3 main.py --source [source-slug]

# 2. Check events were created
psql -c "SELECT COUNT(*) FROM events WHERE source_id = (SELECT id FROM sources WHERE slug = '[source-slug]') AND created_at > NOW() - INTERVAL '1 day';"

# 3. Check event quality (sample)
psql -c "SELECT title, start_date, venue_id FROM events WHERE source_id = (SELECT id FROM sources WHERE slug = '[source-slug]') ORDER BY created_at DESC LIMIT 5;"

# 4. Verify venue linkage
psql -c "SELECT e.title, v.name, v.neighborhood FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.source_id = (SELECT id FROM sources WHERE slug = '[source-slug]') ORDER BY e.created_at DESC LIMIT 5;"
```

---

## Success Metrics

After completing these 8 items, we should see:

- **Total events**: +500-700 (from current 994 to ~1,500)
- **Active sources**: +8-10 (from 53 to ~60)
- **Decatur representation**: 50-100 events (from 4)
- **Music venue coverage**: 100+ events (from ~10)
- **Error rate**: Reduced from 150 to <100

---

## Notes

- All file paths are relative to `/Users/coach/Projects/LostCity/crawlers/`
- Use `--force` flag to bypass circuit breaker: `python3 main.py --source [slug] --force`
- Check crawl logs for detailed error messages: `psql -c "SELECT * FROM crawl_logs WHERE status = 'error' ORDER BY started_at DESC LIMIT 20;"`
- If a crawler fails repeatedly, check for:
  - Website redesigns (DOM structure changed)
  - Anti-scraping measures (need to add delays, user agents)
  - API changes (endpoints, authentication)
  - Network issues (timeouts, rate limiting)

---

**Document Created**: 2026-02-01  
**Created By**: data-quality specialist  
**Related Reports**: 
- `/Users/coach/Projects/LostCity/ATLANTA_COVERAGE_GAP_ANALYSIS_2026-02-01.md`
