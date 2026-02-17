# Museum & Gallery Research: Executive Summary

**Date**: 2026-02-16  
**Analyst**: data-quality  
**Scope**: 23 Atlanta-area museums and galleries

## Results at a Glance

| Status | Count | Action |
|--------|-------|--------|
| CRAWLABLE | 8 | Build crawlers |
| NOT_CRAWLABLE | 7 | Mark inactive or skip |
| PERMANENT_ATTRACTION | 5 | No crawler needed |
| NEEDS_VERIFICATION | 3 | Manual check required |

---

## Priority 1: Build These Crawlers First

These venues have active, changing content and clear structure:

### 1. APEX Museum (ID: 216)
- **Best URL**: https://www.apexmuseum.org/events-2026
- **Content**: Events + rotating exhibitions
- **Platform**: Squarespace
- **Why**: Major African American history museum with active programming

### 2. Hammonds House Museum (ID: 218)
- **Best URL**: http://www.hammondshousemuseum.org/current-exhibit
- **Content**: Current exhibitions (also has /events page)
- **Platform**: Squarespace (likely)
- **Why**: Prominent art museum with regular exhibition changes
- **Current**: "Beau McCall: Divas, Blues, and Memories"

### 3. Jimmy Carter Presidential Library (ID: 220)
- **Best URL**: http://www.jimmycarterlibrary.gov/events
- **Content**: Events calendar (lectures, programs, book clubs)
- **Platform**: Custom CMS
- **Why**: Presidential library with regular public programs

### 4. Sandler Hudson Gallery (ID: 237)
- **Best URL**: http://www.sandlerhudson.com/
- **Content**: Current exhibition (crawl homepage)
- **Platform**: Custom
- **Why**: Active contemporary art gallery with clear exhibition schedule
- **Current**: "This Is Not That: Peter Lynch" (Feb 13 - Mar 28, 2026)

---

## Priority 2: Educational Institutions

### 5. Clark Atlanta University Art Museum (ID: 304)
- **Best URL**: https://www.cau.edu/about/cultural-contributions/clark-atlanta-university-art-museum/current-exhibitions
- **Content**: Current exhibitions
- **Platform**: University CMS
- **Why**: University museum with rotating exhibitions
- **Current**: "Uncommon Nature"

### 6. The King Center (ID: 986)
- **Best URL**: https://thekingcenter.org/events/
- **Content**: Events (talks, programs, tours)
- **Platform**: WordPress (likely)
- **Why**: Historic site with educational programming

---

## Priority 3: Verify Before Building

### 7. Millennium Gate Museum (ID: 4062)
- **URL**: https://www.thegatemuseum.org/exhibitions
- **Note**: Has exhibitions page but may be outdated. Manual check needed.

### 8. African Diaspora Art Museum - ADAMA (ID: 2433)
- **URL**: https://www.adamatl.org/events
- **Note**: Site shows "temporarily closed" warning. Verify reopening status first.
- **Content**: Arts Salon events series

---

## Deferred: Need Manual Verification

These galleries may be active but need human verification:

| Venue | ID | URL | Issue |
|-------|-----|-----|-------|
| Whitespace Gallery | 234 | https://whitespace814.com/exhibitions | JavaScript-heavy site, couldn't parse headings |
| Marcia Wood Gallery | 238 | http://www.marciawoodgallery.com/exhibitions/ | Has 2026 content but need to verify regular updates |
| Mason Fine Art | 236 | https://masonfineartandevents.com/exhibitions | Minimal content in scrape, verify if active |

---

## Do Not Build Crawlers

### Currently Closed

| Venue | ID | Reason |
|-------|-----|--------|
| MOCA GA | 586 | Temporarily closed (confirmed) |
| CDC Museum | 3786 | Website states "temporarily closed" |

### Technical Issues

| Venue | ID | Reason |
|-------|-----|--------|
| SCAD FASH Museum | 1247 | Returns 403 Forbidden |
| Poem88 Gallery | 435 | SSL certificate error |

### Defunct or Inactive

