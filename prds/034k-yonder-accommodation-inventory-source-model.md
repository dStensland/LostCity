# Yonder Accommodation Inventory Source Model

**Parent docs:** `prds/034h-yonder-category-content-analysis.md`, `prds/034i-yonder-gap-closure-plan.md`, `prds/034j-yonder-destination-intelligence-bridge.md`  
**Status:** Draft  
**Purpose:** Separate weekend accommodation-inventory sourcing from the broader Yonder destination-intelligence bridge so booking providers, unit summaries, and future availability work have a clean substrate.

---

## 1. Why This Layer Exists

The Yonder bridge is now strong enough to describe:

- commitment tier
- difficulty
- duration
- weather fit
- overnight semantics
- booking posture
- stay-option semantics
- coarse comparison profiles

That is good product logic, but it is still not the same thing as an accommodation inventory model.

Wave 10 adds a dedicated source model because the next gap is no longer “what kind of trip is this?” It is:

- who is the booking provider?
- what inventory object actually exists?
- how many stay modes are in play?
- is the provider live and price-capable, even if Yonder has not integrated that yet?

Those questions should not stay buried inside destination copy.

---

## 2. Current Artifact

Current source of truth:

- config: `web/config/yonder-accommodation-inventory.ts`
- validator: `web/scripts/validate-yonder-accommodation-inventory.ts`

Current consumers:

- `web/app/api/portals/[slug]/yonder/destinations/route.ts`
- `web/components/detail/YonderAdventureSnapshot.tsx`
- `web/components/feed/sections/YonderRegionalEscapesSection.tsx`

---

## 3. What The Model Covers

The current model covers all `13` promoted weekend anchors.

For each one, it defines:

- normalized provider id
- provider class
- provider live-availability capability
- provider price-discovery capability
- integration status inside Yonder today
- comparison axis
- source note
- unit-level inventory summaries

The current normalized provider set is:

- `ga_state_parks`
- `unicoi_lodge`
- `whitewater_express`
- `self_guided`

This is intentionally narrow. The goal is not to solve all future camping supply now. The goal is to give weekend Yonder content a real provider-backed comparison substrate.

---

## 4. What Counts As Inventory

This model only tracks the inventory object that matters for trip comparison.

Examples:

- state parks: campground, RV pads, cabins
- Unicoi: lodge rooms, cabins, campground
- Whitewater Express: guide packages
- Springer / Cohutta: self-guided scenic objective, no provider inventory

That distinction matters because “weekend-capable” is not the same as “overnight inventory exists.”

---

## 5. Why This Is Better Than More Bridge Semantics

This split is strategically cleaner.

The destination bridge should answer:

- why should I go?
- how hard is it?
- when is it a fit?

The accommodation inventory source model should answer:

- what exactly am I booking?
- through whom?
- how comparable is that inventory?
- how close are we to real availability integration?

That separation gives the portal-provisioning process a reusable pattern for other travel-like or overnight-capable portals later.

---

## 6. What This Unlocks Next

This model is the prerequisite for:

1. provider-level comparison modules
2. unit-count and inventory-shape enrichment
3. availability-aware ranking
4. eventual live booking and price integration

Until then, it gives Yonder a truthful intermediate state:

- provider-backed where real providers exist
- self-guided where they do not
- unit-aware without pretending we have live inventory already
