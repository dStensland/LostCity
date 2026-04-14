"""
Arts, Community, and Family event data audit for LostCity Atlanta portal.
Queries production DB for comprehensive coverage analysis.
Schema uses: events.place_id, events.category_id (text FK), places table.
"""
import sys
import os
from datetime import datetime, timedelta, date

sys.path.insert(0, '/Users/coach/Projects/LostCity/crawlers')
os.chdir('/Users/coach/Projects/LostCity/crawlers')

from db.client import get_client

client = get_client()
today = date.today()
cutoff = today + timedelta(days=30)
today_str = today.isoformat()
cutoff_str = cutoff.isoformat()

print(f"\n{'='*70}")
print(f"ARTS / COMMUNITY / FAMILY DATA AUDIT")
print(f"Date range: {today_str} to {cutoff_str}")
print(f"{'='*70}\n")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Volume by category
# ─────────────────────────────────────────────────────────────────────────────
print("## 1. VOLUME BY CATEGORY (next 30 days)\n")

target_categories = ['art', 'community', 'family', 'fitness', 'food_drink', 'sports']

for cat in target_categories:
    events_resp = (
        client.table("events")
        .select("id, place_id")
        .eq("category_id", cat)
        .gte("start_date", today_str)
        .lte("start_date", cutoff_str)
        .eq("is_active", True)
        .execute()
    )
    rows = events_resp.data or []
    event_count = len(rows)
    distinct_places = len(set(r["place_id"] for r in rows if r.get("place_id")))
    print(f"  {cat:<15} {event_count:>5} events   {distinct_places:>4} distinct venues")

print()


# ─────────────────────────────────────────────────────────────────────────────
# Prefetch master data for sections 2-6
# ─────────────────────────────────────────────────────────────────────────────
places_resp = client.table("places").select("id, name, slug").execute()
all_places = places_resp.data or []

sources_resp = client.table("sources").select(
    "id, name, slug, is_active, url, last_crawled_at, expected_event_count"
).execute()
all_sources = sources_resp.data or []

upcoming_events_resp = (
    client.table("events")
    .select("id, place_id, source_id, category_id")
    .gte("start_date", today_str)
    .lte("start_date", cutoff_str)
    .eq("is_active", True)
    .execute()
)
upcoming_events = upcoming_events_resp.data or []

events_by_place = {}
for ev in upcoming_events:
    pid = ev.get("place_id")
    if pid:
        events_by_place.setdefault(pid, []).append(ev)

events_by_source = {}
for ev in upcoming_events:
    sid = ev.get("source_id")
    if sid:
        events_by_source.setdefault(sid, []).append(ev)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Arts institutions coverage
# ─────────────────────────────────────────────────────────────────────────────
print("## 2. MAJOR ARTS INSTITUTION COVERAGE\n")

institutions = [
    "High Museum of Art",
    "MODA",
    "Atlanta Contemporary",
    "Hammonds House Museum",
    "Michael C. Carlos Museum",
    "National Center for Civil and Human Rights",
    "Atlanta History Center",
    "SCAD FASH",
    "Callanwolde Fine Arts Center",
    "Atlanta Botanical Garden",
    "Zoo Atlanta",
    "Georgia Aquarium",
    "Fernbank Museum",
    "Fernbank Science Center",
    "Children's Museum of Atlanta",
    "World of Coca-Cola",
]

def find_places(name):
    nl = name.lower()
    return [p for p in all_places if nl in p["name"].lower() or p["name"].lower() in nl]

def find_sources(name):
    nl = name.lower()
    return [s for s in all_sources
            if nl in s["name"].lower() or s["name"].lower() in nl
            or nl in s.get("url","").lower()]

print(f"  {'Institution':<42} {'Place?':<8} {'Src(active)':<13} {'Events(30d)'}")
print(f"  {'-'*42} {'-'*8} {'-'*13} {'-'*11}")

