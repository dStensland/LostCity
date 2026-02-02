# Search & Filter UX - Quick Reference

## Import Statements

```typescript
// New Components
import { SearchResultsHeader } from "@/components/SearchResultsHeader";
import { StickyFilterButton } from "@/components/StickyFilterButton";

// Updated Components
import SearchBar from "@/components/SearchBar";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import SavedFiltersMenu from "@/components/SavedFiltersMenu";

// Utilities
import { triggerHaptic } from "@/lib/haptics";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches
} from "@/lib/searchHistory";
```

## Component Usage

### SearchResultsHeader
```tsx
<SearchResultsHeader
  resultCount={events.length}
  isLoading={loading}
  query={searchQuery}
  hasFilters={categories.length > 0}
  onClearFilters={() => router.push("/events")}
  suggestions={[
    { text: "Browse all", onClick: () => clearFilters() },
    { text: "Free events", onClick: () => setFreeOnly(true) },
  ]}
/>
```

### StickyFilterButton
```tsx
<StickyFilterButton
  filterCount={categories.length + (dateFilter ? 1 : 0)}
  resultCount={events.length}
  onClick={() => setShowFilters(true)}
  scrollThreshold={200}
/>
```

### MobileFilterSheet (with haptic feedback)
```tsx
<MobileFilterSheet
  isOpen={showFilters}
  onClose={() => setShowFilters(false)}
  currentCategories={categories}
  currentDateFilter={dateFilter}
  currentFreeOnly={freeOnly}
  onToggleCategory={(cat) => toggleCategory(cat)}
  onSetDateFilter={(date) => setDateFilter(date)}
  onToggleFreeOnly={() => setFreeOnly(!freeOnly)}
  onClearAll={() => clearAllFilters()}
  resultCount={events.length}
/>
```

### SearchBar (Automatic)
```tsx
<SearchBar />
// No changes needed - improvements automatic!
// - Shows up to 10 recent searches
// - Individual remove on hover
// - Clear all button
```

### SavedFiltersMenu
```tsx
<SavedFiltersMenu variant="compact" />
// or
<SavedFiltersMenu variant="full" />
```

## Utility Functions

### Haptic Feedback
```typescript
// Light selection feedback (default for filters)
triggerHaptic("selection");

// Medium feedback (for toggle actions)
triggerHaptic("medium");

// Heavy feedback (for destructive actions)
triggerHaptic("heavy");

// Success pattern (for completion)
triggerHaptic("success");
```

### Search History
```typescript
// Get recent searches (up to 10)
const searches = getRecentSearches();

// Add search
addRecentSearch("live music");

// Remove specific search
removeRecentSearch("old search");

// Clear all
clearRecentSearches();
```

## Common Patterns

### Full Page Integration
```tsx
function EventListPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [events, setEvents] = useState([]);
  const filterCount = /* calculate active filters */;

  return (
    <>
      <SearchResultsHeader
        resultCount={events.length}
        hasFilters={filterCount > 0}
      />
      <EventList events={events} />
      <StickyFilterButton
        filterCount={filterCount}
        onClick={() => setShowFilters(true)}
      />
      <MobileFilterSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        {/* ...filter props */}
      />
    </>
  );
}
```

### No Results State
```tsx
<SearchResultsHeader
  resultCount={0}
  hasFilters={true}
  onClearFilters={handleClear}
  suggestions={[
    { text: "Try 'tonight'", onClick: () => setDate("today") },
    { text: "Show free", onClick: () => setFree(true) },
    { text: "Browse all", onClick: handleClear },
  ]}
/>
```

### Custom Filter Button
```tsx
function CustomFilterButton({ onClick }) {
  const handleClick = () => {
    triggerHaptic("selection");
    onClick();
  };

  return <button onClick={handleClick}>Filter</button>;
}
```

## Responsive Classes

### Hide on Mobile
```tsx
<div className="hidden md:block">
  {/* Desktop only */}
</div>
```

