# Hotel Concierge Vertical: Design Direction

**Companion to**: PRD-001 Hotel Concierge Vertical
**Based on**: Competitive analysis of Four Seasons, Aman, Peninsula, Rosewood, Mandarin Oriental apps + FORTH Hotel Atlanta brand research

---

## The Contrast

| Dimension | City Portal (Atlanta) | Hotel Concierge (FORTH) |
|-----------|----------------------|------------------------|
| **Mood** | Underground nightlife, discovery | Refined confidence, curated calm |
| **Typography** | Outfit (geometric sans), JetBrains Mono | Serif headlines + clean sans body |
| **Colors** | Neon magenta, cyan, amber on void black | Charcoal, warm cream, muted gold on off-white |
| **Theme** | Dark | Light |
| **Effects** | Glow, glass morphism, particle fields | None. Whitespace is the effect. |
| **Cards** | Dense, badge-heavy, neon category accents | Image-dominant, minimal text, no badges |
| **Density** | High — packed feed, multiple CTAs | Low — 2-3 items per scroll, breathing room |
| **Motion** | Scale-in, fade-up, shimmer, pulse-glow | Subtle fade, gentle lift on hover |
| **Voice** | "Find your people" — energetic, scene-y | "Your evening, curated" — warm, knowing |

The hotel vertical should feel like walking from a nightclub into a gallery. Same city, completely different register.

---

## FORTH Hotel Brand Context

**Property**: $150M luxury boutique, Old Fourth Ward, BeltLine Eastside Trail
**Opened**: July 2024 | **Price**: $262+/night | **Recognition**: Michelin One Key
**Tagline**: "At FORTH, staying is going"
**Materials**: Dark wood, slate, timber-clad ceilings, concrete diagrid facade, abundant greenery
**Restaurants**: Il Premio (Michelin steakhouse), Elektra, Bar Premio, Moonlight
**Amenities**: 15-20K sq ft fitness center, full-service spa, rooftop pool, members-only club
**Guest profile**: Affluent 25-44 professionals, culturally engaged, wellness-focused, experience-seekers

**Design implication**: FORTH blends modern geometry with warm materials. The portal should mirror this — structured and clean, but never cold. Think warm charcoal rather than stark black, cream rather than pure white, gold rather than silver.

---

## Typography

### Recommended Pairing

**Headlines**: **Cormorant Garamond** (Google Fonts)
- Elegant transitional serif with beautiful display weights
- High contrast between thick and thin strokes signals luxury
- Available on Google Fonts = easy Next.js integration
- Use at 600 (SemiBold) or 700 (Bold) weight
- Generous letter-spacing: 0.02em for headlines, 0.05em for labels

**Body**: **Inter** (already likely available) or **DM Sans**
- Clean, contemporary sans-serif
- Excellent readability at small sizes on mobile
- Use at 400 (Regular) and 500 (Medium) weights
- Line height: 1.6-1.7 for body text

**Alternative serif options** (if Cormorant feels too ornate):
- **Playfair Display** — higher contrast, more editorial
- **Libre Baskerville** — warmer, more approachable
- **Source Serif 4** — modern interpretation, very clean

### Type Scale (Mobile-First)

| Element | Font | Size | Weight | Spacing |
|---------|------|------|--------|---------|
| Section label | Sans | 11px | 500 | 0.12em uppercase |
| Body text | Sans | 16px | 400 | 0 |
| Card subtitle | Sans | 14px | 400 | 0.01em |
| Card title | Serif | 22px | 600 | 0.01em |
| Section heading | Serif | 28px | 600 | 0.02em |
| Page title | Serif | 36px | 700 | 0.02em |
| Hero headline | Serif | 44px | 700 | -0.01em |

---

## Color Palette

### Primary Palette — "Warm Slate"

Inspired by FORTH's material palette: dark wood, slate flooring, cream linens, greenery.

| Name | Hex | Usage |
|------|-----|-------|
| **Charcoal** | `#1C1C1E` | Primary text, headers |
| **Slate** | `#3A3A3C` | Secondary text, icons |
| **Stone** | `#8E8E93` | Muted text, metadata, dividers |
| **Linen** | `#F5F1EB` | Primary background |
| **Cream** | `#FDFBF7` | Card backgrounds, elevated surfaces |
| **White** | `#FFFFFF` | Brightest surface (modals, overlays) |
| **Warm Gold** | `#C9A96E` | Accent — CTAs, highlights, interactive |
| **Deep Gold** | `#A68B4B` | Accent hover state |
| **Forest** | `#2D5F4F` | Optional secondary accent (greenery) |

