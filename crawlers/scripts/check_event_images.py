#!/usr/bin/env python3
"""
Analyze event image health in the database.

Checks:
1. Total events with images vs without
2. Image URL patterns (domains, formats)
3. Obviously broken patterns (empty strings, relative paths, localhost)
4. HTTP HEAD-request a random sample to check actual reachability
5. Group results by domain to identify most-broken sources
"""

import os
import sys
import random
import requests
from urllib.parse import urlparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Ensure crawlers dir is on path so config/db can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_client


def fetch_all_event_images(client):
    """Fetch all events with their image_url, id, and title."""
    # Supabase paginates at 1000 rows by default, so we need to paginate
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            client.table("events")
            .select("id,title,image_url,start_date,source_url")
            .order("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
        if offset % 5000 == 0:
            print(f"  ... fetched {offset} rows so far")
    return all_rows


def extract_domain(url):
    """Extract domain from a URL, handling edge cases."""
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower() or "(no-domain)"
    except Exception:
        return "(parse-error)"


def classify_url_pattern(url):
    """Classify an image URL into pattern categories."""
    if not url:
        return "empty/null"
    url_lower = url.strip().lower()
    if url_lower in ("", "null", "none", "n/a"):
        return "empty/null"
    if url_lower.startswith("data:"):
        return "data-uri"
    if not url_lower.startswith("http"):
        if url_lower.startswith("//"):
            return "protocol-relative"
        if url_lower.startswith("/"):
            return "relative-path"
        return "no-protocol"
    if "localhost" in url_lower or "127.0.0.1" in url_lower:
        return "localhost"
    if "placeholder" in url_lower or "no-image" in url_lower or "default" in url_lower:
        return "placeholder"
    # Check for common image extensions
    path = urlparse(url_lower).path
    if any(path.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]):
        return "valid-looking"
    if any(ext in path for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]):
        return "valid-looking"  # e.g. image.jpg?w=400
    # No obvious extension but still has http
    return "http-no-ext"


def check_url_status(url, timeout=10):
    """HEAD-request a URL and return status code."""
    try:
        resp = requests.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LostCity-ImageCheck/1.0"
            },
        )
        return resp.status_code
    except requests.exceptions.Timeout:
        return "timeout"
    except requests.exceptions.ConnectionError:
        return "conn-error"
    except requests.exceptions.TooManyRedirects:
        return "too-many-redirects"
    except Exception as e:
        return f"error:{type(e).__name__}"


