"""Bounded venue-description expansion metrics and gate helpers."""

from __future__ import annotations

from collections import Counter
from datetime import datetime
import json
from pathlib import Path
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from db import get_client
from description_quality import classify_description
from scripts.venue_tier_health import target_tier_for

TIER_LABELS = {1: "discoverable", 2: "destination", 3: "premium"}
MIN_HEALTHY_DESCRIPTION_LENGTH = 80
LOW_SIGNAL_DOMAINS = (
    "lookcinemas.com",
    "springscinema.com",
    "cinemark.com",
    "stores.barnesandnoble.com",
    "facebook.com",
    "theclaibornecompany.com",
    "artsatl.org",
    "roswellgov.com",
    "georgiastatesports.com",
    "stadium.utah.edu",
    "mlb.com",
    "ksuowls.com",
    "levelupatl.com",
    "flatironatl.com",
    "atlantaexpocenter.com",
)
LOW_SIGNAL_SLUGS = {
    "mlk-national-historical-park",
    "wolf-creek-amphitheater",
}
LOW_SIGNAL_PLACE_TYPES = {"cinema"}
VENUE_DESCRIPTION_HISTORY_PATH = (
    Path(__file__).parent / "reports" / "venue_description_cycle_history_latest.json"
)


def _fetch_rows(
    table: str,
    fields: str,
    *,
    query_builder: Optional[Callable[[Any], Any]] = None,
    order_column: Optional[str] = "id",
    page_size: int = 1000,
) -> list[dict[str, Any]]:
    client = get_client()
    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        query = client.table(table).select(fields).range(offset, offset + page_size - 1)
        if query_builder:
            query = query_builder(query)
        if order_column:
            query = query.order(order_column)
        result = query.execute()
        batch = result.data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    return rows


def _description_issue(description: Optional[str]) -> tuple[str, str]:
    text = (description or "").strip()
    if not text:
        return "missing_description", "Missing description"

    quality = classify_description(text)
    if quality == "junk":
        return "junk_description", "Junk description"
    if quality == "boilerplate":
        return "boilerplate_description", "Boilerplate description"
    if len(text) < MIN_HEALTHY_DESCRIPTION_LENGTH:
        return (
            "short_description",
            f"Short description (<{MIN_HEALTHY_DESCRIPTION_LENGTH} chars)",
        )
    return "healthy_description", "Healthy description"


def _domain_from_url(url: Optional[str]) -> str:
    host = urlparse(url or "").netloc.lower()
    if host.startswith("www."):
        return host[4:]
    return host


def _is_low_signal_candidate(row: dict[str, Any]) -> bool:
    issue_type = row["issue_type"]
    if issue_type == "healthy_description":
        return False

    if row.get("slug") in LOW_SIGNAL_SLUGS:
        return True

    domain = _domain_from_url(row.get("website"))
    if any(
        domain == known or domain.endswith(f".{known}") for known in LOW_SIGNAL_DOMAINS
    ):
        return True

    if row.get("place_type") in LOW_SIGNAL_PLACE_TYPES and issue_type in {
        "junk_description",
        "boilerplate_description",
        "short_description",
    }:
        return True

    return False


def _load_cycle_history(path: Path = VENUE_DESCRIPTION_HISTORY_PATH) -> dict[str, Any]:
    if not path.exists():
        return {"generated_at": None, "slugs": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"generated_at": None, "slugs": {}}


def _history_promotes_monitor_only(
    row: dict[str, Any], history: dict[str, Any]
) -> bool:
    slug_history = (history.get("slugs") or {}).get(row.get("slug"), {})
    if slug_history.get("prep_skip_count", 0) >= 2:
        return True
    if slug_history.get("prep_fail_count", 0) >= 2:
        return True
    if slug_history.get("grounding_fail_count", 0) >= 2:
        return True
    return False


