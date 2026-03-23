"""
Quick validation script for the new iClassPro + JackRabbit crawlers.
Verifies event generation counts WITHOUT writing to the database.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/test_new_studio_crawlers.py
"""

import sys
import os
import re
import requests
from datetime import date, datetime, timedelta
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sources"))

WEEKS_AHEAD = 12
today = date.today()
cutoff = today + timedelta(weeks=WEEKS_AHEAD)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
}


# ---------------------------------------------------------------------------
# JackRabbit helpers (inline to avoid DB import)
# ---------------------------------------------------------------------------

from bs4 import BeautifulSoup

_DAY_ABBREV_TO_PYTHON = {
    "mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4,
    "saturday": 5, "sunday": 6,
}


def jr_parse_date(raw: str) -> Optional[date]:
    if not raw or not raw.strip():
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def jr_next_occurrence(python_weekday: int, from_date: date) -> date:
    days_ahead = (python_weekday - from_date.weekday()) % 7
    return from_date + timedelta(days=days_ahead)


def jr_generate_dates(python_weekday: int, session_start: Optional[date],
                      session_end: Optional[date], weeks_ahead: int) -> list:
    from_date = max(today, session_start or today)
    cutoff_date = min(
        today + timedelta(weeks=weeks_ahead),
        session_end or (today + timedelta(weeks=weeks_ahead)),
    )
    dates = []
    occurrence = jr_next_occurrence(python_weekday, from_date)
    while occurrence <= cutoff_date:
        dates.append(occurrence)
        occurrence += timedelta(weeks=1)
    return dates


def jr_fetch_openings(org_id: str) -> list:
    url = f"https://app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS?OrgID={org_id}"
    resp = requests.get(url, headers=_HEADERS, timeout=20)
    resp.raise_for_status()
    content = resp.text
    parts = re.findall(r"document\.write\('(.*?)'\)", content, re.DOTALL)
    raw_html = parts[0].replace("\\'", "'").replace("\\\\", "\\") if parts else content
    soup = BeautifulSoup(raw_html, "html.parser")
    table = soup.find("table")
    if not table:
        return []
    thead = table.find("thead")
    header_row = thead.find("tr") if thead else None
    if header_row:
        headers = [th.get_text(strip=True).lower() for th in header_row.find_all(["th", "td"])]
    else:
        headers = ["register", "class", "description", "days", "times", "gender",
                   "ages", "openings", "class starts", "class ends", "session", "tuition"]
    col = {h: i for i, h in enumerate(headers)}
    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]
    classes = []
    for row in rows:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue
        def cell(key: str, fallback: str = "") -> str:
            idx = col.get(key)
            if idx is None or idx >= len(cells):
                return fallback
            return cells[idx].get_text(strip=True) if idx < len(cells) else fallback
        classes.append({
            "name": cell("class"),
            "description": cell("description"),
            "days": cell("days"),
            "times": cell("times"),
            "ages": cell("ages"),
            "start_date": cell("class starts"),
            "end_date": cell("class ends"),
            "tuition": cell("tuition"),
        })
    return classes


def test_jackrabbit(name: str, org_id: str) -> int:
    print(f"\n{'='*60}")
    print(f"  {name}  (JackRabbit org_id={org_id})")
    print(f"{'='*60}")
    classes = jr_fetch_openings(org_id)
    print(f"  Classes from OpeningsJS: {len(classes)}")

    total = 0
    skipped_past = skipped_no_day = skipped_no_occ = 0
    samples = []

    for cls in classes:
        days_str = cls.get("days", "").strip()
        wd = _DAY_ABBREV_TO_PYTHON.get(days_str.lower())
        if wd is None:
            skipped_no_day += 1
            continue
        s_end = jr_parse_date(cls.get("end_date", ""))
        if s_end and s_end < today:
            skipped_past += 1
            continue
        s_start = jr_parse_date(cls.get("start_date", ""))
        occ = jr_generate_dates(wd, s_start, s_end, WEEKS_AHEAD)
        if not occ:
            skipped_no_occ += 1
            continue
        total += len(occ)
        if len(samples) < 3:
            samples.append(
                f"    '{cls['name']}' | {days_str} {cls.get('times','')} | "
                f"ages={cls.get('ages','')} | {len(occ)} occurrences"
            )

    print(f"  Skipped — past end:     {skipped_past}")
    print(f"  Skipped — no day map:   {skipped_no_day}")
    print(f"  Skipped — no future:    {skipped_no_occ}")
    print(f"  Total occurrences:      {total}")
    for s in samples:
        print(s)
    return total


