# API Response Helpers - Quick Reference

All helpers automatically add versioning and security headers.

## Import

```typescript
import {
  apiResponse,
  successResponse,
  createdResponse,
  errorApiResponse,
  validationError
} from "@/lib/api-utils";
```

## Usage

### ✅ Success (200 OK)

```typescript
return successResponse({ events: [] });
return successResponse({ user }, {
  headers: { "Cache-Control": "private, max-age=60" }
});
```

### 🎉 Created (201)

```typescript
return createdResponse({ id: event.id, title: event.title });
```

### ❌ Errors

```typescript
// Generic errors
return errorApiResponse("Not found", 404);
return errorApiResponse("Unauthorized", 401);
return errorApiResponse("Forbidden", 403);
return errorApiResponse("Internal server error", 500); // default

// Validation errors (400)
return validationError("Email is required");
return validationError("Invalid date format");
```

### 🎛️ Custom (when you need full control)

```typescript
return apiResponse(
  { data: events, metadata: { total: 100 } },
  {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=300",
      "X-Custom-Header": "value"
    }
  }
);
```

## Headers Automatically Added

```
X-API-Version: 1.0
X-Content-Type-Options: nosniff
```

## Common Patterns

### With Rate Limiting

```typescript
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  const data = await fetchData();
  return successResponse({ data });
}
```

### Error Handling

```typescript
try {
  const data = await riskyOperation();
  return successResponse({ data });
} catch (error) {
  logger.error("Operation failed", error);
  return errorApiResponse("Failed to complete operation", 500);
}
```

### Validation

```typescript
const email = body.email;
if (!email || !isValidEmail(email)) {
  return validationError("Valid email is required");
}
```

### Auth Check

```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return errorApiResponse("Unauthorized", 401);
}
```

## Migration Checklist

- [ ] Replace `NextResponse.json()` with helpers
- [ ] Use `successResponse()` for 200 OK
- [ ] Use `errorApiResponse()` for errors
- [ ] Use `validationError()` for validation (400)
- [ ] Use `createdResponse()` for POST (201)
- [ ] Keep existing cache headers
- [ ] Test the endpoint

## Don't Use For

- Middleware responses (use `NextResponse` directly)
- Redirects (use `NextResponse.redirect()`)
- Static file responses
- Non-JSON responses

## See Also

- `/app/api/API_VERSIONING.md` - Full documentation
- `/lib/api-utils.ts` - Source code
- `/app/api/events/route.ts` - Example implementation