| Venue | ID | Reason |
|-------|-----|--------|
| Get This Gallery | 245 | **DEFUNCT** - Domain is now a parking page "for sale" |
| Besharat Gallery | 242 | Website is empty landing page, no exhibition info |
| Hathaway Contemporary | 463 | No dates in 2026/2027, appears inactive |

### Permanent Attractions (No Changing Exhibitions)

| Venue | ID | Reason |
|-------|-----|--------|
| World of Coca-Cola | 209 | Tourist attraction with static exhibits |
| Trap Music Museum | 4073 | Fixed exhibit space, no changing exhibitions |
| Margaret Mitchell House | 224 | Historic house, no exhibitions program |
| Rhodes Hall | 4049 | Historic house used as event venue |
| Fernbank Science Center | 225 | Likely duplicate of Fernbank Museum (check if we already crawl it) |

---

## Technical Notes for Crawler Development

### Common Extraction Patterns

Museums and galleries need different handling than bars/music venues:

| Field | Museum/Gallery Specifics |
|-------|--------------------------|
| **Event Duration** | Exhibitions run weeks/months. Extract start + end dates. |
| **Event Type** | "Exhibition" or "Opening Reception" (one-time events) |
| **Title** | Exhibition title + artist name. E.g., "Beau McCall: Divas, Blues, and Memories" |
| **Description** | Curator statement, artist bio, exhibition overview |
| **Image** | Exhibition artwork image (often on exhibition page) |
| **Tickets/RSVP** | Most exhibitions are free; openings may need RSVP |

### Series Grouping

- **Exhibitions** should be long-running events (start_date → end_date)
- **Opening receptions** should be separate one-time events linked to the exhibition
- **Artist talks/workshops** during exhibitions should reference the exhibition in description

### Platform-Specific Notes

- **Squarespace**: Look for calendar widgets, structured JSON-LD, or API endpoints
- **WordPress**: Check for event plugins (The Events Calendar, Modern Events Calendar)
- **Custom CMS**: May need Playwright for JavaScript-rendered content

---

## Database Cleanup Required

Run these SQL updates after verification:

```sql
-- Mark defunct venue as inactive
UPDATE venues 
SET active = false, 
    notes = 'Gallery defunct - domain now parking page (verified 2026-02-16)'
WHERE id = 245; -- Get This Gallery

-- Check for existing Fernbank sources (to avoid duplication)
SELECT * FROM sources WHERE name ILIKE '%fernbank%';

-- Check for existing Atlanta History Center crawlers (may cover Margaret Mitchell House)
SELECT * FROM sources WHERE name ILIKE '%atlanta history%';
```

---

## Recommended Venue Aliases

Add these to `venues` table for proper deduplication:

```sql
-- APEX Museum
UPDATE venues SET aliases = ARRAY['APEX', 'African American Panoramic Experience'] WHERE id = 216;

-- Hammonds House
UPDATE venues SET aliases = ARRAY['Hammonds House'] WHERE id = 218;

-- Jimmy Carter Library
UPDATE venues SET aliases = ARRAY['Carter Library', 'Carter Presidential Library', 'Jimmy Carter Library'] WHERE id = 220;
```

---

## Next Steps

1. **Immediate**: crawler-dev builds crawlers for Priority 1 venues (APEX, Hammonds House, Carter Library, Sandler Hudson)
2. **Manual verification**: Human checks Whitespace, Marcia Wood, Mason Fine Art, Millennium Gate, ADAMA
3. **Database cleanup**: Mark Get This Gallery as defunct
4. **Venue enrichment**: Add aliases for museums with multiple name variations
5. **Monitoring**: After crawlers launch, monitor for exhibition end dates and update frequency

---

**Files created**:
- `/crawlers/MUSEUM_GALLERY_CRAWLER_RESEARCH.md` (full detailed report)
- `/crawlers/MUSEUM_CRAWLERS_QUICK_REFERENCE.txt` (quick reference for crawler-dev)
- `/crawlers/MUSEUM_GALLERY_RESEARCH_SUMMARY.md` (this file - executive summary)
