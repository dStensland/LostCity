# Atlanta Activity Queue A Feasibility

**Portal owner:** `atlanta`  
**Primary consumer:** `hooky` via federation  
**Status:** Batch B1 executed for Tier 1 overlays  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-activity-layer-map.md`, `prds/hooky-next-big-effort-workstream.md`

---

## Purpose

This document turns Queue A from the activity-layer map into an implementation-shaped backlog.

It answers:

1. which targets already have meaningful Atlanta signal in the repo
2. which ones can start as activity overlays on existing source/venue intelligence
3. which ones require true new source work

---

## Big Read

Queue A is stronger than it first appeared.

A large share of the best first-wave activity targets already have one or both of:

- Atlanta-owned source modules
- Atlanta venue/source profiles

That means the first implementation sweep should **not** begin as a pure crawler land grab.

It should begin with:

1. defining activity overlay rules on top of existing Atlanta source/venue intelligence
2. separating durable destination value from dated event/program value
3. only then adding truly missing activity operators

This is the compounding move.

Execution update:

- the full Tier 1 first-wave overlay sweep has now been applied live for the planned `12` destinations
- that sweep added `35` new `venue_features` rows and brought the live total across those venues to `46`
- the remaining work in Queue A is no longer feasibility for those `12`; it is cleanup, federation rules, and second-wave promotion

---

## Queue A Tiers

### Tier 1. Existing Atlanta signal, best first implementation targets

These already have meaningful repo presence and should be the first activity-overlay candidates.

| Target | Repo signal | Recommended move | Why first |
|---|---|---|---|
| Georgia Aquarium | existing source + profile | activity overlay on Atlanta-owned destination + family tags | obvious family flagship |
| Zoo Atlanta | existing source + profile | activity overlay | obvious family flagship |
| Atlanta Botanical Garden | existing source + profile | activity overlay | strong seasonal + perennial utility |
| High Museum | existing source + profile | activity overlay | premium family destination with cross-portal value |
| Children's Museum of Atlanta | existing source + profile | activity overlay | younger-kid family core |
| Fernbank Museum | existing source + profile | activity overlay | durable family destination |
| Fernbank Science Center | existing source | activity overlay / source hardening | educational rainy-day utility |
| Center for Puppetry Arts | existing source + profile | activity overlay | distinctive Atlanta family destination |
| Atlanta History Center | existing source + profile | activity overlay | strong local/tourist crossover |
| Chattahoochee Nature Center | existing source + profile | activity overlay | outdoor family utility |
| LEGO Discovery Center | existing source + profile | activity overlay | high-value rainy-day family destination |
| Stone Mountain Park | existing source + profile | activity overlay with sub-activity framing later | large family destination, not just events |

### Tier 2. Existing Atlanta signal, good second-wave overlays

These are already present enough to matter, but slightly lower priority than Tier 1 for family utility or age clarity.

| Target | Repo signal | Recommended move | Why not first 12 |
|---|---|---|---|
| World of Coca-Cola | existing source + profile | activity overlay | strong visitor value, slightly weaker age targeting |
| Delta Flight Museum | existing source + profile | activity overlay | strong niche family appeal, not as universal |
| College Football Hall of Fame | existing source + profile | activity overlay | useful, but more selective audience fit |
| Illuminarium Atlanta | existing source | activity overlay once age-fit rules are explicit | more selective family suitability |
| Stone Summit | existing source | activity overlay | useful movement/adventure lane, but not as broad as Tier 1 |
| Urban Air Atlanta | existing source + profile | activity overlay with family-fit rules | strong utility, but age/sensory fit needs careful framing |

Execution update:

- `World of Coca-Cola`, `Delta Flight Museum`, `College Football Hall of Fame`, and `Illuminarium Atlanta` are now live as Atlanta-owned activity overlays
- the `Stone Summit` target is now live on the canonical venue row `central-rock-gym-atlanta`
- `Urban Air Atlanta` is now live as a three-location overlay batch on `urban-air-snellville`, `urban-air-buford`, and `urban-air-kennesaw` rather than a fake umbrella destination
- `Andretti`, `Main Event`, `Stars and Strikes`, `Shoot the Hooch`, and `White Water` are now also live as Atlanta-owned activity overlays on existing venue rows
- `Ready Set Fun`, `Yellow River Wildlife Sanctuary`, and both `Treetop Quest` parks are now live as the first true new-venue operator batch
- `Catch Air` is now live as a five-location indoor-play batch on new Atlanta-owned venue rows
- `Fun Spot America Atlanta`, `Southern Belle Farm`, `Monster Mini Golf Marietta`, and `Puttshack Atlanta` are now live as a family-fun batch that widens amusement, farm, and mini-golf coverage
- `Sparkles Family Fun Center (Kennesaw)`, `Noah's Ark Animal Sanctuary`, and `Yule Forest` are now live as a family-outings batch that closes skating, animal, and seasonal family gaps
- `Metro Fun Center`, `Pettit Creek Farms`, and `Margaritaville at Lanier Islands Water Park` are now live as a water / farm / fun batch that widens southside entertainment, animal-farm outings, and summer water utility
- `Sky Zone Atlanta`, `Sky Zone Roswell`, `Uncle Shuck's`, and `Warbington Farms` are now live as a trampoline-and-farms batch that widens all-weather energy-burn and north-metro fall family coverage
- `Main Event Atlanta`, `Stars and Strikes Woodstock`, and `Great Wolf Lodge Georgia` are now live as a final-destinations batch that closes some of the last clear indoor and overnight-family destination gaps

