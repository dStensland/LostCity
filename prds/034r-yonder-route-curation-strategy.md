# Yonder Route Curation Strategy

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034i-yonder-gap-closure-plan.md`, `prds/034p-yonder-camping-trail-coverage-workstream.md`  
**Status:** Draft  
**As of:** 2026-03-12  
**Purpose:** Make Yonder's trail stance explicit: own decision quality and destination context, not exhaustive route-catalog depth.

---

## 1. Strategic Read

Yonder should not try to win on trail comprehensiveness.

That is the wrong competition and the wrong use of time.

Specialist products like AllTrails already win on:

- long-tail route density
- route reviews and ratings
- GPX / map utility
- route-specific comparison at large scale

Yonder should win on:

- what is worth doing
- how much time it takes
- why this outing is worth the effort
- whether it fits the weather, season, and crew
- what to pair it with nearby
- whether it turns into a day trip or weekend plan

That means the trail model should be **supportive, not exhaustive**.

---

## 2. What Yonder Should Own

Yonder should own the layers that help users decide:

- destination framing
- commitment tier
- primary activity and difficulty framing
- practical notes and payoff
- nearby support nodes like campgrounds, boat ramps, parking, and overlooks
- outbound recommendations to the right next tool when route depth is needed

The route itself is often not the product.
The outing is the product.

---

## 3. What Yonder Should Not Own

Yonder should not try to build:

- a statewide route directory
- a trail review/rating system
- exhaustive route segmentation and alternates
- route recording or fitness tracking
- deep route map tooling that already belongs to specialist products

The PRD already hints at this correctly:

- "Trail rating/review system (AllTrails does this fine)" is explicitly out of scope in [034-yonder-adventure-portal.md](/Users/coach/Projects/LostCity/prds/034-yonder-adventure-portal.md)

The same logic should extend to broader route comprehensiveness.

---

## 4. Recommended Product Pattern

### 4.1 Yonder's role

Yonder should present:

- the destination
- the reason to go
- the effort/payoff framing
- the right commitment shelf
- the weather/season angle
- a recommended route or canonical trail where that materially helps

### 4.2 Specialist route-curator role

When the user needs more detail, Yonder should link out to:

- AllTrails
- official park or forest route pages
- operator or destination pages with authoritative route guidance

This is not a failure state.
It is the right division of labor.

### 4.3 Data contract implication

Yonder does not need 30 route variants per destination.

It needs:

- one or a few canonical route references
- an outbound URL when route-detail depth is useful
- clear explanation of why this destination is worth the trip

---

## 5. Minimal Trail Support Model

The internal trail layer should be just strong enough to support Yonder's actual jobs.

### Tier 0: Required

- canonical trail or destination row
- slug
- destination relationship where applicable
- short description
- primary activity
- rough effort / difficulty

### Tier 1: Useful

- trail distance or typical duration
- trailhead or access cue
- parking or permit note
- official route page URL
- route-curator URL when deeper comparison is helpful

### Tier 2: Explicitly optional

- multiple alternates
- user ratings
- reviews
- detailed surface/elevation breakdown
- crowd-sourced GPX richness

That is where Yonder should stop.

---

## 6. UX Pattern Recommendation

Destination pages should use a simple escalation model:

1. Yonder explains the outing.
2. Yonder gives the user enough structure to decide if it fits.
3. Yonder offers a `See detailed routes` / `Open full trail guide` link when deeper route exploration is needed.

This keeps Yonder from pretending it has route depth it does not need to own.

---

## 7. Content Strategy Implication

Trail seeding should now be judged by one question:

Does this trail materially improve Yonder's destination and recommendation quality?

Good reasons to seed:

- it is the canonical route for a major destination
- it unlocks an important trailhead/access pattern
- it supports a quest or artifact cluster later
- it improves a high-value regional anchor page

Bad reasons to seed:

- it exists
- it adds long-tail count
- it makes the trail total look bigger

---

## 8. Near-Term Operating Rules

1. Keep canonical trail coverage where it supports destination quality.
2. Stop treating the remaining trail backlog as a comprehensiveness problem.
3. Add outbound route links as a first-class support layer in Yonder planning.
4. Prioritize campground, water-access, and overnight depth ahead of long-tail trail rows.
5. Use official park/forest pages before third-party curators where those official pages are strong enough.
6. Use AllTrails and similar products when specialist route depth is genuinely better than the internal layer.

---

## 9. Immediate Next Move

The next route-related work should be:

1. define a small outbound-route-link contract for destination pages
2. add route-link support to the Yonder destination intelligence layer where helpful
3. stop expanding trail coverage unless it directly improves a promoted destination, campground, artifact, or quest concept
