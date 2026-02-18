# Data Quality Audit Script

## Purpose
`audit_data_quality.py` performs a comprehensive check for garbage events and data integrity issues in the LostCity database.

## Usage

```bash
# From crawlers directory
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/audit_data_quality.py
# Formal launch/content audit
python3 scripts/content_health_audit.py
```

## Formal Content Health Audit

Use `content_health_audit.py` for a consistent launch-grade baseline across initiatives.

It outputs:
- `crawlers/reports/content_health_metrics_YYYY-MM-DD.json`
- `crawlers/reports/content_health_assessment_YYYY-MM-DD.md`

Coverage includes:
- dedupe integrity (same-source and cross-source overlap)
- indie theater showtime completeness
- specials/happy-hour coverage
- genres coverage
- walkability/mobility coverage (distributed model + dedicated-column checks)
- historic coverage (vibes/types/descriptions/editorial blurbs + dedicated-column checks)
- closed venue leakage
- crawl freshness (24h and 7d context)

## What It Checks

### 1. Garbage Titles
- Date-like titles (e.g. "February 21, 2026", "Sat Feb 21", "2/21/2026")
- Day+number titles (e.g. "Mon16", "Tue17")
- Generic nav words ("Events", "Calendar", "Add To Calendar", "View Details", "Schedule")
- Numeric-only titles
- Titles shorter than 3 characters
- Month headers (e.g. "FEBRUARY 2026")
- Phone numbers as titles
- NULL or empty titles

### 2. Duplicate Events
- Groups events by (title, venue, date)
- Reports count of duplicate groups and total duplicate events
- Shows examples with event IDs

### 3. Invalid Categories
- Checks all events against the valid category list
- Reports events with unrecognized categories
- Shows unique invalid categories found

### 4. Synthetic Descriptions
- Counts events with fallback descriptions like "Event at [Venue]"
- Breaks down by source to identify crawlers that need description enrichment
- Acceptable pattern, but useful to track

### 5. Past Events
- Finds events with start_date in the past
- Breaks down by recency (30 days, 90 days, 1 year, older)
- Shows source breakdown

### 6. NULL Category Events
- Finds events missing category assignment

## Output Format

The script produces a structured report with:
- Section headers for each check
- Count of issues found
- Top 5 examples for each issue type
- Summary statistics at the end

## Sample Output

```
================================================================================
 1. GARBAGE TITLES AUDIT
================================================================================

1a. Titles that are just dates (e.g. 'February 21, 2026', 'Sat Feb 21')...
Found 0 events with date-like titles

...

================================================================================
 SUMMARY
================================================================================

Total garbage title events: 4
  - Date-like titles: 0
  - Day+number titles: 0
  - Generic nav words: 1
  ...

Duplicate event groups: 81 (208 events)
Invalid category events: 35
Synthetic descriptions: 59
Past events: 66
```

## When to Run

- **After major crawler updates** - verify no new garbage patterns introduced
- **Before production deploys** - ensure data quality is maintained
- **Weekly/monthly** - as part of data health monitoring
- **After bulk imports** - validate imported data quality

## Integration with Workflow

1. Run audit script
2. Review output for issues
3. If issues found, create fixes using `DATA_QUALITY_FIXES.sql` as template
4. Apply fixes to database
5. Re-run audit to verify fixes worked

## Related Files

- `DATA_QUALITY_AUDIT_YYYY-MM-DD.md` - Full diagnostic reports (saved after each run)
- `DATA_QUALITY_FIXES.sql` - Ready-to-run SQL fixes for common issues
- `scripts/source_audit.py` - Per-source data quality metrics
- `data_health.py` - Overall database health scoring

## Configuration

The script uses Supabase credentials from `config.py`, which loads from `.env`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## Performance

- Runtime: ~30-60 seconds for 50K+ events
- Read-only operations (safe to run on production)
- Uses service key for admin access

## Extending the Script

To add new checks:

1. Add a new section after existing checks
2. Use the `print_section()` helper for headers
3. Use `print_examples()` to show sample events
4. Add results to the SUMMARY section at the end

Example:
```python
print_section("7. NEW CHECK NAME")
result = supabase.table("events").select("id, title, ...").execute()
# ... your check logic ...
print(f"Found {count} events with issue")
print_examples(results)
```
