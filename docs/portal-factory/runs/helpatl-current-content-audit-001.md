# HelpATL Current Content Audit 001

- Date: 2026-03-10
- Portal: `helpatl`
- Surface: `consumer`
- Scope: current live content across events, ongoing roles, and support resources
- Read: strong breadth and freshness, but still too concentrated in a few volunteer sources

## 1) Current portal shape

Live portal inventory:

- visible sections: `7`
- active channels: `20`
- materialized event-channel matches: `2783`
- active ongoing roles: `61`

Visible sections:

1. `Volunteer This Week`
2. `Ongoing Opportunities`
3. `Commit to a Cause`
4. `Neighborhood Participation`
5. `Civic Training & Action`
6. `Government Meetings`
7. `School Board Watch`

## 2) Event inventory audit

### Channel counts

Distinct future active events by channel:

| Channel | Future | Next 7d | Next 30d |
|---|---:|---:|---:|
| `volunteer-this-week-atl` | `945` | `332` | `909` |
| `food-security` | `616` | `213` | `610` |
| `civic-engagement` | `312` | `53` | `136` |
| `education` | `141` | `59` | `133` |
| `environment` | `147` | `54` | `131` |
| `civic-training-action-atl` | `88` | `29` | `70` |
| `health-wellness` | `41` | `14` | `41` |
| `neighborhood-participation-atl` | `137` | `12` | `36` |
| `ongoing-opportunities-atl` | `37` | `26` | `30` |
| `animals` | `26` | `3` | `20` |

### Source concentration

Top sources in the next `30` days:

| Source | Count | Share |
|---|---:|---:|
| `hands-on-atlanta` | `482` | `45.3%` |
| `open-hand-atlanta` | `195` | `18.3%` |
| `atlanta-community-food-bank` | `165` | `15.5%` |
| `atlanta-city-planning` | `36` | `3.4%` |
| `atlanta-dsa` | `30` | `2.8%` |
| `medshare` | `28` | `2.6%` |

Read:

- top 3 sources account for `79.1%` of upcoming 30-day event inventory
- HelpATL is broad, but still not well-balanced
- if one of the top volunteer sources degrades, the portal quality will drop noticeably

### Freshness

For future events in the next `30` days:

- updated more than `30` days ago: `0`
- updated more than `60` days ago: `0`
- updated more than `90` days ago: `0`

Read:

- near-term inventory is currently fresh
- this is a real improvement over earlier hardening phases

### Duplicate check

Cross-source duplicate groups in the next `30` days:

1. `Fulton County: Join us for the Board of Registrations and Elections Meeting`
   - `indivisible-atl`
   - `mobilize-us`
2. `Atlanta Streets Alive`
   - `atlanta-dsa`
   - `marta-army`

Read:

- duplicate pressure is low
- remaining duplicates are explainable civic crossover cases, not broad feed pollution

### Link health sample

Sampled the top visible upcoming content:

- volunteer sample: `10` unique URLs
- civic/government sample: `10` unique URLs
- total checked: `20`
- successful `200` responses: `20`

Read:

- current visible-link health is strong
- no obvious broken-link problem in the top surfaced content right now

## 3) Ongoing role audit

Active ongoing roles:

- total: `61`

By cause:

| Cause | Roles |
|---|---:|
| `civic_engagement` | `24` |
| `family_support` | `8` |
| `immigrant_refugee` | `6` |
| `health_wellness` | `4` |
| `legal_aid` | `4` |
| `education` | `4` |
| `housing` | `4` |
| `environment` | `3` |
| `food_security` | `2` |
| `youth_education` | `2` |

Governance note:

- roles with `source_id IS NULL`: `11 / 61`

Those `11` are currently org-first roles like:

- `canopy-atlanta`
- `fair-fight`
- `hope-atlanta`
- `irc-atlanta`
- `new-georgia-project`

Read:

- this is not a consumer bug
- it is a traceability tradeoff: these roles are legitimate, but less tightly linked to source ownership than the source-backed roles

## 4) Support directory audit

Current support directory breadth:

- organizations: `182`
- support tracks: `31`
- sections: `6`

Section breadth:

| Section | Organizations |
|---|---:|
| `Urgent Help & Crisis Support` | `24` |
| `Food, Housing & Legal Help` | `23` |
| `Family, Youth & Newcomer Support` | `28` |
| `Health & Public Health` | `38` |
| `Work, Money & Daily Life` | `11` |
| `Disability, Aging & Long-Term Support` | `28` |

Read:

- support-resource breadth is real, not token
- `Work, Money & Daily Life` is currently the thinnest section
- this layer is directory-quality, not real-time availability-quality

## 5) Findings

### Strong

1. HelpATL now has real content breadth across live volunteering, civic participation, ongoing roles, and support resources.
2. Near-term event freshness is strong.
3. Top visible content link health is strong in the current sample.
4. Duplicate pressure is low.
5. The ongoing role layer is now substantial enough to feel like a product, not a placeholder.

### Weak

1. Event inventory is still heavily concentrated in `hands-on-atlanta`, `open-hand-atlanta`, and `atlanta-community-food-bank`.
2. `Commit to a Cause` remains much thinner than `Volunteer This Week`.
3. `georgia-democracy-watch` is still small (`1` event in the next 30 days).
4. `Work, Money & Daily Life` is the weakest support-resource lane.
5. `11` ongoing roles are org-first instead of source-linked, which weakens traceability.

## 6) Priority actions

### P1

1. Reduce volunteer-source concentration by strengthening the next tier of event sources, especially:
   - `trees-atlanta`
   - `medshare`
   - `mobilize-us`
   - `atlanta-humane-society`
   - `concrete-jungle`
2. Deepen the `Commit to a Cause` lane so it does not feel dwarfed by drop-in volunteering.

### P2

1. Improve traceability for the `11` org-first ongoing roles where a stable source linkage is possible.
2. Expand the support directory’s `Work, Money & Daily Life` section.

### P3

1. Strengthen statewide institutional civic coverage so `georgia-democracy-watch` is more than a thin edge lane.

## 7) Bottom line

HelpATL now passes the basic content reality test:

- there is enough content
- it is fresh
- the visible links are working
- the portal spans real civic and humanitarian breadth

The main weakness is no longer “do we have enough stuff?” It is “is the mix balanced enough to feel definitive rather than dominated by a few strong sources?”