def main():
    print("=" * 70)
    print("EVENT IMAGE HEALTH CHECK")
    print("=" * 70)

    client = get_client()

    # ── 1. Fetch all events ──────────────────────────────────────────────
    print("\n[1/5] Fetching all events from database...")
    rows = fetch_all_event_images(client)
    total = len(rows)
    print(f"  Total events: {total:,}")

    # ── 2. Count with/without images ─────────────────────────────────────
    print("\n[2/5] Counting events with vs without images...")
    with_image = [r for r in rows if r.get("image_url") and r["image_url"].strip()]
    without_image = [r for r in rows if not r.get("image_url") or not r["image_url"].strip()]
    print(f"  With image_url:    {len(with_image):>6,} ({len(with_image)/total*100:.1f}%)")
    print(f"  Without image_url: {len(without_image):>6,} ({len(without_image)/total*100:.1f}%)")

    # ── 3. Analyze URL patterns ──────────────────────────────────────────
    print("\n[3/5] Analyzing image URL patterns...")
    pattern_counts = Counter()
    for r in rows:
        pattern = classify_url_pattern(r.get("image_url"))
        pattern_counts[pattern] += 1

    print("\n  URL Pattern Distribution:")
    for pattern, count in pattern_counts.most_common():
        pct = count / total * 100
        print(f"    {pattern:<25s} {count:>6,} ({pct:.1f}%)")

    # ── 4. Domain distribution ───────────────────────────────────────────
    print("\n  Top Image Domains (events with URLs):")
    domain_counts = Counter()
    for r in with_image:
        domain = extract_domain(r["image_url"])
        domain_counts[domain] += 1

    for domain, count in domain_counts.most_common(25):
        pct = count / len(with_image) * 100
        print(f"    {domain:<45s} {count:>5,} ({pct:.1f}%)")

    # ── 5. Check for obviously broken patterns ───────────────────────────
    print("\n[4/5] Checking for obviously broken URL patterns...")
    broken_patterns = defaultdict(list)
    for r in with_image:
        url = r["image_url"].strip()
        url_lower = url.lower()

        if url_lower.startswith("data:"):
            broken_patterns["data-uri"].append(r)
        elif not url_lower.startswith("http"):
            broken_patterns["missing-protocol"].append(r)
        elif "localhost" in url_lower or "127.0.0.1" in url_lower:
            broken_patterns["localhost"].append(r)
        elif "placeholder" in url_lower or "no-image" in url_lower:
            broken_patterns["placeholder-image"].append(r)
        elif len(url) > 2000:
            broken_patterns["url-too-long"].append(r)
        elif " " in url:
            broken_patterns["contains-spaces"].append(r)

    if broken_patterns:
        print("\n  Obviously Broken URLs:")
        for issue, events in sorted(broken_patterns.items(), key=lambda x: -len(x[1])):
            print(f"\n    {issue}: {len(events)} events")
            for ev in events[:3]:
                title = (ev.get("title") or "untitled")[:50]
                url_preview = (ev.get("image_url") or "")[:80]
                print(f"      - [{ev['id']}] {title}")
                print(f"        URL: {url_preview}...")
    else:
        print("  No obviously broken URL patterns found.")

    # ── 6. HTTP HEAD-check a random sample ───────────────────────────────
    print("\n[5/5] HTTP HEAD-checking a random sample of image URLs...")

    # Filter to only valid-looking HTTP URLs for the sample
    http_urls = [
        r for r in with_image
        if r["image_url"].strip().lower().startswith("http")
    ]

    sample_size = min(50, len(http_urls))
    sample = random.sample(http_urls, sample_size)
    print(f"  Checking {sample_size} random URLs...\n")

    results = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_event = {
            executor.submit(check_url_status, ev["image_url"].strip()): ev
            for ev in sample
        }
        for future in as_completed(future_to_event):
            ev = future_to_event[future]
            status = future.result()
            results[ev["id"]] = {
                "status": status,
                "url": ev["image_url"],
                "title": ev.get("title", ""),
                "domain": extract_domain(ev["image_url"]),
            }

    # Summarize HTTP results
    status_counts = Counter()
    domain_status = defaultdict(lambda: Counter())
    broken_list = []

    for ev_id, info in results.items():
        status = info["status"]
        status_key = str(status)
        status_counts[status_key] += 1
        domain_status[info["domain"]][status_key] += 1
        if status != 200:
            broken_list.append(info)

    print("  HTTP Status Code Summary:")
    for status, count in status_counts.most_common():
        pct = count / sample_size * 100
        marker = " <-- BROKEN" if status != "200" and status != 200 else ""
        print(f"    {str(status):<25s} {count:>3} ({pct:.1f}%){marker}")

    if broken_list:
        print(f"\n  Broken URLs ({len(broken_list)} of {sample_size} sampled):")
        for info in broken_list:
            title = info["title"][:50]
            print(f"    [{info['status']}] {info['domain']}")
            print(f"         Title: {title}")
            print(f"         URL:   {info['url'][:120]}")

    # Domain-level breakdown for sampled URLs
    print(f"\n  Domain Health (from {sample_size} sampled URLs):")
    print(f"    {'Domain':<45s} {'OK':>4} {'Fail':>4} {'Rate':>6}")
    print(f"    {'-'*45} {'----':>4} {'----':>4} {'------':>6}")
    for domain in sorted(domain_status.keys()):
        statuses = domain_status[domain]
        ok = statuses.get("200", 0) + statuses.get(200, 0)
        fail = sum(v for k, v in statuses.items() if k not in ("200", 200))
        total_d = ok + fail
        rate = ok / total_d * 100 if total_d > 0 else 0
        if total_d >= 1:
            marker = "  *** PROBLEM" if rate < 80 and total_d >= 2 else ""
            print(f"    {domain:<45s} {ok:>4} {fail:>4} {rate:>5.0f}%{marker}")

    # ── Final summary ────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Total events:              {total:,}")
    print(f"  Events with images:        {len(with_image):,} ({len(with_image)/total*100:.1f}%)")
    print(f"  Events without images:     {len(without_image):,} ({len(without_image)/total*100:.1f}%)")
    obviously_broken = sum(len(v) for v in broken_patterns.values())
    print(f"  Obviously broken URLs:     {obviously_broken:,}")
    ok_in_sample = status_counts.get("200", 0) + status_counts.get(200, 0)
    fail_in_sample = sample_size - ok_in_sample
    print(f"  HTTP sample ({sample_size}):          {ok_in_sample} OK, {fail_in_sample} broken ({fail_in_sample/sample_size*100:.0f}% failure rate)")
    if len(with_image) > 0:
        estimated_broken = int(len(with_image) * (fail_in_sample / sample_size))
        print(f"  Estimated total broken:    ~{estimated_broken:,} (extrapolated from sample)")
    print("=" * 70)


if __name__ == "__main__":
    main()