### Tier 3. True new-source targets

These matter, but they are real net-new source work and should follow the overlay wave.

| Target | Likely value | Source shape | Read |
|---|---|---|---|
| Andretti Indoor Karting & Games | high | destination/booking-backed | strong tween/teen/family value |
| Main Event | high | destination/booking-backed | broad indoor family utility |
| Stars and Strikes | high | destination/booking-backed | broad weather-proof family option |
| Catch Air | medium-high | destination page + location stack | strong younger-kid utility |
| Ready Set Fun | medium-high | destination page | strong preschool/elementary value |
| Yellow River Wildlife Sanctuary | medium-high | destination page | distinctive animal destination |
| Treetop Quest Dunwoody | high | attraction page + reservations | high-value adventure category |
| Treetop Quest Gwinnett | medium-high | attraction page + reservations | expands metro spread |
| Shoot the Hooch | medium-high | seasonal operator page | strong summer activity value |
| Six Flags White Water | medium-high | seasonal attraction page | obvious summer family utility |

---

## Recommended First Implementation Sweep

### Sweep 1. Activity overlays on existing Atlanta signal

This was the best first implementation batch, and it is now live:

1. Georgia Aquarium
2. Zoo Atlanta
3. Atlanta Botanical Garden
4. High Museum
5. Children's Museum of Atlanta
6. Fernbank Museum
7. Center for Puppetry Arts
8. Atlanta History Center
9. Chattahoochee Nature Center
10. LEGO Discovery Center
11. Stone Mountain Park
12. Fernbank Science Center

### Why this sweep should go first

- no ownership ambiguity
- broad cross-portal value
- strong family relevance
- existing repo signal lowers implementation risk
- faster path to real Hooky breadth improvement

---

## Implementation Pattern Recommendation

Queue A should not be treated as one uniform source backlog.

It breaks into three implementation patterns.

### Pattern A. Existing Atlanta source -> add activity overlay

Use when:

- source already exists
- venue/profile already exists
- durable destination value is clear

Typical work:

- define the activity metadata record
- connect source/venue to activity object
- derive family-facing tags for Hooky

### Pattern B. Existing Atlanta signal -> harden destination framing

Use when:

- destination source exists
- current shape is event-heavy or mixed
- durable family visit value is under-modeled

Typical work:

- separate permanent destination logic from dated event logic
- clarify family suitability and age-band rules

### Pattern C. True new Atlanta source

Use when:

- destination is clearly valuable
- no strong existing signal exists
- activity layer is meaningfully thinner without it

Typical work:

- register Atlanta-owned source
- create profile / venue intelligence
- crawl or enrich durable destination data

---

## Queue A Output By Work Type

### Best overlay-first targets

- Georgia Aquarium
- Zoo Atlanta
- Atlanta Botanical Garden
- High Museum
- Children's Museum of Atlanta
- Fernbank Museum
- Center for Puppetry Arts
- Atlanta History Center
- Chattahoochee Nature Center
- LEGO Discovery Center
- Stone Mountain Park
- World of Coca-Cola

### Best "harden current signal" targets

- Fernbank Science Center
- Stone Summit
- Urban Air Atlanta
- Illuminarium Atlanta
- Delta Flight Museum
- College Football Hall of Fame

### Best true new-source targets

- Andretti Indoor Karting & Games
- Main Event
- Stars and Strikes
- Catch Air
- Ready Set Fun
- Yellow River Wildlife Sanctuary
- Treetop Quest Dunwoody
- Treetop Quest Gwinnett

---

## Recommended Next Autonomous Batch

The next batch should be:

### Batch B1. Overlay-First Activity Implementation Prep

1. define the exact activity metadata contract for overlay-first targets
2. audit the Tier 1 sources for:
   - current owner
   - current venue profile quality
   - whether they behave like destination pages, event calendars, or mixed sources
3. split Tier 1 targets into:
   - ready for immediate Atlanta-owned activity overlay
   - need signal cleanup first
4. identify the first `4-6` targets to implement without schema changes

### Batch B2. First New-Source Queue Prep

After overlay-first prep:

1. validate the true new-source targets
2. choose the first `3-4` new operators that best widen:
   - rainy-day utility
   - tween/teen utility
   - all-weather spontaneous family utility

---

## Stop Conditions

Stop only if:

1. the activity object clearly requires a schema decision before any overlay work can happen
2. Atlanta ownership becomes ambiguous for a supposedly shared destination
3. an existing Atlanta source is too event-specific to support a durable activity layer without misleading the product

Otherwise, continue autonomously.
