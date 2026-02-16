# Vertical Blueprint Packet Template (Repeatable)

Use this for every new vertical or major portal redesign.

## Metadata
- Vertical:
- Portal slug:
- Customer / property:
- Owner:
- Status:
- Priority:
- Date:

## Surface Declaration (Required)
- Primary surface: `consumer` | `admin` | `both`
- Secondary surface (if any):
- Consumer Portal objective:
- Admin Portal objective:
- Consumer non-goals (explicit):
- Admin non-goals (explicit):

Reference contract:
- `docs/portal-surfaces-contract.md`

---

## BP-1 Strategy Lock
1. Problem statement
2. Target users and jobs-to-be-done
3. Business hypothesis to prove
4. Non-negotiable constraints
5. Success criteria and launch proof points

Output file:
- `prds/<id>-<vertical>-strategy.md`

## BP-1b Content Assessment

Runs immediately after strategy lock. Design is content-driven — you can't design
a great experience without knowing what content exists, what's missing, and what
will change over time. This step audits the real content landscape before any IA
or design work begins.

1. **Content inventory**: What content/data already exists for this vertical?
   - Events, venues, articles, media, listings — audit real volume and quality
   - Sample 10-20 representative items and assess: titles, images, descriptions, metadata completeness
2. **Content gaps**: What content is needed but doesn't exist yet?
   - Missing categories, thin coverage areas, no-image items, stale data
   - What would a user expect to find that we can't show today?
3. **Content voice and tone**: How should this vertical talk?
   - Formal/casual, expert/friendly, editorial/utilitarian
   - Sample headlines and card copy written in the target voice
4. **Content lifecycle**: What changes and how often?
   - Daily (events, showtimes) vs weekly (featured picks) vs seasonal (announcements)
   - Who updates it? Automated crawlers, operators, editorial team?
5. **Hero content**: What's the single best piece of content today?
   - If you had to show one thing to prove this portal's value, what is it?
   - This becomes the design benchmark — if the design can't make this shine, it fails
6. **Content-driven design constraints**: What does the content require from the UI?
   - Heavy on photography? Then cards need large image areas
   - Listings with sparse metadata? Then dense list views won't work
   - Time-sensitive? Then temporal grouping/countdown is essential

Output file:
- `prds/<id>-<vertical>-content-assessment.md`

## BP-2 Consumer IA
1. Primary routes and purpose of each route
2. Journey map by user type
3. Section hierarchy (what appears first and why)
4. Scope boundaries (what is intentionally excluded)

Output file:
- `prds/<id>-<vertical>-consumer-ia.md`

## BP-2b Admin Portal IA (If surface is `admin` or `both`)
1. Admin jobs-to-be-done (management, governance, operations, reporting)
2. Admin route map and permissions model
3. Workflow states and operational handoffs
4. Explicit exclusions from Admin Portal scope

Output file:
- `prds/<id>-<vertical>-admin-ia.md`

## BP-3 Design Direction

This is a multi-step process, not a single document. Each portal must feel like
its own product — radical visual differentiation is strategic. No portal should
look like it came from the same template.

### Step 1: Design Interview

The portal owner answers these questions (brief, gut-level answers):

1. **Emotional register**: What should someone *feel* 3 seconds after landing?
   (playful / premium / community-grassroots / editorial / clinical / adventurous)
2. **Reference**: Name a website or app that feels like what you want
3. **Anti-reference**: Name one that's the opposite of what you want
4. **Color temperature**: Warm / cool / earthy / neon / muted / monochrome?
5. **Density**: Spacious and minimal, or rich and packed?
6. **Photography style**: Editorial / candid / illustrated / icon-driven / UGC?
7. **Typography feel**: Modern geometric / classic serif / handwritten / bold display / monospace?
8. **Motion**: Still and confident, or animated and alive?
9. **Audience sophistication**: First-time internet user, or design-literate urbanite?
10. **One word** that captures the whole vibe:

### Step 2: Inspiration Fetch (Parallel Agents)

Two agents run simultaneously after the interview, each with a different lens.
Both receive the interview answers as input.

**`product-designer` agent** searches for:
- UX patterns from best-in-class products serving this audience
- Information architecture and navigation models
- Interaction patterns (how do the best apps in this space handle discovery, filtering, detail views?)
- Accessibility and mobile patterns for the target demographic
- Competitor and adjacent-space portals

**`frontend-designer` agent** searches for:
- Visual references matching the emotional register and color temperature
- Typography pairings that match the stated feel
- Layout inspiration (grid systems, card treatments, hero patterns, whitespace usage)
- Color palette references with hex values
- Motion/animation references if relevant
- Photography/illustration treatment examples

Both agents return concrete references (URLs, screenshots, descriptions) for
the portal owner to react to before any code is written.

### Step 3: Design Direction Lock

Synthesize interview answers + agent research into a locked direction:

1. **Mood board**: 5-8 curated references with annotations on what to take from each
2. **Color palette**: Primary, secondary, accent, background, text — with rationale
3. **Typography**: Heading + body font pairing, scale, weight usage
4. **Layout model**: Grid, spacing, card style, density
5. **Photography/media treatment**: Aspect ratios, overlay styles, fallback patterns
6. **Motion rules**: What animates, what doesn't, easing, speed
7. **Voice and copybook**: Headline style, CTA language, tone calibration
8. **Anti-patterns**: Explicit list of what this portal must NOT look like

