# HelpATL Workstream A Trees Atlanta Hardening 003

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Source: `trees-atlanta`
- Follows: [helpatl-workstream-a-source-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-workstream-a-source-audit-001.md)

## 1) Objective

Determine whether `trees-atlanta` is under-yielding due to crawler issues or simply reflecting the live public calendar, and fix any obvious source-truth defects.

## 2) Findings

Live source review showed:

1. the Trees Atlanta public events page currently renders `20` event cards
2. one of those cards is explicitly canceled:
   - `CANCELED Tree Care in John Lewis Flowering Forest`
3. active HelpATL inventory before hardening was `19` next-30-day events

Read:

- Trees Atlanta was not missing a large second page or hidden feed
- the source is just on a short event window right now
- the clear problem was quality, not scale

## 3) Change

Updated [trees_atlanta.py](/Users/coach/Projects/LostCity/crawlers/sources/trees_atlanta.py#L1) to skip cards that are clearly marked canceled by title or description.

Added regression coverage in [test_trees_atlanta.py](/Users/coach/Projects/LostCity/crawlers/tests/test_trees_atlanta.py#L1).

## 4) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_trees_atlanta.py
python3 -m py_compile sources/trees_atlanta.py tests/test_trees_atlanta.py
python3 main.py --source trees-atlanta --allow-production-writes --skip-launch-maintenance
```

Live outcome after refresh:

- canceled active next-30-day Trees rows: `0`
- Trees crawl result: `19 found, 1 new, 18 updated`
- stale rows removed: `2`
- the new live event added was:
  - `Tree Tour: Kirkwood, a Commitment to a Healthy Community`

Current active Trees contribution:

- next `7` days: `19`
- next `30` days: `19`

## 5) Decision

`trees-atlanta` stays in the Workstream A volunteer-balancing queue, but it is **not** a current under-yielding crawler problem.

The source is now:

1. clean
2. specific
3. trustworthy

But its next-30-day volume is limited by the current public calendar.

## 6) Next move

Do not spend another pass trying to inflate Trees yield right now.

Move to the next real leverage point:

1. audit `concrete-jungle` for true under-yield versus honest low volume, or
2. tighten `atlanta-humane-society` so fundraiser/social events do not masquerade as volunteer depth
