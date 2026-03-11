# HelpATL Workstream A Concrete Jungle Hardening 004

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Source: `concrete-jungle`
- Follows: [helpatl-workstream-a-source-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-workstream-a-source-audit-001.md)

## 1) Objective

Make Concrete Jungle’s live event inventory truthful by removing sold-out rows and stopping workshops from presenting as free volunteer opportunities.

## 2) Problems found

Before hardening, the live next-30-day inventory included:

1. a `FULL:` farm volunteer row that was no longer actionable
2. workshop rows carrying volunteer/free-volunteer metadata
3. stale future rows that were no longer in the current Airtable export

This made the source look more useful to a volunteer-seeking user than it really was.

## 3) Change

Updated [concrete_jungle.py](/Users/coach/Projects/LostCity/crawlers/sources/concrete_jungle.py#L1) to:

1. skip `FULL:` / sold-out rows
2. classify workshops as `learning` instead of volunteer inventory
3. scrub stale volunteer/free metadata on existing rows
4. remove stale future events that disappear from the Airtable export

Added regression coverage in [test_concrete_jungle.py](/Users/coach/Projects/LostCity/crawlers/tests/test_concrete_jungle.py#L1).

## 4) Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_concrete_jungle.py
python3 -m py_compile sources/concrete_jungle.py tests/test_concrete_jungle.py
python3 main.py --source concrete-jungle --allow-production-writes --skip-launch-maintenance
```

Live outcome after final refresh:

- active next-30-day `FULL:` rows: `0`
- workshop rows with `volunteer` tag: `0`
- workshop rows with `price_note = 'Free volunteer event'`: `0`
- current next-30-day Concrete Jungle inventory:
  - `Farm Volunteer - Farm Day at Doghead Farm`
  - `Workshop - Strawberry Workshop at Doghead Farm`
  - `Workshop - Coconut Workshop at Doghead Farm`

Additional source-health effect:

- stale future rows removed during refresh: `3`

## 5) Read

Concrete Jungle is now more honest but also clearly smaller as a volunteer-balancing source.

That is the right outcome.

The source still matters for:

1. food / environment breadth
2. local nonprofit credibility
3. occasional volunteer inventory

But it should not be counted as a major next-tier volunteer-volume answer.

## 6) Priority implication

After this pass:

1. `medshare` is clean and high-yield
2. `trees-atlanta` is clean and moderate-yield
3. `concrete-jungle` is clean but small

That means the next Workstream A decision point is `atlanta-humane-society`: either tighten its event typing, or explicitly stop treating it as volunteer-balancing evidence.
