#!/usr/bin/env python3
"""
Fetch venue menu pages and dump content for offline menu_highlights extraction.

Targets venues that have menu_url populated but no menu_highlights yet.
Fetches the dedicated menu page (not the full site), extracts text, and saves
JSON dumps for Claude Code Task agents to process.

Usage:
    # Dump menu pages for all eligible venues
    python3 scrape_venue_menus.py --dump menu_dumps/

    # Filter by venue type
    python3 scrape_venue_menus.py --dump menu_dumps/ --venue-type bar

    # Test with a few venues
    python3 scrape_venue_menus.py --dump menu_dumps/ --limit 5

    # Specific venues
    python3 scrape_venue_menus.py --dump menu_dumps/ --venue-ids 100,200,300

    # Just count eligible venues (no fetching)
    python3 scrape_venue_menus.py --count

After dumping, use Claude Code Task agents to extract menu_highlights from the
dump files, then import results with:

    python3 scrape_venue_specials.py --import-dir menu_results/ --force-update
"""

import json
import sys
import time
import logging
import argparse
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from scrape_place_specials import (
    fetch_page,
    extract_page_content,
    _close_browser,
    _get_browser,
    HEADERS,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Domains that are placeholder junk — never real menu pages
SKIP_DOMAINS = {
    "example.com", "example.org", "example.net",
    "placeholder.com", "samplesite.com",
}

# Domains where menu pages are known to be unfetchable (JS walls, marketing pages)
HOPELESS_DOMAINS = {
    "wafflehouse.com", "starbucks.com", "atlantamagazine.com",
    "canva.com", "flowcode.com",
}

# Max text chars to extract from a menu page. Menus are dense with item names
# and prices, so we allow more than the default 12K used for general pages.
MENU_MAX_CHARS = 15000


def fetch_page_playwright_enhanced(url):
    """Fetch with Playwright using extended wait + scroll for JS-rendered menus.

    Key differences from the standard fetch_page_playwright:
    - Scrolls down to trigger lazy-loaded menu sections
    - Waits 5s total (vs 2s) for AJAX content to render
    - Clicks common "load more" / "view menu" buttons if found
    - Per-page timeout of 30s to prevent hangs
    """
    try:
        browser = _get_browser()
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        try:
            page = context.new_page()
            # Set a default timeout so no single operation hangs forever
            page.set_default_timeout(15000)

            page.goto(url, wait_until="domcontentloaded", timeout=20000)

            # Wait for initial JS to execute
            page.wait_for_timeout(2000)

            # Scroll down to trigger lazy-loaded content (common on Squarespace,
            # Benoit, Popmenu, and similar platforms)
            try:
                page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
                page.wait_for_timeout(1000)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight * 2 / 3)")
                page.wait_for_timeout(1000)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1500)
            except Exception:
                pass  # Scroll failed, continue with what we have

            # Try clicking common "load more" / "view full menu" buttons
            for selector in [
                "text=Load More",
                "text=View Full Menu",
                "text=View Menu",
                "text=Show More",
                "text=See Full Menu",
                "[class*='load-more']",
                "[class*='show-more']",
            ]:
                try:
                    btn = page.locator(selector).first
                    if btn.is_visible(timeout=500):
                        btn.click()
                        page.wait_for_timeout(2000)
                        break
                except Exception:
                    continue

            html = page.content()
            return html
        finally:
            context.close()
    except Exception as e:
        logger.debug(f"  Enhanced Playwright fetch failed: {e}")
        return None


