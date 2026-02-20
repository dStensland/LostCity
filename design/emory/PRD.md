# PRD: Emory Healthcare Consumer Portal

## Document Info
- **Product**: Emory Healthcare Consumer Portal (vertical demo within LostCity platform)
- **Status**: Design comp phase — seeking visual design prototypes
- **Date**: 2026-02-19
- **Context**: Pre-implementation direction comps for strategy, UX tone, and information architecture alignment

---

## 1. Product Overview

### 1.1 What This Is

The Emory Consumer Portal is a **white-label consumer-facing web experience** that helps patients, caregivers, visitors, and community members discover practical support, local services, and community health programs around Emory Healthcare facilities in Atlanta.

It is one vertical within the **LostCity platform** — a federated portal system that powers bespoke discovery frontends for organizations (hotels, hospitals, film festivals, universities) from a shared data layer of 500+ crawled Atlanta sources, 2,300+ venues, and real-time event data.

### 1.2 What This Is NOT

- Not an EHR/patient portal (no medical records, no appointment scheduling, no clinical data)
- Not an admin/operator tool (there is a separate Admin Portal for content management)
- Not a themed version of the default LostCity city portal — the architecture explicitly calls for **radically different frontends per vertical**, not shared templates
- Not a ticketing or booking platform

### 1.3 Strategic Context

This portal serves as a **sales demo vertical** to prove the LostCity platform's value for healthcare systems. The pitch: "Your patients, caregivers, and employees don't stop needing support at the hospital door. We connect them to the city around them — food, pharmacy, quiet spaces, community programs — branded as you."

Target customers beyond Emory: Grady, Children's Healthcare, Northside Hospital, Piedmont Health, and any health system that wants to differentiate on experience.

### 1.4 The Core Insight

People at hospitals are in high-stress, low-information situations. They need answers to practical questions fast:

- "Where can I eat breakfast near this hospital right now?"
- "Is there a pharmacy open late near campus?"
- "Where can I sit quietly between rounds?"
- "Are there community health programs my family can join?"
- "What's available for caregivers who are here overnight?"

The portal turns these moments of need into structured, navigable, fast-to-resolve discovery flows.

---

## 2. Target Users

### 2.1 Primary Personas

#### The Caregiver (Primary)
- **Who**: Family member or friend supporting a patient through a hospital stay or series of visits
- **Context**: Exhausted, stressed, unfamiliar with the area, making decisions under pressure
- **Needs**: Fast breakfast nearby, pharmacy pickup, quiet spaces to rest, evening support groups, affordable lodging
- **Device**: Mobile phone (70%+), often with poor hospital WiFi
- **Key constraint**: Time-poor. Wants answers in under 30 seconds, not browsing

#### The Patient (Secondary)
- **Who**: Person receiving care at Emory, either outpatient or recently discharged
- **Context**: Navigating between appointments, waiting, recovering, adjusting to post-discharge life
- **Needs**: Food that meets dietary restrictions, medication pickup, transportation, gentle movement/recovery programs
- **Key constraint**: May have accessibility needs (mobility, vision, cognitive), dietary restrictions, limited energy

#### The Hospital Employee (Secondary)
- **Who**: Nurses, doctors, technicians, administrative staff
- **Context**: Working long shifts, limited break windows, familiar with campus but not always the surrounding area
- **Needs**: Quick meals during short breaks, late-night options for night shift, stress-relief programs, professional development
- **Key constraint**: 15-30 minute windows for meals/breaks. Speed is everything

#### The Community Member (Tertiary)
- **Who**: Atlanta resident interested in health and wellness
- **Context**: Not necessarily a patient — exploring community health programming, preventive care, fitness
- **Needs**: Free health screenings, fitness classes, nutrition workshops, neighborhood health events
- **Key constraint**: Wants to know what's happening near them this week, not in general

### 2.2 Accessibility Requirements

This is a healthcare audience. Accessibility is not optional, it is foundational.

