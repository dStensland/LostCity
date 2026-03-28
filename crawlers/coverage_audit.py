#!/usr/bin/env python3
"""
Content coverage audit for LostCity Atlanta platform recurring events.
Queries Supabase to identify coverage gaps in crawlers, neighborhoods,
activity types, genres, and more.
"""

import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

# Ensure we can import from the crawlers package
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_client


def fetch_all_paged(build_query_fn, page_size=1000):
    """
    Paginate through a Supabase query.
    build_query_fn: callable that returns a fresh query builder each time (needed because
    supabase-py query builders are not reusable after .range().execute()).
    """
    all_rows = []
    offset = 0
    while True:
        q = build_query_fn()
        result = q.range(offset, offset + page_size - 1).execute()
        rows = result.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows


def print_table(headers, rows, col_widths=None):
    """Print a formatted ASCII table."""
    if not rows:
        print("  (no data)")
        return
    if col_widths is None:
        col_widths = []
        for i, h in enumerate(headers):
            max_w = len(str(h))
            for r in rows:
                val = str(r[i]) if i < len(r) else ""
                max_w = max(max_w, len(val))
            col_widths.append(min(max_w, 80))

    fmt = "  " + " | ".join(f"{{:<{w}}}" for w in col_widths)
    sep = "  " + "-+-".join("-" * w for w in col_widths)

    print(fmt.format(*[str(h)[:w] for h, w in zip(headers, col_widths)]))
    print(sep)
    for r in rows:
        vals = [str(r[i])[:col_widths[i]] if i < len(r) else "" for i in range(len(headers))]
        print(fmt.format(*vals))


def query_1_activity_type_distribution(events):
    """Activity type distribution for recurring events in next 7 days."""
    print("\n" + "=" * 80)
    print("QUERY 1: Activity Type Distribution (recurring events, next 7 days)")
    print("=" * 80)

    category_counts = Counter()
    nightlife_with_genres = 0
    nightlife_no_genres = 0

    for e in events:
        cat = e.get("category_id") or "unknown"
        category_counts[cat] += 1
        if cat == "nightlife":
            genres = e.get("genres") or []
            if genres:
                nightlife_with_genres += 1
            else:
                nightlife_no_genres += 1

    total = len(events) or 1
    rows = sorted(category_counts.items(), key=lambda x: -x[1])
    print(f"\n  Total recurring events in next 7 days: {len(events)}")
    print(f"\n  Category distribution:")
    print_table(
        ["Category", "Count", "Pct"],
        [(cat, cnt, f"{cnt/total*100:.1f}%") for cat, cnt in rows]
    )

    print(f"\n  Nightlife breakdown:")
    print(f"    With genres: {nightlife_with_genres}")
    print(f"    Without genres (unmatched): {nightlife_no_genres}")


def query_2_nightlife_genre_coverage(events):
    """Nightlife genre distribution for recurring events."""
    print("\n" + "=" * 80)
    print("QUERY 2: Nightlife Coverage by Genre (recurring events, next 7 days)")
    print("=" * 80)

    nightlife_events = [e for e in events if e.get("category_id") == "nightlife"]
    genre_counts = Counter()
    no_genre_events = []

    for e in nightlife_events:
        genres = e.get("genres") or []
        if not genres:
            no_genre_events.append(e)
        for g in genres:
            genre_counts[g] += 1

    print(f"\n  Total nightlife recurring events: {len(nightlife_events)}")
    print(f"\n  Genre distribution (unnested):")
    rows = sorted(genre_counts.items(), key=lambda x: -x[1])
    print_table(
        ["Genre", "Count"],
        rows
    )

    print(f"\n  Nightlife events with NO genres: {len(no_genre_events)}")
    if no_genre_events:
        print(f"  Sample events with no genres (up to 20):")
        for e in no_genre_events[:20]:
            print(f"    - [{e.get('id')}] {e.get('title', '?')[:60]} (source_id={e.get('source_id')})")


def query_3_source_coverage(events, sources_map):
    """Source coverage for recurring events."""
    print("\n" + "=" * 80)
    print("QUERY 3: Source Coverage for Recurring Events (next 7 days)")
    print("=" * 80)

    source_counts = Counter()
    for e in events:
        sid = e.get("source_id")
        source_counts[sid] += 1

    rows = []
    for sid, cnt in source_counts.most_common(30):
        info = sources_map.get(sid, {})
        rows.append((
            sid,
            info.get("slug", "?"),
            info.get("name", "?")[:40],
            cnt,
            info.get("crawl_frequency", "?"),
        ))

    print(f"\n  Top 30 sources by recurring event count:")
    print_table(
        ["ID", "Slug", "Name", "Count", "Frequency"],
        rows,
        col_widths=[5, 30, 40, 6, 15]
    )


