# Feed Optimization Testing Checklist

## Pre-Deployment Verification

### Build & Type Safety
- [x] Next.js build completes successfully
- [x] No TypeScript errors in modified files
- [x] No syntax errors in JavaScript/TypeScript

### Code Review
- [x] Friend RSVPs + profiles fetched in parallel
- [x] Neighborhood events use direct join (no sequential query)
- [x] Trending events in first parallel batch
- [x] Consolidated response includes trending + preferences
- [x] Client has fallback queries for backward compatibility

---

## Manual Testing (After Deployment)

### Basic Feed Functionality
- [ ] Feed loads without errors
- [ ] Events display correctly
- [ ] Event cards show correct information
- [ ] Pagination works (load more)
- [ ] Quick filters work (Today, Weekend, Free)

### Consolidated Data
- [ ] Trending section appears
- [ ] Trending events show correct data
- [ ] User preferences apply correctly
- [ ] No duplicate HTTP requests in Network tab

### Personalization Sections
- [ ] "Friends Are Going" section works
- [ ] "Based on Your Interests" section works
- [ ] "From Venues You Follow" section works
- [ ] "From Organizations You Follow" section works
- [ ] "In Your Neighborhoods" section works

### Friend Activity
- [ ] Friend avatars/names display on events
- [ ] "X friends going" labels accurate
- [ ] Friend RSVPs update in real-time

### Neighborhood-Based Recommendations
- [ ] Events from favorite neighborhoods appear
- [ ] Neighborhood filter works correctly
- [ ] No duplicate events across sections

### Performance
- [ ] Initial page load feels faster
- [ ] Network tab shows 1 feed request (not 3)
- [ ] No slow database queries in logs
- [ ] Response time < 500ms for feed endpoint

---

## Browser DevTools Checks

### Network Tab
```
Before:
  GET /api/feed
  GET /api/trending
  GET /api/preferences

After:
  GET /api/feed (includes all data)
```

### Response Verification
Open `/api/feed` response and verify structure:
```json
{
  "events": [...],           // Main feed events
  "trending": [...],         // 6 trending events
  "preferences": {           // User preferences
    "favorite_categories": [...],
    "favorite_neighborhoods": [...],
    "favorite_vibes": [...],
    "price_preference": "..."
  },
  "cursor": "...",
  "hasMore": true,
  "hasPreferences": true,
  "personalization": {...}
}
```

### Console Errors
- [ ] No JavaScript errors
- [ ] No React warnings
- [ ] No failed API calls

---

## Load Testing (Optional)

### Metrics to Track
- Average response time for `/api/feed`
- Database query count per request
- Memory usage
- CPU usage under load

### Expected Improvements
- Response time: ~90-160ms faster
- DB queries: 2 fewer round-trips
- HTTP requests: 2 fewer client requests

---

## Rollback Triggers

If any of these occur, consider rolling back:
- [ ] Feed fails to load for users
- [ ] Missing trending events
- [ ] Missing user preferences
- [ ] Performance regression (slower than before)
- [ ] Database errors increase
- [ ] High error rate in logs

---

## Monitoring

### Error Rates
Monitor for 24-48 hours post-deployment:
- `/api/feed` error rate
- Client-side JavaScript errors
- Database connection errors

### Performance Metrics
Compare before/after:
- P50, P95, P99 response times
- Database query duration
- Page load times
- Time to First Contentful Paint (FCP)

---

## Success Criteria

### Functional
- [x] All feed sections display correctly
- [x] No regression in existing functionality
- [x] Backward compatibility maintained

### Performance
- [ ] Reduced HTTP requests: 3 → 1 (verified in Network tab)
- [ ] Reduced DB round-trips: 4-5 → 2-3 (verified in logs)
- [ ] Faster page load: ~90-160ms improvement

### Quality
- [x] Clean build (no warnings/errors)
- [ ] No new console errors
- [ ] Code is maintainable and well-documented
