-- Lost City Data Quality Investigation Queries
-- Run these in Supabase SQL Editor for deeper analysis

-- ============================================================================
-- 1. TIME/DATE QUALITY INVESTIGATIONS
-- ============================================================================

-- Events with NULL start_time by source (detailed)
SELECT 
    s.name AS source_name,
    s.slug AS source_slug,
    COUNT(*) AS events_without_time,
    ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY s.id), 0), 1) AS pct_of_source
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_time IS NULL
GROUP BY s.id, s.name, s.slug
ORDER BY events_without_time DESC;

-- Sample events without times (for pattern analysis)
SELECT e.id, e.title, e.start_date, s.name AS source, e.source_url
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_time IS NULL
LIMIT 20;

-- Events with past dates by source
SELECT 
    s.name AS source_name,
    COUNT(*) AS past_events,
    MIN(e.start_date) AS earliest_date,
    MAX(e.start_date) AS latest_date
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_date < CURRENT_DATE
GROUP BY s.id, s.name
ORDER BY past_events DESC
LIMIT 20;

-- ============================================================================
-- 2. SOURCE URL QUALITY
-- ============================================================================

-- Sources with missing source_url (should be empty or very rare)
SELECT e.id, e.title, e.start_date, s.name AS source
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.source_url IS NULL;

