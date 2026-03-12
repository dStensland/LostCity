# HelpATL Workstream A Source Audit 001

- Date: 2026-03-11
- Portal: `helpatl`
- Surface: `consumer`
- Workstream: `A` event inventory balancing
- Based on: [helpatl-current-content-audit-001.md](/Users/coach/Projects/LostCity/docs/portal-factory/runs/helpatl-current-content-audit-001.md)

## 1) Objective

Audit the next-tier event sources identified in the remediation plan and decide which ones actually help reduce volunteer-source concentration.

Sources reviewed:

1. `trees-atlanta`
2. `medshare`
3. `mobilize-us`
4. `atlanta-humane-society`
5. `concrete-jungle`
6. `lifeline-animal-project`
7. `georgia-equality`
8. `atlanta-dsa`

## 2) Live inventory snapshot

All counts below are active events in the next `30` days as of `2026-03-11`.

| Source | Next 7d | Next 30d | Share of portal 30d | Duplicate groups | Generic titles | Missing URLs | Stale 30d |
|---|---:|---:|---:|---:|---:|---:|---:|
| `atlanta-dsa` | `13` | `30` | `2.8%` | `0` | `0` | `0` | `0` |
| `medshare` | `7` | `28` | `2.6%` | `0` | `0` | `0` | `0` |
| `trees-atlanta` | `19` | `19` | `1.8%` | `0` | `0` | `0` | `0` |
| `mobilize-us` | `5` | `15` | `1.4%` | `0` | `0` | `0` | `0` |
| `atlanta-humane-society` | `1` | `6` | `0.6%` | `0` | `0` | `0` | `0` |
| `concrete-jungle` | `2` | `5` | `0.5%` | `0` | `0` | `0` | `0` |
| `georgia-equality` | `1` | `3` | `0.3%` | `0` | `0` | `0` | `0` |
| `lifeline-animal-project` | `1` | `2` | `0.2%` | `0` | `0` | `0` | `0` |

Read:

1. source hygiene is generally strong across this set
2. the issue is not duplicates or stale rows
3. the issue is mix and yield

## 3) Strategy correction

This source set is doing two different jobs:

### Volunteer-balancing sources

These help reduce reliance on `hands-on-atlanta`, `open-hand-atlanta`, and `atlanta-community-food-bank` for the action side of HelpATL:

1. `trees-atlanta`
2. `medshare`
3. `concrete-jungle`
4. `atlanta-humane-society`
5. `lifeline-animal-project`

### Civic-action growth sources

These improve participation breadth, but do **not** directly solve volunteer-source concentration:

1. `atlanta-dsa`
2. `mobilize-us`
3. `georgia-equality`

Decision:

Workstream A should no longer treat these as one pool.

## 4) Source-by-source read

## `trees-atlanta`

Strongest direct volunteer-balancing source in the set.

Signals:

- `19` next-30-day events
- `19` marked with `volunteer`
- title quality is strong
- source URLs are specific event pages, not generic landing pages

Recommendation:

- keep as `P1`
- closest source to the `20+` next-30-day threshold
- good candidate for deeper surfacing and continued yield protection

## `medshare`

High-yield and clearly relevant, but metadata quality is not fully honest.

Signals:

- `28` next-30-day events
- titles are now clean after the recent hardening pass
- every event still carries `fundraiser` alongside `volunteer`

Read:

- MedShare is helping volunteer volume
- but its tag shape is still polluting interpretation

Recommendation:

- keep as `P1`
- next fix should be metadata normalization, especially removing false `fundraiser` tagging from volunteer sessions

## `concrete-jungle`

Good mission fit, but too small right now to materially rebalance the feed.

Signals:

- `5` next-30-day events
- clean volunteer titles
- some events are workshops, not pure volunteer shifts

Recommendation:

- `P2`
- audit whether the source is under-yielding or whether the public calendar is genuinely light

## `atlanta-humane-society`

Useful for breadth, weak for volunteer balancing.

Signals:

- `6` next-30-day events
- sample includes `Bingo Night` and `Give Back Monday`, not just volunteering
- tags include `fundraiser`

Recommendation:

- keep for animal-welfare breadth
- do not count it as a core volunteer concentration fix unless event typing is tightened

## `lifeline-animal-project`

Too light to matter yet.

Signals:

- `2` next-30-day events
- current sample is more public-facing event inventory than volunteer-shift depth

Recommendation:

- `P3`
- not worth immediate hardening until stronger volunteer inventory is confirmed

## `atlanta-dsa`

Strong civic-action contributor, not a volunteer-balancing source.

Signals:

- `30` next-30-day events
- tags are mostly `advocacy`, `civic`, `attend`
- only `2` events carry `volunteer`

Recommendation:

- keep in civic-action workstream
- remove from volunteer-balancing target list

## `mobilize-us`

Important civic-process source, not a volunteer-balancing source.

Signals:

- `15` next-30-day events
- tags include `government`, `public-meeting`, `activism`

Recommendation:

- keep in civic authority / civic action work
- do not use as a volunteer concentration KPI source

## `georgia-equality`

Legitimate civic-action source, but low yield.

Signals:

- `3` next-30-day events
- events are issue advocacy / lobbying oriented

Recommendation:

- keep for lane breadth
- not relevant to volunteer-source balancing

## 5) Revised priority queue

### Volunteer-balancing hardening queue

1. `medshare`
2. `trees-atlanta`
3. `concrete-jungle`
4. `atlanta-humane-society`
5. `lifeline-animal-project`

### Civic-action / process-growth queue

1. `mobilize-us`
2. `atlanta-dsa`
3. `georgia-equality`

## 6) Immediate actions

### P1

1. Fix `medshare` metadata so volunteer sessions are not tagged as `fundraiser`.
2. Protect `trees-atlanta` yield and keep it above the `20+` next-30-day threshold.

### P2

1. Audit whether `concrete-jungle` has missing dated volunteer inventory or simply low public volume.
2. Tighten event typing for `atlanta-humane-society` so fundraiser/social events do not overstate volunteer coverage.

### P3

1. Stop using `atlanta-dsa`, `mobilize-us`, and `georgia-equality` as volunteer-balancing evidence in planning docs.
2. Track those sources under civic-action breadth instead.

## 7) Bottom line

The next-tier source picture is better than expected on source hygiene and worse than expected on strategic fit.

The portal does **not** have a broad volunteer-balancing bench yet.

What it has is:

1. one strong direct volunteer-balancing candidate: `trees-atlanta`
2. one high-yield volunteer source with metadata cleanup needed: `medshare`
3. one smaller but real volunteer source: `concrete-jungle`
4. several useful civic-action sources that should be measured separately

That means the next fix should be `medshare`, not another generic expansion pass.
