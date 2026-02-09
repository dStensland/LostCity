# Image Proxy Optimization

## Problem

Every external image was going through a **double serverless function hop**:

1. `/api/image-proxy` (Node.js serverless function that buffers the entire image)
2. `/_next/image` (Next.js image optimization)

This caused:
- Increased latency (2 serverless cold starts instead of 1)
- Higher cost (2 function invocations per image)
- Unnecessary buffering in the proxy for images from trusted domains

Most images come from domains already listed in `next.config.ts` remotePatterns (Supabase storage, TMDB, Eventbrite, etc.), so the proxy was redundant for them.

## Solution

Modified `lib/image-proxy.ts` to bypass the proxy for known safe domains:

### Before
```
External Image → /api/image-proxy → /_next/image → Browser
```

### After (Known Hosts)
```
External Image (Supabase, TMDB, etc.) → /_next/image → Browser
```

### After (Unknown Hosts)
```
External Image (Random Domain) → /api/image-proxy → /_next/image → Browser
```

## Implementation

1. **Created `KNOWN_IMAGE_HOSTS` set** in `image-proxy.ts` containing all hostnames from `next.config.ts` remotePatterns
2. **Wildcard pattern support**:
   - `*.supabase.co` matches single-level subdomains (abc.supabase.co)
   - `**.squarespace.com` matches multi-level subdomains (foo.bar.squarespace.com)
3. **Modified `getProxiedImageSrc()`** to check if URL is a known host before proxying
4. **Kept SSRF protection** - unknown domains still go through the proxy

## Key Files

- `/Users/coach/Projects/LostCity/web/lib/image-proxy.ts` - Core logic
- `/Users/coach/Projects/LostCity/web/lib/__tests__/image-proxy.test.ts` - Unit tests
- `/Users/coach/Projects/LostCity/web/components/SmartImage.tsx` - Consumer (no changes needed)
- `/Users/coach/Projects/LostCity/web/app/api/image-proxy/route.ts` - Still used as fallback

## Known Safe Hosts

Images from these domains bypass the proxy:
- Supabase storage (*.supabase.co) - **Most common source**
- Event platforms (Eventbrite, Ticketmaster)
- Image CDNs (Unsplash, Cloudinary, Imgur)
- Media databases (TMDB, Wikipedia)
- Venue websites (Fox Theatre, Alliance Theatre, etc.)
- Squarespace (**.squarespace.com)

## Performance Impact

- **Supabase images** (majority of our images): 1 serverless function instead of 2
- **TMDB movie posters**: 1 serverless function instead of 2
- **Eventbrite images**: 1 serverless function instead of 2
- **Unknown domains**: No change (still protected by proxy)

## Security

- SSRF protection maintained for unknown domains
- Known hosts are explicitly listed and match Next.js remotePatterns
- No security downgrade - only performance optimization

## Testing

All tests pass:
```bash
npm test -- lib/__tests__/image-proxy.test.ts
```

Covers:
- Exact hostname matching
- Wildcard pattern matching (*.domain, **.domain)
- Unknown domain proxying
- Local path handling
- Invalid URL handling

## Maintenance

When adding new image hosts to `next.config.ts`, also add them to `KNOWN_IMAGE_HOSTS` in `image-proxy.ts` to get the performance benefit.
