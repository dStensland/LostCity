# LostCity Events: Comprehensive Data Audit Results

**Date**: January 30, 2026  
**Scope**: 1,000 future events analyzed  
**Overall Health**: B+ (85/100)

---

## Quick Stats

| Metric | Count | Percentage | Status |
|--------|-------|------------|--------|
| Total Events Analyzed | 1,000 | 100% | ✅ |
| Duplicate Events | 7 | 0.7% | ✅ Excellent |
| Missing Descriptions | 167 | 16.7% | ⚠️ Moderate |
| Missing Images | 181 | 18.1% | ⚠️ Moderate |
| Non-Standard Categories | 441 | 44.1% | 🔴 High Priority |
| Missing Categories | 0 | 0% | ✅ Perfect |
| Missing Subcategories | 68 | 6.8% | ⚠️ Moderate |
| Missing Genres | 307 | 30.7% | 🔴 Needs Work |
| Categorized as "Other" | 13 | 1.3% | ✅ Good |

---

## Files Generated

### 1. **data_audit.py** - Audit Script
Location: `/Users/coach/Projects/LostCity/crawlers/data_audit.py`

Comprehensive Python script that analyzes:
- Duplicate detection (hash-based + fuzzy matching)
- Missing data (descriptions, images, categories)
- Categorization quality (categories, subcategories, genres)
- Source-level diagnostics

