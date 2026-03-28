#!/usr/bin/env python3
"""
Surface-out data quality audit for LostCity Atlanta portal.

Unlike field-completeness audits, this script queries the SAME data each
user-facing surface renders and grades it from the user's perspective.

Dimensions per surface:
  - Populated: enough items to not look empty
  - Accurate: correct categories, no leakage, no misclassification
  - Deduplicated: no near-duplicate cards visible
  - Fresh: no past events, no stale series, no closed venues
  - Visual: images present where the UI depends on them

Run:
  cd /Users/coach/Projects/LostCity/crawlers
  python3 scripts/surface_quality_audit.py
  python3 scripts/surface_quality_audit.py --verbose
  python3 scripts/surface_quality_audit.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

# ── Atlanta portal config ──────────────────────────────────────────
ATLANTA_PORTAL_SLUG = "atlanta"
ATLANTA_METRO_CITIES = {
    "alpharetta", "atlanta", "avondale estates", "brookhaven", "chamblee",
    "college park", "decatur", "doraville", "duluth", "dunwoody",
    "east point", "johns creek", "kennesaw", "lawrenceville", "marietta",
    "peachtree city", "roswell", "sandy springs", "smyrna",
    "stone mountain", "tucker", "woodstock",
}

# ── Thresholds per surface ─────────────────────────────────────────
# Each key maps to {dimension: {warn, fail}} with direction (min or max)
SURFACE_THRESHOLDS = {
    "city_pulse_feed": {
        "sections_with_content":  {"warn_lt": 5, "fail_lt": 3},
        "total_events":           {"warn_lt": 30, "fail_lt": 15},
        "image_rate_pct":         {"warn_lt": 50, "fail_lt": 30},
        "stale_event_count":      {"warn_gt": 0, "fail_gt": 5},
        "inactive_venue_count":   {"warn_gt": 0, "fail_gt": 3},
    },
    "tonight": {
        "total_events":           {"warn_lt": 8, "fail_lt": 3},
        "image_rate_pct":         {"warn_lt": 40, "fail_lt": 20},
        "missing_time_pct":       {"warn_gt": 10, "fail_gt": 25},
    },
    "this_weekend": {
        "total_events":           {"warn_lt": 20, "fail_lt": 8},
        "image_rate_pct":         {"warn_lt": 40, "fail_lt": 20},
        "fuzzy_dupe_groups":      {"warn_gt": 3, "fail_gt": 10},
    },
    "regulars": {
        "total_events":           {"warn_lt": 40, "fail_lt": 15},
        "support_group_count":    {"warn_gt": 0, "fail_gt": 0},
        "class_leakage_count":    {"warn_gt": 3, "fail_gt": 10},
        "fuzzy_dupe_groups":      {"warn_gt": 5, "fail_gt": 15},
        "missing_genre_pct":      {"warn_gt": 30, "fail_gt": 50},
    },
    "music_tonight": {
        "total_events":           {"warn_lt": 5, "fail_lt": 2},
        "missing_time_count":     {"warn_gt": 0, "fail_gt": 3},
        "non_atlanta_in_db":      {"warn_gt": 10, "fail_gt": 50},
        "artist_coverage_pct":    {"warn_lt": 60, "fail_lt": 40},
    },
    "showtimes": {
        "total_films":            {"warn_lt": 3, "fail_lt": 1},
        "total_theaters":         {"warn_lt": 2, "fail_lt": 1},
        "missing_series_pct":     {"warn_gt": 30, "fail_gt": 50},
    },
    "calendar_this_week": {
        "total_events":           {"warn_lt": 50, "fail_lt": 20},
        "empty_days":             {"warn_gt": 1, "fail_gt": 3},
        "missing_category_pct":   {"warn_gt": 15, "fail_gt": 30},
    },
    "event_detail_sample": {
        "missing_venue_geo_pct":  {"warn_gt": 10, "fail_gt": 25},
        "missing_description_pct": {"warn_gt": 20, "fail_gt": 40},
        "price_inconsistency":    {"warn_gt": 3, "fail_gt": 10},
    },
    "venue_destinations": {
        "total_venues":           {"warn_lt": 100, "fail_lt": 50},
        "missing_image_pct":      {"warn_gt": 60, "fail_gt": 80},
        "missing_description_pct": {"warn_gt": 40, "fail_gt": 60},
        "missing_neighborhood_pct": {"warn_gt": 10, "fail_gt": 25},
        "missing_hours_pct":      {"warn_gt": 60, "fail_gt": 80},
    },
    "search": {
        "nashville_venue_leakage": {"warn_gt": 0, "fail_gt": 5},
        "null_portal_events":     {"warn_gt": 50, "fail_gt": 200},
    },
}


# ── Helpers ────────────────────────────────────────────────────────

def pct(num: int, den: int) -> float:
    return round((num / den) * 100, 1) if den else 0.0


def apply_threshold(
    value: float | int,
    *,
    warn_gt: float | None = None,
    fail_gt: float | None = None,
    warn_lt: float | None = None,
    fail_lt: float | None = None,
) -> str:
    if fail_gt is not None and value > fail_gt:
        return "FAIL"
    if fail_lt is not None and value < fail_lt:
        return "FAIL"
    if warn_gt is not None and value > warn_gt:
        return "WARN"
    if warn_lt is not None and value < warn_lt:
        return "WARN"
    return "PASS"


def grade_metric(value: float | int, thresholds: dict) -> str:
    return apply_threshold(value, **thresholds)


def normalize_title(title: str) -> str:
    """Normalize event title for fuzzy dedup (mirrors web/lib/event-feed-health.ts)."""
    t = (title or "").lower().strip()
    t = re.sub(r"\s+at\s+[^|]+$", "", t)
    t = re.sub(r"\s*night\s*", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def is_atlanta_city(city: str | None) -> bool:
    return (city or "").lower().strip() in ATLANTA_METRO_CITIES


def paged_select(
    client,
    table: str,
    fields: str,
    *,
    query_builder=None,
    page_size: int = 1000,
) -> list[dict]:
    rows = []
    offset = 0
    while True:
        q = client.table(table).select(fields).range(offset, offset + page_size - 1)
        if query_builder:
            q = query_builder(q)
        result = q.execute()
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def count_exact(client, table: str, query_builder=None) -> int:
    q = client.table(table).select("id", count="exact")
    if query_builder:
        q = query_builder(q)
    result = q.limit(1).execute()
    return int(result.count or 0)


# ── Surface auditors ──────────────────────────────────────────────

def audit_city_pulse_feed(client, portal_id: int, today: str, verbose: bool) -> dict:
    """Audit the main CityPulse feed — today + 7 day lookahead."""
    # Fetch today's events (Right Now / Tonight sections)
    today_events = paged_select(
        client, "events",
        "id, title, start_date, start_time, image_url, category_id, is_sensitive, is_feed_ready, "
        "venue:venues(id, name, city, active, image_url)",
        query_builder=lambda q: q.eq("start_date", today)
            .is_("canonical_event_id", "null")
            .or_("is_sensitive.eq.false,is_sensitive.is.null"),
    )

    # Fetch this week's events
    week_end = (date.fromisoformat(today) + timedelta(days=7)).isoformat()
    week_events = paged_select(
        client, "events",
        "id, title, start_date, start_time, image_url, category_id, is_feed_ready, "
        "venue:venues(id, name, city, active)",
        query_builder=lambda q: q.gte("start_date", today).lte("start_date", week_end)
            .is_("canonical_event_id", "null")
            .or_("is_sensitive.eq.false,is_sensitive.is.null"),
    )

    # Filter to Atlanta metro
    today_events = [e for e in today_events if is_atlanta_city(
        (e.get("venue") or {}).get("city"))]
    week_events = [e for e in week_events if is_atlanta_city(
        (e.get("venue") or {}).get("city"))]

    # Metrics
    total = len(week_events)
    with_image = sum(1 for e in week_events if e.get("image_url"))
    stale = sum(1 for e in week_events if e.get("start_date", "") < today)
    # Only count inactive venues on feed-ready events (matches what users see)
    inactive_venues = sum(1 for e in week_events
                         if (e.get("venue") or {}).get("is_active") is False
                         and e.get("is_feed_ready") is not False)

    # Estimate section fill: today, tonight (7pm+), weekend, this week
    tonight_count = sum(1 for e in today_events
                        if (e.get("start_time") or "") >= "19:00")
    weekend_dates = set()
    d = date.fromisoformat(today)
    for i in range(7):
        check = d + timedelta(days=i)
        if check.weekday() in (5, 6):  # Sat, Sun
            weekend_dates.add(check.isoformat())
    weekend_count = sum(1 for e in week_events
                        if e.get("start_date") in weekend_dates)

    sections_with_content = 0
    if len(today_events) >= 2:
        sections_with_content += 1  # Right Now
    if tonight_count >= 2:
        sections_with_content += 1  # Tonight
    if weekend_count >= 2:
        sections_with_content += 1  # Weekend
    if total >= 2:
        sections_with_content += 1  # This Week
    # Coming Up (8+ days) — check
    coming_up_start = (date.fromisoformat(today) + timedelta(days=8)).isoformat()
    coming_up_end = (date.fromisoformat(today) + timedelta(days=30)).isoformat()
    coming_up = count_exact(
        client, "events",
        query_builder=lambda q: q.gte("start_date", coming_up_start)
            .lte("start_date", coming_up_end)
            .is_("canonical_event_id", "null"),
    )
    if coming_up >= 2:
        sections_with_content += 1

    # Music events today
    music_today = sum(1 for e in today_events if e.get("category_id") == "music")
    if music_today >= 2:
        sections_with_content += 1  # Scene/Music

    # Film today
    film_today = sum(1 for e in today_events if e.get("category_id") == "film")
    if film_today >= 2:
        sections_with_content += 1  # Now Showing

    metrics = {
        "sections_with_content": sections_with_content,
        "total_events": total,
        "today_events": len(today_events),
        "tonight_events": tonight_count,
        "weekend_events": weekend_count,
        "coming_up_events": coming_up,
        "image_rate_pct": pct(with_image, total),
        "stale_event_count": stale,
        "inactive_venue_count": inactive_venues,
    }

    details = []
    if verbose and inactive_venues > 0:
        bad = [e for e in week_events if (e.get("venue") or {}).get("is_active") is False]
        details = [{"id": e["id"], "title": e.get("title"), "venue": (e.get("venue") or {}).get("name")}
                   for e in bad[:10]]

    return {"metrics": metrics, "details": details}


def audit_tonight(client, today: str, verbose: bool) -> dict:
    """Events happening tonight (after 7pm)."""
    events = paged_select(
        client, "events",
        "id, title, start_time, image_url, category_id, "
        "venue:venues(id, name, city, active)",
        query_builder=lambda q: q.eq("start_date", today)
            .is_("canonical_event_id", "null")
            .gte("start_time", "19:00:00")
            .or_("is_sensitive.eq.false,is_sensitive.is.null"),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)
    with_image = sum(1 for e in events if e.get("image_url"))
    no_time = sum(1 for e in events if not e.get("start_time"))

    return {"metrics": {
        "total_events": total,
        "image_rate_pct": pct(with_image, total),
        "missing_time_pct": pct(no_time, total),
    }, "details": []}


def audit_this_weekend(client, today: str, verbose: bool) -> dict:
    """Events on the upcoming Saturday and Sunday."""
    d = date.fromisoformat(today)
    # Find next Saturday
    days_until_sat = (5 - d.weekday()) % 7
    if days_until_sat == 0 and d.weekday() != 5:
        days_until_sat = 7
    sat = d + timedelta(days=days_until_sat)
    sun = sat + timedelta(days=1)
    # If today is Sat or Sun, use this weekend
    if d.weekday() == 5:
        sat = d
        sun = d + timedelta(days=1)
    elif d.weekday() == 6:
        sat = d - timedelta(days=1)
        sun = d

    events = paged_select(
        client, "events",
        "id, title, start_date, start_time, image_url, "
        "venue:venues(id, name, city, active)",
        query_builder=lambda q: q.gte("start_date", sat.isoformat())
            .lte("start_date", sun.isoformat())
            .is_("canonical_event_id", "null")
            .or_("is_sensitive.eq.false,is_sensitive.is.null"),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)
    with_image = sum(1 for e in events if e.get("image_url"))

    # Fuzzy dedup check
    seen = {}
    dupe_groups = 0
    for e in events:
        venue_name = ((e.get("venue") or {}).get("name") or "").lower().strip()
        dt = e.get("start_date", "")
        tm = e.get("start_time") or ""
        title = normalize_title(e.get("title") or "")
        key = f"{venue_name}|{dt}|{tm}|{title}"
        if key in seen:
            dupe_groups += 1
        else:
            seen[key] = e

    details = []
    if verbose and dupe_groups > 0:
        dupe_map = defaultdict(list)
        for e in events:
            venue_name = ((e.get("venue") or {}).get("name") or "").lower().strip()
            dt = e.get("start_date", "")
            tm = e.get("start_time") or ""
            title = normalize_title(e.get("title") or "")
            key = f"{venue_name}|{dt}|{tm}|{title}"
            dupe_map[key].append(e)
        for key, group in dupe_map.items():
            if len(group) > 1:
                details.append({
                    "key": key,
                    "count": len(group),
                    "ids": [e["id"] for e in group],
                })

    return {"metrics": {
        "total_events": total,
        "image_rate_pct": pct(with_image, total),
        "fuzzy_dupe_groups": dupe_groups,
        "weekend_dates": f"{sat.isoformat()} – {sun.isoformat()}",
    }, "details": details[:10]}


def audit_regulars(client, today: str, verbose: bool) -> dict:
    """Regulars tab — recurring weekly events."""
    week_end = (date.fromisoformat(today) + timedelta(days=7)).isoformat()

    events = paged_select(
        client, "events",
        "id, title, start_date, start_time, category_id, tags, genres, is_class, "
        "series:series(id, genres, day_of_week, frequency), "
        "venue:venues(id, name, city, active, neighborhood)",
        query_builder=lambda q: q.gte("start_date", today).lte("start_date", week_end)
            .not_.is_("series_id", "null")
            .is_("canonical_event_id", "null")
            .eq("is_regular_ready", True),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)

    # Check for support groups / community that shouldn't be here
    support_group_count = sum(1 for e in events
                              if e.get("category_id") in ("support_group", "community"))

    # Check for class leakage
    class_count = sum(1 for e in events
                      if e.get("is_class") is True
                      or "class" in (e.get("tags") or []))

    # Fuzzy dedup
    seen = {}
    dupe_groups = 0
    for e in events:
        venue_name = ((e.get("venue") or {}).get("name") or "").lower().strip()
        dt = e.get("start_date", "")
        tm = e.get("start_time") or ""
        title = normalize_title(e.get("title") or "")
        key = f"{venue_name}|{dt}|{tm}|{title}"
        if key in seen:
            dupe_groups += 1
        else:
            seen[key] = e

    # Genre coverage
    missing_genre = sum(1 for e in events
                        if not (e.get("genres") or [])
                        and not ((e.get("series") or {}).get("genres") or []))

    details = []
    if verbose and support_group_count > 0:
        bad = [e for e in events if e.get("category_id") in ("support_group", "community")]
        details.extend([{"issue": "support_group", "id": e["id"],
                        "title": e.get("title"), "category": e.get("category_id")}
                       for e in bad[:5]])

    return {"metrics": {
        "total_events": total,
        "support_group_count": support_group_count,
        "class_leakage_count": class_count,
        "fuzzy_dupe_groups": dupe_groups,
        "missing_genre_pct": pct(missing_genre, total),
    }, "details": details}


def audit_music_tonight(client, today: str, verbose: bool) -> dict:
    """Music What's On — tonight's shows."""
    events = paged_select(
        client, "events",
        "id, title, start_time, category_id, "
        "event_artists(name, is_headliner, billing_order), "
        "venue:venues(id, name, city, slug)",
        query_builder=lambda q: q.eq("start_date", today)
            .eq("category_id", "music")
            .not_.is_("start_time", "null"),
    )

    # Check for non-Atlanta events in DB (API applies portal scope, so these aren't user-visible)
    all_count = len(events)
    atl_events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]
    non_atlanta_count = all_count - len(atl_events)

    total = len(atl_events)
    no_time = sum(1 for e in atl_events if not e.get("start_time"))
    with_artists = sum(1 for e in atl_events if (e.get("event_artists") or []))
    has_headliner = sum(1 for e in atl_events
                        if any(a.get("is_headliner") for a in (e.get("event_artists") or [])))

    details = []
    if verbose and non_atlanta_count > 0:
        leaked = [e for e in events if not is_atlanta_city((e.get("venue") or {}).get("city"))]
        details = [{"id": e["id"], "title": e.get("title"),
                    "venue": (e.get("venue") or {}).get("name"),
                    "city": (e.get("venue") or {}).get("city"),
                    "note": "DB-level only; API applies portal scope"}
                   for e in leaked[:5]]

    return {"metrics": {
        "total_events": total,
        "missing_time_count": no_time,
        "non_atlanta_in_db": non_atlanta_count,
        "artist_coverage_pct": pct(with_artists, total),
        "headliner_rate_pct": pct(has_headliner, total),
    }, "details": details}


def audit_showtimes(client, today: str, verbose: bool) -> dict:
    """Film showtimes — today's screenings."""
    events = paged_select(
        client, "events",
        "id, title, start_time, series_id, tags, "
        "venue:venues(id, name, slug, city, neighborhood), "
        "series:series(id, slug, title)",
        query_builder=lambda q: q.eq("start_date", today)
            .eq("category_id", "film")
            .not_.is_("start_time", "null"),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)
    theaters = set()
    films = set()
    missing_series = 0

    for e in events:
        venue = e.get("venue") or {}
        theaters.add(venue.get("slug") or venue.get("name") or "unknown")
        series = e.get("series") or {}
        if series.get("id"):
            films.add(series.get("slug") or series.get("title") or "unknown")
        else:
            missing_series += 1
            # Fuzzy group by title
            films.add(normalize_title(e.get("title") or ""))

    return {"metrics": {
        "total_events": total,
        "total_films": len(films),
        "total_theaters": len(theaters),
        "missing_series_pct": pct(missing_series, total),
    }, "details": []}


