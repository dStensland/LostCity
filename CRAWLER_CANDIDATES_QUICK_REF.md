# Crawler Candidates - Quick Reference

## Immediate Action Items (Top 4)

### 1. The Punchline Comedy Club ⭐⭐⭐
- **URL:** https://www.punchline.com
- **ID:** 142 | **Type:** comedy_club | **Location:** Sandy Springs
- **Impact:** 200+ shows/year, premier comedy venue
- **Difficulty:** LOW - standard ticketing

### 2. Monday Night Brewing ⭐⭐⭐
- **URL:** http://mondaynightbrewing.com
- **ID:** 371 | **Type:** brewery | **Location:** Westside
- **Impact:** 100+ events/year, very popular
- **Difficulty:** LOW - brewery calendar

### 3. Center Stage Complex ⭐⭐⭐
- **URL:** https://www.centerstage-atlanta.com
- **IDs:** 972, 973, 974 | **Type:** music_venue | **Location:** Midtown
- **Impact:** 150+ shows/year, major touring acts
- **Difficulty:** MEDIUM - 3 rooms, Ticketmaster integration

### 4. Fernbank Museum ⭐⭐⭐
- **URL:** https://www.fernbankmuseum.org
- **ID:** 212 | **Type:** museum | **Location:** Druid Hills
- **Impact:** 75+ events/year, major cultural institution
- **Difficulty:** MEDIUM - exhibitions + events

---

## All 23 Missing Crawlers (by category)

### Music Venues (7)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| Center Stage Complex | centerstage-atlanta.com | 972-974 | Midtown | ⭐⭐⭐ |
| Smith's Olde Bar | smithsoldebar.com | 970 | Midtown | ⭐⭐ |
| Aisle 5 | aisle5atlanta.com | 965 | Edgewood | ⭐⭐ |
| Apache Cafe | apachecafe.net | 969 | Poncey-Highland | ⭐ |
| MadLife Stage | madlifestage.com | 1309 | Duluth | ⭐ |
| Perfect Note | perfectnoteatl.com | 1338 | Chamblee | ⭐ |

### Comedy (2)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| The Punchline | punchline.com | 142 | Sandy Springs | ⭐⭐⭐ |
| Laughing Skull | laughingskulllounge.com | 140 | Midtown | ⭐⭐ |

### Breweries (3)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| Monday Night | mondaynightbrewing.com | 371 | Westside | ⭐⭐⭐ |
| SweetWater | sweetwaterbrew.com | 420 | Armour | ⭐⭐⭐ |
| New Realm | newrealmbrewing.com | 925 | Virginia-Highland | ⭐ |

### Museums (2)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| Fernbank Museum | fernbankmuseum.org | 212 | Druid Hills | ⭐⭐⭐ |
| Puppetry Arts | puppet.org | 196 | Midtown | ⭐⭐⭐ |

### Bars (3)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| 529 Bar | 529atl.com | 1009 | East Atlanta | ⭐ |
| Church | churchatlanta.com | 581 | Little Five Points | ⭐ |
| The Porter | theporterbeerbar.com | 916 | Little Five Points | ⭐ |

### Galleries (2)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| Chastain Arts | chastainarts.org | 1347 | Chastain Park | ⭐ |
| Mint Gallery | mintgallery.com | 246 | Edgewood | ⭐ |

### Theater (2)
| Name | URL | ID | Location | Priority |
|------|-----|----|----|----------|
| Actor's Express | actors-express.com | 152 | West Midtown | ⭐ |
| Out Front | outfronttheatre.com | 1233 | Midtown | ⭐ |

### Other (3)
| Name | Type | URL | ID | Location | Priority |
|------|------|-----|----|----|----------|
| Eagle Eye Books | Bookstore | eagleeyebooks.com | 274 | Decatur | ⭐ |
| The Battery | Entertainment | batteryatl.com | 897 | Cumberland | ⭐⭐ |

---

## Expected Impact by Phase

### Phase 1 (Quick Wins)
- **Venues:** 4
- **Events Added:** 600-700/year
- **Time:** 1-2 weeks

### Phase 2 (High-Value)
- **Venues:** 4
- **Events Added:** 400-500/year
- **Time:** 2-3 weeks

### Phase 3 (Fill Gaps)
- **Venues:** 5
- **Events Added:** 300-400/year
- **Time:** 2-3 weeks

**Total Potential:** 1,300-1,600 events/year from 23 venues

---

## Quick Filter Commands

```bash
# Check if crawler already exists
ls crawlers/sources/ | grep -i "punchline\|monday_night\|center_stage\|fernbank"

# Count existing vs missing
ls crawlers/sources/*.py | wc -l  # Current: 471

# Priority venues only
# Music: center_stage, smiths_olde_bar, aisle_5
# Comedy: the_punchline, laughing_skull
# Brewery: monday_night, sweetwater
# Museum: fernbank, puppetry_arts
```

---

## Slug Reference

For creating new crawler files:

| Venue Name | Suggested Slug |
|------------|----------------|
| The Punchline | `the_punchline.py` |
| Monday Night Brewing | `monday_night_brewing.py` |
| Center Stage | `center_stage.py` |
| Fernbank Museum | `fernbank_museum.py` |
| SweetWater Brewing | `sweetwater_brewing.py` |
| Center for Puppetry Arts | `center_for_puppetry_arts.py` |
| Smith's Olde Bar | `smiths_olde_bar.py` |
| Laughing Skull Lounge | `laughing_skull_lounge.py` |
| Aisle 5 | `aisle5.py` |
| The Battery Atlanta | `battery_atlanta.py` |

