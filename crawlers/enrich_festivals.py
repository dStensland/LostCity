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
    python3 enrich_festivals.py --stale                # Re-enrich migration/low-confidence dates
    python3 enrich_festivals.py --render-js            # Playwright for JS-heavy sites
"""

import re
import sys
import time
import json
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
from festival_date_confidence import (
    classify_url,
    compute_confidence,
    should_update,
    validate_festival_dates,
)
from llm_client import generate_text
from pipeline.fetch import fetch_html
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig, FetchConfig

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

TASK_SCHEMA_VERSION = "festival_llm_task_v1"
RESULT_SCHEMA_VERSION = "festival_llm_result_v1"
DEFAULT_PREPARED_TEXT_LIMIT = 12000
MIN_DESCRIPTION_LENGTH = 80

FESTIVAL_EXTRACTION_PROMPT = """Write a concise 2-3 sentence festival description grounded only in the provided source text.

Rules:
- Focus on what the festival is, its atmosphere, and what attendees can expect.
- Do not invent facts, performers, neighborhoods, dates, times, prices, or ticketing details.
- Avoid marketing fluff and boilerplate.
- Return only the description text.
"""

# ---------------------------------------------------------------------------
# Date extraction — festival websites announce dates in varied formats
# ---------------------------------------------------------------------------

MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
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


def extract_festival_dates(
    html: str, default_year: int = 2026
) -> tuple[Optional[str], Optional[str], str]:
    """
    Extract start/end dates from festival HTML.

    Tries JSON-LD startDate/endDate first, then <time>/<meta>, then regex.
    Returns (start_date, end_date, method) where method is one of:
    'jsonld', 'time', 'meta', 'regex-cross', 'regex-range', 'regex-single', or ''.
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
                        valid_end = (
                            end_str
                            if re.match(r"\d{4}-\d{2}-\d{2}", end_str)
                            else start_str
                        )
                        return start_str, valid_end, "jsonld"
        except (json.JSONDecodeError, TypeError):
            continue

    # 2. <time> with datetime — collect ALL, use min/max for range
    time_dates = []
    for tag in soup.find_all("time"):
        dt = tag.get("datetime")
        if dt and len(dt) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", dt):
            time_dates.append(dt[:10])
    if time_dates:
        return min(time_dates), max(time_dates), "time"

    # 3. <meta> with date content — collect ALL, use min/max for range
    meta_dates = []
    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        if "date" in prop.lower() and meta.get("content"):
            content = meta["content"].strip()
            if len(content) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", content):
                meta_dates.append(content[:10])
    if meta_dates:
        return min(meta_dates), max(meta_dates), "meta"

    # 4. Regex on page text
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
                return start, end, "regex-cross"

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
                return start, end, "regex-range"

    # Single date
    m = SINGLE_DATE_RE.search(text)
    if m:
        month = _month_num(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3))
        if month:
            d = _safe_date(year, month, day)
            if d:
                return d, d, "regex-single"

    return None, None, ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_festival_description(
    html: str, website: str = "", fetch_cfg=None
) -> Optional[str]:
    """Extract the best available description from festival HTML.

    Tries multiple strategies in order of quality:
    1. JSON-LD description (often the longest/most complete)
    2. og:description / meta description
    3. Main content area paragraphs (combined for richer descriptions)
    4. About page fallback (fetches /about if main page yielded nothing)
    """
    from bs4 import BeautifulSoup
    import json as _json

    soup = BeautifulSoup(html, "html.parser")
    best: Optional[str] = None
    best_len = 0

    # Strategy 1: JSON-LD description (often the most complete)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = _json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                desc = item.get("description", "")
                if isinstance(desc, str) and len(desc.strip()) > best_len:
                    candidate = re.sub(r"\s+", " ", desc).strip()
                    if len(candidate) >= 30:
                        best = candidate
                        best_len = len(candidate)
        except (ValueError, TypeError, AttributeError):
            continue

    # Strategy 2: Meta tags (og, standard, twitter)
    for tag_name in ["og:description", "description", "twitter:description"]:
        meta_tag = soup.find("meta", attrs={"property": tag_name}) or soup.find(
            "meta", attrs={"name": tag_name}
        )
        if meta_tag and meta_tag.get("content", "").strip():
            candidate = meta_tag["content"].strip()
            if len(candidate) >= 30 and len(candidate) > best_len:
                best = candidate
                best_len = len(candidate)

    # Strategy 3: Combine main content paragraphs for a richer description
    main = _find_main_content(soup)
    if main:
        paragraphs = []
        for p in main.find_all("p"):
            text = re.sub(r"\s+", " ", p.get_text()).strip()
            if len(text) >= 30 and not _is_boilerplate(text):
                paragraphs.append(text)
        if paragraphs:
            combined = " ".join(paragraphs)[:2000]
            if len(combined) > best_len:
                best = combined
                best_len = len(combined)

    # Strategy 4: Try /about page if we got nothing useful from the main page
    if best_len < 80 and website and fetch_cfg:
        about_url = _build_about_url(website)
        if about_url:
            try:
                about_html, about_err = fetch_html(about_url, fetch_cfg)
                if about_html and not about_err:
                    about_soup = BeautifulSoup(about_html, "html.parser")
                    about_main = _find_main_content(about_soup) or about_soup.find(
                        "body"
                    )
                    if about_main:
                        paras = []
                        for p in about_main.find_all("p"):
                            text = re.sub(r"\s+", " ", p.get_text()).strip()
                            if len(text) >= 30 and not _is_boilerplate(text):
                                paras.append(text)
                        if paras:
                            combined = " ".join(paras)[:2000]
                            if len(combined) > best_len:
                                best = combined
                                best_len = len(combined)
            except Exception:
                pass  # Never block enrichment on about page fetch

    return best