def audit_calendar_this_week(client, today: str, verbose: bool) -> dict:
    """Calendar view — this week's event density."""
    d = date.fromisoformat(today)
    week_end = d + timedelta(days=6)

    events = paged_select(
        client, "events",
        "id, title, start_date, start_time, category_id, "
        "venue:venues(id, name, city)",
        query_builder=lambda q: q.gte("start_date", today)
            .lte("start_date", week_end.isoformat())
            .is_("canonical_event_id", "null")
            .or_("is_sensitive.eq.false,is_sensitive.is.null"),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)

    # Count events per day
    day_counts = Counter(e.get("start_date") for e in events)
    empty_days = 0
    for i in range(7):
        check = (d + timedelta(days=i)).isoformat()
        if day_counts.get(check, 0) == 0:
            empty_days += 1

    # Category coverage
    no_category = sum(1 for e in events if not e.get("category_id"))

    details = []
    if verbose:
        for i in range(7):
            check = (d + timedelta(days=i)).isoformat()
            details.append({"date": check, "count": day_counts.get(check, 0)})

    return {"metrics": {
        "total_events": total,
        "empty_days": empty_days,
        "missing_category_pct": pct(no_category, total),
        "avg_events_per_day": round(total / 7, 1) if total else 0,
    }, "details": details}


