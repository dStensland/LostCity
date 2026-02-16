# BP-3 Design Direction Lock: Atlanta Dog Portal

## One-Line Brief
AllTrails meets Duolingo for dog owners. Outdoor discovery rigor with playful,
joyful UI. Map-forward, mobile-optimized, personality-driven. "Kinda dumb, like dogs."

## Mood Board (5 References)

1. **AllTrails** — Trail cards, map-forward discovery, split-screen desktop / bottom-sheet mobile. Steal the IA and interaction model.
2. **Duolingo** — Chunky rounded UI, thicc buttons, encouraging microcopy, celebration moments. Steal the visual language and tone.
3. **Oatly** — Self-aware dumb humor, imperfect layouts, bold type as graphic element. Steal the copy voice and willingness to be weird.
4. **Headspace** — Warm illustrations for empty states, friendly character system. Steal the illustration approach for no-photo fallbacks.
5. **Airbnb Experiences** — Blended content feed, full-bleed photos with overlays, date-optional discovery. Steal the feed structure.

## Color Palette

```
Primary:    #FF6B35  (burnt orange — high energy, warm, action color)
Secondary:  #F7931E  (golden yellow — badges, tags, highlights)
Accent:     #06BCC1  (turquoise — surprise pop, services)
Background: #FFFBEB  (warm cream — NOT white)
Text:       #292524  (warm charcoal — NOT black)
Muted:      #78716C  (stone gray)
Border:     #FDE68A  (pale gold)
Error:      #EF4444  (tomato)
Success:    #059669  (forest green)
```

### Content Type Colors
- Events: `#FF6F59` (coral)
- Parks/Places: `#FFD23F` (sunny yellow)
- Services: `#06BCC1` (teal)
- Trails: `#059669` (green)

## Typography

**Display**: Baloo 2 (Google Fonts) — ExtraBold (800)
- Portal name, section headings, card titles, CTAs
- Chunky, rounded, friendly. Intentionally "dumb" in the best way.

**Body**: Inter (Google Fonts) — Regular (400), SemiBold (600)
- Descriptions, metadata, timestamps, UI labels
- Invisible by design — lets content and display type do the talking.

```css
--font-display: 'Baloo 2', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
```

### Scale
- 3xl: 3rem (portal name)
- 2xl: 2rem (hero headline)
- xl: 1.5rem (section headings)
- lg: 1.125rem (card titles)
- base: 1rem (body)
- sm: 0.875rem (metadata)
- xs: 0.75rem (timestamps, badges)

## Photography Direction

**Lots of pictures of dogs being goofs.**

- Real candid photos. Dogs mid-zoomie. Dogs with their tongue out. Dogs meeting
  other dogs. Dogs being ridiculous at the park. UGC energy, not studio.
- Phone photos are fine. Authenticity > polish.
- A blurry photo of a happy dog in a fountain beats a professional shot of an
  empty park every time.
- Avoid: stock photos of dogs staring at camera, overly posed "lifestyle" shots,
  professional pet photography aesthetic.
- When available, show dogs WITH their owners in the context of the activity
  (at the patio, on the trail, at the event).

## No-Photo Fallback System

Many items won't have photos. The design MUST be beautiful without them.

### Strategy: Solid color blocks + emoji + bold type

```
┌─────────────────────────────┐
│ [Coral block]               │
│                             │
│  🎉                         │
│  YAPPY HOUR AT FETCH        │  ← Baloo 2, 800
│  Saturday 10am • Buckhead   │  ← Inter, 400
│                             │
│  [23 going]     [Save 🔖]  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ [Yellow block]              │
│                             │
│  🌳                         │
│  PIEDMONT OFF-LEASH AREA    │
│  0.3 miles • Open now       │
│                             │
│  [4.2★ (89)]  [Directions]  │
└─────────────────────────────┘

┌─────────────────────────────┐
│ [Teal block]                │
│                             │
│  🦴                         │
│  THREE DOG BAKERY           │
│  BeltLine • Closes at 7pm   │
│                             │
│  [Treats & toys] [Visit]    │
└─────────────────────────────┘
```

Color of block matches content type. Creates visual variety in feed even
without any photos.

### Illustrated mascot (future)

Simple illustrated dog character for:
- Empty states: dog lying down — "Nothing this weekend. Check back soon!"
- Success states: dog jumping — "You're going! 🎉"
- Error states: dog tilting head — "Hmm, we lost the ball (404)"
- Loading: pulsing dots (not a spinner)

