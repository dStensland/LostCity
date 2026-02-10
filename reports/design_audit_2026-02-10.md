# Design & UX Audit — Post Phase A-M
**Date:** February 10, 2026  
**Reviewer:** Product Designer Agent  
**Scope:** Onboarding flow, Settings/Preferences, Hotel Concierge, Admin Portal Wizard, New Components (TagVoteChip, NeedsTagList)

---

## Executive Summary

The recent Phase A-M features represent significant UX progress, with strong visual consistency across most touch points. The onboarding flow is clean and well-paced, the hotel concierge theme is elegantly executed, and the admin portal wizard follows a logical progression. However, there are notable design inconsistencies, missing interactive states, and accessibility concerns that should be addressed before broader rollout.

**Overall Grade:** B+ (Good foundation with room for polish)

---

## Strengths

- **Visual Cohesion:** The dark underground aesthetic is consistently applied across all new features
- **Design Token System:** Three-layer token architecture (primitives → semantic → component) is well-structured
- **Hotel Theme Excellence:** The hotel concierge visual preset is elegant and sophisticated — a clear departure from the dark brand that works beautifully for its intended audience
- **Onboarding Pacing:** Two-step flow feels right — not too short, not overwhelming
- **Genre System:** The new genre picker adds valuable personalization depth without adding cognitive load
- **Admin Wizard:** Step progression is clear and validates properly

---

## Critical Issues

### 1. Inconsistent Pill/Chip Patterns Across Features

**Severity:** Major  
**Location:** Multiple components  

**Problem:**
We have three distinct pill/chip patterns that look similar but behave differently:

1. **Onboarding CategoryPicker** (line 47-51):
   - Border: 2px
   - Selected: `border-[var(--coral)] bg-[var(--coral)]/10`
   - Unselected: `border-[var(--twilight)] bg-[var(--dusk)]/50`
   - Uses cards with emoji + label + checkmark

2. **Onboarding GenrePicker** (line 139-143):
   - Border: 2px
   - Selected: `border-[var(--coral)] bg-[var(--coral)]/10`
   - Unselected: `border-[var(--twilight)]`
   - Pill shape, no icons

3. **PreferencesClient Categories** (line 282-286):
   - No border on selected state (`border border-transparent`)
   - Selected: `bg-accent text-[var(--void)]` (solid fill)
   - Unselected: `border border-[var(--twilight)]`
   - Uses category icons

4. **PreferencesClient Genres** (line 363-367):
   - Border: 2px
   - Selected: `border-2 border-[var(--coral)] bg-[var(--coral)]/10`
   - Unselected: `border-2 border-[var(--twilight)]`
   - Matches onboarding genre style

5. **TagVoteChip** (line 108-118):
   - Border: 2px
   - Confirmed: `border-2 border-green-500` (hard-coded green, not design token)
   - Unconfirmed: `border-2 border-transparent` then `hover:border-gray-300`
   - Uses Tailwind colors, not CSS variables

**Design Rationale:**
Users should be able to learn one interaction pattern and apply it everywhere. When the same "select from a list" interaction looks different on different pages, it creates cognitive friction and makes the platform feel inconsistent.

**Recommendation:**
1. Define a single "selection pill" component pattern in the design system
2. Use CSS variables for all colors (no hard-coded Tailwind colors)
3. Selected state should always be: `border-2 border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--cream)]`
4. Unselected state: `border-2 border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/50`
5. Extract to shared component: `<SelectionPill>`

---

### 2. Accessibility: Color Contrast Issues in TagVoteChip

**Severity:** Critical (WCAG AA failure)  
**Location:** `web/components/TagVoteChip.tsx` (line 113-114)

**Problem:**
```tsx
className={`
  ${
    isConfirmed
      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
  }
