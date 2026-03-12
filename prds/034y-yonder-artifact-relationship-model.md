# Yonder Artifact Relationship Model

**Parent docs:** `prds/034s-yonder-artifact-landmark-quest-research.md`, `prds/034w-yonder-artifact-reference-contract.md`, `prds/034x-yonder-launch-artifact-slate.md`  
**Status:** Draft  
**As of:** 2026-03-12  
**Purpose:** Define the minimum relationship model for Yonder artifacts so the product can distinguish standalone landmarks from artifacts that are represented by broader destination pages.

---

## 1. Strategic Read

Yonder now has enough artifact content that the old shortcut is no longer good enough:

- `artifact.title`
- `artifact.spotSlug`

That structure assumes every artifact is just a one-to-one spot.
That is not true.

Some artifacts are:

- actual standalone places
- sub-landmarks inside bigger destinations
- artifact ideas that should currently resolve through a broader parent page

So the minimum viable bridge is not a new schema yet.
It is an explicit relationship layer in the launch-artifact config and API.

---

## 2. Current Relationship States

The current launch model uses three relationship states:

- `standalone_spot`
- `parent_destination`
- `child_landmark`

### `standalone_spot`

Use when the artifact already has its own real place page and should be treated as a destination in its own right.

Examples:

- `krog-street-tunnel`
- `folk-art-park`
- `driftwood-beach`

### `parent_destination`

Use when the artifact concept is real, but the current product should route through a broader parent destination page instead of inventing a sub-place row.

Examples:

- `Amicalola Falls` via `amicalola-falls`
- `Arabia Mountain summit slab` via `arabia-mountain`
- `Powers Island put-in` via `shoot-the-hooch-powers-island`

This is the correct current state for many scenic payoffs, summit markers, and access points.

### `child_landmark`

Use when the artifact has its own place row but should still be legible as part of a parent context.

Examples:

- `milledge-fountain` inside `grant-park`
- `dolls-head-trail` inside the broader `constitution-lakes` context

This lets Yonder preserve legibility without flattening everything into a single tier.

---

## 3. Minimum Fields

The bridge now needs these fields per launch artifact:

- `spotSlug`
- `parentSpotSlug`
- `relationshipKind`

That is enough to answer:

- where should the card link?
- is this a standalone place or a parent-projected artifact?
- should the UI say `Inside Grant Park` or `Via Arabia Mountain`?

---

## 4. Product Use

The current relationship model should power:

- quest shelves
- artifact cards
- future artifact browse pages
- future quest detail pages

Recommended UI treatment:

- `standalone_spot`
  - no extra relationship label unless helpful
- `parent_destination`
  - lightweight cue like `Via Arabia Mountain`
- `child_landmark`
  - lightweight cue like `Inside Grant Park`

This is enough explanation for launch.

---

## 5. Why This Is Better Than More Seeding

Without this relationship layer, Yonder gets pushed toward the wrong behavior:

- seeding lots of thin one-off rows
- pretending route features are full places
- creating more clutter than meaning

With the relationship layer, Yonder can:

- keep standalone places where they make sense
- keep parent-routed artifacts where that is cleaner
- delay the full artifact schema until the product really needs it

That is the right tradeoff for launch.

---

## 6. Examples From The Current Launch Set

### Standalone

- `Driftwood Beach`
- `Krog Street Tunnel`
- `Folk Art Park`

### Parent-destination projections

- `Brasstown Bald summit deck` via `brasstown-bald`
- `Blood Mountain summit` via `blood-mountain`
- `Constitution Lakes boardwalks` via `constitution-lakes`
- `Cochran Shoals river edge` via `cochran-shoals-trail`

### Child landmarks

- `Milledge Fountain` inside `Grant Park`

---

## 7. What Still Waits

This bridge does not solve everything.

Still deferred:

- first-class artifact IDs in the database
- artifact-to-quest join tables
- proof/completion tracking
- multi-stop collection artifacts

That is fine.

The current relationship model is the right interim step because it improves product truth without forcing premature schema expansion.
