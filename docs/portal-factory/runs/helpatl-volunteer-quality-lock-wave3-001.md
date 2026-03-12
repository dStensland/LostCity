# HelpATL Volunteer Quality Lock Wave 3 001

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Next / A` volunteer quality lock
- Goal: hold volunteer trust under source concentration instead of pretending weak breadth sources solve the lane

## What changed

Fixed Trees Atlanta source-link quality so dead same-day detail pages fall back to the stable listing page.

Files:
- [trees_atlanta.py](/Users/coach/Projects/LostCity/crawlers/sources/trees_atlanta.py)
- [test_trees_atlanta.py](/Users/coach/Projects/LostCity/crawlers/tests/test_trees_atlanta.py)

## Why this mattered

The final volunteer quality audit found that the dominant-source set was already clean on descriptions and generic titles, but the top audited URL sample still contained `3` Trees Atlanta `404` detail pages. That was a real user-facing trust defect.

The crawler now:
- checks whether a Trees detail URL is live
- falls back to `https://www.treesatlanta.org/get-involved/events/` when the detail page is dead
- updates existing rows during the crawl so current inventory is fixed immediately

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_trees_atlanta.py
python3 -m py_compile sources/trees_atlanta.py tests/test_trees_atlanta.py
python3 main.py --source trees-atlanta --allow-production-writes --skip-launch-maintenance
```

Audit checks run against the live DB:
- dominant-source blank descriptions in next 30 days
- dominant-source generic titles in next 30 days
- audited top 20 source URLs

## Measured result

Dominant source set audited:
- `hands-on-atlanta`
- `open-hand-atlanta`
- `atlanta-community-food-bank`
- `medshare`
- `trees-atlanta`

Current next-30-day quality state:
- blank descriptions: `0`
- generic titles: `0`

Per-source snapshot:
- `hands-on-atlanta`: `544` events, `0` blank descriptions, `0` generic titles
- `open-hand-atlanta`: `195` events, `0` blank descriptions, `0` generic titles
- `atlanta-community-food-bank`: `182` events, `0` blank descriptions, `0` generic titles
- `medshare`: `28` events, `0` blank descriptions, `0` generic titles
- `trees-atlanta`: `19` events, `0` blank descriptions, `0` generic titles

Top audited source URL sample:
- before: `17 / 20` returned `200`
- after: `20 / 20` returned `200`

Trees-specific effect:
- dead detail URLs now fall back to `https://www.treesatlanta.org/get-involved/events/`

## Decision

Decision: `continue`

This closes the volunteer-quality lock acceptance bar. The volunteer lane is still concentrated, but the dominant-source experience is now clean enough to operate instead of constantly expand.
