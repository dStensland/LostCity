# HelpATL Workstream A Atlanta Humane Hardening 005

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Source: `atlanta-humane-society`
- Follows: [helpatl-workstream-a-source-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-workstream-a-source-audit-001.md)

## 1) Objective

Make Atlanta Humane Society’s live inventory truthful and decide whether it still belongs in the volunteer-balancing queue.

## 2) Problems found

Before hardening, the visible next-30-day inventory included stale Eventbrite rows such as:

1. `Bingo Night`
2. `Virtual PICS Info Session`

Those rows were no longer on the current AHS events page, but they remained active in HelpATL and made the source look more volunteer-like than it really was.

## 3) Change

Updated [atlanta_humane_society.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_humane_society.py#L1) to:

1. classify info sessions more carefully
2. force current source tags/category on update
3. remove stale future rows that disappear from the live AHS page

Added regression coverage in [test_atlanta_humane_society.py](/Users/coach/Projects/LostCity/crawlers/tests/test_atlanta_humane_society.py#L1).

## 4) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_atlanta_humane_society.py
python3 -m py_compile sources/atlanta_humane_society.py tests/test_atlanta_humane_society.py
python3 main.py --source atlanta-humane-society --allow-production-writes --skip-launch-maintenance
```

Live outcome after final refresh:

- stale future rows removed: `6`
- stale Eventbrite artifacts removed, including:
  - `Bingo Night`
  - `Virtual PICS Info Session`

Current active next-30-day AHS inventory:

1. `Give Back Monday at Gate City Brewing Co.`
2. `State Fair`
3. `Virtual Pets In Crisis Info Session`
4. `Bingo Night at Roswell`
5. `Marietta Wine Market Tasting`

Current tag mix is now honest:

- fundraisers / nightlife remain tagged that way
- old stale adoption-style tags from removed Eventbrite rows are gone

## 5) Read

Atlanta Humane Society is useful for animal-welfare breadth, but not for volunteer balancing.

It is now clearly:

1. a community and fundraiser source
2. sometimes an info-session / family event source
3. not a major volunteer-shift contributor

## 6) Decision

Remove `atlanta-humane-society` from the Workstream A volunteer-balancing target list.

Keep it as a breadth source for:

1. animal welfare
2. community engagement
3. occasional adoption/family programming

## 7) Next move

The volunteer-balancing queue is now narrower and clearer:

1. `medshare`
2. `trees-atlanta`
3. smaller direct sources after that

The next useful step is either:

1. audit `lifeline-animal-project` with the same honesty test, or
2. stop Workstream A here and shift to the commitment / statewide-process workstreams, because the remaining “next-tier” volunteer sources are mostly small by source reality.
