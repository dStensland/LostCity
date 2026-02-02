# Button Quick Reference Guide

## When to Use Each Button Type

### Primary `.btn-primary`
**Color:** Coral (`--coral` → `--rose` on hover)
**Use for:** Main call-to-action on a page
- ✅ "Sign In" / "Sign Up"
- ✅ "Submit Event"
- ✅ "Accept" friend request
- ✅ "RSVP" / "I'm in"
- ✅ "Clear filters" in empty state
- ❌ Cancel actions
- ❌ Multiple equal-priority actions on same screen

### Secondary `.btn-secondary`
**Color:** Gray with border (`--dusk` + `--twilight`)
**Use for:** Important but not primary actions
- ✅ "Cancel" / "Back"
- ✅ "Decline" friend request
- ✅ "Request Sent" (pending state)
- ✅ Alternative options in forms
- ❌ Main CTA
- ❌ Destructive actions

### Ghost `.btn-ghost`
**Color:** Transparent, gray text (`--muted`)
**Use for:** Subtle, low-priority actions
- ✅ Icon-only buttons (menu, settings)
- ✅ Tertiary actions in lists
- ✅ "See more" / "Learn more" links styled as buttons
- ❌ Main CTA
- ❌ Actions requiring immediate attention

### Accent `.btn-accent`
**Color:** Cyan glow (`--neon-cyan`)
**Use for:** Special social/positive actions
- ✅ "Add Friend"
- ✅ "Follow" / "Join"
- ✅ Social connection actions
- ❌ Generic CTAs
- ❌ Destructive actions

### Success `.btn-success`
**Color:** Green glow (`--neon-green`)
**Use for:** Confirmed/active states
- ✅ "Friends ✓" (already connected)
- ✅ "Following ✓"
- ✅ Active filter states
- ❌ Initial actions (use Accent instead)
- ❌ Error states

### Danger `.btn-danger`
**Color:** Red glow (`--neon-red`)
**Use for:** Destructive actions
- ✅ "Delete"
- ✅ "Unfriend" (on hover)
- ✅ "Remove"
- ❌ Primary navigation
- ❌ Success confirmations

---

## Size Selection

| Size | Use Case | Example |
|------|----------|---------|
| `.btn-sm` | Compact spaces, inline actions | Tag chips, inline "Edit" buttons |
| `.btn-md` | Default for most buttons | Form submits, navigation |
| `.btn-lg` | Hero sections, primary page CTAs | Landing page "Get Started" |

---

## Common Patterns

### Login/Signup Forms
```tsx
// Primary CTA
<button className="btn-primary btn-md w-full">Sign In</button>

// OAuth alternative
<button className="w-full px-4 py-3 rounded-xl bg-[var(--cream)] text-[var(--void)]
                   hover:bg-[var(--soft)] active:scale-[0.98] shadow-sm hover:shadow-md">
  Continue with Google
</button>
```

### Friend Actions
```tsx
// Not friends yet
<button className="btn-accent btn-pill btn-md">Add Friend</button>

// Request pending
<button className="btn-secondary btn-pill btn-md">Request Sent</button>

// Already friends
<button className="btn-success btn-pill btn-md">Friends ✓</button>

// Accept/Decline
<button className="btn-primary btn-pill btn-md">Accept</button>
<button className="btn-secondary btn-pill btn-md">Decline</button>
```

### RSVP Buttons
```tsx
// Not RSVPed
<button className="btn-base btn-secondary rounded-xl">Show Interest</button>

// Going
<button className="btn-base rounded-xl bg-[var(--coral)] text-[var(--void)]">I'm in ✓</button>

// Interested
<button className="btn-base rounded-xl bg-[var(--gold)] text-[var(--void)]">Maybe ★</button>
```

### Filter Buttons
```tsx
// Category chips - pill shape
<button className="btn-secondary btn-pill btn-sm">Music</button>

// Toggle buttons - rectangular
<button className="btn-secondary btn-sm rounded-xl">Open Now</button>

// Active filter
<button className="bg-[var(--coral)] text-[var(--void)] btn-pill btn-sm">Music ✓</button>
```

### Icon Buttons
```tsx
import { IconButton } from "@/components/ui/Button";

<IconButton variant="ghost" size="md" label="Settings">
  <svg>...</svg>
</IconButton>
```

---

## Modifiers

### Full Width
Add `w-full` for full-width buttons (common in mobile layouts)
```tsx
<button className="btn-primary btn-md w-full">Submit</button>
```

### Pill Shape
Add `.btn-pill` for fully rounded buttons
```tsx
<button className="btn-accent btn-pill btn-md">Add Friend</button>
```

### Loading State
Use `isLoading` prop on Button component
```tsx
<Button variant="primary" isLoading={true}>Submitting...</Button>
```

### Disabled
Use `disabled` attribute (styling handled automatically)
```tsx
<button className="btn-primary btn-md" disabled>Unavailable</button>
```

---

## Don'ts

❌ **Don't mix border radius values**
```tsx
// Bad
<button className="rounded-lg">...</button>
<button className="rounded-full">...</button>

// Good - consistent rounded-xl
<button className="btn-primary rounded-xl">...</button>
<button className="btn-accent btn-pill">...</button> // pill is intentional
```

❌ **Don't use multiple primary buttons on same screen**
```tsx
// Bad - competing CTAs
<button className="btn-primary">Save Draft</button>
<button className="btn-primary">Publish Now</button>

// Good - clear hierarchy
<button className="btn-secondary">Save Draft</button>
<button className="btn-primary">Publish Now</button>
```

❌ **Don't forget active/hover states**
```tsx
// Bad
<button className="bg-[var(--coral)] text-[var(--void)] px-4 py-2">Click me</button>

// Good
<button className="btn-primary btn-md">Click me</button>
```

❌ **Don't use coral/amber arbitrarily**
```tsx
// Bad - inconsistent accent colors
<button className="bg-[var(--neon-amber)]">Action 1</button>
<button className="bg-[var(--coral)]">Action 2</button>

// Good - use semantic classes
<button className="btn-primary">Primary Action</button>
<button className="btn-accent">Special Action</button>
```

---

## Accessibility Checklist

- ✅ Minimum 44px touch target on mobile
- ✅ Clear focus rings for keyboard navigation
- ✅ Sufficient color contrast (WCAG AA)
- ✅ `aria-label` for icon-only buttons
- ✅ `disabled` state clearly visible
- ✅ Loading state announced to screen readers

---

## Quick Decision Tree

```
Is this the main action on the page?
├─ YES → .btn-primary
└─ NO
   ├─ Is it destructive (delete, remove)?
   │  └─ YES → .btn-danger
   ├─ Is it a social action (friend, follow)?
   │  └─ YES → .btn-accent
   ├─ Is it a confirmed state?
   │  └─ YES → .btn-success
   ├─ Is it important but supporting?
   │  └─ YES → .btn-secondary
   └─ Is it subtle/low-priority?
      └─ YES → .btn-ghost
```

---

## File Locations

- **Button System:** `/app/globals.css` (lines 800-865)
- **Button Component:** `/components/ui/Button.tsx`
- **Examples:** See BUTTON_SYSTEM_FIX.md

---

**Need help?** Refer to `BUTTON_SYSTEM_FIX.md` for detailed documentation and examples.
