#!/usr/bin/env python3
"""Bounded venue-description pilot using prepare/extract/apply."""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup

from db import get_client
from description_quality import classify_description
from llm_client import generate_text
from pipeline.description_extract import extract_description_from_html
from pipeline.fetch import fetch_html
from pipeline.models import FetchConfig
from venue_description_metrics import (
    MIN_HEALTHY_DESCRIPTION_LENGTH,
    compute_venue_description_snapshot,
)
from scripts.venue_description_report import render_markdown
from venue_description_metrics import build_venue_description_gate

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

TASK_SCHEMA_VERSION = "venue_description_task_v1"
RESULT_SCHEMA_VERSION = "venue_description_result_v1"
DEFAULT_PREPARED_TEXT_LIMIT = 8000
MIN_SOURCE_TEXT_LENGTH = 120
REPORTS_DIR = Path(__file__).parent / "reports"
VENUE_DESCRIPTION_HISTORY_PATH = (
    REPORTS_DIR / "venue_description_cycle_history_latest.json"
)
VENUE_DESCRIPTION_REPORT_PATH = REPORTS_DIR / "venue_description_report_latest.md"
VENUE_DESCRIPTION_GATE_PATH = REPORTS_DIR / "venue_description_gate_latest.json"

VENUE_EXTRACTION_PROMPT = """Write a concise 2-3 sentence destination description grounded only in the provided source text.

Rules:
- Focus on what the place is, what kind of experience it offers, and any concrete atmosphere or format cues from the source.
- Do not invent neighborhoods, awards, menu items, ticketing, hours, pricing, or amenities not present in the source text.
- Do not add event schedules, showtimes, sales language, or calls to action.
- Return only the description text.
"""


