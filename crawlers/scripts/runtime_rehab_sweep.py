#!/usr/bin/env python3
"""
Sequential retry sweep for latest-state runtime failures.

Reads the latest post-crawl analysis JSON, selects sources in the requested
failure categories, and reruns them one-by-one with a per-source timeout so one
stuck crawler cannot block the whole rehab batch.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ANALYSIS_JSON = ROOT / "tmp" / "post_crawl_analysis.json"
DEFAULT_REPORT_DIR = ROOT / "reports"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sequential runtime rehab sweep")
    parser.add_argument(
        "--analysis-json",
        type=Path,
        default=DEFAULT_ANALYSIS_JSON,
        help="Path to post_crawl_analysis JSON output",
    )
    parser.add_argument(
        "--category",
        action="append",
        dest="categories",
        default=[],
        help="Failure category to retry (repeatable). Defaults to socket + network.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=240,
        help="Per-source subprocess timeout in seconds",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_REPORT_DIR,
        help="Directory for markdown/json reports",
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        default=[],
        help="Specific source slug to retry (repeatable). Overrides category selection when provided.",
    )
    parser.add_argument(
        "--skip-source",
        action="append",
        dest="skip_sources",
        default=[],
        help="Source slug to skip even if selected by category.",
    )
    return parser.parse_args()


def load_sources(
    path: Path,
    categories: list[str],
    explicit_sources: list[str],
    skip_sources: list[str],
) -> list[str]:
    payload = json.loads(path.read_text())
    if explicit_sources:
        return [slug for slug in explicit_sources if slug not in set(skip_sources)]
    chosen = categories or ["socket", "network"]
    slugs: list[str] = []
    for category in chosen:
        for row in payload.get("failure_categories", {}).get(category, []):
            slug = row.get("source_slug")
            if slug and slug not in slugs and slug not in set(skip_sources):
                slugs.append(slug)
    return slugs


def run_source(slug: str, timeout_seconds: int) -> dict:
    cmd = [
        "python3",
        str(ROOT / "main.py"),
        "--source",
        slug,
        "--allow-production-writes",
        "--skip-launch-maintenance",
        "--skip-run-lock",
        "--force",
    ]
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        stdout, _ = proc.communicate(timeout=timeout_seconds)
        output_lines = [line for line in stdout.splitlines() if line.strip()]
        return {
            "slug": slug,
            "status": "success" if proc.returncode == 0 else "failed",
            "returncode": proc.returncode,
            "started_at": started_at,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "tail": output_lines[-12:],
        }
    except subprocess.TimeoutExpired as exc:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            stdout, _ = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            stdout, _ = proc.communicate()
        output_text = stdout or exc.stdout or ""
        if isinstance(output_text, bytes):
            output_text = output_text.decode("utf-8", errors="replace")
        output_lines = [line for line in output_text.splitlines() if line.strip()]
        return {
            "slug": slug,
            "status": "timeout",
            "returncode": None,
            "started_at": started_at,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "tail": output_lines[-12:],
        }


def render_markdown(
    results: list[dict], *, categories: list[str], timeout_seconds: int
) -> str:
    lines = [
        "# Runtime Rehab Sweep",
        "",
        f"- Generated: {datetime.now(timezone.utc).isoformat()}",
        f"- Categories: {', '.join(categories or ['socket', 'network'])}",
        f"- Timeout seconds: {timeout_seconds}",
        "",
    ]
    status_counts: dict[str, int] = {}
    for result in results:
        status_counts[result["status"]] = status_counts.get(result["status"], 0) + 1
    lines.append("## Summary")
    for status, count in sorted(status_counts.items()):
        lines.append(f"- {status}: {count}")
    lines.append("")
    lines.append("## Results")
    for result in results:
        lines.append(f"### {result['slug']} [{result['status']}]")
        for line in result.get("tail", []):
            lines.append(f"- `{line}`")
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def main() -> None:
    args = parse_args()
    categories = args.categories or ["socket", "network"]
    sources = load_sources(
        args.analysis_json, categories, args.sources, args.skip_sources
    )
    results = [run_source(slug, args.timeout_seconds) for slug in sources]

    generated_on = datetime.now(timezone.utc).date().isoformat()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / f"runtime_rehab_sweep_{generated_on}.json"
    md_path = args.output_dir / f"runtime_rehab_sweep_{generated_on}.md"

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": categories,
        "timeout_seconds": args.timeout_seconds,
        "results": results,
        "summary": {
            "sources_attempted": len(results),
            "status_counts": {
                status: sum(1 for item in results if item["status"] == status)
                for status in sorted({item["status"] for item in results})
            },
        },
    }

    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    md_path.write_text(
        render_markdown(
            results, categories=categories, timeout_seconds=args.timeout_seconds
        ),
        encoding="utf-8",
    )
    print(f"Wrote markdown report: {md_path}")
    print(f"Wrote JSON report: {json_path}")
    print(json.dumps(payload["summary"]))


if __name__ == "__main__":
    main()