- **WCAG 2.1 AA compliance** minimum (AAA preferred for text contrast)
- Keyboard-navigable with visible focus indicators on every interactive element
- Screen reader compatible with proper ARIA attributes, semantic HTML, heading hierarchy
- Minimum touch targets of 44x44px on mobile
- Minimum body text of 14px (0.875rem); nothing readable below 12px (0.75rem)
- Respect `prefers-reduced-motion` and `prefers-color-scheme`
- Community needs tags integration (wheelchair-accessible, dietary options, family-friendly) are already built in the LostCity data layer and should be surfaced prominently
- Time-sensitive content (open hours, event times) should use `<time>` elements

---

## 3. Information Architecture

### 3.1 Temporal Framework: Now / Then / Next

Every page in the portal uses a **three-act temporal structure** that maps to how people at hospitals actually think:

| Section | Intent | Example Content |
|---------|--------|----------------|
| **Now** | What can I do right this moment? | Open restaurants nearby, available quiet spaces, pharmacy open now |
| **Then** | What's my next practical need? | Pharmacy after breakfast, lodging tonight, ride coordination |
| **Next** | What's happening later this week? | Community programs, caregiver support groups, health screenings |

This structure should be visually distinct across sections — the "Now" section should feel urgent and actionable, "Then" should feel planning-oriented, and "Next" should feel exploratory and community-driven.

### 3.2 Portal Navigation

The portal has four primary screens, each serving a different intent:

```
[Hospital Now]  [Concierge]  [Community]
      |              |             |
   Urgency       Planning      Belonging
```

#### Screen 1: Hospital Now (Flagship)
**Intent**: "Find the best next option near this hospital in under 30 seconds."

This is the elite demo screen. It should feel like a precision tool — confident, fast, opinionated. The page makes a decision for you (ranked results) rather than overwhelming with options.

**Content zones**:
1. **Hero**: Declares the value prop. Single CTA. Contextual photo.
2. **Decision Flow (Now)**: Pre-filtered ranked results based on current time, proximity, and user needs. Interactive filter pills to refine (time of day, food type, dietary needs, budget, walkability). Top 3 ranked results with distance, tags, and one-tap directions.
3. **Sidebar: Quick Switch**: "Need something else?" — pivot to pharmacy, quiet spaces, caregiver support without leaving the page.
4. **Next Needs (Then)**: After breakfast, what else? Pharmacy, quiet spaces, caregiver reset classes.

**Key interactions**:
- Filter pills are toggleable (e.g., "Low sodium", "Kid friendly", "Under $20", "Walkable")
- Each ranked result has a "Get Directions" CTA that could link to maps
- "Quick switch" sidebar lets user change context (breakfast → pharmacy → quiet spaces)

#### Screen 2: Hospital Hub
**Intent**: "Start with what you need right now." — the general-purpose front door.

Less opinionated than Hospital Now. Broader discovery surface. Good for users who don't have a specific need yet.

**Content zones**:
1. **Hero**: Welcoming, broad value prop. CTA to "Find What Is Nearby."
2. **Around Emory (Now)**: Explore-chip filters (Breakfast, Coffee, Quiet spaces, Pharmacy, Transit). Place list with distance, hours, tags, directions.
3. **Sidebar: Quick Picks by Moment**: "Before appointments", "During waits", "After discharge" — curated collections by care journey phase.
4. **This Week (Next)**: Real Atlanta programs — fitness classes, nutrition workshops, health screenings. Image cards with date, location, tags.

**Key interactions**:
- Explore chips filter the place list in real-time
- "Quick Picks by Moment" cards could expand or navigate to filtered views
- Weekly events are browsable with "View Details" links

#### Screen 3: Concierge
**Intent**: "Explore support around your hospital." — hospitality-style planning.

Feels like a hotel concierge but for a hospital. Oriented around the logistics of a multi-day hospital visit: where to eat, where to sleep, where to get prescriptions filled.

