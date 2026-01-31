# CLAUDE.md - Web Frontend

This file provides guidance to Claude Code when working with the Next.js frontend.

## Project Structure

```
web/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # Server-side API routes
│   ├── [portal]/          # Portal pages (atlanta, etc.)
│   └── auth/              # Authentication pages
├── components/            # React components
├── lib/                   # Shared utilities & hooks
│   ├── supabase/         # Supabase client helpers
│   └── hooks/            # Custom React hooks
└── public/               # Static assets
```

## Commands

```bash
npm run dev      # Development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

---

## Authentication & Database Access

### CRITICAL: Never Do Direct Supabase Mutations from Components

**The Problem:** Client-side Supabase calls are unreliable because:
- Browser cookies/sessions can get out of sync with Supabase auth
- RLS (Row Level Security) policies can fail silently or hang forever
- Missing user profiles cause foreign key constraint errors
- No centralized error handling

**The Solution:** All authenticated database mutations MUST go through API routes.

### Pattern: Use API Routes for All Mutations

```typescript
// ❌ BAD - Direct Supabase call from component (will hang or fail silently)
const { error } = await supabase.from("event_rsvps").insert({
  user_id: user.id,
  event_id: eventId,
  status: "going",
});

// ✅ GOOD - Use API route
const response = await fetch("/api/rsvp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ event_id: eventId, status: "going" }),
});
```

### Available API Routes for Authenticated Operations

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/profile` | GET, PATCH | Fetch/update user profile (auto-creates if missing) |
| `/api/rsvp` | GET, POST, DELETE | Event RSVP operations |
| `/api/saved` | GET, POST, DELETE | Save/unsave events and venues |

### Using the `useAuthenticatedFetch` Hook

For new authenticated features, use the provided hook:

```typescript
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";

function MyComponent() {
  const { authFetch, user, isLoading } = useAuthenticatedFetch();

  const handleAction = async () => {
    const { data, error } = await authFetch<{ success: boolean }>("/api/my-endpoint", {
      method: "POST",
      body: { foo: "bar" },
      timeout: 10000,        // Optional, default 10s
      showErrorToast: true,  // Optional, default true
    });

    if (error) {
      // Error already shown via toast
      return;
    }

    // Use data
  };
}
```

The hook provides:
- Automatic request timeouts (no more hanging forever)
- Redirects to login if unauthenticated
- Automatic error toasts
- Consistent error handling

### Creating New API Routes

When adding new authenticated features:

```typescript
// app/api/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  // 1. Verify auth using server client
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Use service client for database operations (bypasses RLS)
  const serviceClient = createServiceClient();

  // 3. Ensure profile exists before FK operations
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Create profile...
  }

  // 4. Perform database operation
  const { data, error } = await serviceClient
    .from("my_table")
    .insert({ user_id: user.id, ... } as never);

  // 5. Return response
  return NextResponse.json({ success: true, data });
}
```

### Why Service Client?

- `createClient()` - Server-side client with user's session, subject to RLS
- `createServiceClient()` - Admin client that bypasses RLS entirely

Use service client for mutations to avoid RLS policy issues. The auth is still verified via `createClient().auth.getUser()`.

---

## Profile Creation

User profiles are created automatically:
1. **Database trigger** (`076_profile_creation_trigger.sql`) creates profile on signup
2. **API fallback** (`/api/auth/profile`) creates profile if trigger failed
3. **Other API routes** create profile before FK operations as safety net

Never assume a profile exists - always check and create if needed.

---

## Common Gotchas

1. **TypeScript and Supabase**: Use `as never` for insert/update operations to bypass strict typing:
   ```typescript
   await serviceClient.from("table").insert({ ... } as never);
   ```

2. **Timeouts**: Always add timeouts to fetch calls to prevent infinite hangs:
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 8000);
   const response = await fetch(url, { signal: controller.signal });
   clearTimeout(timeoutId);
   ```

3. **Optimistic Updates**: Update UI immediately, rollback on error:
   ```typescript
   const previousState = currentState;
   setCurrentState(newState); // Optimistic
   try {
     await apiCall();
   } catch {
     setCurrentState(previousState); // Rollback
   }
   ```