def query_4_neighborhood_coverage(events, venues_map):
    """Neighborhood coverage for recurring events."""
    print("\n" + "=" * 80)
    print("QUERY 4: Neighborhood Coverage (recurring events, next 7 days)")
    print("=" * 80)

    hood_counts = Counter()
    no_venue_count = 0

    for e in events:
        vid = e.get("place_id")
        if not vid:
            no_venue_count += 1
            continue
        venue = venues_map.get(vid)
        if not venue:
            no_venue_count += 1
            continue
        hood = venue.get("neighborhood") or "Unknown"
        hood_counts[hood] += 1

    rows = sorted(hood_counts.items(), key=lambda x: -x[1])
    total = len(events) or 1
    print(f"\n  Total neighborhoods with recurring events: {len(hood_counts)}")
    print(f"  Events with no venue/neighborhood: {no_venue_count}")

    print(f"\n  Neighborhood distribution (all):")
    print_table(
        ["Neighborhood", "Count", "Pct"],
        [(h, c, f"{c/total*100:.1f}%") for h, c in rows]
    )

    # Bottom 10
    if len(rows) > 10:
        print(f"\n  LEAST covered neighborhoods (bottom 10):")
        print_table(
            ["Neighborhood", "Count"],
            rows[-10:]
        )


def query_5_day_of_week(events):
    """Day-of-week distribution for recurring events."""
    print("\n" + "=" * 80)
    print("QUERY 5: Day-of-Week Distribution (recurring events, next 7 days)")
    print("=" * 80)

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_counts = Counter()

    for e in events:
        sd = e.get("start_date")
        if sd:
            try:
                dt = datetime.strptime(sd, "%Y-%m-%d")
                day_counts[dt.weekday()] += 1
            except ValueError:
                pass

    total = sum(day_counts.values()) or 1
    avg = total / 7

    rows = []
    for i in range(7):
        cnt = day_counts.get(i, 0)
        delta = cnt - avg
        flag = ""
        if delta < -avg * 0.3:
            flag = "LOW"
        elif delta > avg * 0.3:
            flag = "HIGH"
        rows.append((day_names[i], cnt, f"{cnt/total*100:.1f}%", f"{delta:+.1f}", flag))

    print(f"\n  Average per day: {avg:.1f}")
    print_table(
        ["Day", "Count", "Pct", "vs Avg", "Flag"],
        rows
    )


