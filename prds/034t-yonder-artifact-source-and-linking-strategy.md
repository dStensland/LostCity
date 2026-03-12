# Yonder Artifact Source And Linking Strategy

**Parent docs:** `prds/034s-yonder-artifact-landmark-quest-research.md`, `prds/034r-yonder-route-curation-strategy.md`, `prds/034-yonder-adventure-portal.md`  
**Status:** Draft  
**As of:** 2026-03-12  
**Purpose:** Define which external guide/editorial sources should inform Yonder artifacts, landmarks, and quests, and how those sources should appear in product.

---

## 1. Strategic Read

Yonder should absolutely use Atlas Obscura and strong travel/outdoor guides for artifact discovery and editorial proof.

But it should use them in the right role:

- discovery input
- validation input
- outbound reading / route-depth support
- editorial reference on cards or detail pages

It should **not** use them as a bulk-import truth layer.

The goal is not to become a scraper of third-party editorial content.
The goal is to become a better organizer of real-world exploration, while clearly crediting good external guides where they add value.
It should also respect explicit opt-outs from creators, operators, or venues and exclude those artifacts from Yonder planning.

---

## 2. Best Source Roles

The external source pack for artifacts should be split by job.

### 2.1 Oddities / landmarks / unusual history

Best fit:

- [Atlas Obscura Georgia](https://www.atlasobscura.com/things-to-do/georgia)
- [Atlas Obscura Atlanta](https://www.atlasobscura.com/things-to-do/atlanta-georgia)

Why:

- strong for oddities, hidden landmarks, unusual history, outsider art, and narrative payoff
- especially useful for urban artifacts and "mildly weird" Yonder content

Good examples from the current research pass:

- [Folk Art Park](https://www.atlasobscura.com/places/folk-art-park)
- [Atlanta Glass Treehouse](https://www.atlasobscura.com/places/atlanta-glass-treehouse-loft)
- [12 Places to Experience Unusual History in Georgia](https://www.atlasobscura.com/things-to-do/georgia/history)
- [10 Places to Experience Unusual Art in Georgia](https://www.atlasobscura.com/things-to-do/georgia/art)

### 2.2 Outdoor hike / waterfall / route-adjacent curation

Best fit:

- [Atlanta Trails](https://www.atlantatrails.com/)

Why:

- strong for Georgia hikes, waterfalls, route flavor, trail effort, and outing quality
- useful when Yonder wants one credible "how to do this hike" or "why this route is worth it" reference without trying to own full route-catalog depth

Example from the current research pass:

- [Panther Creek Trail: Yonah Dam to Panther Creek Falls](https://www.atlantatrails.com/hiking-trails/panther-creek-falls-trail-yonah-dam/)

### 2.3 Official tourism / destination framing

Best fit:

- [Explore Georgia](https://exploregeorgia.org/)

Why:

- strong for destination framing, natural wonders, regional hidden-gem packaging, and travel inspiration
- useful as a secondary guide layer around landmarks, scenic areas, and weekendable experiences

Examples from the current research pass:

- [6 Natural Wonders in Georgia](https://exploregeorgia.org/things-to-do/article/6-rare-mysterious-landscapes-in-georgia)
- [Georgia Hidden Gems: Historic Banning Mills](https://exploregeorgia.org/things-to-do/article/georgia-hidden-gem-historic-banning-mills)

### 2.4 Official park / forest / operator pages

Best fit:

- Georgia State Parks
- NPS / USFS / USACE
- official destination/operator sites

Why:

- canonical facts
- logistics
- hours / permits / access / booking
- stronger trust than third-party summaries for practical planning

This is still the authoritative layer.

---

## 3. Recommended Source Hierarchy

For artifact work, Yonder should use this order:

### Tier 1: Canonical facts

- official park / forest / operator pages
- existing venue graph

Use for:

- names
- coordinates
- access
- hours
- permit and logistics facts

### Tier 2: Editorial discovery and validation

- Atlas Obscura
- Atlanta Trails
- Explore Georgia
- high-signal local guides when clearly useful

Use for:

- candidate discovery
- "why this matters" framing
- quest ideas
- editorial references and outbound links

### Tier 3: Avoid as primary truth

- generic listicles with weak sourcing
- map mirrors
- SEO spam "hidden gems" pages

Use only if they point back to stronger original surfaces.

---

## 4. Product Recommendation

The user suggestion is correct:

Artifacts should probably surface external guide references either:

- in a small blurb-card/footer pattern
- or through the existing accolades/editorial-mentions pattern

The best first move is to reuse what already exists.

### Current reusable pattern

The repo already has:

- `editorial_mentions` in the DB
- `AccoladesSection` in [AccoladesSection.tsx](/Users/coach/Projects/LostCity/web/components/detail/AccoladesSection.tsx)
- `editorialMentions` loading in [spot-detail.ts](/Users/coach/Projects/LostCity/web/lib/spot-detail.ts)

That means the simplest first product pattern is:

1. keep artifact pages or destination pages as the main narrative surface
2. show external guide references as a small "Further Reading" / "Seen In Guides" section
3. use outbound links with explicit source labels

This is better than inventing a separate one-off artifact-source component first.

---

## 5. Implementation Recommendation

### Phase 1: Reuse current accolades pattern

For artifact or destination detail pages:

- add artifact-friendly `source_key` values
- treat Atlas Obscura / Atlanta Trails / Explore Georgia references like editorial mentions
- show them in a Yonder-toned section that can visually sit near the story or practical notes

This is the fastest path because the UI and DB pattern already exist.

### Phase 2: Add artifact-specific source shape if needed

Only add a dedicated artifact-source table if we need fields the current pattern cannot express, such as:

- artifact-specific recommendation reason
- route-vs-story distinction
- destination-child scoping
- quest-specific source references

Until then, reusing the editorial-mention pattern is cheaper and more coherent.

---

## 6. Source Keys Worth Adding Later

If Yonder starts persisting these guide references in `editorial_mentions`, the likely next source keys are:

- `atlas_obscura`
- `atlanta_trails`
- `explore_georgia`

Optional later:

- `only_in_georgia`
- `ajc_outdoors`
- other local guide brands if the quality bar is high enough

This should be a deliberate allowlist expansion, not an open-text free-for-all.

---

## 7. Card-Level Pattern Recommendation

For artifact cards or destination cards, use a lightweight source cue only when it adds real value.

Good card-level patterns:

- `Seen in Atlas Obscura`
- `Guide: Atlanta Trails`
- `Hidden Gem: Explore Georgia`

Keep these small and secondary.
They should support curiosity, not overwhelm the card.

On detail pages, use the fuller accolade/reference treatment.

---

## 8. Quest Implication

These sources are useful for quests too.

Atlas Obscura is especially helpful for:

- oddities
- unusual history
- outsider art
- urban curiosity quests

Atlanta Trails is especially helpful for:

- waterfall quests
- trail-linked artifact quests
- hike-worthy overlook quests

Explore Georgia is especially helpful for:

- scenic / weekendable quest framing
- statewide natural-wonder collections

This means the same source pack can support both:

- artifact seeding
- quest ideation

Related docs:

- `prds/034u-yonder-artifact-candidate-sheet.md`
- `prds/034v-yonder-quest-slate.md`
- `prds/034w-yonder-artifact-reference-contract.md`

---

## 9. Recommended Near-Term Source Pack

For immediate research, use this as the Yonder artifact source pack:

1. Atlas Obscura Georgia + Atlanta
2. Atlanta Trails
3. Explore Georgia
4. official park / forest / operator pages for validation

That is enough to start the first candidate sheet without turning the research phase into source sprawl.

---

## 10. Immediate Next Move

The next artifact/quest research pass should:

1. pull the first candidate slate from Atlas Obscura Georgia/Atlanta
2. pull the first outdoor/payoff slate from Atlanta Trails and Explore Georgia
3. cluster candidates by artifact type and parent destination
4. note which candidates are strong enough for:
   - artifact cards
   - landmark blurbs
   - future quests
