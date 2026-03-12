# Atlanta Activity Overlay Audit

**Portal owner:** `atlanta`  
**Primary consumer:** `hooky` via federation  
**Status:** Batch B1 executed  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/atlanta-activity-queue-a-feasibility.md`, `prds/hooky-activity-layer-map.md`

---

## Purpose

This audit grades the overlay-first targets from Queue A by implementation readiness.

The question is not just:

- does the destination matter?

It is:

- do we already have enough Atlanta-owned signal to turn this into a shared activity layer without misleading the product?

---

## Execution Update

The first overlay-first batch has now been executed live.

Live state:

- all `12` first-wave destinations are now represented in Atlanta via `venue_features`
- `35` new activity overlay rows were applied
- the live total across the `12`-destination pack is now `46` feature rows because `Chattahoochee Nature Center` and `Stone Mountain Park` already had legacy feature rows
- `46 / 46` live feature rows currently have URL support
- a second overlay wave is also live for `5` more targets
- Urban Air is now live as `3` real location overlays rather than one umbrella destination
- a third overlay wave is also live for `7` more targets
- a fourth wave is also live for `4` true new-venue operators
- a fifth wave is also live for `5` Catch Air locations
- a sixth wave is also live for `4` broader family-fun targets
- a seventh wave is also live for `3` skating / animal / seasonal family-outing targets
- an eighth wave is also live for `3` water / farm / fun targets
- a ninth wave is also live for `4` trampoline and north-metro farm targets
- a tenth wave is also live for `3` final destination-style targets
- the total overlay program is now `53` logical targets and `169` live feature rows

Reference:

- `crawlers/reports/atlanta_activity_overlay_sweep_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave2_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_urban_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave3_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave4_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave5_catch_air_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave6_family_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave7_family_outings_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave8_water_farm_fun_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave9_trampoline_and_farms_2026-03-11.md`
- `crawlers/reports/atlanta_activity_overlay_wave10_destinations_2026-03-11.md`
- `prds/hooky-activity-federation-rules.md`

---

## Read

The first-wave activity pack should start with destinations that already have:

1. an Atlanta-owned source module
2. a stable venue/profile footprint
3. obvious cross-portal value
4. low ambiguity about family usefulness

This audit confirms that the first sweep should be mostly overlay work on existing Atlanta signals, not new source creation.

It also confirms that some high-value destinations are not yet activity-ready because their current source shape is too event-heavy or too mixed.

---

## Audit Results

### Ready now

These are the best immediate activity-overlay candidates.

| Target | Current repo signal | Read |
|---|---|---|
| Georgia Aquarium | source + profile + stable venue type | ready for Atlanta-owned family activity overlay |
| Zoo Atlanta | source + profile + stable venue type | ready |
| High Museum | source + profile + strong venue signal | ready |
| Children's Museum of Atlanta | source + profile + explicit family/kids signal | ready |
| Center for Puppetry Arts | source + profile + obvious family destination value | ready |
| Atlanta History Center | source + profile + durable museum/destination framing | ready |
| Chattahoochee Nature Center | source + profile + strong outdoor family utility | ready |
| LEGO Discovery Center | source + profile + attraction-specific framing already present | ready |

### Ready with light cleanup

These are close, but should get minor signal cleanup before being treated as flagship activity overlays.

| Target | Issue | Read |
|---|---|---|
| Atlanta Botanical Garden | strong source, but missing matched profile under the current underscore filename shape | nearly ready |
| Fernbank Museum | strong destination, but current source mixes broad museum/event logic that should be family-framed more explicitly | nearly ready |
| Fernbank Science Center | source exists but no matching profile footprint yet | nearly ready |
| Stone Mountain Park | strong destination value, but current source is tightly event/attraction-card driven and needs cleaner durable-activity separation | nearly ready |

### Cleanup first

These matter, but they should not be first-wave overlays until their source behavior is better separated.

| Target | Main issue | Read |
|---|---|---|
| World of Coca-Cola | destination value is obvious, but family-specific utility is weaker and more tourist-generic | second wave |
| Delta Flight Museum | useful, but narrower audience fit than the core family pack | second wave |
| College Football Hall of Fame | useful, but more selective and less universal for family fallback use cases | second wave |
| Illuminarium Atlanta | strong destination concept, but age-fit and family suitability need explicit rules first | cleanup first |
| Urban Air Atlanta | family-relevant, but the activity layer needs better age-band and sensory-fit framing before it becomes a default family recommendation | cleanup first |
| Stone Summit | useful movement/adventure layer, but less universally family-safe than the top queue | cleanup first |

---

## Why The Ready-Now Set Wins

The ready-now set shares the right characteristics:

- destination-grade usefulness
- obvious family relevance
- strong rainy-day or perennial value
- broad cross-portal usefulness
- low ownership ambiguity
- stable venue identity already in repo

These are the best first targets because they improve Hooky immediately without forcing new platform decisions.

---

## Specific Audit Notes

### Georgia Aquarium

- current source already behaves like a strong Atlanta destination
- family utility is obvious
- some event logic includes non-family inventory, so Hooky federation should remain selective

### Zoo Atlanta

- clean family flagship
- clear activity-layer candidate

### High Museum

- high-value destination with broader Atlanta utility
- family framing should coexist with adult/event framing, not replace it

### Children's Museum of Atlanta

- clearest younger-kid activity overlay candidate
- very strong Hooky value

### Center for Puppetry Arts

- unusually strong Atlanta-specific family destination
- likely one of the highest-value overlays

### Atlanta History Center

- broader city value plus family learning value
- should be included, but Hooky federation should not assume every sub-program is toddler-friendly

### Chattahoochee Nature Center

- strong outdoor family outing value
- good no-school and low-effort fallback utility

### LEGO Discovery Center

- one of the strongest rainy-day family destinations
- clean overlay candidate

### Atlanta Botanical Garden

- should be in the first wave, but fix the profile/signal mismatch first

### Fernbank / Fernbank Science Center

- both belong in the activity layer
- they should likely be handled as a small paired cleanup batch

### Stone Mountain Park

- strategically important
- but it must not repeat the old permanent-attraction-as-event problem
- handle after the first cleaner destination pack

---

## Recommended First 6 Implementations

If the goal is a tight first batch with the best risk/reward tradeoff, start with:

1. Georgia Aquarium
2. Zoo Atlanta
3. Children's Museum of Atlanta
4. Center for Puppetry Arts
5. LEGO Discovery Center
6. Chattahoochee Nature Center

### Why this 6

- two flagship family anchors
- two younger-kid / rainy-day anchors
- one distinctive Atlanta cultural destination
- one outdoor fallback destination

That creates better breadth across:

- indoor vs outdoor
- premium destination vs practical outing
- preschool/elementary utility vs broader all-ages family value

---

## Recommended Second 6

After the first 6:

1. High Museum
2. Atlanta History Center
3. Atlanta Botanical Garden
4. Fernbank Museum
5. Fernbank Science Center
6. Stone Mountain Park

---

## Immediate Next Batch

The next autonomous execution batch should do:

1. curate legacy feature rows on `Chattahoochee Nature Center` and `Stone Mountain Park`
2. define the family-federation inclusion rules for the live `12`-destination pack
3. identify which existing Atlanta highlights should remain distinct from `venue_features`
4. prepare the second overlay wave or the first true new-source activity batch

---

## Stop Conditions

Stop only if:

1. one of the first 6 cannot cleanly be treated as Atlanta-owned shared activity intelligence
2. the activity overlay requires a schema change sooner than expected
3. existing source shape is too tied to dated events to produce a durable activity layer without misleading the product

Otherwise, continue.
