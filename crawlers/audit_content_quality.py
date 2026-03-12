#!/usr/bin/env python3
"""
Content Quality Audit — Semantic quality of event data.
Queries production DB across 7 dimensions, samples concrete examples,
ranks sources by quality problems.
"""

import os, sys, re, json
from collections import Counter, defaultdict
from datetime import date

# Ensure crawlers/ is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import get_client

TODAY = date.today().isoformat()

def run_query(table, select, filters=None, limit=None, order=None):
    """Run a supabase query with optional filters."""
    q = get_client().table(table).select(select)
    if filters:
        for f in filters:
            q = getattr(q, f[0])(*f[1:])
    if order:
        q = q.order(order[0], desc=order[1] if len(order) > 1 else False)
    if limit:
        q = q.limit(limit)
    return q.execute().data


def section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def subsection(title):
    print(f"\n--- {title} ---")


# ─────────────────────────────────────────────────────────────
# Fetch all active future events once
# ─────────────────────────────────────────────────────────────
ATL_PORTAL = "74c2f211-ee11-453d-8386-ac2861705695"

def fetch_events():
    """Fetch active future events visible in Atlanta portal (paginated)."""
    print("Fetching Atlanta-portal active future events...")
    SELECT = (
        "id, title, description, category_id, tags, source_url, image_url, "
        "price_min, price_max, is_free, start_date, start_time, source_id, "
        "sources!inner(name, slug)"
    )
    all_data = []
    # Fetch portal_id = atlanta
    page_size = 1000
    for offset in range(0, 20000, page_size):
        batch = get_client().table("events").select(SELECT).eq(
            "is_active", True
        ).gte("start_date", TODAY).eq(
            "portal_id", ATL_PORTAL
        ).range(offset, offset + page_size - 1).execute().data
        all_data.extend(batch)
        if len(batch) < page_size:
            break
    # Fetch portal_id IS NULL
    for offset in range(0, 5000, page_size):
        batch = get_client().table("events").select(SELECT).eq(
            "is_active", True
        ).gte("start_date", TODAY).is_(
            "portal_id", "null"
        ).range(offset, offset + page_size - 1).execute().data
        all_data.extend(batch)
        if len(batch) < page_size:
            break
    print(f"  Total Atlanta-visible events: {len(all_data)}")
    return all_data


# ─────────────────────────────────────────────────────────────
# 1. DESCRIPTION QUALITY
# ─────────────────────────────────────────────────────────────
from description_quality import AUDIT_GENERIC_PATTERNS as GENERIC_PATTERNS, AUDIT_GENERIC_RE as GENERIC_RE

ENCODING_RE = re.compile(r"&(?:amp|lt|gt|quot|#\d+|#x[\da-f]+);|</?[a-z][^>]*>", re.IGNORECASE)
TRUNCATION_RE = re.compile(r"\.\.\.\s*$|…\s*$")


