# API Versioning

All API routes in LostCity now include versioning headers for future-proofing and better client compatibility.

## Quick Start

Replace `NextResponse.json()` with the versioned response helpers from `@/lib/api-utils`:

```typescript
// Before
import { NextResponse } from "next/server";
return NextResponse.json({ data: events }, { status: 200 });

// After
import { apiResponse, successResponse, errorApiResponse } from "@/lib/api-utils";
return successResponse({ data: events });
```

## Response Helpers

### `apiResponse(data, init?)`
Generic response with versioning headers. Use when you need full control over status codes.

```typescript
return apiResponse(
  { events: [] },
  {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300"
    }
  }
);
```

### `successResponse(data, init?)`
Shorthand for 200 OK responses.

```typescript
return successResponse({ profile });
return successResponse({ events }, {
  headers: { "Cache-Control": "public, max-age=60" }
});
```

### `createdResponse(data, init?)`
Shorthand for 201 Created responses.

```typescript
return createdResponse({ id: newEvent.id, title: newEvent.title });
```

### `errorApiResponse(message, status?)`
Error responses with consistent format and versioning headers.

```typescript
return errorApiResponse("Unauthorized", 401);
return errorApiResponse("Not found", 404);
return errorApiResponse("Internal server error", 500); // default
```

## Headers Added

All responses include:

- `X-API-Version: 1.0` - Current API version
- `X-Content-Type-Options: nosniff` - Security header

## Migration Guide

### Simple GET endpoints

```typescript
// Before
export async function GET(request: Request) {
  const data = await fetchData();
  return NextResponse.json({ data });
}

// After
import { successResponse } from "@/lib/api-utils";

export async function GET(request: Request) {
  const data = await fetchData();
  return successResponse({ data });
}
```

### Error handling

```typescript
// Before
if (error) {
  return NextResponse.json(
    { error: "Failed to fetch" },
    { status: 500 }
  );
}

// After
import { errorApiResponse } from "@/lib/api-utils";

if (error) {
  return errorApiResponse("Failed to fetch", 500);
}
```

### With caching headers

```typescript
// Before
return NextResponse.json(
  { events },
  {
    headers: {
      "Cache-Control": "public, max-age=300"
    }
  }
);

// After
return apiResponse(
  { events },
  {
    headers: {
      "Cache-Control": "public, max-age=300"
    }
  }
);
```

## Examples

See these files for real-world usage:

- `/app/api/events/route.ts` - List endpoint with caching
- `/app/api/trending/route.ts` - Cached read endpoint
- `/app/api/auth/profile/route.ts` - Full CRUD with validation

## Future Enhancements

When we need to make breaking API changes:

1. Update `API_VERSION` constant in `/lib/api-utils.ts`
2. Consider adding version-specific routes: `/api/v2/events`
3. Use the version header to maintain backward compatibility

## Rate Limiting

These helpers work seamlessly with existing rate limiting:

```typescript
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult; // Already has headers

  const data = await fetchData();
  return successResponse({ data });
}
```

## Best Practices

1. Always use typed response helpers instead of raw `NextResponse.json()`
2. Use `successResponse()` for 200 OK responses (most common)
3. Use `createdResponse()` for POST endpoints that create resources
4. Use `errorApiResponse()` for all error responses
5. Keep existing caching and security headers - they're preserved
6. The helpers are lightweight wrappers - no performance impact
