"""
Comprehensive crawler health audit — before/after fix verification.
Checks:
1. Flagship venue source coverage (is_active + events in next 30 days)
2. Nashville contamination check
3. Theater tab health
4. Music tab health
5. Category distribution (AA/support_group dominance)
6. Overall source health
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.client import get_client
from datetime import date, timedelta

client = get_client()
today = date.today().isoformat()
in_30 = (date.today() + timedelta(days=30)).isoformat()

print("=" * 70)
print(f"CRAWLER HEALTH AUDIT — {today} to {in_30}")
print("=" * 70)

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1: FLAGSHIP VENUE COVERAGE
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 1. FLAGSHIP VENUE COVERAGE")
print("-" * 60)

flagship_slugs = {
    "Theater": [
        "alliance-theatre", "dads-garage", "7-stages", "theatrical-outfit",
        "horizon-theatre", "center-for-puppetry-arts"
    ],
    "Music": [
        "terminal-west", "variety-playhouse", "eddies-attic", "tabernacle",
        "the-masquerade", "the-earl", "city-winery-atlanta"
    ],
    "Film": [
        "plaza-theatre", "tara-theatre", "starlight-drive-in", "landmark-midtown"
    ],
    "Arts": [
        "high-museum", "high-museum-of-art", "atlanta-contemporary",
        "atlanta-botanical-garden"
    ],
    "Family": [
        "georgia-aquarium", "fernbank", "childrens-museum",
        "fernbank-museum", "childrens-museum-of-atlanta"
    ],
    "Sports": [
        "truist-park", "state-farm-arena"
    ],
}

# Pull all sources in one shot, then look up by slug
all_sources_resp = client.table("sources").select("id,name,slug,is_active").execute()
sources_by_slug = {}
for s in (all_sources_resp.data or []):
    if s.get("slug"):
        sources_by_slug[s["slug"]] = s

# Pull upcoming event counts per source
upcoming_resp = (
    client.table("events")
    .select("source_id")
    .gte("start_date", today)
    .lte("start_date", in_30)
    .execute()
)
events_by_source = {}
for e in (upcoming_resp.data or []):
    sid = e["source_id"]
    events_by_source[sid] = events_by_source.get(sid, 0) + 1

for category, slugs in flagship_slugs.items():
    print(f"\n  [{category}]")
    seen_venues = set()
    for slug in slugs:
        src = sources_by_slug.get(slug)
        if src:
            if src["name"] in seen_venues:
                continue
            seen_venues.add(src["name"])
            active = "ACTIVE" if src["is_active"] else "INACTIVE"
            event_count = events_by_source.get(src["id"], 0)
            status = "OK" if event_count > 0 else "ZERO EVENTS"
            print(f"    {slug:<35} is_active={active:<8} events_30d={event_count:>3}  [{status}]")
        else:
            print(f"    {slug:<35} NOT FOUND IN SOURCES TABLE")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2: NASHVILLE CONTAMINATION CHECK
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 2. NASHVILLE CONTAMINATION CHECK")
print("-" * 60)

# Check ticketmaster-nashville source status
tn_src = sources_by_slug.get("ticketmaster-nashville")
if tn_src:
    active = "ACTIVE" if tn_src["is_active"] else "INACTIVE"
    tn_events = events_by_source.get(tn_src["id"], 0)
    print(f"\n  ticketmaster-nashville: is_active={active}, events_30d={tn_events}")
    if not tn_src["is_active"]:
        print("  STATUS: GOOD — source is inactive")
    else:
        print("  STATUS: PROBLEM — source is still active!")
else:
    print("\n  ticketmaster-nashville: NOT FOUND IN SOURCES TABLE")

# Check for Nashville city venues with upcoming events
# Try places table (may be called venues)
try:
    nash_venues_resp = (
        client.table("places")
        .select("id,name,city")
        .ilike("city", "%Nashville%")
        .execute()
    )
    nash_venue_ids = [v["id"] for v in (nash_venues_resp.data or [])]
    print(f"\n  Nashville venues in places table: {len(nash_venue_ids)}")
    if nash_venue_ids:
        # Check events for these venues
        # Break into chunks to avoid URL length limits
        chunk_size = 50
        total_nash_events = 0
        for i in range(0, len(nash_venue_ids), chunk_size):
            chunk = nash_venue_ids[i:i+chunk_size]
            resp = (
                client.table("events")
                .select("id,title,start_date,place_id")
                .in_("place_id", chunk)
                .gte("start_date", today)
                .lte("start_date", in_30)
                .execute()
            )
            total_nash_events += len(resp.data or [])
        print(f"  Nashville venue events in next 30 days: {total_nash_events}")
        if total_nash_events == 0:
            print("  STATUS: GOOD — no Nashville contamination")
        else:
            print(f"  STATUS: PROBLEM — {total_nash_events} Nashville events still present!")
            # Show sample
            sample_resp = (
                client.table("events")
                .select("id,title,start_date,place_id")
                .in_("place_id", nash_venue_ids[:50])
                .gte("start_date", today)
                .lte("start_date", in_30)
                .limit(5)
                .execute()
            )
            for e in (sample_resp.data or []):
                print(f"    - {e['title']} ({e['start_date']})")
except Exception as ex:
    print(f"  Could not query places table: {ex}")
    # Try venues table
    try:
        nash_venues_resp = (
            client.table("venues")
            .select("id,name,city")
            .ilike("city", "%Nashville%")
            .execute()
        )
        nash_venue_ids = [v["id"] for v in (nash_venues_resp.data or [])]
        print(f"  Nashville venues in venues table: {len(nash_venue_ids)}")
        if nash_venue_ids:
            chunk_size = 50
            total_nash_events = 0
            for i in range(0, len(nash_venue_ids), chunk_size):
                chunk = nash_venue_ids[i:i+chunk_size]
                resp = (
                    client.table("events")
                    .select("id,title,start_date,venue_id")
                    .in_("venue_id", chunk)
                    .gte("start_date", today)
                    .lte("start_date", in_30)
                    .execute()
                )
                total_nash_events += len(resp.data or [])
            print(f"  Nashville venue events in next 30 days: {total_nash_events}")
            if total_nash_events == 0:
                print("  STATUS: GOOD — no Nashville contamination")
            else:
                print(f"  STATUS: PROBLEM — {total_nash_events} Nashville events still present!")
    except Exception as ex2:
        print(f"  Could not query venues table either: {ex2}")

# Also check by state=TN more broadly
try:
    tn_venues_resp = (
        client.table("places")
        .select("id,name,city,state")
        .eq("state", "TN")
        .execute()
    )
    tn_venue_ids = [v["id"] for v in (tn_venues_resp.data or [])]
    print(f"\n  All TN state venues in places table: {len(tn_venue_ids)}")
    if tn_venue_ids:
        total_tn_events = 0
        for i in range(0, len(tn_venue_ids), 50):
            chunk = tn_venue_ids[i:i+50]
            resp = (
                client.table("events")
                .select("id")
                .in_("place_id", chunk)
                .gte("start_date", today)
                .lte("start_date", in_30)
                .execute()
            )
            total_tn_events += len(resp.data or [])
        print(f"  TN venue events in next 30 days: {total_tn_events}")
        if total_tn_events == 0:
            print("  STATUS: GOOD — no TN contamination")
        else:
            print(f"  STATUS: PROBLEM — {total_tn_events} TN events still present!")
except Exception as ex:
    print(f"  TN venues check skipped: {ex}")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3: THEATER TAB HEALTH
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 3. THEATER TAB HEALTH")
print("-" * 60)

# Theater-related categories — adjust based on actual category IDs in the DB
theater_cats = ["theater", "theatre", "dance", "comedy", "performing_arts"]

# Fetch all upcoming events with category info
# We'll query events and check categories
all_upcoming_resp = (
    client.table("events")
    .select("id,title,category_id,start_date,place_id,source_id")
    .gte("start_date", today)
    .lte("start_date", in_30)
    .execute()
)
all_upcoming = all_upcoming_resp.data or []
print(f"\n  Total upcoming events (30d): {len(all_upcoming)}")

# Filter theater/dance/comedy — these might be stored as category strings or IDs
# Let's check the actual category values first
cat_counts = {}
for e in all_upcoming:
    cat = e.get("category_id") or "none"
    cat_counts[cat] = cat_counts.get(cat, 0) + 1

# Find theater-ish categories
theater_event_count = 0
for cat, cnt in cat_counts.items():
    if cat and any(t in str(cat).lower() for t in ["theater", "theatre", "dance", "comedy", "perform"]):
        theater_event_count += cnt
        print(f"  Category '{cat}': {cnt} events")

print(f"\n  Theater/Dance/Comedy total (30d): {theater_event_count}")

# Check 7 Stages specifically
seven_stages_src = sources_by_slug.get("7-stages")
if seven_stages_src:
    seven_stages_events = (
        client.table("events")
        .select("id,title,start_date")
        .eq("source_id", seven_stages_src["id"])
        .gte("start_date", today)
        .lte("start_date", in_30)
        .execute()
    )
    se_data = seven_stages_events.data or []
    print(f"\n  7 Stages events in next 30d: {len(se_data)}")
    if se_data:
        for e in se_data[:5]:
            print(f"    - {e['title']} ({e['start_date']})")
        # Check for garbage dates (far future, past, or 1970)
        garbage = [e for e in se_data if e['start_date'] < today or e['start_date'] > (date.today() + timedelta(days=365)).isoformat()]
        if garbage:
            print(f"  WARNING: {len(garbage)} events with suspicious dates!")
            for e in garbage[:3]:
                print(f"    GARBAGE DATE: {e['title']} ({e['start_date']})")
        else:
            print(f"  Date sanity: OK (all dates in reasonable range)")
    else:
        print("  STATUS: 7 Stages has ZERO events in next 30d")
else:
    print("\n  7 Stages: NOT IN SOURCES TABLE")

# Check true-colors-theatre
tc_src = sources_by_slug.get("true-colors-theatre")
if tc_src:
    active = "ACTIVE" if tc_src["is_active"] else "INACTIVE"
    tc_events = events_by_source.get(tc_src["id"], 0)
    print(f"\n  true-colors-theatre: is_active={active}, events_30d={tc_events}")
else:
    print("\n  true-colors-theatre: NOT IN SOURCES TABLE")

# Check for fitness_center place_type venues with theater/dance events
print("\n  Checking for fitness_center venues with theater/dance events...")
try:
    fc_venues_resp = (
        client.table("places")
        .select("id,name,venue_type")
        .eq("venue_type", "fitness_center")
        .execute()
    )
    fc_venue_ids = [v["id"] for v in (fc_venues_resp.data or [])]
    print(f"  fitness_center venues total: {len(fc_venue_ids)}")
    if fc_venue_ids:
        fc_theater_events = 0
        for i in range(0, len(fc_venue_ids), 50):
            chunk = fc_venue_ids[i:i+50]
            resp = (
                client.table("events")
                .select("id,title,category_id,place_id")
                .in_("place_id", chunk)
                .gte("start_date", today)
                .lte("start_date", in_30)
                .execute()
            )
            for e in (resp.data or []):
                cat = str(e.get("category_id") or "").lower()
                if any(t in cat for t in ["theater", "theatre", "dance", "comedy"]):
                    fc_theater_events += 1
        if fc_theater_events > 0:
            print(f"  STATUS: PROBLEM — {fc_theater_events} theater/dance events at fitness_center venues!")
        else:
            print(f"  STATUS: OK — no theater/dance events at fitness_center venues")
except Exception as ex:
    print(f"  fitness_center check: {ex}")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4: MUSIC TAB HEALTH
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 4. MUSIC TAB HEALTH")
print("-" * 60)

music_event_count = 0
for cat, cnt in cat_counts.items():
    if cat and any(t in str(cat).lower() for t in ["music", "concert", "live_music"]):
        music_event_count += cnt
        print(f"  Category '{cat}': {cnt} events")
print(f"\n  Music total (30d): {music_event_count}")

# Check music venue place_types for key venues
key_music_venues = ["terminal-west", "variety-playhouse", "eddies-attic", "tabernacle"]
print("\n  Key music venue place_type check:")

for slug in key_music_venues:
    src = sources_by_slug.get(slug)
    if src:
        # Find the place associated with this source
        # Events from this source link to a place_id
        sample_event_resp = (
            client.table("events")
            .select("place_id")
            .eq("source_id", src["id"])
            .limit(1)
            .execute()
        )
        sample_events = sample_event_resp.data or []
        if sample_events and sample_events[0].get("place_id"):
            place_id = sample_events[0]["place_id"]
            try:
                place_resp = (
                    client.table("places")
                    .select("id,name,venue_type,slug")
                    .eq("id", place_id)
                    .limit(1)
                    .execute()
                )
                places = place_resp.data or []
                if places:
                    p = places[0]
                    vtype = p.get("venue_type", "NULL")
                    is_music = vtype == "music_venue"
                    flag = "OK" if is_music else f"WRONG TYPE: {vtype}"
                    print(f"    {slug:<25} place_type={vtype:<20} [{flag}]")
                else:
                    print(f"    {slug:<25} place not found in places table")
            except Exception as ex:
                print(f"    {slug:<25} error looking up place: {ex}")
        else:
            print(f"    {slug:<25} no events found to look up place")
    else:
        print(f"    {slug:<25} NOT IN SOURCES TABLE")

# Count music_venue typed places total
try:
    mv_resp = client.table("places").select("id", count="exact").eq("venue_type", "music_venue").execute()
    print(f"\n  Total places typed as music_venue: {mv_resp.count}")
except Exception as ex:
    print(f"\n  music_venue count: {ex}")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5: CATEGORY DISTRIBUTION
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 5. CATEGORY DISTRIBUTION (next 30 days)")
print("-" * 60)

sorted_cats = sorted(cat_counts.items(), key=lambda x: -x[1])
total_events = sum(cat_counts.values())
print(f"\n  Total events: {total_events}\n")
print(f"  {'Category':<35} {'Count':>6}  {'%':>5}")
print(f"  {'-'*35} {'-'*6}  {'-'*5}")
for cat, cnt in sorted_cats:
    pct = cnt / total_events * 100 if total_events else 0
    flag = " <<< DOMINANT" if pct > 20 else ""
    print(f"  {str(cat):<35} {cnt:>6}  {pct:>4.1f}%{flag}")

# Specifically call out AA/support groups
aa_cats = ["support_group", "aa", "recovery", "twelve_step"]
aa_total = sum(cnt for cat, cnt in cat_counts.items() if cat and any(a in str(cat).lower() for a in aa_cats))
print(f"\n  AA/Support group events (30d): {aa_total}")
if aa_total > total_events * 0.15:
    print(f"  STATUS: PROBLEM — AA/support groups = {aa_total/total_events*100:.1f}% of feed (>15%)")
else:
    print(f"  STATUS: OK — AA/support groups = {aa_total/total_events*100:.1f}% of feed")

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6: OVERALL SOURCE HEALTH
# ─────────────────────────────────────────────────────────────────────────────

print("\n\n## 6. OVERALL SOURCE HEALTH")
print("-" * 60)

all_sources = all_sources_resp.data or []
active_sources = [s for s in all_sources if s.get("is_active")]
inactive_sources = [s for s in all_sources if not s.get("is_active")]

print(f"\n  Total sources: {len(all_sources)}")
print(f"  Active sources: {len(active_sources)}")
print(f"  Inactive sources: {len(inactive_sources)}")

active_with_events = [s for s in active_sources if events_by_source.get(s["id"], 0) > 0]
active_zero_events = [s for s in active_sources if events_by_source.get(s["id"], 0) == 0]

print(f"\n  Active sources with >0 events in next 30d: {len(active_with_events)}")
print(f"  Active sources with ZERO events in next 30d: {len(active_zero_events)}")

if active_zero_events:
    print(f"\n  Active sources producing zero upcoming events:")
    # Sort by name for readability
    for s in sorted(active_zero_events, key=lambda x: x.get("name", ""))[:40]:
        print(f"    - {s.get('slug', '?'):<40} ({s.get('name', '?')})")
    if len(active_zero_events) > 40:
        print(f"    ... and {len(active_zero_events) - 40} more")

# Top producing sources
print(f"\n  Top 15 active sources by event count (next 30d):")
top_sources = sorted(
    [(s, events_by_source.get(s["id"], 0)) for s in active_sources],
    key=lambda x: -x[1]
)[:15]
for src, cnt in top_sources:
    print(f"    {src.get('slug', '?'):<40} {cnt:>5} events")

print("\n\n" + "=" * 70)
print("AUDIT COMPLETE")
print("=" * 70)