**Content zones**:
1. **Hero**: "Explore support around your hospital." CTA to find what's open now. Sub-links for dietary needs and campus switching.
2. **Breakfast/Meals (Now)**: Time-aware meal recommendations with map radius context. Explore chips filter by meal (Breakfast, Lunch, Dinner) and need (Kid-friendly, Low sodium).
3. **Sidebar: Persona Switcher**: "Patient view", "Caregiver view", "Visitor view" — each persona surfaces different priorities.
4. **Concierge Picks (Next)**: Evening lodging, diet-friendly meal delivery, extended-hours pharmacy. Image cards with practical metadata.

**Key interactions**:
- Persona switcher changes which content is prioritized
- Meal-time chips auto-select based on current time of day
- Map radius gives spatial context for all recommendations

#### Screen 4: Community Hub
**Intent**: "Community care beyond the hospital walls." — public health + neighborhood activation.

This is the broadest screen. It extends Emory's brand beyond the clinical setting into community wellness. Target: both patients looking for post-care programs and Atlanta residents interested in preventive health.

**Content zones**:
1. **Hero**: "Keeping Atlanta Healthy" — community-forward language, not clinical. CTA to "Explore Near Me."
2. **Live Around You (Now)**: Events happening today/tonight. Two featured cards with images. Explore chips filter by location, audience, category, timing.
3. **Sidebar: Neighborhood Picker**: "Decatur + Candler Park", "West End + South Atlanta", "Midtown + Virginia-Highland" — content filters by Atlanta neighborhood.
4. **Week View (Next)**: Four-column card grid of the week's programs, events, venues, and organizations. Categories: wellness, food access, public health, community.

**Key interactions**:
- Neighborhood picker filters all content to a geographic area
- Week view is browsable with detail links
- Events have RSVP/reserve CTAs

---

## 4. Design System Requirements

### 4.1 Brand Identity

**Emory Healthcare's brand** should be the primary visual reference, not a generic health/wellness aesthetic.

- **Emory Blue** (PMS 280 / approximately `#002f6c`): The anchor brand color. Should appear as a surface color (hero backgrounds, section bands, navigation), not just as link text.
- **Accent Green**: Needs to be intentional and richer than generic mint. Research Emory Healthcare's current brand palette. The green should signify life, renewal, and health — not "eco startup."
- **Warm neutrals**: Replace cold grays (`#f8f8f8`) with warm neutrals (cream, sand, warm gray like `#f5f3f0`) to create a reassuring, human feel. Healthcare premium, not clinical sterile.
- **Logo/Wordmark**: Use Emory Healthcare's actual visual identity or a high-fidelity placeholder. The current "E" circle is insufficient for demo credibility.

### 4.2 Typography

**Font pairing**: `superior-title` (serif, for headings) + `scandia-web` (sans, for body). This is a strong pairing — the serif carries editorial authority and the sans is clean and legible.

**Type scale requirements**:
- Collapse to 7-8 distinct sizes maximum (current comp uses 30)
- Minimum body text: 0.875rem (14px)
- Minimum readable text: 0.75rem (12px) — for meta labels and timestamps only
- Display headings should use the serif (`superior-title`) to differentiate from body
- Card titles (h3) should have clear typographic distinction from body text — either through size, weight, or font family
- Line heights: standardize to 3 values (tight for display: ~0.95, normal for body: ~1.5, compact for UI labels: ~1.2)

**Suggested scale** (for reference, not prescriptive):

| Token | Size | Use |
|-------|------|-----|
| `text-xs` | 0.75rem (12px) | Meta labels, timestamps, kickers |
| `text-sm` | 0.875rem (14px) | Secondary body, card descriptions, tags |
| `text-base` | 1rem (16px) | Primary body text |
| `text-lg` | 1.125rem (18px) | Card titles, emphasized body |
| `text-xl` | 1.5rem (24px) | Section subheadings |
| `text-2xl` | 2rem (32px) | Section headings (h2) |
| `text-display` | clamp(2.5rem, 4vw, 3.5rem) | Hero headings (h1) |