def get_menu_venues(
    venue_type: Optional[str] = None,
    venue_ids: Optional[list] = None,
    limit: int = 600,
) -> list:
    """Fetch venues with menu_url but no menu_highlights, excluding junk/PDFs."""
    client = get_client()

    q = (
        client.table("places")
        .select("id, name, slug, website, menu_url, place_type, price_level")
        .not_.is_("menu_url", "null")
        .is_("menu_highlights", "null")
        .neq("is_active", False)
    )

    if venue_ids:
        q = q.in_("id", venue_ids)
    elif venue_type:
        q = q.eq("place_type", venue_type)

    result = q.order("name").limit(limit).execute()
    venues = result.data or []

    # Filter out junk URLs and PDFs
    filtered = []
    skipped_domain = 0
    skipped_pdf = 0
    for v in venues:
        url = v.get("menu_url", "")
        domain = urlparse(url).netloc.replace("www.", "").lower()
        if domain in SKIP_DOMAINS:
            skipped_domain += 1
            continue
        if url.lower().endswith(".pdf"):
            skipped_pdf += 1
            continue
        filtered.append(v)

    if skipped_domain or skipped_pdf:
        logger.info(f"  Filtered out: {skipped_domain} junk domains, {skipped_pdf} PDFs")

    return filtered


def dump_menu_pages(venues, dump_dir, use_playwright=True, enhanced=False):
    """Fetch menu_url for each venue and save text dumps.

    Args:
        enhanced: If True, use Playwright-first with extended waits and scrolling
                  for JS-rendered menu pages.
    """
    dump_dir.mkdir(parents=True, exist_ok=True)

    dumped = 0
    failed = 0
    skipped = 0

    try:
        for i, venue in enumerate(venues, 1):
            name = venue["name"][:45]
            menu_url = venue["menu_url"]
            slug = venue.get("slug") or f"venue-{venue['id']}"
            dump_file = dump_dir / f"{slug}.json"

            # Skip if already dumped (unless enhanced retry)
            if not enhanced and dump_file.exists():
                logger.info(f"[{i}/{len(venues)}] {name} — already dumped, skipping")
                skipped += 1
                continue

            logger.info(f"[{i}/{len(venues)}] {name}")
            logger.info(f"  URL: {menu_url}")

            if enhanced:
                # Playwright-first with extended rendering
                html = fetch_page_playwright_enhanced(menu_url)
                if not html:
                    logger.info("  Enhanced fetch failed")
                    failed += 1
                    continue
            else:
                html = fetch_page(menu_url, timeout=15, use_playwright=use_playwright)
                if not html:
                    logger.info("  Failed to fetch")
                    failed += 1
                    continue

            text = extract_page_content(html, max_chars=MENU_MAX_CHARS)
            if len(text.strip()) < 50:
                logger.info(f"  Too little content ({len(text)} chars), skipping")
                failed += 1
                continue

            # For retry mode, check if we got meaningfully more content
            if enhanced and dump_file.exists():
                old_dump = json.loads(dump_file.read_text())
                old_len = len(old_dump.get("menu_text", ""))
                new_len = len(text)
                if new_len <= old_len + 100:
                    logger.info(f"  No improvement ({old_len} → {new_len} chars), skipping")
                    skipped += 1
                    continue
                logger.info(f"  Improved! {old_len} → {new_len} chars")

            dump_file.write_text(json.dumps({
                "place_id": venue["id"],
                "venue_slug": slug,
                "venue_name": venue["name"],
                "place_type": venue.get("place_type"),
                "menu_url": menu_url,
                "menu_text": f"--- Menu Page: {menu_url} ---\n{text}",
                "meta": {},
            }, indent=2, ensure_ascii=False))

            logger.info(f"  Saved {len(text)} chars → {dump_file.name}")
            dumped += 1

            # Be polite to servers
            time.sleep(1)
    finally:
        _close_browser()

    return dumped, failed, skipped


def get_retry_slugs(results_dir):
    """Get venue slugs from results that had null menu_highlights."""
    results_dir = Path(results_dir)
    slugs = []
    for f in sorted(results_dir.glob("*.json")):
        try:
            d = json.loads(f.read_text())
            if d.get("extracted", {}).get("menu_highlights") is None:
                slugs.append(d["venue_slug"])
        except (json.JSONDecodeError, KeyError):
            continue
    return slugs


