# Design System Examples

This directory contains example components demonstrating how to use the LostCity hybrid portal design system.

## Available Examples

### DesignTokenExample.tsx

Demonstrates the three-layer design token system:
- Brand colors (primary, secondary, accent)
- Action buttons (primary, secondary)
- Cards with hover states
- Badges (standard, accent)
- Surface layers (base, raised, elevated)
- Typography (primary, secondary, muted text)
- Links with hover states

## Usage

### In a Portal Page

```tsx
import { DesignTokenExample } from "@/components/examples/DesignTokenExample";

export default function ExamplesPage() {
  return <DesignTokenExample />;
}
```

### In Development

Visit `/[portal]` and temporarily add the component to test different portal themes:

```tsx
// In app/[portal]/page.tsx (for testing only)
import { DesignTokenExample } from "@/components/examples/DesignTokenExample";

// Add to render:
<DesignTokenExample />
```

## Design Token Usage Patterns

### Using Token Constants

```tsx
import { DESIGN_TOKENS } from "@/lib/design-tokens";

<button style={{ backgroundColor: DESIGN_TOKENS.button.primaryBg }}>
  Click me
</button>
```

### Using Helper Functions

```tsx
import { token, cssVar } from "@/lib/design-tokens";

// In Tailwind classes
<div className={token("bg", "surface-raised")} />

// In inline styles
<div style={{ color: cssVar("text-primary") }} />
```

### Direct CSS Variables

```tsx
// Most flexible - works with Tailwind arbitrary values
<div className="bg-[var(--brand-primary)] text-[var(--text-primary)]" />
```

## Best Practices

1. **Prefer semantic tokens over primitives**
   - Use `--brand-primary` instead of `--primitive-primary-500`
   - Use `--text-primary` instead of `--cream`

2. **Use component tokens for specific UI elements**
   - Use `--btn-primary-bg` for button backgrounds
   - Use `--card-border` for card borders
   - Use `--nav-tab-active` for active nav items

3. **Maintain backwards compatibility**
   - Legacy tokens (`--coral`, `--neon-cyan`) still work
   - No need to update existing components immediately

4. **Test with different portal themes**
   - Tokens adapt to portal branding automatically
   - Test in both dark and light modes

## Adding New Examples

When adding new example components:

1. Create a new file in this directory
2. Use `memo` for performance
3. Export named exports (no default exports)
4. Add TypeScript types
5. Document usage in this README

Example template:

```tsx
"use client";

import { memo } from "react";

interface MyExampleProps {
  // Props here
}

export const MyExample = memo(function MyExample({ }: MyExampleProps) {
  return (
    <div>
      {/* Example content */}
    </div>
  );
});

export type { MyExampleProps };
```
