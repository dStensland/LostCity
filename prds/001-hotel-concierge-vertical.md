# PRD-001: Hotel Concierge Vertical

**Status**: Draft
**Priority**: P0 — Demo Sprint
**Strategic Alignment**: Hypothesis 2 (Inverted White-Labeling), Principle 6 (Bespoke Over Configurable)

---

## 1. Problem & Opportunity

Hotels are our highest-value early target. Mid-market hotels (FORTH, Bellyard, Clermont) pay $200-500/mo for generic concierge tools or rely on a binder at the front desk. Enterprise platforms (ALICE, INTELITY) cost $5K-20K+/mo and focus on hotel operations, not local discovery.

Our current portal system renders every portal with the same UI — a city event feed. A hotel concierge needs a fundamentally different experience: tonight-focused, proximity-aware, curated by the property, and optimized for a guest asking "what should I do right now?"

**The demo goal**: Walk into FORTH Hotel with a working portal on `forth.lostcity.app` that their GM can interact with. It should feel like a product built specifically for them, not a themed version of our city app.

---

## 2. Target Users & Use Cases

### Primary User: Hotel Guest
- Arriving at hotel, wants to know what's happening nearby tonight
- Browsing from room, planning tomorrow's activities
- Walking distance matters more than category
- Unfamiliar with neighborhoods — needs guidance, not just data
- Likely on mobile, short attention span

### Secondary User: Hotel Concierge / Front Desk
- Needs to quickly recommend events to guests
- Wants to pin/feature their own picks (restaurant partners, nearby attractions)
- Needs to share a link or QR code
- Wants the portal to reflect their property's brand and taste

### Use Cases
1. **"What's happening tonight?"** — Guest opens portal, immediately sees tonight's events sorted by proximity and start time
2. **"What's near here?"** — Guest browses nearby venues by type (restaurants, bars, attractions) without needing to know neighborhoods
3. **"The concierge recommended this"** — Staff-curated "Our Picks" section with hand-selected venues and events
4. **"Plan my stay"** — Guest browses events by day of their stay (today, tomorrow, this weekend)
5. **"Share with my group"** — Guest shares a link to the portal or specific event with travel companions

---

## 3. Requirements

### Must-Have (Demo)

**R1. Hotel route group** (`/app/[portal]/(hotel)/`)
- Independent layout from default city portal
- Renders when portal `vertical` = "hotel"
- Own component directory — no shared page-level components with city portal

**R2. Tonight-first feed**
- Default view shows events happening today/tonight, sorted by start time
- Prominent "Happening Now" section at top (existing API: `/api/portals/[slug]/happening-now`)
- Time-relative headers: "This Afternoon", "Tonight", "Late Night"