### Application Rules

- **Background**: Linen (`#F5F1EB`) — warm, not sterile
- **Cards**: Cream (`#FDFBF7`) with subtle shadow
- **Text hierarchy**: Charcoal > Slate > Stone (3 levels, no more)
- **Accent**: Warm Gold used sparingly — links, active states, CTAs, thin rules
- **Never**: Bright colors, gradients, neon, glow effects
- **Borders**: 1px `#E5E0D8` (warm gray, not cool gray)

### Dark Mode? No.

The hotel vertical should be light-themed only. Luxury hospitality digital experiences are overwhelmingly light — it signals openness, cleanliness, and editorial quality. Dark mode is the city portal's domain.

---

## Layout & Spacing

### Core Principles

1. **Whitespace is the luxury signal.** Every section should breathe. When in doubt, add more space.
2. **Max 2-3 content items visible per scroll** on mobile. Never cram.
3. **Single column on mobile, max 2 columns on desktop.** No grids.
4. **Content width capped at 680px** for readability (desktop). Cards can go wider.

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--hotel-space-xs` | 8px | Inline spacing, badge padding |
| `--hotel-space-sm` | 16px | Card internal padding (compact) |
| `--hotel-space-md` | 24px | Card internal padding (standard) |
| `--hotel-space-lg` | 40px | Section gap |
| `--hotel-space-xl` | 64px | Major section separation |
| `--hotel-space-2xl` | 96px | Hero to content gap |

### Page Structure

```
┌─────────────────────────────────────┐
│  Header: Logo left, Search + Menu   │  48-56px height, sticky
│  (minimal, thin bottom border)      │
├─────────────────────────────────────┤
│                                     │
│  Hero: "Good Evening" + date        │  Optional, time-aware greeting
│  (no image, just typography)        │  120px total height
│                                     │
├─────────────────────────────────────┤
│                                     │
│  § Happening Now  (if any)          │  Horizontal scroll cards
│                                     │  64px gap below
│                                     │
├─────────────────────────────────────┤
│                                     │
│  § Our Picks                        │  Curated by concierge
│    Large image cards, 1 per row     │  Staff name attribution
│                                     │  64px gap below
│                                     │
├─────────────────────────────────────┤
│                                     │
│  § Tonight                          │  Time-grouped events
│    "This Afternoon" / "Tonight"     │  Compact list cards
│    / "Late Night"                   │
│                                     │  64px gap below
├─────────────────────────────────────┤
│                                     │
│  § Explore Nearby                   │  Venue type filters
│    Restaurants · Bars · Coffee ·    │  Distance from hotel
│    Attractions · Wellness           │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Footer: "Powered by LostCity"      │  Minimal, muted
│  (unless enterprise plan)           │
│                                     │
└─────────────────────────────────────┘
```

---

## Card Design

### Event Card — Featured (Our Picks)

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│         [Event Image]               │  aspect-ratio: 3/2
│         Full width, rounded-lg      │  object-fit: cover
│                                     │
│                                     │
├─────────────────────────────────────┤
│                                     │  24px padding
│  Event Title                        │  Serif, 22px, Charcoal
│                                     │
│  Venue Name · 0.4 mi               │  Sans, 14px, Stone
│                                     │
│  Tonight · 8:00 PM                  │  Sans, 14px, Warm Gold
│                                     │
│  "A hidden jazz session in a        │  Sans, 14px, Slate
│   converted warehouse..."           │  2-line max, optional
│                                     │
└─────────────────────────────────────┘
```

### Event Card — List (Tonight Section)

```
┌───────────────┬─────────────────────┐
│               │                     │
│  [Image]      │  Event Title        │  Serif, 18px
│  80x80        │  Venue · 0.3 mi     │  Sans, 13px, Stone
│  rounded-md   │  8:00 PM            │  Sans, 13px, Gold
│               │                     │
└───────────────┴─────────────────────┘
```

### Venue Card — Explore Nearby

```
┌─────────────────────────────────────┐
│                                     │
│         [Venue Image]               │  aspect-ratio: 4/3
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Venue Name                         │  Serif, 20px
│  Restaurant · Inman Park            │  Sans, 13px, Stone
│  0.6 mi · "Intimate, craft cocktails" │  Sans, 13px, Slate
│                                     │
│  Next event: Jazz Quartet, Thu 8PM  │  Sans, 12px, Gold
│                                     │
└─────────────────────────────────────┘
```

### What's Absent (Deliberately)