### Step 4: Design Build

Build the portal surfaces using the locked direction as the spec:

- Use `/frontend-design` skill with the mood board and direction doc as input
- Optionally prototype key components in v0.dev first, then port code in
- Every component is bespoke to this vertical — do not default to shared components
- Build mobile-first; desktop is the expansion, not the other way around

### Step 5: Design Review Gate

Before any code merges, run a design review:

- `/design` skill audits visual consistency, spacing, color usage, typography
- `product-designer` agent reviews UX flow, interaction quality, accessibility
- Portal owner does a subjective gut-check: "Does this feel like *my* product?"
- Any "no" from the portal owner sends it back to Step 4, not forward

Output files:
- `prds/<id>-<vertical>-design-interview.md`
- `prds/<id>-<vertical>-inspo-product.md`
- `prds/<id>-<vertical>-inspo-visual.md`
- `prds/<id>-<vertical>-design-direction.md`

## BP-4 Data + Curation Contract
1. Federated data sources
2. Local curation overlays
3. Ranking logic and weighting
4. Freshness/provenance policy
5. Fallback behavior

Output file:
- `prds/<id>-<vertical>-data-contract.md`

## BP-4b Content Schema

Planned alongside the data contract. Defines what content is operator-editable
vs developer-managed, so the portal can be partially self-service after launch.

1. **Operator-editable content** (changeable without code deploys):
   - Hero: headline, subhead, CTA text, CTA URL, background image
   - Featured/pinned content: event or venue IDs, labels, expiration dates
   - Section visibility and ordering
   - Announcements and seasonal messaging
   - Partner logos and sponsor placements
   - Persona labels and descriptions (if applicable)

2. **Developer-managed content** (requires code changes):
   - Source policy and governance rules
   - Ranking algorithms and scoring weights
   - Template structure and layout
   - Component behavior and interactions
   - Route structure

3. **Schema design**: Define the `portals.content` JSONB structure
   ```
   portals.content: {
     hero: { headline, subhead, cta_text, cta_url, image_url },
     sections: [{ type, title, visible, order, config }],
     featured: [{ event_id | venue_id, label, pinned_until }],
     announcements: [{ text, style, active_from, active_until }],
     custom: { /* vertical-specific operator fields */ }
   }
   ```

4. **Admin surface**: What does the editing UI look like?
   - Inline editing? Dedicated admin page? Supabase Studio as stopgap?
   - Who has access? Portal owner only, or delegated operators?
   - What guardrails prevent breaking the experience?

5. **Migration plan**: How does hardcoded content move into the schema?
   - Identify all hardcoded strings, images, and config in current templates
   - Plan the migration to DB-driven content
   - Ensure fallback defaults so empty fields don't break the UI

Output file:
- `prds/<id>-<vertical>-content-schema.md`

## BP-5 Build Map
1. Existing entry routes/components
2. Target route/component architecture
3. State model and URL contract
4. API contracts (reuse or additions)
5. Phase-by-phase build sequencing
6. Content schema implementation (DB migration, admin surface)

Output file:
- `prds/<id>-<vertical>-build-map.md`

## BP-6 Validation Plan
1. UX quality gates
2. Device/browser QA matrix
3. Analytics instrumentation checklist
4. Demo script and scenario tests
5. Content management verification (can an operator update hero copy without a deploy?)

Output file:
- `prds/<id>-<vertical>-validation.md`

---

## Execution Phases (Standard)

1. **Blueprint freeze** — All BP docs reviewed and locked
2. **Content + data foundation** — Source policy, crawlers, content schema migration
3. **Design direction** — Interview → inspo fetch → direction lock (no code yet)
4. **Design build** — Bespoke components via `/frontend-design`, optionally prototyped in v0
5. **Design review gate** — `/design` audit + owner gut-check (loop until approved)
6. **Integration** — Wire design to data layer, personas, modes, ranking
7. **Content management** — Admin surface for operator-editable fields
8. **Validation and extraction** — QA, analytics, mobile, accessibility

## Required Hard Gates
1. Action clarity in <10 seconds
2. Mobile no-horizontal-overflow
3. Consumer Portal and Admin Portal separation is explicit and testable
4. Source attribution/freshness integrity
5. Measurable success metrics attached to key UX flows
6. **Design review passed** — portal owner approved the visual direction
7. **Content self-service verified** — operator can update hero/featured/announcements without a deploy

## Surface Acceptance Gate (Required)
Before launch, confirm all of the below:
1. Surface target is declared for every major feature.
2. Consumer UI has no admin/operator language or controls.
3. Admin UI contains required operational depth and controls.
4. Shared infrastructure is allowed; mixed UX intent is not.

## Handoff Package
Before launch, ship:
1. Blueprint packet files (BP-1 through BP-6, including 1b and 4b)
2. Design interview and inspiration docs
3. Change log of implemented routes/components
4. QA report
5. Metrics tracking spec
6. Content schema documentation (what's editable, where, by whom)
7. "Next portal reuse" notes — what worked, what to steal, what to avoid
