#!/usr/bin/env python3
"""
Deep-dive on broken/suspect event image patterns found in the first pass.

Focuses on:
- Protocol-relative URLs (//domain/path)
- Relative paths (/path/to/image)
- Data URIs
- Placeholder/default images
- Non-event images (venue logos, generic maps, etc.)
- Shepherd.org URLs (103 events using a rehab center domain?)
- HTTP-no-ext URLs (2,869 events) -- what are these?
- Google Maps static images used as event images
"""

import os
import sys
import random
import requests
from urllib.parse import urlparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import get_client


def fetch_all_events_with_images(client):
    """Fetch all events that have a non-null image_url."""
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            client.table("events")
            .select("id,title,image_url,start_date,source_url,venue_id")
            .not_.is_("image_url", "null")
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
    return all_rows


def check_url_status(url, timeout=10):
    """HEAD-request a URL and return (status_code, final_url, content_type)."""
    try:
        resp = requests.head(
            url,
            timeout=timeout,
            allow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LostCity-ImageCheck/1.0"
            },
        )
        ct = resp.headers.get("Content-Type", "")
        return resp.status_code, resp.url, ct
    except requests.exceptions.Timeout:
        return "timeout", url, ""
    except requests.exceptions.ConnectionError:
        return "conn-error", url, ""
    except Exception as e:
        return f"error:{type(e).__name__}", url, ""


