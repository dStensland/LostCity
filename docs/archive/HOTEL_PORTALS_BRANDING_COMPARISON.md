# Hotel Portal Branding Comparison

Quick visual reference for the three hotel portals.

## Color Palettes

### FORTH Hotel (Luxury Warm)
```
Theme: light
Primary:    #D4AF7A  ████ (warm gold)
Secondary:  #C9A88A  ████ (soft taupe)
Accent:     #C9A96E  ████ (muted gold)
Background: #FDFBF7  ████ (cream white)
Text:       #2F2D2A  ████ (dark brown)
Card:       #F5F3EE  ████ (warm gray)
Button:     #D4AF7A  ████ (warm gold)
```

### Bellyard Hotel (Modern Earthy)
```
Theme: light
Primary:    #2D3436  ████ (dark charcoal)
Secondary:  #636E72  ████ (warm gray)
Accent:     #D4A574  ████ (terracotta/copper)
Background: #FAF8F5  ████ (warm white)
Text:       #2D3436  ████ (dark charcoal)
Card:       #FFFFFF  ████ (white)
Button:     #D4A574  ████ (terracotta/copper)
```

### Hotel Clermont (Dark Edgy)
```
Theme: dark
Primary:    #1A1A2E  ████ (deep navy/black)
Secondary:  #E94560  ████ (neon pink/red)
Accent:     #FFC947  ████ (warm yellow/gold)
Background: #0F0F1A  ████ (near black)
Text:       #F2F2F2  ████ (light gray)
Card:       #1A1A2E  ████ (deep navy/black)
Button:     #E94560  ████ (neon pink/red)
```

## Typography

| Portal | Heading Font | Body Font | Style |
|--------|-------------|-----------|-------|
| **FORTH** | Cormorant Garamond | Inter | Classic serif + modern sans |
| **Bellyard** | Cormorant Garamond | Inter | Classic serif + modern sans |
| **Clermont** | Space Grotesk | Inter | Modern geometric + sans |

## Visual Style

| Portal | Card Style | Shadows | Glow | Animations | Border Radius |
|--------|-----------|---------|------|------------|---------------|
| **FORTH** | Flat | Soft | No | Low | Large (lg) |
| **Bellyard** | Flat | Soft | No | Low | Large (lg) |
| **Clermont** | Bordered | Medium | Yes (medium) | Low | Medium (md) |

## Brand Personality

### FORTH Hotel
- **Vibe:** Luxury, sophisticated, curated
- **Target:** Upscale travelers, business guests
- **Colors:** Warm golds and creams (spa-like, calming)
- **Tagline:** "Your Evening, Curated"

### Bellyard Hotel
- **Vibe:** Design-forward, local, cultural
- **Target:** Design-conscious travelers, art lovers
- **Colors:** Earthy charcoal + terracotta (modern, grounded)
- **Tagline:** "Your guide to Atlanta's Westside"

### Hotel Clermont
- **Vibe:** Edgy, authentic, unapologetically Atlanta
- **Target:** Younger travelers, nightlife seekers
- **Colors:** Dark + neon accents (moody, electric)
- **Tagline:** "Atlanta, unfiltered"

## Neighborhood Focus

### FORTH Hotel (Old Fourth Ward)
- Geo Center: [33.7834, -84.3731]
- No specific neighborhoods configured
- 5km radius from hotel

### Bellyard Hotel (West Midtown)
- Geo Center: [33.7705, -84.4022]
- Focus: West Midtown, Westside, Home Park, English Avenue
- 5km radius from hotel

### Hotel Clermont (Poncey-Highland)
- Geo Center: [33.7744, -84.3605]
- Focus: Poncey-Highland, Virginia-Highland, Little Five Points, Inman Park, Old Fourth Ward
- 5km radius from hotel

## Content Differences

| Feature | FORTH | Bellyard | Clermont |
|---------|-------|----------|----------|
| Adult Content | Excluded | Excluded | Allowed |
| Glow Effects | Off | off | On (medium) |
| Theme Mode | Light | Light | Dark |
| Sharing Brand | "FORTH Hotel" | "Bellyard Hotel" | "Hotel Clermont" |
| Footer Text | "Curated for FORTH Hotel guests" | "Curated for Bellyard Hotel guests" | "Curated for Hotel Clermont guests" |

## Implementation Notes

- All three use the same hotel template: `/web/app/[portal]/_templates/hotel.tsx`
- FORTH uses special `ForthExperience` component
- Bellyard and Clermont use standard `HotelConciergeFeed` component
- Branding is 100% data-driven (no code changes needed)
- Each portal can be customized via database updates
- All fonts are Google Fonts (already loaded in app)

## Testing URLs

Local development:
- http://localhost:3000/forth
- http://localhost:3000/bellyard
- http://localhost:3000/clermont

Production (when deployed):
- https://lostcity.app/forth
- https://lostcity.app/bellyard
- https://lostcity.app/clermont
