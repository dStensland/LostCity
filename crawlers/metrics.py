"""
Metrics collection and analysis for LostCity crawlers.
Tracks performance, quality, and cost metrics to enable data-driven optimization.
"""

import time
import logging
from typing import Optional, Dict, List
from contextlib import contextmanager
from datetime import datetime
from db import get_client

logger = logging.getLogger(__name__)

# Token pricing for Claude (as of 2026)
CLAUDE_PRICING = {
    'claude-3-opus-20240229': {'input': 15.00, 'output': 75.00},  # per 1M tokens
    'claude-3-sonnet-20240229': {'input': 3.00, 'output': 15.00},
    'claude-3-haiku-20240307': {'input': 0.25, 'output': 1.25},
}

DEFAULT_MODEL = 'claude-3-haiku-20240307'


def is_seasonal_peak(date: datetime) -> bool:
    """Return True during peak event months for crawl-frequency learning."""
    # Spring festivals + summer events + holiday season.
    return date.month in {3, 4, 5, 6, 10, 11, 12}


class MetricsCollector:
    """
    Collects detailed metrics during a crawl for analysis and optimization.
    
    Usage:
        metrics = MetricsCollector(crawl_log_id)
        
        with metrics.measure_http():
            response = fetch_page(url)
            metrics.record_http_request(200, len(response))
        
        with metrics.measure_extraction():
            events = extract_events(content)
            metrics.record_llm_extraction(tokens_in, tokens_out)
        
        metrics.save()
    """
    
    def __init__(self, crawl_log_id: int, model: str = DEFAULT_MODEL):
        self.crawl_log_id = crawl_log_id
        self.model = model
        
        # HTTP metrics
        self.http_requests_count = 0
        self.http_status_codes: Dict[str, int] = {}
        self.page_load_start: Optional[float] = None
        self.page_load_time_ms: Optional[int] = None
        self.total_bytes_downloaded = 0
        
        # LLM metrics
        self.llm_extraction_count = 0
        self.llm_tokens_input = 0
        self.llm_tokens_output = 0
        self.llm_retries = 0
        self.extraction_start: Optional[float] = None
        self.extraction_time_ms: Optional[int] = None
        
        # Deduplication metrics
        self.dedupe_candidates_checked = 0
        self.dedupe_matches_found = 0
        self.dedupe_start: Optional[float] = None
        self.dedupe_time_ms: Optional[int] = None
        
        # Database metrics
        self.db_queries_count = 0
        self.db_write_start: Optional[float] = None
        self.db_write_time_ms: Optional[int] = None
        
        # Data quality metrics
        self.extraction_confidences: List[float] = []
        self.events_with_images = 0
        self.events_with_descriptions = 0
        self.events_with_prices = 0
        self.events_with_times = 0
        self.venue_match_failures = 0
    
    # Context managers for timing
    
    @contextmanager
    def measure_http(self):
        """Context manager to measure HTTP request time."""
        self.page_load_start = time.time()
        try:
            yield
        finally:
            if self.page_load_start:
                self.page_load_time_ms = int((time.time() - self.page_load_start) * 1000)
    
    @contextmanager
    def measure_extraction(self):
        """Context manager to measure LLM extraction time."""
        self.extraction_start = time.time()
        try:
            yield
        finally:
            if self.extraction_start:
                self.extraction_time_ms = int((time.time() - self.extraction_start) * 1000)
    
    @contextmanager
    def measure_dedupe(self):
        """Context manager to measure deduplication time."""
        self.dedupe_start = time.time()
        try:
            yield
        finally:
            if self.dedupe_start:
                self.dedupe_time_ms = int((time.time() - self.dedupe_start) * 1000)
    
    @contextmanager
    def measure_db(self):
        """Context manager to measure database write time."""
        self.db_write_start = time.time()
        try:
            yield
        finally:
            if self.db_write_start:
                self.db_write_time_ms = int((time.time() - self.db_write_start) * 1000)
    
    # Recording methods
    
    def record_http_request(self, status_code: int, bytes_downloaded: int = 0):
        """Record an HTTP request."""
        self.http_requests_count += 1
        status_str = str(status_code)
        self.http_status_codes[status_str] = self.http_status_codes.get(status_str, 0) + 1
        self.total_bytes_downloaded += bytes_downloaded
    
    def record_llm_extraction(self, tokens_input: int, tokens_output: int, retry: bool = False):
        """Record LLM extraction metrics."""
        self.llm_extraction_count += 1
        self.llm_tokens_input += tokens_input
        self.llm_tokens_output += tokens_output
        if retry:
            self.llm_retries += 1
    
    def record_dedupe_check(self, candidates_checked: int = 1, match_found: bool = False):
        """Record deduplication check."""
        self.dedupe_candidates_checked += candidates_checked
        if match_found:
            self.dedupe_matches_found += 1
    
    def record_db_query(self):
        """Record a database query."""
        self.db_queries_count += 1
    
    def record_event_quality(self, event: dict):
        """Record quality metrics for an extracted event."""
        if event.get('extraction_confidence'):
            self.extraction_confidences.append(event['extraction_confidence'])
        
        if event.get('image_url'):
            self.events_with_images += 1
        
        if event.get('description'):
            self.events_with_descriptions += 1
        
        if event.get('price_min') is not None or event.get('is_free'):
            self.events_with_prices += 1
        
        if event.get('start_time'):
            self.events_with_times += 1
    
    def record_venue_match_failure(self):
        """Record a failed venue match."""
        self.venue_match_failures += 1
    
    # Cost calculation
    
    def calculate_llm_cost(self) -> float:
        """Calculate estimated LLM cost in USD."""
        if self.model not in CLAUDE_PRICING:
            logger.warning(f"Unknown model {self.model}, using default pricing")
            pricing = CLAUDE_PRICING[DEFAULT_MODEL]
        else:
            pricing = CLAUDE_PRICING[self.model]
        
        input_cost = (self.llm_tokens_input / 1_000_000) * pricing['input']
        output_cost = (self.llm_tokens_output / 1_000_000) * pricing['output']
        
        return input_cost + output_cost
    
    # Save to database
    
    def save(self):
        """Save metrics to database."""
        client = get_client()
        
        avg_confidence = (
            sum(self.extraction_confidences) / len(self.extraction_confidences)
            if self.extraction_confidences else None
        )
        
        data = {
            'crawl_log_id': self.crawl_log_id,
            'http_requests_count': self.http_requests_count,
            'http_status_codes': self.http_status_codes,
            'page_load_time_ms': self.page_load_time_ms,
            'total_bytes_downloaded': self.total_bytes_downloaded,
            'llm_extraction_count': self.llm_extraction_count,
            'llm_tokens_input': self.llm_tokens_input,
            'llm_tokens_output': self.llm_tokens_output,
            'llm_cost_usd': self.calculate_llm_cost(),
            'llm_retries': self.llm_retries,
            'extraction_time_ms': self.extraction_time_ms,
            'dedupe_candidates_checked': self.dedupe_candidates_checked,
            'dedupe_matches_found': self.dedupe_matches_found,
            'dedupe_time_ms': self.dedupe_time_ms,
            'db_write_time_ms': self.db_write_time_ms,
            'db_queries_count': self.db_queries_count,
            'avg_extraction_confidence': avg_confidence,
            'events_with_images': self.events_with_images,
            'events_with_descriptions': self.events_with_descriptions,
            'events_with_prices': self.events_with_prices,
            'events_with_times': self.events_with_times,
            'venue_match_failures': self.venue_match_failures,
        }
        
        try:
            client.table('crawl_metrics').insert(data).execute()
            logger.debug(f"Saved metrics for crawl_log_id={self.crawl_log_id}")
        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")


