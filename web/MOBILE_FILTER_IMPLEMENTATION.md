# Mobile-Optimized Filter Experience

Implementation of mobile-first filter patterns for all LostCity portals.

## Overview

Enhanced the existing `SimpleFilterBar` component with mobile-optimized patterns:
- Horizontal scrolling filter pills on mobile
- Bottom sheet for advanced filters
- Touch-friendly 44px minimum tap targets
- Portal theme integration

## Components

### 1. MobileFilterSheet.tsx
**Location:** `/web/components/MobileFilterSheet.tsx`

Bottom sheet component for advanced filters on mobile:
- Slide-up animation from bottom
- Backdrop with touch-to-close
- Organized filter sections (When, Categories, Price)
- Result count preview in footer
- Portal theme color support

**Features:**
- 85vh max height with scrollable content
- Escape key to close
- Backdrop click to close
- Sticky footer with actions
- Filter count badge on "More" button

### 2. SimpleFilterBar.tsx (Enhanced)
**Location:** `/web/components/SimpleFilterBar.tsx`

Updated to support both desktop and mobile views:

#### Desktop (>= 640px)
- Original dropdown-based filters
- Horizontal layout with all options visible
- View toggle on the right

#### Mobile (< 640px)
- Horizontal scrolling filter pills
- Key filters visible: "This Weekend", "Free", category quick-select, "More"
- View toggle centered at bottom
- Hidden scrollbar for clean appearance

**Key Mobile Features:**
- Minimum 44px touch targets
- Smooth horizontal scroll
- Smart category pills (shows active or popular)
- Filter count badge on "More" button
- Portal theme colors

## Usage

No changes required for existing implementations. The component automatically adapts to mobile:

```tsx
import SimpleFilterBar from "@/components/SimpleFilterBar";

export default function MyPage() {
  return (
    <>
      <SimpleFilterBar variant="full" />
      {/* Your content */}
    </>
  );
}
```

## Mobile UX Patterns

### Horizontal Scroll Pills
- Touch-friendly pill buttons (44px min height)
- Smooth horizontal scrolling
- Hidden scrollbar (scrollbar-hide utility)
- Adequate spacing between pills

### Bottom Sheet
- Slides up from bottom (300ms ease-out)
- Backdrop overlay (50% opacity)
- Drag handle at top
- Close button in header
- Organized filter sections
- Sticky footer with "Clear all" and "Apply" buttons

### Smart Defaults
- "This Weekend" pre-selected on appropriate days
- Shows active filters first
- Popular categories when no filters active

## Portal Theme Integration

All components respect portal branding:
- Primary color: `var(--coral)` for active filters
- Secondary color: `var(--gold)` for date filters
- Background: `var(--void)`, `var(--night)`, `var(--twilight)`
- Text: `var(--cream)`, `var(--muted)`
- Accent colors: `var(--neon-green)`, `var(--neon-cyan)`

## Accessibility

- Minimum 44px touch targets
- ARIA labels on icon-only buttons
- Escape key closes sheet
- Focus management
- Adequate color contrast
- Semantic HTML

## Performance

- Optimized with React.memo
- requestAnimationFrame for smooth animations
- Minimal re-renders with useCallback
- CSS transitions (hardware accelerated)

## Browser Support

- iOS Safari: Full support
- Chrome Android: Full support
- All modern mobile browsers

## Testing

### Mobile Testing Checklist
- [ ] Pills scroll smoothly on touch devices
- [ ] Bottom sheet animates smoothly
- [ ] All tap targets are 44px minimum
- [ ] Filters apply correctly
- [ ] View toggle works on mobile
- [ ] Portal theme colors apply correctly
- [ ] Sheet closes on backdrop tap
- [ ] Sheet closes on escape key
- [ ] Body scroll prevented when sheet open

### Desktop Testing Checklist
- [ ] Original dropdown behavior unchanged
- [ ] All filters work as before
- [ ] No mobile UI visible on desktop

## Future Enhancements

Potential improvements:
- Filter result count preview (real-time)
- Saved filter presets
- Recent filters history
- Swipe-to-dismiss on bottom sheet
- Filter suggestions based on portal
