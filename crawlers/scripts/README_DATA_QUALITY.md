# Data Quality Analysis Tools

This directory contains scripts for assessing and improving data quality across the LostCity crawler pipeline.

## Quick Start

### Run Full Analysis (Recommended Weekly)

```bash
# 1. Generate comprehensive report
python3 scripts/data_quality_report.py > tmp/quality_report_$(date +%Y%m%d).txt

# 2. Generate actionable CSV exports
python3 scripts/generate_action_items.py

# 3. Display visual dashboard
python3 scripts/data_quality_dashboard.py
```

## Scripts

### 1. `data_quality_report.py`
**Purpose:** Comprehensive text-based data quality report  
**Output:** Console output with detailed metrics  
**Run frequency:** Weekly (every Monday recommended)

**Metrics Reported:**
- Event enrichment coverage (description, time, image, ticket, category)
- Venue data completeness (coordinates, hours, vibes)
- Source performance (top sources, zero-event sources)
- Data quality issues (missing fields, price inconsistencies)
- Recent crawl errors

**Example:**
```bash
python3 scripts/data_quality_report.py > tmp/report_2026-02-07.txt
```

### 2. `generate_action_items.py`
**Purpose:** Generate actionable CSV exports for fixing identified issues  
**Output:** 8 CSV files in `tmp/` directory  
**Run frequency:** Weekly, after running data_quality_report.py

**Files Generated:**
1. `zero_event_sources.csv` - Sources to deactivate or fix
2. `venues_need_geocoding.csv` - Venues missing coordinates
3. `venues_need_hours.csv` - Venues ready for hours backfill
4. `sources_poor_descriptions.csv` - Sources with low description coverage
5. `events_missing_critical_fields.csv` - Events to fix or delete
6. `events_price_inconsistencies.csv` - Price data errors
7. `source_health_tiers.csv` - Full source health audit
8. `recent_crawl_failures.csv` - Recent errors to investigate

**Example:**
```bash
python3 scripts/generate_action_items.py
cat tmp/zero_event_sources.csv | wc -l  # Count sources needing attention
```

### 3. `data_quality_dashboard.py`
**Purpose:** Visual ASCII dashboard for at-a-glance metrics  
**Output:** Color-coded progress bars and letter grades  
**Run frequency:** Daily or weekly

**Example:**
```bash
python3 scripts/data_quality_dashboard.py
```

## Interpreting Results

### Overall Grade Scale
- **A (90-100%):** Excellent - best-in-class data quality
- **B (80-89%):** Good - meets production standards
- **C (70-79%):** Acceptable - needs improvement
- **D (60-69%):** Poor - requires immediate attention
- **F (<60%):** Critical - blocking feature functionality

### Source Health Tiers
- **Tier 1 (Healthy):** Events updated in last 7 days
- **Tier 2 (Warning):** Events updated 8-30 days ago
- **Tier 3 (Stale):** No events in 30+ days
- **Tier 4 (Never Active):** Never produced events

**Target distribution:**
- Tier 1: >80%
- Tier 2: <10%
- Tier 3: <5%
- Tier 4: <5%

### Enrichment Targets
| Field | Target | Minimum Viable |
|-------|--------|----------------|
| Category | 99%+ | 95% |
| Start Time | 90%+ | 80% |
| Image URL | 80%+ | 60% |
| Ticket URL | 80%+ | 60% |
| Description | 85%+ | 70% |
| Fully Rich (4/4) | 60%+ | 40% |

### Venue Completeness Targets
| Field | Target | Minimum Viable |
|-------|--------|----------------|
| Coordinates (lat/lng) | 95%+ | 85% |
| Hours | 80%+ | 60% |
| Vibes | 70%+ | 50% |
| Address | 98%+ | 95% |

## Common Workflows

### Fix Zero-Event Sources
```bash
# 1. Generate list
python3 scripts/generate_action_items.py

# 2. Review Tier 4 sources
cat tmp/source_health_tiers.csv | grep "Tier 4"

# 3. For each source, check if crawler exists
cat sources/profiles/SOURCE_SLUG.yaml
ls sources/*SOURCE_SLUG*.py

# 4. Deactivate in database if source is invalid
psql $DATABASE_URL -c "UPDATE sources SET is_active = false WHERE slug = 'SOURCE_SLUG';"
```

