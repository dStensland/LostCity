# Clark Atlanta University Art Museum Crawler

## Summary

Built a production-ready crawler for Clark Atlanta University Art Museum (CAUAM) that extracts current and upcoming art exhibitions from their website.

**Date:** 2026-02-16
**Venue ID:** 304
**Source ID:** 1071
**Crawler File:** `crawlers/sources/clark_atlanta_art_museum.py`

## Venue Details

- **Name:** Clark Atlanta University Art Museum
- **Slug:** clark-atlanta-art-museum
- **Address:** 223 James P Brawley Dr SW, Atlanta, GA 30314
- **Neighborhood:** West End
- **Type:** museum
- **Website:** https://www.cau.edu/art-museum/

## Source Configuration

- **Source Type:** scrape
- **Integration Method:** html (BeautifulSoup)
- **Crawl Frequency:** weekly
- **Owner Portal:** Atlanta (74c2f211-ee11-453d-8386-ac2861705695)
- **URL:** https://www.cau.edu/about/cultural-contributions/clark-atlanta-university-art-museum/current-exhibitions

## Crawler Implementation

### Features

- **HTML Parsing:** Uses BeautifulSoup to extract exhibition data from the Current Exhibitions page
- **Date Parsing:** Handles multiple date formats including:
  - "February 12 - May 1, 2026"
  - "February 12, 2026 - May 1, 2026"
- **Image Extraction:** Captures exhibition images when available
- **Description Extraction:** Pulls detailed exhibition descriptions from the page
- **Deduplication:** Uses content hash to prevent duplicate entries

### Event Data

All exhibitions are created as:
- **Category:** art
- **Subcategory:** visual-art
- **Is All Day:** True (exhibitions run all day)
- **Is Free:** True (suggested donation $3)
- **Tags:** art, museum, exhibition, african-american, hbcu, clark-atlanta, west-end

### Key Functions

1. **`parse_exhibition_date(date_text)`** - Parses date ranges into start_date/end_date
2. **`extract_exhibitions(html_content)`** - Extracts exhibition data from HTML
3. **`crawl(source)`** - Main crawler entry point

## Test Results

### Initial Test Run (2026-02-16)

```
Found: 1 exhibition
New: 1
Updated: 0
Warnings: 1 (past_date - expected since exhibition started Feb 12)
```

### Exhibition Extracted

**Title:** Uncommon Nature: The Abstractions of Freddie Styles
**Dates:** February 12 - May 1, 2026
**Event ID:** 53992
**Description:** Features abstract works by Morris Brown College graduate Freddie Styles

## Technical Notes

### HTML Structure

The Current Exhibitions page uses a Drupal-based structure:
- Exhibitions are in `div.paragraph-widget--text-html` containers
- Exhibition title is in `<h2>` tag
- Date and description are in following `<p>` tags
- Images are in `<img>` tags within the same container

### Error Handling

- Validates date format before inserting
- Skips exhibitions without parseable dates
- Logs warnings for parsing issues
- Handles missing descriptions gracefully

### Future Enhancements

1. **Previous Exhibitions:** Could add crawler for `/previous-exhibitions` page for archival data
2. **Artist Name Extraction:** Enhanced logic to extract artist names and link to artist records
3. **Opening Reception Events:** Extract specific event dates for exhibition openings
4. **Image Quality:** Fetch higher resolution images from Drupal media library

## Pattern for Other HBCU Museums

This crawler follows the same pattern as `spelman_college.py` and can be used as a template for other HBCU university museums:

- Morehouse College Museum
- Morris Brown College Gallery
- Atlanta University Center museums

## Maintenance

- **Expected Event Count:** 1-3 exhibitions per quarter
- **Crawl Frequency:** Weekly
- **Failure Mode:** If page structure changes, crawler will log errors but not crash
- **Health Check:** Monitor `crawl_logs` table for source_id 1071

## Related Files

- `/crawlers/sources/clark_atlanta_art_museum.py` - Main crawler
- `/crawlers/sources/spelman_college.py` - Similar HBCU pattern
- `/crawlers/CLAUDE.md` - Crawler development guide
