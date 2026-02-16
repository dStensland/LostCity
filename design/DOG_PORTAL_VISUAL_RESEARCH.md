# Dog Portal Visual Design Research
**Research Date**: 2026-02-14
**Target**: Atlanta dog owners portal — playful, warm, "ROMP" energy
**Anti-patterns**: Generic pet industry, corporate directories, Instagram aesthetic

---

## 1. Color Palettes — Bold, Punchy, Warm

### Reference 1: "Sunset Park" Palette
**Source**: Dribbble/design systems for outdoor recreation apps
**Colors**:
- Primary: `#FF6B35` (burnt orange — high energy, warm)
- Secondary: `#F7931E` (golden hour yellow)
- Accent: `#C1121F` (barn red — grounding)
- Neutral warm: `#FFF8F0` (cream, not stark white)
- Dark: `#2C1810` (warm brown, not black)

**Steal this**: Use burnt orange as primary action color (buttons, active states). Golden yellow for badges/tags ("Dog Friendly", "Off-Leash"). Warm cream backgrounds instead of white.

**Maps to dog portal**: Warm = approachable. Orange/yellow = high energy without being aggressive. Brown grounds it (literally — dirt, trails, earth).

---

### Reference 2: "Playground" Palette
**Source**: Duolingo-style playful product design
**Colors**:
- Primary: `#FF6F59` (coral)
- Secondary: `#FFD23F` (sunny yellow)
- Tertiary: `#06BCC1` (turquoise — surprise pop)
- Background: `#FFF7ED` (warm white)
- Text: `#3A2618` (dark chocolate brown)

**Steal this**: Multi-color accent strategy. Use different colors for content types:
- Events = coral
- Places = yellow
- Services = turquoise

**Maps to dog portal**: Differentiates mixed content in feed without relying on icons. Chaotic in a joyful way (like dogs).

---

### Reference 3: "Trail Mix" Palette (AllTrails-inspired but warmer)
**Source**: AllTrails uses greens; we pivot to warm earth tones
**Colors**:
- Primary: `#D97706` (amber — trail dirt)
- Secondary: `#059669` (forest green — kept from AllTrails)
- Accent: `#EA580C` (bright orange — safety vest energy)
- Sky: `#38BDF8` (clear day blue)
- Cream: `#FFFBEB`

**Steal this**: Use green for "nature/trail" content, orange for "event/happening", amber for "always available" places.

**Maps to dog portal**: Connects to outdoor adventure (AllTrails reference) while staying warm. Blue sky for map backgrounds.

---

### Reference 4: "Farmers Market" Palette
**Source**: Branding for local/community-focused products
**Colors**:
- Primary: `#EF4444` (tomato red)
- Secondary: `#F59E0B` (squash orange)
- Tertiary: `#10B981` (veggie green)
- Background: `#FFFAF0` (linen)
- Text: `#451A03` (espresso)

**Steal this**: High-chroma, unrefined colors. Nothing pastel. Everything feels "fresh picked."

**Maps to dog portal**: Local/community energy. Warm, slightly chaotic palette = farmer's market vibes = neighborhood discovery.

---

### Reference 5: "Summer Camp" Palette
**Source**: Youth camp branding, nostalgic but modern
**Colors**:
- Primary: `#FB923C` (creamsicle orange)
- Secondary: `#FBBF24` (sunshine)
- Accent 1: `#14B8A6` (swimming pool teal)
- Accent 2: `#F43F5E` (watermelon pink)
- Text: `#292524` (charcoal)

**Steal this**: Use pink/teal as surprise accents for delight moments (saved events, RSVP confirmations).

**Maps to dog portal**: Nostalgic joy, outdoor energy. Not corporate, not polished — fun.

---

## 2. Typography Pairings — Rounded & Chunky

### Reference 6: Baloo 2 + Inter
**Display**: Baloo 2 (Google Fonts) — Ultra bold, rounded, playful
**Body**: Inter (Google Fonts) — Clean, readable, modern

**Weights**:
- Baloo 2: 800 (ExtraBold) for headings
- Inter: 400 (Regular) for body, 600 (SemiBold) for labels

**Steal this**: Use Baloo 2 for:
- Portal name/logo
- Section headings ("Happening This Weekend")
- Event titles in cards

Use Inter for:
- Event descriptions
- Timestamps, locations
- UI labels

**CSS**:
```css
font-family: 'Baloo 2', system-ui, sans-serif; /* headings */
font-family: 'Inter', system-ui, sans-serif; /* body */
```

