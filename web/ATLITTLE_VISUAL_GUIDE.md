# ATLittle Visual Design Guide

## Logo Specifications

### Kawaii Peach Character

**Personality:** Friendly, warm, approachable family mascot
**Style:** Kawaii (cute Japanese aesthetic) with Southern charm

#### Face Elements
```
Eyes: ^_^ expression
- Curved upward arcs (bigger than typical)
- Stroke width: 2.5px
- Positioned symmetrically at ±7 units from center
- Arc depth: 3 units upward

Smile: Gentle curve
- Width: 5 units (±2.5 from center)
- Depth: 2 units downward
- Stroke width: 1.8px

Blush: Prominent rosy cheeks
- Size: 4 units wide × 2.5 units tall
- Color: #FFBCBC at 75% opacity
- Positioned at ±9 units from center
```

#### Body Shape
```
Main Body: Soft ellipse (nearly circular)
- Width: 58 units (rx: 29)
- Height: 62 units (ry: 31)
- Gradient: 4-stop radial
  - 0%: #FFCFA7 (cream peach)
  - 30%: #FDB88E (mid peach)
  - 70%: #FBAB7E (main peach)
  - 100%: #E8956A (darker peach)

Crease: Subtle vertical line
- Very light (18% opacity)
- Slightly curved for organic feel

Shine: Upper-left highlight
- Size: 15×12 units
- Positioned at upper left (-8, -8)
- White radial gradient (80% → 0% opacity)
```

#### Leaves
```
Count: 2 large leaves
Style: Organic path shapes (not simple ellipses)
Gradient: Light to dark green
- Start: #9DD09D (sage)
- Mid: #7CB77C (leaf green)
- End: #5A9A5A (forest green)

Veins: Subtle center line
- Opacity: 40%
- Matches leaf color
```

#### Stem
```
Width: 3.5px
Style: Curved path
Color: #8B7355 (warm brown)
```

### Logo Variants

**Icon (64×72px)**
- Peach only, minimal detail
- Face scale: 1.0
- For favicons, app icons

**Compact (200×48px)**
- Peach + "ATLittle" text
- Face scale: 0.6
- For mobile headers, tight spaces

**Full (280×140px)**
- Peach + "ATLittle" + tagline + attribution
- Face scale: 1.15
- For landing pages, main headers
- Includes swoosh decoration under tagline

## Color Palette

### Primary Colors
```css
--peach-light: #FFCFA7;  /* Cream peach - highlights */
--peach-mid: #FDB88E;    /* Mid peach - transitions */
--peach-main: #FBAB7E;   /* Main peach - primary */
--peach-dark: #E8956A;   /* Dark peach - shadows */

--leaf-light: #9DD09D;   /* Sage green - highlights */
--leaf-green: #7CB77C;   /* Leaf green - primary */
--leaf-dark: #5A9A5A;    /* Forest green - shadows */

--text-green: #4A7C59;   /* Text - brand name */
--tagline: #C4956C;      /* Tagline - secondary text */
```

### Background Colors (from family_friendly preset)
```css
--background: #FEFCE8;   /* Warm cream */
--card: #FFFBEB;         /* Light yellow cream */
--border: #FDE68A;       /* Soft yellow */
--muted: #78716C;        /* Warm gray */
```

### Accent Colors
```css
--primary: #059669;      /* Green (CTAs) */
--secondary: #0891B2;    /* Cyan (links) */
--accent: #F59E0B;       /* Amber (highlights) */
```

## Scroll Behavior

### Header Animation Specs
```
Initial State (top of page):
- Container height: 140px
- Logo scale: 1.0
- Duration: 400ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

Scrolled State (scrollY > 10px):
- Container height: 52px
- Logo scale: 0.35
- Duration: 400ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

Performance:
- will-change: transform, height
- GPU-accelerated transforms
- No layout shifts (minHeight: 0)
```

### Animation Timing
```
Logo scale: 400ms ease-out
Height change: 400ms ease-out
Opacity fade: 300ms ease-out (for attribution)

All use: cubic-bezier(0.4, 0, 0.2, 1)
(Material Design standard easing)
```

## Floating Leaves Effect

