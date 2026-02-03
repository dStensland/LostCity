"""
Data Quality Analysis for LostCity Crawlers.

Monitors event data quality across sources, identifies issues,
tracks quality trends over time, and flags crawlers needing attention.
"""

import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional
from db import get_client

logger = logging.getLogger(__name__)


@dataclass
class QualityMetrics:
    """Quality metrics for a source."""
    source_slug: str
    source_name: str
    total_events: int
    events_with_time: int
    events_with_image: int
    events_with_description: int
    events_with_price: int
    tba_count: int  # Events with TBA/placeholder data
    coming_soon_count: int
    missing_time_count: int
    avg_description_length: float
    completeness_score: float  # 0-100
    issues: list = field(default_factory=list)


@dataclass
class QualityTrend:
    """Quality trend for a source over time."""
    source_slug: str
    period_start: str
    period_end: str
    completeness_then: float
    completeness_now: float
    change: float
    direction: str  # "improving", "declining", "stable"


# Patterns that indicate placeholder/TBA data
TBA_PATTERNS = [
    'tba', 'tbd', 'to be announced', 'to be determined',
    'coming soon', 'check back', 'times vary', 'see website'
]


def detect_tba_content(text: str) -> bool:
    """Check if text contains TBA/placeholder patterns."""
    if not text:
        return False
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in TBA_PATTERNS)


def calculate_source_quality(source_id: int, source_slug: str, source_name: str, days: int = 30) -> QualityMetrics:
    """Calculate quality metrics for a source's recent events."""
    client = get_client()
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Get recent events
    result = client.table("events").select(
        "id, title, description, start_time, image_url, price_min, is_free, is_all_day, created_at"
    ).eq("source_id", source_id).gte("created_at", cutoff).execute()

    events = result.data or []
    total = len(events)

    if total == 0:
        return QualityMetrics(
            source_slug=source_slug,
            source_name=source_name,
            total_events=0,
            events_with_time=0,
            events_with_image=0,
            events_with_description=0,
            events_with_price=0,
            tba_count=0,
            coming_soon_count=0,
            missing_time_count=0,
            avg_description_length=0,
            completeness_score=0,
            issues=["No events in last {days} days"]
        )

    # Calculate metrics
    with_time = sum(1 for e in events if e.get("start_time"))
    with_image = sum(1 for e in events if e.get("image_url"))
    with_description = sum(1 for e in events if e.get("description") and len(e.get("description", "")) > 20)
    with_price = sum(1 for e in events if e.get("price_min") is not None or e.get("is_free"))

    # Detect TBA/placeholder content
    tba_count = 0
    coming_soon_count = 0
    for e in events:
        title = e.get("title", "")
        desc = e.get("description", "")
        if detect_tba_content(title) or detect_tba_content(desc):
            tba_count += 1
        if desc and "coming soon" in desc.lower():
            coming_soon_count += 1

    # Missing times (non-all-day events without times)
    missing_time = sum(1 for e in events if not e.get("start_time") and not e.get("is_all_day"))

    # Average description length
    desc_lengths = [len(e.get("description", "")) for e in events if e.get("description")]
    avg_desc_len = sum(desc_lengths) / len(desc_lengths) if desc_lengths else 0

    # Calculate completeness score (0-100)
    # Weight: time=30, image=25, description=20, no-TBA=15, price=10
    score = 0
    if total > 0:
        score += (with_time / total) * 30
        score += (with_image / total) * 25
        score += (with_description / total) * 20
        score += ((total - tba_count) / total) * 15
        score += (with_price / total) * 10

    # Identify specific issues
    issues = []
    if with_time / total < 0.8:
        issues.append(f"{total - with_time} events missing start times ({100 - with_time/total*100:.0f}%)")
    if with_image / total < 0.7:
        issues.append(f"{total - with_image} events missing images ({100 - with_image/total*100:.0f}%)")
    if with_description / total < 0.5:
        issues.append(f"{total - with_description} events missing descriptions ({100 - with_description/total*100:.0f}%)")
    if tba_count > 0:
        issues.append(f"{tba_count} events have TBA/placeholder content")
    if coming_soon_count > 0:
        issues.append(f"{coming_soon_count} 'Coming Soon' placeholder events")
    if avg_desc_len < 30 and with_description > 0:
        issues.append(f"Descriptions are very short (avg {avg_desc_len:.0f} chars)")

    return QualityMetrics(
        source_slug=source_slug,
        source_name=source_name,
        total_events=total,
        events_with_time=with_time,
        events_with_image=with_image,
        events_with_description=with_description,
        events_with_price=with_price,
        tba_count=tba_count,
        coming_soon_count=coming_soon_count,
        missing_time_count=missing_time,
        avg_description_length=avg_desc_len,
        completeness_score=score,
        issues=issues
    )


