# HelpATL Volunteer Mix Hardening Wave 2

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Volunteer Mix Hardening`
- Goal: improve the trust quality of the major volunteer sources without pretending weak breadth sources solve concentration

## Scope

Audited the approved major sources:

- `hands-on-atlanta`
- `open-hand-atlanta`
- `atlanta-community-food-bank`
- `medshare`
- `trees-atlanta`

## What changed

Open Hand Atlanta no longer emits blank-description volunteer rows.

The crawler now assigns truthful role-aware fallback descriptions based on the
public volunteer inventory described on Open Hand's volunteer page:

- meal packing
- delivery
- loading assistance
- market basket packing
- culinary assistance
- volunteer greeting / operations support

## Result

For active next-30-day events in the approved major-source set:

- `hands-on-atlanta`: `0` blank descriptions
- `open-hand-atlanta`: `195 -> 0` blank descriptions
- `atlanta-community-food-bank`: `0` blank descriptions
- `medshare`: `0` blank descriptions
- `trees-atlanta`: `0` blank descriptions

This leaves the major-source volunteer lane at `0` blank descriptions overall in
the audited window.

## Live examples

- `Delivery Driver Volunteer` -> `Help deliver Open Hand meals directly to clients across metro Atlanta.`
- `AM Meal Packing` -> `Pack medically tailored meals that Open Hand delivers to Atlanta neighbors in need.`
- `Front Desk Greeter` -> `Welcome volunteers and visitors and support check-in at Open Hand's headquarters.`

## Verification run

1. Ran:
   - `python3 -m pytest tests/test_open_hand_atlanta.py`
   - `python3 -m py_compile sources/open_hand_atlanta.py tests/test_open_hand_atlanta.py`
2. Refreshed live source data:
   - `python3 main.py --source open-hand-atlanta --allow-production-writes --skip-launch-maintenance`
3. Re-audited the five major sources in the next-30-day window and confirmed `0` blank descriptions across the set
