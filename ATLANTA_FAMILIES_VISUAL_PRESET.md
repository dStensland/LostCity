# Atlanta Families Portal - Full Visual Preset Configuration

## Overview

This document describes the comprehensive visual preset configuration applied to the **Atlanta Families** portal for maximum visual differentiation from the default LostCity dark neon aesthetic.

## Applied Configuration

### Visual Preset: `family_friendly`

The portal now uses the `family_friendly` visual preset with the following complete configuration:

```json
{
  "visual_preset": "family_friendly",
  "theme_mode": "light",
  "primary_color": "#059669",
  "secondary_color": "#0891b2",
  "accent_color": "#f59e0b",
  "background_color": "#fefce8",
  "text_color": "#1c1917",
  "muted_color": "#78716c",
  "button_color": "#059669",
  "button_text_color": "#ffffff",
  "border_color": "#fde68a",
  "card_color": "#fffbeb",
  "font_heading": "Nunito",
  "font_body": "Inter",
  "header": {
    "template": "branded",
    "logo_position": "center",
    "logo_size": "lg",
    "nav_style": "pills",
    "show_search_in_header": true,
    "transparent_on_top": false
  },
  "ambient": {
    "effect": "gradient_wave",
    "intensity": "subtle",
    "colors": {
      "primary": "#fde68a",
      "secondary": "#bbf7d0"
    },
    "animation_speed": "slow"
  },
  "component_style": {
    "border_radius": "lg",
    "shadows": "medium",
    "card_style": "elevated",
    "button_style": "pill",
    "glow_enabled": false,
    "glow_intensity": "subtle",
    "animations": "subtle",
    "glass_enabled": false
  },
  "category_colors": {
    "family": "#059669",
    "community": "#0891b2",
    "art": "#d97706",
    "theater": "#a855f7",
    "food_drink": "#ea580c",
    "learning": "#2563eb",
    "outdoors": "#16a34a"
  }
}
```

## Visual Changes

### Color Palette

**Light & Warm Theme:**
- Background: Soft cream yellow (`#fefce8`)
- Cards: Warm ivory (`#fffbeb`)
- Primary: Emerald green (`#059669`)
- Secondary: Cyan blue (`#0891b2`)
- Accent: Amber orange (`#f59e0b`)
- Borders: Soft yellow (`#fde68a`)
- Text: Dark brown (`#1c1917`)
- Muted: Stone gray (`#78716c`)

**Category Colors (7 categories):**
- Family: Emerald green (`#059669`)
- Community: Cyan (`#0891b2`)
- Art: Orange (`#d97706`)
- Theater: Purple (`#a855f7`)
- Food & Drink: Dark orange (`#ea580c`)
- Learning: Blue (`#2563eb`)
- Outdoors: Green (`#16a34a`)

### Typography

- **Heading Font:** Nunito (friendly, rounded sans-serif)
- **Body Font:** Inter (clean, readable sans-serif)
- Both fonts loaded via Google Fonts API in `PortalTheme.tsx`

### Header (Branded Template)

The portal now uses the "branded" header template with:
- **Large centered logo** (lg size)
- **Pill-style navigation** tabs below the logo
- **Search button** in the header
- Solid background (not transparent)
- Centered logo creates a welcoming, family-friendly appearance

### Ambient Effect (Gradient Wave)

The portal features a subtle animated gradient wave effect:
- **Effect type:** `gradient_wave`
- **Colors:** Soft yellow (`#fde68a`) and mint green (`#bbf7d0`)
- **Intensity:** Subtle (low opacity)
- **Speed:** Slow animation (20 seconds per cycle)
- Creates a calm, gentle atmosphere without distraction

### Component Styles

**Rounded & Soft:**
- **Border radius:** Large (`lg` = 1rem) - all cards and buttons have prominent rounded corners
- **Shadows:** Medium depth - subtle elevation for cards
- **Card style:** Elevated - cards float above the background
- **Button style:** Pill - fully rounded buttons for a friendly feel
- **Glow:** Disabled - no neon effects
- **Glass:** Disabled - solid backgrounds for clarity
- **Animations:** Subtle - gentle transitions without overwhelming motion

## Files Modified

### 1. `/web/lib/visual-presets.ts`

Updated the `family_friendly` preset definition:
- Changed ambient effect from `subtle_glow` to `gradient_wave`
- Updated accent color to `#f59e0b` (was `#d97706`)
- Changed shadows from `subtle` to `medium`
- Added 4 more category colors (theater, food_drink, learning, outdoors)
- Added `animation_speed: "slow"` to ambient config

### 2. `/web/scripts/create-atlanta-families-portal.ts`

Updated the portal creation script's branding configuration:
- Applied full visual preset configuration
- Added all header, ambient, component_style, and category_colors settings
- This ensures new portals created with this script have the complete config
- Fixed ESLint warnings for unused destructured variables

### 3. `/web/scripts/update-atlanta-families-branding.ts` (NEW)