def _normalize_text(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _iter_json_files(directory: Path, slug: Optional[str] = None) -> list[Path]:
    if slug:
        path = directory / f"{slug}.json"
        return [path] if path.exists() else []
    return sorted(directory.glob("*.json"))


def _normalize_generated_description(text: str) -> str:
    cleaned = _normalize_text(text.strip().strip('"').strip("'"))
    cleaned = re.sub(r"\s+([,.!?;:])", r"\1", cleaned)
    return cleaned


def _visible_text_from_html(
    html: str, max_chars: int = DEFAULT_PREPARED_TEXT_LIMIT
) -> str:
    soup = BeautifulSoup(html, "html.parser")
    container = soup.find("main") or soup.find("article") or soup.find("body") or soup
    chunks: list[str] = []
    total = 0
    noisy_fragments = (
        "all services",
        "citizen self service",
        "board of commissioners",
        "our brand",
        "living here",
        "news releases",
        "follow us",
        "employment",
        "frequently asked questions",
        "departmental phone listing",
        "subscribe to our email newsletters",
        "contact technical support",
    )
    for node in container.find_all(["p", "li"]):
        text = _normalize_text(node.get_text(" ", strip=True))
        if len(text) < 30:
            continue
        if classify_description(text) == "junk":
            continue
        lower = text.lower()
        if any(fragment in lower for fragment in noisy_fragments):
            continue
        chunks.append(text)
        total += len(text) + 1
        if total >= max_chars:
            break
    if chunks:
        return " ".join(chunks)[:max_chars]
    return _normalize_text(container.get_text(" ", strip=True))[:max_chars]


def _build_venue_source_text(
    html: str,
    *,
    max_chars: int = DEFAULT_PREPARED_TEXT_LIMIT,
) -> str:
    preferred = extract_description_from_html(html)
    visible = _visible_text_from_html(html, max_chars=max_chars)
    if preferred and preferred not in visible:
        return f"{preferred}\n\n{visible}"[:max_chars]
    return preferred[:max_chars] if preferred else visible[:max_chars]


def _description_has_noise(text: str) -> bool:
    lower = text.lower()
    noisy_patterns = (
        "buy tickets",
        "showtimes",
        "learn more",
        "visit the website",
        "for more information",
        "follow us",
        "click here",
        "call now",
        "book now",
    )
    if any(pattern in lower for pattern in noisy_patterns):
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
        "destination",
        "experience",
        "place",
        "venue",
        "space",
        "there",
        "these",
        "this",
        "through",
        "their",
        "while",
        "which",
        "with",
        "from",
        "into",
        "more",
        "than",
        "have",
        "that",
        "where",
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
    if len(description) < MIN_HEALTHY_DESCRIPTION_LENGTH:
        return False, "too_short"
    if classify_description(description) != "good":
        return False, "poor_quality"
    if _description_has_noise(description):
        return False, "contains_noise"
    if not passes_grounding_check(description, source_text):
        return False, "grounding_failed"
    return True, "ok"


def _fetch_candidate_places(
    *,
    slug: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    snapshot = compute_venue_description_snapshot()
    candidates = snapshot["issues"]["candidates"]
    if slug:
        candidates = [row for row in candidates if row["slug"] == slug]
    if limit:
        candidates = candidates[:limit]
    return candidates


def build_venue_task_payload(place: dict, page_text: str) -> dict:
    return {
        "schema_version": TASK_SCHEMA_VERSION,
        "entity_type": "place",
        "place_id": place["id"],
        "slug": place["slug"],
        "name": place["name"],
        "city": place.get("city"),
        "place_type": place.get("place_type"),
        "tier": place.get("tier_label"),
        "website": place["website"],
        "current_issue": place.get("issue_type"),
        "current_description": place.get("current_description"),
        "visible_text": page_text,
        "prepared_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
    }


def prepare_venue_tasks(
    *,
    slug: Optional[str] = None,
    limit: Optional[int] = None,
    render_js: bool = False,
    task_dir: Optional[Path] = None,
    return_details: bool = False,
) -> dict:
    places = _fetch_candidate_places(slug=slug, limit=limit)
    target_dir = task_dir or (Path(__file__).parent / "llm-tasks" / "venues")
    target_dir.mkdir(parents=True, exist_ok=True)
    fetch_cfg = FetchConfig(
        timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded"
    )

    stats = {"total": len(places), "written": 0, "failed": 0, "skipped": 0}
    details: list[dict] = []
    logger.info("Venue description task preparation")
    logger.info("=" * 70)
    logger.info("Candidates: %s", len(places))
    logger.info("Task directory: %s", target_dir)
    logger.info("=" * 70)

    for i, place in enumerate(places, 1):
        prefix = f"[{i:3d}/{len(places)}] {place['name'][:35]:<35}"
        html, err = fetch_html(place["website"], fetch_cfg)
        if (err or not html) and not render_js:
            html, err = fetch_html(
                place["website"],
                FetchConfig(
                    timeout_ms=20000, render_js=True, wait_until="domcontentloaded"
                ),
            )
        if err or not html:
            logger.info("%s FAIL (%s)", prefix, err or "empty")
            stats["failed"] += 1
            details.append(
                {"slug": place["slug"], "status": "failed", "reason": err or "empty"}
            )
            continue

        page_text = _build_venue_source_text(html)
        if len(page_text) < MIN_SOURCE_TEXT_LENGTH:
            logger.info("%s SKIP low-signal page text", prefix)
            stats["skipped"] += 1
            details.append(
                {
                    "slug": place["slug"],
                    "status": "skipped",
                    "reason": "low_signal_page_text",
                }
            )
            continue

        payload = build_venue_task_payload(place, page_text)
        task_path = target_dir / f"{place['slug']}.json"
        task_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        logger.info("%s wrote task (%s chars)", prefix, len(page_text))
        stats["written"] += 1
        details.append({"slug": place["slug"], "status": "written", "reason": "ok"})
        time.sleep(0.3)

    if return_details:
        return {**stats, "details": details}
    return stats


def extract_venue_tasks(
    *,
    slug: Optional[str] = None,
    task_dir: Optional[Path] = None,
    result_dir: Optional[Path] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
    return_details: bool = False,
) -> dict:
    source_dir = task_dir or (Path(__file__).parent / "llm-tasks" / "venues")
    target_dir = result_dir or (Path(__file__).parent / "llm-results" / "venues")
    target_dir.mkdir(parents=True, exist_ok=True)
    task_files = _iter_json_files(source_dir, slug=slug)

    stats = {"total": len(task_files), "written": 0, "failed": 0}
    details: list[dict] = []
    logger.info("Venue description task extraction")
    logger.info("=" * 70)
    logger.info("Task directory: %s", source_dir)
    logger.info("Result directory: %s", target_dir)
    logger.info("=" * 70)

    for i, task_path in enumerate(task_files, 1):
        task = json.loads(task_path.read_text(encoding="utf-8"))
        prefix = f"[{i:3d}/{len(task_files)}] {task['name'][:35]:<35}"
        prompt = f"Place name: {task['name']}\n" f"Source text:\n{task['visible_text']}"
        try:
            description = _normalize_generated_description(
                generate_text(
                    VENUE_EXTRACTION_PROMPT,
                    prompt,
                    provider_override=provider_override,
                    model_override=model_override,
                )
            )
        except Exception as exc:
            logger.info("%s FAIL (%s)", prefix, exc)
            stats["failed"] += 1
            details.append(
                {"slug": task["slug"], "status": "failed", "reason": str(exc)}
            )
            continue

        payload = {
            "schema_version": RESULT_SCHEMA_VERSION,
            "entity_type": "place",
            "place_id": task["place_id"],
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
        details.append({"slug": task["slug"], "status": "written", "reason": "ok"})

    if return_details:
        return {**stats, "details": details}
    return stats


def apply_venue_results(
    *,
    dry_run: bool = True,
    slug: Optional[str] = None,
    result_dir: Optional[Path] = None,
    return_details: bool = False,
) -> dict:
    source_dir = result_dir or (Path(__file__).parent / "llm-results" / "venues")
    result_files = _iter_json_files(source_dir, slug=slug)
    stats = {"total": len(result_files), "accepted": 0, "rejected": 0, "updated": 0}
    details: list[dict] = []
    client = None if dry_run else get_client()

    logger.info("Venue description result apply")
    logger.info("=" * 70)
    logger.info("Mode: %s", "DRY RUN" if dry_run else "LIVE")
    logger.info("Result directory: %s", source_dir)
    logger.info("=" * 70)

    for i, result_path in enumerate(result_files, 1):
        payload = json.loads(result_path.read_text(encoding="utf-8"))
        prefix = f"[{i:3d}/{len(result_files)}] {payload['name'][:35]:<35}"
        description = _normalize_generated_description(payload.get("description", ""))
        source_text = payload.get("source_text", "")
        passed, reason = _passes_description_quality(description, source_text)
        if not passed:
            logger.info("%s REJECT (%s)", prefix, reason)
            stats["rejected"] += 1
            details.append(
                {"slug": payload["slug"], "status": "rejected", "reason": reason}
            )
            continue

        stats["accepted"] += 1
        if not dry_run:
            client.table("places").update({"description": description}).eq(
                "id", payload["place_id"]
            ).execute()
            stats["updated"] += 1
            details.append(
                {"slug": payload["slug"], "status": "updated", "reason": "ok"}
            )
        else:
            details.append(
                {"slug": payload["slug"], "status": "accepted", "reason": "ok"}
            )
        logger.info("%s ACCEPT%s", prefix, "" if dry_run else " -> updated")

    if return_details:
        return {**stats, "details": details}
    return stats


def _load_venue_cycle_history(path: Path = VENUE_DESCRIPTION_HISTORY_PATH) -> dict:
    if not path.exists():
        return {"generated_at": None, "slugs": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"generated_at": None, "slugs": {}}


def _record_venue_cycle_history(
    *,
    slugs: list[str],
    prep_stats: dict[str, dict],
    dry_run_stats: dict,
    live_stats: Optional[dict],
    path: Path = VENUE_DESCRIPTION_HISTORY_PATH,
) -> dict:
    history = _load_venue_cycle_history(path)
    slug_history = history.setdefault("slugs", {})
    dry_run_details = {row["slug"]: row for row in dry_run_stats.get("details", [])}
    live_details = {row["slug"]: row for row in (live_stats or {}).get("details", [])}

    for slug in slugs:
        entry = slug_history.setdefault(
            slug,
            {
                "prep_fail_count": 0,
                "prep_skip_count": 0,
                "grounding_fail_count": 0,
                "history": [],
            },
        )
        prep = prep_stats.get(slug, {})
        prep_detail = next(iter(prep.get("details", [])), None)
        if prep_detail:
            entry["history"].append(
                {
                    "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                    "stage": "prepare",
                    "status": prep_detail["status"],
                    "reason": prep_detail["reason"],
                }
            )
            if prep_detail["status"] == "failed":
                entry["prep_fail_count"] += 1
            if (
                prep_detail["status"] == "skipped"
                and prep_detail["reason"] == "low_signal_page_text"
            ):
                entry["prep_skip_count"] += 1

        dry_detail = dry_run_details.get(slug)
        if dry_detail:
            entry["history"].append(
                {
                    "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                    "stage": "dry_run_apply",
                    "status": dry_detail["status"],
                    "reason": dry_detail["reason"],
                }
            )
            if dry_detail["reason"] == "grounding_failed":
                entry["grounding_fail_count"] += 1

        live_detail = live_details.get(slug)
        if live_detail:
            entry["history"].append(
                {
                    "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                    "stage": "live_apply",
                    "status": live_detail["status"],
                    "reason": live_detail["reason"],
                }
            )

    history["generated_at"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(history, indent=2), encoding="utf-8")
    return history


def regenerate_venue_artifacts() -> dict:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = compute_venue_description_snapshot()
    gate = build_venue_description_gate(snapshot)
    VENUE_DESCRIPTION_REPORT_PATH.write_text(
        render_markdown(snapshot), encoding="utf-8"
    )
    VENUE_DESCRIPTION_GATE_PATH.write_text(json.dumps(gate, indent=2), encoding="utf-8")
    return {"snapshot": snapshot, "gate": gate}


def run_venue_cycle(
    *,
    slugs: list[str],
    task_dir: Path,
    result_dir: Path,
    live: bool = False,
    render_js: bool = False,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> dict:
    """Run one bounded venue cycle end-to-end for an explicit slug list."""
    prep_stats: dict[str, dict] = {}
    prepared_slugs: list[str] = []

    for slug in slugs:
        stats = prepare_venue_tasks(
            slug=slug,
            render_js=render_js,
            task_dir=task_dir,
            return_details=True,
        )
        prep_stats[slug] = stats
        if stats.get("written"):
            prepared_slugs.append(slug)

    extract_stats = extract_venue_tasks(
        task_dir=task_dir,
        result_dir=result_dir,
        provider_override=provider_override,
        model_override=model_override,
        return_details=True,
    )
    dry_run_stats = apply_venue_results(
        dry_run=True, result_dir=result_dir, return_details=True
    )
    live_stats = None
    if live:
        live_stats = apply_venue_results(
            dry_run=False, result_dir=result_dir, return_details=True
        )
    history = _record_venue_cycle_history(
        slugs=slugs,
        prep_stats=prep_stats,
        dry_run_stats=dry_run_stats,
        live_stats=live_stats,
    )
    artifacts = regenerate_venue_artifacts()

    return {
        "requested_slugs": slugs,
        "prepared_slugs": prepared_slugs,
        "prep_stats": prep_stats,
        "extract_stats": extract_stats,
        "dry_run_stats": dry_run_stats,
        "live_stats": live_stats,
        "history_generated_at": history["generated_at"],
        "gate_decision": artifacts["gate"]["decision"],
        "pilot_candidate_count": artifacts["snapshot"]["counts"][
            "pilot_candidate_count"
        ],
        "monitor_only_count": artifacts["snapshot"]["counts"].get(
            "monitor_only_count", 0
        ),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bounded venue-description pilot")
    parser.add_argument("--slug", type=str, help="Restrict to a single place slug")
    parser.add_argument(
        "--slugs", type=str, help="Comma-separated slugs for one bounded cycle"
    )
    parser.add_argument("--limit", type=int, help="Max pilot candidates")
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview apply without writing"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Apply accepted results after a successful dry-run cycle",
    )
    parser.add_argument(
        "--render-js",
        action="store_true",
        help="Use Playwright for JS-heavy sites during task prep",
    )
    parser.add_argument(
        "--prepare-tasks", action="store_true", help="Write venue task files"
    )
    parser.add_argument(
        "--extract-tasks",
        action="store_true",
        help="Read task files and write result files",
    )
    parser.add_argument(
        "--apply-results",
        action="store_true",
        help="Read result files, quality-gate, and update places",
    )
    parser.add_argument(
        "--run-cycle",
        action="store_true",
        help="Run prepare, extract, dry-run apply, and optional live apply for explicit slugs",
    )
    parser.add_argument("--task-dir", type=Path, help="Override task directory")
    parser.add_argument("--result-dir", type=Path, help="Override result directory")
    parser.add_argument(
        "--provider", type=str, help="Override configured LLM provider for extraction"
    )
    parser.add_argument(
        "--model", type=str, help="Override configured LLM model for extraction"
    )
    args = parser.parse_args()

    if args.run_cycle:
        if not args.slugs:
            parser.error("--run-cycle requires --slugs")
        cycle_stats = run_venue_cycle(
            slugs=[slug.strip() for slug in args.slugs.split(",") if slug.strip()],
            task_dir=args.task_dir or (Path(__file__).parent / "llm-tasks" / "venues"),
            result_dir=args.result_dir
            or (Path(__file__).parent / "llm-results" / "venues"),
            live=args.live,
            render_js=args.render_js,
            provider_override=args.provider,
            model_override=args.model,
        )
        print(json.dumps(cycle_stats, indent=2))
    elif args.prepare_tasks:
        prepare_venue_tasks(
            slug=args.slug,
            limit=args.limit,
            render_js=args.render_js,
            task_dir=args.task_dir,
        )
    elif args.extract_tasks:
        extract_venue_tasks(
            slug=args.slug,
            task_dir=args.task_dir,
            result_dir=args.result_dir,
            provider_override=args.provider,
            model_override=args.model,
        )
    elif args.apply_results:
        apply_venue_results(
            dry_run=args.dry_run, slug=args.slug, result_dir=args.result_dir
        )
    else:
        parser.error(
            "Choose one of --run-cycle, --prepare-tasks, --extract-tasks, or --apply-results"
        )
