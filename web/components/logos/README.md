# Atlanta Families Portal Logos

Four SVG-based logo concepts for the Atlanta Families portal, each with optional animations and full accessibility support.

## Components

### 1. FamilyCompassLogo
A circular mark with 8 radial divisions (compass points), featuring an inner "A" that doubles as a tent/house/roof shape.

**Design Details:**
- Outer ring with 8 compass divisions
- Inner abstract "A" shape (tent/house/roof)
- Cardinal points marked with amber dots
- Colors: Green primary (#059669), amber dots (#f59e0b)

**Animations:**
- Slow 20s rotation on outer ring
- Sequential pulsing of cardinal point dots

**Symbolism:** Exploration, guidance, finding your way

```tsx
import { FamilyCompassLogo } from "@/components/logos";

<FamilyCompassLogo size={64} animated={true} />
```

### 2. BloomingATLLogo
An AF monogram where the "A" is formed by leaf/petal shapes and the "F" crossbar becomes a curved branch.

**Design Details:**
- "A" formed by 3 leaf/petal shapes meeting at a point
- "F" crossbar as curved branch with 2-3 buds
- Gradient: green (#059669) to teal (#0891b2) for leaves
- Gradient: yellow (#eab308) to amber (#f59e0b) for branch

**Animations:**
- Gentle leaf sway (3s cycle)
- Buds bloom on hover

**Symbolism:** Growth, nurturing, family tree

```tsx
import { BloomingATLLogo } from "@/components/logos";

<BloomingATLLogo size={64} animated={true} />
```

### 3. NeighborhoodStackLogo
3-4 rounded rectangles stacked in offset arrangement, like colorful row houses.

**Design Details:**
- 4 blocks: green (#059669), blue (#0891b2), amber (#f59e0b), coral (#f97316)
- Rounded rectangles (rx="7")
- Playful, building-block aesthetic

**Animations:**
- Gentle sliding and restacking (3s cycles)
- Smooth transitions between 3 states

**Symbolism:** Community, diversity, neighborhoods coming together

```tsx
import { NeighborhoodStackLogo } from "@/components/logos";

<NeighborhoodStackLogo size={64} animated={true} />
```

### 4. FamilyConstellationLogo
5 connected dots forming a constellation shape representing a family unit.

**Design Details:**
- 2 larger dots (parents) + 3 smaller dots (kids)
- Connected by thin gradient lines
- Gradient dots: green (#059669) to blue (#0891b2)

**Animations:**
- Lines draw in on load (150ms delay between each)
- Dots pulse gently with SVG animation
- Dots grow slightly during pulse

**Symbolism:** Connection, togetherness, constellation of care

```tsx
import { FamilyConstellationLogo } from "@/components/logos";

<FamilyConstellationLogo size={64} animated={true} />
```

## PortalLogo Component

Dynamic component that selects the appropriate logo based on configuration.

```tsx
import { PortalLogo } from "@/components/logos";

<PortalLogo
  variant="compass" // "compass" | "blooming" | "stack" | "constellation"
  size={48}
  animated={true}
  className="hover:scale-110 transition-transform"
/>
```

## Common Props

All logo components accept these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `64` | Width and height in pixels |
| `animated` | `boolean` | `true` | Enable animations |
| `className` | `string` | `""` | Additional CSS classes |

## Accessibility

- All logos include `role="img"` and `aria-label` attributes
- Animations respect `prefers-reduced-motion: reduce`
- SVG-based for crisp scaling at any size
- Semantic color choices with sufficient contrast

## Animation Behavior

Animations automatically disable when:
1. `animated={false}` is explicitly set
2. User has `prefers-reduced-motion: reduce` in their OS settings
3. Component is server-rendered (SSR safe)

## Usage in Portal Header

```tsx
import { PortalLogo } from "@/components/logos";
import { usePortal } from "@/lib/portal-context";

export function PortalHeader() {
  const portal = usePortal();

  // Get logo variant from portal config (future)
  const logoVariant = portal?.logo_variant ?? "compass";

  return (
    <header>
      <PortalLogo
        variant={logoVariant}
        size={48}
        animated={true}
      />
    </header>
  );
}
```

## Demo Page

View all logos with interactive examples at `/demos/logos`

## File Structure

```
web/components/logos/
├── FamilyCompassLogo.tsx
├── BloomingATLLogo.tsx
├── NeighborhoodStackLogo.tsx
├── FamilyConstellationLogo.tsx
├── PortalLogo.tsx
├── index.ts
└── README.md
```

## Performance

- Pure SVG with no external dependencies
- Memoized components prevent unnecessary re-renders
- Animations use CSS/SVG (GPU-accelerated)
- Small bundle size (~3KB total for all 4 logos)

## Future Enhancements

- [ ] Add logo variant to portal configuration schema
- [ ] Support custom color schemes per portal
- [ ] Add downloadable PNG/SVG versions for marketing
- [ ] Create favicon variants
- [ ] Add social media preview variants