def _find_main_content(soup):
    """Return the most likely main content container for a festival page."""
    return soup.find("main") or soup.find("article") or soup.select_one("[role='main']")


def _build_about_url(website: str) -> Optional[str]:
    """Build an /about URL from a festival website."""
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(website)
    if not parsed.scheme or not parsed.netloc:
        return None
    # Try /about path
    return urlunparse((parsed.scheme, parsed.netloc, "/about", "", "", ""))


# Non-Atlanta location signals — prevent enriching festivals from other cities
NON_ATLANTA_SIGNALS = re.compile(
    r"\b(?:Nashville|Charlotte|Birmingham|Jacksonville|Chattanooga|Greenville|Columbia|Raleigh|Memphis|Knoxville)"
    r",?\s*(?:TN|NC|AL|FL|SC)"
    r"|\bBridgestone Arena\b|\bNissan Stadium\b|\bRyman Auditorium\b",
    re.IGNORECASE,
)


def _check_non_local(html: str, description: Optional[str] = None) -> Optional[str]:
    """Check if festival page indicates a non-Atlanta location.

    Returns the matched signal string if non-local, None if OK.
    """
    import json as _json
    from bs4 import BeautifulSoup

    # Check description text
    if description:
        m = NON_ATLANTA_SIGNALS.search(description)
        if m:
            return m.group(0)

    soup = BeautifulSoup(html, "html.parser")

    # Check JSON-LD location.address for non-GA state
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = _json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                loc = item.get("location", {})
                if isinstance(loc, dict):
                    addr = loc.get("address", {})
                    if isinstance(addr, dict):
                        state = addr.get("addressRegion", "")
                        if state and state.upper() not in ("GA", "GEORGIA"):
                            return f"JSON-LD state: {state}"
                    elif isinstance(addr, str):
                        m = NON_ATLANTA_SIGNALS.search(addr)
                        if m:
                            return m.group(0)
        except (ValueError, TypeError):
            continue

    # Check page text (limited to first 5000 chars to avoid false positives in footer links)
    page_text = soup.get_text(" ", strip=True)[:5000]
    m = NON_ATLANTA_SIGNALS.search(page_text)
    if m:
        return m.group(0)

    return None


