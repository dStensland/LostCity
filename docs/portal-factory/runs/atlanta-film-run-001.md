# Atlanta Film Run 001

## Scope Lock

- Client: Lost City internal vertical demo
- Vertical: Film
- Portal slug: `atlanta-film`
- Positioning: Film discovery and community coordination for Atlanta
- In scope: movie showtimes, indie/repertory cinema, film festivals/series, film-group activity
- Out of scope: streaming recommendations, box-office editorial, ticketing checkout

## Persona Priority

1. Film enthusiast looking for what to watch this week
2. Indie cinema regular looking for repertory and special screenings
3. Festival attendee tracking upcoming film programs
4. Film creator/student looking for community and workshops

## Unified UX Contract

- One shared layout and visual system across personas.
- Persona adaptation changes ranking and default emphasis, not the component system.
- Primary actions: open screening detail, save plan, navigate to venue/source.
- Attribution and freshness should be visible where user chooses what to attend.

## Source Contract (Current)

- Tier 1: Atlanta-native film and cinema sources (Plaza, Tara, Landmark Midtown, springs/chain cinemas, Atlanta Film Festival, Atlanta Film Society)
- Tier 2: Film-adjacent arts/community sources (SCAD FASH, WeWatchStuff, ArtsATL when active)
- Tier 3: Broad arts/culture sources used only for overflow discovery
- Exclusions: non-Atlanta sources, sports-first/event-only streams, low-confidence duplicates

## First Quality Gate Check

| Gate | Status | Notes |
|---|---|---|
| Brand fidelity | In progress | Film-first palette and copy direction defined in portal config |
| Action clarity | Pass | Feed sections map directly to user jobs: now showing, indie, festivals, community |
| Attribution integrity | In progress | Source-level visibility must be validated on cards in UI pass |
| Persona coherence | In progress | Ranking and default mode tuning to follow after baseline traffic review |
| Mobile quality | In progress | Needs screenshot pass on section density/readability |
| Scope guardrail | Pass | No non-film concierge or checkout workflows included |

## Next Iteration Focus

1. Validate section quality against real upcoming screenings and prune noisy sources.
2. Add curated editorial lists for "indie essentials" and "this month in festivals."
3. Tighten mobile card hierarchy for showtime-heavy rows.
4. Capture launch metrics on section CTR and source-level conversion.
