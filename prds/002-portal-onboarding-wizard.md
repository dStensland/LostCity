# PRD-002: Portal Onboarding Wizard

**Status**: Draft
**Priority**: P0 — Demo Sprint
**Strategic Alignment**: Principle 8 (Low-Margin Customers Can Be High-Value), Hypothesis 2 (Inverted White-Labeling)

---

## 1. Problem & Opportunity

Portal creation today is a single modal with name/slug/type fields, followed by a sprawling settings page. This works for us as operators but fails for two critical audiences:

1. **Sales demos**: We need to show prospects how fast and easy portal setup is. "Watch me build your portal in 2 minutes" is a killer demo moment. The current flow doesn't deliver that.

2. **Self-service customers**: Low-margin targets (neighborhood associations at $50/mo, small venues at $100/mo) can't justify a white-glove onboarding call. They need to create and configure a portal themselves. The current admin settings page has 15+ sections — it's overwhelming for a first-time user.

The onboarding wizard is how we demonstrate the "bespoke in minutes" value prop and how we scale to serve the long tail of small customers without manual onboarding.

---

## 2. Target Users & Use Cases

### Primary User: Prospective Customer (Demo Context)
- Watching a sales demo, wants to see how easy setup is
- Needs to feel like the portal is "theirs" within minutes
- Judges the product by the speed and quality of the first impression

### Secondary User: Self-Service Portal Creator
- Small org (neighborhood association, local venue, community group)
- No technical background
- Wants a working portal in one sitting
- May not know exactly what they want — needs guidance, not a blank canvas

### Use Cases
1. **Sales demo**: Rep walks prospect through wizard, configuring their portal live, ending with a shareable preview link
2. **Self-service setup**: Small org creates portal from marketing page, follows guided steps, launches within 30 minutes
3. **Internal portal creation**: We create portals for new customers quickly and consistently

---

## 3. Requirements

### Must-Have (Demo)

**R1. Step-by-step wizard flow**
- Linear progression through setup steps
- Progress indicator showing current step and remaining
- Back/Next navigation with state persistence
- Can save and resume later (draft portal status)

**R2. Step 1: Identity**
- Portal name (with live slug preview)
- Portal type (city / event / business / personal) with descriptions
- Vertical selection (city / hotel / film / community — if applicable)
- Tagline (optional)

**R3. Step 2: Audience & Location**
- City selection
- Map-based geo_center picker (click to set center point)
- Radius slider (1km - 50km)
- Neighborhood selection (multi-select from known neighborhoods)
- Category focus (which event categories to include/exclude)

**R4. Step 3: Branding**
- Visual preset selector (grid of preset thumbnails with live preview)
- Color overrides (primary, accent, background) with color pickers
- Logo upload or URL
- Font pairing selector (heading + body from available fonts)
- Light/dark mode toggle
- Live preview panel showing how the portal will look

**R5. Step 4: Content Sections**
- Pre-built section templates: "Tonight", "This Weekend", "Popular", "Free Events", "Nearby Venues"
- Drag to reorder
- Add custom section with auto-filter configuration
- Each section shows preview of what it would display

**R6. Step 5: Review & Launch**
- Full portal preview (rendered as it would appear to users)
- Summary of configuration choices
- "Launch" button (sets status to active)
- Shareable preview link (even before launch, for demos)

**R7. Template presets by vertical**
- "Hotel Concierge" preset: tonight-first, proximity sections, concierge picks
- "City Guide" preset: category sections, trending, this weekend
- "Film/Arts" preset: screenings, galleries, performances
- "Community" preset: neighborhood events, free events, local venues
- Presets pre-fill steps 2-4 with sensible defaults that can be customized

### Nice-to-Have (Post-Demo)

**R8. Collaborative setup**
- Invite team members during setup (step between branding and launch)
- Assign roles during onboarding

**R9. Source subscription step**
- Show available event sources during setup
- Auto-subscribe to relevant sources based on location/categories

**R10. Custom domain setup**
- DNS configuration instructions during setup
- Verification flow inline

**R11. Import existing content**
- Import events from CSV or iCal
- Import venue list from spreadsheet

### Out of Scope

- Billing/payment during setup (invoice manually for now)
- Portal migration from other platforms
- AI-generated branding (interesting future idea but not now)
- Multi-portal creation wizard

---

## 4. User Stories & Flows

### Flow 1: Sales Demo
```
Rep opens /admin/portals → clicks "Create Portal"
  → Wizard opens full-screen
  → Step 1: Types "FORTH Hotel", selects "Business", vertical "Hotel"
  → Step 2: Sets Atlanta, drops pin on FORTH location, 3km radius
  → Step 3: Selects "Midnight" preset, uploads FORTH logo, tweaks accent color
  → Step 4: Pre-filled with hotel template sections, reorders "Our Picks" to top
  → Step 5: Preview shows portal → clicks "Launch"
  → Shares link: forth.lostcity.app
  → Total time: ~3 minutes
```

### Flow 2: Self-Service (Future)
```
Neighborhood association finds LostCity via marketing page
  → Clicks "Create Your Portal"
  → Signs up / logs in
  → Wizard opens
  → Step 1: "Inman Park Events", type "Community"
  → Step 2: Selects Atlanta, draws boundary around Inman Park
  → Step 3: Picks "Warm" preset, adds neighborhood association logo
  → Step 4: Uses community template, adds "Local Businesses" section
  → Step 5: Reviews, launches
  → Gets portal at inman-park.lostcity.app
```

---

## 5. Technical Considerations

### Implementation Approach
- New page: `/app/admin/portals/create/page.tsx` (full-screen wizard)
- Multi-step form with client-side state (React state or URL params for resumability)
- Each step validates before allowing progression
- Portal created as `status: "draft"` on Step 1, updated on each subsequent step
- Final "Launch" sets `status: "active"`

### Existing Infrastructure to Reuse
- Portal creation API: `POST /api/admin/portals` (already works)
- Portal update API: `PATCH /api/admin/portals/[id]` (handles all fields)
- Section creation API: `POST /api/admin/portals/[id]/sections` (already works)
- Visual preset system: `lib/visual-presets.ts` (presets exist)
- Branding preview: Admin settings page already has a branding preview component
- Map component: Mapbox integration already exists

### What's New
- Wizard container component (step management, progress, navigation)
- Vertical template definitions (pre-built section configurations per vertical)
- Geo picker component (click-on-map to set center + radius)
- Section template selector (pre-built section options)
- Full portal preview renderer (embed portal view in wizard)

### State Management
- Wizard state held in React state with `useReducer`
- Each step dispatches updates to the portal draft
- API calls on step completion (not just at the end) so progress is saved
- Can navigate back without losing data
- Browser refresh should not lose progress (persist to portal draft in DB)

---

## 6. Success Metrics

**Demo Success**:
- Portal can be created and previewed in under 3 minutes
- Non-technical user can complete wizard without guidance
- Preview accurately represents the final portal

**Product Success**:
- Wizard completion rate > 80% (started → launched)
- Average time to launch < 10 minutes
- Support tickets related to portal setup < 5% of new portals

---

## 7. Open Questions

1. **Admin-only vs. public**: For the demo sprint, this only needs to live behind admin auth. Self-service public access is a separate initiative. Confirm this.

2. **Preview fidelity**: How close can the preview be to the real portal? Can we render the actual portal layout in an iframe, or do we need a simplified preview component?

3. **Template data**: Vertical templates need to pre-fill sections with filter configs. Should these be hardcoded or stored in the database as "template" portal configurations?

4. **Draft portals**: Should draft portals be visible to the creator via a preview link? This would let us share demos before officially launching.