def audit_descriptions(events):
    section("1. DESCRIPTION QUALITY")

    no_desc = [e for e in events if not e.get("description")]
    has_desc = [e for e in events if e.get("description")]
    print(f"\nMissing description: {len(no_desc)} / {len(events)} ({100*len(no_desc)/len(events):.1f}%)")

    # Length distribution
    subsection("Length distribution")
    buckets = {"<50": 0, "50-100": 0, "100-300": 0, "300+": 0}
    for e in has_desc:
        ln = len(e["description"])
        if ln < 50: buckets["<50"] += 1
        elif ln < 100: buckets["50-100"] += 1
        elif ln < 300: buckets["100-300"] += 1
        else: buckets["300+"] += 1
    for k, v in buckets.items():
        pct = 100 * v / len(has_desc) if has_desc else 0
        print(f"  {k:>10} chars: {v:>5} ({pct:.1f}%)")

    # Generic filler
    subsection("Generic filler descriptions")
    generic = []
    for e in has_desc:
        d = e["description"].strip()
        if GENERIC_RE.search(d):
            generic.append(e)
    print(f"  Count: {len(generic)}")
    by_source = Counter(e["sources"]["name"] for e in generic)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in generic[:5]:
        print(f"    EX: [{e['sources']['name']}] \"{e['description'][:100]}\"")

    # Title repeated as description
    subsection("Title repeated as description")
    title_as_desc = [e for e in has_desc if e["description"].strip().lower() == e["title"].strip().lower()]
    print(f"  Count: {len(title_as_desc)}")
    for e in title_as_desc[:5]:
        print(f"    EX: [{e['sources']['name']}] title=\"{e['title']}\"")

    # Duplicate descriptions
    subsection("Duplicate descriptions (same text across multiple events)")
    desc_counts = Counter(e["description"].strip() for e in has_desc)
    dupes = {d: c for d, c in desc_counts.items() if c >= 3}
    print(f"  Descriptions used 3+ times: {len(dupes)}")
    for d, c in sorted(dupes.items(), key=lambda x: -x[1])[:10]:
        src = next(e["sources"]["name"] for e in has_desc if e["description"].strip() == d)
        print(f"    {c}x [{src}]: \"{d[:80]}...\"" if len(d) > 80 else f"    {c}x [{src}]: \"{d}\"")

    # Encoding artifacts
    subsection("Encoding artifacts (HTML tags, entities)")
    encoding_issues = []
    for e in has_desc:
        if ENCODING_RE.search(e["description"]):
            encoding_issues.append(e)
    print(f"  Count: {len(encoding_issues)}")
    by_source = Counter(e["sources"]["name"] for e in encoding_issues)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in encoding_issues[:5]:
        match = ENCODING_RE.search(e["description"])
        ctx = e["description"][max(0,match.start()-20):match.end()+20]
        print(f"    EX: [{e['sources']['name']}] ...{ctx}...")

    # Truncation damage
    subsection("Truncation damage (ends with ... or mid-sentence)")
    truncated = [e for e in has_desc if TRUNCATION_RE.search(e["description"])]
    print(f"  Count: {len(truncated)}")
    by_source = Counter(e["sources"]["name"] for e in truncated)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in truncated[:5]:
        print(f"    EX: [{e['sources']['name']}] ...{e['description'][-60:]}")

    return {
        "missing": len(no_desc),
        "generic": len(generic),
        "title_as_desc": len(title_as_desc),
        "duplicate_3plus": len(dupes),
        "encoding_issues": len(encoding_issues),
        "truncated": len(truncated),
    }


# ─────────────────────────────────────────────────────────────
# 2. TITLE QUALITY
# ─────────────────────────────────────────────────────────────
def audit_titles(events):
    section("2. TITLE QUALITY")

    # ALL CAPS
    subsection("ALL CAPS titles")
    allcaps = [e for e in events if e["title"] == e["title"].upper() and len(e["title"]) > 5]
    print(f"  Count: {len(allcaps)}")
    by_source = Counter(e["sources"]["name"] for e in allcaps)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in allcaps[:5]:
        print(f"    EX: [{e['sources']['name']}] \"{e['title']}\"")

    # Metadata-stuffed titles (>100 chars)
    subsection("Metadata-stuffed titles (>100 chars)")
    long_titles = [e for e in events if len(e["title"]) > 100]
    print(f"  Count: {len(long_titles)}")
    by_source = Counter(e["sources"]["name"] for e in long_titles)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in long_titles[:5]:
        print(f"    EX: [{e['sources']['name']}] \"{e['title'][:120]}...\"")

    # Very short/generic titles
    subsection("Very short titles (<10 chars)")
    short = [e for e in events if len(e["title"].strip()) < 10]
    print(f"  Count: {len(short)}")
    for e in short[:10]:
        print(f"    EX: [{e['sources']['name']}] \"{e['title']}\"")

    # Duplicate title+date combos
    subsection("Duplicate title+date (potential dedup failures)")
    combos = Counter((e["title"].strip().lower(), e["start_date"]) for e in events)
    dupes = {k: v for k, v in combos.items() if v >= 2}
    print(f"  Duplicate title+date pairs: {len(dupes)}")
    for (title, dt), cnt in sorted(dupes.items(), key=lambda x: -x[1])[:10]:
        print(f"    {cnt}x: \"{title[:60]}\" on {dt}")

    return {
        "allcaps": len(allcaps),
        "long_titles": len(long_titles),
        "short_titles": len(short),
        "dedup_failures": len(dupes),
    }


