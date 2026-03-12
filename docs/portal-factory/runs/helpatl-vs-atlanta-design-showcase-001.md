# HelpATL vs Atlanta: Design Showcase Blueprint 001

- Date: 2026-03-07
- Scope: consumer UX + platform capability storytelling
- Goal: show diversity of portal system while proving shared infrastructure leverage

## 1) Strategic Contrast

`atlanta` should feel like a broad city pulse publication.  
`helpatl` should feel like a civic action operating system.

Both run on the same platform primitives (federation, sections, channels, attribution), but should look and behave like different products with different user jobs.

## 2) Current State Snapshot

### Atlanta (live)
- `portal_type=city`
- Sections: `10`
- Interest channels: `0`
- Source subscriptions: `0`
- Nav labels: `Dashboard / Stuff / Places`
- Feed includes broad discovery lanes (nightlife, free events, get involved, wellness)

### HelpATL (live)
- `portal_type=event`
- Sections: `3` (Government Meetings, Volunteer Opportunities, School Board Watch)
- Interest channels: `5`
- Source subscriptions: `11`
- Nav labels: `Civic Feed / Calendar / Community Spots`
- Match materialization enabled (daily cadence, UTC hour 13)
- School-board logic now source-backed (fallback tag rule deactivated)

## 3) UX Positioning Differences (Design)

### Atlanta UX Intent
1. Browsing energy: "What is happening in Atlanta right now?"
2. High variety and serendipity.
3. Editorial flavor over operational utility.

### HelpATL UX Intent
1. Action clarity: "What can I do this week to participate?"
2. Follow/join mechanics as first-class UX.
3. Trust and governance context visible at decision points.

## 4) Showcase Capability Matrix

| Capability | Atlanta (show) | HelpATL (show) | Why it demonstrates platform diversity |
|---|---|---|---|
| Source federation | Implicit, broad local coverage | Explicit civic + volunteer pack (`11` subscribed sources) | Same federation engine supports different source strategy |
| Section orchestration | Discovery-heavy section stack | Mission-focused 3-lane civic stack | Same section model, different IA outcomes |
| Interest channels | Not primary | Core user loop (5 channels) | Proves optional capability layer per portal |
| User follow/join loop | Generic exploration | Jurisdiction + institution + topic follows | Same follows substrate, different semantic model |
| Rule-based matching | Not emphasized | Central (event-channel matches) | Shared data model enables explainable personalization |
| Admin governance | Broad content admin | Channel health + rule tuning + cadence controls | Same admin shell, vertical-specific operator jobs |
| Brand system | Pop-cultural city palette | Civic editorial palette (Sora/Manrope, teal/blue) | No theme-template lock-in; bespoke brand expression |

## 5) Design Moves To Make The Difference Obvious

### A) Hero + Primary CTA
1. Atlanta: rotating editorial hero with trend framing ("Tonight / This Weekend / New").
2. HelpATL: fixed action hero with immediate intents:
   - `Follow your city/county`
   - `Join a volunteer lane`
   - `Track school board meetings`

### B) Navigation Semantics
1. Atlanta nav should stay broad and lifestyle-forward.
2. HelpATL nav should use plain civic verbs: `Act`, `Meetings`, `Groups`, `Impact`.

### C) Feed Card Reasoning
1. Atlanta reason badges can stay light ("Trending", "Near you", "Free").
2. HelpATL cards should always prioritize civic reason labels:
   - `Matched: Fulton County Government`
   - `Matched: Volunteer Opportunities`
   - `Source: Board of Education`

### D) Trust/Provenance Layer
1. Atlanta: provenance secondary.
2. HelpATL: provenance persistent but concise (source + freshness + meeting body).

### E) Interaction Tone
1. Atlanta: exploratory, discovery-first microcopy.
2. HelpATL: actionable, deadline/timebox copy ("Next 7 days", "Before board vote", "Sign up now").

## 6) Capabilities To Highlight In Demo

Use this sequence to "show the same platform, different product":

1. Open Atlanta feed and show broad section diversity.
2. Open HelpATL and show focused civic lanes.
3. Join a HelpATL group/channel.
4. Show matched reasoning in content.
5. In admin, show channel rules and health analytics.
6. Show cadence control and manual match refresh flow.

This sequence demonstrates:
- product diversity at consumer layer
- operational rigor at admin layer
- shared infrastructure underneath

## 7) Immediate UX Enhancements (High Leverage)

### HelpATL
1. Add "My Groups" strip at top of Civic Feed (joined channels first).
2. Add "Upcoming deadlines" component (next 3 meeting dates / volunteer cutoffs).
3. Add lightweight impact recap card ("This week: 7 matched civic opportunities").

### Atlanta
1. Tighten section hierarchy to reduce mission overlap with HelpATL.
2. Reframe civic/volunteer sections as optional discovery lanes, not core funnel.

## 8) Design System Diversity Guardrails

1. Keep typography and palette differentiated (`atlanta` playful vs `helpatl` civic editorial).
2. Keep motion personality differentiated (`atlanta` richer transitions vs `helpatl` restrained, utility-first).
3. Keep component logic shared; vary content framing, priority, and defaults.

## 9) Success Criteria For This Comparison

1. User can describe Atlanta in one sentence as "city discovery."
2. User can describe HelpATL in one sentence as "civic action feed."
3. Demo audience can see same backend capability expressed as distinct products.
4. Operator can tune HelpATL civic outcomes without custom code branches.