def audit_event_detail_sample(client, today: str, verbose: bool) -> dict:
    """Sample recent events and check detail-page data quality."""
    # Sample 200 upcoming events
    events = paged_select(
        client, "events",
        "id, title, start_date, description, is_free, price_min, price_max, "
        "venue:venues(id, name, city, lat, lng, active, neighborhood, hours)",
        query_builder=lambda q: q.gte("start_date", today)
            .is_("canonical_event_id", "null")
            .order("start_date")
            .limit(200),
    )
    events = [e for e in events if is_atlanta_city((e.get("venue") or {}).get("city"))]

    total = len(events)
    if total == 0:
        return {"metrics": {"total_sampled": 0}, "details": []}

    no_geo = sum(1 for e in events
                 if not (e.get("venue") or {}).get("lat")
                 or not (e.get("venue") or {}).get("lng"))
    no_desc = sum(1 for e in events
                  if not e.get("description") or len(e.get("description", "")) < 20)
    # Price inconsistency: not free, but both price fields null
    price_issues = sum(1 for e in events
                       if e.get("is_free") is not True
                       and not e.get("price_min") and not e.get("price_max")
                       and e.get("is_free") is not None)

    details = []
    if verbose and no_geo > 0:
        bad = [e for e in events
               if not (e.get("venue") or {}).get("lat")]
        details = [{"id": e["id"], "title": e.get("title"),
                    "venue": (e.get("venue") or {}).get("name")}
                   for e in bad[:5]]

    return {"metrics": {
        "total_sampled": total,
        "missing_venue_geo_pct": pct(no_geo, total),
        "missing_description_pct": pct(no_desc, total),
        "price_inconsistency": price_issues,
    }, "details": details}


