# Search Redesign — Design Decisions & Implementation Handoff
Date: 2026-03-22

> The HTML prototype at `2026-03-22-search-redesign-screens.html` is the visual reference.
> Open it in a browser — all 4 screens are pixel-precise against the design token system.

---

## What the 4 Screens Show

### Screen 1: Pre-Search State (Discovery Launchpad)
The Find view when the search bar is empty and unfocused. This is NOT a dropdown — it's a persistent page section. Three parts:

1. **Trending pills** — 6 terms, `bg-twilight/50 font-mono text-xs rounded-full`. Gap 7px, flex-wrap. Clicking fills the bar and triggers instant search.
2. **Category grid** — 4-column, 8px gap, 10px card radius. Icon (22px, category-tinted bg) + mono label (9px uppercase). Clicking applies category filter and navigates to browse state. Match the 8 existing `MOBILE_CATEGORIES` in `FindFilterBar.tsx`.
3. **Popular Right Now cards** — 3 rows, bg-void, 44px square image placeholder, title + venue/time meta + badge (Live/Free/Trending). Source: CityPulse trending pool.

Key architectural decision: currently these are inside the dropdown (`showPreSearch` state). The redesign moves them BELOW the search bar as a persistent page section, visible regardless of focus state. They disappear when the user starts typing (transition to dropdown).

### Screen 2: Typing State ("live mus")
The instant dropdown. Visual changes from current implementation:

1. **Quick actions become horizontal pills** (not full-width rows). Current `QuickActionsList` renders them as list items with icon+label+description — that's too heavy. Replace with compact horizontal pill row: `bg-twilight/40 border-twilight/70 rounded-full px-3 py-1.5 text-xs font-mono`. 3 pills: Tonight only, Free events, Near me.
2. **Group header redesign** — colored dot (6px circle) + mono type label + count in parens + "see all →" right-aligned. Current uses TypeIcon + text, which is fine, but the dot is cleaner at small size.
3. **Dropdown joins search bar visually** — `border-top: none` on dropdown, same border-radius at top corners (0), `rounded-b-xl`. Creates a seamless panel feel rather than a floating element.
4. **Result icon size** — 32px (current 28px `w-7 h-7`). Tiny increase but improves scannability.
5. **Selected row state** — `border border-coral/25` added to the `bg-twilight` state. Subtle coral outline on keyboard-selected item.

### Screen 3: Browse State (filtered Find view)
After pressing Enter or clicking "See all →". What changes:

1. **Search query chip appears first in filter bar** — coral color, search icon inside chip, `bg-coral/12 text-coral border-coral/30`. Spec CSS: `bg-[var(--coral)]/15 text-[var(--coral)] font-mono text-xs rounded-full px-3 py-1`.
2. **Match highlight in results** — the query term highlighted in coral within event titles. Currently the `EventCard` / find row cards don't do this. Add a simple `highlightQuery(title, query)` pass similar to `HighlightMatch` in `SuggestionGroup.tsx`.
3. **Result count header** — `font-mono text-xs uppercase tracking-wider` with `strong` on the number. Shows "47 events · live music". Currently absent from the browse state.
4. **Search bar resets to placeholder** — after committing to browse state, the bar shows placeholder again (query lives in the chip, not the bar).

### Screen 4: Mobile Full-Screen (375px)
Triggered when the mobile search icon in the header is tapped (current `HeaderSearchButton` mobile variant navigates to Find — this should instead open a full-screen overlay rendered via a portal).

Key differences from desktop:
- **Full-screen overlay** — `fixed inset-0 z-50 bg-void` — fills the entire screen
- **Header**: back arrow (←) + focused search input + "Cancel" text button (NOT an X icon — match iOS pattern)
- **No dropdown** — results fill the screen directly as a scrollable list with section headers
- **Trending pills** — horizontally scrollable single row (overflow-x-auto, flex-nowrap)
- **Touch targets** — all result rows minimum 44px height
- **Back behavior** — pressing back returns to previous page with the search state preserved (not lost)

---

## Implementation Notes for `full-stack-dev`

### Pre-Search State Architecture
Currently: Trending + categories are inside the dropdown div, conditional on `showPreSearch`.
Change to: A `<PreSearchState>` component rendered as a sibling below `FindSearchInput`, visible when `query.length === 0 && !hasActiveSearch`. Disappears (fade transition) when query starts.

```tsx
// In HappeningView or find page layout:
<FindSearchInput ... />
{!hasActiveQuery && <PreSearchState portalSlug={portalSlug} onTrendingClick={handleTrend} onCategoryClick={handleCategory} />}
{hasDropdown && <InstantResultsDropdown ... />} // the existing dropdown
```