# ─────────────────────────────────────────────────────────────
# 3. CATEGORY & TAG ACCURACY
# ─────────────────────────────────────────────────────────────
KEYWORD_CATEGORY_MAP = {
    "comedy": ["comedy"],
    "stand-up": ["comedy"],
    "comedian": ["comedy"],
    "improv": ["comedy"],
    "live music": ["music"],
    "concert": ["music"],
    "dj set": ["music", "nightlife"],
    "film": ["film"],
    "movie": ["film"],
    "screening": ["film"],
    "yoga": ["fitness", "wellness"],
    "run club": ["fitness"],
    "5k": ["fitness", "sports"],
    "trivia": ["nightlife", "community"],
    "karaoke": ["nightlife"],
    "drag": ["nightlife"],
    "theater": ["theater"],
    "theatre": ["theater"],
    "musical": ["theater", "music"],
    "art": ["art"],
    "gallery": ["art"],
    "exhibition": ["art"],
    "food": ["food_drink"],
    "tasting": ["food_drink"],
    "market": ["markets"],
    "farmers market": ["markets"],
}


def audit_categories(events):
    section("3. CATEGORY & TAG ACCURACY")

    # Category distribution
    subsection("Category distribution")
    cat_counts = Counter(e["category_id"] for e in events)
    for cat, cnt in cat_counts.most_common():
        pct = 100 * cnt / len(events)
        print(f"  {cat:>20}: {cnt:>5} ({pct:.1f}%)")

    # "other" and "community" breakdown
    subsection("'other' category — source breakdown")
    other_events = [e for e in events if e["category_id"] == "other"]
    by_source = Counter(e["sources"]["name"] for e in other_events)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in other_events[:5]:
        print(f"    EX: \"{e['title']}\" — {(e.get('description') or '')[:60]}")

    # Keyword vs category mismatches
    subsection("Keyword vs category mismatches")
    mismatches = []
    for e in events:
        title_lower = e["title"].lower()
        for keyword, valid_cats in KEYWORD_CATEGORY_MAP.items():
            if keyword in title_lower and e["category_id"] not in valid_cats:
                mismatches.append((e, keyword, valid_cats))
                break
    print(f"  Count: {len(mismatches)}")
    mismatch_by_cat = Counter(f"{m[1]} in title, cat={m[0]['category_id']}" for m in mismatches)
    for pattern, cnt in mismatch_by_cat.most_common(15):
        print(f"    {cnt:>4}x  {pattern}")
    for e, kw, valid in mismatches[:5]:
        print(f"    EX: [{e['sources']['name']}] \"{e['title'][:60]}\" cat={e['category_id']} (expected {valid})")

    # Music events without genre tags
    subsection("Music events without genre tags")
    music = [e for e in events if e["category_id"] == "music"]
    no_genre = [e for e in music if not e.get("tags") or not any(
        t not in ("live_music", "concert", "outdoor", "free", "family_friendly", "recurring", "all_ages")
        for t in (e.get("tags") or [])
    )]
    print(f"  Music events: {len(music)}, without genre tags: {len(no_genre)} ({100*len(no_genre)/max(1,len(music)):.1f}%)")
    by_source = Counter(e["sources"]["name"] for e in no_genre)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")

    return {
        "other_count": len(other_events),
        "mismatches": len(mismatches),
        "music_no_genre": len(no_genre),
    }


# ─────────────────────────────────────────────────────────────
# 4. SOURCE URL QUALITY
# ─────────────────────────────────────────────────────────────
LISTING_PATTERNS = re.compile(
    r"/events/?$|/calendar/?$|/shows/?$|/schedule/?$|/lineup/?$|"
    r"/events/?\?|/calendar/?\?|/all-events|/upcoming",
    re.IGNORECASE
)


def audit_urls(events):
    section("4. SOURCE URL QUALITY")

    no_url = [e for e in events if not e.get("source_url")]
    print(f"  Missing source_url: {len(no_url)} ({100*len(no_url)/len(events):.1f}%)")

    has_url = [e for e in events if e.get("source_url")]
    listing_urls = [e for e in has_url if LISTING_PATTERNS.search(e["source_url"])]
    print(f"  Listing page URLs (not detail): {len(listing_urls)} ({100*len(listing_urls)/max(1,len(has_url)):.1f}%)")

    by_source = Counter(e["sources"]["name"] for e in listing_urls)
    subsection("Worst offenders — listing URLs by source")
    for src, cnt in by_source.most_common(15):
        total_from_src = sum(1 for e in has_url if e["sources"]["name"] == src)
        print(f"    {src}: {cnt}/{total_from_src} ({100*cnt/total_from_src:.0f}%)")

    for e in listing_urls[:5]:
        print(f"    EX: [{e['sources']['name']}] {e['source_url'][:100]}")

    return {
        "missing_url": len(no_url),
        "listing_urls": len(listing_urls),
    }