**Maps to dog portal**: Baloo is chunky and dumb (compliment). Inter is invisible — lets content breathe.

---

### Reference 7: Fredoka + DM Sans
**Display**: Fredoka (Google Fonts) — Soft, rounded, friendly
**Body**: DM Sans (Google Fonts) — Geometric, clean

**Steal this**: Fredoka for buttons and CTAs ("Find Dog Parks Near You"). DM Sans for body text and metadata.

**Why**: Fredoka is friendlier than Baloo (softer curves). DM Sans is warmer than Inter. Good for family-friendly energy.

---

### Reference 8: Nunito + Source Sans 3
**Display**: Nunito (Google Fonts) — Rounded terminals, playful
**Body**: Source Sans 3 (Google Fonts) — Open counters, readable

**Steal this**: Nunito at 900 weight for big headings. Source Sans 3 for everything else.

**Maps to dog portal**: Nunito is the most "professional" of the rounded fonts — use if the portal needs to feel trustworthy (vet services, training classes) while staying playful.

---

## 3. Card & Layout Design — Mixed Content Feeds

### Reference 9: Airbnb Experiences Feed
**What it is**: Airbnb's "Experiences" tab — mixes tours, classes, food events in one feed
**URL**: airbnb.com/s/experiences

**Steal this**:
- **Color-coded category tags** at top-left of card image
- **Bold typography hierarchy**: Big event name, small metadata
- **Consistent card size** with image aspect ratio (4:3 or 16:9)

**How it maps**:
- Dog event = tag "EVENT • SAT 10AM"
- Dog park = tag "PLACE • ALWAYS OPEN"
- Dog bakery = tag "SERVICE • 2 MILES"

Color-code tags using the palette:
- Events = coral `#FF6F59`
- Places = yellow `#FFD23F`
- Services = turquoise `#06BCC1`

---

### Reference 10: Notion Calendar View (multi-content)
**What it is**: Notion databases with mixed content types (tasks, events, links)
**URL**: notion.so

**Steal this**:
- **Emoji + color coding** for content types
- **Property pills** (small rounded rectangles for metadata)
- **Density toggle** (compact vs spacious views)

**How it maps**:
- Event card: "🎉 Yappy Hour" with orange background
- Park card: "🌳 Piedmont Off-Leash Area" with green background
- No image? Use solid color block + emoji + chunky typography

**Critical for dog portal**: When photos are missing, fall back to:
```
[Solid color block with emoji]
🎾 Doggy Playdate
Saturday 10am • Grant Park
12 dogs going
```

---

### Reference 11: AllTrails Trail Cards
**What it is**: AllTrails app — trail cards with photos, difficulty, length, elevation
**URL**: alltrails.com

**Steal this**:
- **Metadata badges** (difficulty = easy/moderate/hard)
- **Icon + number combos** (distance, elevation gain)
- **Star ratings + review count**

**How it maps**:
- Dog park card: "Off-Leash Allowed" badge, "4.2★ (89 reviews)", "0.3 mi away"
- Event card: "Dog Friendly" badge, "23 going", "Starts in 2 hours"

---

## 4. Illustration Styles — Fallbacks for Missing Photos

### Reference 12: Headspace Illustrations
**What it is**: Headspace app — simple, warm, character-based illustrations
**Style**: Rounded shapes, limited palette, friendly characters, no outlines

**Steal this**:
- Illustrate "no photo" states with simple dog silhouettes
- Use same color palette as UI (orange, yellow, teal)
- Rounded shapes, no hard edges

**Example fallback**:
```
[Illustration: simple orange dog silhouette running]
"New event posted!"
```

**Maps to dog portal**: Warm, not corporate. Playful, not clip-art. Consistent with overall "ROMP" energy.

---

### Reference 13: Duolingo's Duo Character System
**What it is**: Duolingo's owl mascot in different poses/emotions
**Style**: Simple vector, expressive, reusable

**Steal this**:
- Create a "portal mascot" dog (simple illustration)
- Use in different poses for empty states, success states, errors
- Examples:
  - Empty feed: Dog lying down, "No events this week. Check back soon!"
  - RSVP success: Dog jumping, "You're going!"
  - Error: Dog tilting head, "Hmm, something went wrong."

**Maps to dog portal**: Adds personality without relying on user photos. Mascot can be chunky, dumb, joyful.

---

