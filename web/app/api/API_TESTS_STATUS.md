# API Route Test Coverage - Status

**Date**: 2026-02-10
**Phase**: L - API Route Test Coverage

## Summary

API route test coverage has been initiated. The `/api/events` route now has comprehensive test coverage (17 tests passing). Additional routes require simpler mock patterns to avoid timeout issues.

## Completed

### `/api/events` - 17 tests ✓

**File**: `app/api/events/__tests__/route.test.ts`

Coverage includes:
- Rate limiting enforcement (read limit)
- Rate limit response handling (429 status)
- Offset-based pagination (legacy mode)
  - Default page/pageSize values
  - Parameter validation and clamping
- Cursor-based pagination
  - With cursor parameter
  - With useCursor=true flag
- Filter parameters
  - Search query
  - Category filters (comma-separated)
  - Price filters (free, budget, etc.)
  - Venue ID (integer parsing)
  - Date filters (specific dates)
  - Map bounds (geo filtering)
  - Classes exclusion (default behavior)
- Response headers (cache control)
- Error handling (500 on database errors)
- Social proof enrichment

**Key Pattern**: Uses mocked `@/lib/search` module functions instead of deep Supabase mocking, which makes tests fast and reliable.

## Remaining Routes

The following routes need test coverage with simpler mocking strategies:

### `/api/spots` (Priority 2)
- **Complexity**: High Supabase query chaining
- **Approach**: Mock at higher level (venue search functions)
- **Est. tests**: 12-15

### `/api/tonight` (Priority 3)
- **Complexity**: NextRequest API, complex scoring logic
- **Approach**: Mock curated picks & atlanta portal queries separately
- **Est. tests**: 10-12

### `/api/genres` (Priority 4)
- **Complexity**: Medium (multi-category grouping)
- **Approach**: Mock genre_options table responses
- **Est. tests**: 8-10

### `/api/onboarding/complete` (Priority 5)
- **Complexity**: Medium (auth + upsert)
- **Approach**: Mock auth.getUser() and from().upsert()
- **Est. tests**: 10-12

### `/api/preferences` (Priority 6)
- **Complexity**: Medium (GET + POST, auth required)
- **Approach**: Mock getUser() and simple CRUD operations
- **Est. tests**: 10-12

## Lessons Learned

### ✓ What Works
1. **Function-level mocking**: Mock business logic functions (e.g., `getFilteredEventsWithSearch`) instead of deep Supabase chains
2. **Simple return values**: Return resolved promises directly, avoid deep `.mockReturnValue()` chains
3. **Standard Request objects**: Use `new Request(url)` for GET routes

### ✗ What Doesn't Work
1. **Deep Supabase chains**: Mocking `.from().select().eq().order()` chains leads to timeouts
2. **Complex conditional mocking**: `mockImplementation((table) => ...)` patterns are brittle
3. **NextRequest in tests**: Requires custom objects, not standard `new Request()`

## Recommended Next Steps

1. Create helper modules for each API route (similar to `@/lib/search`)
   - Example: `@/lib/spots.ts` with `getSpots(filters)`
   - Example: `@/lib/preferences.ts` with `getUserPreferences(userId)`, `saveUserPreferences(userId, data)`

2. Refactor route handlers to use these helpers

3. Write tests against the helpers, not against Supabase directly

4. This approach:
   - Makes tests faster (no complex mocking)
   - Makes routes easier to understand (business logic extracted)
   - Makes refactoring safer (tests verify behavior, not implementation)

## Test Metrics

| Route | Tests Written | Tests Passing | Coverage |
|-------|---------------|---------------|----------|
| `/api/events` | 17 | 17 | ✓ Comprehensive |
| `/api/spots` | 0 | 0 | ✗ Not started |
| `/api/tonight` | 0 | 0 | ✗ Not started |
| `/api/genres` | 0 | 0 | ✗ Not started |
| `/api/onboarding/complete` | 0 | 0 | ✗ Not started |
| `/api/preferences` | 0 | 0 | ✗ Not started |
| **Total** | **17** | **17** | **16.7% (1/6 routes)** |

## Example: Preferred Pattern

```typescript
// ✓ GOOD: Mock at business logic level
vi.mock("@/lib/search", () => ({
  getFilteredEventsWithSearch: vi.fn(),
  enrichEventsWithSocialProof: vi.fn((events) => Promise.resolve(events)),
}));

// ✗ BAD: Mock at Supabase level
vi.mocked(mockSupabase.from).mockImplementation((table) => {
  if (table === "events") {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as never;
  }
  // ... more complex chains
});
```

## Files Created

- `app/api/events/__tests__/route.test.ts` (passing)
- `app/api/API_TESTS_STATUS.md` (this file)

## Next Action

Before writing more API tests, consider:
1. Extract business logic from remaining routes into helper modules
2. Then test the helpers directly
3. Finally, add lightweight integration tests for the route handlers

This will provide better test coverage with less brittle tests.
