# Museum & Gallery Crawler Research Report
**Date**: 2026-02-16
**Analyst**: data-quality

## Executive Summary

Researched 23 museums and galleries in the Atlanta area to determine crawlability. Found:
- **8 CRAWLABLE** venues with changing exhibitions/events
- **7 NOT_CRAWLABLE** (closed, no dynamic content, or domain issues)
- **5 PERMANENT_ATTRACTION** (no changing exhibitions)
- **3 UNCLEAR** (need manual verification)

## Detailed Findings

### CRAWLABLE - Ready for Crawler Development

| Venue | ID | Best URL | Content Type | Notes |
|-------|-----|----------|--------------|-------|
| **APEX Museum** | 216 | https://www.apexmuseum.org/events-2026 | Events + Exhibitions | Has both events calendar and rotating exhibits page. Squarespace site. |
| **Hammonds House Museum** | 218 | http://www.hammondshousemuseum.org/current-exhibit | Exhibitions | Current exhibit page with regular updates. Also has events page. |
| **Jimmy Carter Presidential Library** | 220 | http://www.jimmycarterlibrary.gov/events | Events | Active events calendar with programs and lectures. |
| **Clark Atlanta University Art Museum** | 304 | https://www.cau.edu/about/cultural-contributions/clark-atlanta-university-art-museum/current-exhibitions | Exhibitions | University museum with rotating exhibitions. |
| **Millennium Gate Museum** | 4062 | https://www.thegatemuseum.org/exhibitions | Exhibitions | Has temporary exhibitions page (though may be outdated - verify manually). |
| **The King Center** | 986 | https://thekingcenter.org/events/ | Events | Events calendar with programs and talks. |
| **Sandler Hudson Gallery** | 237 | http://www.sandlerhudson.com/ | Exhibitions | Active contemporary art gallery. Currently showing "This Is Not That: Peter Lynch" (Feb 13 - Mar 28, 2026). Crawl homepage for current show. |
| **African Diaspora Art Museum (ADAMA)** | 2433 | https://www.adamatl.org/events | Events | Arts Salon events series, though site shows "temporarily closed" warning. Verify current status before building crawler. |

### NOT_CRAWLABLE - Do Not Build Crawlers

| Venue | ID | Verdict | Reason |
|-------|-----|---------|--------|
| **MOCA GA** | 586 | CLOSED | Website returns 202 with CAPTCHA redirect. Confirmed temporarily closed per database note. |
| **CDC Museum** | 3786 | CLOSED | Website explicitly states "temporarily closed". Has exhibitions page but no public access. |
| **Besharat Gallery** | 242 | NO_CONTENT | Website is just a landing page with no exhibition information. May be defunct or under construction. |
| **Get This Gallery** | 245 | DOMAIN_FOR_SALE | Domain is a parking page "GetThisGallery.com - Since 2005, we've helped thousands of people get the perfect domain name". Gallery appears defunct. |
| **SCAD FASH Museum** | 1247 | ACCESS_BLOCKED | Returns 403 Forbidden. Cannot crawl. |
| **Poem88 Gallery** | 435 | SSL_ERROR | Certificate/SSL error prevents access. Website may be down. |
| **Hathaway Contemporary** | 463 | OUTDATED | Has exhibitions page but no dates in 2026/2027. Last shows appear to be from 2024 or earlier. May be inactive. |

### PERMANENT_ATTRACTION - No Changing Content

| Venue | ID | Verdict | Reason |
|-------|-----|---------|--------|
| **World of Coca-Cola** | 209 | PERMANENT | Tourist attraction with static exhibits. No changing exhibitions or events to crawl. |
| **Trap Music Museum** | 4073 | PERMANENT | Fixed exhibit space. Website offers tickets but no changing exhibitions. |
| **Margaret Mitchell House** | 224 | PERMANENT | Historic house museum operated by Atlanta History Center. No changing exhibitions. Part of AHC system (which we may already crawl). |
| **Rhodes Hall** | 4049 | PERMANENT | Historic house. No exhibitions program, primarily event rental venue. |
| **Fernbank Science Center** | 225 | UNCLEAR/DUPLICATE | Science center with planetarium. May have shows/programs but likely duplicates Fernbank Museum (which we may already have). Needs investigation. |

### NEEDS_MANUAL_VERIFICATION