### 4.3 Color System

The palette needs semantic depth beyond navy + green + gray:

| Token | Purpose | Notes |
|-------|---------|-------|
| `--color-primary` | Emory Blue | Hero backgrounds, nav, CTAs |
| `--color-primary-light` | Light blue tint | Section backgrounds, selected states |
| `--color-accent` | Brand green | Primary buttons, active states, positive indicators |
| `--color-accent-light` | Light green tint | Hover states, success backgrounds |
| `--color-surface` | White | Card backgrounds |
| `--color-background` | Warm neutral | Page background, alternating sections |
| `--color-background-alt` | Slightly different warm neutral | Visual rhythm between sections |
| `--color-text` | Near-black | Primary text |
| `--color-text-secondary` | Dark gray | Descriptions, secondary content |
| `--color-text-tertiary` | Medium gray | Meta labels, timestamps, placeholders |
| `--color-border` | Unified border color | Card borders, dividers |
| `--color-error` | Red | Closed facilities, alerts, allergy warnings |
| `--color-warning` | Amber | Wait times, limited availability, expiring content |
| `--color-success` | Green (distinct from accent) | Open now, verified, confirmed |
| `--color-info` | Blue tint | Informational callouts, tips |

### 4.4 Spacing

Use an 8px (0.5rem) base scale:

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | 0.25rem (4px) | Inline spacing, icon gaps |
| `--space-2` | 0.5rem (8px) | Tight element spacing |
| `--space-3` | 0.75rem (12px) | Card internal padding |
| `--space-4` | 1rem (16px) | Standard component padding |
| `--space-5` | 1.5rem (24px) | Section internal padding |
| `--space-6` | 2rem (32px) | Between components |
| `--space-8` | 3rem (48px) | Between major sections |
| `--space-10` | 4rem (64px) | Page-level breathing room |

Current comp uses 0.9rem (14px) between major sections. This should be at minimum `--space-8` (48px) to create distinct content zones.

### 4.5 Border Radius

Three tiers, tokenized:

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 8px | Buttons, tags, chips, small elements |
| `--radius-md` | 12px | Cards, list items, inner containers |
| `--radius-lg` | 20px | Page sections, hero containers |
| `--radius-full` | 999px | Pills, avatars, brand mark |

### 4.6 Component Inventory

The portal needs these components. Each should feel like a deliberate, polished design element:

#### Navigation
- **Topbar**: Brand identity + primary nav + utility actions. Should feel institutional and trustworthy, not trendy. Consider a horizontal bar over the current pill shape.
- **Active state**: Must be visually clear AND include `aria-current="page"` for accessibility.

#### Hero
- **Structure**: Heading + description + primary CTA + secondary links + contextual image
- **Variants needed**: Each page should have a distinct hero treatment. Not four identical layouts. Options: full-bleed image with overlay text, split 50/50, dark navy background with photo inset, etc.
- **The hero must be heroic**: Generous padding, prominent CTA, the image should create emotional resonance not just fill space.

#### Buttons
- **Primary (solid)**: The main CTA. Should be visually prominent — larger on hero, standard in cards. Needs clear size variants.
- **Secondary (soft)**: Bordered button for secondary actions.
- **Tertiary (quiet)**: Text-link style for inline actions.
- **Sizing**: Small (in cards/lists), Medium (standard), Large (hero CTAs).
- All buttons need hover, focus, active, and disabled states.

#### Cards
Consolidate to a minimal set of card patterns with clear visual differentiation:

1. **Image Card**: Photo + meta + title + description + tags + action. For events, programs, venues with visual content.
2. **List Item**: Compact horizontal layout. Title + description + tags + action. For ranked results, place lists, nearby options.
3. **Rail Card**: Small sidebar card. Title + short description. For quick-pick categories, persona switchers.
4. **Highlight Card**: Visually distinct from standard cards. For featured/promoted content, sidebars. Should use a background tint (primary-light or accent-light).

