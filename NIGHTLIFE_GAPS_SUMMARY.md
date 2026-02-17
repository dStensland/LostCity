# Nightlife Data Gaps - Quick Reference

**Date:** 2026-02-14  
**Status:** 9 of 16 new nightlife subcategories have ZERO events

---

## Critical Gaps (0 events)

| Genre | Description | Fix |
|-------|-------------|-----|
| **poker** | Poker nights | Recategorize Freeroll Atlanta crawler |
| **bingo** | Bingo nights | Upgrade Sister Louisa's, Joystick crawlers |
| **bar-games** | Pool, darts, cornhole | Upgrade Painted Duck, Ormsby's crawlers |
| **latin-night** | Salsa, bachata, reggaeton | Check Havana Club, Opera crawlers |
| **line-dancing** | Country nights | Build Wild Bill's crawler |
| **pub-crawl** | Organized bar crawls | Build Atlanta Pub Crawl crawler |
| **specials** | Taco Tuesday, wing nights | TBD (may be venue metadata) |
| **strip** | Strip club events | Add Clermont Lounge events (w/ sensitivity flag) |
| **lifestyle** | Alternative/fetish events | TBD (sensitivity concerns) |

---

## Quick Wins (Immediate Fixes)

### 1. Freeroll Atlanta (60+ events)
**File:** `crawlers/sources/freeroll_atlanta.py`  
**Change:** Line 198: `"category": "community"` → `"category": "nightlife"`  
**Add:** Line 199: `"genres": ["poker"]`

### 2. Genre Inference Rules
**File:** `crawlers/tag_inference.py`  
**Add to `infer_genres()` function:**
```python
import re

nightlife_patterns = {
    "bingo": r"\bbingo\b",
    "poker": r"\b(poker|texas hold.?em)\b",
    "trivia": r"\b(trivia|quiz night)\b",
    "karaoke": r"\bkaraoke\b",
    "bar-games": r"\b(pool tournament|darts|cornhole|skee.?ball|bocce)\b",
    "latin-night": r"\b(salsa night|bachata|latin night|reggaeton)\b",
    "line-dancing": r"\b(line dancing|country night)\b",
    "drag": r"\b(drag show|drag queen|drag brunch)\b",
    "dj": r"\b(dj|dance party|edm night)\b",
}

combined_text = f"{event.get('title', '')} {event.get('description', '')}".lower()
for genre, pattern in nightlife_patterns.items():
    if re.search(pattern, combined_text, re.IGNORECASE):
        inferred.append(genre)
```

---

## Current Coverage (Good)

| Genre | Events | Status |
|-------|--------|--------|
| karaoke | 96 | ✅ Excellent |
| drag | 41 | ✅ Good |
| dj | 32 | ✅ Good |
| trivia | 22 | ✅ Good |
| game-night | 22 | ✅ Good |
| burlesque | 15 | ✅ Adequate |

---

## Nightlife Stats

- **Total nightlife events:** 348
- **Events with genres:** 221 (64%)
- **Events missing genres:** 127 (36%) ← Quality gap
- **Nightlife venues:** 417 (305 bars, 61 nightclubs, 43 breweries)
- **Nightlife_mode compound filter:** 2,766 events (includes music/comedy at bars)

---

## Crawler Inventory

### Active Event Crawlers
- Joystick Gamebar (nightlife events)
- MJQ Concourse (DJ/dance events)
- Freeroll Atlanta (poker, MISCATEGORIZED as community)
- Blake's on the Park (drag shows)
- District Atlanta, Opera, Tongue & Groove, etc.

### Venue-Only (Need Upgrade)
- Sister Louisa's (has drag bingo, not crawled)
- The Painted Duck (has bar games, not crawled)
- Ormsby's (has bocce leagues, not crawled)
- Highland Tap (has pool/darts, check coverage)

### Missing Crawlers (High Priority)
- Havana Club Events (latin nights)
- Wild Bill's (line dancing)
- Atlanta Pub Crawl (pub crawls)

---

## Next Steps

1. ✅ Fix Freeroll Atlanta category → poker events appear
2. ✅ Add genre inference rules → auto-tag existing events
3. ⚠️ Upgrade Sister Louisa's → bingo coverage
4. ⚠️ Upgrade Painted Duck/Ormsby's → bar-games coverage
5. 🔄 Build Havana Club events crawler → latin-night coverage
6. 🔄 Decide on specials strategy (events vs venue metadata)
7. 🔄 Decide on adult entertainment policy (Clermont Lounge, etc.)

---

**Full diagnostic:** `/Users/coach/Projects/LostCity/crawlers/NIGHTLIFE_DATA_DIAGNOSTIC.md`