Created a new script to update the existing Atlanta Families portal:
- Applies the full visual preset configuration
- Updates the portal's branding in the database
- Provides detailed output of the changes

### 4. `/web/scripts/check-atlanta-families.ts` (NEW)

Created a helper script to check the current portal configuration:
- Useful for debugging and verification
- Shows current branding configuration

## How It Works

### 1. Visual Preset System (`/web/lib/visual-presets.ts`)

Defines preset configurations that can be applied to portals. Each preset includes:
- Color palette
- Typography
- Header configuration
- Ambient effects
- Component styles
- Category color overrides

### 2. Preset Application (`/web/lib/apply-preset.ts`)

The `applyPreset()` function merges preset defaults with custom overrides:
- Preset provides base configuration
- Portal-specific overrides take precedence
- Deep merges nested objects (header, ambient, component_style)
- Returns fully resolved branding configuration

### 3. Portal Theme Injection (`/web/components/PortalTheme.tsx`)

Injects CSS custom properties based on resolved branding:
- Loads custom Google Fonts
- Sets color CSS variables
- Applies component style variables (border radius, shadows, etc.)
- Sets data attributes on body for style targeting
- Handles light/dark theme modes

### 4. Header Selection (`/web/components/headers/PortalHeader.tsx`)

Renders the appropriate header template based on configuration:
- `standard` - Default LostCity header
- `minimal` - Logo + user menu only
- `branded` - Large centered logo with nav below (Atlanta Families uses this)
- `immersive` - Transparent over hero

### 5. Ambient Background (`/web/components/ambient/AmbientBackground.tsx`)

Renders the appropriate ambient effect:
- `none` - No effect
- `subtle_glow` - Category-based glow
- `gradient_wave` - Animated gradients (Atlanta Families uses this)
- `particle_field` - Floating particles
- `aurora` - Northern lights
- `mesh_gradient` - Mesh gradients
- `noise_texture` - Animated noise

## Running the Scripts

### Update Existing Portal

```bash
cd web
npx tsx scripts/update-atlanta-families-branding.ts
```

### Check Current Configuration

```bash
cd web
npx tsx scripts/check-atlanta-families.ts
```

### Create New Portal (with full config)

```bash
cd web
npx tsx scripts/create-atlanta-families-portal.ts
```

## Verification

After running the update script, the portal at `/atlanta-families` will display:

1. **Light cream/yellow background** - Warm and inviting
2. **Centered logo** at the top of the header
3. **Pill-shaped navigation tabs** below the logo
4. **Soft gradient wave animation** in the background (subtle yellow-green waves)
5. **Large rounded corners** on all cards and buttons
6. **Medium shadows** giving cards a floating appearance
7. **Emerald green primary color** for buttons and accents
8. **Custom category colors** for the 7 family-friendly categories
9. **Nunito headings** and **Inter body text**
10. **No neon glow effects** - clean and accessible

## Design Rationale

The family-friendly preset is designed to:

1. **Maximize visual differentiation** from the dark neon LostCity default
2. **Create a welcoming atmosphere** for families with kids
3. **Ensure high accessibility** with good contrast and no distracting effects
4. **Use soft, warm colors** that feel safe and inviting
5. **Feature playful typography** (Nunito) without being childish
6. **Provide clear navigation** with prominent centered branding
7. **Support the family focus** through category colors and ambient effects

## Technical Notes

### Font Loading

Fonts are loaded automatically by `PortalTheme.tsx`:
- Adds Google Fonts `<link>` tags to the document
- Loads multiple weights (400, 500, 600, 700)
- Sets CSS variables for font families
- Applies fonts via CSS classes and variables

### CSS Variables

The theme system uses CSS custom properties:
- `--portal-primary`, `--portal-secondary`, etc. for colors
- `--portal-font-heading`, `--portal-font-body` for typography
- `--radius-base`, `--radius-card`, `--radius-button` for border radius
- `--shadow-card` for elevation
- `--glow-opacity` for glow effects (0 when disabled)
- `--animation-duration-multiplier` for animation speed

### Data Attributes

Component styles are controlled via body data attributes:
- `data-theme="light"` - Light theme mode
- `data-card-style="elevated"` - Card elevation style
- `data-button-style="pill"` - Button shape
- `data-glow="disabled"` - Disables glow effects
- `data-glass="disabled"` - Disables glass effects
- `data-animations="subtle"` - Reduced animation intensity

### Ambient Effect Performance

The gradient wave effect is pure CSS:
- No JavaScript animation loop
- Uses CSS animations with `background-position`
- Two overlapping gradients for depth
- Respects `prefers-reduced-motion` media query

## Future Enhancements

Possible additions to the family-friendly preset:

1. **Custom illustrations** - Add family-friendly icons and graphics
2. **Hero section** - Large welcome image at the top
3. **Larger tap targets** - Increase button sizes for kids
4. **Simplified navigation** - Reduce complexity for younger users
5. **Age filters** - Filter events by appropriate age ranges
6. **Safety badges** - Highlight kid-safe, alcohol-free venues