def audit_venue_destinations(client, verbose: bool) -> dict:
    """Venue/spot quality — the destinations layer."""
    venues = paged_select(
        client, "venues",
        "id, name, slug, city, active, image_url, description, neighborhood, "
        "hours, venue_type, lat, lng",
        query_builder=lambda q: q.eq("is_active", True),
    )
    venues = [v for v in venues if is_atlanta_city(v.get("city"))]

    total = len(venues)
    if total == 0:
        return {"metrics": {"total_venues": 0}, "details": []}

    no_image = sum(1 for v in venues if not v.get("image_url"))
    no_desc = sum(1 for v in venues
                  if not v.get("description") or len(v.get("description", "")) < 20)
    no_hood = sum(1 for v in venues if not v.get("neighborhood"))
    no_hours = sum(1 for v in venues if not v.get("hours"))
    no_type = sum(1 for v in venues if not v.get("place_type"))
    no_geo = sum(1 for v in venues if not v.get("lat") or not v.get("lng"))

    # Type distribution
    type_dist = Counter(v.get("place_type") or "null" for v in venues)

    details = []
    if verbose:
        details.append({"type_distribution": dict(type_dist.most_common(15))})
        if no_image > 0:
            no_img_venues = [v for v in venues if not v.get("image_url")]
            details.append({"sample_no_image": [v.get("name") for v in no_img_venues[:10]]})

    return {"metrics": {
        "total_venues": total,
        "missing_image_pct": pct(no_image, total),
        "missing_description_pct": pct(no_desc, total),
        "missing_neighborhood_pct": pct(no_hood, total),
        "missing_hours_pct": pct(no_hours, total),
        "missing_type_pct": pct(no_type, total),
        "missing_geo_pct": pct(no_geo, total),
    }, "details": details}