#### Interactive Controls
- **Filter Chip**: Toggleable pill for filtering content. Needs clear active/inactive states, keyboard navigability, `role="button"` with `aria-pressed`. Consolidate current `explore-chip`, `control-pill`, and `tag` into ONE component.
- **Tag (read-only)**: Non-interactive label showing metadata (distance, hours, dietary info). Visually distinct from interactive chips.
- **Rank Number**: Numbered badge for ranked results.

#### Status Indicators
- **Open/Closed badge**: Green dot + "Open now" or red dot + "Closed"
- **Distance tag**: "0.2 mi" / "5 min walk"
- **Dietary/Accessibility badge**: Leveraging community needs tags from the data layer
- **Time badge**: "6:30 AM" / "Saturday 7:30 AM" using `<time>` elements

---

## 5. Interaction Patterns

### 5.1 Decision Flow (Hospital Now page)

The flagship interaction. A user arrives, the page shows pre-filtered results for their most likely need (breakfast, based on time of day). They can:

1. **Scan** the top 3 ranked results (no scrolling needed)
2. **Refine** with filter pills (dietary needs, budget, distance)
3. **Act** with one tap on "Get Directions"
4. **Pivot** via the sidebar if their need is different (pharmacy, quiet space)

Target: **under 30 seconds** from page load to tapping "Get Directions."

### 5.2 Explore Flow (Hospital Hub, Concierge pages)

Less directed. User browses categories, filters by need or moment, discovers options:

1. **Orient** via explore chips (Breakfast, Coffee, Quiet spaces, Pharmacy)
2. **Browse** the place list
3. **Drill in** for details or directions
4. **Plan ahead** by scrolling to weekly events

### 5.3 Community Flow (Community Hub page)

Discovery-oriented. User explores what's happening in their neighborhood:

1. **Pick** a neighborhood from the sidebar
2. **Browse** featured events and programs
3. **Filter** by category (Fitness, Food access, Tonight)
4. **Engage** via RSVP/Reserve actions

### 5.4 Persona Switching (Concierge page)

User selects their role (Patient, Caregiver, Visitor) to reframe all content. This is a **non-destructive** filter that changes what content is prioritized, not a separate set of pages.

---

## 6. Content Model

All content comes from the LostCity data layer. The portal does not maintain its own content — it queries the shared platform via API.

### 6.1 Data Available

| Entity | Fields Available | Source |
|--------|-----------------|--------|
| **Venues** | Name, type, address, hours, geo, description, neighborhood, photos, vibes, accessibility tags, dietary tags, family tags | Crawled + community-verified |
| **Events** | Title, date/time, venue, description, categories, tags, series, RSVP status | Crawled (500+ sources) |
| **Programs/Classes** | Title, schedule, org, venue, description, categories, recurring | Crawled + admin-curated |
| **Organizations** | Name, description, type, venues, programs | Crawled + admin-curated |

### 6.2 Filtering Dimensions

The portal should support filtering by:

- **Time**: Now, Today, This week, Morning/Afternoon/Evening
- **Proximity**: Distance from a reference point (campus, hospital entrance)
- **Category**: Food, Pharmacy, Quiet spaces, Fitness, Transit, Lodging, etc.
- **Need**: Dietary (low sodium, vegan, gluten-free), Accessibility (wheelchair, ASL), Family (kid-friendly, stroller)
- **Budget**: Under $10, Under $20, Free
- **Persona**: Patient, Caregiver, Visitor, Employee
- **Neighborhood**: Clifton/Druid Hills (campus), Decatur, West End, Midtown, etc.

### 6.3 Ranked Results

The "Hospital Now" decision flow uses opinionated ranking, not just proximity. Ranking factors:

