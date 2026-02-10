# Design Tokens Quick Reference

## Typography

### Type Scale
```css
--text-2xs: 10px
--text-xs: 11px
--text-sm: 13px
--text-base: 15px
--text-lg: 18px
--text-xl: 20px
--text-2xl: 24px
--text-3xl: 30px
```

### Line Heights
```css
--leading-tight: 1.2      /* h1, h2 */
--leading-snug: 1.375     /* h3, h4, UI */
--leading-normal: 1.5     /* Cards, labels */
--leading-relaxed: 1.6    /* Body text (default) */
--leading-loose: 1.75     /* Long-form */
```

### Letter Spacing
```css
--tracking-tighter: -0.02em   /* Page titles */
--tracking-tight: -0.01em     /* Section headers */
--tracking-normal: 0          /* Body text */
--tracking-wide: 0.025em      /* UI labels */
--tracking-wider: 0.05em      /* Badges, small caps */
```

## Colors

### Surfaces (Dark Mode)
```css
--void: #09090B       /* Base background */
--night: #0F0F14      /* Card background */
--dusk: #18181F       /* Modal background */
--twilight: #252530   /* Borders */
```

### Text Colors
```css
--cream: #F5F5F3      /* Primary text (dimmed) */
--soft: #A1A1AA       /* Secondary text */
--muted: #8B8B94      /* Tertiary text */
```

### Semantic Text
```css
--text-primary: var(--cream)
--text-secondary: var(--soft)
--text-tertiary: var(--muted)
```

## Shadows

### Standard Shadows
```css
--shadow-sm: Subtle cards, small elements
--shadow-md: Default cards
--shadow-lg: Hover state, elevated cards
--shadow-xl: Modals, overlays
```

### Special Effects
```css
--shadow-glow-sm: 10px coral glow
--shadow-glow-md: 20px coral glow
--shadow-glow-lg: 30px coral glow
--inner-glow: Rim-light effect for cards
```

## Border Radius
```css
--radius-sm: 6px      /* Pills */
--radius-md: 8px      /* Buttons */
--radius-lg: 12px     /* Cards */
--radius-xl: 16px     /* Large cards */
--radius-2xl: 24px    /* Hero elements */
--radius-full: 9999px /* Circular */
```

## Borders
```css
--card-border: rgba(255, 255, 255, 0.06)
--card-border-hover: rgba(255, 255, 255, 0.1)
```

## Common Patterns

### Premium Card
```html
<div class="card-premium hover-lift">
  <h3 class="leading-snug tracking-tight">Card Title</h3>
  <p class="text-secondary leading-normal">Metadata</p>
  <p class="text-description">Long description with optimal measure...</p>
</div>
```

### Section Header
```html
<h2 class="section-header-primary">Events Near You</h2>
<p class="text-secondary">Discover what's happening tonight</p>
```

### Elevated Surface
```html
<div class="surface-elevated">
  <div class="surface-raised">
    <p class="text-primary">Layered depth</p>
  </div>
</div>
```

## Utility Classes

### Typography
- `.leading-tight`, `.leading-snug`, `.leading-normal`, `.leading-relaxed`, `.leading-loose`
- `.tracking-tighter`, `.tracking-tight`, `.tracking-normal`, `.tracking-wide`, `.tracking-wider`
- `.max-w-measure`, `.max-w-measure-narrow`, `.max-w-measure-wide`
- `.text-description` - Body text with optimal line-height and measure

### Colors
- `.text-primary`, `.text-secondary`, `.text-tertiary`
- `.text-primary-dimmed`, `.text-secondary-dimmed`
- `.surface-base`, `.surface-raised`, `.surface-elevated`

### Shadows
- `.shadow-card-sm`, `.shadow-card-md`, `.shadow-card-lg`, `.shadow-card-xl`
- `.shadow-glow-sm`, `.shadow-glow-md`, `.shadow-glow-lg`
- `.inner-glow`

### Effects
- `.hover-lift` - Lift on hover with shadow change
- `.card-premium` - Full premium card treatment
- `.border-subtle`, `.border-subtle-hover`

### Border Radius
- `.rounded-card` (12px), `.rounded-card-xl` (16px), `.rounded-pill` (9999px)

## Design Principles

1. **Line Length**: Cap prose at 65ch for optimal readability
2. **Line Height**: Body text at 1.6, headings at 1.2
3. **Letter Spacing**: Tighten headings (-0.02em), widen badges (+0.05em)
4. **Dark Mode**: Use subtle borders (rgba 0.06), not harsh solid colors
5. **Depth**: Three surface layers (void → night → dusk)
6. **Text Color**: Dimmed white (#F5F5F3) reduces eye strain vs pure white
7. **Shadows**: Multi-layer with inner glow for rim-light effect
8. **Transitions**: 0.2s ease for all interactive state changes

## Migration Guide

### Old → New

**Typography:**
```diff
- style="line-height: 1.5"
+ className="leading-normal"

- style="letter-spacing: -0.02em"
+ className="tracking-tighter"
```

**Colors:**
```diff
- className="text-white"
+ className="text-primary"

- className="text-gray-400"
+ className="text-secondary"
```

**Shadows:**
```diff
- className="shadow-lg"
+ className="shadow-card-lg"
```

**Borders:**
```diff
- className="border-gray-800"
+ className="border-subtle"
```

**Cards:**
```diff
- <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-md">
+ <div className="card-premium hover-lift">
```
