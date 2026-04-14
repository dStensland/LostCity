"""
Music & Nightlife Data Audit — Atlanta portal
Run from: crawlers/
Usage: python3 scripts/music_nightlife_audit.py
"""

import sys
import os
import warnings
warnings.filterwarnings("ignore")

from datetime import datetime, timedelta, timezone
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_client

client = get_client()
today = datetime.now(timezone.utc).date()
end_date = today + timedelta(days=30)
today_str = str(today)
end_str = str(end_date)

print(f"\n{'='*70}")
print(f"MUSIC & NIGHTLIFE DATA AUDIT")
print(f"Window: {today_str} to {end_str}")
print(f"{'='*70}\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1. VOLUME: Event count and venue count by category
# ─────────────────────────────────────────────────────────────────────────────
print("## 1. VOLUME — Events in next 30 days\n")

# Fetch all music + nightlife events in window
all_mn_res = client.table("events").select(
    "id, place_id, image_url, start_time, description, price_min, is_free, source_id, category_id"
).in_("category_id", ["music", "nightlife"]).gte("start_date", today_str).lte("start_date", end_str).execute()

mn_events = all_mn_res.data if all_mn_res.data else []

by_cat = defaultdict(list)
for e in mn_events:
    by_cat[e.get("category_id", "unknown")].append(e)

for cat in ['music', 'nightlife']:
    events = by_cat[cat]
    place_ids = set(e["place_id"] for e in events if e.get("place_id"))
    print(f"  {cat.upper()}: {len(events)} events across {len(place_ids)} distinct venues")
print(f"  COMBINED: {len(mn_events)} events\n")

# ─────────────────────────────────────────────────────────────────────────────
# 2. TOP 20 VENUES by event count
# ─────────────────────────────────────────────────────────────────────────────
print("## 2. TOP 20 VENUES (music + nightlife, next 30 days)\n")

all_place_ids = set(e["place_id"] for e in mn_events if e.get("place_id"))
venue_stats = defaultdict(lambda: {"count": 0, "has_image": 0, "has_price": 0})
for e in mn_events:
    pid = e.get("place_id")
    if not pid:
        continue
    venue_stats[pid]["count"] += 1
    if e.get("image_url"):
        venue_stats[pid]["has_image"] += 1
    if e.get("price_min") is not None:
        venue_stats[pid]["has_price"] += 1

# Pull venue details
place_details = {}
place_id_list = list(all_place_ids)
CHUNK = 100
for i in range(0, len(place_id_list), CHUNK):
    chunk = place_id_list[i:i+CHUNK]
    vres = client.table("places").select("id, name, slug, place_type").in_("id", chunk).execute()
    if vres.data:
        for v in vres.data:
            place_details[v["id"]] = v

sorted_venues = sorted(venue_stats.items(), key=lambda x: -x[1]["count"])[:20]

print(f"  {'Venue':<35} {'Type':<16} {'Events':>7} {'img%':>6} {'price%':>7}")
print(f"  {'-'*35} {'-'*16} {'-'*7} {'-'*6} {'-'*7}")
for pid, stats in sorted_venues:
    pd = place_details.get(pid, {})
    name = pd.get("name", f"[id:{pid}]")[:34]
    ptype = (pd.get("place_type") or "?")[:15]
    count = stats["count"]
    img_pct = round(100 * stats["has_image"] / count) if count else 0
    price_pct = round(100 * stats["has_price"] / count) if count else 0
    print(f"  {name:<35} {ptype:<16} {count:>7} {img_pct:>5}% {price_pct:>6}%")

print()

# ─────────────────────────────────────────────────────────────────────────────
# 3. KNOWN MAJOR VENUE COVERAGE CHECK
# ─────────────────────────────────────────────────────────────────────────────
print("## 3. KNOWN MAJOR VENUE COVERAGE CHECK\n")

known_venues = [
    "Terminal West",
    "Variety Playhouse",
    "The Tabernacle",
    "Center Stage",
    "The Masquerade",
    "The Earl",
    "Eddie's Attic",
    "Aisle 5",
    "City Winery Atlanta",
    "Vinyl",
    "529",
    "The Loft",
    "Buckhead Theatre",
    "Atlanta Symphony Hall",
    "The Eastern",
    "Coca-Cola Roxy",
    "Cellairis Amphitheatre",
    "State Farm Arena",
    "Mercedes-Benz Stadium",
    "Red Light Cafe",
    "Smith's Olde Bar",
    "Northside Tavern",
    "Blind Willie's",
    "Apache Cafe",
    "MJQ Concourse",
]

# Fetch all places (we need them for fuzzy matching)
all_places_res = client.table("places").select("id, name, slug, place_type").execute()
all_places = all_places_res.data if all_places_res.data else []
places_by_slug = {p["slug"]: p for p in all_places}
places_by_id = {p["id"]: p for p in all_places}

# Fetch all sources
all_sources_res = client.table("sources").select("id, name, slug, is_active, url").execute()
all_sources = all_sources_res.data if all_sources_res.data else []
sources_by_slug = {s["slug"]: s for s in all_sources}

# Place-to-event-count map (music + nightlife)
place_event_counts = defaultdict(int)
for e in mn_events:
    pid = e.get("place_id")
    if pid:
        place_event_counts[pid] += 1

def find_place_by_name(name):
    """Fuzzy name match — look for significant keyword overlap."""
    name_lower = name.lower()
    # Strip 'the ' prefix for comparison
    name_clean = name_lower.replace("the ", "").replace("'s", "s").replace("'", "")
    keywords = [w for w in name_clean.split() if len(w) > 2]
    best = None
    best_score = 0
    for p in all_places:
        p_name = (p.get("name") or "").lower().replace("'s", "s").replace("'", "")
        p_slug = (p.get("slug") or "").lower()
        score = sum(1 for kw in keywords if kw in p_name or kw in p_slug)
        if score > best_score:
            best_score = score
            best = p
    if best_score >= max(1, len(keywords) - 1):
        return best
    return None

def find_active_source_for_place(place):
    """Check if there's an active source whose slug matches the venue."""
    if not place:
        return None, False
    place_slug = (place.get("slug") or "").lower()
    place_name = (place.get("name") or "").lower().replace("'s", "s").replace("'", "").replace(" ", "_")
    # Match source slug to place slug (hyphens/underscores)
    for src in all_sources:
        src_slug = (src.get("slug") or "").lower().replace("-", "_")
        if src_slug == place_slug.replace("-", "_") or src_slug == place_name:
            return src, src.get("is_active", False)
    return None, False

print(f"  {'Venue':<28} {'In DB?':>7} {'Active Src?':>11} {'Events 30d':>10}  Status")
print(f"  {'-'*28} {'-'*7} {'-'*11} {'-'*10}  {'-'*25}")

missing_venues = []
no_source_venues = []
zero_event_venues = []

for vname in known_venues:
    place = find_place_by_name(vname)
    in_db = place is not None
    src, active_src = find_active_source_for_place(place)
    event_count = place_event_counts.get(place["id"], 0) if place else 0

    if not in_db:
        status = "MISSING FROM DB"
        missing_venues.append(vname)
    elif not active_src:
        status = "no active crawler"
        no_source_venues.append(vname)
    elif event_count == 0:
        status = "crawler active, 0 events"
        zero_event_venues.append(vname)
    else:
        status = "OK"

    print(f"  {vname:<28} {'YES' if in_db else 'NO':>7} {'YES' if active_src else 'NO':>11} {event_count:>10}  {status}")

print()
if missing_venues:
    print(f"  CRITICAL - Not in DB at all ({len(missing_venues)}): {', '.join(missing_venues)}")
if no_source_venues:
    print(f"  WARNING  - No active crawler ({len(no_source_venues)}): {', '.join(no_source_venues)}")
if zero_event_venues:
    print(f"  WARNING  - Active crawler, 0 events ({len(zero_event_venues)}): {', '.join(zero_event_venues)}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# 4. ACTIVE SOURCES WITH 0 MUSIC/NIGHTLIFE EVENTS (next 30 days)
# ─────────────────────────────────────────────────────────────────────────────
print("## 4. ACTIVE MUSIC-RELATED SOURCES WITH 0 EVENTS (next 30 days)\n")

music_keywords = [
    "music", "concert", "band", "jazz", "blues", "rock", "hip", "rap",
    "dj", "nightlife", "tavern", "theatre", "theater",
    "amphitheatre", "amphitheater", "arena", "stage", "club",
    "lounge", "roxy", "tabernacle", "masquerade", "earl", "aisle",
    "attic", "eastern", "terminal", "variety", "loft", "vinyl",
    "ticketmaster", "eventbrite", "songkick", "bandsintown",
    "venue", "hall",
]

# Get event counts per source for music/nightlife
source_mn_counts = defaultdict(int)
for e in mn_events:
    sid = e.get("source_id")
    if sid:
        source_mn_counts[sid] += 1

# Also get total events per source in the window
all_window_res = client.table("events").select(
    "source_id, category_id"
).gte("start_date", today_str).lte("start_date", end_str).execute()

source_total_counts = defaultdict(int)
source_music_counts = defaultdict(int)
if all_window_res.data:
    for e in all_window_res.data:
        sid = e.get("source_id")
        if sid:
            source_total_counts[sid] += 1
            if e.get("category_id") in ("music", "nightlife"):
                source_music_counts[sid] += 1

active_sources = [s for s in all_sources if s.get("is_active")]

zero_music_active = []
for src in active_sources:
    slug = (src.get("slug") or "").lower()
    name = (src.get("name") or "").lower()
    is_music_related = any(kw in slug or kw in name for kw in music_keywords)
    if is_music_related and source_mn_counts[src["id"]] == 0:
        zero_music_active.append(src)

if zero_music_active:
    print(f"  {'Source Name':<38} {'Slug':<32} {'Total 30d':>9}")
    print(f"  {'-'*38} {'-'*32} {'-'*9}")
    for src in sorted(zero_music_active, key=lambda x: x.get("name", "")):
        total = source_total_counts[src["id"]]
        print(f"  {(src.get('name') or '?')[:37]:<38} {(src.get('slug') or '?')[:31]:<32} {total:>9}")
else:
    print("  All active music-related sources have music/nightlife events. Good.")
print()

# ─────────────────────────────────────────────────────────────────────────────
# 5. DATA QUALITY
# ─────────────────────────────────────────────────────────────────────────────
print("## 5. DATA QUALITY — Music & Nightlife (next 30 days)\n")

total = len(mn_events)
if total == 0:
    print("  No events found in window.\n")
else:
    no_image = sum(1 for e in mn_events if not e.get("image_url"))
    no_time = sum(1 for e in mn_events if not e.get("start_time"))
    no_desc = sum(1 for e in mn_events if not e.get("description"))
    has_price = sum(1 for e in mn_events if e.get("price_min") is not None)
    is_free_count = sum(1 for e in mn_events if e.get("is_free"))

    print(f"  Total events audited: {total}")
    print()
    print(f"  {'Metric':<30} {'Count':>8} {'Pct':>8}")
    print(f"  {'-'*30} {'-'*8} {'-'*8}")
    print(f"  {'Missing image_url':<30} {no_image:>8} {round(100*no_image/total):>7}%")
    print(f"  {'Missing start_time':<30} {no_time:>8} {round(100*no_time/total):>7}%")
    print(f"  {'Missing description':<30} {no_desc:>8} {round(100*no_desc/total):>7}%")
    print(f"  {'Has price_min':<30} {has_price:>8} {round(100*has_price/total):>7}%")
    print(f"  {'Marked is_free=true':<30} {is_free_count:>8} {round(100*is_free_count/total):>7}%")
    print()

    # Per-category breakdown
    for cat in ['music', 'nightlife']:
        cat_ev = by_cat[cat]
        n = len(cat_ev)
        if n == 0:
            continue
        no_img_c = sum(1 for e in cat_ev if not e.get("image_url"))
        no_time_c = sum(1 for e in cat_ev if not e.get("start_time"))
        no_desc_c = sum(1 for e in cat_ev if not e.get("description"))
        has_price_c = sum(1 for e in cat_ev if e.get("price_min") is not None)
        free_c = sum(1 for e in cat_ev if e.get("is_free"))
        print(f"  {cat.upper()} ({n} events): no_img={no_img_c}({round(100*no_img_c/n)}%)  no_time={no_time_c}({round(100*no_time_c/n)}%)  no_desc={no_desc_c}({round(100*no_desc_c/n)}%)  has_price={has_price_c}({round(100*has_price_c/n)}%)  is_free={free_c}({round(100*free_c/n)}%)")

    print()
    # Per-source quality (sources with 5+ music/nightlife events)
    src_id_to_name = {s["id"]: s.get("name", str(s["id"])) for s in all_sources}
    source_quality = defaultdict(lambda: {"count": 0, "no_img": 0, "no_time": 0, "no_desc": 0, "has_price": 0})
    for e in mn_events:
        sid = e.get("source_id")
        source_quality[sid]["count"] += 1
        if not e.get("image_url"):
            source_quality[sid]["no_img"] += 1
        if not e.get("start_time"):
            source_quality[sid]["no_time"] += 1
        if not e.get("description"):
            source_quality[sid]["no_desc"] += 1
        if e.get("price_min") is not None:
            source_quality[sid]["has_price"] += 1

    sq_sorted = sorted(
        [(sid, stats) for sid, stats in source_quality.items() if stats["count"] >= 5],
        key=lambda x: -x[1]["no_img"] / max(x[1]["count"], 1)
    )

    print(f"  Per-source quality (5+ events, sorted by missing image rate):")
    print(f"  {'Source':<38} {'N':>5} {'no_img':>8} {'no_time':>8} {'no_desc':>8} {'has_price':>10}")
    print(f"  {'-'*38} {'-'*5} {'-'*8} {'-'*8} {'-'*8} {'-'*10}")
    for sid, stats in sq_sorted:
        sname = src_id_to_name.get(sid, f"src:{sid}")[:37]
        n = stats["count"]
        print(f"  {sname:<38} {n:>5} {round(100*stats['no_img']/n):>7}% {round(100*stats['no_time']/n):>7}% {round(100*stats['no_desc']/n):>7}% {round(100*stats['has_price']/n):>9}%")

print()
print("=" * 70)
print("END OF AUDIT")
print("=" * 70)