1. Open right now (hard filter)
2. Distance from campus
3. Match to active filter pills (dietary, budget, etc.)
4. Community verification score (venues with needs tags confirmed by 3+ users rank higher)
5. Recency of data (recently crawled data preferred)

---

## 7. Technical Constraints

### 7.1 Platform Architecture

- **Frontend**: Next.js (App Router) with route groups per vertical. The hospital vertical would live at `app/[portal]/(hospital)/`
- **Data**: All content via API endpoints (`/api/*`), never direct Supabase queries from client
- **Auth**: Shared Supabase auth (optional for browsing, required for RSVP/save)
- **Images**: Must be self-hosted (no hotlinking to Unsplash/Pexels in production). Use optimized formats (WebP/AVIF) with responsive `srcset`
- **Fonts**: Typekit (`superior-title` + `scandia-web`). Needs `font-display: swap` and `<link rel="preconnect">` for performance

### 7.2 Performance Targets

- **First Contentful Paint**: < 1.5s on 3G
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3s
- **No render-blocking CSS imports** (convert `@import` to `<link>`)
- Mobile-first responsive design

### 7.3 Responsive Breakpoints

| Breakpoint | Target | Notes |
|------------|--------|-------|
| < 480px | Phone portrait | Single column, stacked layout, mobile nav |
| 480-768px | Phone landscape / small tablet | Single column, larger touch targets |
| 768-1024px | Tablet | Two-column layouts, sidebar collapses |
| 1024-1280px | Small desktop | Full layout |
| > 1280px | Large desktop | Max-width container, generous whitespace |

---

## 8. Design Direction

### 8.1 Mood: "Healthcare Premium"

The portal should feel like **One Medical meets a luxury hotel concierge** — warm, confident, trustworthy, efficient. Not clinical. Not corporate. Not startup-cute.

Reference points for tone:
- **One Medical**: Warm, approachable, premium health brand
- **Mayo Clinic patient portal**: Institutional authority with modern design
- **Apple Health**: Clean, spacious, information-dense but not overwhelming
- **Airbnb**: Card-based discovery done well — great image treatment, clear hierarchy, interactive affordance

### 8.2 What to Avoid

- **Generic healthcare stock photography** (smiling nurses, empty hallways)
- **Clinical/cold aesthetics** (all-white, sans-serif-only, no warmth)
- **Startup-playful** (rounded everything, pastel rainbow, casual copy)
- **Dashboard aesthetic** (data tables, status bars, admin-tool energy)
- **Template sameness** — each page should have a distinct visual identity within the system

### 8.3 Visual Rhythm

The current comp puts every section in identical white rounded rectangles with the same shadow, margin, and padding. This creates monotony. The redesign should create visual rhythm through:

- **Background color alternation**: Some sections on warm neutral, some on white, one per page on primary-light or navy
- **Section density variation**: The "Now" section should feel tighter and more urgent; the "Next/Week" section should feel more spacious and browsable
- **Full-width moments**: Not every section needs to be in a card. Some content bands could be edge-to-edge
- **Typographic breaks**: Larger heading sizes, decorative kickers, or pull quotes between sections
- **Image treatment variety**: Not just rectangular thumbnails — consider hero overlays, blurred backgrounds, circular badges, or illustrated accents

### 8.4 Key Design Challenges

1. **How to differentiate four pages that share the same temporal framework (Now/Then/Next) without them all looking the same.** Each page has a different personality: Hospital Now is urgent and decisive, Hospital Hub is welcoming and broad, Concierge is hospitality-warm, Community Hub is neighborhood-activated.

2. **How to make the ranked decision flow (Hospital Now) feel like a precision instrument.** This is the demo killer feature. It should feel faster and more opinionated than anything else on the portal.

3. **How to make the persona switcher (Concierge) feel meaningful.** Switching between Patient/Caregiver/Visitor should visibly change the page, not just re-sort identical cards.

