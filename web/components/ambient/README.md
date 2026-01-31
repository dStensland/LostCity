# Ambient Background Effects

Ambient background effects provide subtle, animated visual interest without distracting from content. All effects are GPU-accelerated, CSS-only animations that respect `prefers-reduced-motion`.

## Available Effects

### Core Effects

#### `none`
No ambient effect.

#### `subtle_glow`
Category-based colored glows that subtly pulse. Default effect for most portals.

#### `gradient_wave`
Animated gradient waves that flow across the background. Great for community and family-friendly portals.

#### `particle_field`
Floating particles with glow effects. Perfect for nightlife and modern portals.

#### `aurora`
Northern lights effect with flowing gradients. High-energy, premium feel.

#### `mesh_gradient`
Animated mesh gradients with organic movement. Modern and sophisticated.

#### `noise_texture`
Subtle animated noise pattern. Minimal but adds texture.

### Morphing City Effects (New)

Inspired by Atlanta's evolving urban landscape, these effects represent the dynamic nature of a living city.

#### `shifting_neighborhood`
Abstract cityscape with geometric building shapes that slide and rearrange horizontally.
- 15-20 simple rectangular/triangular SVG shapes
- Staggered horizontal translations at different speeds (20-60s cycles)
- Soft pastel colors (yellows, greens, blues)
- Low opacity (0.03-0.08)
- **Best for:** Urban/city portals, neighborhood guides, real estate

#### `constellation`
Dots connected by lines that fade in/out, resembling a map of venue locations.
- 30-40 fixed-position dots (like venue locations)
- SVG lines connecting nearby dots
- Lines fade in/out on 10-20s cycles
- Dots gently pulse
- Warm amber dots, soft green lines
- **Best for:** Event discovery, venue guides, community networks

#### `flowing_streets`
Organic flowing lines like Atlanta's winding streets (Peachtree, Ponce de Leon).
- 5-7 SVG path elements with bezier curves
- Gentle wave animations (40-80s cycles)
- Gradient strokes (yellow → green → blue)
- Multiple layers at different speeds for parallax effect
- **Best for:** Transportation, maps, exploration-focused portals

#### `growing_garden`
Botanical shapes that grow, bloom, and fade in continuous cycles.
- 12-15 elements (circles, organic blobs, leaf shapes, petals)
- Each cycles: emerge (3s) → bloom (50s) → fade (5s)
- Staggered start times for continuous motion
- Colors: greens, soft yellows, warm corals
- Scale animations with slight rotation
- **Best for:** Parks, gardens, family events, wellness, sustainability

## Configuration

All effects accept the following configuration via `AmbientConfig`:

```typescript
interface AmbientConfig {
  effect: AmbientEffect;
  intensity?: "subtle" | "medium" | "bold";
  colors?: {
    primary?: string;
    secondary?: string;
  };
  particle_count?: number;        // For particle_field only
  animation_speed?: "slow" | "medium" | "fast";
}
```

### Intensity Levels

- **subtle**: Low opacity, minimal visual impact (0.03-0.15 opacity)
- **medium**: Balanced visibility (0.12-0.25 opacity) - DEFAULT
- **bold**: High visibility, more dramatic (0.25-0.35 opacity)

### Animation Speed

- **slow**: 1.5-2x slower than default (more relaxed)
- **medium**: Normal speed - DEFAULT
- **fast**: 0.5-0.6x faster (more energetic)

## Usage

### Via Portal Branding

```typescript
const portal = {
  branding: {
    ambient: {
      effect: "constellation",
      intensity: "subtle",
      animation_speed: "slow",
      colors: {
        primary: "#FFA959",
        secondary: "#A8D8B9"
      }
    }
  }
};
```

### Direct Component Usage

```tsx
import { ConstellationAmbient } from "@/components/ambient";

<ConstellationAmbient
  config={{
    intensity: "medium",
    animation_speed: "slow",
    colors: {
      primary: "#FFA959",
      secondary: "#A8D8B9"
    }
  }}
/>
```

## Performance Notes

- All animations use CSS transforms (GPU-accelerated)
- No JavaScript animation loops (requestAnimationFrame, setInterval)
- Deterministic randomness using seeded PRNG (consistent across renders)
- Respects `prefers-reduced-motion` media query
- Fixed position with `pointer-events: none` (doesn't block interactions)
- z-index: 0 (behind all content)

## Accessibility

All ambient effects:
- Include `aria-hidden="true"` (decorative only)
- Respect `prefers-reduced-motion: reduce`
- Use low opacity to avoid visual distraction
- Don't convey information (purely decorative)
- Don't block pointer events

## Design Guidelines

### When to use each effect:

**Minimal/Professional:**
- none, subtle_glow, noise_texture

**Community/Family:**
- gradient_wave, growing_garden, constellation

**Nightlife/Events:**
- particle_field, aurora, shifting_neighborhood

**Urban/City:**
- shifting_neighborhood, constellation, flowing_streets

**Nature/Parks:**
- growing_garden, flowing_streets (with green colors)

**Modern/Tech:**
- mesh_gradient, particle_field, constellation

## Color Recommendations

### Default Colors by Effect

| Effect | Primary | Secondary | Tertiary |
|--------|---------|-----------|----------|
| shifting_neighborhood | #FFF4B8 (yellow) | #D4F5E4 (green) | #D4E4F7 (blue) |
| constellation | #FFA959 (amber) | #A8D8B9 (green) | - |
| flowing_streets | #FFF4B8 (yellow) | #A8D8B9 (green) | #A8C4F7 (blue) |
| growing_garden | #A8D8B9 (green) | #FFF4B8 (yellow) | #FFD4C4 (coral) |

### Thematic Color Palettes

**Warm/Welcoming:**
- Primary: #FFA959, Secondary: #FFD4C4

**Cool/Calm:**
- Primary: #A8C4F7, Secondary: #D4F5E4

**Natural/Organic:**
- Primary: #A8D8B9, Secondary: #E8F5D4

**Energy/Urban:**
- Primary: #FFF4B8, Secondary: #D4E4F7
