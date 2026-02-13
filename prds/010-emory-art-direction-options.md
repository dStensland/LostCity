# PRD 010: Emory Demo Art Direction Options

## Objective
Choose one high-taste visual direction for `/emory-demo` that:
- Feels premium and emotionally calm
- Converts users into clear next actions (wayfinding, hospital companion, support resources)
- Preserves strict attribution and trust signals without looking "admin"
- Demonstrates LostCity's strategic value: federated intelligence + portal-specific elegance

## Non-Negotiables (All Options)
- One dominant hero moment, one primary action lane, one secondary discovery lane
- Source attribution visible but subtle (not noisy badges everywhere)
- Mobile-first clarity with desktop elegance
- Maximum two ambient effects active at once
- No product-jargon copy in top-of-funnel UI

---

## Direction A: Quiet Clinical Luxury (Recommended)
### Visual Thesis
Sophisticated calm: premium hospitality polish blended with medical confidence.

### Art Language
- Typography:
  - Display: `Canela` style equivalent (or `Cormorant Garamond` fallback)
  - Body/UI: `Söhne` style equivalent (or `Manrope` fallback)
- Palette:
  - Ink navy `#101A2B`
  - Bone `#F3EBDD`
  - Warm brass accent `#C8A670`
  - Hospital blue signal `#2F5E9D`
- Materials:
  - Matte panels
  - Soft gradient light
  - Hairline dividers
  - Minimal glass (only on hero card)

### Composition
- Hero: Left narrative + right "Today at a glance" card
- Primary lane: 3-step journey in a single horizontal progression
- Secondary lane: City wellness tracks as editorial cards (not dashboard tiles)
- Hospital cards: Photo-led or icon-led with one clear CTA

### Motion
- Entrance fade-up
- Gentle light sweep only on primary CTA

### Strategy Fit
- Best balance of conversion and brand prestige
- Supports enterprise sales narrative without feeling B2B tooling
- Keeps trust/attribution cues elegant and legible

---

## Direction B: Civic Editorial Atlas
### Visual Thesis
A modern civic publication aesthetic: intelligent, culturally grounded, trustworthy.

### Art Language
- Typography:
  - Display: high-contrast serif (`Ivar`-like, fallback `Cormorant`)
  - Body: humanist sans (`Graphik`-like, fallback `Manrope`)
- Palette:
  - Slate `#18212B`
  - Parchment `#EFE6D6`
  - Rust `#A65A3D`
  - Forest `#2F5A4B`
- Materials:
  - Editorial blocks
  - Rule lines
  - Subtle map textures

### Composition
- Hero reads like a cover story ("Your care city, tonight")
- Modules behave like chapters
- Strong long-form public-health storytelling area

### Motion
- Section reveal only
- No button sheens or decorative animation

### Strategy Fit
- Strong public-health + federation narrative
- Slightly weaker for immediate concierge conversion than Direction A

---

## Direction C: High Contrast Digital Concierge
### Visual Thesis
Confident, contemporary, app-forward luxury with strong contrast and bold CTA surfaces.

### Art Language
- Typography:
  - Display: geometric serif accent
  - Body: neutral grotesk sans
- Palette:
  - Carbon `#0D1016`
  - Ivory `#F4EEE2`
  - Electric amber `#D9A441`
  - Signal teal `#2F7C72`
- Materials:
  - Crisp panels
  - Strong button states
  - Minimal texture

### Composition
- Faster scan patterns
- High-emphasis CTAs and status chips
- More "product" feeling than "editorial"

### Motion
- Quick reveal + hover elevation
- No ambient visuals

### Strategy Fit
- Excellent for conversion clarity
- Risk: can feel less bespoke/premium than A if not carefully restrained

---

## Recommendation
Choose **Direction A: Quiet Clinical Luxury**.

Why:
- Best reflects your stated goal: "stunning, beautiful, elegant" while proving platform depth
- Communicates trust and sophistication to enterprise buyers
- Keeps concierge actionability high for ROI proof

## Implementation Plan After Selection
1. Implement selected direction on `/emory-demo` only
2. Validate with desktop + mobile screenshots
3. Apply identical design language to:
   - `/emory-demo/hospitals`
   - `/emory-demo/hospitals/[hospital]`
4. Final polish pass:
   - hierarchy tuning
   - attribution subtlety pass
   - animation restraint pass

## Acceptance Criteria
- First screen communicates value in 3 seconds
- Primary action is obvious without scrolling
- UI feels premium with no visual clutter
- Attribution visible where needed, invisible where not needed
- No section looks like admin tooling
