# Design System Elevation - February 2026

This document outlines the magazine-quality design refinements applied to the LostCity web application.

## Overview

The design system has been elevated with editorial typography, sophisticated dark mode layering, and premium card treatments. All changes maintain backward compatibility while introducing new semantic tokens for future development.

## 1. Editorial Typography System

### Type Scale (1.25 ratio)
Established a harmonious type scale following magazine-quality standards:

```css
--text-2xs: 0.625rem;   /* 10px - micro labels */
--text-xs: 0.6875rem;   /* 11px - badges, mono labels */
--text-sm: 0.8125rem;   /* 13px - metadata, details */
--text-base: 0.9375rem; /* 15px - body text */
--text-lg: 1.125rem;    /* 18px - card titles */
--text-xl: 1.25rem;     /* 20px - section headers secondary */
--text-2xl: 1.5rem;     /* 24px - section headers primary */
--text-3xl: 1.875rem;   /* 30px - page titles */
```

### Line Height System
Optimized for readability across different content types:

- `--leading-tight: 1.2` - Headings (tight vertical rhythm)
- `--leading-snug: 1.375` - Subheadings, UI elements
- `--leading-normal: 1.5` - Card content, labels
- `--leading-relaxed: 1.6` - Body text, descriptions (default for `<body>`)
- `--leading-loose: 1.75` - Long-form content

### Letter Spacing System
Refined tracking for visual clarity:

- `--tracking-tighter: -0.02em` - Large headings
- `--tracking-tight: -0.01em` - Medium headings
- `--tracking-normal: 0` - Body text
- `--tracking-wide: 0.025em` - UI labels
- `--tracking-wider: 0.05em` - Small caps, badges

### Text Measure
Optimal line length for readability:

- `--text-measure: 65ch` - Standard prose (optimal)
- `--text-measure-narrow: 45ch` - Short-form content
- `--text-measure-wide: 80ch` - Wide layouts

### Utility Classes

```css
/* Line heights */
.leading-tight, .leading-snug, .leading-normal, .leading-relaxed, .leading-loose

/* Letter spacing */
.tracking-tighter, .tracking-tight, .tracking-normal, .tracking-wide, .tracking-wider

/* Text measure */
.max-w-measure, .max-w-measure-narrow, .max-w-measure-wide

/* Semantic heading classes */
h1, .h1 - 30px, tight, tighter, weight 600
h2, .h2 - 24px, tight, tight, weight 600
h3, .h3 - 20px, snug, tight, weight 600
h4, .h4 - 18px, snug, normal, weight 600

/* Description text */
.text-description - Relaxed line-height with optimal measure
```

## 2. Dark Mode Sophistication

### Refined Color Palette
Enhanced color definitions with semantic clarity:

```css
--void: #09090B;    /* Deepest background */
--night: #0F0F14;   /* Raised surface (cards) */
--dusk: #18181F;    /* Elevated surface (modals, popovers) */
--twilight: #252530; /* Borders, dividers */
--muted: #8B8B94;   /* WCAG AA - tertiary text */
--soft: #A1A1AA;    /* Secondary text */
--cream: #F5F5F3;   /* Primary text - dimmed from pure white for eye strain reduction */
```

### Text Hierarchy
Clear semantic naming for text colors:

```css
--text-primary: var(--cream);   /* F5F5F3 - main headings, key info */
--text-secondary: var(--soft);  /* A1A1AA - subheadings, labels */
--text-tertiary: var(--muted);  /* 8B8B94 - metadata, timestamps */
```

Utility classes:
```css
.text-primary, .text-secondary, .text-tertiary
.text-primary-dimmed, .text-secondary-dimmed
```

### Surface Layers
Three-layer depth system for dark mode:

```css
/* Base surface - deepest background */
.surface-base { background-color: var(--void); }

/* Raised surface - cards with inner glow */
.surface-raised {
  background-color: var(--night);
  box-shadow: var(--inner-glow);
}

/* Elevated surface - modals, popovers */
.surface-elevated {
  background-color: var(--dusk);
  box-shadow: var(--shadow-md);
}
```

### Subtle Borders
Replaced harsh borders with subtle opacity-based borders:

```css
--card-border: rgba(255, 255, 255, 0.06);
--card-border-hover: rgba(255, 255, 255, 0.1);

.border-subtle { border-color: rgba(255, 255, 255, 0.06); }
.border-subtle-hover { border-color: rgba(255, 255, 255, 0.1); }
```

## 3. Premium Shadow System

### Multi-Layer Shadows
Sophisticated shadows with inner rim-light for depth:

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.5),
             inset 0 1px 0 rgba(255, 255, 255, 0.03);