**R3. Proximity-aware display**
- Events and venues show walking distance from hotel (use portal's `geo_center`)
- "Within walking distance" / "Short ride" / "Worth the trip" grouping
- Map view defaulting to hotel location with radius overlay

**R4. Concierge picks section**
- Prominent "Our Picks" section using existing portal_sections (curated type)
- Staff-selected venues and events with optional notes ("Great for date night")
- Visually differentiated from auto-populated sections

**R5. Venue-forward browsing**
- "Explore Nearby" section: restaurants, bars, coffee, attractions
- Venue cards showing type, distance, vibe tags, and next upcoming event
- Venues shown regardless of whether they have events (destination-first, Principle 3)

**R6. Hotel branding**
- Portal branding system applied (already works)
- Hotel logo in header
- Property-appropriate typography and color palette
- "Powered by LostCity" footer (unless enterprise plan)

**R7. Mobile-first layout**
- Designed for phone-in-room or phone-at-lobby use
- Large touch targets, minimal scrolling to first useful content
- QR code scannable entry (existing QR feature)

### Nice-to-Have (Post-Demo)

**R8. Day planner view**
- Horizontal day selector (Today / Tue / Wed / Thu / ...)
- Events grouped by morning/afternoon/evening per day

**R9. Guest preferences**
- Quick taste selector on first visit: "I'm here for..." (food, nightlife, arts, outdoors, family)
- Filters feed based on selection without requiring login

**R10. Weather-aware suggestions**
- Rainy day → indoor events surfaced
- Beautiful day → outdoor venues and events promoted

**R11. Integration hooks**
- Deep link from hotel's own app or in-room tablet
- PMS integration for automated check-in delivery (future)

### Out of Scope

- Hotel operations (room service, housekeeping, check-in) — not our product
- Reservation/booking through the portal — link out to venue's own booking
- Guest messaging or chat with concierge
- Multi-property management (single hotel per portal for now)

---

## 4. User Stories & Flows

### Flow 1: Guest Scans QR in Room
```
Guest scans QR code on room card
  → Opens forth.lostcity.app (or custom domain)
  → Lands on hotel portal homepage
  → Sees: "Tonight at FORTH" with 3-5 events
  → Sees: "Our Picks" with concierge-curated venues
  → Sees: "Explore Nearby" with venue categories
  → Taps event → event detail with map showing distance from hotel
  → Taps "Get Directions" → opens maps app
```

### Flow 2: Concierge Recommends
```
Guest asks front desk "what should we do tonight?"
  → Concierge opens portal admin on tablet
  → Sees tonight's events in the area
  → Shares portal link or specific event link with guest
  → Guest opens on phone, browses from there
```

### Flow 3: Guest Plans Ahead
```
Guest wants to plan tomorrow
  → Taps "Tomorrow" filter
  → Sees events grouped by time of day
  → Saves a few events (requires optional sign-in)
  → Next day, opens portal → saved events visible
```

---

## 5. Technical Considerations

### Route Group Architecture
```
/app/[portal]/(hotel)/
  ├── layout.tsx          # Hotel-specific layout (header, nav, footer)
  ├── page.tsx            # Hotel homepage (tonight feed + picks + nearby)
  ├── events/[id]/page.tsx  # Can reuse or customize event detail
  ├── spots/[slug]/page.tsx # Can reuse or customize venue detail
  └── _components/
      ├── HotelHeader.tsx       # Hotel-branded header
      ├── TonightFeed.tsx       # Time-relative event feed
      ├── ConciergePicks.tsx    # Curated section display
      ├── NearbyVenues.tsx      # Proximity-grouped venues
      └── HotelEventCard.tsx    # Hotel-specific event card design
```

### Portal Vertical Field
- Add `vertical` to portal settings: `"city" | "hotel" | "film" | "hospital" | "community"`
- Portal layout.tsx checks `portal.settings.vertical` and routes to appropriate route group
- Default to city layout if no vertical specified

### Data Requirements
- All existing APIs work — no new endpoints needed
- Proximity calculation: use portal `geo_center` + haversine distance
- Tonight's events: existing `/happening-now` + date-filtered feed
- Curated picks: existing portal_sections with `section_type: "curated"`

### What We Reuse
- Portal branding/theming (CSS variables, PortalProvider)
- Portal sections API and data model
- Event detail pages (may customize card layout but same data)
- Auth, saved items, RSVPs
- QR code generation
- Analytics tracking

### What's New
- Hotel layout component
- Tonight-first feed logic (time-relative grouping)
- Proximity display (distance from geo_center)
- Hotel-specific event/venue card designs
- Venue category browsing component

---

## 6. Success Metrics

**Demo Success**:
- FORTH Hotel GM says "this looks like it was built for us"
- Portal loads in <2s on mobile
- Guest can find tonight's events within 5 seconds of opening
- Concierge can explain the product in 30 seconds

**Post-Launch Success**:
- QR code scan rate (% of room nights with at least one scan)
- Return visits per guest stay
- Event click-through rate
- Venue "Get Directions" tap rate

---

## 7. Open Questions

1. **Route group switching mechanism**: How does the portal layout.tsx decide which route group to render? Next.js route groups are compile-time — we may need a layout-level component switch rather than true route groups. Need to prototype.

2. **Proximity data**: Do we have lat/lng for all Atlanta venues? What's the coverage? Proximity display is useless without coordinates.

3. **FORTH Hotel specifics**: What neighborhood is FORTH in? What's their aesthetic? Do they have restaurant/bar partners they'd want featured? Need a discovery call before configuring demo.

4. **Shared detail pages**: Should event/venue detail pages be hotel-specific or can we reuse the city portal versions? The data is the same — it's a question of visual treatment.

5. **Offline/low-connectivity**: Hotel WiFi can be spotty. Do we need any offline-first patterns or aggressive caching?