def audit_search_leakage(client, verbose: bool) -> dict:
    """Check for portal scope leakage in searchable data.

    Tests the search_venues_ranked RPC with p_city='Atlanta' to verify
    Nashville venues don't appear in results (the RPC is the actual code path).
    Also checks raw table for Nashville venue count as a DB-level metric.
    """
    # Test the actual search RPC — this is what users hit
    rpc_result = client.rpc("search_venues_ranked", {
        "p_query": "bar",
        "p_city": "Atlanta",
        "p_limit": 200,
    }).execute()
    rpc_venues = rpc_result.data or []
    nashville_in_rpc = [v for v in rpc_venues
                        if (v.get("city") or "").lower() not in ATLANTA_METRO_CITIES]

    # Raw DB count of Nashville venues (informational, not user-visible)
    nashville_venues_in_db = count_exact(
        client, "venues",
        query_builder=lambda q: q.eq("is_active", True).eq("city", "Nashville"),
    )

    # Events with null portal_id (potential leakage)
    null_portal = count_exact(
        client, "events",
        query_builder=lambda q: q.is_("portal_id", "null")
            .gte("start_date", date.today().isoformat())
            .is_("canonical_event_id", "null"),
    )

    details = []
    if verbose and nashville_in_rpc:
        details = [{"name": v.get("name"), "slug": v.get("slug"),
                    "note": "appeared in search_venues_ranked with p_city=Atlanta"}
                   for v in nashville_in_rpc[:10]]

    return {"metrics": {
        "nashville_venue_leakage": len(nashville_in_rpc),
        "nashville_venues_in_db": nashville_venues_in_db,
        "null_portal_events": null_portal,
    }, "details": details}