for inst in institutions:
    places = find_places(inst)
    sources = find_sources(inst)
    active_sources = [s for s in sources if s.get("is_active")]

    if places:
        place_ids = [p["id"] for p in places]
        event_count = sum(len(events_by_place.get(pid, [])) for pid in place_ids)
        place_status = "YES"
    else:
        event_count = 0
        place_status = "NO"

    src_status = (f"YES({len(active_sources)})" if active_sources
                  else ("INACTIVE" if sources else "NONE"))

    flag = ""
    if place_status == "NO":
        flag = " <-- NO PLACE RECORD"
    elif not active_sources:
        flag = " <-- NO ACTIVE SOURCE"
    elif event_count == 0:
        flag = " <-- 0 events"

    print(f"  {inst:<42} {place_status:<8} {src_status:<13} {event_count:>5}{flag}")

print()


# ─────────────────────────────────────────────────────────────────────────────
# 3. Community/civic coverage
# ─────────────────────────────────────────────────────────────────────────────
print("## 3. COMMUNITY / CIVIC COVERAGE\n")

civic_targets = [
    ("Atlanta BeltLine", ["beltline", "belt line"]),
    ("Piedmont Park Conservancy", ["piedmont park"]),
    ("Grant Park", ["grant park"]),
    ("Decatur (events)", ["decatur"]),
    ("Marietta Square", ["marietta"]),
    ("Neighborhood festivals / associations", ["neighborhood", "friends of", "conservancy"]),
    ("City of Atlanta Parks", ["atlanta parks", "city of atlanta"]),
    ("Intown Community Orgs", ["intown", "neighborhood association"]),
]

print(f"  {'Target':<38} {'Sources':<10} {'Active':<8} {'Events(30d)'}")
print(f"  {'-'*38} {'-'*10} {'-'*8} {'-'*11}")

for label, keywords in civic_targets:
    matched_sources = []
    matched_places = []
    for kw in keywords:
        matched_sources += [s for s in all_sources
                            if kw in s["name"].lower() or kw in s.get("url","").lower()]
        matched_places += [p for p in all_places if kw in p["name"].lower()]

    # Deduplicate
    seen_s = set()
    uniq_sources = []
    for s in matched_sources:
        if s["id"] not in seen_s:
            seen_s.add(s["id"])
            uniq_sources.append(s)

    seen_p = set()
    uniq_places = []
    for p in matched_places:
        if p["id"] not in seen_p:
            seen_p.add(p["id"])
            uniq_places.append(p)

    active_sources = [s for s in uniq_sources if s.get("is_active")]
    place_ids = [p["id"] for p in uniq_places]
    event_count = sum(len(events_by_place.get(pid, [])) for pid in place_ids)

    flag = " <-- GAP" if not active_sources and event_count == 0 else ""
    print(f"  {label:<38} {len(uniq_sources):<10} {len(active_sources):<8} {event_count:>5}{flag}")

print()


# ─────────────────────────────────────────────────────────────────────────────
# 4. Active sources producing 0 events in past 30 days
# ─────────────────────────────────────────────────────────────────────────────
print("## 4. ACTIVE SOURCES WITH 0 EVENTS IN PAST 30 DAYS\n")

past_30_start = (today - timedelta(days=30)).isoformat()

recent_events_resp = (
    client.table("events")
    .select("id, source_id")
    .gte("start_date", past_30_start)
    .eq("is_active", True)
    .execute()
)
recent_events = recent_events_resp.data or []
source_ids_with_recent = set(e["source_id"] for e in recent_events if e.get("source_id"))

active_sources_list = [s for s in all_sources if s.get("is_active")]
zero_event_sources = [s for s in active_sources_list if s["id"] not in source_ids_with_recent]

print(f"  Active sources total:                  {len(active_sources_list)}")
print(f"  Active sources with 0 events (30d):    {len(zero_event_sources)}\n")

if zero_event_sources:
    print(f"  {'Source Name':<50} {'Slug'}")
    print(f"  {'-'*50} {'-'*40}")
    for s in sorted(zero_event_sources, key=lambda x: x["name"].lower()):
        print(f"  {s['name']:<50} {s['slug']}")

print()


# ─────────────────────────────────────────────────────────────────────────────
# 5. Data quality per category (next 30 days)
# ─────────────────────────────────────────────────────────────────────────────
print("## 5. DATA QUALITY BY CATEGORY (next 30 days)\n")
print(f"  {'Category':<15} {'Total':>6} {'%NoImg':>8} {'%NoTime':>9} {'%NoDesc':>9} {'%WithPrice':>11}  Warnings")
print(f"  {'-'*15} {'-'*6} {'-'*8} {'-'*9} {'-'*9} {'-'*11}  {'-'*20}")

