# PRD 011: Emory Demo Visual Direction Reset

## Why this exists
The previous implementation optimized flows and components before locking a visual thesis. This reset enforces the opposite sequence:
1. Approve a visual direction first.
2. Validate first-fold quality before any broad buildout.
3. Implement page-by-page only after each gate passes.

No new UI code should be written until Direction selection is approved.

---

## Non-negotiable Design Bar
- Must read as premium consumer product, not enterprise dashboard.
- Must feel calm and emotionally safe without becoming flat or sterile.
- First fold must communicate value in under 3 seconds.
- Primary action must be obvious with one visual focal point.
- Provenance must be present but subtle; never noisy badge spam.
- Copy must be concise, human, and non-literal.

---

## Direction 1: Luminous Clinical Calm (Recommended)
### Core feel
High-end hospitality + clinical confidence.

### Visual language
- Typography:
  - Display: `Cormorant Garamond` (600)
  - UI/body: `Manrope` (500/600)
- Palette:
  - Night Ink: `#0D1727`
  - Soft Bone: `#EFE6D7`
  - Warm Metal: `#C8A56A`
  - Signal Blue: `#2F5E9D`
  - Mist: `#A6B2C3`
- Materials:
  - Matte surfaces first
  - One glass panel max per viewport
  - Hairline separators, minimal shadows

### Composition
- Hero split 65/35: narrative left, “today context” right.
- One clean three-step lane beneath hero (moment, campus, next move).
- City wellness as editorial cards with image-led top edge, not boxed widgets.
- Hospital cards with one primary CTA and one secondary action only.

### Motion
- 450ms fade-up section reveal.
- One subtle sheen effect on primary CTA only.

### Voice sample
- Hero line: “Care guidance, composed for real life.”
- Supporting: “A calm path through care, campus logistics, and trusted city support.”

### Failure modes to avoid
- Over-dark overlays that kill legibility.
- Excessive chips/pills creating dashboard noise.
- Verbose explanatory copy in first fold.

---

## Direction 2: Modern Civic Editorial
### Core feel
Confident public-service editorial with cultural intelligence.

### Visual language
- Typography:
  - Display: high-contrast serif treatment
  - Body: neutral sans with larger line-height
- Palette:
  - Slate: `#1A2230`
  - Parchment: `#F0E8DA`
  - Rust: `#A15B44`
  - Forest: `#315A4B`
- Materials:
  - Flat editorial planes
  - Rule lines and chapter-like section labels
  - Zero glassmorphism

### Composition
- Hero reads like a headline + deck from a premium publication.
- Sections framed as chapters.
- Strong city-health storytelling lane.

### Motion
- Section reveal only, no sheen/ambient effects.

### Failure modes to avoid
- Looking like a municipal website.
- Losing concierge conversion clarity in favor of narrative.

---

## Direction 3: Precision Concierge Noir
### Core feel
High-contrast, high-control digital concierge with luxury confidence.

### Visual language
- Typography:
  - Display serif with tight tracking
  - Sans UI labels with strict uppercase hierarchy
- Palette:
  - Carbon: `#0A0E14`
  - Ivory: `#F4EEE2`
  - Brass: `#D8AE66`
  - Teal Signal: `#2D7B72`
- Materials:
  - Crisp cards
  - Strong borders
  - No gradients beyond hero

### Composition
- Strong single action rail.
- Dense utility without visual clutter.
- Aggressive hierarchy through contrast.

### Motion
- Minimal hover and press states only.

### Failure modes to avoid
- Looking like fintech tooling.
- Losing warmth/trust for vulnerable care contexts.

---

## Approval Gates (Must pass in order)

## Gate 1: Visual Proof (no code review yet)
Deliverables:
- 3 static first-fold comps (desktop + mobile) for selected direction candidate.
- One typography board and one color/material board.

Pass criteria:
- Hero readability score >= 9/10.
- Primary CTA clear within 1 second glance.
- No section resembles admin UI.

## Gate 2: Home Page Implementation
Scope:
- `/emory-demo` only.

Pass criteria:
- Visual parity to approved comp >= 90%.
- No copy paragraph over 22 words in first fold.
- Attribution visible exactly once in first two scrolls.

## Gate 3: Directory Implementation
Scope:
- `/emory-demo/hospitals`

Pass criteria:
- Card hierarchy and spacing match direction.
- Per-card action stack limited to 2 core actions + optional call.
- Cognitive load lower than current baseline.

## Gate 4: Hospital Companion Implementation
Scope:
- `/emory-demo/hospitals/[hospital]`

Pass criteria:
- Service/food/stay sections read as concierge, not operations dashboard.
- Wayfinding action is dominant and elegant.
- City wellness lane is clearly secondary but discoverable.

---

## Practical Build Constraints
- Max 2 active visual effects per page.
- Max 3 accent colors at once.
- No more than 2 button styles per viewport.
- No repeated trust copy blocks; one provenance statement per major lane.

---

## Recommendation
Pick **Direction 1: Luminous Clinical Calm**.
It best matches your strategy: premium, elegant, emotionally safe, and conversion-oriented without looking like product ops tooling.