def calculate_event_quality(event: dict) -> dict:
    """
    Calculate comprehensive quality metrics for an event.
    Returns a dict suitable for insertion into event_quality_scores table.
    """
    score = 0
    max_score = 0
    
    # Required fields (no points, but must exist)
    required = ['title', 'start_date', 'venue']
    for field in required:
        if not event.get(field):
            return {
                'completeness_score': 0,
                'quality_tier': 'poor',
                'has_description': False,
                'has_image': False,
                'has_price_info': False,
                'has_start_time': False,
                'has_end_time': False,
                'has_ticket_url': False,
                'has_tags': False,
                'extraction_confidence': 0,
                'description_length': 0,
                'tag_count': 0,
            }
    
    # Description (15 points)
    max_score += 15
    desc = event.get('description', '')
    if desc and len(desc) > 100:
        score += 15
    elif desc and len(desc) > 50:
        score += 10
    elif desc:
        score += 5
    
    # Image (15 points)
    max_score += 15
    if event.get('image_url'):
        score += 15
    
    # Time information (15 points)
    max_score += 15
    if event.get('start_time'):
        score += 10
    if event.get('end_time'):
        score += 5
    
    # Price information (10 points)
    max_score += 10
    if event.get('price_min') is not None or event.get('is_free'):
        score += 10
    
    # Ticket URL (10 points)
    max_score += 10
    if event.get('ticket_url'):
        score += 10
    
    # Tags (10 points)
    max_score += 10
    tag_count = len(event.get('tags', []))
    if tag_count >= 3:
        score += 10
    elif tag_count >= 1:
        score += 5
    
    # Category (10 points - bonus for specificity)
    max_score += 10
    if event.get('subcategory'):
        score += 10
    elif event.get('category'):
        score += 7
    
    # Extraction confidence (15 points)
    max_score += 15
    confidence = event.get('extraction_confidence', 0.5)
    score += int(confidence * 15)
    
    completeness_pct = int((score / max_score) * 100)
    
    # Determine tier
    if completeness_pct >= 85:
        tier = 'excellent'
    elif completeness_pct >= 70:
        tier = 'good'
    elif completeness_pct >= 50:
        tier = 'fair'
    else:
        tier = 'poor'
    
    return {
        'completeness_score': completeness_pct,
        'has_description': bool(event.get('description')),
        'has_image': bool(event.get('image_url')),
        'has_price_info': event.get('price_min') is not None or event.get('is_free'),
        'has_start_time': bool(event.get('start_time')),
        'has_end_time': bool(event.get('end_time')),
        'has_ticket_url': bool(event.get('ticket_url')),
        'has_tags': len(event.get('tags', [])) > 0,
        'extraction_confidence': confidence,
        'description_length': len(event.get('description', '')),
        'tag_count': len(event.get('tags', [])),
        'quality_tier': tier,
    }


