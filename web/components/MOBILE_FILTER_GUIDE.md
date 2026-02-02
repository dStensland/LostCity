# Mobile Filter Component Guide

## Mobile Filter Bar Layout

```
┌─────────────────────────────────────────┐
│  [🗓 This Weekend] [✓ Free] [🎵 Music]  │ ← Horizontal scroll
│  [🍔 Food] [⚙️ More (2)]                │   (hidden scrollbar)
│                                         │
│          [List] [Cal] [Map]             │ ← View toggle (centered)
└─────────────────────────────────────────┘
```

### Pill Structure

Each filter pill is:
- **Min Height:** 44px (iOS touch target)
- **Padding:** 16px horizontal, 10px vertical
- **Border Radius:** 9999px (fully rounded)
- **Font:** Mono, 12px, medium weight
- **Active State:** Portal primary color background
- **Inactive State:** Twilight background

### "More" Button Badge

When filters are active, shows count:
```
┌──────────────┐
│ ⚙️ More  (3) │ ← Badge shows total active filters
└──────────────┘
```

## Bottom Sheet Layout

```
┌─────────────────────────────────────────┐
│              ═══                        │ ← Drag handle
│  Filters                          ✕     │ ← Header
├─────────────────────────────────────────┤
│                                         │
│  When                                   │
│  ┌──────────┐ ┌──────────┐             │
│  │  Today   │ │ Tomorrow │             │ ← 2 columns
│  └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐             │
│  │ Weekend  │ │This Week │             │
│  └──────────┘ └──────────┘             │
│                                         │
│  Categories                             │
│  ┌──────────┐ ┌──────────┐             │
│  │🎵 Music  │ │🍔 Food   │             │ ← 2 columns
│  └──────────┘ └──────────┘             │   with icons
│  ┌──────────┐ ┌──────────┐             │
│  │🎬 Film   │ │😂 Comedy │             │
│  └──────────┘ └──────────┘             │
│  ... (scrollable)                       │
│                                         │
│  Price                                  │
│  ┌──────────────────────────────────┐  │
│  │ ◯ Free only                      │  │ ← Full width
│  └──────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [Clear all]  [Show 47 events]         │ ← Sticky footer
└─────────────────────────────────────────┘
```

## Component States

### 1. Default State (No Filters)
- "This Weekend" and "Free" pills visible
- Quick category suggestions (Music, Food)
- "More" button with no badge
- View toggle: "List" selected

### 2. Active Filters
- Active filter pills shown first
- "More" button shows count badge
- Quick categories replaced with active ones
- Clear button visible

### 3. Bottom Sheet Open
- Backdrop overlay (50% opacity)
- Sheet slides up (300ms)
- Body scroll locked
- All filter sections visible
- Sticky footer with actions

## Interaction Flows

### Opening Filters
```
User taps "More" button
  ↓
Sheet slides up from bottom
  ↓
Backdrop fades in
  ↓
Body scroll locked
  ↓
Sheet content scrollable
```

### Applying Filters
```
User toggles filters in sheet
  ↓
Filters update (optimistic)
  ↓
User taps "Apply" or backdrop
  ↓
Sheet slides down
  ↓
URL updates
  ↓
Events refresh
```

### Quick Filter Toggle
```
User taps pill in horizontal scroll
  ↓
Filter toggles immediately
  ↓
URL updates
  ↓
Events refresh
  ↓
Pill state updates
```

## Responsive Breakpoints

### Mobile (< 640px)
- Horizontal scroll pills shown
- View toggle at bottom (centered)
- Bottom sheet for advanced filters
- Touch-optimized spacing

### Desktop (>= 640px)
- Original dropdown filters
- View toggle at right
- No bottom sheet
- Compact spacing

## Animation Timings

All animations use 300ms ease-out:
- Sheet slide up/down: 300ms
- Backdrop fade in/out: 300ms
- Pill state transitions: 200ms
- Hover effects: 150ms

## Z-Index Hierarchy

```
50: Bottom sheet container
  ↳ 50: Backdrop
  ↳ 51: Sheet content (implicit)
10: Filter bar (sticky)
0:  Page content
```

## Color Variables

```css
/* Active states */
--coral: Primary active filter
--gold: Date filter active
--neon-green: Free filter active
--neon-cyan: Following filter active

/* Inactive states */
--twilight: Pill background
--dusk: Pill hover

/* Sheet */
--void: Sheet background
--twilight: Sheet borders
--cream: Text
--muted: Secondary text
```

## Testing Mobile Filter Experience

### Quick Test Steps

1. **Resize browser to mobile width (<640px)**
   - Filter bar should show horizontal pills
   - View toggle should be centered below

2. **Tap "More" button**
   - Sheet should slide up smoothly
   - Backdrop should fade in
   - Body scroll should lock

3. **Toggle some filters**
   - Pills should update immediately
   - Count badge should show on "More" button

4. **Tap backdrop**
   - Sheet should slide down
   - Backdrop should fade out
   - Body scroll should unlock

5. **Check touch targets**
   - All buttons should be at least 44px tall
   - Adequate spacing between tap areas

### Device Testing

Test on real devices:
- iPhone (Safari)
- Android (Chrome)
- Tablet (both orientations)

### Accessibility Testing

- VoiceOver on iOS
- TalkBack on Android
- Keyboard navigation (desktop)