### Backfill Venue Coordinates
```bash
# 1. Export venues missing coordinates
python3 scripts/generate_action_items.py

# 2. Run batch geocoding (script to be created)
python3 scripts/backfill_venue_coordinates.py --input tmp/venues_need_geocoding.csv

# 3. Verify results
python3 scripts/data_quality_dashboard.py  # Check "Coordinates" metric
```

### Investigate Crawl Failures
```bash
# 1. Export recent failures
python3 scripts/generate_action_items.py

# 2. Review error patterns
cat tmp/recent_crawl_failures.csv | cut -d',' -f3 | sort | uniq -c | sort -rn

# 3. For DNS errors, deactivate sources
# For timeouts, increase timeout in source config
# For 403 Forbidden, update user-agent or add delays
```

### Fix Source Enrichment Issues
```bash
# 1. Identify poorly enriched sources
python3 scripts/data_quality_report.py | grep -A 20 "ENRICHMENT RATES"

# 2. Inspect source configuration
cat sources/profiles/SOURCE_SLUG.yaml

# 3. Check for detail_fetch setting
grep "detail_fetch" sources/profiles/SOURCE_SLUG.yaml

# 4. If missing, add:
# detail_fetch: true
# detail_method: "llm"

# 5. Re-crawl to test
python main.py --source SOURCE_SLUG --verbose
```

## Monitoring & Alerts

### Set Up Weekly Report Email
```bash
# Add to crontab (every Monday at 9am)
0 9 * * 1 cd /path/to/crawlers && python3 scripts/data_quality_report.py | mail -s "Weekly Data Quality Report" team@lostcity.ai
```

### Track Progress Over Time
```bash
# Save reports with timestamps
mkdir -p tmp/quality_reports
python3 scripts/data_quality_report.py > tmp/quality_reports/$(date +%Y%m%d_%H%M%S).txt

# Compare week-over-week
diff tmp/quality_reports/20260207_*.txt tmp/quality_reports/20260214_*.txt
```

## SQL Queries for Manual Investigation

### Find events with no description
```sql
SELECT e.id, e.title, s.slug as source
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.description IS NULL OR e.description = ''
ORDER BY e.updated_at DESC
LIMIT 50;
```

### Find sources with best enrichment
```sql
SELECT s.slug,
       COUNT(*) as total,
       ROUND(100.0 * COUNT(CASE WHEN e.image_url IS NOT NULL THEN 1 END) / COUNT(*), 1) as img_pct,
       ROUND(100.0 * COUNT(CASE WHEN e.ticket_url IS NOT NULL THEN 1 END) / COUNT(*), 1) as ticket_pct
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.updated_at > NOW() - INTERVAL '7 days'
GROUP BY s.slug
HAVING COUNT(*) > 10
ORDER BY img_pct DESC, ticket_pct DESC
LIMIT 20;
```

### Find venues in specific neighborhood missing data
```sql
SELECT name, address, lat, lng
FROM venues
WHERE neighborhood = 'Little Five Points'
AND (lat IS NULL OR hours IS NULL OR hours::text = '{}')
ORDER BY name;
```

## Troubleshooting

### Error: "relation 'event_series' does not exist"
**Solution:** This table may not exist in your schema. The script handles this gracefully and continues.

### Error: "column s.website does not exist"
**Solution:** Fixed in latest version - uses `s.url` instead

### Error: "connection refused"
**Solution:** Check DATABASE_URL in ../.env file

### Low enrichment rates across all sources
**Potential causes:**
1. LLM extraction disabled globally
2. detail_fetch: false in most source configs
3. API rate limiting (OpenAI/Anthropic)
4. Network issues preventing detail page fetches

**Fix:** Check `config.py` LLM settings and enable detail extraction in source profiles

## Contributing

When adding new data quality checks:
1. Add the SQL query to `data_quality_report.py`
2. If actionable, export CSV in `generate_action_items.py`
3. If critical metric, add to `data_quality_dashboard.py`
4. Update target metrics in this README

---

**Last Updated:** 2026-02-07  
**Maintained By:** Data Quality Team