def save_event_quality(event_id: int, quality_data: dict):
    """Save event quality metrics to database."""
    client = get_client()
    
    data = {
        'event_id': event_id,
        **quality_data
    }
    
    try:
        # Use upsert to handle updates
        client.table('event_quality_scores').upsert(data).execute()
    except Exception as e:
        logger.error(f"Failed to save event quality for event_id={event_id}: {e}")


def record_frequency_observation(
    source_id: int,
    hours_since_last: float,
    new_events: int,
    updated_events: int = 0,
    total_on_source: int = 0
):
    """Record an observation for crawl frequency learning."""
    client = get_client()
    
    now = datetime.now()
    
    data = {
        'source_id': source_id,
        'observed_at': now.isoformat(),
        'hours_since_last_crawl': hours_since_last,
        'new_events_found': new_events,
        'updated_events_found': updated_events,
        'total_events_on_source': total_on_source,
        'diminishing_returns': new_events < 3,  # Threshold for "not worth it"
        'day_of_week': now.weekday(),  # Python: 0=Monday, 6=Sunday (adjust if needed)
        'hour_of_day': now.hour,
        'is_beginning_of_month': now.day <= 7,
        'is_seasonal_peak': is_seasonal_peak(now),
    }
    
    try:
        client.table('crawl_frequency_learning').insert(data).execute()
        logger.debug(f"Recorded frequency observation for source_id={source_id}")
    except Exception as e:
        logger.error(f"Failed to save frequency observation: {e}")


