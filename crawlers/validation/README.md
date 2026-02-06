# Validation Harness

This folder contains tools to snapshot field coverage and compare quality between runs.

## Quick Start

1) Run a crawl (legacy or pipeline).

2) Generate a snapshot for the source:
```
python validation/run_snapshot.py --source the-earl --mode legacy --window-mins 120
python validation/run_snapshot.py --source the-earl --mode pipeline --window-mins 120
```

3) Compare results:
```
python validation/compare_snapshots.py \
  --base validation/runs/the-earl-legacy-*.json \
  --candidate validation/runs/the-earl-pipeline-*.json
```

## Notes
- Snapshots read from Supabase using the service key in `crawlers/.env`.
- Use `--updated-since` or `--window-mins` to scope to the most recent run.
- If you want a full look at upcoming events, use `--days 180` (default) and omit `--updated-since`.

## Recommended Workflow (Pilot Sources)
- The Earl
- Ticketmaster
- Dad’s Garage

Example for The Earl (pipeline):
```
python pipeline_main.py --source the-earl --insert --limit 100
python validation/run_snapshot.py --source the-earl --mode pipeline --window-mins 120
```

Example for Ticketmaster (API):
```
python pipeline_main.py --source ticketmaster --insert --limit 200
python validation/run_snapshot.py --source ticketmaster --mode pipeline --window-mins 120
```

Example for Dad’s Garage:
```
python pipeline_main.py --source dads-garage --insert --limit 100
python validation/run_snapshot.py --source dads-garage --mode pipeline --window-mins 120
```
