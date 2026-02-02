# Data Quality Monitoring Guide

Quick reference for maintaining LostCity data quality.

---

## Quick Health Check

Run this weekly to get an overview:

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python data_audit.py
```

---

## SQL Health Queries

### 1. Overall Data Quality Dashboard

```sql
SELECT * FROM event_data_quality;
```

Expected results (good health):
- `missing_description` < 15%
- `missing_image` < 20%
- `missing_category` = 0%
- `categorized_other` < 2%
- `avg_extraction_confidence` > 0.75

### 2. Category Distribution

```sql
SELECT 
  category, 
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM events
WHERE start_date >= CURRENT_DATE
GROUP BY category
ORDER BY count DESC;
```

Watch for:
- Any non-standard categories (should be prevented by constraint)
- Unusual distribution (e.g., 50%+ in "other")

### 3. Find New Duplicates

```sql
SELECT 
  title,
  start_date,
  v.name as venue,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(e.id ORDER BY e.id) as event_ids
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.start_date >= CURRENT_DATE
GROUP BY title, start_date, v.name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

Action: If > 10 duplicates found, investigate crawler that created them.

### 4. Events Missing Critical Data

```sql
-- Missing descriptions by source
SELECT 
  s.name as source,
  COUNT(*) as missing_count
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.start_date >= CURRENT_DATE
  AND (e.description IS NULL OR LENGTH(e.description) < 50)
GROUP BY s.name
ORDER BY missing_count DESC
LIMIT 10;

-- Missing images by source
SELECT 
  s.name as source,
  COUNT(*) as missing_count
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.start_date >= CURRENT_DATE
  AND e.image_url IS NULL
GROUP BY s.name
ORDER BY missing_count DESC
LIMIT 10;
```

Action: If a source consistently produces incomplete data, fix that crawler.

### 5. Genre Coverage by Category

```sql
SELECT 
  category,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE genres IS NULL OR genres = '{}') as missing_genres,
  ROUND(100.0 * COUNT(*) FILTER (WHERE genres IS NULL OR genres = '{}') / COUNT(*), 1) as missing_pct
FROM events
WHERE start_date >= CURRENT_DATE
  AND category IN ('music', 'film', 'theater', 'sports')
GROUP BY category
ORDER BY missing_pct DESC;
```

Target: < 25% missing genres for music, film, theater, sports.

---

## Source Health Monitoring

### Top Sources by Event Count (Last 30 Days)

```sql
SELECT 
  s.name,
  COUNT(e.id) as event_count,
  COUNT(DISTINCT DATE(e.start_date)) as days_covered,
  AVG(e.extraction_confidence) as avg_confidence
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.name
ORDER BY event_count DESC
LIMIT 20;
```

Watch for:
- Sources with very low avg_confidence (< 0.6) - extraction issues
- Sources that suddenly stop producing events

### Recent Crawl Failures

```sql
SELECT 
  s.name,
  cl.started_at,
  cl.status,
  cl.error_message,
  cl.events_found,
  cl.events_new
FROM crawl_logs cl
JOIN sources s ON s.id = cl.source_id
WHERE cl.started_at >= CURRENT_DATE - INTERVAL '7 days'
  AND cl.status = 'error'
ORDER BY cl.started_at DESC
LIMIT 20;
```

Action: Investigate any recurring error patterns.

---

## Red Flags to Watch For

### 1. Sudden Spike in Duplicates
If weekly audit shows > 20 duplicates:
- Check which sources are affected
- Review recent changes to those crawlers
- May indicate content_hash logic broken

### 2. Category Constraint Violations
If you see errors like "violates check constraint events_category_check":
- A crawler is producing non-standard categories
- Fix the crawler's extraction logic immediately
- Categories must be normalized before insertion

### 3. Extraction Confidence Drops
If `avg_extraction_confidence` drops below 0.65:
- LLM extraction may be failing
- Check if Anthropic API is rate-limited or erroring
- Review recent changes to extraction prompts

### 4. Missing Data Trends Up
If missing descriptions/images > 25%:
- New sources may lack complete data
- Image/poster fetching APIs may be broken
- Check API keys and rate limits

---

## Monthly Deep Dive

Run full audit monthly:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python data_audit.py > monthly_audit_$(date +%Y%m%d).txt
```

Review and address:
1. Any new patterns in uncategorizable events
2. Sources consistently producing poor data
3. Genres still missing after auto-inference
4. Events that should be part of series but aren't

---

## Automated Monitoring (Future)

Consider setting up:

### 1. Daily Cron Job
```bash
# Run at 6am daily
0 6 * * * cd /path/to/LostCity/crawlers && python data_audit.py --quick > /tmp/daily_audit.log
```

### 2. Supabase Edge Function
Create a scheduled function that:
- Queries `event_data_quality` view
- Sends Slack/email alert if thresholds exceeded
- Triggers every 24 hours

### 3. Grafana Dashboard
Visualize metrics over time:
- Events per day
- Missing data percentages
- Category distribution
- Source health scores

---

## When to Run Full Re-Audit

Trigger a comprehensive audit after:
- ✅ Adding a new crawler
- ✅ Modifying extraction prompts
- ✅ Changing category definitions
- ✅ Database migrations affecting events table
- ✅ Switching to a new LLM model
- ✅ Major changes to deduplication logic

---

## Contact

For questions about data quality:
- Review: `/Users/coach/Projects/LostCity/data_audit_diagnostic.md`
- Run: `python data_audit.py`
- Check: SQL queries in this document

Last Updated: 2026-01-30