# ---------------------------------------------------------------------------
# iClassPro helpers (inline to avoid DB import)
# ---------------------------------------------------------------------------

_ICLASSPRO_API = "https://app.iclasspro.com/api/open/v1"
_DAY_NUMBER_TO_PYTHON = {1: 6, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5}


def icp_parse_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw[:10]).date()
    except (ValueError, TypeError):
        return None


def icp_fetch_classes(org_code: str) -> list:
    url = f"{_ICLASSPRO_API}/{org_code}/classes"
    resp = requests.get(url, headers=_HEADERS, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    return data.get("data", [])


def icp_generate_dates(schedule_items: list, start_raw: str, end_raw: str,
                       available_raw: list, weeks_ahead: int) -> list:
    """Return list of (date, sched_item) pairs."""
    start_d = icp_parse_date(start_raw)
    end_d = icp_parse_date(end_raw)
    cutoff_d = today + timedelta(weeks=weeks_ahead)

    # Use availableDates if present
    if available_raw:
        pairs = []
        for raw in available_raw:
            d = icp_parse_date(raw)
            if d and d >= today and d <= cutoff_d:
                sched = schedule_items[0] if schedule_items else {}
                pairs.append((d, sched))
        return pairs

    # Generate from day-of-week
    pairs = []
    for sched in schedule_items:
        day_num = sched.get("dayNumber")
        wd = _DAY_NUMBER_TO_PYTHON.get(day_num)
        if wd is None:
            continue
        from_d = max(today, start_d or today)
        cap = min(cutoff_d, end_d or cutoff_d)
        days_ahead = (wd - from_d.weekday()) % 7
        occurrence = from_d + timedelta(days=days_ahead)
        while occurrence <= cap:
            pairs.append((occurrence, sched))
            occurrence += timedelta(weeks=1)
    return pairs


def test_iclasspro(name: str, org_code: str) -> int:
    print(f"\n{'='*60}")
    print(f"  {name}  (iClassPro org_code={org_code})")
    print(f"{'='*60}")
    classes = icp_fetch_classes(org_code)
    print(f"  Classes from API: {len(classes)}")

    total = 0
    skipped_past = skipped_no_sched = skipped_no_occ = 0
    samples = []

    for cls in classes:
        sched_items = cls.get("schedule") or []
        if not sched_items:
            skipped_no_sched += 1
            continue
        end_d = icp_parse_date(cls.get("endDate", ""))
        if end_d and end_d < today:
            skipped_past += 1
            continue
        occ = icp_generate_dates(
            sched_items,
            cls.get("startDate", ""),
            cls.get("endDate", ""),
            cls.get("availableDates") or [],
            WEEKS_AHEAD,
        )
        if not occ:
            skipped_no_occ += 1
            continue
        total += len(occ)
        if len(samples) < 3:
            sched0 = sched_items[0]
            samples.append(
                f"    '{cls['name']}' | day={sched0.get('dayNumber')} "
                f"{sched0.get('startTime','')} | {len(occ)} occurrences"
            )

    print(f"  Skipped — past end:     {skipped_past}")
    print(f"  Skipped — no schedule:  {skipped_no_sched}")
    print(f"  Skipped — no future:    {skipped_no_occ}")
    print(f"  Total occurrences:      {total}")
    for s in samples:
        print(s)
    return total


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"\nStudio crawl validation — {today} through {cutoff} ({WEEKS_AHEAD} weeks)")

    results = {}
    results["Buckhead Gymnastics"] = test_iclasspro("Buckhead Gymnastics Center", "buckheadgymnastics")
    results["Georgia Gymnastics Academy"] = test_jackrabbit("Georgia Gymnastics Academy", "509235")
    results["Atlanta School of Gymnastics"] = test_jackrabbit("Atlanta School of Gymnastics", "549755")
    results["Gwinnett School of Dance"] = test_jackrabbit("Gwinnett School of Dance", "517929")

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    grand_total = 0
    for name, count in results.items():
        print(f"  {name:<35} {count:>5} occurrences")
        grand_total += count
    print(f"  {'TOTAL':<35} {grand_total:>5} occurrences")
    print()