# ─────────────────────────────────────────────────────────────
# 5. IMAGE COVERAGE
# ─────────────────────────────────────────────────────────────
def audit_images(events):
    section("5. IMAGE COVERAGE")

    has_img = [e for e in events if e.get("image_url")]
    no_img = [e for e in events if not e.get("image_url")]
    pct = 100 * len(has_img) / len(events)
    print(f"  With image: {len(has_img)} ({pct:.1f}%)")
    print(f"  Without image: {len(no_img)} ({100-pct:.1f}%)")

    subsection("Image coverage by category")
    cats = sorted(set(e["category_id"] for e in events))
    for cat in cats:
        cat_events = [e for e in events if e["category_id"] == cat]
        cat_img = [e for e in cat_events if e.get("image_url")]
        pct = 100 * len(cat_img) / max(1, len(cat_events))
        bar = "#" * int(pct / 5)
        print(f"  {cat:>20}: {len(cat_img):>4}/{len(cat_events):<4} ({pct:5.1f}%) {bar}")

    subsection("Worst sources for missing images")
    no_img_by_source = Counter(e["sources"]["name"] for e in no_img)
    total_by_source = Counter(e["sources"]["name"] for e in events)
    ranked = []
    for src, cnt in no_img_by_source.items():
        total = total_by_source[src]
        if total >= 5:  # only sources with meaningful volume
            ranked.append((src, cnt, total, 100 * cnt / total))
    ranked.sort(key=lambda x: -x[1])
    for src, missing, total, pct in ranked[:15]:
        print(f"    {src}: {missing}/{total} missing ({pct:.0f}%)")

    return {
        "has_image": len(has_img),
        "no_image": len(no_img),
        "pct": pct,
    }


# ─────────────────────────────────────────────────────────────
# 6. PRICE DATA
# ─────────────────────────────────────────────────────────────
def audit_prices(events):
    section("6. PRICE DATA COMPLETENESS")

    has_price = [e for e in events if e.get("price_min") is not None or e.get("price_max") is not None]
    is_free = [e for e in events if e.get("is_free") is True]
    unknown = [e for e in events if not e.get("is_free") and e.get("price_min") is None and e.get("price_max") is None]

    print(f"  Has price data: {len(has_price)} ({100*len(has_price)/len(events):.1f}%)")
    print(f"  Marked free: {len(is_free)} ({100*len(is_free)/len(events):.1f}%)")
    print(f"  Completely unknown: {len(unknown)} ({100*len(unknown)/len(events):.1f}%)")

    subsection("Price distribution (where known)")
    price_buckets = {"Free": 0, "$1-20": 0, "$21-50": 0, "$51-100": 0, "$100+": 0}
    for e in has_price:
        p = e.get("price_min") or e.get("price_max") or 0
        if p == 0: price_buckets["Free"] += 1
        elif p <= 20: price_buckets["$1-20"] += 1
        elif p <= 50: price_buckets["$21-50"] += 1
        elif p <= 100: price_buckets["$51-100"] += 1
        else: price_buckets["$100+"] += 1
    for k, v in price_buckets.items():
        print(f"    {k:>10}: {v}")

    return {
        "has_price": len(has_price),
        "is_free": len(is_free),
        "unknown": len(unknown),
    }