-- Sources with lowest ticket_url coverage
SELECT 
    s.name AS source_name,
    COUNT(*) AS total_events,
    SUM(CASE WHEN e.ticket_url IS NULL THEN 1 ELSE 0 END) AS missing_ticket_url,
    ROUND(100.0 * SUM(CASE WHEN e.ticket_url IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_missing
FROM events e
JOIN sources s ON e.source_id = s.id
GROUP BY s.id, s.name
HAVING COUNT(*) > 10
ORDER BY pct_missing DESC;

-- ============================================================================
-- 3. CONTENT QUALITY INVESTIGATIONS
-- ============================================================================

-- Events with empty descriptions
SELECT e.id, e.title, e.start_date, s.name AS source, e.category
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.description IS NULL OR TRIM(e.description) = ''
ORDER BY e.start_date DESC
LIMIT 50;

-- Events missing images by category
SELECT 
    e.category,
    COUNT(*) AS total_events,
    SUM(CASE WHEN e.image_url IS NULL THEN 1 ELSE 0 END) AS missing_images,
    ROUND(100.0 * SUM(CASE WHEN e.image_url IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_missing
FROM events e
WHERE e.category IS NOT NULL
GROUP BY e.category
ORDER BY missing_images DESC;

-- Generic Venue Crawler quality issues (highest empty description rate)
SELECT e.id, e.title, e.start_date, e.description, e.image_url, v.name AS venue
FROM events e
JOIN sources s ON e.source_id = s.id
LEFT JOIN venues v ON e.venue_id = v.id
WHERE s.name = 'Generic Venue Crawler'
AND (e.description IS NULL OR TRIM(e.description) = '' OR e.image_url IS NULL)
ORDER BY e.start_date DESC
LIMIT 30;

-- ============================================================================
-- 4. STALE DATA INVESTIGATIONS
-- ============================================================================

-- Past events distribution over time
SELECT 
    DATE_TRUNC('month', e.start_date) AS event_month,
    COUNT(*) AS past_events
FROM events e
WHERE e.start_date < CURRENT_DATE
GROUP BY event_month
ORDER BY event_month DESC
LIMIT 12;

-- Inactive sources with events
SELECT 
    s.id,
    s.name,
    s.slug,
    s.is_active,
    COUNT(e.id) AS event_count,
    MIN(e.start_date) AS earliest_event,
    MAX(e.start_date) AS latest_event
FROM sources s
LEFT JOIN events e ON s.id = e.source_id
WHERE s.is_active = FALSE
GROUP BY s.id, s.name, s.slug, s.is_active
HAVING COUNT(e.id) > 0
ORDER BY event_count DESC;

-- Meetup events breakdown
SELECT 
    CASE 
        WHEN e.start_date < CURRENT_DATE THEN 'Past'
        ELSE 'Future'
    END AS time_category,
    COUNT(*) AS event_count,
    MIN(e.start_date) AS earliest,
    MAX(e.start_date) AS latest
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE s.slug = 'meetup'
GROUP BY time_category;

-- ============================================================================
-- 5. DUPLICATE INVESTIGATIONS
-- ============================================================================

-- Events with duplicate content_hash
SELECT 
    e.content_hash,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(e.id) AS event_ids,
    MAX(e.title) AS sample_title,
    MAX(e.start_date) AS sample_date
FROM events e
WHERE e.content_hash IS NOT NULL
GROUP BY e.content_hash
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Potential duplicates by title/venue/date
SELECT 
    e.title,
    e.venue_id,
    v.name AS venue_name,
    e.start_date,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(e.id) AS event_ids,
    ARRAY_AGG(s.name) AS sources
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN sources s ON e.source_id = s.id
GROUP BY e.title, e.venue_id, v.name, e.start_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 50;

-- Duplicates at venue_id=199 (seems to have many)
SELECT e.id, e.title, e.start_date, s.name AS source, e.content_hash
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.venue_id = 199
ORDER BY e.start_date, e.title;

-- ============================================================================
-- 6. CRAWLER HEALTH MONITORING
-- ============================================================================

-- Recent crawl log errors
SELECT 
    cl.id,
    s.name AS source_name,
    cl.started_at,
    cl.status,
    cl.events_found,
    cl.events_new,
    cl.error_message
FROM crawl_logs cl
JOIN sources s ON cl.source_id = s.id
WHERE cl.status = 'error'
ORDER BY cl.started_at DESC
LIMIT 20;

-- Sources with no recent crawls (last 7 days)
SELECT 
    s.id,
    s.name,
    s.slug,
    s.is_active,
    MAX(cl.started_at) AS last_crawl
FROM sources s
LEFT JOIN crawl_logs cl ON s.id = cl.source_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name, s.slug, s.is_active
HAVING MAX(cl.started_at) < NOW() - INTERVAL '7 days' OR MAX(cl.started_at) IS NULL
ORDER BY last_crawl NULLS FIRST;

-- Crawl success rates by source
SELECT 
    s.name AS source_name,
    COUNT(*) AS total_crawls,
    SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END) AS successful,
    SUM(CASE WHEN cl.status = 'error' THEN 1 ELSE 0 END) AS errors,
    ROUND(100.0 * SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) AS success_rate
FROM crawl_logs cl
JOIN sources s ON cl.source_id = s.id
WHERE cl.started_at > NOW() - INTERVAL '30 days'
GROUP BY s.id, s.name
HAVING COUNT(*) > 3
ORDER BY success_rate ASC;

-- ============================================================================
-- 7. DATA FRESHNESS
-- ============================================================================

-- Events by date range
SELECT 
    CASE 
        WHEN start_date < CURRENT_DATE THEN 'Past'
        WHEN start_date = CURRENT_DATE THEN 'Today'
        WHEN start_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'This Week'
        WHEN start_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'This Month'
        WHEN start_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'Next 3 Months'
        ELSE 'Further Out'
    END AS time_range,
    COUNT(*) AS event_count
FROM events
GROUP BY time_range
ORDER BY 
    CASE time_range
        WHEN 'Past' THEN 1
        WHEN 'Today' THEN 2
        WHEN 'This Week' THEN 3
        WHEN 'This Month' THEN 4
        WHEN 'Next 3 Months' THEN 5
        ELSE 6
    END;

-- Event creation vs event date (are we getting events in advance?)
SELECT 
    s.name AS source_name,
    COUNT(*) AS total_events,
    ROUND(AVG(EXTRACT(DAY FROM (e.start_date - e.created_at::date))), 1) AS avg_days_advance_notice,
    MIN(e.start_date - e.created_at::date) AS min_advance,
    MAX(e.start_date - e.created_at::date) AS max_advance
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.created_at IS NOT NULL 
  AND e.start_date >= CURRENT_DATE
GROUP BY s.id, s.name
HAVING COUNT(*) > 10
ORDER BY avg_days_advance_notice DESC;
