# CSP Hardening: Code Changes Summary

## Files Modified

### 1. `lib/csp.ts` - CSP Configuration

#### Change 1.1: Remove unsafe-inline by default (Lines 8-10)

**Before:**
```typescript
const allowInlineStyles = options.allowInlineStyles ?? true;
```

**After:**
```typescript
// Default to false in production for better security. Tailwind doesn't need unsafe-inline.
// Nonce-based styles (via ScopedStyles/ScopedStylesServer) work without unsafe-inline.
const allowInlineStyles = options.allowInlineStyles ?? false;
```

#### Change 1.2: Add nonce to style-src-elem (Lines 31-34)

**Before:**
```typescript
const styleSrcElemParts = ["'self'", "https://fonts.googleapis.com"];
```

**After:**
```typescript
// Add nonce to style-src-elem for <style> tags with nonces
const styleSrcElemParts = ["'self'", `'nonce-${nonce}'`, "https://fonts.googleapis.com"];
```

#### Change 1.3: Restrict img-src to specific domains (Lines 39-80)

**Before:**
```typescript
"img-src 'self' data: blob: https:"
```

**After:**
```typescript
const imgSrcParts = [
  "'self'",
  "data:",
  "blob:",
  // Supabase storage
  "https://*.supabase.co",
  // Event platforms
  "https://img.evbuc.com",
  "https://cdn.evbuc.com",
  "https://s1.ticketm.net",
  "https://s1.ticketmaster.com",
  // Image CDNs
  "https://images.unsplash.com",
  "https://res.cloudinary.com",
  "https://i.imgur.com",
  "https://static.imgix.net",
  "https://indy-systems.imgix.net",
  // Media databases
  "https://image.tmdb.org",
  "https://upload.wikimedia.org",
  "https://user-images.githubusercontent.com",
  // Venue sites
  "https://www.aso.org",
  "https://admin.paintingwithatwist.com",
  "https://14d14a1b70be1f7f7d4a-0863ae42a3340022d3e557e78745c047.ssl.cf5.rackcdn.com",
  "https://images.squarespace-cdn.com",
  "https://static1.squarespace.com",
  "https://*.squarespace.com",
  "https://www.foxtheatre.org",
  "https://www.dadsgaragetheatre.com",
  "https://alliancetheatre.org",
  "https://high.org",
  "https://atlantahistorycenter.com",
  "https://www.atlantabg.org",
  "https://centerstage.net",
  // Mapbox
  "https://*.tiles.mapbox.com",
  // Google Places photos
  "https://maps.googleapis.com",
  "https://lh3.googleusercontent.com",
];

// ... later in directives array:
`img-src ${imgSrcParts.join(" ")}`,
```

### 2. `lib/css-utils.ts` - CSS Sanitization

#### Change 2.1: Enhanced sanitizeCssColor with dangerous pattern blocking (Lines 1-30)

**Before:**
```typescript
export function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;
  if (/^var\(--[a-zA-Z0-9-_]+\)$/.test(value)) return value;
  if (/^(rgb|hsl)a?\(\s*[0-9.,\s%]+\s*\)$/.test(value)) return value;

  return null;
}
```

**After:**
```typescript
/**
 * Sanitize a CSS color value to prevent injection attacks.
 * Blocks dangerous CSS constructs like url(), @import, expression(), etc.
 * Only allows: hex colors, named colors, CSS variables, and rgb/hsl functions.
 */
export function sanitizeCssColor(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  // Block dangerous CSS constructs (case-insensitive)
  const dangerousPatterns = [
    /url\(/i,           // Can load external resources
    /@import/i,         // Can load external stylesheets
    /expression\(/i,    // IE-specific JavaScript execution
    /-moz-binding/i,    // Firefox XBL binding
    /behavior:/i,       // IE-specific behavior
    /javascript:/i,     // JavaScript protocol
    /vbscript:/i,       // VBScript protocol
    /<script/i,         // Script tag injection
    /on\w+=/i,          // Event handler attributes
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(value)) {
      console.warn(`[CSS Sanitization] Blocked dangerous CSS value: ${value}`);
      return null;
    }
  }

  // Allow only safe CSS color formats
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value;
  if (/^[a-zA-Z]{3,20}$/.test(value)) return value;
  if (/^var\(--[a-zA-Z0-9-_]+\)$/.test(value)) return value;
  if (/^(rgb|hsl)a?\(\s*[0-9.,\s%]+\s*\)$/.test(value)) return value;

  return null;
}
```

#### Change 2.2: Added comprehensive CSS string sanitization (Lines 90-145)