### Reference 14: Abstract Organic Shapes (Figma, Webflow)
**What it is**: Blob shapes, organic forms as decorative backgrounds
**Style**: Soft, rounded, non-geometric

**Steal this**:
- Use as background decorations behind cards
- Subtle, low-opacity blobs in brand colors
- Creates "playful" without being literal (no paw prints)

**Example**:
```css
.hero-background {
  background: radial-gradient(circle at 20% 30%, rgba(255, 107, 53, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(247, 147, 30, 0.1) 0%, transparent 50%);
}
```

**Maps to dog portal**: Adds visual interest without images. Warm, organic, not corporate.

---

## 5. Map UI Design — Branded Map Experiences

### Reference 15: Custom Mapbox Styles (Outdoor Theme)
**What it is**: Mapbox Studio custom map themes
**URL**: mapbox.com/gallery

**Steal this**:
- **Outdoors theme** as base (shows parks/trails clearly)
- **Custom marker icons**: Dog silhouette for parks, bone for events, building for services
- **Cluster circles**: When multiple pins are close, show count in chunky typography

**Color overrides**:
- Water: `#38BDF8` (sky blue)
- Parks: `#059669` (forest green)
- Roads: `#D1D5DB` (light gray)
- Labels: `#292524` (charcoal)

**Marker design**:
```
Park marker: Green circle with white dog silhouette
Event marker: Orange circle with white calendar icon
Service marker: Yellow circle with white storefront icon
```

**Maps to dog portal**: Makes map feel owned, not generic. Supports "map-forward" design (AllTrails influence).

---

### Reference 16: Strava Activity Map Overlays
**What it is**: Strava app — route maps with activity overlays
**Style**: Dark map base, bright activity lines, glassy overlay cards

**Steal this**:
- **Bottom sheet card overlay** that slides up over map
- **Glassy/frosted background** (backdrop-filter: blur)
- **Bright accent colors** on dark map

**Example**:
```
[Map view with dark base]
[Glassy card slides up from bottom]
"Piedmont Park Off-Leash Area"
[Photo, rating, details]
```

**Maps to dog portal**: One-handed interaction (swipe up for details). Keeps map visible behind card.

---

## 6. Websites/Apps with "ROMP" Energy

### Reference 17: Oatly Website
**What it is**: Oatly.com — oat milk brand with chaotic, playful web design
**URL**: oatly.com

**Steal this**:
- **Weird copy**: "WOW NO COW" energy. For dog portal: "WOOF. EXPLORE."
- **Imperfect layouts**: Cards slightly rotated, not perfectly aligned grid
- **Bold, chunky typography** as graphic element

**Example for dog portal**:
```
Hero headline: "SNIFF. PLAY. REPEAT."
Subhead: "All the dog-friendly stuff in Atlanta."
```

**Maps to dog portal**: Permission to be weird. Playful copy = playful energy. Not polished = authentic.

---

### Reference 18: Cosmos (Illustration-Heavy Web Experience)
**What it is**: Cosmos.so — visual note-taking, playful UI
**Style**: Soft colors, rounded corners everywhere, gentle animations

**Steal this**:
- **Rounded corners on EVERYTHING**: Cards, buttons, images, inputs
- **Soft shadows**: Not harsh Material Design shadows
- **Bounce animations** on interactions (click button = slight bounce)

**CSS**:
```css
.card {
  border-radius: 16px; /* chunky corners */
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.1); /* soft orange shadow */
  transition: transform 0.2s ease;
}
.card:hover {
  transform: translateY(-4px) scale(1.02); /* bouncy */
}
```

**Maps to dog portal**: Everything feels soft, friendly, alive. Motion = "bouncy" = dog energy.

---

### Reference 19: Superhuman Email (Bold Typography, Colorful)
**What it is**: Superhuman app — email client with playful colors, bold type
**Style**: High contrast, vibrant colors, confident typography

**Steal this**:
- **Keyboard shortcut hints** in UI (power users = dog owners who know their spots)
- **Color-coded everything**: Different colors for different actions
- **Big, bold empty states**: "No events yet. Be the first to post one!"

**Maps to dog portal**: Confidence in typography. Not apologetic. Bold = energy.

---

### Reference 20: Linear App (Clean but Playful)
**What it is**: Linear.app — project management with delightful micro-interactions
**Style**: Dark mode option, smooth animations, satisfying clicks

