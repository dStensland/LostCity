#!/usr/bin/env python3
"""
Benchmark festival schedule extraction quality across LLM providers.

Usage:
  python3 scripts/festival_extraction_benchmark.py
  python3 scripts/festival_extraction_benchmark.py --providers openai,anthropic
  python3 scripts/festival_extraction_benchmark.py --update-overrides
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crawl_festival_schedule import (
    _apply_llm_quality_gate,
    _extract_sessions_llm_with_provider,
    _is_generic_title,
    _is_unknown_venue,
    _parse_session_date,
    extract_sessions_html_table,
    extract_sessions_jsonld,
    extract_sessions_wp_events_calendar,
    fetch_html,
)

DEFAULT_EVAL_SET = Path(__file__).resolve().parents[1] / "config" / "festival_extraction_eval_set.json"
DEFAULT_OVERRIDES = Path(__file__).resolve().parents[1] / "config" / "festival_llm_provider_overrides.json"


@dataclass
class ProviderScore:
    provider: str
    total: int
    timed: int
    with_image: int
    unknown_venue: int
    past_date: int
    generic_title: int
    accepted: int
    score: float
    meets_threshold: bool
    gate_reasons: list[str]


def _load_eval_cases(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text())
    cases = payload.get("cases", [])
    if not isinstance(cases, list):
        return []
    return [case for case in cases if isinstance(case, dict)]


def _score_provider(
    provider_name: str,
    festival_name: str,
    sessions,
    min_sessions: int,
    min_timed: int,
) -> ProviderScore:
    timed = sum(1 for session in sessions if session.start_time)
    with_image = sum(1 for session in sessions if session.image_url)
    unknown_venue = sum(1 for session in sessions if _is_unknown_venue(session.venue_name))
    past_date = sum(
        1 for session in sessions
        if (parsed := _parse_session_date(session.start_date)) is None or parsed < date.today()
    )
    generic_title = sum(1 for session in sessions if _is_generic_title(session.title, festival_name))

    accepted, gate_reasons = _apply_llm_quality_gate(list(sessions), festival_name)
    accepted_count = len(accepted)

    meets_threshold = accepted_count >= min_sessions and timed >= min_timed
    # Weighted for practical ingestion value: count and timing quality first; penalize stale/generic sessions.
    score = (
        accepted_count * 2.0
        + timed * 1.0
        + with_image * 0.2
        - unknown_venue * 0.6
        - past_date * 2.5
        - generic_title * 0.8
    )
    if accepted_count == 0:
        score -= 5.0

    return ProviderScore(
        provider=provider_name,
        total=len(sessions),
        timed=timed,
        with_image=with_image,
        unknown_venue=unknown_venue,
        past_date=past_date,
        generic_title=generic_title,
        accepted=accepted_count,
        score=score,
        meets_threshold=meets_threshold,
        gate_reasons=gate_reasons,
    )


def _evaluate_case(case: dict[str, Any], providers: list[str]) -> tuple[str, dict[str, ProviderScore], str]:
    slug = str(case.get("slug", "")).strip()
    name = str(case.get("name", slug)).strip() or slug
    url = str(case.get("url", "")).strip()
    min_sessions = int(case.get("expected_min_sessions", 1) or 1)
    min_timed = int(case.get("expected_min_timed_sessions", 0) or 0)

    html = fetch_html(url, render_js=False)

    structured_counts = {
        "jsonld": len(extract_sessions_jsonld(html, url)),
        "wp": len(extract_sessions_wp_events_calendar(html, url)),
        "table": len(extract_sessions_html_table(html, url)),
    }
    structured_summary = f"jsonld={structured_counts['jsonld']},wp={structured_counts['wp']},table={structured_counts['table']}"

    scores: dict[str, ProviderScore] = {}
    for provider in providers:
        sessions = _extract_sessions_llm_with_provider(
            html=html,
            url=url,
            festival_name=name,
            slug=slug,
            llm_provider=provider,
            llm_model=None,
        )
        scored = _score_provider(
            provider_name=provider,
            festival_name=name,
            sessions=sessions,
            min_sessions=min_sessions,
            min_timed=min_timed,
        )
        scores[provider] = scored

    return slug, scores, structured_summary


def _pick_winner(scores: dict[str, ProviderScore], providers: list[str]) -> str:
    best_provider: str | None = None
    best: ProviderScore | None = None

    for provider in providers:
        candidate = scores.get(provider)
        if candidate is None:
            continue
        if best is None or candidate.score > best.score:
            best_provider = provider
            best = candidate

    # Avoid recording a "winner" when no provider produced any accepted sessions.
    if best is None or best.accepted == 0:
        return "none"
    return best_provider or "none"


def _update_overrides(path: Path, winners: dict[str, str]) -> None:
    if path.exists():
        payload = json.loads(path.read_text())
    else:
        payload = {}

    if not isinstance(payload, dict):
        payload = {}

    providers_by_slug = payload.get("providers_by_slug", {})
    if not isinstance(providers_by_slug, dict):
        providers_by_slug = {}

    providers_by_slug.update(winners)
    payload["providers_by_slug"] = providers_by_slug
    payload["updated_at"] = date.today().isoformat()
    payload.setdefault("notes", "Per-festival provider overrides used by crawl_festival_schedule fallback extraction.")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark festival extraction across LLM providers.")
    parser.add_argument("--eval-set", default=str(DEFAULT_EVAL_SET), help="Path to benchmark case JSON.")
    parser.add_argument(
        "--providers",
        default="openai,anthropic",
        help="Comma-separated provider list to compare.",
    )
    parser.add_argument(
        "--overrides-path",
        default=str(DEFAULT_OVERRIDES),
        help="Path to festival provider overrides JSON.",
    )
    parser.add_argument(
        "--update-overrides",
        action="store_true",
        help="Persist winning provider per slug into overrides JSON.",
    )
    parser.add_argument(
        "--slugs",
        default="",
        help="Optional comma-separated slug subset to benchmark.",
    )
    args = parser.parse_args()

    eval_path = Path(args.eval_set)
    providers = [item.strip().lower() for item in args.providers.split(",") if item.strip()]
    if not providers:
        raise SystemExit("No providers selected.")

    cases = _load_eval_cases(eval_path)
    requested_slugs = {
        item.strip().lower() for item in args.slugs.split(",") if item.strip()
    }
    if requested_slugs:
        cases = [
            case for case in cases
            if str(case.get("slug", "")).strip().lower() in requested_slugs
        ]
    if not cases:
        raise SystemExit(f"No benchmark cases found in {eval_path}")

    print("slug|winner|structured_counts|" + "|".join(f"{p}_score,{p}_accepted,{p}_timed,{p}_gate" for p in providers))

    winners: dict[str, str] = {}
    for case in cases:
        slug, scores, structured_summary = _evaluate_case(case, providers)
        winner = _pick_winner(scores, providers)
        if winner != "none":
            winners[slug] = winner

        provider_cells: list[str] = []
        for provider in providers:
            score = scores.get(provider)
            if score is None:
                provider_cells.append("NA,0,0,missing")
                continue
            gate = ";".join(score.gate_reasons) if score.gate_reasons else (
                "no_sessions" if score.total == 0 and score.accepted == 0 else "-"
            )
            provider_cells.append(
                f"{score.score:.2f},{score.accepted},{score.timed},{gate}"
            )
        print(f"{slug}|{winner}|{structured_summary}|" + "|".join(provider_cells))

    if args.update_overrides:
        _update_overrides(Path(args.overrides_path), winners)
        print(f"updated_overrides|{args.overrides_path}|{len(winners)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