def create_data_quality_issue(
    issue_type: str,
    severity: str,
    description: str,
    source_id: Optional[int] = None,
    event_id: Optional[int] = None,
    venue_id: Optional[int] = None,
    crawl_log_id: Optional[int] = None,
    affected_field: Optional[str] = None,
    expected_value: Optional[str] = None,
    actual_value: Optional[str] = None,
    suggested_fix: Optional[str] = None
):
    """Create a data quality issue record."""
    client = get_client()
    
    # Check if similar issue already exists
    existing = client.table('data_quality_issues').select('id, occurrence_count').eq(
        'issue_type', issue_type
    ).eq('status', 'open')
    
    if source_id:
        existing = existing.eq('source_id', source_id)
    if event_id:
        existing = existing.eq('event_id', event_id)
    if affected_field:
        existing = existing.eq('affected_field', affected_field)
    
    existing_result = existing.execute()
    
    if existing_result.data:
        # Update existing issue
        issue_id = existing_result.data[0]['id']
        new_count = existing_result.data[0]['occurrence_count'] + 1
        client.table('data_quality_issues').update({
            'occurrence_count': new_count,
            'last_seen_at': datetime.now().isoformat()
        }).eq('id', issue_id).execute()
        logger.debug(f"Updated existing issue {issue_id}, count now {new_count}")
    else:
        # Create new issue
        data = {
            'issue_type': issue_type,
            'severity': severity,
            'description': description,
            'source_id': source_id,
            'event_id': event_id,
            'venue_id': venue_id,
            'crawl_log_id': crawl_log_id,
            'affected_field': affected_field,
            'expected_value': expected_value,
            'actual_value': actual_value,
            'suggested_fix': suggested_fix,
        }
        
        try:
            client.table('data_quality_issues').insert(data).execute()
            logger.info(f"Created new {severity} issue: {issue_type}")
        except Exception as e:
            logger.error(f"Failed to create issue: {e}")


# CLI for metrics reporting (example)
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='LostCity Metrics CLI')
    parser.add_argument('command', choices=['dashboard', 'quality-report', 'issues'])
    parser.add_argument('--source-id', type=int, help='Filter by source ID')
    parser.add_argument('--severity', help='Filter issues by severity')
    
    args = parser.parse_args()
    
    client = get_client()
    
    if args.command == 'dashboard':
        result = client.table('v_source_health_dashboard').select('*').limit(20).execute()
        print("\nSource Health Dashboard:")
        print("-" * 100)
        for row in result.data:
            print(f"{row['slug']:30} {row['status']:10} "
                  f"Success: {row['success_rate_pct']:.0f}%  "
                  f"New/crawl: {row['avg_new_per_crawl']:.1f}")
    
    elif args.command == 'quality-report':
        query = client.table('v_event_quality_report').select('*')
        if args.source_id:
            query = query.eq('source_id', args.source_id)
        result = query.limit(20).execute()
        
        print("\nEvent Quality Report:")
        print("-" * 100)
        for row in result.data:
            print(f"{row['slug']:30} "
                  f"Completeness: {row['avg_completeness']:.0f}  "
                  f"Images: {row['image_pct']:.0f}%  "
                  f"Descriptions: {row['description_pct']:.0f}%")
    
    elif args.command == 'issues':
        query = client.table('data_quality_issues').select('*').eq('status', 'open')
        if args.severity:
            query = query.eq('severity', args.severity)
        result = query.limit(50).execute()
        
        print(f"\nData Quality Issues (showing {len(result.data)}):")
        print("-" * 100)
        for row in result.data:
            print(f"[{row['severity']:8}] {row['issue_type']:25} "
                  f"Count: {row['occurrence_count']:3}  "
                  f"{row['description'][:50]}")