**Steal this**:
- **Satisfying micro-interactions**: Clicking "RSVP" has a little animation
- **Keyboard shortcuts everywhere** (J/K to navigate feed, like Reddit/Twitter)
- **Fast, responsive feel**: No loading spinners, optimistic UI updates

**Maps to dog portal**: Feels alive, not sluggish. Every click is a tiny dopamine hit. Matches "joyful" energy.

---

## Summary: Design Direction for Dog Portal

### Visual Preset Recommendation: `custom`
Since this must NOT look like other LostCity portals, start with `custom` preset.

### Branding Configuration (Draft)

```json
{
  "visual_preset": "custom",
  "colors": {
    "primary": "#FF6B35",
    "secondary": "#F7931E",
    "accent": "#06BCC1",
    "background": "#FFFBEB",
    "text": "#292524",
    "border": "#FDE68A"
  },
  "typography": {
    "display": "Baloo 2",
    "body": "Inter"
  },
  "header": {
    "template": "branded",
    "logo_position": "left",
    "logo_size": "lg",
    "nav_style": "pills",
    "background": "#FFFBEB"
  },
  "ambient": {
    "effect": "mesh_gradient",
    "intensity": "subtle",
    "colors": ["#FF6B35", "#F7931E", "#06BCC1"]
  },
  "component_style": {
    "border_radius": "lg",
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

### Content Type Differentiation (No Photos)

When event/place has NO photo:

**Event Card (No Photo)**:
```
┌─────────────────────────┐
│ [Coral solid block]     │
│ 🎉                      │
│ YAPPY HOUR              │ ← Baloo 2, 800 weight
│ Saturday 10am           │ ← Inter, 400 weight
│ Fetch Brewing Co.       │
│ [23 going] [Save]       │
└─────────────────────────┘
```

**Place Card (No Photo)**:
```
┌─────────────────────────┐
│ [Yellow solid block]    │
│ 🌳                      │
│ PIEDMONT OFF-LEASH      │
│ 0.3 miles away          │
│ [4.2★ (89)] [Directions]│
└─────────────────────────┘
```

### Motion/Animation Examples

- **Button clicks**: 0.2s bounce (scale 1 → 1.05 → 1)
- **Card hover**: Lift up 4px with soft shadow
- **RSVP success**: Confetti burst (tiny dog emojis)
- **Page transitions**: Slide up from bottom (like excited dog jumping)
- **Loading states**: Pulsing dot dot dot (not spinners)

### Typography Scale

```css
--font-display: 'Baloo 2', system-ui;
--font-body: 'Inter', system-ui;

/* Sizes */
--text-xs: 0.75rem;   /* metadata */
--text-sm: 0.875rem;  /* body text */
--text-base: 1rem;    /* default */
--text-lg: 1.125rem;  /* card titles */
--text-xl: 1.5rem;    /* section headings */
--text-2xl: 2rem;     /* hero headline */
--text-3xl: 3rem;     /* portal name */

/* Weights */
--weight-normal: 400;
--weight-semibold: 600;
--weight-bold: 700;
--weight-extrabold: 800; /* Baloo only */
```

### Map Style (Mapbox)

- Base: Outdoors theme
- Water: `#38BDF8`
- Parks: `#059669`
- Custom markers: Dog silhouette (parks), calendar (events), building (services)
- Marker colors: Match category colors (coral, yellow, teal)

---

## Next Steps

1. **Prototype**: Build 3 card variations (event with photo, event without photo, place without photo) using Baloo 2 + Inter + color palette.

2. **Illustration system**: Commission or create 5-8 simple dog illustrations for empty states, success states, loading states.

3. **Map integration**: Test Mapbox custom style with dog-themed markers. Ensure readability at different zoom levels.

4. **Motion**: Implement bounce animations on buttons/cards. Test on mobile (must feel fast, not janky).

5. **A/B test palettes**: Test "Sunset Park" (orange/yellow/red) vs "Playground" (coral/yellow/teal) with small user group.

---

## Anti-Pattern Checklist

Avoid these:
- ❌ Paw print icons (too literal)
- ❌ Bone graphics (too cliche)
- ❌ Pastels (not bold enough)
- ❌ Corporate blue (too serious)
- ❌ Stock photos of dogs staring at camera (too polished)
- ❌ Default Google Maps (too generic)
- ❌ Sharp corners (not playful)
- ❌ Black text on white background (too stark)
- ❌ Helvetica/Arial (too boring)
- ❌ Perfectly aligned grids (too corporate)

---

**END RESEARCH DOC**
