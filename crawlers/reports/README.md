# Data Quality Reports Index

Operational entrypoint:
- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`

This directory stores generated diagnostics and health artifacts.

## Read These First (Latest Run)

- `content_health_gate_YYYY-MM-DD[_city-atlanta].json` for PASS/WARN/FAIL gate status.
- `content_health_assessment_YYYY-MM-DD[_city-atlanta].md` for executive summary.
- `content_health_findings_YYYY-MM-DD[_city-atlanta].md` for drilldown.
- `content_health_metrics_YYYY-MM-DD[_city-atlanta].json` for machine-readable metrics.

## Generate Fresh Artifacts

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/content_health_audit.py --city Atlanta
python3 scripts/launch_health_check.py --city Atlanta
```

## Notes

- Historical report files remain for traceability.
- Do not make launch decisions from stale dated files without rerunning the gate.