```

- Hard-coded Tailwind colors don't respect the LostCity design system
- No guarantee these meet WCAG AA contrast ratios
- Should use CSS variables for theming consistency

**Recommendation:**
Replace with design token-based approach:
```tsx
className={`
  ${
    isConfirmed
      ? "bg-[var(--neon-green)]/10 text-[var(--neon-green)] border-[var(--neon-green)]"
      : "bg-[var(--twilight)] text-[var(--soft)] border-[var(--twilight)] hover:border-[var(--neon-green)]/50"
  }
```

Run contrast checks on all color combinations before shipping.

---

### 3. Needs Section Uses Different Accent Color

**Severity:** Minor  
**Location:** `web/app/settings/preferences/PreferencesClient.tsx` (line 518-519)

**Problem:**
The "Anything We Should Know?" (needs) section uses `--neon-cyan` for its accent icon and active states, while all other sections use category-specific or vibe-specific colors. This is inconsistent and feels arbitrary.

**Visual Evidence:**
- Categories section: coral accent
- Genres section: coral accent  
- Neighborhoods section: gold accent
- Vibes section: lavender accent
- Price section: neon-green accent
- **Needs section: neon-cyan accent** ← Why?

**Recommendation:**
Either:
1. Use a consistent "preferences" accent color across all sections (probably coral), OR
2. Pick a semantic color for needs that makes sense (e.g., `--neon-green` for accessibility = "go/safe")

Currently cyan doesn't have a clear semantic meaning for accessibility/dietary/family needs.

---

### 4. Missing Loading States in PreferencesClient

**Severity:** Major  
**Location:** `web/app/settings/preferences/PreferencesClient.tsx`

**Problem:**
The genres section has loading skeletons (line 325-341), but the main categories/vibes/neighborhoods sections have no loading state. If the page takes time to hydrate or fetch initial data, users see a flash of empty content.

**Recommendation:**
Add skeleton loaders for all sections, not just genres.

---

### 5. Hotel QR Code Missing Dark Mode Styles

**Severity:** Minor (but impacts hotel UX)  
**Location:** `web/app/[portal]/_components/hotel/HotelQRCode.tsx` (line 28)

**Problem:**
The QR code container uses hotel theme variables:
```tsx
className="flex flex-col items-center justify-center p-8 bg-[var(--hotel-cream)] rounded-xl border border-[var(--hotel-sand)]"
```

But these CSS variables are only defined in the hotel preset. If the QR code is used in a different context (e.g., admin portal, or a different portal that hasn't loaded the hotel theme), it will have no background color.

**Recommendation:**
Add fallback values:
```tsx
bg-[var(--hotel-cream,_var(--cream))]
border-[var(--hotel-sand,_var(--twilight))]
```

---

### 6. Admin Wizard: No Mobile Responsiveness Testing

**Severity:** Major  
**Location:** `web/app/admin/portals/create/page.tsx` (line 130-177)

**Problem:**
The step progress indicator has responsive classes (`hidden sm:block` on line 156), but the overall layout hasn't been tested on mobile. Admin tools are often used on desktop, but product managers and event organizers increasingly work from phones.

The horizontal step progression breaks down on narrow screens. Labels like "Identity", "Audience", "Branding" get cramped.

**Recommendation:**
- Test the wizard on iPhone SE (375px width)
- Consider vertical step progression on mobile
- Ensure all form inputs have proper touch targets (min 44x44px)

---

### 7. Onboarding: No Error State Handling

**Severity:** Major  
**Location:** `web/app/onboarding/page.tsx`, `web/app/onboarding/steps/GenrePicker.tsx`

**Problem:**
If the `/api/onboarding/complete` request fails (line 94-104), the error is silently logged to console and the user is redirected anyway. Same issue in GenrePicker (line 32-42) — if genres fail to fetch, the skeleton stays forever.

**Recommendation:**
- Show error toast/banner when onboarding save fails
- Allow user to retry or skip
- For genre fetch failure, show a "Try again" button instead of infinite skeleton

---

## Design Consistency Issues

### 8. Button Style Variance

**Locations:**
- Onboarding Continue button (CategoryPicker:95-99)
- Preferences Save button (PreferencesClient:624-642)
- Admin Wizard Next button (IdentityStep:242-247)

**Problem:**
All three use slightly different disabled state styling:
1. Onboarding: `bg-[var(--twilight)] text-[var(--muted)] cursor-not-allowed`
2. Preferences: `disabled:opacity-50`
3. Admin: `disabled:opacity-50 disabled:cursor-not-allowed`

The first is more visually distinct (good), but the third is more complete (includes cursor).

**Recommendation:**
Standardize on: `disabled:bg-[var(--twilight)] disabled:text-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed`

---

### 9. Spacing Inconsistency in Section Headers

**Location:** `web/app/settings/preferences/PreferencesClient.tsx`

**Problem:**
Section headers use different spacing patterns:
- Categories section (line 253-273): `mb-4` for header
- Genres section (line 304-323): `mb-4` for header
- Needs section (line 514-534): `mb-4` for header

This is actually consistent! But within the header itself:
- Icon wrapper: `w-6 h-6` (consistent)
- Gap between icon and text: `gap-2` (consistent)

Good work here. No issue found on closer inspection.

---

### 10. Hotel Header Has Non-functional Search Button

**Severity:** Minor (but confusing)  
**Location:** `web/app/[portal]/_components/hotel/HotelHeader.tsx` (line 72-80)

**Problem:**
The search icon button has an `aria-label` but no `onClick` handler. It does nothing. This violates the principle of "don't include UI that doesn't work."

**Recommendation:**
Either:
1. Wire it up to open search overlay, OR
2. Remove it until search is ready, OR
3. Add a "Coming soon" tooltip

---

## Missing Features / Gaps

### 11. No Undo/Cancel Flow in Preferences

**Location:** `web/app/settings/preferences/PreferencesClient.tsx`

**Problem:**
User makes changes to preferences, then clicks "Cancel" (line 618-622). This navigates back, but doesn't warn about unsaved changes. If the user spent 5 minutes selecting genres, losing that work feels bad.

**Recommendation:**
Track dirty state and show confirmation dialog if user tries to cancel with unsaved changes.

---

### 12. No Visual Feedback on Vote in TagVoteChip

**Location:** `web/components/TagVoteChip.tsx`

**Problem:**
When user clicks to vote, the button shows `cursor-wait` (line 116), but there's no visual indication that the vote was recorded. The count updates, but the transition is instant and easy to miss.

**Recommendation:**
Add a brief scale animation or checkmark animation when vote succeeds:
```tsx
transition-all duration-200 ease-in-out
${isVoting ? 'scale-95 opacity-70' : 'hover:scale-105'}
```

---

### 13. Genres Section Lacks "Select All" / "Clear All"

**Location:** `web/app/settings/preferences/PreferencesClient.tsx` (line 302-379)

**Problem:**
Power users who want ALL hip-hop sub-genres have to click each one individually. Tedious.

**Recommendation:**
Add small "Select all" and "Clear" links next to each category header in the genres section.

---

## Polish Opportunities

### 14. Onboarding Progress Dots Feel Small

**Location:** `web/app/onboarding/components/OnboardingProgress.tsx` (line 34-45)

**Observation:**
The step dots are `w-2 h-2` — quite small. On mobile, they're hard to see. Consider bumping to `w-2.5 h-2.5` or `w-3 h-3`.

---

### 15. Hotel Event Card "Complimentary for Guests" Copy

**Location:** `web/app/[portal]/_components/hotel/HotelEventCard.tsx` (line 149)

**Observation:**
This is a lovely touch — rebranding "free" as "complimentary" for hotel guests. Well done. Consider also using "From $X for guests" to emphasize the guest benefit even on paid events.

---

### 16. Admin Wizard Missing Preview/Test Mode

**Observation:**
The wizard creates a portal but doesn't let you preview it before activating. Consider adding a "Preview draft" button on the Review step that opens the portal in a new tab (with a banner indicating it's in draft mode).

---

## Accessibility Audit

### 17. Keyboard Navigation in Onboarding

**Location:** Category/Genre pickers

**Findings:**
- All buttons are keyboard accessible ✓
- Focus states are visible (coral border) ✓
- Tab order is logical ✓
- No skip links needed (single-page flow) ✓
- Missing: keyboard shortcut to submit (Enter key while focused on grid)

**Recommendation:**
Allow Enter key to submit when any category/genre is selected.

---

### 18. ARIA Labels Present but Generic

**Locations:** Various buttons

**Findings:**
- Exit button: `aria-label="Exit onboarding"` ✓
- TagVoteChip: `aria-label` and `aria-pressed` ✓
- HotelHeader search: `aria-label="Search"` ✓

Good coverage. Consider more descriptive labels:
- "Exit onboarding (progress will be saved)" instead of just "Exit onboarding"

---

## Mobile Responsiveness

### 19. Onboarding CategoryPicker Grid

**Location:** `web/app/onboarding/steps/CategoryPicker.tsx` (line 40)

**Issue:**
`grid-cols-2 sm:grid-cols-3` works well. On iPhone SE (375px), each card is ~170px wide — comfortable for touch. ✓

No issues found.

---

### 20. PreferencesClient Horizontal Scroll

**Issue:**
On narrow screens, the vibes section (line 447-470) can wrap to many rows if there are 20+ vibes. Consider max-height + scroll for very long lists.

**Recommendation:**
Add `max-h-64 overflow-y-auto` wrapper around vibes grid on mobile.

---

## Animation & Transitions

### 21. Onboarding Progress Bar Animation

**Location:** `web/app/onboarding/components/OnboardingProgress.tsx` (line 29)

**Finding:**
```tsx
transition-all duration-500 ease-out
```

Perfect. Smooth, not jarring. ✓

---

### 22. Hotel Event Card Hover

**Location:** `web/app/[portal]/_components/hotel/HotelEventCard.tsx` (line 99, line 107)

**Finding:**
```tsx
hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500
group-hover:scale-105 transition-transform duration-500
```

Excellent. The 500ms duration feels luxurious and high-end — perfect for hotel brand. ✓

---

### 23. TagVoteChip Scale Animation

**Location:** `web/components/TagVoteChip.tsx` (line 116)

**Issue:**
`hover:scale-105` is present, but `transition-all` is too broad. It animates color, border, padding, everything. Inefficient.

**Recommendation:**
Use `transition-[transform,_background-color,_border-color] duration-200`

---

## Typography Hierarchy

### 24. Onboarding Headings

**Location:** CategoryPicker and GenrePicker

**Finding:**
- H1: `text-2xl sm:text-3xl font-semibold` ✓
- Subtitle: `text-[var(--soft)] text-sm` ✓
- Hierarchy is clear and consistent

---

### 25. Hotel Typography

**Location:** Hotel components

**Finding:**
Uses `font-display` (serif) for headings and `font-body` for text. Creates elegant, high-end feel. ✓

Excellent departure from the main LostCity mono/sans stack.

---

## Color Usage

### 26. Design Token Compliance

**Audit:**
- Onboarding: Uses CSS variables throughout ✓
- Preferences: Uses CSS variables ✓
- Hotel: Uses CSS variables ✓
- Admin wizard: Uses CSS variables ✓
- **TagVoteChip: Uses hard-coded Tailwind colors** ✗ (see issue #2)

**Recommendation:**
Enforce CSS variable usage in component linting.

---

## Empty States

### 27. Genres Section - No Selected Categories

**Location:** `web/app/settings/preferences/PreferencesClient.tsx` (line 302)

**Finding:**
If user deselects all categories, the genres section disappears (controlled by `selectedCategories.length > 0`). This is correct behavior — no categories means no genres to select. ✓

---

### 28. NeedsTagList - No Tags

**Location:** `web/components/NeedsTagList.tsx` (line 112-115)

**Finding:**
```tsx
if (tags.length === 0) {
  return null;
}
```

Silently hides when no tags. This is good for detail pages (don't show empty sections), but might be confusing in settings. Consider showing "No needs tags yet" message in settings context.

---

## Recommendations Summary

### Quick Wins (High Impact, Low Effort)

1. **Standardize selection pill pattern** across all features (4 hours)
2. **Fix TagVoteChip colors** to use design tokens (1 hour)
3. **Add error states** to onboarding genre fetch (2 hours)
4. **Fix hotel QR code** fallback colors (15 minutes)
5. **Remove or wire up hotel search button** (30 minutes)
6. **Add dirty state warning** to preferences cancel (2 hours)

### Medium Priority (Should Do Before Launch)

7. Add loading skeletons to all preference sections (3 hours)
8. Test admin wizard on mobile and adjust layout (4 hours)
9. Add keyboard submit to onboarding pickers (1 hour)
10. Add scale animation feedback to TagVoteChip (1 hour)
11. Improve transition performance (replace transition-all) (2 hours)

### Nice to Have (Polish)

12. Add "Select all" / "Clear" to genres (4 hours)
13. Increase onboarding progress dot size (15 minutes)
14. Add preview mode to admin wizard (6 hours)
15. Add max-height to long preference lists (1 hour)

---

## Design System Health

### Token System: A

The three-layer design token architecture is well-structured and mostly followed. The hotel preset demonstrates how the system can create completely different visual languages while maintaining consistency. Excellent work.

**Areas for Improvement:**
- Enforce token usage in linting
- Document when to use primitives vs. semantic tokens
- Create component-level tokens for common patterns (pills, chips, cards)

### Component Consistency: B

Most components follow established patterns, but there are enough variations (especially in selection UI) to create confusion. Need to consolidate into shared components.

### Accessibility: B+

Good aria-label coverage, focus states are visible, keyboard navigation works. Main gaps are color contrast validation and some missing interactive states.

### Mobile Responsiveness: A-

Most layouts adapt well to mobile. Onboarding is particularly well-optimized. Admin wizard needs testing.

### Animation Quality: A

Smooth, purposeful animations. The hotel components especially show restraint and elegance. Duration choices are excellent.

---

## Conclusion

The post-Phase-A-M features represent a significant step forward in UX maturity. The onboarding flow is well-paced, the hotel concierge theme is a standout example of design system flexibility, and the admin wizard provides a clear path for portal creation.

The main areas for improvement are:
1. **Pattern consolidation** — too many ways to do the same thing (selection pills)
2. **Token enforcement** — some components still use hard-coded colors
3. **Error handling** — missing error states in critical flows
4. **Mobile testing** — admin tools need responsive validation

Address the "Quick Wins" before the next major release, and this will be a very solid foundation for future features.

---

**Next Steps:**
1. Create GitHub issues for Critical and Major findings
2. Create `<SelectionPill>` component with standardized styles
3. Run WCAG contrast audit on all color combinations
4. Mobile test admin wizard on real devices
5. Document component patterns in Storybook or design system docs