def get_quality_trend(source_id: int, source_slug: str) -> Optional[QualityTrend]:
    """Compare quality between last 7 days and previous 7 days."""
    client = get_client()

    now = datetime.utcnow()
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()

    # Recent period (last 7 days)
    recent = client.table("events").select(
        "start_time, image_url, description"
    ).eq("source_id", source_id).gte("created_at", week_ago).execute()

    # Previous period (7-14 days ago)
    previous = client.table("events").select(
        "start_time, image_url, description"
    ).eq("source_id", source_id).gte("created_at", two_weeks_ago).lt("created_at", week_ago).execute()

    recent_events = recent.data or []
    previous_events = previous.data or []

    if not recent_events or not previous_events:
        return None

    def calc_score(events):
        total = len(events)
        if total == 0:
            return 0
        with_time = sum(1 for e in events if e.get("start_time"))
        with_image = sum(1 for e in events if e.get("image_url"))
        with_desc = sum(1 for e in events if e.get("description") and len(e.get("description", "")) > 20)
        return ((with_time / total) * 40 + (with_image / total) * 35 + (with_desc / total) * 25)

    score_now = calc_score(recent_events)
    score_then = calc_score(previous_events)
    change = score_now - score_then

    if change > 5:
        direction = "improving"
    elif change < -5:
        direction = "declining"
    else:
        direction = "stable"

    return QualityTrend(
        source_slug=source_slug,
        period_start=two_weeks_ago[:10],
        period_end=now.isoformat()[:10],
        completeness_then=score_then,
        completeness_now=score_now,
        change=change,
        direction=direction
    )


def get_all_source_quality(days: int = 30, min_events: int = 5) -> list[QualityMetrics]:
    """Get quality metrics for all sources with recent events."""
    client = get_client()

    # Get active sources
    sources = client.table("sources").select("id, slug, name").eq("is_active", True).execute()

    results = []
    for source in sources.data or []:
        metrics = calculate_source_quality(
            source["id"], source["slug"], source["name"], days
        )
        if metrics.total_events >= min_events:
            results.append(metrics)

    # Sort by completeness score (lowest first - most problematic)
    results.sort(key=lambda m: m.completeness_score)
    return results


def get_sources_needing_attention(threshold: float = 70) -> list[QualityMetrics]:
    """Get sources with quality score below threshold."""
    all_quality = get_all_source_quality()
    return [m for m in all_quality if m.completeness_score < threshold]


def get_declining_sources() -> list[QualityTrend]:
    """Get sources where quality is declining."""
    client = get_client()
    sources = client.table("sources").select("id, slug").eq("is_active", True).execute()

    declining = []
    for source in sources.data or []:
        trend = get_quality_trend(source["id"], source["slug"])
        if trend and trend.direction == "declining":
            declining.append(trend)

    declining.sort(key=lambda t: t.change)  # Most declining first
    return declining


def get_cinema_quality_report() -> dict:
    """Get detailed quality report for cinema/film sources."""
    client = get_client()

    # Find film-related sources
    result = client.table("sources").select("id, slug, name").or_(
        "slug.ilike.%theatre%,slug.ilike.%theater%,slug.ilike.%cinema%,slug.ilike.%film%"
    ).eq("is_active", True).execute()

    report = {
        "sources": [],
        "summary": {
            "total_sources": 0,
            "avg_completeness": 0,
            "sources_with_issues": 0
        }
    }

    for source in result.data or []:
        metrics = calculate_source_quality(source["id"], source["slug"], source["name"], days=30)
        if metrics.total_events > 0:
            report["sources"].append({
                "slug": metrics.source_slug,
                "name": metrics.source_name,
                "total_events": metrics.total_events,
                "completeness": metrics.completeness_score,
                "with_time_pct": metrics.events_with_time / metrics.total_events * 100 if metrics.total_events else 0,
                "with_image_pct": metrics.events_with_image / metrics.total_events * 100 if metrics.total_events else 0,
                "tba_count": metrics.tba_count,
                "issues": metrics.issues
            })

    report["summary"]["total_sources"] = len(report["sources"])
    if report["sources"]:
        report["summary"]["avg_completeness"] = sum(s["completeness"] for s in report["sources"]) / len(report["sources"])
        report["summary"]["sources_with_issues"] = sum(1 for s in report["sources"] if s["issues"])

    # Sort by completeness (worst first)
    report["sources"].sort(key=lambda s: s["completeness"])
    return report