**Usage**:
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python data_audit.py          # Full audit
python data_audit.py 500      # Limit to 500 events
```

### 2. **data_audit_detailed.txt** - Raw Data Report
Location: `/Users/coach/Projects/LostCity/data_audit_detailed.txt`

Detailed listing of every issue found:
- All 7 duplicate pairs with IDs
- All 167 events missing descriptions
- All 181 events missing images
- All events with categorization issues

**Use this for**: Manual review and cleanup operations.

### 3. **data_audit_diagnostic.md** - Analysis & Recommendations
Location: `/Users/coach/Projects/LostCity/data_audit_diagnostic.md`

Deep dive analysis with:
- Root cause analysis for each issue
- Specific recommendations with code examples
- Prioritized action items
- SQL queries for verification

**Use this for**: Understanding WHY issues exist and HOW to fix them.

### 4. **089_data_quality_cleanup.sql** - Automated Cleanup
Location: `/Users/coach/Projects/LostCity/database/migrations/089_data_quality_cleanup.sql`

SQL migration that automatically fixes:
- Normalizes 441 events with non-standard categories
- Removes 5 duplicate events (keeps canonical versions)
- Recategorizes "other" events based on keywords
- Adds category validation constraint
- Creates data quality monitoring view

**To apply**:
1. Review the SQL file
2. Run in Supabase SQL Editor
3. Verify results with the verification queries at bottom

---

## Key Findings

### ✅ What's Working Well

1. **Deduplication** - Only 0.7% duplicates found. The content hashing and fuzzy matching in `dedupe.py` is highly effective.

2. **Category Coverage** - 100% of events have a category assigned (though 44% need normalization).

3. **Source Diversity** - 367 active sources contributing events, with good distribution.

### 🔴 Critical Issues

#### 1. Non-Standard Categories (441 events - 44%)

**Problem**: Many events using categories not in the official schema.

**Examples**:
- `words` (259) - Library events
- `learning` (95) - Classes/workshops
- `outdoors` (49) - Hikes/park events
- `arts` (20) - Plural of "art"
- `play` (14) - Children's activities
- `gaming` (3) - Board game nights
- `yoga` (1) - Specific fitness type

**Fix**: Run the `089_data_quality_cleanup.sql` migration to normalize all categories.

**Prevention**: Update `extract.py` to use strict category enum (see diagnostic report).

#### 2. Missing Genres (307 events - 31%)

**Breakdown**:
- Sports: 171 events
- Music: 73 events  
- Film: 52 events
- Theater: 11 events

**Why**: Genre inference is not implemented for most categories.

**Fix**: 
- Sports: Create genre inference from team names
- Music: Already have MusicBrainz integration - may need debugging
- Film: Expand TMDB integration to fetch genres
- Theater: Add genre extraction to LLM prompt

### ⚠️ Moderate Issues

#### 3. Missing Descriptions (167 events - 17%)

**Top Sources**:
- Atlanta Recurring Social Events: 26
- Landmark Midtown Art Cinema: 23
- Plaza Theatre: 17

**Why**: 
- Recurring events have minimal source content
- Film crawlers only capturing titles, not plot summaries
- Some sources don't provide descriptions

**Fix**:
- Expand TMDB integration to fetch plot summaries for films
- Create templates for common recurring events
- Add fallback description generation from title+venue+price

#### 4. Missing Images (181 events - 18%)

**Top Sources**:
- Atlanta Recurring Social Events: 57
- Landmark Midtown Art Cinema: 16
- Emory Schwartz Center: 11

**Why**:
- Poster/image fetching may not be working for all film events
- Music artist images not found for all performers
- Some sources don't have images

**Fix**:
- Verify TMDB/MusicBrainz API integrations are working
- Implement series image inheritance
- Add category-specific placeholder images as fallback

---

## Recommended Actions

### Phase 1: Immediate (This Week)

1. **Run Database Cleanup** ✅ Priority 1
   ```sql
   -- Run in Supabase:
   -- /database/migrations/089_data_quality_cleanup.sql
   ```
   This fixes 441+ category issues and removes duplicates.

2. **Add Category Validation** ✅ Priority 1
   Update `/crawlers/extract.py` to use strict Literal type for categories.

3. **Manual Review "Other" Events** ✅ Priority 2
   Only 13 events - review manually and recategorize.

### Phase 2: Short-Term (This Sprint)

4. **Implement Subcategory Inference**
   Add logic to `tag_inference.py` to auto-assign subcategories based on title/description keywords.

5. **Sports Genre Assignment**
   Create `sports_genres.py` to map team names to sport types (basketball, baseball, etc.).

6. **Expand Film Metadata Fetching**
   Update `posters.py` to fetch both poster + plot + genres from TMDB.

7. **Debug Music Genre Fetching**
   Verify `artist_images.py` is correctly fetching genres from MusicBrainz API.

### Phase 3: Long-Term (Next Month)

8. **Series Image Inheritance**
   Events without images should inherit from their parent series.

9. **Category Placeholder Images**
   Create default images for each category as ultimate fallback.

10. **Description Templates**
    Build template system for common recurring events.

11. **Continuous Monitoring**
    Schedule weekly data audits to catch issues early.

---

## Database Schema Recommendations

### Consider Adding These Categories

Based on the non-standard categories found, consider officially adding:

1. **`learning`** - Classes, workshops, educational programs (95 events currently misclassified)
2. **`gaming`** - Esports, board games, card games (small but distinct category)

These are legitimate event types that don't fit well into existing categories.

**Pros**: Better categorization, clearer user filtering  
**Cons**: More complexity, need UI updates

**Alternative**: Keep mapping `learning` → `community` and `gaming` → `nightlife`

---

## Monitoring & Prevention

### New Data Quality View

The cleanup migration creates a view for ongoing monitoring:

```sql
SELECT * FROM event_data_quality;
```

This shows real-time metrics:
- Events missing descriptions
- Events missing images
- Events missing categories/subcategories/genres
- Average extraction confidence

### Recommended Checks

Run these queries weekly:

```sql
-- 1. Check for non-standard categories
SELECT DISTINCT category 
FROM events 
WHERE category NOT IN (
  'music', 'art', 'comedy', 'theater', 'film', 
  'sports', 'food_drink', 'nightlife', 'community', 
  'fitness', 'family', 'other'
);

-- 2. Find new duplicates
SELECT title, start_date, venue_id, COUNT(*)
FROM events
WHERE start_date >= CURRENT_DATE
GROUP BY title, start_date, venue_id
HAVING COUNT(*) > 1;

-- 3. Data quality overview
SELECT * FROM event_data_quality;
```

---

## Next Steps

1. **Review** the detailed diagnostic report (`data_audit_diagnostic.md`)
2. **Run** the cleanup SQL migration (`089_data_quality_cleanup.sql`)
3. **Verify** results with the audit script: `python data_audit.py`
4. **Prioritize** fixes based on your product roadmap
5. **Schedule** next audit for 30 days after implementing fixes

---

## Questions?

This audit identified specific issues with specific solutions. Each recommendation includes:
- Root cause analysis
- Code examples
- File paths for implementation
- SQL for verification

Refer to **data_audit_diagnostic.md** for implementation details.

---

**Generated by**: Claude Code (Data Quality Specialist)  
**Audit Script**: `/Users/coach/Projects/LostCity/crawlers/data_audit.py`  
**Run Again**: `cd crawlers && python data_audit.py`
