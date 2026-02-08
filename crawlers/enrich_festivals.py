#!/usr/bin/env python3
"""
Festival Enrichment Pipeline — bulk-enrich all festivals from the festivals table.

Extracts image_url, ticket_url, announced_start, announced_end from festival
websites using the existing extraction pipeline (JSON-LD, Open Graph, heuristic).
No LLM calls — keeps cost at zero.

Usage:
    python3 enrich_festivals.py                        # Enrich all with gaps
    python3 enrich_festivals.py --dry-run              # Preview without writing
    python3 enrich_festivals.py --slug dragon-con      # Single festival
    python3 enrich_festivals.py --force                # Re-enrich even if populated
    python3 enrich_festivals.py --render-js            # Playwright for JS-heavy sites
"""

import re
import sys
import time
import logging
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))

from db import get_client
from pipeline.fetch import fetch_html
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig, FetchConfig

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Date extraction — festival websites announce dates in varied formats
# ---------------------------------------------------------------------------

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2,
    "mar": 3, "march": 3, "apr": 4, "april": 4,
    "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# "October 3-5, 2026" / "Oct 3–5, 2026" / "Oct 3 - 5, 2026"
SAME_MONTH_RE = re.compile(
    r"(?:(?:^|[^a-zA-Z]))"
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*[–\-]\s*(\d{1,2})\s*,?\s*(20\d{2})?",
    re.IGNORECASE,
)

# "March 15 - April 2, 2026" / "Mar 15 – Apr 2, 2026"
CROSS_MONTH_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*[–\-]\s*"
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*,?\s*(20\d{2})?",
    re.IGNORECASE,
)

# Single date: "October 5, 2026"
SINGLE_DATE_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*,?\s*(20\d{2})",
    re.IGNORECASE,
)


def _month_num(name: str) -> Optional[int]:
    return MONTH_MAP.get(name.lower().rstrip("."))


def _safe_date(year: int, month: int, day: int) -> Optional[str]:
    try:
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except (ValueError, OverflowError):
        return None