4. **How to make the neighborhood picker (Community Hub) feel like a map without necessarily being a map.** The community page needs geographic grounding.

5. **How to handle the sidebar pattern (Quick Picks, Quick Switch, Persona Switcher, Neighborhood Picker) without it becoming a second-class afterthought.** Currently the sidebar highlight cards are visually identical to everything else.

---

## 9. Current State Assessment

### 9.1 What's Good (Keep)

- The **Now / Then / Next temporal framework** is strong product thinking
- The **ranked decision flow** with filter pills is a compelling interaction pattern
- The **persona switching** concept (Patient/Caregiver/Visitor) is smart
- The **neighborhood picker** connects hospital care to community belonging
- The **font pairing** (superior-title + scandia-web) is premium
- The **hero-grid split** with contextual overlay is a good structure
- The **content model** (venues, events, programs with needs tags) is rich

### 9.2 What Needs Redesign

| Problem | Severity | Details |
|---------|----------|---------|
| Everything looks the same | Critical | 10+ card variants are visually indistinguishable. Every section is the same white rectangle |
| Typography is crushed | Critical | 30 font sizes, body text at 10-13px, no clear hierarchy below h2 |
| Color is absent | Critical | Navy defined but invisible. Page is 95% white/gray. No semantic color states |
| No accessibility | Critical | Zero focus styles, span-based interactive controls, no ARIA |
| Spacing is suffocating | Major | 14px between major sections, compressed card interiors, 40+ ad-hoc spacing values |
| Hero is generic | Major | Four identical heroes, cramped CTA, small image ratio, tiny overlay text |
| Brand identity is placeholder | Major | "E" circle instead of real Emory branding |
| Sidebar has no presence | Major | Highlight cards look identical to everything else |
| No interactive affordance | Moderate | Cards have no hover/focus states, no visual feedback |
| Section monotony | Moderate | No background variation, no full-width moments, no visual rhythm |

### 9.3 Technical Debt in Current Comp

- `index.html` duplicates the design system inline instead of linking `styles.css`
- 67 lines of dead CSS (`.timeline-*`, `.step-*`, `.priority-note`)
- Render-blocking `@import` for Typekit fonts
- All images hotlinked to Unsplash/Pexels
- No `<link rel="preconnect">` for font loading
- Duplicate image usage across pages (yoga class photo appears twice)

---

## 10. Success Criteria

### 10.1 Demo Quality

This portal will be shown to healthcare system executives. The design must:

- **Feel credible as an Emory product** within 3 seconds of loading
- **Communicate the value prop** (practical nearby support) without explanation
- **Complete the flagship flow** (find breakfast, get directions) in under 30 seconds
- **Feel distinct from the other LostCity verticals** (hotel, city, film) — not a themed template

### 10.2 Design Quality Benchmarks

- No element smaller than 12px
- Every interactive element has visible hover + focus states
- At most 8 font sizes in the system
- At most 8 spacing values
- Color palette has at minimum: brand primary, accent, 3 neutrals, error, warning, success
- Cards have clear visual hierarchy (image > title > description > meta > action)
- The page passes a "squint test" — sections are distinguishable at 25% zoom

### 10.3 Prototype Deliverables

Prototyping agents should produce:

1. **Visual design for all 5 pages** (index + 4 screens) as static HTML/CSS
2. **Design tokens file** defining the complete type, color, spacing, and radius system
3. **Component showcase** showing all components in their various states (default, hover, focus, active, disabled)
4. **Mobile viewport** (375px) treatment for at least the Hospital Now page
5. **At least one "wow moment"** per page — a visual element that makes someone stop and say "this is nice"

---

## 11. Open Questions for Prototyping

These are decisions the prototyping agents can make and present options for:

