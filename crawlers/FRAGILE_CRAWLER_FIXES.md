# Fragile Crawler Fixes - 2026-02-16

## Summary

Fixed 3 HIGH-risk crawlers that used fragile text-offset parsing. All crawlers now use more robust extraction methods.

## Changes Made

### 1. TPAC (tpac.py)

**Problem:** Forward offset parsing (`i+1`, `i+2`) after date lines with minimal validation.

**Solution:** DOM selector pattern using `[data-event-id]` attribute.

**New approach:**
- Use Playwright to render JavaScript
- Select all elements with `[data-event-id]` attribute (found 31 events in testing)
- Parse each event's HTML with BeautifulSoup for structured extraction
- Extract title from `h3 a` or `.title a`
- Extract date from `.date`, `.showings`, `time`, or `[datetime]` attributes
- Extract image from `img` tags
- Extract event URL from anchor hrefs

**Improvements:**
- No text offset assumptions
- Structured HTML parsing with BeautifulSoup
- Clear selectors for title, date, image
- Handles missing fields gracefully
- Confidence score: 0.92 (up from 0.90)

**Files:**
- Old: `sources/tpac_old_text_parsing.py`
- New: `sources/tpac.py`

---

### 2. Smith's Olde Bar (smiths_olde_bar.py)

**Problem:** Forward scan for first line > 10 chars after month+day, only 3 items in skip list.

**Solution:** Hardened text parser with comprehensive skip list and title validation.

**New approach:**
- Playwright with longer Cloudflare bypass wait (10 seconds)
- Comprehensive skip list (40+ items including nav, months, common UI text)
- `is_valid_title()` function that rejects:
  - Items in skip list
  - Date patterns
  - Time patterns
  - URLs and phone numbers
  - ALL CAPS nav items (< 30 chars)
  - Single words (unless very long band names)
  - Text < 5 chars or > 200 chars
- Same MONTH\nDAY\nTITLE\nTIME pattern matching, but with validation

**Improvements:**
- Comprehensive skip list prevents nav item pollution
- Multi-layer validation ensures only real titles pass through
- Handles Cloudflare challenge with extended wait
- Confidence score: 0.80 (reflecting text parsing limitations)

**Files:**
- Old: `sources/smiths_olde_bar_old.py`
- New: `sources/smiths_olde_bar.py`

**Note:** Site is Cloudflare-protected. If Cloudflare blocking increases, may need alternative data source (Bandsintown API returned 403, may need venue cooperation).

---

### 3. Atlanta Film Festival (atlanta_film_festival.py)

**Problem:** Backward offset (`i-1`) from date line, no length validation on titles.

**Solution:** Squarespace JSON API.

**New approach:**
- Uses requests library to fetch `{url}?format=json`
- Tries multiple endpoints: `/events`, `/schedule`, `/`
- Extracts from Squarespace JSON structure:
  - `items[]` or `events[]` arrays
  - Title from `title` field
  - Date from `startDate`, `publishOn`, or `addedOn` (timestamp conversion)
  - Description from `excerpt` or `body` (HTML stripped)
  - Image from `assetUrl` or `thumbnail`
  - Event URL from `fullUrl` or constructed from `urlId`
- Filters out past events
- Gracefully handles "between seasons" (festival is annual)

**Improvements:**
- No HTML/text parsing required
- Structured JSON data with clear fields
- Proper date handling (Squarespace uses millisecond timestamps)
- Clean description extraction with HTML stripping
- Confidence score: 0.88
- No Playwright overhead (faster)

**Files:**
- Old: `sources/atlanta_film_festival_old.py`
- New: `sources/atlanta_film_festival.py`

---

## Testing

All three crawlers verified with:
```bash
python3 -c "from sources.tpac import crawl; from sources.smiths_olde_bar import crawl; from sources.atlanta_film_festival import crawl; print('✓ All imports successful')"
```

## Next Steps

1. Run live crawls with `python3 main.py --source tpac`, `--source smiths-olde-bar`, `--source atlanta-film-festival`
2. Monitor crawl_logs table for any errors
3. If Smith's Olde Bar Cloudflare blocking worsens, investigate:
   - Direct venue contact for data feed
   - Alternative platforms (Eventbrite, Bandsintown with auth)
   - RSS/calendar feeds

## Pattern Library

**For future crawler rewrites:**

1. **WordPress + Tribe Events:** Try `{base}/wp-json/tribe/events/v1/events`
2. **Squarespace:** Try `{url}?format=json`
3. **DOM selectors:** Use `[data-*]` attributes, `.event-card`, etc. with Playwright
4. **Hardened text parsing (last resort):**
   - Comprehensive skip list (40+ items)
   - Title validation (length, pattern rejection, caps check)
   - Reject dates, times, URLs, phone numbers as titles
   - Multi-stage validation before accepting text as title