--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.6),
             0 2px 4px -2px rgba(0, 0, 0, 0.4),
             inset 0 1px 0 rgba(255, 255, 255, 0.04);

--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.7),
             0 4px 6px -4px rgba(0, 0, 0, 0.5),
             inset 0 1px 0 rgba(255, 255, 255, 0.05);

--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.8),
             0 8px 10px -6px rgba(0, 0, 0, 0.6),
             inset 0 1px 0 rgba(255, 255, 255, 0.06);
```

### Glow Effects
Accent-based glow shadows:

```css
--shadow-glow-sm: 0 0 10px rgba(255, 107, 122, 0.15);
--shadow-glow-md: 0 0 20px rgba(255, 107, 122, 0.25);
--shadow-glow-lg: 0 0 30px rgba(255, 107, 122, 0.35);
```

### Inner Glow (Rim-Light Effect)
Subtle rim-light for cards in dark mode:

```css
--inner-glow: inset 0 1px 1px rgba(255, 255, 255, 0.05),
              inset 0 -1px 1px rgba(0, 0, 0, 0.1);
```

### Utility Classes

```css
.shadow-card-sm, .shadow-card-md, .shadow-card-lg, .shadow-card-xl
.shadow-glow-sm, .shadow-glow-md, .shadow-glow-lg
.inner-glow
```

## 4. Card Design Elevation

### Premium Card Component

```css
.card-premium {
  background-color: var(--night);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}

.card-premium:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}
```

### Hover Lift Effect

```css
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.hover-lift:active {
  transform: translateY(0);
}
```

### Updated Card Background Tokens

```css
--card-bg: var(--surface-raised);
--card-bg-hover: var(--dusk);
--card-border: rgba(255, 255, 255, 0.06);
--card-border-hover: rgba(255, 255, 255, 0.1);
```

## 5. Border Radius System

Consistent corner treatments:

```css
--radius-sm: 6px;      /* Small elements, pills */
--radius-md: 8px;      /* Buttons, inputs */
--radius-lg: 12px;     /* Cards, panels */
--radius-xl: 16px;     /* Large cards, modals */
--radius-2xl: 24px;    /* Hero elements */
--radius-full: 9999px; /* Circular elements */
```

Utility classes:
```css
.rounded-card      /* 12px */
.rounded-card-xl   /* 16px */
.rounded-pill      /* 9999px */
```

## 6. Section Header Refinements

Updated section headers to use new typography system:

```css
.section-header-primary {
  font-family: var(--font-outfit), system-ui, sans-serif;
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tighter);
  color: var(--cream);
}

.section-header-secondary {
  font-family: var(--font-outfit), system-ui, sans-serif;
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
  color: var(--cream);
}

.section-header-tertiary {
  font-family: var(--font-mono), monospace;
  font-size: var(--text-base);
  font-weight: 500;
  line-height: var(--leading-normal);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--soft);
}
```

## Implementation Notes

### Backward Compatibility
All existing CSS custom properties remain functional. New tokens are additive, not breaking changes.

### Usage Guidelines

1. **Typography**: Use semantic line-height tokens (`leading-*`) instead of arbitrary values
2. **Text Colors**: Prefer `text-primary`, `text-secondary`, `text-tertiary` over direct color references
3. **Shadows**: Use the new shadow scale (`shadow-card-md`, etc.) for consistency
4. **Cards**: Apply `.card-premium` class for elevated card treatments
5. **Borders**: Use `.border-subtle` for refined borders instead of `border-gray-*`

### Testing
Open `design-system-test.html` in a browser to see visual demonstrations of:
- Typography hierarchy
- Shadow comparisons
- Surface layering
- Card hover effects
- Border subtlety

## Visual Impact

### Before
- Type: Default line-heights, no systematic letter-spacing
- Dark Mode: Harsh borders, limited depth hierarchy
- Cards: Flat appearance with basic shadows
- Text: Pure white (#FAFAF9) on dark, high contrast

### After
- Type: Editorial line-heights (1.6 for body), refined tracking
- Dark Mode: Subtle borders (rgba), three-layer surface system
- Cards: Multi-layer shadows with inner glow, hover lift
- Text: Slightly dimmed (#F5F5F3) for reduced eye strain

## Files Modified

- `/web/app/globals.css` - All design system enhancements

## Files Created

- `/web/design-system-test.html` - Visual demonstration page
- `/web/DESIGN_SYSTEM_ELEVATION.md` - This documentation

---

**Design Philosophy**: Every refinement serves readability, reduces eye strain, and creates premium visual depth without sacrificing the underground, neon-lit aesthetic that defines LostCity's brand.