def main():
    client = get_client()
    print("Fetching events with images...")
    rows = fetch_all_events_with_images(client)
    print(f"Total events with image_url: {len(rows):,}\n")

    # ── 1. Protocol-relative URLs ─────────────────────────────────────────
    protocol_relative = [r for r in rows if r["image_url"].startswith("//")]
    print(f"=== PROTOCOL-RELATIVE URLs (//...) : {len(protocol_relative)} ===")
    for r in protocol_relative[:10]:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:120]}")

    # ── 2. Relative paths ─────────────────────────────────────────────────
    relative_paths = [
        r for r in rows
        if r["image_url"].strip().startswith("/")
        and not r["image_url"].strip().startswith("//")
    ]
    print(f"\n=== RELATIVE PATHS (/...) : {len(relative_paths)} ===")
    for r in relative_paths:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:120]}")
        print(f"    Source: {r.get('source_url', '')[:120]}")

    # ── 3. Data URIs ──────────────────────────────────────────────────────
    data_uris = [r for r in rows if r["image_url"].strip().lower().startswith("data:")]
    print(f"\n=== DATA URIs : {len(data_uris)} ===")
    for r in data_uris:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:100]}")

    # ── 4. No protocol (not http, not //, not /) ──────────────────────────
    no_protocol = [
        r for r in rows
        if not r["image_url"].strip().lower().startswith("http")
        and not r["image_url"].strip().startswith("/")
        and not r["image_url"].strip().lower().startswith("data:")
    ]
    print(f"\n=== NO PROTOCOL (weird URLs) : {len(no_protocol)} ===")
    for r in no_protocol:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:120]}")

    # ── 5. Analyze http-no-ext URLs ───────────────────────────────────────
    http_no_ext = []
    for r in rows:
        url = r["image_url"].strip().lower()
        if not url.startswith("http"):
            continue
        path = urlparse(url).path
        has_img_ext = any(ext in path for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"])
        if not has_img_ext:
            http_no_ext.append(r)

    print(f"\n=== HTTP URLs WITHOUT IMAGE EXTENSION : {len(http_no_ext)} ===")
    # Show domain distribution for these
    domain_counts = Counter()
    for r in http_no_ext:
        domain = urlparse(r["image_url"]).netloc.lower()
        domain_counts[domain] += 1
    print("  Domain distribution:")
    for domain, count in domain_counts.most_common(20):
        print(f"    {domain:<50s} {count:>4}")

    # Show some examples
    print("\n  Sample URLs:")
    for r in random.sample(http_no_ext, min(10, len(http_no_ext))):
        print(f"    [{r['id']}] {r['image_url'][:130]}")

    # ── 6. Placeholder / default image detection ──────────────────────────
    placeholder_keywords = ["placeholder", "no-image", "default", "noimage", "no_image", "blank", "missing"]
    placeholders = [
        r for r in rows
        if any(kw in r["image_url"].lower() for kw in placeholder_keywords)
    ]
    print(f"\n=== PLACEHOLDER / DEFAULT IMAGES : {len(placeholders)} ===")
    for r in placeholders[:15]:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:130]}")

    # ── 7. Google Maps static images used as event images ─────────────────
    maps_images = [r for r in rows if "maps.google" in r["image_url"].lower() or "maps.googleapis" in r["image_url"].lower()]
    print(f"\n=== GOOGLE MAPS IMAGES (not real event images) : {len(maps_images)} ===")
    for r in maps_images[:5]:
        print(f"  [{r['id']}] {r['title'][:50]}")
        print(f"    URL: {r['image_url'][:130]}")

    # ── 8. Shepherd.org URLs ──────────────────────────────────────────────
    shepherd = [r for r in rows if "shepherd.org" in r["image_url"].lower()]
    print(f"\n=== SHEPHERD.ORG IMAGES : {len(shepherd)} ===")
    # Show unique URLs
    unique_urls = set(r["image_url"] for r in shepherd)
    print(f"  Unique URLs: {len(unique_urls)}")
    for url in list(unique_urls)[:5]:
        print(f"    {url[:130]}")
    # Show a few event titles
    for r in shepherd[:5]:
        print(f"  [{r['id']}] {r['title'][:60]} ({r.get('start_date', '')})")

    # ── 9. HTTP check protocol-relative URLs (prepend https:) ─────────────
    print(f"\n=== HTTP CHECK: Protocol-relative URLs ({len(protocol_relative)}) ===")
    for r in protocol_relative[:10]:
        test_url = "https:" + r["image_url"]
        status, final_url, ct = check_url_status(test_url)
        is_image = "image" in ct.lower() if ct else "?"
        print(f"  [{r['id']}] Status={status} Image={is_image} {test_url[:100]}")

    # ── 10. Larger HTTP sample (100 URLs) focused on variety ──────────────
    print("\n=== LARGER HTTP SAMPLE (100 URLs across all domains) ===")
    http_urls = [r for r in rows if r["image_url"].strip().lower().startswith("http")]

    # Stratified sample: pick from different domains
    by_domain = defaultdict(list)
    for r in http_urls:
        domain = urlparse(r["image_url"]).netloc.lower()
        by_domain[domain].append(r)

    sample = []
    # Take 1-3 from each domain
    domains = list(by_domain.keys())
    random.shuffle(domains)
    for domain in domains:
        if len(sample) >= 100:
            break
        n = min(2, len(by_domain[domain]))
        sample.extend(random.sample(by_domain[domain], n))

    sample = sample[:100]
    print(f"  Checking {len(sample)} URLs across {len(set(urlparse(r['image_url']).netloc for r in sample))} domains...")

    results = {}
    with ThreadPoolExecutor(max_workers=15) as executor:
        future_to_event = {
            executor.submit(check_url_status, ev["image_url"].strip()): ev
            for ev in sample
        }
        for future in as_completed(future_to_event):
            ev = future_to_event[future]
            status, final_url, ct = future.result()
            domain = urlparse(ev["image_url"]).netloc.lower()
            is_image = "image" in ct.lower() if ct else None
            results[ev["id"]] = {
                "status": status,
                "domain": domain,
                "is_image_content_type": is_image,
                "content_type": ct,
                "url": ev["image_url"],
                "title": ev.get("title", ""),
            }

    # Summarize
    status_counts = Counter()
    domain_results = defaultdict(lambda: {"ok": 0, "fail": 0, "not_image": 0})
    broken_details = []

    for ev_id, info in results.items():
        s = str(info["status"])
        status_counts[s] += 1
        d = info["domain"]
        if info["status"] == 200:
            domain_results[d]["ok"] += 1
            if info["is_image_content_type"] is False:
                domain_results[d]["not_image"] += 1
        else:
            domain_results[d]["fail"] += 1
            broken_details.append(info)

    print("\n  HTTP Status Summary:")
    for s, count in status_counts.most_common():
        print(f"    {s:<25s} {count:>3}")

    # Non-image content types
    non_image = [info for info in results.values() if info["status"] == 200 and info["is_image_content_type"] is False]
    if non_image:
        print(f"\n  200 OK but NOT image Content-Type ({len(non_image)}):")
        ct_counts = Counter(info["content_type"][:60] for info in non_image)
        for ct, count in ct_counts.most_common(10):
            print(f"    {ct:<60s} {count:>3}")
        for info in non_image[:5]:
            print(f"    [{info['domain']}] CT={info['content_type'][:40]} URL={info['url'][:80]}")

    if broken_details:
        print(f"\n  Broken URLs ({len(broken_details)}):")
        for info in broken_details[:20]:
            print(f"    [{info['status']}] {info['domain']:<40s} {info['title'][:40]}")
            print(f"             URL: {info['url'][:110]}")

    # Domain health table
    print("\n  Domain Health Table:")
    print(f"    {'Domain':<50s} {'OK':>3} {'Fail':>4} {'!Img':>4}")
    print(f"    {'-'*50} {'---':>3} {'----':>4} {'----':>4}")
    for d in sorted(domain_results.keys()):
        dr = domain_results[d]
        if dr["fail"] > 0 or dr["not_image"] > 0:
            print(f"    {d:<50s} {dr['ok']:>3} {dr['fail']:>4} {dr['not_image']:>4}  *** ISSUE")
        else:
            print(f"    {d:<50s} {dr['ok']:>3} {dr['fail']:>4} {dr['not_image']:>4}")


if __name__ == "__main__":
    main()