def print_quality_report(days: int = 30, show_all: bool = False):
    """Print a formatted quality report."""
    print("\n" + "=" * 70)
    print("DATA QUALITY REPORT")
    print(f"Period: Last {days} days")
    print("=" * 70)

    # Get sources needing attention
    if show_all:
        sources = get_all_source_quality(days)
        print(f"\nAll Sources ({len(sources)} total):")
    else:
        sources = get_sources_needing_attention(threshold=75)
        print(f"\n⚠️  Sources Needing Attention ({len(sources)} below 75% quality):")

    print("-" * 70)
    print(f"{'Source':<35} {'Events':>7} {'Time%':>6} {'Img%':>6} {'Score':>6}")
    print("-" * 70)

    for m in sources[:20]:  # Top 20
        time_pct = m.events_with_time / m.total_events * 100 if m.total_events else 0
        img_pct = m.events_with_image / m.total_events * 100 if m.total_events else 0

        # Color indicator
        if m.completeness_score >= 80:
            indicator = "🟢"
        elif m.completeness_score >= 60:
            indicator = "🟡"
        else:
            indicator = "🔴"

        print(f"{indicator} {m.source_slug:<33} {m.total_events:>7} {time_pct:>5.0f}% {img_pct:>5.0f}% {m.completeness_score:>5.0f}%")

        # Show issues
        for issue in m.issues[:2]:
            print(f"   └─ {issue}")

    # Declining sources
    declining = get_declining_sources()
    if declining:
        print(f"\n📉 Declining Quality ({len(declining)} sources):")
        print("-" * 70)
        for t in declining[:5]:
            print(f"  {t.source_slug}: {t.completeness_then:.0f}% → {t.completeness_now:.0f}% ({t.change:+.0f}%)")

    # Cinema-specific report
    print("\n🎬 Cinema Sources:")
    print("-" * 70)
    cinema = get_cinema_quality_report()
    for s in cinema["sources"]:
        indicator = "🟢" if s["completeness"] >= 80 else "🟡" if s["completeness"] >= 60 else "🔴"
        print(f"{indicator} {s['slug']:<30} {s['total_events']:>5} events, {s['completeness']:>5.0f}% complete")
        if s["tba_count"] > 0:
            print(f"   └─ ⚠️  {s['tba_count']} TBA/placeholder events")
        for issue in s["issues"][:1]:
            print(f"   └─ {issue}")

    print("\n" + "=" * 70)


def get_tba_events_by_source() -> dict:
    """Get counts of TBA/placeholder events by source."""
    client = get_client()

    # Query events with TBA patterns
    result = client.table("events").select(
        "source_id, title, description"
    ).or_(
        "title.ilike.%tba%,title.ilike.%coming soon%,description.ilike.%tba%,description.ilike.%coming soon%"
    ).gte("start_date", datetime.utcnow().strftime("%Y-%m-%d")).execute()

    # Group by source
    by_source = {}
    for event in result.data or []:
        source_id = event["source_id"]
        if source_id not in by_source:
            by_source[source_id] = []
        by_source[source_id].append({
            "title": event["title"],
            "description": event.get("description", "")[:50]
        })

    # Get source names
    if by_source:
        sources = client.table("sources").select("id, slug, name").in_("id", list(by_source.keys())).execute()
        source_map = {s["id"]: s for s in sources.data or []}

        result = {}
        for source_id, events in by_source.items():
            source = source_map.get(source_id, {})
            result[source.get("slug", f"source-{source_id}")] = {
                "name": source.get("name", "Unknown"),
                "count": len(events),
                "examples": events[:3]
            }
        return result

    return {}


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        print_quality_report(days=30, show_all=True)
    elif len(sys.argv) > 1 and sys.argv[1] == "--tba":
        tba = get_tba_events_by_source()
        print("\nTBA/Placeholder Events by Source:")
        print("-" * 50)
        for slug, data in sorted(tba.items(), key=lambda x: -x[1]["count"]):
            print(f"\n{slug} ({data['name']}): {data['count']} TBA events")
            for ex in data["examples"]:
                print(f"  - {ex['title'][:40]}")
    else:
        print_quality_report(days=30, show_all=False)