def compute_venue_description_snapshot() -> dict[str, Any]:
    places = _fetch_rows(
        "places",
        "id,name,slug,city,place_type,website,description,is_active",
        query_builder=lambda q: q.eq("is_active", True),
    )

    eligible_rows: list[dict[str, Any]] = []
    issue_counts: Counter[str] = Counter()
    pilot_candidates: list[dict[str, Any]] = []
    monitor_only: list[dict[str, Any]] = []
    history = _load_cycle_history()

    for row in places:
        tier = target_tier_for(row.get("place_type"))
        if tier < 1:
            continue
        if not row.get("website"):
            continue

        issue_type, reason = _description_issue(row.get("description"))
        candidate = {
            "id": row.get("id"),
            "name": row.get("name"),
            "slug": row.get("slug"),
            "city": row.get("city"),
            "place_type": row.get("place_type"),
            "tier": tier,
            "tier_label": TIER_LABELS.get(tier, str(tier)),
            "issue_type": issue_type,
            "reason": reason,
            "description_len": len((row.get("description") or "").strip()),
            "website": row.get("website"),
            "domain": _domain_from_url(row.get("website")),
        }
        eligible_rows.append(candidate)
        issue_counts[issue_type] += 1
        if issue_type != "healthy_description":
            if _is_low_signal_candidate(candidate):
                candidate["queue_type"] = "monitor_only"
                candidate["queue_reason"] = (
                    "Low-signal storefront or thin-source website"
                )
                monitor_only.append(candidate)
            elif _history_promotes_monitor_only(candidate, history):
                candidate["queue_type"] = "monitor_only"
                candidate["queue_reason"] = (
                    "Repeated prep/grounding failures with no stable source-grounded path"
                )
                monitor_only.append(candidate)
            else:
                candidate["queue_type"] = "pilot_candidate"
                candidate["queue_reason"] = (
                    "Rich-copy candidate for bounded venue-description enrichment"
                )
                pilot_candidates.append(candidate)

    eligible_count = len(eligible_rows)
    healthy_count = issue_counts["healthy_description"]
    pilot_candidate_count = len(pilot_candidates)
    monitor_count = len(monitor_only)

    def pct(count: int) -> float:
        if not eligible_count:
            return 0.0
        return round((count / eligible_count) * 100.0, 1)

    def _sort_key(row: dict[str, Any]) -> tuple[Any, ...]:
        return (
            {
                "missing_description": 0,
                "junk_description": 1,
                "boilerplate_description": 2,
                "short_description": 3,
            }.get(row["issue_type"], 9),
            -row["tier"],
            row["description_len"],
            row["name"] or "",
        )

    pilot_candidates.sort(key=lambda row: (_sort_key(row)))
    monitor_only.sort(key=_sort_key)

    return {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "counts": {
            "active_places": len(places),
            "eligible_places": eligible_count,
            "pilot_candidate_count": pilot_candidate_count,
            "monitor_only_count": monitor_count,
        },
        "metrics": {
            "healthy_description_pct": pct(healthy_count),
            "missing_description_pct": pct(issue_counts["missing_description"]),
            "junk_or_boilerplate_pct": pct(
                issue_counts["junk_description"]
                + issue_counts["boilerplate_description"]
            ),
            "short_description_pct": pct(issue_counts["short_description"]),
        },
        "issues": {
            "candidates": pilot_candidates,
            "pilot_candidates": pilot_candidates,
            "monitor_only": monitor_only,
        },
    }


def build_venue_description_gate(snapshot: dict[str, Any]) -> dict[str, Any]:
    candidate_count = snapshot["counts"]["pilot_candidate_count"]
    monitor_count = snapshot["counts"].get("monitor_only_count", 0)
    if candidate_count:
        decision = "PILOT_READY"
    elif monitor_count:
        decision = "MONITOR_ONLY"
    else:
        decision = "STABLE"
    return {
        "generated_at": snapshot["generated_at"],
        "decision": decision,
        "ready_for_pilot": candidate_count > 0,
        "counts": snapshot["counts"],
        "metrics": snapshot["metrics"],
        "pilot_candidates": snapshot["issues"]["pilot_candidates"][:10],
        "monitor_only": snapshot["issues"]["monitor_only"][:10],
    }
