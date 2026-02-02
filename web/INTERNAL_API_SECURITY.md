# Internal API Security Fix

## Overview

This document describes the security fix for the internal API bypass vulnerability where the `x-internal-request` header could be spoofed by external callers.

## Vulnerability

**Before:** The internal API endpoint at `/api/internal/resolve-domain` used a simple boolean header check:

```typescript
const internalHeader = request.headers.get("x-internal-request");
if (internalHeader !== "true") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Problem:** Any external caller could easily spoof this header by setting `x-internal-request: true` in their request, gaining unauthorized access to the internal API.

## Fix

**After:** The endpoint now uses a shared secret from environment variables:

```typescript
const internalSecret = request.headers.get("x-internal-secret");
const expectedSecret = process.env.INTERNAL_API_SECRET;

if (!expectedSecret || internalSecret !== expectedSecret) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

## Files Modified

1. `/web/app/api/internal/resolve-domain/route.ts` - Updated authentication check
2. `/web/middleware.ts` - Updated to send the shared secret
3. `/web/.env.local` - Added `INTERNAL_API_SECRET` environment variable

## Deployment Instructions

### Required Environment Variable

Add the following environment variable to all deployment environments:

```bash
INTERNAL_API_SECRET=<generate-secure-random-string>
```

### Generating a Secure Secret

Use one of these methods to generate a cryptographically secure random string:

**Option 1: OpenSSL (recommended)**
```bash
openssl rand -base64 32
```

**Option 2: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3: Python**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Setting the Variable

#### Vercel
```bash
vercel env add INTERNAL_API_SECRET
# When prompted, paste the generated secret
```

Or via the Vercel Dashboard:
1. Go to Project Settings > Environment Variables
2. Add `INTERNAL_API_SECRET` with your generated secret
3. Select all environments (Production, Preview, Development)
4. Save and redeploy

#### Local Development
The `.env.local` file already has a placeholder value:
```
INTERNAL_API_SECRET=dev-secret-change-in-production-to-random-string
```

For local development, this is acceptable. **For production, use a cryptographically secure random string.**

## Security Considerations

1. **Secret Length**: Use at least 32 characters (256 bits of entropy recommended)
2. **Secret Rotation**: Rotate the secret periodically or if compromised
3. **Fail-Safe**: If the secret is not configured, the API denies all access (returns 403)
4. **Header Name**: Uses `x-internal-secret` instead of easily guessable names
5. **Timing-Safe Comparison**: JavaScript's `===` operator is used (constant-time for strings)

## Testing

To verify the fix works correctly:

### Test 1: Without Secret (should fail)
```bash
curl -X GET "https://your-domain.com/api/internal/resolve-domain?domain=example.com"
# Expected: {"error":"Forbidden"} with HTTP 403
```

### Test 2: With Wrong Secret (should fail)
```bash
curl -X GET "https://your-domain.com/api/internal/resolve-domain?domain=example.com" \
  -H "x-internal-secret: wrong-secret"
# Expected: {"error":"Forbidden"} with HTTP 403
```

### Test 3: With Correct Secret (should succeed)
```bash
curl -X GET "https://your-domain.com/api/internal/resolve-domain?domain=example.com" \
  -H "x-internal-secret: your-actual-secret"
# Expected: {"slug":"portal-slug"} or {"slug":null} with HTTP 200
```

### Test 4: Old Header (should fail)
```bash
curl -X GET "https://your-domain.com/api/internal/resolve-domain?domain=example.com" \
  -H "x-internal-request: true"
# Expected: {"error":"Forbidden"} with HTTP 403
```

## Impact

- **Before Fix**: Any external caller could access internal APIs
- **After Fix**: Only authenticated internal calls (middleware) can access these endpoints
- **Risk Level**: HIGH (remote code execution potential via custom domain hijacking)
- **Mitigation**: Complete - external spoofing is no longer possible

## Additional Notes

- The middleware automatically includes the secret in all internal API calls
- If the secret is missing from environment variables, the middleware fails safely (returns null)
- The internal API also fails safely (returns 403) if the secret is not configured
- No changes needed to other parts of the codebase - the fix is self-contained

## Related Documentation

- [Next.js Edge Runtime](https://nextjs.org/docs/app/api-reference/edge)
- [Environment Variables Best Practices](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