# ─────────────────────────────────────────────────────────────
# 7. TIME DATA
# ─────────────────────────────────────────────────────────────
def audit_times(events):
    section("7. TIME DATA QUALITY")

    has_time = [e for e in events if e.get("start_time")]
    no_time = [e for e in events if not e.get("start_time")]
    print(f"  Has start_time: {len(has_time)} ({100*len(has_time)/len(events):.1f}%)")
    print(f"  Missing start_time: {len(no_time)} ({100*len(no_time)/len(events):.1f}%)")

    # Suspicious midnight
    midnight = [e for e in has_time if e["start_time"] in ("00:00", "00:00:00")]
    print(f"  Suspicious 00:00 times: {len(midnight)} ({100*len(midnight)/max(1,len(has_time)):.1f}%)")

    subsection("00:00 by source")
    by_source = Counter(e["sources"]["name"] for e in midnight)
    for src, cnt in by_source.most_common(10):
        print(f"    {src}: {cnt}")
    for e in midnight[:5]:
        print(f"    EX: [{e['sources']['name']}] \"{e['title']}\" on {e['start_date']}")

    subsection("Missing start_time by source (top offenders)")
    by_source = Counter(e["sources"]["name"] for e in no_time)
    total_by_source = Counter(e["sources"]["name"] for e in events)
    ranked = []
    for src, cnt in by_source.items():
        total = total_by_source[src]
        if total >= 5:
            ranked.append((src, cnt, total, 100 * cnt / total))
    ranked.sort(key=lambda x: -x[1])
    for src, missing, total, pct in ranked[:15]:
        print(f"    {src}: {missing}/{total} missing ({pct:.0f}%)")

    # Time distribution
    subsection("Start time distribution")
    hour_counts = Counter()
    for e in has_time:
        try:
            h = int(e["start_time"].split(":")[0])
            hour_counts[h] += 1
        except:
            pass
    for h in range(24):
        cnt = hour_counts.get(h, 0)
        bar = "#" * (cnt // 10)
        print(f"    {h:02d}:00  {cnt:>5}  {bar}")

    return {
        "has_time": len(has_time),
        "no_time": len(no_time),
        "midnight": len(midnight),
    }


# ─────────────────────────────────────────────────────────────
# COMPOSITE SOURCE RANKING
# ─────────────────────────────────────────────────────────────
def rank_sources(events):
    section("COMPOSITE SOURCE QUALITY RANKING")
    print("(Lower score = more problems)")

    source_stats = defaultdict(lambda: {
        "total": 0, "no_desc": 0, "no_img": 0, "no_time": 0,
        "allcaps": 0, "listing_url": 0, "short_desc": 0, "truncated": 0,
    })

    for e in events:
        src = e["sources"]["name"]
        s = source_stats[src]
        s["total"] += 1
        if not e.get("description"): s["no_desc"] += 1
        elif len(e["description"]) < 50: s["short_desc"] += 1
        elif TRUNCATION_RE.search(e["description"]): s["truncated"] += 1
        if not e.get("image_url"): s["no_img"] += 1
        if not e.get("start_time"): s["no_time"] += 1
        if e["title"] == e["title"].upper() and len(e["title"]) > 5: s["allcaps"] += 1
        if e.get("source_url") and LISTING_PATTERNS.search(e["source_url"]): s["listing_url"] += 1

    # Score: 0-100 per source
    rankings = []
    for src, s in source_stats.items():
        if s["total"] < 3:
            continue
        t = s["total"]
        score = 100
        score -= 30 * (s["no_desc"] / t)    # description is most important
        score -= 20 * (s["no_img"] / t)
        score -= 15 * (s["no_time"] / t)
        score -= 10 * (s["short_desc"] / t)
        score -= 10 * (s["listing_url"] / t)
        score -= 10 * (s["allcaps"] / t)
        score -= 5 * (s["truncated"] / t)
        rankings.append((src, round(score, 1), s["total"], s))

    rankings.sort(key=lambda x: x[1])

    print(f"\n{'Source':<40} {'Score':>6} {'Events':>7} {'NoDsc':>6} {'NoImg':>6} {'NoTm':>6} {'Caps':>5} {'List':>5}")
    print("-" * 100)
    for src, score, total, s in rankings[:25]:
        print(f"  {src:<38} {score:>6} {total:>7} {s['no_desc']:>6} {s['no_img']:>6} {s['no_time']:>6} {s['allcaps']:>5} {s['listing_url']:>5}")

    print(f"\n--- BEST sources ---")
    for src, score, total, s in rankings[-10:]:
        print(f"  {src:<38} {score:>6} {total:>7}")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    events = fetch_events()
    if not events:
        print("No events found!")
        sys.exit(1)

    results = {}
    results["descriptions"] = audit_descriptions(events)
    results["titles"] = audit_titles(events)
    results["categories"] = audit_categories(events)
    results["urls"] = audit_urls(events)
    results["images"] = audit_images(events)
    results["prices"] = audit_prices(events)
    results["times"] = audit_times(events)
    rank_sources(events)

    section("SUMMARY")
    print(json.dumps(results, indent=2))