Style: rounded shapes, limited palette (orange/yellow/teal), no outlines,
Headspace-adjacent. NOT clip art. NOT realistic.

## Layout & Cards

### Feed Structure
Vertical scroll, blended content types. Within sections, horizontal carousels
for browsable categories ("Dog Parks Near You", "This Weekend", "New Spots").

### Card Design
- `border-radius: 16px` — chunky, rounded, soft
- Soft warm shadows: `0 4px 16px rgba(255, 107, 53, 0.1)`
- Content type badge at top-left corner of card
- Consistent card width, variable height based on content
- Photo cards: full-bleed image with gradient overlay for text legibility
- No-photo cards: solid color block (see above)

### Grid
- Mobile: single column, full-width cards
- Desktop: 2-3 column masonry (slightly imperfect alignment is on-brand)
- Generous spacing between cards — breathing room, not cramped

## Map Experience

### Desktop
Split-screen: map (60%) + scrollable card list (40%). Hovering a card highlights
the map pin. Clicking a pin scrolls to the card.

### Mobile
Full-screen map with draggable bottom sheet. Pull up to see card list, pull down
to focus on map. One-handed friendly.

### Custom Markers
- Dog parks: green circle with white tree icon
- Events: coral circle with white calendar icon
- Services: teal circle with white building icon
- Trails: green circle with white trail icon
- Cluster circles at zoom-out with count in Baloo 2

### Map Style (Mapbox)
- Base: Outdoors theme (shows parks/trails clearly)
- Water: `#38BDF8`
- Parks: `#059669`
- Background: warm cream tint
- NOT default Google Maps

## Motion & Interaction

- **Button clicks**: 0.2s bounce (scale 1 → 1.05 → 1)
- **Card hover**: lift 4px with shadow expansion
- **Save/RSVP success**: tiny confetti burst
- **Page transitions**: slide up from bottom
- **Loading**: pulsing dots, never a spinner
- **Everything feels bouncy and alive** — spring easing, not linear

## Voice & Copy

### Register
Warm, playful, slightly dumb. Like a golden retriever wrote the copy.

### Sample Copy
- Hero: "SNIFF. PLAY. REPEAT." / "All the dog-friendly stuff in Atlanta."
- Empty feed: "No events this weekend. Even dogs need a rest day."
- Error: "Oops, we lost the ball. (Try refreshing?)"
- Save confirmation: "Saved! Good boy. (Or girl. We don't judge.)"
- Section headings: "Happening This Weekend" / "Parks Worth the Drive" / "New Spots"

### Anti-voice
- "Discover curated pet experiences" (too corporate)
- "Find local veterinary services" (too directory)
- "Atlanta's premier destination for pet owners" (too self-important)

## Anti-Patterns (Locked)

These are banned from this portal:

- ❌ Paw print icons or bone graphics
- ❌ Pastel colors
- ❌ Corporate blue
- ❌ Sharp corners (< 8px border-radius)
- ❌ Black text on pure white background
- ❌ Stock photos of posed dogs
- ❌ Default Google Maps
- ❌ Perfectly aligned corporate grids
- ❌ Loading spinners
- ❌ Generic pet-industry aesthetic of any kind
- ❌ Helvetica, Arial, or other "safe" fonts

## Branding Config (for portals table)

```json
{
  "visual_preset": "custom",
  "primary_color": "#FF6B35",
  "secondary_color": "#F7931E",
  "accent_color": "#06BCC1",
  "background_color": "#FFFBEB",
  "text_color": "#292524",
  "muted_color": "#78716C",
  "border_color": "#FDE68A",
  "card_color": "#FFFFFF",
  "button_color": "#FF6B35",
  "button_text_color": "#FFFFFF",
  "font_heading": "Baloo 2",
  "font_body": "Inter",
  "theme_mode": "light",
  "header": {
    "template": "branded",
    "logo_position": "left",
    "logo_size": "lg",
    "nav_style": "pills",
    "transparent_on_top": false
  },
  "component_style": {
    "border_radius": "xl",
    "shadows": "medium",
    "card_style": "elevated",
    "button_style": "pill",
    "glow_enabled": false,
    "glass_enabled": false,
    "animations": "full"
  },
  "category_colors": {
    "events": "#FF6F59",
    "parks": "#FFD23F",
    "services": "#06BCC1",
    "trails": "#059669"
  }
}
```
