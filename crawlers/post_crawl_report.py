#!/usr/bin/env python3
"""
Post-Crawl Report Generator.

Generates an HTML dashboard after each crawl run showing:
- Crawl results and health status
- Data quality summary
- Event statistics by category
- Sources needing attention
"""

import os
import logging
from datetime import datetime, timedelta
from db import get_client
from crawler_health import get_system_health_summary, get_unhealthy_sources
from data_quality import get_sources_needing_attention, get_declining_sources

logger = logging.getLogger(__name__)

# Output directory for reports
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")


def ensure_reports_dir():
    """Create reports directory if it doesn't exist."""
    if not os.path.exists(REPORTS_DIR):
        os.makedirs(REPORTS_DIR)


def get_event_stats_by_category() -> dict:
    """Get event counts by category for upcoming events."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    result = client.table("events").select(
        "category"
    ).gte("start_date", today).execute()

    counts = {}
    for event in result.data or []:
        cat = event.get("category") or "uncategorized"
        counts[cat] = counts.get(cat, 0) + 1

    return dict(sorted(counts.items(), key=lambda x: -x[1]))


def get_daily_event_counts(days: int = 14) -> list[dict]:
    """Get event counts per day for the next N days."""
    client = get_client()
    today = datetime.now().date()

    daily_counts = []
    for i in range(days):
        date = today + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")

        result = client.table("events").select(
            "id", count="exact"
        ).eq("start_date", date_str).execute()

        daily_counts.append({
            "date": date_str,
            "day_name": date.strftime("%a"),
            "count": result.count or 0
        })

    return daily_counts


def get_recent_crawl_results(hours: int = 24) -> list[dict]:
    """Get recent crawl results."""
    client = get_client()
    cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

    result = client.table("crawl_logs").select(
        "*, source:sources(slug, name)"
    ).gte("started_at", cutoff).order("started_at", desc=True).limit(100).execute()

    return result.data or []


def get_analytics_summary() -> dict:
    """Get analytics summary from database."""
    client = get_client()
    today = datetime.now().strftime("%Y-%m-%d")

    # Total upcoming events
    upcoming = client.table("events").select("id", count="exact").gte("start_date", today).execute()

    # Events created today
    today_start = datetime.now().replace(hour=0, minute=0, second=0).isoformat()
    created_today = client.table("events").select("id", count="exact").gte("created_at", today_start).execute()

    # Events by category
    by_category = get_event_stats_by_category()

    # Top venues by event count
    venue_result = client.table("events").select(
        "venue_id, venue:venues(name)"
    ).gte("start_date", today).execute()

    venue_counts = {}
    for e in venue_result.data or []:
        venue = e.get("venue") or {}
        venue_name = venue.get("name", "Unknown")
        venue_counts[venue_name] = venue_counts.get(venue_name, 0) + 1

    top_venues = sorted(venue_counts.items(), key=lambda x: -x[1])[:10]

    return {
        "total_upcoming": upcoming.count or 0,
        "created_today": created_today.count or 0,
        "by_category": by_category,
        "top_venues": top_venues,
        "daily_forecast": get_daily_event_counts(14),
    }


def generate_html_report(crawl_results: dict = None) -> str:
    """Generate HTML dashboard report."""
    health = get_system_health_summary()
    analytics = get_analytics_summary()
    quality_issues = get_sources_needing_attention(threshold=70)[:15]
    declining = get_declining_sources()[:5]
    unhealthy = get_unhealthy_sources(min_failures=3)[:10]
    recent_crawls = get_recent_crawl_results(24)

    # Calculate crawl stats
    successful_crawls = [c for c in recent_crawls if c.get("status") == "success"]
    failed_crawls = [c for c in recent_crawls if c.get("status") == "error"]

    now = datetime.now()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LostCity Crawler Dashboard - {now.strftime("%Y-%m-%d %H:%M")}</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #ff6b35; margin-bottom: 10px; font-size: 28px; }}
        h2 {{ color: #4ecdc4; margin: 20px 0 10px; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 5px; }}
        .timestamp {{ color: #888; font-size: 14px; margin-bottom: 20px; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }}
        .card {{ background: #1a1a1a; border-radius: 8px; padding: 16px; border: 1px solid #333; }}
        .card-title {{ font-size: 14px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }}
        .card-value {{ font-size: 32px; font-weight: bold; color: #fff; }}
        .card-subtitle {{ font-size: 12px; color: #666; margin-top: 4px; }}
        .stat-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #222; }}
        .stat-row:last-child {{ border-bottom: none; }}
        .stat-label {{ color: #888; }}
        .stat-value {{ font-weight: 500; }}
        .success {{ color: #4ade80; }}
        .warning {{ color: #fbbf24; }}
        .error {{ color: #f87171; }}
        .bar-chart {{ display: flex; align-items: end; gap: 4px; height: 100px; margin-top: 10px; }}
        .bar {{ background: #4ecdc4; min-width: 20px; border-radius: 2px 2px 0 0; position: relative; }}
        .bar-label {{ position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #666; }}
        .bar-value {{ position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #888; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ text-align: left; padding: 8px 12px; border-bottom: 1px solid #222; }}
        th {{ color: #888; font-weight: 500; font-size: 12px; text-transform: uppercase; }}
        tr:hover {{ background: #222; }}
        .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }}
        .badge-success {{ background: #166534; color: #4ade80; }}
        .badge-error {{ background: #7f1d1d; color: #f87171; }}
        .badge-warning {{ background: #713f12; color: #fbbf24; }}
        .progress-bar {{ height: 6px; background: #333; border-radius: 3px; overflow: hidden; }}
        .progress-fill {{ height: 100%; border-radius: 3px; }}
        .category-list {{ display: flex; flex-wrap: wrap; gap: 8px; }}
        .category-tag {{ background: #333; padding: 4px 10px; border-radius: 4px; font-size: 13px; }}
        .category-count {{ color: #4ecdc4; margin-left: 4px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🌆 LostCity Crawler Dashboard</h1>
        <div class="timestamp">Generated: {now.strftime("%B %d, %Y at %I:%M %p")}</div>

        <!-- Key Metrics -->
        <div class="grid">
            <div class="card">
                <div class="card-title">Upcoming Events</div>
                <div class="card-value">{analytics['total_upcoming']:,}</div>
                <div class="card-subtitle">+{analytics['created_today']} added today</div>
            </div>
            <div class="card">
                <div class="card-title">Crawls (24h)</div>
                <div class="card-value">{len(successful_crawls)} <span class="success">✓</span> / {len(failed_crawls)} <span class="error">✗</span></div>
                <div class="card-subtitle">{len(successful_crawls) / max(len(recent_crawls), 1) * 100:.0f}% success rate</div>
            </div>
            <div class="card">
                <div class="card-title">Source Health</div>
                <div class="card-value">
                    <span class="success">{health['sources']['healthy']}</span> /
                    <span class="warning">{health['sources']['degraded']}</span> /
                    <span class="error">{health['sources']['unhealthy']}</span>
                </div>
                <div class="card-subtitle">Healthy / Degraded / Unhealthy</div>
            </div>
            <div class="card">
                <div class="card-title">Data Quality Issues</div>
                <div class="card-value">{len(quality_issues)}</div>
                <div class="card-subtitle">Sources below 70% quality</div>
            </div>
        </div>

        <!-- Event Forecast -->
        <h2>📅 14-Day Event Forecast</h2>
        <div class="card">
            <div class="bar-chart">
"""

    # Generate bar chart for daily events
    max_count = max(d["count"] for d in analytics["daily_forecast"]) or 1
    for day in analytics["daily_forecast"]:
        height = max(5, (day["count"] / max_count) * 80)
        html += f"""
                <div class="bar" style="height: {height}px;">
                    <span class="bar-value">{day['count']}</span>
                    <span class="bar-label">{day['day_name']}</span>
                </div>
"""

    html += """
            </div>
        </div>

        <!-- Events by Category -->
        <h2>🎭 Events by Category</h2>
        <div class="card">
            <div class="category-list">
"""

    for cat, count in list(analytics["by_category"].items())[:12]:
        html += f'<span class="category-tag">{cat}<span class="category-count">{count}</span></span>\n'

    html += """
            </div>
        </div>

        <div class="grid">
            <!-- Top Venues -->
            <div class="card">
                <h2 style="margin-top: 0;">🏛️ Top Venues</h2>
                <table>
                    <tr><th>Venue</th><th>Events</th></tr>
"""

    for venue, count in analytics["top_venues"][:8]:
        html += f'<tr><td>{venue[:35]}</td><td>{count}</td></tr>\n'

    html += """
                </table>
            </div>

            <!-- Unhealthy Sources -->
            <div class="card">
                <h2 style="margin-top: 0;">⚠️ Sources Needing Attention</h2>
                <table>
                    <tr><th>Source</th><th>Issue</th></tr>
"""

    for source in unhealthy[:8]:
        html += f'<tr><td>{source.source_slug[:25]}</td><td class="error">{source.consecutive_failures} failures</td></tr>\n'

    if not unhealthy:
        html += '<tr><td colspan="2" style="color: #4ade80;">All sources healthy!</td></tr>\n'

    html += """
                </table>
            </div>
        </div>

        <!-- Recent Crawls -->
        <h2>🔄 Recent Crawl Activity</h2>
        <div class="card">
            <table>
                <tr><th>Source</th><th>Status</th><th>Events</th><th>Time</th></tr>
"""

    for crawl in recent_crawls[:15]:
        source = crawl.get("source", {})
        status_class = "badge-success" if crawl.get("status") == "success" else "badge-error"
        status_text = "Success" if crawl.get("status") == "success" else "Failed"
        events = crawl.get("events_found", 0)
        new_events = crawl.get("events_new", 0)
        started = crawl.get("started_at", "")[:16].replace("T", " ")

        html += f'''
                <tr>
                    <td>{source.get("name", "Unknown")[:30]}</td>
                    <td><span class="badge {status_class}">{status_text}</span></td>
                    <td>{events} found, {new_events} new</td>
                    <td style="color: #666;">{started}</td>
                </tr>
'''

    html += """
            </table>
        </div>

        <!-- Data Quality -->
        <h2>📊 Data Quality Issues</h2>
        <div class="card">
            <table>
                <tr><th>Source</th><th>Score</th><th>Issue</th></tr>
"""

    for metrics in quality_issues[:10]:
        score_class = "error" if metrics.completeness_score < 50 else "warning"
        issue = metrics.issues[0] if metrics.issues else "Low completeness"
        html += f'''
                <tr>
                    <td>{metrics.source_slug[:25]}</td>
                    <td class="{score_class}">{metrics.completeness_score:.0f}%</td>
                    <td style="color: #888;">{issue[:50]}</td>
                </tr>
'''

    html += """
            </table>
        </div>

        <!-- Declining Quality -->
"""

    if declining:
        html += """
        <h2>📉 Declining Quality Trend</h2>
        <div class="card">
            <table>
                <tr><th>Source</th><th>Change</th><th>Trend</th></tr>
"""
        for trend in declining:
            html += f'''
                <tr>
                    <td>{trend.source_slug[:25]}</td>
                    <td class="error">{trend.change:+.0f}%</td>
                    <td style="color: #888;">{trend.completeness_then:.0f}% → {trend.completeness_now:.0f}%</td>
                </tr>
'''
        html += """
            </table>
        </div>
"""

    html += f"""
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px;">
            LostCity Crawler System • Report generated {now.strftime("%Y-%m-%d %H:%M:%S")}
        </div>
    </div>
</body>
</html>
"""

    return html


def save_report() -> str:
    """Generate and save the HTML report. Returns the file path."""
    ensure_reports_dir()

    html = generate_html_report()

    # Save with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"crawl_report_{timestamp}.html"
    filepath = os.path.join(REPORTS_DIR, filename)

    with open(filepath, "w") as f:
        f.write(html)

    # Also save as latest.html for easy access
    latest_path = os.path.join(REPORTS_DIR, "latest.html")
    with open(latest_path, "w") as f:
        f.write(html)

    logger.info(f"Report saved to {filepath}")
    return filepath


if __name__ == "__main__":
    filepath = save_report()
    print(f"Report generated: {filepath}")
    print(f"Latest report: {os.path.join(REPORTS_DIR, 'latest.html')}")
