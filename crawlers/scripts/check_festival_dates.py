#!/usr/bin/env python3
"""
Lightweight festival date announcement checker.

Scans festival websites for newly announced 2026 dates using plain HTTP
(no Playwright, no LLM). Fast enough to run daily via cron.

When dates are found, updates the festival record and prints a summary.

Usage:
    python3 check_festival_dates.py               # Check all missing dates
    python3 check_festival_dates.py --dry-run      # Preview without writing
    python3 check_festival_dates.py --months 1-4   # Only festivals in Jan-Apr
    python3 check_festival_dates.py --soon          # Only festivals within 3 months
"""

import argparse
import json
import logging
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from festival_date_confidence import classify_url, compute_confidence, should_update, validate_festival_dates

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
CURRENT_YEAR = datetime.now().year

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

# Same-month range: "October 3-5, 2026"
SAME_MONTH_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*[–\-]\s*(\d{1,2})\s*,?\s*(20\d{2})",
    re.IGNORECASE,
)

# Cross-month range: "March 28 - April 2, 2026"
CROSS_MONTH_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*[–\-]\s*"
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    r"\s+(\d{1,2})\s*,?\s*(20\d{2})",
    re.IGNORECASE,
)

# Single date: "October 5, 2026"
SINGLE_DATE_RE = re.compile(
    r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
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


def extract_dates_from_html(html: str) -> tuple[Optional[str], Optional[str], str]:
    """
    Extract start/end dates from HTML. Returns (start, end, method).
    Tries JSON-LD -> meta tags -> regex, plain HTTP only.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                start = str(item.get("startDate", ""))
                if str(CURRENT_YEAR) in start and len(start) >= 10:
                    end = str(item.get("endDate", ""))
                    end_str = end[:10] if end and len(end) >= 10 else start[:10]
                    return start[:10], end_str, "json-ld"
        except (json.JSONDecodeError, TypeError):
            continue

    # 2. <time> elements — collect ALL, use min/max for range
    time_dates = []
    for tag in soup.find_all("time"):
        dt = tag.get("datetime", "")
        if str(CURRENT_YEAR) in dt and len(dt) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", dt):
            time_dates.append(dt[:10])
    if time_dates:
        return min(time_dates), max(time_dates), "time-el"

    # 3. <meta> tags with date content — collect ALL, use min/max for range
    meta_dates = []
    for meta in soup.find_all("meta"):
        prop = (meta.get("property", "") + meta.get("name", "")).lower()
        content = meta.get("content", "")
        if "date" in prop and str(CURRENT_YEAR) in content:
            m = re.match(r"(\d{4}-\d{2}-\d{2})", content)
            if m:
                meta_dates.append(m.group(1))
    if meta_dates:
        return min(meta_dates), max(meta_dates), "meta"

    # 4. Regex on visible text
    text = soup.get_text(" ", strip=True)
    year_str = str(CURRENT_YEAR)

    # Cross-month first
    m = CROSS_MONTH_RE.search(text)
    if m and m.group(5) == year_str:
        m1 = _month_num(m.group(1))
        d1 = int(m.group(2))
        m2 = _month_num(m.group(3))
        d2 = int(m.group(4))
        year = int(m.group(5))
        if m1 and m2:
            start = _safe_date(year, m1, d1)
            end = _safe_date(year, m2, d2)
            if start and end:
                return start, end, "regex-cross"

    # Same-month range
    m = SAME_MONTH_RE.search(text)
    if m and m.group(4) == year_str:
        month = _month_num(m.group(1))
        d1 = int(m.group(2))
        d2 = int(m.group(3))
        year = int(m.group(4))
        if month:
            start = _safe_date(year, month, d1)
            end = _safe_date(year, month, d2)
            if start and end:
                return start, end, "regex-range"

    # Single date
    m = SINGLE_DATE_RE.search(text)
    if m and m.group(3) == year_str:
        month = _month_num(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3))
        if month:
            d = _safe_date(year, month, day)
            if d:
                return d, d, "regex-single"

    return None, None, ""


def check_festival_dates(
    dry_run: bool = False,
    month_range: Optional[tuple[int, int]] = None,
    soon_only: bool = False,
    promote_pending: bool = False,
):
    client = get_client()

    if promote_pending:
        # Review pending_start rows: re-fetch and try to promote
        result = (
            client.table("festivals")
            .select("id,slug,name,website,typical_month,typical_duration_days,announced_start,pending_start,pending_end,date_confidence,date_source")
            .not_.is_("pending_start", "null")
            .not_.is_("website", "null")
            .order("typical_month")
            .execute()
        )
    else:
        # Get festivals missing announced_start that have websites
        result = (
            client.table("festivals")
            .select("id,slug,name,website,typical_month,typical_duration_days,announced_start,date_confidence,date_source")
            .is_("announced_start", "null")
            .not_.is_("website", "null")
            .order("typical_month")
            .execute()
        )
    festivals = result.data or []

    # Filter by month range
    if month_range:
        lo, hi = month_range
        festivals = [
            f for f in festivals
            if f.get("typical_month") and lo <= f["typical_month"] <= hi
        ]

    # Filter to "soon" — within 3 months
    if soon_only:
        now = datetime.now()
        cutoff_month = (now.month + 3 - 1) % 12 + 1
        cutoff_wraps = (now.month + 3) > 12
        festivals = [
            f for f in festivals
            if f.get("typical_month") and (
                (not cutoff_wraps and now.month <= f["typical_month"] <= cutoff_month)
                or (cutoff_wraps and (f["typical_month"] >= now.month or f["typical_month"] <= cutoff_month))
            )
        ]

    if not festivals:
        logger.info("No festivals to check.")
        return

    mode_label = "PROMOTE PENDING" if promote_pending else "CHECK MISSING"
    logger.info(f"Festival Date Checker — {mode_label}")
    logger.info(f"{'=' * 70}")
    logger.info(f"Checking {len(festivals)} festivals | Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"{'=' * 70}\n")

    found_count = 0
    promoted_count = 0
    pending_count = 0
    rejected_count = 0
    failed_count = 0

    for i, f in enumerate(festivals, 1):
        name = f["name"]
        website = f["website"]
        typical_month = f.get("typical_month")
        month = typical_month or "?"
        prefix = f"[{i:3d}/{len(festivals)}] {name[:40]:<40} (mo={month})"

        try:
            resp = requests.get(website, headers={"User-Agent": UA}, timeout=10, allow_redirects=True)
            html = resp.text
        except Exception as e:
            logger.info(f"{prefix}  ERR: {str(e)[:30]}")
            failed_count += 1
            time.sleep(0.5)
            continue

        start, end, method = extract_dates_from_html(html)

        if start and method:
            found_count += 1
            url_type = classify_url(website, f["slug"])
            extracted_month = int(start[5:7])
            confidence = compute_confidence(method, url_type, typical_month, extracted_month)

            existing_source = f.get("date_source")
            existing_confidence = f.get("date_confidence")

            if not should_update(existing_source, existing_confidence, method, confidence):
                logger.info(f"{prefix}  SKIP (existing {existing_source} c={existing_confidence})")
                time.sleep(0.5)
                continue

            # Validate dates before writing
            valid, start, end = validate_festival_dates(
                start, end,
                typical_month=typical_month,
                typical_duration_days=f.get("typical_duration_days"),
            )
            if not valid:
                rejected_count += 1
                logger.info(f"{prefix}  REJECTED: {start}")
                time.sleep(0.5)
                continue

            # Check month match for promotion decision
            months_ok = True
            if typical_month and extracted_month:
                diff = abs(typical_month - extracted_month)
                if diff > 6:
                    diff = 12 - diff
                months_ok = diff <= 1

            if confidence >= 70 and months_ok:
                promoted_count += 1
                logger.info(f"{prefix}  PROMOTED: {start} to {end}  ({method} c={confidence})")
                if not dry_run:
                    updates = {
                        "announced_start": start,
                        "date_confidence": confidence,
                        "date_source": method,
                    }
                    if end:
                        updates["announced_end"] = end
                    # Clear pending if promoting
                    if promote_pending:
                        updates["pending_start"] = None
                        updates["pending_end"] = None
                    client.table("festivals").update(updates).eq("id", f["id"]).execute()
            else:
                pending_count += 1
                logger.info(f"{prefix}  PENDING: {start} to {end}  ({method} c={confidence} {url_type})")
                if not dry_run:
                    updates = {
                        "pending_start": start,
                        "date_confidence": confidence,
                        "date_source": method,
                    }
                    if end:
                        updates["pending_end"] = end
                    client.table("festivals").update(updates).eq("id", f["id"]).execute()
        else:
            logger.info(f"{prefix}  --")

        time.sleep(0.5)

    logger.info(f"\n{'=' * 70}")
    logger.info(f"Checked: {len(festivals)} | Found: {found_count} | Promoted: {promoted_count} | Pending: {pending_count} | Rejected: {rejected_count} | Failed: {failed_count}")
    if dry_run:
        logger.info("DRY RUN — no changes written")


def main():
    parser = argparse.ArgumentParser(description="Check for newly announced festival dates")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--months", type=str, help="Month range, e.g. '1-4' for Jan-Apr")
    parser.add_argument("--soon", action="store_true", help="Only check festivals within 3 months")
    parser.add_argument("--promote-pending", action="store_true", help="Re-check pending_start rows and promote if confidence improves")
    args = parser.parse_args()

    month_range = None
    if args.months:
        parts = args.months.split("-")
        month_range = (int(parts[0]), int(parts[1]))

    check_festival_dates(
        dry_run=args.dry_run,
        month_range=month_range,
        soon_only=args.soon,
        promote_pending=args.promote_pending,
    )


if __name__ == "__main__":
    main()