def extract_festival_dates(html: str, default_year: int = 2026) -> tuple[Optional[str], Optional[str]]:
    """
    Extract start/end dates from festival HTML.

    Tries JSON-LD startDate/endDate first, then regex on visible text.
    Returns (start_date, end_date) in YYYY-MM-DD format or (None, None).
    """
    from bs4 import BeautifulSoup
    import json

    soup = BeautifulSoup(html, "html.parser")

    # 1. JSON-LD startDate / endDate
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                start = item.get("startDate")
                end = item.get("endDate")
                if start:
                    start_str = str(start)[:10]
                    end_str = str(end)[:10] if end else start_str
                    if re.match(r"\d{4}-\d{2}-\d{2}", start_str):
                        return start_str, end_str if re.match(r"\d{4}-\d{2}-\d{2}", end_str) else start_str
        except (json.JSONDecodeError, TypeError):
            continue

    # 2. <time> / <meta> with datetime
    for tag in soup.find_all("time"):
        dt = tag.get("datetime")
        if dt and len(dt) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", dt):
            return dt[:10], dt[:10]

    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        if "date" in prop.lower() and meta.get("content"):
            content = meta["content"].strip()
            if len(content) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", content):
                return content[:10], content[:10]

    # 3. Regex on page text
    text = soup.get_text(" ", strip=True)

    # Cross-month first (more specific)
    m = CROSS_MONTH_RE.search(text)
    if m:
        m1 = _month_num(m.group(1))
        d1 = int(m.group(2))
        m2 = _month_num(m.group(3))
        d2 = int(m.group(4))
        year = int(m.group(5)) if m.group(5) else default_year
        if m1 and m2:
            start = _safe_date(year, m1, d1)
            end = _safe_date(year, m2, d2)
            if start and end:
                return start, end

    # Same month range
    m = SAME_MONTH_RE.search(text)
    if m:
        month = _month_num(m.group(1))
        d1 = int(m.group(2))
        d2 = int(m.group(3))
        year = int(m.group(4)) if m.group(4) else default_year
        if month:
            start = _safe_date(year, month, d1)
            end = _safe_date(year, month, d2)
            if start and end:
                return start, end

    # Single date
    m = SINGLE_DATE_RE.search(text)
    if m:
        month = _month_num(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3))
        if month:
            d = _safe_date(year, month, day)
            if d:
                return d, d

    return None, None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def enrich_festivals(
    dry_run: bool = False,
    slug: Optional[str] = None,
    force: bool = False,
    render_js: bool = False,
):
    client = get_client()

    # Query all festivals with websites
    query = (
        client.table("festivals")
        .select("id,slug,name,website,image_url,ticket_url,announced_start,announced_end")
        .not_.is_("website", "null")
    )
    if slug:
        query = query.eq("slug", slug)

    result = query.order("name").execute()
    all_festivals = result.data or []

    if not force:
        # Filter to those missing at least one field
        festivals = [
            f for f in all_festivals
            if not f.get("image_url") or not f.get("ticket_url") or not f.get("announced_start")
        ]
    else:
        festivals = all_festivals

    stats = {
        "total": len(festivals),
        "image": 0,
        "ticket": 0,
        "dates": 0,
        "failed": 0,
        "skipped": 0,
    }

    fetch_cfg = FetchConfig(timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded")
    detail_cfg = DetailConfig(
        use_jsonld=True,
        use_open_graph=True,
        use_heuristic=True,
        use_llm=False,
    )

    logger.info(f"Festival Enrichment Pipeline")
    logger.info(f"{'=' * 70}")
    logger.info(f"Total with website: {len(all_festivals)} | To enrich: {len(festivals)}")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'} | Render JS: {render_js}")
    logger.info(f"{'=' * 70}")

    for i, f in enumerate(festivals, 1):
        name = f["name"]
        website = f["website"]

        prefix = f"[{i:3d}/{len(festivals)}] {name[:35]:<35}"

        # Fetch HTML
        html, err = fetch_html(website, fetch_cfg)
        if err or not html:
            # Retry with Playwright if initial fetch failed and not already using it
            if not render_js:
                html, err = fetch_html(website, FetchConfig(timeout_ms=20000, render_js=True, wait_until="domcontentloaded"))
            if err or not html:
                logger.info(f"{prefix} FAIL ({err or 'empty'})")
                stats["failed"] += 1
                time.sleep(0.5)
                continue

        # Run extraction stack
        enriched = enrich_from_detail(html, website, f["slug"], detail_cfg)

        # Extract dates separately
        start_date, end_date = extract_festival_dates(html)

        # Build update dict — only fill NULL fields (unless --force)
        updates: dict = {}
        markers: list[str] = []

        # Image
        img = enriched.get("image_url")
        if img and (force or not f.get("image_url")):
            updates["image_url"] = img
            markers.append("image \u2713")
            stats["image"] += 1
        else:
            markers.append("image \u2717")

        # Ticket URL
        ticket = enriched.get("ticket_url")
        if ticket and (force or not f.get("ticket_url")):
            updates["ticket_url"] = ticket
            markers.append("ticket \u2713")
            stats["ticket"] += 1
        else:
            markers.append("ticket \u2717")

        # Dates
        if start_date and (force or not f.get("announced_start")):
            updates["announced_start"] = start_date
            if end_date:
                updates["announced_end"] = end_date
            markers.append("dates \u2713")
            stats["dates"] += 1
        else:
            markers.append("dates \u2717")

        status_line = "  ".join(markers)

        if updates:
            if not dry_run:
                client.table("festivals").update(updates).eq("id", f["id"]).execute()
            logger.info(f"{prefix} {status_line}")
        else:
            logger.info(f"{prefix} {status_line} (no new data)")
            stats["skipped"] += 1

        time.sleep(1.5)

    # Summary
    logger.info(f"\n{'=' * 70}")
    logger.info(f"RESULTS")
    logger.info(f"{'=' * 70}")
    logger.info(f"Processed:  {stats['total']}")
    logger.info(f"Images:     {stats['image']}")
    logger.info(f"Tickets:    {stats['ticket']}")
    logger.info(f"Dates:      {stats['dates']}")
    logger.info(f"Failed:     {stats['failed']}")
    logger.info(f"Skipped:    {stats['skipped']} (already complete)")
    if dry_run:
        logger.info(f"\nDRY RUN — no changes written to database")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich festivals from their websites")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--slug", type=str, help="Enrich a single festival by slug")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if fields populated")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright for JS-heavy sites")
    args = parser.parse_args()

    enrich_festivals(
        dry_run=args.dry_run,
        slug=args.slug,
        force=args.force,
        render_js=args.render_js,
    )