### Quick Actions Restyling
The current `QuickActionsList` renders full-width rows. Change to pill strip:

```tsx
// New pattern — horizontal pill row instead of vertical list
<div className="flex gap-2 px-3 py-2.5 overflow-x-auto border-b border-[var(--twilight)]/40">
  {actions.map(action => (
    <button key={action.id}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--twilight)]/40 border border-[var(--twilight)]/70 rounded-full text-xs font-mono text-[var(--soft)] whitespace-nowrap hover:bg-[var(--coral)]/10 hover:border-[var(--coral)]/30 transition-all"
    >
      <QuickActionIcon icon={action.icon} className="w-3 h-3 text-[var(--coral)]" />
      {action.label}
    </button>
  ))}
</div>
```

### Search Filter Chip
Add to `FindFilterBar.tsx` as the first chip when `searchParams.get('search')` is set:

```tsx
// Search chip — always first in filter bar
{searchQuery && (
  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30 rounded-full font-mono text-xs flex-shrink-0">
    <svg className="w-2.5 h-2.5" ...magnifying-glass... />
    <span>{searchQuery}</span>
    <button onClick={clearSearch} className="ml-0.5">
      <svg className="w-3 h-3 opacity-70" ...x... />
    </button>
  </div>
)}
```

### Mobile Overlay
New component `MobileSearchOverlay.tsx`. Render via `createPortal(content, document.body)`. Triggered by:
1. Tapping the search icon in header on mobile (`<768px`)
2. ⌘K shortcut (currently navigates to Find — keep this for desktop)

The overlay already has all the search infrastructure (`useInstantSearch`, dropdown) — it's purely a mobile-specific shell around the same logic.

### Match Highlighting in Browse Results
The `HighlightMatch` function already exists in `SuggestionGroup.tsx`. Extract it to `lib/search-utils.ts` and use in `EventCard.tsx` when `searchQuery` prop is passed.

---

## Design Quality Checklist Before Shipping

- [ ] Pre-search state visible immediately on Find view load (no flash of empty state)
- [ ] Trending pills click → search bar fills AND instant results appear
- [ ] Dropdown joins search bar seamlessly (no gap, border matches)
- [ ] Quick actions are pills, not rows — horizontal scrollable
- [ ] Selected dropdown item: twilight bg + coral border/25 + 1px translateX
- [ ] Search chip appears in filter bar, is always first
- [ ] Match highlighting in browse results (event titles)
- [ ] Mobile overlay: 44px touch targets, horizontal trending scroll
- [ ] Mobile: back/cancel preserves search state (don't reset on navigate)
- [ ] Keyboard footer in dropdown is `hidden sm:block` (desktop only)
- [ ] Pre-search disappears instantly when typing starts (no delay)
- [ ] Focus ring: ring-2 ring-coral/10 + 0 0 20px coral/08 glow (matches spec)
- [ ] ⌘K from any page focuses Find search (desktop) or opens overlay (mobile)

---

## What NOT to Change

- The instant search hook (`useInstantSearch`) — it works
- The dropdown animation (`animate-dropdown-in`) — keep it
- URL sync behavior — the debounced router.replace pattern is correct
- Keyboard navigation (↑↓ Enter Esc) — already handles all cases
- `SuggestionGroup` result card layout — just restyle, don't rebuild
- The `addRecentSearch` / recent searches section — keep it

---

## Design Token Cheat Sheet

| Element | Tailwind Classes |
|---------|----------------|
| Search bar container | `h-12 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl` |
| Search bar focused | `focus-within:border-[var(--coral)] focus-within:ring-2 focus-within:ring-[var(--coral)]/10 focus-within:shadow-[0_0_20px_var(--coral)/08]` |
| Search input text | `font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)]` |
| Dropdown surface | `bg-[var(--dusk)]/97 border border-[var(--twilight)] rounded-b-xl` |
| Trending pill | `px-3 py-1.5 bg-[var(--twilight)]/50 border border-[var(--twilight)]/80 rounded-full font-mono text-xs text-[var(--soft)]` |
| Category chip | `flex flex-col items-center gap-1.5 p-2.5 bg-[var(--night)]/80 border border-[var(--twilight)]/70 rounded-xl` |
| Search filter chip | `flex items-center gap-1.5 px-3 py-1 bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30 rounded-full font-mono text-xs` |
| Group header label | `font-mono text-2xs uppercase tracking-[0.12em]` |
| Result row selected | `bg-[var(--twilight)] border border-[var(--coral)]/25 translate-x-0.5` |
| Quick action pill | `px-3 py-1.5 bg-[var(--twilight)]/40 border border-[var(--twilight)]/70 rounded-full font-mono text-xs text-[var(--soft)]` |
| Match highlight | `text-[var(--coral)] font-medium` |