def get_retry_venues(slugs, dump_dir):
    """Build venue list for retry from existing dump files, filtering hopeless cases."""
    dump_dir = Path(dump_dir)
    venues = []
    skipped = 0
    for slug in slugs:
        dump_file = dump_dir / f"{slug}.json"
        if not dump_file.exists():
            continue
        d = json.loads(dump_file.read_text())
        url = d.get("menu_url", "")
        domain = urlparse(url).netloc.replace("www.", "").lower()

        # Skip hopeless domains
        if domain in HOPELESS_DOMAINS:
            skipped += 1
            continue
        # Skip relative URLs (broken menu_url data)
        if not url.startswith("http"):
            skipped += 1
            continue

        venues.append({
            "id": d["venue_id"],
            "name": d.get("venue_name", slug),
            "slug": d["venue_slug"],
            "menu_url": url,
            "place_type": d.get("place_type"),
        })
    if skipped:
        logger.info(f"  Filtered out {skipped} hopeless domains/URLs")
    return venues


def main():
    parser = argparse.ArgumentParser(
        description="Fetch venue menu pages for offline menu_highlights extraction"
    )
    parser.add_argument("--dump", type=str, metavar="DIR",
                        help="Fetch menu pages and save dumps to DIR")
    parser.add_argument("--venue-type", type=str,
                        help="Filter by venue type (restaurant, bar, etc.)")
    parser.add_argument("--venue-ids", type=str,
                        help="Comma-separated venue IDs")
    parser.add_argument("--limit", type=int, default=600,
                        help="Max venues to process (default: 600)")
    parser.add_argument("--count", action="store_true",
                        help="Just count eligible venues and exit")
    parser.add_argument("--no-playwright", action="store_true",
                        help="Disable Playwright fallback")
    parser.add_argument("--retry", type=str, metavar="RESULTS_DIR",
                        help="Retry mode: re-fetch null results from RESULTS_DIR using "
                             "enhanced Playwright (longer waits, scrolling, button clicks)")
    args = parser.parse_args()

    # --- RETRY MODE: re-fetch null results with enhanced Playwright ---
    if args.retry:
        if not args.dump:
            logger.error("--retry requires --dump <DIR> to specify where dumps live")
            sys.exit(1)

        dump_dir = Path(args.dump)
        null_slugs = get_retry_slugs(args.retry)
        logger.info(f"Found {len(null_slugs)} null results to retry")

        venues = get_retry_venues(null_slugs, dump_dir)
        logger.info(f"Retrying {len(venues)} venues with enhanced Playwright")
        logger.info("=" * 60)

        dumped, failed, skipped = dump_menu_pages(
            venues, dump_dir, enhanced=True,
        )

        logger.info("=" * 60)
        logger.info(f"Done! Re-dumped {dumped} venues, {failed} failed, {skipped} no improvement")
        logger.info("Next: re-run extraction on improved dumps, then import")
        return

    # Parse venue IDs
    venue_ids = None
    if args.venue_ids:
        venue_ids = [int(x.strip()) for x in args.venue_ids.split(",") if x.strip()]

    venues = get_menu_venues(
        venue_type=args.venue_type,
        venue_ids=venue_ids,
        limit=args.limit,
    )

    logger.info(f"Found {len(venues)} venues with menu_url but no menu_highlights")

    if args.count:
        # Show breakdown by venue_type
        by_type = {}
        for v in venues:
            vt = v.get("place_type") or "unknown"
            by_type[vt] = by_type.get(vt, 0) + 1
        for vt, count in sorted(by_type.items(), key=lambda x: -x[1]):
            logger.info(f"  {vt}: {count}")
        return

    if not args.dump:
        logger.error("Specify --dump <DIR> to fetch menu pages, or --count to see stats")
        sys.exit(1)

    dump_dir = Path(args.dump)
    logger.info(f"Dumping menu pages to {dump_dir}/")
    logger.info("=" * 60)

    dumped, failed, skipped = dump_menu_pages(
        venues, dump_dir,
        use_playwright=not args.no_playwright,
    )

    logger.info("=" * 60)
    logger.info(f"Done! Dumped {dumped} venues, {failed} failed, {skipped} already existed")
    logger.info("Next steps:")
    logger.info(f"  1. Run Claude Code Task agents to extract menu_highlights from {dump_dir}/")
    logger.info("  2. Import: python3 scrape_venue_specials.py --import-dir menu_results/ --force-update")


if __name__ == "__main__":
    main()
