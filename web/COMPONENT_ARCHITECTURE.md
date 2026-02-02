# Search & Filter Component Architecture

## Component Hierarchy

```
Portal Page / Event List Page
├── SearchBar (updated)
│   ├── Recent Searches (shows on focus)
│   │   ├── Individual remove buttons (hover)
│   │   └── Clear all button (header)
│   └── Search suggestions (from API)
│
├── SearchResultsHeader (new)
│   ├── Result count display
│   ├── Loading state
│   └── No results state
│       └── Suggestion chips
│
├── Event Grid / List
│   └── Event Cards
│
├── StickyFilterButton (new, mobile only)
│   ├── Filter count badge
│   └── Result count
│
└── MobileFilterSheet (updated)
    ├── When filters
    ├── Category filters (with haptic feedback)
    ├── Price filters (with haptic feedback)
    └── Footer actions
        ├── Clear all (with haptic feedback)
        └── Apply (with haptic feedback)
```

## Data Flow

```
User Actions → Components → URL State → API/Filter Logic → Results
     ↓                                         ↓
   Haptic                               localStorage
  Feedback                             (recent/saved)
```

## State Management

### URL-Based State (Primary)
```typescript
searchParams: {
  search?: string        // Search query
  categories?: string    // Comma-separated
  date?: string          // Date filter (today, weekend, etc.)
  free?: boolean         // Free events only
  neighborhoods?: string // Location filters
  // ... other filters
}
```

### Local State (Secondary)
```typescript
localStorage: {
  "lostcity_recent_searches": string[]      // Up to 10
  "lostcity-saved-filter-presets": SavedFilter[]  // Up to 10
}
```

## Component APIs

### SearchResultsHeader
```typescript
interface SearchResultsHeaderProps {
  resultCount: number;
  isLoading?: boolean;
  query?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  suggestions?: Array<{
    text: string;
    onClick: () => void;
  }>;
}
```

### StickyFilterButton
```typescript
interface StickyFilterButtonProps {
  filterCount: number;
  resultCount?: number;
  onClick: () => void;
  scrollThreshold?: number;  // Default: 200px
}
```

### MobileFilterSheet (Updated)
```typescript
interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentCategories: string[];
  currentDateFilter: string;
  currentFreeOnly: boolean;
  onToggleCategory: (category: string) => void;
  onSetDateFilter: (date: string) => void;
  onToggleFreeOnly: () => void;
  onClearAll: () => void;
  resultCount?: number;
}

// Now includes haptic feedback on all actions!
```

## Utility Functions

### Haptics
```typescript
import { triggerHaptic } from "@/lib/haptics";

triggerHaptic("selection");  // Light tap (filters)
triggerHaptic("medium");     // Medium tap (clear)
triggerHaptic("success");    // Success pattern (apply)
```

### Search History
```typescript
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches
} from "@/lib/searchHistory";

const searches = getRecentSearches();     // Returns up to 10
addRecentSearch("live music");            // Adds to top
removeRecentSearch("old search");         // Removes specific
clearRecentSearches();                    // Removes all
```

## Responsive Behavior

### Desktop (≥768px)
- Full-width search bar
- Inline filter chips
- Saved filters menu in header
- No sticky filter button

### Mobile (<768px)
- Bottom sheet for filters
- Sticky filter button on scroll
- Haptic feedback on interactions
- Touch-optimized (44px min targets)

## Animation Timing

```css
/* Smooth, consistent animations */
transition: transform 300ms ease-out,
            opacity 300ms ease-out;

/* Sticky button slide up */
transform: translateY(0);      /* Visible */
transform: translateY(20px);   /* Hidden */

/* Filter sheet slide up */
transform: translateY(0);      /* Open */
transform: translateY(100%);   /* Closed */
```

## Accessibility Features

### Keyboard Navigation
- `↑↓` - Navigate suggestions
- `Enter` - Select item
- `Esc` - Close overlays
- `Tab` - Focus management

### Screen Readers
- ARIA labels on all buttons
- Live region for result count
- Role attributes on overlays
- Semantic HTML structure

### Focus Management
- Trap focus in modal/sheet
- Return focus on close
- Visible focus indicators

## Performance Optimizations

### Debouncing
```typescript
// Search input: 150ms
// Filter changes: Immediate (no debounce)
// Scroll events: Passive listener
```

### Memoization
```typescript
// Components memoized:
- SearchResultsHeader
- StickyFilterButton
- MobileFilterSheet

// Values memoized:
- Filter counts
- Has filters check
- Suggestion lists
```

### Bundle Impact
```
haptics.ts:              ~500 bytes
StickyFilterButton:      ~1KB
SearchResultsHeader:     ~1.5KB
Total:                   ~3KB (minified)
```

## Browser Support

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Haptic Feedback | ✅ 52+ | ✅ 13+ (iOS) | ❌ | ✅ 79+ |
| All Other Features | ✅ | ✅ | ✅ | ✅ |

Progressive enhancement: Haptics fail silently on unsupported browsers.

## Testing Checklist

### Functional
- [ ] Recent search add/remove/clear
- [ ] Filter sheet open/close
- [ ] Sticky button scroll threshold
- [ ] Result count updates
- [ ] No results suggestions work
- [ ] Haptic feedback on device

### Visual
- [ ] Mobile portrait/landscape
- [ ] Tablet layout
- [ ] Desktop layout
- [ ] Dark mode (if applicable)
- [ ] Animation smoothness
- [ ] Touch target sizes

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader announcements
- [ ] Focus indicators visible
- [ ] ARIA labels correct
- [ ] Semantic HTML

### Performance
- [ ] Smooth scrolling
- [ ] No layout shift
- [ ] Fast filter response
- [ ] Memory leaks (none)

## Common Patterns

### Pattern 1: Simple Event List
```tsx
<SearchResultsHeader resultCount={events.length} />
<EventList events={events} />
<StickyFilterButton filterCount={3} onClick={openFilters} />
<MobileFilterSheet {...filterProps} />
```

### Pattern 2: With Search
```tsx
<SearchBar />
<SearchResultsHeader
  resultCount={events.length}
  query={searchQuery}
/>
<EventList events={events} />
```

### Pattern 3: No Results
```tsx
<SearchResultsHeader
  resultCount={0}
  hasFilters={true}
  onClearFilters={clearAll}
  suggestions={[...]}
/>
```

## Migration Guide

### Existing Filter Pages
1. Add `SearchResultsHeader` above your list
2. Add `StickyFilterButton` (will auto-hide on desktop)
3. Update `MobileFilterSheet` to latest version (haptics automatic)
4. Test on mobile device for haptic feedback

### No Code Changes Needed
- `SearchBar` - Recent search improvements are automatic
- `SavedFiltersMenu` - Already implemented, just import

## Future Enhancements

### Potential Additions
1. Filter presets (e.g., "Free tonight")
2. Smart suggestions based on history
3. Voice search integration
4. Search analytics dashboard
5. A/B testing framework for UX changes

### Monitoring Recommendations
1. Track filter usage by type
2. Monitor recent search engagement
3. Measure time-to-result
4. Track no-results rate
5. Collect user feedback