| Venue | ID | Status | Next Step |
|-------|-----|--------|-----------|
| **Whitespace Gallery** | 234 | UNCLEAR | Has exhibitions page (https://whitespace814.com/exhibitions) but rendered with no headings in our test. May be JavaScript-heavy. Manual check needed. |
| **Marcia Wood Gallery** | 238 | UNCLEAR | Has exhibitions page (http://www.marciawoodgallery.com/exhibitions/) with some 2026 content. Shows "Steven Charles" as current. Verify if regularly updated. |
| **Mason Fine Art** | 236 | UNCLEAR | Has exhibitions page (https://masonfineartandevents.com/exhibitions) but minimal content in our scrape. Currently showing "KEVIN COLE Mentor". Verify update frequency. |

## Crawler Development Priorities

### Priority 1 - High Value, Clear Structure
1. **APEX Museum** - Major African American history museum, events + exhibits
2. **Hammonds House Museum** - Important art museum, active program
3. **Jimmy Carter Library** - Presidential library with regular events
4. **Sandler Hudson Gallery** - Active contemporary gallery with clear exhibition schedule

### Priority 2 - Educational Institutions
5. **Clark Atlanta University Art Museum** - University museum, regular exhibitions
6. **The King Center** - Historic site with events/programs

### Priority 3 - Verify Before Building
7. **Millennium Gate Museum** - Check if exhibitions page is actively maintained
8. **African Diaspora Art Museum** - Confirm reopening status before building crawler

### Deferred - Need Manual Review
- Whitespace Gallery (check JavaScript rendering)
- Marcia Wood Gallery (verify update frequency)
- Mason Fine Art (verify active status)

## Technical Considerations

### Platform Distribution
- **Squarespace**: APEX Museum, Hammonds House (likely)
- **WordPress**: Possible for some galleries
- **Custom CMS**: Jimmy Carter Library, Clark Atlanta

### Extraction Patterns
Most museums/galleries will need:
- Exhibition title extraction
- Date range parsing (ongoing exhibitions)
- Opening reception detection (one-time events)
- Artist/curator information
- Image extraction from exhibition pages

### Venue Type Refinement
Several of these venues may need `venue_type` updates:
- Permanent attractions (Coca-Cola, Trap Museum) should NOT be tagged as `museum` if that implies changing content
- Gallery vs. Museum distinction matters for content expectations
- Historic houses without exhibitions programs are event venues, not museums

## Recommended Next Steps

1. **Immediate**: Build crawlers for Priority 1 venues (APEX, Hammonds House, Carter Library, Sandler Hudson)
2. **Database cleanup**: Mark defunct venues (Get This Gallery #245, possibly Poem88 #435) as inactive
3. **Manual verification**: Have human verify Whitespace, Marcia Wood, Mason Fine Art before building crawlers
4. **Venue classification**: Review `venue_type` for permanent attractions to avoid user confusion

## SQL Queries for Follow-Up

```sql
-- Mark defunct venues as inactive
UPDATE venues 
SET active = false, 
    notes = 'Domain parking page / gallery appears defunct (verified 2026-02-16)'
WHERE id = 245; -- Get This Gallery

-- Check if we already crawl Fernbank Museum (which may cover Science Center)
SELECT * FROM sources WHERE name ILIKE '%fernbank%';

-- Check if Atlanta History Center crawler covers Margaret Mitchell House
SELECT * FROM sources WHERE name ILIKE '%atlanta history%';

-- Find any existing crawlers for these venues
SELECT s.name, s.url, v.name as venue_name
FROM sources s
JOIN venues v ON s.venue_id = v.id
WHERE v.id IN (216, 218, 220, 304, 4062, 986, 237, 2433, 234, 238, 236);
```

## Data Quality Notes

### Venue Aliases Needed
Many galleries may need aliases for proper deduplication:
- "Hammonds House" vs "Hammonds House Museum"
- "APEX" vs "APEX Museum" vs "African American Panoramic Experience"
- "Carter Library" vs "Jimmy Carter Presidential Library and Museum"

### Category Tags
These venues should be tagged with:
- `museum` (for museums)
- `gallery` (for art galleries)
- `history` (for history museums)
- `art` (for art museums/galleries)
- Subcategories: `contemporary_art`, `african_american_history`, `presidential_history`, etc.

### Geographic Distribution
All venues are in Atlanta metro. This research focused on cultural institutions in the `museums_galleries` explore category. Additional research needed for:
- Smaller neighborhood galleries
- Pop-up gallery spaces
- University galleries beyond CAU
- Private collections open to public

---

**Report compiled by**: LostCity Data Quality Agent
**Tools used**: Python requests + BeautifulSoup, manual website inspection
**Confidence level**: High for CRAWLABLE/NOT_CRAWLABLE verdicts, Medium for UNCLEAR venues
