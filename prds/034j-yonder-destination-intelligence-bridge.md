# Yonder Destination Intelligence Bridge

**Parent docs:** `prds/034e-yonder-destination-metadata-contract.md`, `prds/034i-yonder-gap-closure-plan.md`  
**Status:** Draft  
**Purpose:** Define the temporary structured substrate for Yonder destination intelligence until commitment-tier destination metadata becomes a real shared platform primitive.

---

## 1. Why This Exists

Yonder now has a credible 31-destination promoted set in the venue graph across Wave 1, Wave 2, Wave 3, Wave 4, and Wave 5.

What it still does **not** have is a first-class schema for:

- `commitment_tier`
- `destination_type`
- `primary_activity`
- `difficulty_level`
- `best_seasons`
- `weather_fit_tags`
- `drive_time_minutes`

Those fields are central to the product, but they do not yet belong in ad hoc venue columns or one-off UI logic.

So the correct interim step is a **typed bridge layer**:

- structured enough for frontend and recommendation work
- explicit enough to validate
- temporary enough that it can be promoted later into a shared platform model

---

## 2. Current Bridge Artifact

Current source of truth for the seeded regional set:

- config: `web/config/yonder-destination-intelligence.ts`
- validator: `web/scripts/validate-yonder-destinations.ts`
- weekend booking validator: `web/scripts/validate-yonder-weekend-booking.ts`
- overnight support validator: `web/scripts/validate-yonder-overnight-support.ts`
- stay-option validator: `web/scripts/validate-yonder-stay-options.ts`

This bridge currently covers:

### Wave 1
- `amicalola-falls`
- `tallulah-gorge`
- `cloudland-canyon`
- `blood-mountain`
- `springer-mountain`
- `brasstown-bald`
- `raven-cliff-falls`
- `vogel-state-park`
- `fort-mountain-state-park`
- `boat-rock`

### Wave 2
- `desoto-falls`
- `helton-creek-falls`
- `rabun-bald`
- `black-rock-mountain`
- `cohutta-overlook`

### Wave 3
- `sweetwater-creek-state-park`
- `panola-mountain`
- `cochran-shoals-trail`
- `shoot-the-hooch-powers-island`
- `island-ford-crnra-boat-ramp`
- `chattahoochee-bend-state-park`

### Wave 4
- `chattahoochee-river-nra`
- `east-palisades-trail`
- `indian-trail-entrance-east-palisades-unit-chattahoochee-nra`
- `whitewater-express-columbus`
- `etowah-river-park`

### Wave 5
- `red-top-mountain-state-park`
- `hard-labor-creek-state-park`
- `fort-yargo-state-park`
- `don-carter-state-park`
- `unicoi-state-park`

Important nuance:

- the bridge is no longer acting alone for weekend readiness
- Yonder now also uses existing venue planning columns like `reservation_url`, `accepts_reservations`, and `reservation_recommended` for promoted weekend anchors
- that is the right split: keep commitment and conditions logic in the bridge, keep generic planning facts in the venue table
- the bridge now also carries weekend accommodation semantics like `camp_capable`, `cabin_capable`, `lodge_capable`, `operator_bookable`, and `day_use_only`
- the bridge now also carries stay-option semantics like tent sites, cabins, lodge rooms, guide packages, and self-planned scenic objectives
- the bridge now also normalizes booking surface semantics like ReserveAmerica parks, direct lodge booking, direct operator booking, and self-planned objectives
- the bridge now also carries comparison-ready stay profiles like inventory depth, lead-time, and price-signal metadata
- provider-backed accommodation inventory sourcing now lives beside the bridge in `web/config/yonder-accommodation-inventory.ts` so booking providers and unit summaries stop accreting inside destination semantics alone

---

## 3. What Lives In The Bridge

The bridge holds the fields Yonder needs in order to feel intelligent before schema promotion:

- commitment tier
- destination type
- primary activity
- difficulty level
- drive time minutes
- typical duration minutes
- best seasons
- weather fit tags
- practical notes
- why-it-matters framing
- quest hooks

This is intentionally more product-oriented than the venue table.

That is the point.

The venue table stores broadly reusable destination facts.
The bridge stores the Yonder-facing interpretation layer until that interpretation becomes a reusable primitive.

---

## 4. Guardrails

This bridge should be used with discipline.

### Allowed

- powering Yonder browse logic
- driving shelf composition
- generating recommendation copy
- validating seeded anchor readiness

### Not allowed

- becoming a permanent hidden schema
- diverging from the venue graph on identity, slug, or routing
- storing fields that should really be source-fact corrections upstream

---

## 5. Promotion Path

This bridge should eventually promote into a shared destination-intelligence primitive.

Expected promotion targets:

1. destination metadata schema for commitment-tier discovery
2. shared destination taxonomy for future portals
3. conditions-aware recommendation rules that operate on structured fields
4. quest and artifact logic that can reuse the same destination substrate

Until then, the bridge is the right move because it keeps Yonder unblocked without pretending the platform layer already exists.

---

## 6. Immediate Next Use

The next product-development work this bridge should support is:

1. commitment-tier shelf logic for Yonder destinations
2. destination detail presentation that explains effort and payoff clearly
3. conditions-lite recommendation framing for seeded regional anchors

That is the shortest path from “seeded destinations” to “smart adventure discovery.”

The next substrate beyond the bridge is now clear too:

1. provider-backed accommodation inventory summaries
2. eventual unit-count and availability enrichment
3. then real booking-aware ranking