1. **Topbar style**: Pill-shaped (current) vs. horizontal bar vs. sticky condensed header?
2. **Hero approach**: Should all four pages share one hero pattern (varied by color/image), or should each page have a distinct hero layout?
3. **Dark mode?**: Should the portal support dark mode, or is light-only sufficient for v1?
4. **Map integration**: Should the Concierge or Hospital Now pages include an actual map component, or is the list + distance tags sufficient?
5. **Animation**: Should the filter chips animate/transition when toggled? Should cards have entrance animations?
6. **Nav pattern on mobile**: Bottom tab bar vs. hamburger menu vs. collapsible top nav?
7. **Illustration vs. photography**: Should the portal use photography exclusively, or could illustrated accents (icons, section dividers, empty states) add warmth?

---

## Appendix A: Page-by-Page Content Inventory

### Index (Navigation Hub)
- Page title + description
- 4 navigation cards (one per screen)
- Each card: title + description + "Open Screen" link

### Golden Flow: Hospital Now
- Topbar: Brand + nav (Hospital Now active) + campus switcher
- Hero: Kicker ("Hospital Now") + h1 + description + "Find Breakfast" CTA + sub-links (Pharmacy, Map)
- Hero image: Contextual hospital/care photo + overlay ("Open now near Emory University Hospital")
- Decision flow: Filter pills (6 options) + ranked results (3 items, each with name, distance, description, tags, directions link)
- Sidebar: "Need something else?" proof box + 3 rail cards (Pharmacy, Quiet spaces, Caregiver support)
- Next needs: 3 image cards (Pharmacy, Quiet space, Caregiver class)

### Hospital Hub
- Topbar: Brand + nav (Hospital Hub active) + "My Visits" link
- Hero: Kicker ("Hospital Hub") + h1 + description + "Find What Is Nearby" CTA + sub-links
- Hero image: Doctor/patient photo + overlay (event teaser)
- Around Emory: 5 explore chips + 3 place items (each with name, distance, description, tags, directions)
- Sidebar: "Quick Picks" by moment — 3 rail cards (Before appointments, During waits, After discharge)
- This week: 3 image cards (Caregiver fitness class, Nutrition workshop, Health screening)

### Concierge
- Topbar: Brand + nav (Concierge active) + "Open My Concierge" CTA
- Hero: Kicker ("Concierge") + h1 + description + "Find What Is Open Now" CTA + sub-links
- Hero image: Family/care photo + overlay (persona switcher teaser)
- Breakfast now: 5 explore chips (meal-based + need-based) + map surface with 2 place items
- Sidebar: Persona switcher — 3 rail cards (Patient view, Caregiver view, Visitor view)
- Concierge picks: 3 image cards (Lodging, Meals, Pharmacy)

### Community Hub
- Topbar: Brand + nav (Community Hub active) + "Save My Week" link
- Hero: Kicker ("Keeping Atlanta Healthy") + h1 + description + "Explore Near Me" CTA + sub-links
- Hero image: Community fitness photo + overlay (featured event)
- Live around you: 5 explore chips + 2 featured image cards (5K walk, Cooking class)
- Sidebar: Neighborhood picker — 3 rail cards (Decatur, West End, Midtown)
- Week view: 4-column image card grid (Peer circle, Market popup, Meal prep lab, Wellness office hours)

---

## Appendix B: Related Platform Documentation

| Document | Location | Relevance |
|----------|----------|-----------|
| Architecture Plan | `/ARCHITECTURE_PLAN.md` | Portal federation model, vertical architecture (Gap 4) |
| Product Roadmap | `/BACKLOG.md` | Hospital demo is Tier 1.3 priority |
| Community Needs Tags | `/COMMUNITY_NEEDS_ACTIVATION.md` | Accessibility/dietary/family tags data model |
| Competitive Intel | `/COMPETITIVE_INTEL.md` | Healthcare market gap analysis |
| Portal Surfaces Contract | `/docs/portal-surfaces-contract.md` | Consumer vs. Admin portal boundary |
| AI Base Instructions | `/docs/ai-base-instructions-v1.md` | Non-negotiable platform constraints |