### Show on Mobile Only
```tsx
<div className="md:hidden">
  {/* Mobile only */}
</div>
```

## State Management

### URL-Based Filters
```typescript
const router = useRouter();
const searchParams = useSearchParams();

// Read
const categories = searchParams.get("categories")?.split(",") || [];

// Update
const params = new URLSearchParams(searchParams);
params.set("categories", newCategories.join(","));
router.push(`/events?${params.toString()}`, { scroll: false });
```

### Filter Count
```typescript
const filterCount = useMemo(() => {
  let count = 0;
  if (categories.length > 0) count += categories.length;
  if (dateFilter) count += 1;
  if (freeOnly) count += 1;
  return count;
}, [categories, dateFilter, freeOnly]);
```

## Styling Guide

### Color Variables
```css
--cream:       /* Primary text */
--muted:       /* Secondary text */
--soft:        /* Tertiary text */
--coral:       /* Primary action */
--twilight:    /* Border/divider */
--dusk:        /* Hover states */
--night:       /* Background */
--void:        /* Deep background */
```

### Touch Targets
```tsx
// Minimum 44px for mobile
className="min-h-[44px] px-4 py-2.5"
```

## Testing Checklist

### Desktop
- [ ] Result count displays correctly
- [ ] Filters update URL
- [ ] SavedFiltersMenu accessible
- [ ] Keyboard navigation works

### Mobile
- [ ] StickyFilterButton appears on scroll
- [ ] MobileFilterSheet opens/closes smoothly
- [ ] Haptic feedback felt on device
- [ ] Touch targets at least 44px

### Both
- [ ] Recent searches show in SearchBar
- [ ] Individual search removal works
- [ ] "No results" state shows suggestions
- [ ] Loading states show correctly

## Performance Tips

1. **Memoize calculations**
   ```typescript
   const filterCount = useMemo(() => /* ... */, [deps]);
   ```

2. **Debounce expensive operations**
   ```typescript
   const debouncedSearch = useMemo(
     () => debounce(search, 150),
     []
   );
   ```

3. **Use passive scroll listeners**
   ```typescript
   window.addEventListener("scroll", handler, { passive: true });
   ```

## Accessibility

### ARIA Labels
```tsx
<button aria-label="Clear filters">Clear</button>
```

### Keyboard Shortcuts
- `Escape` - Close overlays
- `↑↓` - Navigate suggestions
- `Enter` - Select item

### Focus Management
```typescript
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (isOpen) inputRef.current?.focus();
}, [isOpen]);
```

## Debugging

### Check Filter State
```typescript
console.log({
  categories,
  dateFilter,
  freeOnly,
  filterCount,
  hasFilters: filterCount > 0
});
```

### Check Haptic Support
```typescript
import { isHapticSupported } from "@/lib/haptics";
console.log("Haptics:", isHapticSupported());
```

### Check Recent Searches
```typescript
import { getRecentSearches } from "@/lib/searchHistory";
console.log("Recent:", getRecentSearches());
```

## File Locations

```
/components/
  ├── SearchBar.tsx                  (updated)
  ├── SearchResultsHeader.tsx        (new)
  ├── StickyFilterButton.tsx         (new)
  ├── MobileFilterSheet.tsx          (updated)
  └── SavedFiltersMenu.tsx           (existing)

/lib/
  ├── searchHistory.ts               (updated)
  ├── haptics.ts                     (new)
  └── saved-filters.ts               (existing)

/examples/
  └── FilteredEventListExample.tsx   (new)
```

## Documentation

- `SEARCH_FILTER_UX_IMPROVEMENTS.md` - Full guide
- `SEARCH_FILTER_IMPROVEMENTS_SUMMARY.md` - Summary
- `COMPONENT_ARCHITECTURE.md` - Architecture
- `IMPLEMENTATION_COMPLETE.md` - Status
- `QUICK_REFERENCE.md` - This file

## Support

For questions or issues:
1. Check documentation files above
2. Review example implementation
3. Test on actual mobile device
4. Check browser console for errors