def query_6_recurring_patterns(events):
    """Identify common recurring event patterns by normalized title."""
    print("\n" + "=" * 80)
    print("QUERY 6: Missing Recurring Activity Categories (next 7 days)")
    print("=" * 80)

    def normalize_title(title):
        if not title:
            return ""
        t = title.lower().strip()
        # Remove dates like "feb 18", "2/18", "02/18/2026", etc.
        t = re.sub(r'\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2}\b', '', t)
        t = re.sub(r'\b\d{1,2}/\d{1,2}(/\d{2,4})?\b', '', t)
        # Remove day names
        t = re.sub(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', '', t)
        # Remove year
        t = re.sub(r'\b20\d{2}\b', '', t)
        # Remove leading/trailing dashes, pipes, colons
        t = re.sub(r'[|:\-\u2013\u2014]+', ' ', t)
        # Collapse whitespace
        t = re.sub(r'\s+', ' ', t).strip()
        return t

    pattern_data = defaultdict(lambda: {
        "count": 0,
        "categories": Counter(),
        "genres": set(),
        "tags": set(),
        "sample_titles": [],
    })

    for e in events:
        title = e.get("title", "")
        norm = normalize_title(title)
        if not norm:
            continue

        d = pattern_data[norm]
        d["count"] += 1
        cat = e.get("category_id") or "unknown"
        d["categories"][cat] += 1
        for g in (e.get("genres") or []):
            d["genres"].add(g)
        for t in (e.get("tags") or []):
            d["tags"].add(t)
        if len(d["sample_titles"]) < 3:
            d["sample_titles"].append(title)

    # Filter to count >= 3
    popular = [(norm, d) for norm, d in pattern_data.items() if d["count"] >= 3]
    popular.sort(key=lambda x: -x[1]["count"])

    print(f"\n  Total unique normalized patterns: {len(pattern_data)}")
    print(f"  Patterns with count >= 3: {len(popular)}")
    print(f"\n  Top 50 most common recurring event patterns:")

    rows = []
    for norm, d in popular[:50]:
        top_cat = d["categories"].most_common(1)[0][0] if d["categories"] else "?"
        genres_str = ", ".join(sorted(d["genres"])[:5]) or "none"
        tags_str = ", ".join(sorted(d["tags"])[:5]) or "none"
        rows.append((
            norm[:55],
            d["count"],
            top_cat,
            genres_str[:30],
            tags_str[:30],
        ))

    print_table(
        ["Normalized Title", "Count", "Category", "Genres (sample)", "Tags (sample)"],
        rows,
        col_widths=[55, 6, 15, 30, 30]
    )


def query_7_venue_types(events, venues_map):
    """Venue types hosting recurring events."""
    print("\n" + "=" * 80)
    print("QUERY 7: Venue Types Hosting Recurring Events (next 7 days)")
    print("=" * 80)

    vtype_counts = Counter()
    no_type_count = 0

    for e in events:
        vid = e.get("place_id")
        venue = venues_map.get(vid) if vid else None
        if not venue:
            continue
        vtype = venue.get("place_type") or "unknown"
        if vtype == "unknown":
            no_type_count += 1
        vtype_counts[vtype] += 1

    total = len(events) or 1
    rows = sorted(vtype_counts.items(), key=lambda x: -x[1])
    print(f"\n  Venue type distribution:")
    print_table(
        ["Venue Type", "Event Count", "Pct"],
        [(vt, cnt, f"{cnt/total*100:.1f}%") for vt, cnt in rows]
    )

    if no_type_count:
        print(f"\n  Events at venues with unknown type: {no_type_count}")


def query_8_crawler_inventory(sources_list):
    """Crawler file inventory vs active sources."""
    print("\n" + "=" * 80)
    print("QUERY 8: Crawler Inventory")
    print("=" * 80)

    # List crawler files
    sources_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sources")
    crawler_files = set()
    if os.path.isdir(sources_dir):
        for f in os.listdir(sources_dir):
            if f.endswith(".py") and f != "__init__.py":
                slug = f.replace(".py", "").replace("_", "-")
                crawler_files.add(slug)

    print(f"\n  Total crawler .py files in sources/: {len(crawler_files)}")

    # Active sources from DB
    active_sources = [s for s in sources_list if s.get("is_active")]
    inactive_sources = [s for s in sources_list if not s.get("is_active")]

    print(f"  Active sources in DB: {len(active_sources)}")
    print(f"  Inactive sources in DB: {len(inactive_sources)}")

    active_slugs = {s.get("slug") for s in active_sources}
    all_slugs = {s.get("slug") for s in sources_list}

    # Files with no source record at all
    files_no_source = sorted(crawler_files - all_slugs)
    # Active sources with no crawler file
    sources_no_file = sorted(active_slugs - crawler_files)

    print(f"\n  Crawler files with NO source DB record: {len(files_no_source)}")
    if files_no_source:
        for s in files_no_source[:30]:
            print(f"    - {s}")
        if len(files_no_source) > 30:
            print(f"    ... and {len(files_no_source) - 30} more")

    print(f"\n  Active sources with NO crawler file: {len(sources_no_file)}")
    if sources_no_file:
        for s in sources_no_file[:30]:
            print(f"    - {s}")

    # Crawl frequency breakdown
    freq_counts = Counter()
    for s in active_sources:
        freq = s.get("crawl_frequency") or "not_set"
        freq_counts[freq] += 1

    print(f"\n  Crawl frequency distribution (active sources):")
    print_table(
        ["Frequency", "Count"],
        sorted(freq_counts.items(), key=lambda x: -x[1])
    )

    # Sources without crawl_frequency
    no_freq = [s for s in active_sources if not s.get("crawl_frequency")]
    print(f"\n  Active sources with NO crawl_frequency set: {len(no_freq)}")
    if no_freq:
        for s in sorted(no_freq, key=lambda x: x.get("slug", ""))[:20]:
            print(f"    - [{s.get('id')}] {s.get('slug', '?')}")
        if len(no_freq) > 20:
            print(f"    ... and {len(no_freq) - 20} more")


def main():
    print("=" * 80)
    print("LOSTCITY ATLANTA -- RECURRING EVENTS CONTENT COVERAGE AUDIT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    today = datetime.now().strftime("%Y-%m-%d")
    next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    print(f"\nDate range: {today} to {next_week}")
    print("Fetching data from Supabase...\n")

    client = get_client()

    EVENTS_COLS = "id,title,start_date,start_time,category_id,genres,tags,source_id,place_id,is_recurring,series_id"

    # ---- Fetch recurring events (series_id IS NOT NULL, next 7 days) ----
    print("  Fetching recurring events (series_id IS NOT NULL)...")
    def build_recurring_q():
        return (
            client.table("events")
            .select(EVENTS_COLS)
            .not_.is_("series_id", "null")
            .gte("start_date", today)
            .lte("start_date", next_week)
            .order("start_date")
        )
    recurring_events = fetch_all_paged(build_recurring_q)
    print(f"  -> {len(recurring_events)} recurring events (series_id IS NOT NULL)")

    # Also fetch is_recurring=true events for Query 6
    print("  Fetching events where is_recurring=true...")
    def build_is_recurring_q():
        return (
            client.table("events")
            .select(EVENTS_COLS)
            .eq("is_recurring", True)
            .gte("start_date", today)
            .lte("start_date", next_week)
            .order("start_date")
        )
    is_recurring_events = fetch_all_paged(build_is_recurring_q)
    print(f"  -> {len(is_recurring_events)} events with is_recurring=true")

    # Merge for query 6 (deduplicate by id)
    all_recurring_map = {e["id"]: e for e in recurring_events}
    for e in is_recurring_events:
        all_recurring_map[e["id"]] = e
    all_recurring = list(all_recurring_map.values())
    print(f"  -> {len(all_recurring)} unique recurring events (union)")

    # ---- Fetch venue data ----
    venue_ids = {e.get("place_id") for e in all_recurring if e.get("place_id")}
    print(f"\n  Fetching venue data for {len(venue_ids)} unique venues...")
    venues_map = {}
    venue_id_list = sorted(venue_ids)
    BATCH = 200
    for i in range(0, len(venue_id_list), BATCH):
        batch = venue_id_list[i:i + BATCH]
        result = client.table("places").select(
            "id,name,slug,neighborhood,venue_type,city,state"
        ).in_("id", batch).execute()
        for v in (result.data or []):
            venues_map[v["id"]] = v
    print(f"  -> Loaded {len(venues_map)} venues")

    # ---- Fetch sources ----
    print("  Fetching all sources...")
    def build_sources_q():
        return client.table("sources").select("id,name,slug,is_active,crawl_frequency")
    sources_list = fetch_all_paged(build_sources_q)
    sources_map = {s["id"]: s for s in sources_list}
    print(f"  -> {len(sources_list)} total sources")

    # ---- Run all queries ----
    query_1_activity_type_distribution(recurring_events)
    query_2_nightlife_genre_coverage(recurring_events)
    query_3_source_coverage(recurring_events, sources_map)
    query_4_neighborhood_coverage(recurring_events, venues_map)
    query_5_day_of_week(recurring_events)
    query_6_recurring_patterns(all_recurring)
    query_7_venue_types(recurring_events, venues_map)
    query_8_crawler_inventory(sources_list)

    # ---- Summary ----
    print("\n" + "=" * 80)
    print("COVERAGE GAP SUMMARY")
    print("=" * 80)

    # Category gaps
    cat_counts = Counter(e.get("category_id", "unknown") for e in recurring_events)
    low_cats = [(c, n) for c, n in cat_counts.items() if n < 10]
    if low_cats:
        print("\n  Categories with < 10 recurring events this week:")
        for c, n in sorted(low_cats, key=lambda x: x[1]):
            print(f"    - {c}: {n}")

    # Neighborhoods with < 5 events
    hood_counts = Counter()
    for e in recurring_events:
        vid = e.get("place_id")
        venue = venues_map.get(vid) if vid else None
        if venue:
            hood = venue.get("neighborhood") or "Unknown"
            hood_counts[hood] += 1
    low_hoods = [(h, n) for h, n in hood_counts.items() if n < 5 and h != "Unknown"]
    if low_hoods:
        print(f"\n  Neighborhoods with < 5 recurring events:")
        for h, n in sorted(low_hoods, key=lambda x: x[1]):
            print(f"    - {h}: {n}")

    print("\n  Done.\n")


if __name__ == "__main__":
    main()
