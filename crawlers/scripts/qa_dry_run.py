#!/usr/bin/env python3
"""Phase 4: QA dry-run across integration methods.

Runs pipeline_main.py (dry-run, no --insert) for a sample of sources per
integration method and collects results into tmp/qa_dry_run_report.json.
"""
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

CRAWLERS_DIR = Path(__file__).resolve().parent.parent
PIPELINE = CRAWLERS_DIR / "pipeline_main.py"
VENV_PYTHON = CRAWLERS_DIR / "venv" / "bin" / "python"
REPORT_PATH = CRAWLERS_DIR / "tmp" / "qa_dry_run_report.json"

# Per-method timeout (seconds). LLM/Playwright methods need more time.
METHOD_TIMEOUT = {
    "aggregator": 120,
    "api": 120,
    "feed": 120,
    "html": 120,
    "jsonld_only": 120,
    "llm_crawler": 180,
    "llm_extraction": 180,
    "playwright": 180,
}

# 5 sources per method (fewer if method has <5 total)
SOURCES_BY_METHOD = {
    "aggregator": [
        "ticketmaster", "eventbrite", "eventbrite-nashville",
        "apex-museum", "atlanta-preservation-center",
    ],
    "api": [
        "ticketmaster-nashville", "terminal-west",
    ],
    "feed": [
        "academy-ballroom", "atlanta-history-center", "auburn-ave-library",
        "georgia-state-university", "ptc-running-club",
    ],
    "html": [
        "10times", "big-brothers-big-sisters-atl", "eyedrum",
        "leons-full-service", "zucot-gallery",
    ],
    "jsonld_only": [
        "13-stories", "factory-franklin", "lego-discovery-center",
        "park-tavern", "woofs-atlanta",
    ],
    "llm_crawler": [
        "activate-games", "brick-store-pub", "eventide-brewing",
        "lindbergh-city-center", "third-and-lindsley",
    ],
    "llm_extraction": [
        "morehouse-college", "spelman-college",
    ],
    "playwright": [
        "a-cappella-books", "compound-atlanta",
        "mobilize-indivisible-ga10", "second-self-brewing", "ypa-atlanta",
    ],
}


def run_source(slug: str, limit: int = 10, timeout: int = 120) -> dict:
    """Run a single source dry-run and return result dict."""
    python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
    cmd = [
        python, str(PIPELINE),
        "--source", slug,
        "--limit", str(limit),
    ]
    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(CRAWLERS_DIR),
        )
        elapsed = round(time.monotonic() - t0, 1)
        # Grab last 40 lines of output for the report
        stdout_tail = "\n".join(proc.stdout.strip().splitlines()[-40:])
        stderr_tail = "\n".join(proc.stderr.strip().splitlines()[-20:])
        return {
            "slug": slug,
            "success": proc.returncode == 0,
            "returncode": proc.returncode,
            "elapsed_s": elapsed,
            "stdout_tail": stdout_tail,
            "stderr_tail": stderr_tail,
        }
    except subprocess.TimeoutExpired:
        elapsed = round(time.monotonic() - t0, 1)
        return {
            "slug": slug,
            "success": False,
            "returncode": -1,
            "elapsed_s": elapsed,
            "stdout_tail": "",
            "stderr_tail": f"TIMEOUT after {timeout}s",
        }
    except Exception as e:
        elapsed = round(time.monotonic() - t0, 1)
        return {
            "slug": slug,
            "success": False,
            "returncode": -1,
            "elapsed_s": elapsed,
            "stdout_tail": "",
            "stderr_tail": str(e),
        }


def main():
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_sources": sum(len(v) for v in SOURCES_BY_METHOD.values()),
        "results_by_method": {},
        "summary": {},
    }

    total_pass = 0
    total_fail = 0

    for method, slugs in SOURCES_BY_METHOD.items():
        print(f"\n{'='*60}")
        print(f"  Method: {method} ({len(slugs)} sources)")
        print(f"{'='*60}")
        method_results = []
        method_pass = 0
        method_fail = 0

        method_timeout = METHOD_TIMEOUT.get(method, 120)

        for slug in slugs:
            print(f"  -> {slug} ...", end=" ", flush=True)
            result = run_source(slug, timeout=method_timeout)
            status = "PASS" if result["success"] else "FAIL"
            print(f"{status} ({result['elapsed_s']}s)")
            if result["success"]:
                method_pass += 1
            else:
                method_fail += 1
            method_results.append(result)

        report["results_by_method"][method] = {
            "sources_tested": len(slugs),
            "passed": method_pass,
            "failed": method_fail,
            "results": method_results,
        }
        total_pass += method_pass
        total_fail += method_fail

    report["summary"] = {
        "total_pass": total_pass,
        "total_fail": total_fail,
        "pass_rate": f"{total_pass}/{total_pass + total_fail}",
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(f"\nReport written to {REPORT_PATH}")

    # Print summary table
    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    for method, data in report["results_by_method"].items():
        print(f"  {method:20s}  {data['passed']}/{data['sources_tested']} passed")
    print(f"  {'TOTAL':20s}  {total_pass}/{total_pass + total_fail} passed")


if __name__ == "__main__":
    main()