- No category color badges
- No "Trending" / "Featured" / "Live" badges
- No neon accents or glow effects
- No attendee counts or social proof numbers
- No multiple CTAs per card
- No star ratings
- No price tags (unless free, in which case "Complimentary")

---

## Navigation

### Header (Mobile)

```
┌─────────────────────────────────────┐
│  [FORTH logo]        [🔍] [☰]      │
└─────────────────────────────────────┘
```

- Logo left-aligned, minimal size
- Search icon + hamburger menu right
- Thin bottom border (1px, `#E5E0D8`)
- Background: Cream, 90% opacity with backdrop-blur
- Sticky on scroll
- No tabs in header — keep it minimal

### Menu (Hamburger / Bottom Sheet)

```
┌─────────────────────────────────────┐
│                                     │
│  Tonight                            │
│  This Week                          │
│  Explore Nearby                     │
│  Our Picks                          │
│  ─────────────                      │
│  Wellness & Fitness                 │
│  Dining                             │
│  Arts & Culture                     │
│  ─────────────                      │
│  About FORTH                        │
│                                     │
└─────────────────────────────────────┘
```

### Language

Use sophisticated, warm language. Not trendy, not corporate.

| Instead of | Use |
|-----------|-----|
| "Happening Now" | "This Evening" or "Right Now" |
| "Trending" | "Popular This Week" |
| "Free Events" | "Complimentary" |
| "Nightlife" | "Evening" |
| "Spots" | "Places" or venue type name |
| "Check it out" | "Explore" or "Details" |
| "RSVP" | "Save" or "Add to Plans" |

---

## Motion & Interaction

### Permitted

- **Fade in on scroll**: Elements fade in with 200ms ease as they enter viewport
- **Subtle lift on hover**: Cards translate -2px with shadow increase on hover
- **Smooth transitions**: 200-300ms ease for all state changes
- **Image zoom on hover**: Subtle 1.03 scale on card image hover (desktop only)

### Forbidden

- Glow effects of any kind
- Particle fields or ambient animations
- Shimmer loading states (use subtle pulse or solid skeleton)
- Scale-in animations
- Staggered list animations (everything fades in together)
- Glass morphism
- Parallax scrolling

### Loading States

- Skeleton screens using Linen/Cream tones (not dark)
- Subtle opacity pulse (0.4 → 0.7), not shimmer
- Loading indicator: thin gold line at top of viewport

---

## Photography Guidelines

### What Works

- Editorial, atmospheric photography of venues and events
- Warm lighting, natural tones
- People in context (enjoying, not posing)
- Architectural details, materiality, texture
- Food/drink styled shots (not overhead flat-lay)

### What Doesn't

- Generic stock photography
- Oversaturated or HDR-processed images
- Empty rooms or venues
- Logo-heavy flyers or promotional graphics
- Low resolution or poorly cropped images

### Fallback Strategy

If event/venue has no quality image:
1. Use venue's og:image or website hero
2. Use Google Places photo
3. Use a category-specific placeholder (solid color with category icon — NOT a stock photo)

---

## Responsive Approach

### Mobile (< 768px) — Primary

- Single column, full-width cards
- 16px horizontal padding
- Bottom sheet for filters and details
- Sticky header, 48px height
- Touch targets minimum 48px

### Tablet (768px - 1024px)

- 2-column grid for venue cards
- Featured events remain single column
- 32px horizontal padding

### Desktop (> 1024px)

- Max content width: 960px, centered
- 2-column for venue grids
- Featured events: hero card + 2 smaller cards
- Generous side margins

---

## Implementation Notes

### CSS Custom Properties

The hotel vertical should define its own set of CSS custom properties, overriding the city portal's neon palette entirely:

```css
[data-vertical="hotel"] {
  --background: #F5F1EB;
  --foreground: #1C1C1E;
  --card: #FDFBF7;
  --card-border: #E5E0D8;
  --muted: #8E8E93;
  --accent: #C9A96E;
  --accent-hover: #A68B4B;
  --font-heading: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

### Font Loading

Add Cormorant Garamond to the Next.js font loading in the hotel vertical layout:

```typescript
import { Cormorant_Garamond, Inter } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
});
```

### Component Isolation

Hotel components should live in their own directory and share NOTHING visual with the city portal:

```
app/[portal]/(hotel)/
  _components/
    HotelHeader.tsx
    HotelEventCard.tsx
    HotelVenueCard.tsx
    TonightFeed.tsx
    ConciergePicks.tsx
    NearbyVenues.tsx
    TimeGreeting.tsx
```

They can import data hooks, types, and auth utilities from shared `lib/`. They must not import any component from `components/`.