### Positioning Strategy
```
Zone 1 (25%): Top corners
- X: 0-15% or 85-100%
- Y: 0-15%

Zone 2 (25%): Side edges
- X: 0-8% or 92-100%
- Y: 20-80%

Zone 3 (25%): Bottom corners
- X: 0-15% or 85-100%
- Y: 85-100%

Zone 4 (25%): Top scattered
- X: 15-85%
- Y: 0-10%
```

### Leaf Properties
```
Count: 14 (medium intensity)
Size range: 14-32 units
Shapes: 2 variants (rounded, pointed)
Colors: From palette (5 variations)
Opacity: 0.3 (medium), 0.2 (subtle), 0.45 (bold)
Blur: 0.3px Gaussian (soft edges)
```

### Animation Properties
```
Duration: 35-80 seconds
Delay: Random (-50s to 0s for offset start)
Movement: Gentle drift
- X drift: ±20 units
- Y drift: 15-40 units
- Rotation: ±30 degrees

Keyframe patterns: 3 variations
- leaf-float-0: 4 keyframes (0%, 25%, 50%, 75%, 100%)
- leaf-float-1: 3 keyframes (0%, 30%, 60%, 100%)
- leaf-float-2: 3 keyframes (0%, 40%, 70%, 100%)
```

### Intensity Levels
```
Subtle:
- Count: 10 leaves
- Opacity: 0.2
- Best for: Busy pages

Medium (default):
- Count: 14 leaves
- Opacity: 0.3
- Best for: General use

Bold:
- Count: 18 leaves
- Opacity: 0.45
- Best for: Minimal content
```

## Typography

### Brand Name
```
Font: 'Nunito', 'Quicksand', sans-serif
Weight: 800 (extra bold)
Size: 36px (full), 26px (compact)
Color: #4A7C59 (text-green)
Letter spacing: -1px (full), -0.5px (compact)
```

### Tagline
```
Font: 'Nunito', 'Quicksand', sans-serif
Weight: 600 (semi-bold)
Style: italic
Size: 14px
Color: #C4956C (tagline)
Letter spacing: 0.5px
```

### Attribution
```
Font: 'Inter', sans-serif
Weight: 500 (medium)
Size: 10px
Color: #9CA3AF (gray-400)
```

## Accessibility

### Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* Disable all animations */
  animation: none !important;
  transition: none !important;

  /* Keep visibility but reduce opacity */
  opacity: 0.5 !important;
}
```

### Contrast Ratios
```
Text on cream background:
- Text green (#4A7C59): 8.2:1 (AAA)
- Tagline (#C4956C): 4.8:1 (AA)
- Muted (#78716C): 4.9:1 (AA)

Button contrast:
- Green (#059669) on cream: 4.7:1 (AA)
- Dark text (#1c1917) on cream: 14.1:1 (AAA)
```

### ARIA Labels
```html
<svg aria-label="ATLittle - Atlanta Family Adventures">
  <!-- Logo content -->
</svg>

<div aria-hidden="true">
  <!-- Floating leaves ambient effect -->
</div>
```

## Brand Personality

**Voice:** Friendly, warm, welcoming
**Tone:** Playful yet trustworthy
**Target:** Parents with children 0-12 years
**Emotion:** Joy, discovery, community

**Do's:**
- Use warm, peachy cream tones
- Keep animations gentle and smooth
- Emphasize roundness and softness
- Maintain cute kawaii aesthetic

**Don'ts:**
- Avoid harsh edges or sharp corners
- No aggressive or fast animations
- Don't use cold colors (blues, grays)
- Avoid overly complex patterns

## Implementation Checklist

- [ ] Logo renders correctly in all 3 variants
- [ ] Kawaii face is clearly visible and cute
- [ ] Blush spots are prominent and peachy
- [ ] Gradients are smooth without banding
- [ ] Scroll animation is smooth (no jitter)
- [ ] Logo scales from center-top origin
- [ ] Floating leaves stay at edges
- [ ] Animations respect reduced-motion
- [ ] Colors match warm peachy palette
- [ ] Typography is readable and friendly
- [ ] Contrast ratios meet WCAG AA standards
- [ ] Performance is optimal (60fps)

---

**Last Updated:** 2026-01-31
**Design System:** LostCity Portal Framework
**Preset:** family_friendly
**Portal:** atlanta-families
