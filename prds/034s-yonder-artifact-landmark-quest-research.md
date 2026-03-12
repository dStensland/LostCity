# Yonder Artifact / Landmark / Quest Research

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034i-yonder-gap-closure-plan.md`, `prds/034j-yonder-destination-intelligence-bridge.md`  
**Status:** Draft  
**As of:** 2026-03-12  
**Purpose:** Turn Yonder's artifact, landmark, and quest ideas into a researchable, stageable workstream instead of leaving them as abstract Phase 3 ambition.

---

## 1. Strategic Read

Artifacts, landmarks, and quests are still one of the best differentiators in the Yonder idea.

They matter because they create:

- taste
- repeat visits
- local distinctiveness
- a reason for Yonder to feel more like a motivation engine than a venue database

But they should not be approached as a giant schema-first project.

The right sequence is:

1. research and define the editorial surface
2. seed a high-confidence candidate set
3. validate whether the content is compelling enough to justify the platform primitives
4. only then build the first-class artifact / quest model

---

## 2. Core Distinction

### Destinations

Destinations answer:

- where can I go?
- what can I do there?

Examples:

- Tallulah Gorge
- Chattahoochee Bend State Park
- Whitewater Express Columbus

### Artifacts / Landmarks

Artifacts answer:

- what specific thing is worth noticing, finding, or experiencing?
- what is the story-rich payoff inside or around a destination?

Examples:

- a waterfall
- a fire tower
- an overlook
- a swimming hole
- a river crossing
- a hidden urban green space
- a rock formation
- a public art landmark on an outdoor route

### Quests

Quests answer:

- how do these artifacts become a repeatable exploration loop?

Examples:

- Hidden Waterfalls of North Georgia
- Secret Green Spaces of Atlanta
- River Access Circuit
- Fire Tower Collection

---

## 3. Why This Matters For Yonder

If Yonder only has destinations and campgrounds, it becomes:

- useful
- credible
- but still somewhat interchangeable

If Yonder has strong artifacts and quests, it becomes:

- opinionated
- locally sticky
- better at return visits
- more socially legible

This is the layer that gives the portal soul.

---

## 4. Research Questions

### 4.1 Artifact / landmark scope

What should count as an artifact?

The likely answer is:

- a thing with a specific payoff
- discoverable enough to be pursued intentionally
- editorially worth naming
- distinct from the broader destination that contains it

Likely in scope:

- waterfalls
- overlooks / viewpoints
- swimming holes
- fire towers
- river access landmarks
- unusual rock formations
- hidden urban parks or green pockets
- outdoor art / ruins / oddities when they fit the brand

Likely out of scope:

- generic benches, picnic shelters, or unnamed map clutter
- micro-landmarks with no real narrative or destination value
- geocache-style objects with no broader story or outing value

### 4.2 Quest shape

What kinds of quests are actually compelling?

Likely strongest:

- collections
- circuits
- seasonal sets
- beginner-friendly "starter" quests
- dog-friendly or group-friendly themed runs

Likely weaker:

- pure completionism with no narrative
- overly large quests with high planning burden
- quests that depend on too much user-generated proof at launch

### 4.3 Discovery proof

What counts as completing or discovering an artifact?

Early-stage answer should probably be lightweight:

- self-reported completion
- optional photo
- optional notes

The proof model should not block launch research.

---

## 5. Recommended Research Tracks

## Track A: Candidate Artifact Universe

Build a first editorial candidate set for Georgia / metro Atlanta with a bias toward Yonder's strongest zones.

Priority buckets:

- North Georgia waterfalls
- overlooks and fire towers
- Chattahoochee / water-access landmarks
- BeltLine / urban-outdoor oddities and hidden parks
- iconic but still experiential rock formations / summit markers

Initial research output:

- `100-150` candidate artifacts
- grouped by region
- grouped by artifact type
- grouped by destination parent where applicable

## Track B: Parent-child relationship model

Decide how artifacts hang off the existing destination graph.

Questions:

- when does an artifact belong under a destination?
- when should it stand alone?
- how should artifact pages link back to campgrounds, trails, and destinations?

Expected answer:

- most artifacts should be children of a broader destination
- only a minority need to behave like standalone top-level adventure nodes

## Track C: Launch quest candidates

Draft the first `8-12` candidate quests, then narrow to `5` launchable ones.

Selection criteria:

- clear theme
- reasonable geography
- strong payoff
- low explanation burden
- enough seeded artifact density to feel real

## Track D: Source and enrichment plan

Decide how artifact facts will be acquired and verified.

Likely source families:

- existing venue graph / destination anchors
- official park and forest pages
- editorial/manual research
- high-signal outdoor guides and local publications used only as validation input, not as bulk-ingest truth

The important point:

Artifacts are probably research-led and editorial-led at launch.
That is acceptable.

---

## 6. Proposed Artifact Taxonomy

This should stay intentionally small at first.

Recommended launch types:

- `waterfall`
- `viewpoint`
- `swimming_hole`
- `fire_tower`
- `river_access`
- `rock_formation`
- `hidden_green_space`
- `historic_outdoor_site`
- `oddity`

This is enough variety to feel rich without becoming taxonomy sprawl.

---

## 7. Proposed Quest Taxonomy

Recommended launch types:

- `collection`
- `circuit`
- `seasonal`
- `starter`
- `challenge`

Recommended quest lenses:

- beginner-friendly
- dog-friendly
- date-friendly
- family-friendly
- heat-friendly / summer-friendly
- fall-color / winter-visibility

---

## 8. Launch Recommendation

Yonder should not build the full artifact / quest platform before it has content proof.

Instead:

### Stage 1: Editorial proof

- research and seed artifact candidates
- draft launch quests
- test whether the resulting content actually feels compelling in browse/story form

### Stage 2: Lightweight product proof

- add quest hooks and artifact references into destination intelligence
- use artifact/quest editorial modules before building full progress tracking

### Stage 3: Platform primitive build

- artifact entity model
- quest model
- discovery tracking
- badges and progress loops

That sequence keeps the system honest.

---

## 9. What To Research Next

The immediate artifact / landmark / quest research deliverables should be:

1. a first `100+` artifact candidate sheet
2. a parent-destination map for those candidates
3. a first `8-12` quest slate
4. a recommendation on which `5` quests are strong enough for eventual launch
5. a minimal artifact metadata contract for editorial seeding

---

## 10. Decision Standard

Artifacts and quests are worth building if they make Yonder feel:

- more distinctive
- more repeat-visit worthy
- more narrative
- more likely to get people out into the real world

If they only add taxonomy and complexity, they should wait.