**New Function:**
```typescript
/**
 * Sanitize arbitrary CSS strings to prevent injection attacks.
 * This is a comprehensive filter that blocks all known dangerous CSS constructs.
 *
 * WARNING: This function strips dangerous content but does NOT guarantee the CSS
 * will be valid. Use this as a defense-in-depth layer when you must accept CSS
 * from untrusted sources (e.g., database content).
 *
 * RECOMMENDED: Always prefer constructing CSS server-side from validated,
 * type-safe values rather than accepting raw CSS strings from the database.
 *
 * @param css - Raw CSS string (potentially from database or user input)
 * @returns Sanitized CSS string with dangerous constructs removed, or null if empty
 */
export function sanitizeCssString(css: string): string | null {
  if (!css || typeof css !== "string") return null;

  // Remove dangerous CSS constructs that could execute code or load external resources
  let sanitized = css;

  // Remove url() - can load external resources or data URIs with scripts
  sanitized = sanitized.replace(/url\s*\([^)]*\)/gi, '');

  // Remove @import - loads external stylesheets
  sanitized = sanitized.replace(/@import[^;]+;/gi, '');

  // Remove expression() - IE-specific JS execution
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');

  // Remove -moz-binding - Firefox XBL binding (can execute JS)
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]+;/gi, '');

  // Remove behavior - IE-specific behavior property
  sanitized = sanitized.replace(/behavior\s*:[^;]+;/gi, '');

  // Remove javascript: and vbscript: protocols
  sanitized = sanitized.replace(/(javascript|vbscript)\s*:/gi, '');

  // Remove any embedded HTML/script tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Remove event handler attributes (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // If everything was stripped, return null
  const trimmed = sanitized.trim();
  return trimmed.length > 0 ? trimmed : null;
}
```

## No Changes Required

### `middleware.ts` - Already Correct

The middleware correctly uses the new default (`allowInlineStyles: false`) for production enforcement:

```typescript
const csp = buildCsp(nonce, { isDev }); // Uses default = false in prod
```

And keeps `unsafe-inline` enabled only for the Report-Only header (monitoring mode):

```typescript
const cspReportOnly = buildCsp(nonce, {
  isDev,
  allowInlineStyles: true, // Report-only for monitoring
  includeUpgradeInsecureRequests: false,
  reportUri: "/api/csp-report",
});
```

## Verification Commands

### Check for TypeScript errors
```bash
cd /Users/coach/Projects/LostCity/web
npx tsc --noEmit
```

### Check for ESLint issues
```bash
cd /Users/coach/Projects/LostCity/web
npm run lint
```

### Build the app
```bash
cd /Users/coach/Projects/LostCity/web
npm run build
```

### Test CSP headers locally
```bash
npm run dev
curl -I http://localhost:3000 | grep -i content-security-policy
```

## Rollback Instructions

If issues arise in production:

1. **Quick fix (temporary):** Change line 10 in `lib/csp.ts`:
   ```typescript
   const allowInlineStyles = options.allowInlineStyles ?? true; // Restore unsafe-inline
   ```

2. **Deploy and monitor:** Push the revert, verify CSP violations stop

3. **Root cause analysis:** Check browser console for specific components causing issues

4. **Targeted fix:** Update the problematic component to use nonces or construct CSS safely

## Expected Behavior

### Production CSP Headers (After Changes)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123' https://*.sentry.io https://*.supabase.co https://va.vercel-scripts.com https://sdk.canny.io; script-src-attr 'none'; style-src 'self' 'nonce-abc123' https://fonts.googleapis.com; style-src-elem 'self' 'nonce-abc123' https://fonts.googleapis.com; style-src-attr 'none'; img-src 'self' data: blob: https://*.supabase.co https://img.evbuc.com https://cdn.evbuc.com [... all other domains ...]; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://vitals.vercel-insights.com https://*.canny.io; frame-ancestors 'none'; frame-src https://*.canny.io; object-src 'none'; form-action 'self'; base-uri 'self'; worker-src 'self' blob:; upgrade-insecure-requests
```

**Key points:**
- ❌ No `'unsafe-inline'` in style-src
- ❌ No `'unsafe-inline'` in style-src-elem
- ✅ `'nonce-xxx'` present in both style-src and style-src-elem
- ✅ style-src-attr is `'none'`
- ✅ img-src uses explicit domain list (not `https:` wildcard)

### Report-Only CSP (Parallel Monitoring)

```
Content-Security-Policy-Report-Only: [same as above but with 'unsafe-inline' in style-src/style-src-elem and report-uri /api/csp-report]
```

This runs in parallel to catch any edge cases without breaking functionality.