# ── Scorecard builder ─────────────────────────────────────────────

def build_scorecard(results: dict[str, dict]) -> list[dict]:
    """Grade each surface and build the scorecard."""
    checks = []
    for surface_name, result in results.items():
        thresholds = SURFACE_THRESHOLDS.get(surface_name, {})
        metrics = result.get("metrics", {})
        surface_checks = []

        for metric_key, metric_value in metrics.items():
            if metric_key in thresholds:
                status = grade_metric(metric_value, thresholds[metric_key])
                surface_checks.append({
                    "surface": surface_name,
                    "metric": metric_key,
                    "value": metric_value,
                    "threshold": thresholds[metric_key],
                    "status": status,
                })

        # Overall surface grade = worst check
        if surface_checks:
            worst = max(surface_checks, key=lambda c: {"PASS": 0, "WARN": 1, "FAIL": 2}[c["status"]])
            surface_grade = worst["status"]
        else:
            surface_grade = "PASS"

        checks.append({
            "surface": surface_name,
            "grade": surface_grade,
            "checks": surface_checks,
            "metrics": metrics,
            "details": result.get("details", []),
        })

    return checks


def render_markdown(scorecard: list[dict]) -> str:
    """Render scorecard as markdown."""
    today = date.today().isoformat()
    lines = [
        f"# Atlanta Portal Surface Quality Audit — {today}",
        "",
    ]

    # Overall summary
    grades = Counter(s["grade"] for s in scorecard)
    total = len(scorecard)
    overall = "FAIL" if grades.get("FAIL", 0) > 0 else "WARN" if grades.get("WARN", 0) > 0 else "PASS"
    status_icon = {"PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL"}

    lines.append(f"**Overall: {status_icon[overall]}** — "
                 f"PASS {grades.get('PASS', 0)} | WARN {grades.get('WARN', 0)} | FAIL {grades.get('FAIL', 0)} "
                 f"(of {total} surfaces)")
    lines.append("")

    # Summary table
    lines.append("## Surface Grades")
    lines.append("")
    lines.append("| Surface | Grade | Key Metric | Value |")
    lines.append("|---------|-------|------------|-------|")

    for s in scorecard:
        # Find the worst metric to highlight
        worst_check = None
        for c in s.get("checks", []):
            if c["status"] != "PASS":
                if worst_check is None or {"WARN": 1, "FAIL": 2}.get(c["status"], 0) > {"WARN": 1, "FAIL": 2}.get(worst_check["status"], 0):
                    worst_check = c
        if worst_check:
            key_metric = worst_check["metric"]
            key_value = worst_check["value"]
        else:
            # Pick the first metric
            checks = s.get("checks", [])
            if checks:
                key_metric = checks[0]["metric"]
                key_value = checks[0]["value"]
            else:
                key_metric = "—"
                key_value = "—"

        icon = {"PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL"}[s["grade"]]
        display_name = s["surface"].replace("_", " ").title()
        lines.append(f"| {display_name} | **{icon}** | {key_metric} | {key_value} |")

    lines.append("")

    # Detailed findings per surface
    lines.append("## Detailed Findings")
    lines.append("")

    for s in scorecard:
        display_name = s["surface"].replace("_", " ").title()
        icon = {"PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL"}[s["grade"]]
        lines.append(f"### {display_name} — {icon}")
        lines.append("")

        # All metrics
        lines.append("| Metric | Value | Status |")
        lines.append("|--------|-------|--------|")
        for c in s.get("checks", []):
            status_str = c["status"]
            lines.append(f"| {c['metric']} | {c['value']} | {status_str} |")

        # Non-threshold metrics
        threshold_keys = {c["metric"] for c in s.get("checks", [])}
        for k, v in s.get("metrics", {}).items():
            if k not in threshold_keys:
                lines.append(f"| {k} | {v} | — |")

        lines.append("")

        # Details
        if s.get("details"):
            lines.append("<details>")
            lines.append(f"<summary>Details ({len(s['details'])} items)</summary>")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(s["details"], indent=2, default=str))
            lines.append("```")
            lines.append("</details>")
            lines.append("")

    # Action items
    fails = []
    warns = []
    for s in scorecard:
        for c in s.get("checks", []):
            entry = f"**{s['surface'].replace('_', ' ').title()}** → {c['metric']} = {c['value']}"
            if c["status"] == "FAIL":
                fails.append(entry)
            elif c["status"] == "WARN":
                warns.append(entry)

    if fails or warns:
        lines.append("## Action Items")
        lines.append("")
        if fails:
            lines.append("### Failures (fix before launch)")
            for f in fails:
                lines.append(f"- {f}")
            lines.append("")
        if warns:
            lines.append("### Warnings (fix or accept)")
            for w in warns:
                lines.append(f"- {w}")
            lines.append("")

    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Surface-out quality audit for Atlanta portal")
    parser.add_argument("--verbose", "-v", action="store_true", help="Include detail drilldowns")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of markdown")
    parser.add_argument("--surface", "-s", help="Audit a single surface only")
    args = parser.parse_args()

    client = get_client()
    today = date.today().isoformat()
    verbose = args.verbose

    # Resolve Atlanta portal ID
    portal_result = client.table("portals").select("id").eq("slug", ATLANTA_PORTAL_SLUG).maybe_single().execute()
    portal_id = (portal_result.data or {}).get("id")
    if not portal_id:
        print("ERROR: Could not find Atlanta portal. Check portals table.", file=sys.stderr)
        sys.exit(1)

    surface_map = {
        "city_pulse_feed":      lambda: audit_city_pulse_feed(client, portal_id, today, verbose),
        "tonight":              lambda: audit_tonight(client, today, verbose),
        "this_weekend":         lambda: audit_this_weekend(client, today, verbose),
        "regulars":             lambda: audit_regulars(client, today, verbose),
        "music_tonight":        lambda: audit_music_tonight(client, today, verbose),
        "showtimes":            lambda: audit_showtimes(client, today, verbose),
        "calendar_this_week":   lambda: audit_calendar_this_week(client, today, verbose),
        "event_detail_sample":  lambda: audit_event_detail_sample(client, today, verbose),
        "venue_destinations":   lambda: audit_venue_destinations(client, verbose),
        "search":               lambda: audit_search_leakage(client, verbose),
    }

    if args.surface:
        if args.surface not in surface_map:
            print(f"Unknown surface: {args.surface}", file=sys.stderr)
            print(f"Available: {', '.join(surface_map.keys())}", file=sys.stderr)
            sys.exit(1)
        surface_map = {args.surface: surface_map[args.surface]}

    print(f"Auditing {len(surface_map)} surfaces for Atlanta portal (id={portal_id})...",
          file=sys.stderr)

    results = {}
    for name, audit_fn in surface_map.items():
        print(f"  → {name}...", file=sys.stderr)
        try:
            results[name] = audit_fn()
        except Exception as exc:
            print(f"    ERROR: {exc}", file=sys.stderr)
            results[name] = {"metrics": {"error": str(exc)}, "details": []}

    scorecard = build_scorecard(results)

    if args.json:
        print(json.dumps(scorecard, indent=2, default=str))
    else:
        print(render_markdown(scorecard))


if __name__ == "__main__":
    main()