all_cats = target_categories + ['art', 'civic', 'volunteer', 'community', 'family', 'workshops', 'education']
# dedupe
seen = set()
all_cats_deduped = []
for c in all_cats:
    if c not in seen:
        seen.add(c)
        all_cats_deduped.append(c)

for cat in all_cats_deduped:
    cat_events_resp = (
        client.table("events")
        .select("id, image_url, start_time, description, price_min, price_max, is_free")
        .eq("category_id", cat)
        .gte("start_date", today_str)
        .lte("start_date", cutoff_str)
        .eq("is_active", True)
        .execute()
    )
    rows = cat_events_resp.data or []
    total = len(rows)
    if total == 0:
        print(f"  {cat:<15} {0:>6} {'—':>8} {'—':>9} {'—':>9} {'—':>11}  (no events)")
        continue

    no_image = sum(1 for r in rows if not r.get("image_url"))
    no_time  = sum(1 for r in rows if not r.get("start_time"))
    no_desc  = sum(1 for r in rows if not r.get("description"))
    with_price = sum(1 for r in rows
                     if r.get("is_free") or r.get("price_min") is not None or r.get("price_max") is not None)

    pct_no_img  = no_image / total * 100
    pct_no_time = no_time  / total * 100
    pct_no_desc = no_desc  / total * 100
    pct_price   = with_price / total * 100

    warns = []
    if pct_no_img > 50:    warns.append("HIGH-NOIMG")
    if pct_no_time > 40:   warns.append("HIGH-NOTIME")
    if pct_no_desc > 50:   warns.append("HIGH-NODESC")
    if pct_price < 25:     warns.append("LOW-PRICE")
    warn_str = " ".join(warns)

    print(f"  {cat:<15} {total:>6} {pct_no_img:>7.1f}% {pct_no_time:>8.1f}% {pct_no_desc:>8.1f}% {pct_price:>10.1f}%  {warn_str}")

print()


# ─────────────────────────────────────────────────────────────────────────────
# 6. Stale sources (last_crawled_at > 14 days ago or NULL)
# ─────────────────────────────────────────────────────────────────────────────
print("## 6. STALE ACTIVE SOURCES (last_crawled_at > 14 days ago or NULL)\n")

stale_cutoff_str = (today - timedelta(days=14)).isoformat()

stale = []
for s in active_sources_list:
    lc = s.get("last_crawled_at")
    if lc is None:
        stale.append((s, "never crawled"))
    else:
        lc_date = lc[:10]
        if lc_date < stale_cutoff_str:
            days_ago = (today - date.fromisoformat(lc_date)).days
            stale.append((s, f"{days_ago}d ago"))

never_crawled = [(s, w) for s, w in stale if w == "never crawled"]
old_crawled   = [(s, w) for s, w in stale if w != "never crawled"]

print(f"  Active sources total:              {len(active_sources_list)}")
print(f"  Never crawled (last_crawled=NULL): {len(never_crawled)}")
print(f"  Stale (>14 days since crawl):      {len(old_crawled)}")
print(f"  Total stale or never-run:          {len(stale)}\n")

if never_crawled:
    print("  --- Never crawled ---")
    print(f"  {'Source Name':<50} {'Slug'}")
    print(f"  {'-'*50} {'-'*40}")
    for s, _ in sorted(never_crawled, key=lambda x: x[0]["name"].lower()):
        print(f"  {s['name']:<50} {s['slug']}")
    print()

if old_crawled:
    print("  --- Stale (>14d) ---")
    print(f"  {'Source Name':<50} {'Last Crawled':<15} {'Slug'}")
    print(f"  {'-'*50} {'-'*15} {'-'*40}")
    for s, when in sorted(old_crawled, key=lambda x: x[0]["name"].lower()):
        print(f"  {s['name']:<50} {when:<15} {s['slug']}")

print()
print("=" * 70)
print("AUDIT COMPLETE")
print("=" * 70)