BOILERPLATE_RE = re.compile(
    r"\b(?:"
    r"cookie|cookies|privacy policy|submission guidelines|accept all|powered by|"
    r"all rights reserved|contact us|newsletter|skip to content|"
    r"terms of service|consent preferences|personalized ads"
    r")\b",
    re.IGNORECASE,
)


def _check_redirect(url: str) -> Optional[str]:
    """Return final URL if it differs from input (permanent redirect)."""
    import httpx

    try:
        with httpx.Client(follow_redirects=True, timeout=10) as c:
            resp = c.head(url)
            final = str(resp.url)
            if final.rstrip("/") != url.rstrip("/"):
                return final
    except Exception:
        pass
    return None


def _is_boilerplate(text: str) -> bool:
    """Quick check if text is nav/footer boilerplate."""
    lower = text.lower()
    markers = [
        "skip to content",
        "cookie",
        "privacy policy",
        "terms of",
        "all rights reserved",
        "powered by",
        "javascript",
        "loading",
        "subscribe",
        "newsletter",
        "follow us",
        "copyright",
    ]
    return any(lower.startswith(m) for m in markers) or bool(
        BOILERPLATE_RE.search(text)
    )


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def extract_visible_text(
    html: str, max_chars: int = DEFAULT_PREPARED_TEXT_LIMIT
) -> str:
    """Extract visible festival page text for LLM task preparation."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()

    container = _find_main_content(soup) or soup.find("body") or soup
    chunks: list[str] = []
    seen: set[str] = set()

    for node in container.find_all(["h1", "h2", "h3", "p", "li"]):
        text = _normalize_text(node.get_text(" ", strip=True))
        if len(text) < 20 or _is_boilerplate(text):
            continue
        if text in seen:
            continue
        seen.add(text)
        chunks.append(text)

    if not chunks:
        fallback = _normalize_text(container.get_text(" ", strip=True))
        return fallback[:max_chars]

    return " ".join(chunks)[:max_chars]


def _looks_schedule_heavy(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False

    time_matches = len(
        re.findall(r"\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b", normalized, re.IGNORECASE)
    )
    short_line_count = sum(
        1
        for chunk in re.split(r"(?<=[.!?])\s+|\s{2,}", normalized)
        if 8 <= len(chunk) <= 80
    )
    lineup_markers = (
        "sold out",
        "doors",
        "registration opens",
        "friday",
        "saturday",
        "sunday",
    )
    marker_hits = sum(1 for marker in lineup_markers if marker in normalized.lower())

    return time_matches >= 2 or (short_line_count >= 6 and marker_hits >= 1)


def _build_festival_source_text(
    html: str,
    website: str,
    fetch_cfg: FetchConfig,
    current_description: Optional[str] = None,
    max_chars: int = DEFAULT_PREPARED_TEXT_LIMIT,
) -> str:
    """Prefer clean source-grounded copy before falling back to page text."""
    extracted_description = _extract_festival_description(html, website, fetch_cfg)
    current = _normalize_text(current_description or "")
    if extracted_description and len(extracted_description) >= MIN_DESCRIPTION_LENGTH:
        if (
            current
            and len(current) >= MIN_DESCRIPTION_LENGTH
            and _looks_schedule_heavy(extracted_description)
            and current.lower() not in extracted_description.lower()
        ):
            return f"{current}\n\n{extracted_description}"[:max_chars]
        return extracted_description[:max_chars]

    visible_text = extract_visible_text(html, max_chars=max_chars)

    # Schedule-heavy pages often expose only lineup text. Carry forward an
    # existing grounded festival description so the LLM can stay anchored.
    if (
        current
        and len(current) >= MIN_DESCRIPTION_LENGTH
        and _looks_schedule_heavy(visible_text)
        and current.lower() not in visible_text.lower()
    ):
        return f"{current}\n\n{visible_text}"[:max_chars]

    return visible_text


def _festival_needs_description_task(
    festival: dict,
    min_description_length: int = MIN_DESCRIPTION_LENGTH,
) -> bool:
    description = _normalize_text(str(festival.get("description") or ""))
    return len(description) < min_description_length


def build_festival_task_payload(festival: dict, page_text: str) -> dict:
    return {
        "schema_version": TASK_SCHEMA_VERSION,
        "entity_type": "festival",
        "festival_id": festival["id"],
        "slug": festival["slug"],
        "name": festival["name"],
        "website": festival["website"],
        "current_description": festival.get("description"),
        "announced_start": festival.get("announced_start"),
        "announced_end": festival.get("announced_end"),
        "visible_text": page_text,
        "prepared_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def _iter_json_files(directory: Path, slug: Optional[str] = None) -> list[Path]:
    if slug:
        path = directory / f"{slug}.json"
        return [path] if path.exists() else []
    return sorted(directory.glob("*.json"))


def _normalize_generated_description(text: str) -> str:
    cleaned = _normalize_text(text.strip().strip('"').strip("'"))
    cleaned = re.sub(r"\s+([,.!?;:])", r"\1", cleaned)
    return cleaned


def _description_has_noise(text: str) -> bool:
    lower = text.lower()
    noisy_patterns = (
        "buy tickets",
        "tickets available",
        "learn more",
        "visit the website",
        "for more information",
        "follow us",
        "doors open",
        "parking",
    )
    if any(pattern in lower for pattern in noisy_patterns):
        return True

    if re.search(
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b",
        lower,
    ):
        return True
    if re.search(r"\b\d{1,2}:\d{2}\s*(?:am|pm)\b", lower):
        return True
    return False


def passes_grounding_check(description: str, source_text: str) -> bool:
    stopwords = {
        "about",
        "after",
        "again",
        "along",
        "also",
        "around",
        "because",
        "being",
        "event",
        "festival",
        "from",
        "into",
        "over",
        "that",
        "their",
        "there",
        "these",
        "this",
        "through",
        "what",
        "with",
        "will",
        "your",
        "more",
        "than",
        "have",
        "into",
        "while",
        "where",
        "which",
    }

    def _tokens(value: str) -> list[str]:
        return [
            token
            for token in re.findall(r"[a-z0-9']+", value.lower())
            if len(token) >= 4 and token not in stopwords
        ]

    desc_tokens = _tokens(description)
    if len(desc_tokens) < 4:
        return False

    source_token_set = set(_tokens(source_text))
    overlap = [token for token in desc_tokens if token in source_token_set]
    required = max(3, len(set(desc_tokens)) // 3)
    return len(set(overlap)) >= required


def _passes_description_quality(description: str, source_text: str) -> tuple[bool, str]:
    if len(description) < MIN_DESCRIPTION_LENGTH:
        return False, "too_short"
    if _description_has_noise(description):
        return False, "contains_noise"
    if not passes_grounding_check(description, source_text):
        return False, "grounding_failed"
    return True, "ok"


def _fetch_festivals_needing_descriptions(
    client,
    slug: Optional[str] = None,
    limit: Optional[int] = None,
    min_description_length: int = MIN_DESCRIPTION_LENGTH,
) -> list[dict]:
    query = (
        client.table("festivals")
        .select("id,slug,name,website,description,announced_start,announced_end")
        .not_.is_("website", "null")
        .order("name")
    )
    if slug:
        query = query.eq("slug", slug)
    if limit:
        query = query.limit(limit)
    rows = query.execute().data or []
    return [
        row
        for row in rows
        if _festival_needs_description_task(
            row,
            min_description_length=min_description_length,
        )
    ]


def prepare_festival_tasks(
    slug: Optional[str] = None,
    limit: Optional[int] = None,
    render_js: bool = False,
    task_dir: Optional[Path] = None,
    min_description_length: int = MIN_DESCRIPTION_LENGTH,
) -> dict:
    """Fetch festival pages and write task payloads for later LLM extraction."""
    client = get_client()
    festivals = _fetch_festivals_needing_descriptions(
        client,
        slug=slug,
        limit=limit,
        min_description_length=min_description_length,
    )
    target_dir = task_dir or (Path(__file__).parent / "llm-tasks" / "festivals")
    target_dir.mkdir(parents=True, exist_ok=True)

    fetch_cfg = FetchConfig(
        timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded"
    )
    stats = {"total": len(festivals), "written": 0, "failed": 0, "skipped": 0}

    logger.info("Festival LLM task preparation")
    logger.info("=" * 70)
    logger.info("Festivals needing task prep: %s", len(festivals))
    logger.info("Task directory: %s", target_dir)
    logger.info("=" * 70)

    for i, festival in enumerate(festivals, 1):
        prefix = f"[{i:3d}/{len(festivals)}] {festival['name'][:35]:<35}"
        html, err = fetch_html(festival["website"], fetch_cfg)
        if (err or not html) and not render_js:
            html, err = fetch_html(
                festival["website"],
                FetchConfig(
                    timeout_ms=20000, render_js=True, wait_until="domcontentloaded"
                ),
            )
        if err or not html:
            logger.info("%s FAIL (%s)", prefix, err or "empty")
            stats["failed"] += 1
            continue

        page_text = _build_festival_source_text(
            html,
            festival["website"],
            fetch_cfg,
            current_description=festival.get("description"),
        )
        min_signal_length = MIN_DESCRIPTION_LENGTH if page_text else 120
        if len(page_text) < min_signal_length:
            logger.info("%s SKIP low-signal page text", prefix)
            stats["skipped"] += 1
            continue

        payload = build_festival_task_payload(festival, page_text)
        task_path = target_dir / f"{festival['slug']}.json"
        task_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        logger.info("%s wrote task (%s chars)", prefix, len(page_text))
        stats["written"] += 1
        time.sleep(0.5)

    logger.info("\n%s", "=" * 70)
    logger.info("TASK PREP RESULTS")
    logger.info("%s", "=" * 70)
    logger.info("Processed: %s", stats["total"])
    logger.info("Written:   %s", stats["written"])
    logger.info("Skipped:   %s", stats["skipped"])
    logger.info("Failed:    %s", stats["failed"])
    return stats


def extract_festival_tasks(
    slug: Optional[str] = None,
    task_dir: Optional[Path] = None,
    result_dir: Optional[Path] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> dict:
    """Read prepared festival tasks, call the LLM, and write result payloads."""
    source_dir = task_dir or (Path(__file__).parent / "llm-tasks" / "festivals")
    target_dir = result_dir or (Path(__file__).parent / "llm-results" / "festivals")
    target_dir.mkdir(parents=True, exist_ok=True)
    task_files = _iter_json_files(source_dir, slug=slug)

    stats = {"total": len(task_files), "written": 0, "failed": 0}
    logger.info("Festival LLM task extraction")
    logger.info("=" * 70)
    logger.info("Task directory: %s", source_dir)
    logger.info("Result directory: %s", target_dir)
    logger.info("=" * 70)

    for i, task_path in enumerate(task_files, 1):
        task = json.loads(task_path.read_text(encoding="utf-8"))
        prefix = f"[{i:3d}/{len(task_files)}] {task['name'][:35]:<35}"
        prompt = (
            f"Festival name: {task['name']}\n"
            f"Website: {task['website']}\n"
            f"Source text:\n{task['visible_text']}"
        )
        try:
            description = _normalize_generated_description(
                generate_text(
                    FESTIVAL_EXTRACTION_PROMPT,
                    prompt,
                    provider_override=provider_override,
                    model_override=model_override,
                )
            )
        except Exception as exc:
            logger.info("%s FAIL (%s)", prefix, exc)
            stats["failed"] += 1
            continue

        payload = {
            "schema_version": RESULT_SCHEMA_VERSION,
            "entity_type": "festival",
            "festival_id": task["festival_id"],
            "slug": task["slug"],
            "name": task["name"],
            "website": task["website"],
            "description": description,
            "source_text": task["visible_text"],
            "extracted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        result_path = target_dir / f"{task['slug']}.json"
        result_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        logger.info("%s wrote result (%s chars)", prefix, len(description))
        stats["written"] += 1

    logger.info("\n%s", "=" * 70)
    logger.info("TASK EXTRACTION RESULTS")
    logger.info("%s", "=" * 70)
    logger.info("Processed: %s", stats["total"])
    logger.info("Written:   %s", stats["written"])
    logger.info("Failed:    %s", stats["failed"])
    return stats


def apply_festival_results(
    dry_run: bool = True,
    slug: Optional[str] = None,
    result_dir: Optional[Path] = None,
) -> dict:
    """Read festival LLM result files, quality-gate, and apply description updates."""
    source_dir = result_dir or (Path(__file__).parent / "llm-results" / "festivals")
    result_files = _iter_json_files(source_dir, slug=slug)
    stats = {"total": len(result_files), "accepted": 0, "rejected": 0, "updated": 0}

    logger.info("Festival LLM result apply")
    logger.info("=" * 70)
    logger.info("Mode: %s", "DRY RUN" if dry_run else "LIVE")
    logger.info("Result directory: %s", source_dir)
    logger.info("=" * 70)

    client = None if dry_run else get_client()

    for i, result_path in enumerate(result_files, 1):
        payload = json.loads(result_path.read_text(encoding="utf-8"))
        prefix = f"[{i:3d}/{len(result_files)}] {payload['name'][:35]:<35}"
        description = _normalize_generated_description(payload.get("description", ""))
        source_text = payload.get("source_text", "")

        passed, reason = _passes_description_quality(description, source_text)
        if not passed:
            logger.info("%s REJECT (%s)", prefix, reason)
            stats["rejected"] += 1
            continue

        stats["accepted"] += 1
        if not dry_run:
            client.table("festivals").update({"description": description}).eq(
                "id", payload["festival_id"]
            ).execute()
            stats["updated"] += 1
        logger.info("%s ACCEPT%s", prefix, "" if dry_run else " -> updated")

    logger.info("\n%s", "=" * 70)
    logger.info("RESULT APPLY")
    logger.info("%s", "=" * 70)
    logger.info("Processed: %s", stats["total"])
    logger.info("Accepted:  %s", stats["accepted"])
    logger.info("Rejected:  %s", stats["rejected"])
    logger.info("Updated:   %s", stats["updated"])
    if dry_run:
        logger.info("DRY RUN — no changes written to database")
    return stats


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def enrich_festivals(
    dry_run: bool = False,
    slug: Optional[str] = None,
    force: bool = False,
    stale: bool = False,
    render_js: bool = False,
):
    client = get_client()

    # Query all festivals with websites
    query = (
        client.table("festivals")
        .select(
            "id,slug,name,website,description,image_url,ticket_url,announced_start,announced_end,typical_month,typical_duration_days,date_confidence,date_source,pending_start,pending_end"
        )
        .not_.is_("website", "null")
    )
    if slug:
        query = query.eq("slug", slug)

    result = query.order("name").execute()
    all_festivals = result.data or []

    if stale:
        # Re-enrich festivals with stale or low-confidence date data
        festivals = [
            f
            for f in all_festivals
            if f.get("date_source") == "migration"
            or (f.get("date_confidence") or 0) < 70
            or (
                f.get("announced_start") == f.get("announced_end")
                and (f.get("typical_duration_days") or 1) > 1
            )
        ]
    elif not force:
        # Filter to those missing at least one field
        festivals = [
            f
            for f in all_festivals
            if not f.get("image_url")
            or not f.get("ticket_url")
            or not f.get("announced_start")
            or not f.get("description")
        ]
    else:
        festivals = all_festivals

    stats = {
        "total": len(festivals),
        "description": 0,
        "image": 0,
        "ticket": 0,
        "dates": 0,
        "js_retry": 0,
        "failed": 0,
        "skipped": 0,
    }

    fetch_cfg = FetchConfig(
        timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded"
    )
    detail_cfg = DetailConfig(
        use_jsonld=True,
        use_open_graph=True,
        use_heuristic=True,
        use_llm=True,  # Enable LLM fallback for description extraction
    )

    logger.info(f"Festival Enrichment Pipeline")
    logger.info(f"{'=' * 70}")
    logger.info(
        f"Total with website: {len(all_festivals)} | To enrich: {len(festivals)}"
    )
    mode = "DRY RUN" if dry_run else "STALE" if stale else "LIVE"
    logger.info(f"Mode: {mode} | Force: {force} | Render JS: {render_js}")
    logger.info(f"{'=' * 70}")

    for i, f in enumerate(festivals, 1):
        name = f["name"]
        website = f["website"]

        prefix = f"[{i:3d}/{len(festivals)}] {name[:35]:<35}"

        # Check for permanent redirects and update stored URL
        redirected = _check_redirect(website)
        if redirected:
            logger.info(f"{prefix} URL redirect: {website} → {redirected}")
            if not dry_run:
                client.table("festivals").update({"website": redirected}).eq(
                    "id", f["id"]
                ).execute()
            website = redirected

        # Fetch HTML
        used_js = render_js
        html, err = fetch_html(website, fetch_cfg)
        if err or not html:
            # Retry with Playwright if initial fetch failed and not already using it
            if not render_js:
                html, err = fetch_html(
                    website,
                    FetchConfig(
                        timeout_ms=20000, render_js=True, wait_until="domcontentloaded"
                    ),
                )
                used_js = True
            if err or not html:
                logger.info(f"{prefix} FAIL ({err or 'empty'})")
                stats["failed"] += 1
                time.sleep(0.5)
                continue

        # Run extraction stack
        enriched = enrich_from_detail(html, website, f["slug"], detail_cfg)
        start_date, end_date, method = extract_festival_dates(html)
        meta_desc = _extract_festival_description(html, website, fetch_cfg)

        # Smart JS retry: if plain fetch yielded no useful data, retry with Playwright
        has_useful = (
            enriched.get("description")
            or meta_desc
            or enriched.get("image_url")
            or enriched.get("ticket_url")
            or start_date
        )
        if not has_useful and not used_js:
            logger.info(f"{prefix} no data from plain fetch, retrying with JS...")
            html_js, err_js = fetch_html(
                website,
                FetchConfig(
                    timeout_ms=20000, render_js=True, wait_until="domcontentloaded"
                ),
            )
            if html_js and not err_js:
                html = html_js
                enriched = enrich_from_detail(html, website, f["slug"], detail_cfg)
                start_date, end_date, method = extract_festival_dates(html)
                meta_desc = _extract_festival_description(html, website, fetch_cfg)
                used_js = True
                stats["js_retry"] += 1

        # Geographic gate — skip non-Atlanta festivals
        desc_for_check = enriched.get("description") or meta_desc
        non_local = _check_non_local(html, desc_for_check)
        if non_local:
            logger.info(f"{prefix} SKIP non-local: {non_local}")
            stats["skipped"] += 1
            time.sleep(0.5)
            continue

        # Build update dict — only fill NULL fields (unless --force)
        updates: dict = {}
        markers: list[str] = []

        # Description
        desc = enriched.get("description") or meta_desc
        if desc and len(str(desc)) >= 30 and (force or not f.get("description")):
            updates["description"] = str(desc)[:2000]
            markers.append("desc \u2713")
            stats["description"] += 1
        else:
            markers.append("desc \u2717")

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

        # Dates — validate then confidence-based staging
        if start_date and method:
            valid, start_date, end_date = validate_festival_dates(
                start_date,
                end_date,
                typical_month=f.get("typical_month"),
                typical_duration_days=f.get("typical_duration_days"),
            )
            if not valid:
                markers.append(f"dates rejected ({start_date})")
                start_date = None  # prevent further date processing
                method = ""  # prevent fallthrough to "dates ✗"

        if start_date and method:
            url_type = classify_url(website, f["slug"])
            extracted_month = int(start_date[5:7])
            typical_month = f.get("typical_month")
            confidence = compute_confidence(
                method, url_type, typical_month, extracted_month
            )

            existing_source = f.get("date_source")
            existing_confidence = f.get("date_confidence")

            if should_update(existing_source, existing_confidence, method, confidence):
                updates["date_confidence"] = confidence
                updates["date_source"] = method

                # High confidence + month match → promote to announced
                months_ok = True
                if typical_month and extracted_month:
                    diff = abs(typical_month - extracted_month)
                    if diff > 6:
                        diff = 12 - diff
                    months_ok = diff <= 1

                if confidence >= 70 and months_ok:
                    updates["announced_start"] = start_date
                    if end_date:
                        updates["announced_end"] = end_date
                    markers.append(f"dates \u2713 ({method} c={confidence})")
                else:
                    updates["pending_start"] = start_date
                    if end_date:
                        updates["pending_end"] = end_date
                    markers.append(
                        f"dates pending ({method} c={confidence} {url_type})"
                    )
                stats["dates"] += 1
            else:
                markers.append(
                    f"dates skip (existing {existing_source} c={existing_confidence})"
                )
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
    logger.info(f"Descriptions: {stats['description']}")
    logger.info(f"Images:     {stats['image']}")
    logger.info(f"Tickets:    {stats['ticket']}")
    logger.info(f"Dates:      {stats['dates']}")
    logger.info(f"JS retries: {stats['js_retry']}")
    logger.info(f"Failed:     {stats['failed']}")
    logger.info(f"Skipped:    {stats['skipped']} (already complete)")
    if dry_run:
        logger.info(f"\nDRY RUN — no changes written to database")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich festivals from their websites")
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without writing"
    )
    parser.add_argument("--slug", type=str, help="Enrich a single festival by slug")
    parser.add_argument(
        "--limit", type=int, help="Max festivals to prepare for LLM tasks"
    )
    parser.add_argument(
        "--min-description-length",
        type=int,
        default=MIN_DESCRIPTION_LENGTH,
        help="Treat festival descriptions shorter than this as candidates for task prep",
    )
    parser.add_argument(
        "--force", action="store_true", help="Re-enrich even if fields populated"
    )
    parser.add_argument(
        "--stale",
        action="store_true",
        help="Re-enrich stale/low-confidence data (migration source, low confidence, wrong duration)",
    )
    parser.add_argument(
        "--render-js", action="store_true", help="Use Playwright for JS-heavy sites"
    )
    parser.add_argument(
        "--prepare-tasks", action="store_true", help="Write festival LLM task files"
    )
    parser.add_argument(
        "--extract-tasks",
        action="store_true",
        help="Read task files, call the LLM, and write result files",
    )
    parser.add_argument(
        "--apply-results",
        action="store_true",
        help="Read result files, quality-gate, and update festival descriptions",
    )
    parser.add_argument(
        "--provider", type=str, help="Override configured LLM provider for extraction"
    )
    parser.add_argument(
        "--model", type=str, help="Override configured LLM model for extraction"
    )
    args = parser.parse_args()

    if args.prepare_tasks:
        prepare_festival_tasks(
            slug=args.slug,
            limit=args.limit,
            render_js=args.render_js,
            min_description_length=args.min_description_length,
        )
    elif args.extract_tasks:
        extract_festival_tasks(
            slug=args.slug,
            provider_override=args.provider,
            model_override=args.model,
        )
    elif args.apply_results:
        apply_festival_results(
            dry_run=args.dry_run,
            slug=args.slug,
        )
    else:
        enrich_festivals(
            dry_run=args.dry_run,
            slug=args.slug,
            force=args.force,
            stale=args.stale,
            render_js=args.render_js,
        )
