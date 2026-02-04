-- Migration 098: Comprehensive Crawl Metrics & Learning System
-- Implements data-driven learning capabilities for crawler optimization

-- =============================================================================
-- 1. CRAWL_METRICS: Detailed per-crawl performance metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS crawl_metrics (
    id BIGSERIAL PRIMARY KEY,
    crawl_log_id BIGINT REFERENCES crawl_logs(id) ON DELETE CASCADE,
    
    -- HTTP Performance
    http_requests_count INT DEFAULT 0,
    http_status_codes JSONB DEFAULT '{}', -- e.g., {"200": 15, "404": 2}
    page_load_time_ms INT,
    total_bytes_downloaded BIGINT,
    
    -- LLM Performance
    llm_extraction_count INT DEFAULT 0,
    llm_tokens_input INT DEFAULT 0,
    llm_tokens_output INT DEFAULT 0,
    llm_cost_usd DECIMAL(10, 6) DEFAULT 0,
    llm_retries INT DEFAULT 0,
    extraction_time_ms INT,
    
    -- Deduplication Performance
    dedupe_candidates_checked INT DEFAULT 0,
    dedupe_matches_found INT DEFAULT 0,
    dedupe_time_ms INT,
    
    -- Database Performance
    db_write_time_ms INT,
    db_queries_count INT DEFAULT 0,
    
    -- Data Quality
    avg_extraction_confidence DECIMAL(4, 2),
    events_with_images INT DEFAULT 0,
    events_with_descriptions INT DEFAULT 0,
    events_with_prices INT DEFAULT 0,
    events_with_times INT DEFAULT 0,
    venue_match_failures INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crawl_metrics_crawl_log_id ON crawl_metrics(crawl_log_id);
CREATE INDEX idx_crawl_metrics_created_at ON crawl_metrics(created_at);

COMMENT ON TABLE crawl_metrics IS 'Detailed performance metrics for each crawl execution';
COMMENT ON COLUMN crawl_metrics.http_status_codes IS 'JSON map of HTTP status codes encountered, e.g., {"200": 15, "404": 2}';
COMMENT ON COLUMN crawl_metrics.llm_cost_usd IS 'Estimated cost in USD for LLM API calls during this crawl';

-- =============================================================================
-- 2. SOURCE_QUALITY_SCORES: Rolling source quality metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS source_quality_scores (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT REFERENCES sources(id) ON DELETE CASCADE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Reliability Metrics (last 7 days)
    success_rate_7d DECIMAL(5, 2),
    consecutive_failures INT DEFAULT 0,
    mean_time_between_failures_hours DECIMAL(10, 2),
    
    -- Reliability Metrics (last 30 days)
    success_rate_30d DECIMAL(5, 2),
    total_crawls_30d INT DEFAULT 0,
    
    -- Data Quality Metrics
    avg_completeness_score DECIMAL(5, 2),
    avg_extraction_confidence DECIMAL(5, 2),
    image_coverage_rate DECIMAL(5, 2),
    description_coverage_rate DECIMAL(5, 2),
    price_coverage_rate DECIMAL(5, 2),
    time_coverage_rate DECIMAL(5, 2),
    venue_match_success_rate DECIMAL(5, 2),
    
    -- Change Velocity Metrics
    avg_new_events_per_crawl DECIMAL(8, 2),
    avg_updated_events_per_crawl DECIMAL(8, 2),
    schedule_stability_score DECIMAL(5, 2), -- Lower variance = higher score
    days_since_last_new_event INT,
    
    -- Cost Efficiency Metrics
    avg_cost_per_event_usd DECIMAL(10, 6),
    avg_tokens_per_event INT,
    avg_duration_seconds DECIMAL(10, 2),
    p95_duration_seconds DECIMAL(10, 2),
    
    -- Duplicate Detection
    duplicate_rate DECIMAL(5, 2),
    
    -- Overall Health Score (0-100)
    health_score DECIMAL(5, 2),
    
    -- Recommendations
    recommended_frequency_hours INT,
    quality_tier TEXT CHECK (quality_tier IN ('premium', 'good', 'acceptable', 'poor', 'failing')),
    
    UNIQUE(source_id, calculated_at)
);

CREATE INDEX idx_source_quality_source_id ON source_quality_scores(source_id);
CREATE INDEX idx_source_quality_calculated_at ON source_quality_scores(calculated_at);
CREATE INDEX idx_source_quality_tier ON source_quality_scores(quality_tier);
CREATE INDEX idx_source_quality_health_score ON source_quality_scores(health_score);

COMMENT ON TABLE source_quality_scores IS 'Aggregated quality and performance metrics per source, calculated periodically';
COMMENT ON COLUMN source_quality_scores.health_score IS 'Overall health score (0-100) combining reliability, quality, and value metrics';
COMMENT ON COLUMN source_quality_scores.quality_tier IS 'Categorization: premium, good, acceptable, poor, or failing';

-- =============================================================================
-- 3. EVENT_QUALITY_SCORES: Per-event quality tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_quality_scores (
    event_id BIGINT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    
    -- Completeness Metrics (0-100)
    completeness_score INT CHECK (completeness_score >= 0 AND completeness_score <= 100),
    
    -- Field Presence Flags
    has_description BOOLEAN DEFAULT FALSE,
    has_image BOOLEAN DEFAULT FALSE,
    has_price_info BOOLEAN DEFAULT FALSE,
    has_start_time BOOLEAN DEFAULT FALSE,
    has_end_time BOOLEAN DEFAULT FALSE,
    has_ticket_url BOOLEAN DEFAULT FALSE,
    has_tags BOOLEAN DEFAULT FALSE,
    
    -- Quality Indicators
    extraction_confidence DECIMAL(4, 2),
    venue_match_score INT, -- Fuzzy match score for venue resolution
    description_length INT,
    tag_count INT DEFAULT 0,
    
    -- Data Issues
    has_data_issues BOOLEAN DEFAULT FALSE,
    data_issues JSONB DEFAULT '[]', -- Array of issue codes
    
    -- Calculated
    quality_tier TEXT CHECK (quality_tier IN ('excellent', 'good', 'fair', 'poor')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_quality_tier ON event_quality_scores(quality_tier);
CREATE INDEX idx_event_quality_completeness ON event_quality_scores(completeness_score);
CREATE INDEX idx_event_quality_issues ON event_quality_scores(has_data_issues);

COMMENT ON TABLE event_quality_scores IS 'Quality metrics for individual events';
COMMENT ON COLUMN event_quality_scores.completeness_score IS 'Overall completeness score (0-100) based on field presence and quality';
COMMENT ON COLUMN event_quality_scores.data_issues IS 'Array of issue codes like ["missing_time", "bad_venue_match"]';

-- =============================================================================
-- 4. CRAWL_FREQUENCY_LEARNING: Adaptive frequency learning
-- =============================================================================

CREATE TABLE IF NOT EXISTS crawl_frequency_learning (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT REFERENCES sources(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Observation Data
    hours_since_last_crawl DECIMAL(10, 2),
    new_events_found INT DEFAULT 0,
    updated_events_found INT DEFAULT 0,
    total_events_on_source INT, -- How many events were live on the source
    
    -- Analysis
    diminishing_returns BOOLEAN DEFAULT FALSE, -- True if new events < threshold
    optimal_frequency_estimate_hours INT,
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
    
    -- Pattern Detection
    day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    hour_of_day INT CHECK (hour_of_day >= 0 AND hour_of_day <= 23), -- 0-23
    is_beginning_of_month BOOLEAN DEFAULT FALSE,
    is_seasonal_peak BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_frequency_learning_source_id ON crawl_frequency_learning(source_id);
CREATE INDEX idx_frequency_learning_observed_at ON crawl_frequency_learning(observed_at);
CREATE INDEX idx_frequency_learning_day_of_week ON crawl_frequency_learning(day_of_week);

COMMENT ON TABLE crawl_frequency_learning IS 'Machine learning observations for optimal crawl frequency determination';
COMMENT ON COLUMN crawl_frequency_learning.diminishing_returns IS 'True when crawling more frequently yields few new events';

-- =============================================================================
-- 5. DATA_QUALITY_ISSUES: Automated issue detection
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_quality_issues (
    id BIGSERIAL PRIMARY KEY,
    issue_type TEXT NOT NULL, -- 'missing_venue', 'bad_time', 'duplicate_suspected', etc.
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    
    -- Affected Entities
    source_id BIGINT REFERENCES sources(id),
    event_id BIGINT REFERENCES events(id),
    venue_id BIGINT REFERENCES venues(id),
    crawl_log_id BIGINT REFERENCES crawl_logs(id),
    
    -- Issue Details
    description TEXT,
    affected_field TEXT,
    expected_value TEXT,
    actual_value TEXT,
    suggested_fix TEXT,
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'fixed', 'wont_fix', 'false_positive')),
    assigned_to TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    
    -- Pattern Detection
    occurrence_count INT DEFAULT 1, -- How many times this issue has occurred
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dq_issues_type ON data_quality_issues(issue_type);
CREATE INDEX idx_dq_issues_severity ON data_quality_issues(severity);
CREATE INDEX idx_dq_issues_status ON data_quality_issues(status);
CREATE INDEX idx_dq_issues_source_id ON data_quality_issues(source_id);
CREATE INDEX idx_dq_issues_event_id ON data_quality_issues(event_id);
CREATE INDEX idx_dq_issues_created_at ON data_quality_issues(created_at);

COMMENT ON TABLE data_quality_issues IS 'Automatically detected data quality issues requiring attention';
COMMENT ON COLUMN data_quality_issues.occurrence_count IS 'Number of times this issue pattern has been observed';

-- =============================================================================
-- 6. ANALYTICS VIEWS
-- =============================================================================

-- View: Source Health Dashboard
CREATE OR REPLACE VIEW v_source_health_dashboard AS
WITH recent_crawls AS (
    SELECT 
        s.id,
        s.slug,
        s.name,
        s.is_active,
        s.health_tags,
        COUNT(cl.id) as crawls_last_7d,
        SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END) as successes_7d,
        SUM(cl.events_found) as total_events_7d,
        SUM(cl.events_new) as new_events_7d,
        AVG(EXTRACT(EPOCH FROM (cl.completed_at - cl.started_at))) as avg_duration_sec,
        MAX(cl.completed_at) as last_crawl_at,
        MAX(CASE WHEN cl.events_new > 0 THEN cl.completed_at END) as last_new_events_at
    FROM sources s
    LEFT JOIN crawl_logs cl ON s.id = cl.source_id 
        AND cl.started_at > NOW() - INTERVAL '7 days'
    WHERE s.is_active = true
    GROUP BY s.id, s.slug, s.name, s.is_active, s.health_tags
)
SELECT 
    rc.*,
    ROUND(100.0 * rc.successes_7d / NULLIF(rc.crawls_last_7d, 0), 2) as success_rate_pct,
    ROUND(rc.new_events_7d::DECIMAL / NULLIF(rc.successes_7d, 0), 2) as avg_new_per_crawl,
    CASE 
        WHEN rc.crawls_last_7d = 0 THEN 'no_data'
        WHEN rc.successes_7d::DECIMAL / NULLIF(rc.crawls_last_7d, 0) >= 0.9 
            AND rc.new_events_7d > 0 THEN 'healthy'
        WHEN rc.successes_7d::DECIMAL / NULLIF(rc.crawls_last_7d, 0) >= 0.7 THEN 'degraded'
        WHEN rc.successes_7d = 0 THEN 'failing'
        ELSE 'unstable'
    END as status,
    EXTRACT(DAY FROM (NOW() - rc.last_new_events_at)) as days_since_new_events
FROM recent_crawls rc
ORDER BY rc.new_events_7d DESC;

COMMENT ON VIEW v_source_health_dashboard IS 'Real-time source health metrics for monitoring';

-- View: Event Quality Report
CREATE OR REPLACE VIEW v_event_quality_report AS
SELECT 
    s.id as source_id,
    s.slug,
    s.name,
    COUNT(e.id) as total_events,
    ROUND(AVG(eqs.completeness_score), 2) as avg_completeness,
    ROUND(AVG(e.extraction_confidence), 2) as avg_confidence,
    ROUND(SUM(CASE WHEN eqs.has_image THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(e.id), 0) * 100, 1) as image_pct,
    ROUND(SUM(CASE WHEN eqs.has_description THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(e.id), 0) * 100, 1) as description_pct,
    ROUND(SUM(CASE WHEN eqs.has_price_info THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(e.id), 0) * 100, 1) as price_info_pct,
    ROUND(SUM(CASE WHEN eqs.has_start_time THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(e.id), 0) * 100, 1) as time_info_pct,
    SUM(CASE WHEN eqs.has_data_issues THEN 1 ELSE 0 END) as events_with_issues,
    STRING_AGG(DISTINCT eqs.quality_tier, ', ' ORDER BY eqs.quality_tier) as quality_tiers
FROM sources s
JOIN events e ON s.id = e.source_id
LEFT JOIN event_quality_scores eqs ON e.id = eqs.event_id
WHERE e.start_date >= CURRENT_DATE
GROUP BY s.id, s.slug, s.name
ORDER BY avg_completeness DESC;

COMMENT ON VIEW v_event_quality_report IS 'Aggregated event quality metrics by source';

-- View: Optimal Crawl Frequency
CREATE OR REPLACE VIEW v_optimal_crawl_frequency AS
WITH frequency_patterns AS (
    SELECT 
        source_id,
        -- Analyze new event discovery patterns
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_since_last_crawl) 
            FILTER (WHERE new_events_found > 0) as median_hours_for_new_events,
        AVG(new_events_found) FILTER (WHERE new_events_found > 0) as avg_new_when_found,
        COUNT(*) FILTER (WHERE new_events_found = 0) as zero_event_crawls,
        COUNT(*) as total_observations,
        -- Day of week patterns
        MODE() WITHIN GROUP (ORDER BY day_of_week) 
            FILTER (WHERE new_events_found > 5) as best_day_of_week,
        -- Seasonal patterns
        SUM(CASE WHEN is_seasonal_peak THEN 1 ELSE 0 END) as seasonal_peak_observations
    FROM crawl_frequency_learning
    WHERE observed_at > NOW() - INTERVAL '90 days'
    GROUP BY source_id
)
SELECT 
    s.id,
    s.slug,
    s.name,
    s.crawl_frequency as current_frequency,
    ROUND(fp.median_hours_for_new_events, 1) as median_hours_for_new_events,
    ROUND(fp.avg_new_when_found, 1) as avg_new_when_found,
    ROUND(100.0 * fp.zero_event_crawls / NULLIF(fp.total_observations, 0), 1) as zero_event_rate_pct,
    -- Recommendation
    CASE 
        WHEN fp.avg_new_when_found > 10 THEN 'daily' -- High volume sources
        WHEN fp.median_hours_for_new_events < 48 THEN 'daily'
        WHEN fp.median_hours_for_new_events < 120 THEN 'twice_weekly'
        WHEN fp.median_hours_for_new_events < 240 THEN 'weekly'
        WHEN fp.zero_event_crawls::DECIMAL / NULLIF(fp.total_observations, 0) > 0.75 THEN 'monthly'
        ELSE 'weekly'
    END as recommended_frequency,
    CASE 
        WHEN fp.best_day_of_week IS NOT NULL 
        THEN TO_CHAR(DATE '2026-01-05' + fp.best_day_of_week, 'Day')
    END as recommended_day,
    CASE 
        WHEN fp.seasonal_peak_observations > 5 THEN true 
        ELSE false 
    END as has_seasonal_pattern
FROM sources s
JOIN frequency_patterns fp ON s.id = fp.source_id
WHERE s.is_active = true
ORDER BY fp.avg_new_when_found DESC;

COMMENT ON VIEW v_optimal_crawl_frequency IS 'ML-based crawl frequency recommendations';

-- =============================================================================
-- 7. HELPER FUNCTIONS
-- =============================================================================

-- Function to calculate source health score
CREATE OR REPLACE FUNCTION calculate_source_health_score(
    p_source_id BIGINT
) RETURNS DECIMAL AS $$
DECLARE
    v_reliability_score DECIMAL := 0;
    v_quality_score DECIMAL := 0;
    v_value_score DECIMAL := 0;
    v_health_score DECIMAL := 0;
BEGIN
    -- This is a placeholder - implement actual calculation logic
    -- based on crawl_logs, crawl_metrics, and event_quality_scores
    
    -- Reliability: success rate, consistency, uptime
    SELECT 
        LEAST(100, 
            (SUM(CASE WHEN status = 'success' THEN 40 ELSE 0 END)::DECIMAL / COUNT(*)) +
            (CASE WHEN STDDEV(events_found) < 5 THEN 30 ELSE 15 END) +
            20
        )
    INTO v_reliability_score
    FROM crawl_logs
    WHERE source_id = p_source_id
    AND started_at > NOW() - INTERVAL '30 days';
    
    -- Quality: completeness, confidence, coverage
    SELECT 
        LEAST(100,
            COALESCE(AVG(completeness_score) * 0.25, 0) +
            COALESCE(AVG(extraction_confidence) * 0.25, 0) +
            COALESCE(SUM(CASE WHEN has_image THEN 20 ELSE 0 END)::DECIMAL / COUNT(*), 0) +
            COALESCE(SUM(CASE WHEN has_description THEN 15 ELSE 0 END)::DECIMAL / COUNT(*), 0) +
            COALESCE(SUM(CASE WHEN has_start_time THEN 15 ELSE 0 END)::DECIMAL / COUNT(*), 0)
        )
    INTO v_quality_score
    FROM events e
    LEFT JOIN event_quality_scores eqs ON e.id = eqs.event_id
    WHERE e.source_id = p_source_id
    AND e.start_date >= CURRENT_DATE;
    
    -- Value: new events, cost efficiency, uniqueness
    SELECT 
        LEAST(100,
            (AVG(events_new) * 4) + -- 40 points for productivity
            30 + -- 30 points cost efficiency (placeholder)
            20 -- 20 points uniqueness (placeholder)
        )
    INTO v_value_score
    FROM crawl_logs
    WHERE source_id = p_source_id
    AND started_at > NOW() - INTERVAL '7 days'
    AND status = 'success';
    
    -- Combined score: 40% reliability, 40% quality, 20% value
    v_health_score := 
        (COALESCE(v_reliability_score, 0) * 0.4) +
        (COALESCE(v_quality_score, 0) * 0.4) +
        (COALESCE(v_value_score, 0) * 0.2);
    
    RETURN v_health_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_source_health_score IS 'Calculate overall health score (0-100) for a source';

-- =============================================================================
-- GRANTS (adjust as needed for your security model)
-- =============================================================================

-- Grant read access to authenticated users
GRANT SELECT ON crawl_metrics TO authenticated;
GRANT SELECT ON source_quality_scores TO authenticated;
GRANT SELECT ON event_quality_scores TO authenticated;
GRANT SELECT ON crawl_frequency_learning TO authenticated;
GRANT SELECT ON data_quality_issues TO authenticated;

-- Grant read access to views
GRANT SELECT ON v_source_health_dashboard TO authenticated;
GRANT SELECT ON v_event_quality_report TO authenticated;
GRANT SELECT ON v_optimal_crawl_frequency TO authenticated;

-- Service role has full access (for crawler processes)
-- This is typically already granted, but included for completeness
GRANT ALL ON crawl_metrics TO service_role;
GRANT ALL ON source_quality_scores TO service_role;
GRANT ALL ON event_quality_scores TO service_role;
GRANT ALL ON crawl_frequency_learning TO service_role;
GRANT ALL ON data_quality_issues TO service_role;
