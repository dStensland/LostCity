# Zod Validation Layer + PostHog Cloud Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Zod-based API route validation merged into `withAuth` middleware, and integrate PostHog Cloud for product analytics alongside existing custom tracking.

**Architecture:** Two independent workstreams. Workstream 1 extends existing `withAuth`/`withAuthAndParams` middleware with optional Zod schema slots (`body`, `query`, `params`). Workstream 2 adds PostHog JS + Node SDKs, wiring them into existing `trackPortalAction` and `usePortalTracking` emission points as a dual-write.

**Tech Stack:** Zod, posthog-js, posthog-node, Next.js 16, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-zod-posthog-integration-design.md`

---

## Workstream 1: Zod Validation Layer

### Task 1: Add Zod dependency and create shared schemas

**Files:**
- Modify: `web/package.json`
- Create: `web/lib/validation/schemas.ts`
- Create: `web/lib/validation/schemas.test.ts`

- [ ] **Step 1: Install zod**

```bash
cd web && npm install zod
```

- [ ] **Step 2: Write failing tests for shared schemas**

Create `web/lib/validation/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { paginationSchema, uuidSchema, portalSlugSchema, sortSchema } from "./schemas";

describe("paginationSchema", () => {
  it("applies defaults when no values provided", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it("accepts valid values", () => {
    const result = paginationSchema.parse({ limit: "50", offset: "10" });
    expect(result).toEqual({ limit: 50, offset: 10 });
  });

  it("caps limit at 100", () => {
    const result = paginationSchema.parse({ limit: "999" });
    expect(result.limit).toBe(100);
  });

  it("rejects negative offset", () => {
    expect(() => paginationSchema.parse({ offset: "-5" })).toThrow();
  });

  it("coerces string numbers from query params", () => {
    const result = paginationSchema.parse({ limit: "25", offset: "5" });
    expect(result).toEqual({ limit: 25, offset: 5 });
  });
});

describe("uuidSchema", () => {
  it("accepts valid UUIDs", () => {
    const result = uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000");
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid UUIDs", () => {
    expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    expect(() => uuidSchema.parse("")).toThrow();
  });
});

describe("portalSlugSchema", () => {
  it("lowercases and trims the slug", () => {
    expect(portalSlugSchema.parse("Atlanta")).toBe("atlanta");
    expect(portalSlugSchema.parse("  FORTH  ")).toBe("forth");
  });

  it("rejects empty strings", () => {
    expect(() => portalSlugSchema.parse("")).toThrow();
  });
});

describe("sortSchema", () => {
  it("accepts valid sort params", () => {
    const schema = sortSchema(["date", "name", "relevance"]);
    const result = schema.parse({ sort_by: "date", sort_order: "desc" });
    expect(result).toEqual({ sort_by: "date", sort_order: "desc" });
  });

  it("defaults sort_order to asc", () => {
    const schema = sortSchema(["date", "name"]);
    const result = schema.parse({ sort_by: "date" });
    expect(result).toEqual({ sort_by: "date", sort_order: "asc" });
  });

  it("rejects invalid sort_by values", () => {
    const schema = sortSchema(["date", "name"]);
    expect(() => schema.parse({ sort_by: "invalid" })).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd web && npx vitest run lib/validation/schemas.test.ts
```

Expected: FAIL — module `./schemas` not found.

- [ ] **Step 4: Implement shared schemas**

Create `web/lib/validation/schemas.ts`:

```typescript
import { z } from "zod";

/**
 * Pagination schema for GET routes. Coerces string query params to numbers.
 * Defaults: limit=20, offset=0. Max limit: 100.
 */
export const paginationSchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .pipe(z.number().int().min(1).max(100))
    .default(20),
  offset: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
    .pipe(z.number().int().min(0))
    .default(0),
});

/** UUID v4 string validation. */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID"
  );

/** Portal slug — lowercased, trimmed, non-empty. */
export const portalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Portal slug is required");

/**
 * Sort schema factory. Pass allowed sort_by values.
 * sort_order defaults to "asc".
 */
export function sortSchema<T extends string>(allowedFields: readonly [T, ...T[]]) {
  return z.object({
    sort_by: z.enum(allowedFields),
    sort_order: z.enum(["asc", "desc"]).default("asc"),
  });
}

/** Positive integer (for route params like event_id). Coerces strings. */
export const positiveIntSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "string" ? parseInt(v, 10) : v))
  .pipe(z.number().int().min(1, "Must be a positive integer"));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && npx vitest run lib/validation/schemas.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add lib/validation/schemas.ts lib/validation/schemas.test.ts package.json package-lock.json && git commit -m "feat: add zod dependency and shared validation schemas"
```

---

### Task 2: Extend `withAuth` with optional Zod validation

**Files:**
- Modify: `web/lib/api-middleware.ts`
- Create: `web/lib/api-middleware.test.ts`

- [ ] **Step 1: Write failing tests for validated withAuth**

Create `web/lib/api-middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock Supabase before importing the module
const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: { getUser: mockGetUser },
}));
const mockCreateServiceClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { withAuth, withValidation } from "./api-middleware";
import { NextRequest } from "next/server";

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown }
) {
  const req = new NextRequest(new URL(url, "http://localhost"), {
    method: options?.method ?? "GET",
    ...(options?.body
      ? {
          body: JSON.stringify(options.body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
  return req;
}

describe("withAuth with schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@test.com" } },
      error: null,
    });
  });

  it("passes typed body to handler when schema validates", async () => {
    const schema = z.object({
      event_id: z.number().int().positive(),
      status: z.enum(["going", "interested"]),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: 42, status: "going" },
    });

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-123" }),
        validated: expect.objectContaining({
          body: { event_id: 42, status: "going" },
        }),
      })
    );
  });

  it("returns 400 when body validation fails", async () => {
    const schema = z.object({
      event_id: z.number().int().positive(),
    });

    const handler = vi.fn();
    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: "not-a-number" },
    });

    const response = await route(req);
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 before validation when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    });

    const schema = z.object({ event_id: z.number() });
    const handler = vi.fn();
    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: "bad" },
    });

    const response = await route(req);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates query params for GET routes", async () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/test?limit=50&offset=10");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        validated: expect.objectContaining({
          query: { limit: 50, offset: 10 },
        }),
      })
    );
  });

  it("still works without schemas (backward compat)", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth(handler);
    const req = makeRequest("http://localhost/api/test");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-123" }),
      })
    );
  });
});

describe("withValidation (public routes)", () => {
  it("passes typed query to handler", async () => {
    const schema = z.object({
      q: z.string().min(1),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    const route = withValidation({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/search?q=pizza");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        validated: expect.objectContaining({ query: { q: "pizza" } }),
      })
    );
  });

  it("returns 400 for invalid query on public routes", async () => {
    const schema = z.object({
      q: z.string().min(1),
    });

    const handler = vi.fn();
    const route = withValidation({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/search?q=");

    const response = await route(req);
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run lib/api-middleware.test.ts
```

Expected: FAIL — `withValidation` not exported, `withAuth` doesn't accept schema argument.

- [ ] **Step 3: Implement the validated middleware**

Modify `web/lib/api-middleware.ts`. The key changes:

1. Add `withAuth` overloads — one that accepts schemas + handler, one that accepts just handler (backward compat)
2. Add `withValidation` for public routes
3. Add a shared `parseAndValidate` helper

Replace the full file content:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType, ZodError } from "zod";
import { validationError } from "@/lib/api-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

type ValidationSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InferValidated<S extends ValidationSchemas> = {
  [K in keyof S]: S[K] extends ZodType<infer T> ? T : never;
};

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

async function parseAndValidate(
  request: NextRequest,
  schemas: ValidationSchemas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ validated: Record<string, any> } | { error: NextResponse }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const validated: Record<string, any> = {};

  if (schemas.query) {
    const searchParams = new URL(request.url).searchParams;
    const queryObj: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryObj[key] = value;
    });
    const result = schemas.query.safeParse(queryObj);
    if (!result.success) {
      return { error: validationError(formatZodError(result.error)) };
    }
    validated.query = result.data;
  }

  if (schemas.body) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return { error: validationError("Invalid JSON body") };
    }
    const result = schemas.body.safeParse(body);
    if (!result.success) {
      return { error: validationError(formatZodError(result.error)) };
    }
    validated.body = result.data;
  }

  if (schemas.params) {
    // Params are passed separately via withAuthAndParams; this is a placeholder
    // for future use when params validation is needed inline.
  }

  return { validated };
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

type AuthContext = {
  user: User;
  serviceClient: AnySupabaseClient;
  supabase: AnySupabaseClient;
};

// ---------------------------------------------------------------------------
// withAuth — backward-compatible, with optional schemas
// ---------------------------------------------------------------------------

type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse | Response>;

type AuthenticatedHandlerWithValidation<S extends ValidationSchemas> = (
  request: NextRequest,
  context: AuthContext & { validated: InferValidated<S> }
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with authentication and optional Zod validation.
 *
 * @example
 * // Without validation (backward compatible)
 * export const POST = withAuth(async (request, { user, serviceClient }) => {
 *   const body = await request.json();
 *   return NextResponse.json({ success: true });
 * });
 *
 * @example
 * // With body validation
 * export const POST = withAuth({ body: rsvpSchema }, async (request, { user, serviceClient, validated }) => {
 *   const { event_id, status } = validated.body;
 *   return NextResponse.json({ success: true });
 * });
 *
 * @example
 * // With query validation
 * export const GET = withAuth({ query: paginationSchema }, async (request, { user, serviceClient, validated }) => {
 *   const { limit, offset } = validated.query;
 *   return NextResponse.json({ data: [] });
 * });
 */
export function withAuth<S extends ValidationSchemas>(
  schemas: S,
  handler: AuthenticatedHandlerWithValidation<S>
): (request: NextRequest) => Promise<NextResponse | Response>;
export function withAuth(
  handler: AuthenticatedHandler
): (request: NextRequest) => Promise<NextResponse | Response>;
export function withAuth<S extends ValidationSchemas>(
  schemasOrHandler: S | AuthenticatedHandler,
  maybeHandler?: AuthenticatedHandlerWithValidation<S>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    // Auth first — always before validation
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const authContext: AuthContext = { user, serviceClient, supabase };

    // No-schema overload
    if (typeof schemasOrHandler === "function") {
      return schemasOrHandler(request, authContext);
    }

    // Schema overload
    const schemas = schemasOrHandler;
    const handler = maybeHandler!;

    const result = await parseAndValidate(request, schemas);
    if ("error" in result) return result.error;

    return handler(request, {
      ...authContext,
      validated: result.validated as InferValidated<S>,
    });
  };
}

// ---------------------------------------------------------------------------
// withAuthAndParams — backward-compatible, no schema support yet
// ---------------------------------------------------------------------------

type AuthenticatedHandlerWithParams<T> = (
  request: NextRequest,
  context: AuthContext & { params: T }
) => Promise<NextResponse | Response>;

/**
 * Wrap an API route handler with authentication and dynamic params.
 * Automatically verifies the user, resolves params, and provides both
 * the user object and a service client for database operations.
 */
export function withAuthAndParams<T>(handler: AuthenticatedHandlerWithParams<T>) {
  return async (request: NextRequest, { params }: { params: Promise<T> }): Promise<NextResponse | Response> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();
    const resolvedParams = await params;

    return handler(request, { user, serviceClient, supabase, params: resolvedParams });
  };
}

// ---------------------------------------------------------------------------
// withOptionalAuth — unchanged
// ---------------------------------------------------------------------------

/**
 * Optional auth wrapper - returns user if authenticated, null otherwise.
 */
export function withOptionalAuth(
  handler: (
    request: NextRequest,
    context: {
      user: User | null;
      serviceClient: AnySupabaseClient | null;
      supabase: AnySupabaseClient;
    }
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    const serviceClient = !authError && user ? createServiceClient() : null;

    return handler(request, {
      user: authError || !user ? null : user,
      serviceClient,
      supabase,
    });
  };
}

// ---------------------------------------------------------------------------
// withValidation — for public (unauthenticated) routes
// ---------------------------------------------------------------------------

type PublicHandlerWithValidation<S extends ValidationSchemas> = (
  request: NextRequest,
  context: { validated: InferValidated<S> }
) => Promise<NextResponse | Response>;

/**
 * Validate request input without requiring authentication.
 * For public routes like search, listings, etc.
 *
 * @example
 * export const GET = withValidation({ query: searchSchema }, async (request, { validated }) => {
 *   const { q, limit } = validated.query;
 *   return NextResponse.json({ results: [] });
 * });
 */
export function withValidation<S extends ValidationSchemas>(
  schemas: S,
  handler: PublicHandlerWithValidation<S>
) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const result = await parseAndValidate(request, schemas);
    if ("error" in result) return result.error;

    return handler(request, {
      validated: result.validated as InferValidated<S>,
    });
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run lib/api-middleware.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Run existing tests to verify no regressions**

```bash
cd web && npx vitest run --reporter=verbose 2>&1 | tail -20
```

Expected: no failures in existing tests. The `withAuth` backward-compatible overload means all existing routes still work.

- [ ] **Step 6: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new type errors.

- [ ] **Step 7: Commit**

```bash
cd web && git add lib/api-middleware.ts lib/api-middleware.test.ts && git commit -m "feat: extend withAuth with optional Zod validation schemas"
```

---

### Task 3: Migrate one existing route as a reference example

**Files:**
- Modify: `web/app/api/rsvp/route.ts`

This serves as the canonical example for future route upgrades. The RSVP POST route currently does manual validation (lines 32-46 of the existing file). We'll replace it with Zod.

- [ ] **Step 1: Create the RSVP body schema**

Add to `web/lib/validation/schemas.ts`:

```typescript
/** RSVP creation schema. */
export const rsvpBodySchema = z.object({
  event_id: z.number().int().positive("Invalid event_id"),
  status: z.enum(["going", "interested", "went"], {
    errorMap: () => ({ message: "Invalid status. Must be: going, interested, or went" }),
  }),
  visibility: z
    .enum(["friends", "public", "private"], {
      errorMap: () => ({ message: "Invalid visibility. Must be: friends, public, or private" }),
    })
    .default("friends"),
  notify_friends: z.boolean().optional(),
});
```

- [ ] **Step 2: Update the RSVP POST handler to use validated schema**

Modify `web/app/api/rsvp/route.ts`. Replace the POST export:

```typescript
import { rsvpBodySchema } from "@/lib/validation/schemas";

// ... keep existing imports ...

/**
 * POST /api/rsvp
 * Create or update an RSVP
 */
export const POST = withAuth(
  { body: rsvpBodySchema },
  async (request, { user, serviceClient, validated }) => {
    // Check body size (10KB limit)
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    // Apply rate limiting
    const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
    if (rateLimitResult) return rateLimitResult;

    try {
      const { event_id, status, visibility, notify_friends } = validated.body;

      // Ensure user has a profile (create if missing)
      await ensureUserProfile(user, serviceClient);

      const attribution = await resolvePortalAttributionForWrite(request, {
        endpoint: "/api/rsvp",
        body: validated.body,
        requireWhenHinted: true,
      });
      if (attribution.response) return attribution.response;
      const portalId = attribution.portalId;
      const engagementContext = await resolveSessionEngagementContext(serviceClient, event_id);

      // Upsert the RSVP
      const { data, error } = await serviceClient
        .from("event_rsvps")
        .upsert(
          {
            user_id: user.id,
            event_id,
            status,
            visibility,
            engagement_target: engagementContext.engagement_target,
            festival_id: engagementContext.festival_id,
            program_id: engagementContext.program_id,
            updated_at: new Date().toISOString(),
            ...(portalId ? { portal_id: portalId } : {}),
          } as never,
          { onConflict: "user_id,event_id" }
        )
        .select()
        .single();

      if (error) {
        logger.error("RSVP upsert error", error, { userId: user.id, eventId: event_id, component: "rsvp" });
        return NextResponse.json(
          { error: "Failed to save RSVP" },
          { status: 500 }
        );
      }

      // Schedule async notification fan-out AFTER the response is sent.
      if (notify_friends && status === "going") {
        after(() =>
          notifyFriendsOfJoining(user.id, event_id, serviceClient).catch((err) => {
            logger.error("Friend notification failed", err, { userId: user.id, eventId: event_id, component: "rsvp" });
          })
        );
      }

      return NextResponse.json({ success: true, rsvp: data });
    } catch (error) {
      logger.error("RSVP API error", error, { userId: user.id, component: "rsvp" });
      return NextResponse.json(
        { error: "Failed to save RSVP" },
        { status: 500 }
      );
    }
  }
);
```

Note: The GET and DELETE handlers stay unchanged — they'll be migrated when touched for other reasons.

- [ ] **Step 3: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
cd web && npx vitest run lib/validation/schemas.test.ts lib/api-middleware.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
cd web && git add lib/validation/schemas.ts app/api/rsvp/route.ts && git commit -m "feat: migrate RSVP POST to Zod validation as reference example"
```

---

## Workstream 2: PostHog Cloud Integration

### Task 4: Add PostHog dependencies and server-side client

**Files:**
- Modify: `web/package.json`
- Create: `web/lib/analytics/posthog-server.ts`
- Create: `web/lib/analytics/posthog-server.test.ts`

- [ ] **Step 1: Install PostHog SDKs**

```bash
cd web && npm install posthog-js posthog-node
```

- [ ] **Step 2: Write failing test for server-side PostHog client**

Create `web/lib/analytics/posthog-server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("posthog-server", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null client when API key is not set", async () => {
    delete process.env.POSTHOG_API_KEY;
    const { getPostHogServer } = await import("./posthog-server");
    expect(getPostHogServer()).toBeNull();
  });

  it("returns a client when API key is set", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";
    const { getPostHogServer } = await import("./posthog-server");
    const client = getPostHogServer();
    expect(client).not.toBeNull();
  });

  it("returns the same instance on repeated calls", async () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const { getPostHogServer } = await import("./posthog-server");
    const a = getPostHogServer();
    const b = getPostHogServer();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd web && npx vitest run lib/analytics/posthog-server.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement server-side PostHog client**

Create `web/lib/analytics/posthog-server.ts`:

```typescript
import { PostHog } from "posthog-node";

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let _client: PostHog | null | undefined;

/**
 * Lazy-initialized PostHog server client.
 * Returns null when POSTHOG_API_KEY is not configured (safe for dev/test).
 */
export function getPostHogServer(): PostHog | null {
  if (_client !== undefined) return _client;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    _client = null;
    return null;
  }

  _client = new PostHog(apiKey, {
    host: POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10000,
  });

  return _client;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && npx vitest run lib/analytics/posthog-server.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd web && git add lib/analytics/posthog-server.ts lib/analytics/posthog-server.test.ts package.json package-lock.json && git commit -m "feat: add PostHog dependencies and server-side client"
```

---

### Task 5: Add PostHog client-side provider

**Files:**
- Create: `web/lib/analytics/PostHogProvider.tsx`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Create the PostHog provider component**

Create `web/lib/analytics/PostHogProvider.tsx`:

```tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

let initialized = false;

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || initialized) return;

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false, // We handle this manually via PostHogPageView
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      // Privacy: opt out by default, opt in after consent
      opt_out_capturing_by_default: true,
      // Session replay config — gated by opt-in
      enable_recording_console_log: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-no-capture]",
      },
    });
    initialized = true;
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
```

- [ ] **Step 2: Add PostHogProvider to root layout**

Modify `web/app/layout.tsx`. Add the import:

```typescript
import PostHogProvider from "@/lib/analytics/PostHogProvider";
```

Wrap children inside `<AuthProvider>`:

```tsx
<AuthProvider>
  <DarkHoursTheme />
  <PostHogProvider>
    <ToastProvider>{children}</ToastProvider>
  </PostHogProvider>
</AuthProvider>
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: clean build. PostHog types should resolve from the installed packages.

- [ ] **Step 4: Commit**

```bash
cd web && git add lib/analytics/PostHogProvider.tsx app/layout.tsx && git commit -m "feat: add PostHog client provider with opt-out-by-default privacy"
```

---

### Task 6: Dual-write in trackPortalAction

**Files:**
- Modify: `web/lib/analytics/portal-action-tracker.ts`
- Modify: `web/lib/analytics/portal-action-tracker.test.ts` (if it exists; create if not)

- [ ] **Step 1: Add PostHog capture to trackPortalAction**

Modify `web/lib/analytics/portal-action-tracker.ts`. Add PostHog import and capture call after the existing sendBeacon/fetch logic:

```typescript
"use client";

import posthog from "posthog-js";
import type { PortalInteractionActionType } from "@/lib/analytics/portal-action-types";

export type PortalActionType = PortalInteractionActionType;

export type PortalActionPayload = {
  action_type: PortalActionType;
  page_type?: "feed" | "find" | "community";
  section_key?: string;
  target_kind?: string;
  target_id?: string;
  target_label?: string;
  target_url?: string;
  metadata?: Record<string, unknown>;
};

const endpointFor = (portalSlug: string) => `/api/portals/${portalSlug}/track/action`;

function toSafeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function trackPortalAction(portalSlug: string, payload: PortalActionPayload) {
  if (typeof window === "undefined") return;
  if (!portalSlug) return;

  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get("utm_source");
  const utmMedium = searchParams.get("utm_medium");
  const utmCampaign = searchParams.get("utm_campaign");

  const body = {
    ...payload,
    page_type: payload.page_type || "feed",
    referrer: document.referrer || undefined,
    utm_source: utmSource || undefined,
    utm_medium: utmMedium || undefined,
    utm_campaign: utmCampaign || undefined,
    target_label: toSafeString(payload.target_label, 180),
    target_url: toSafeString(payload.target_url, 700),
    metadata: {
      ...(payload.metadata || {}),
      path: window.location.pathname,
      query: window.location.search || undefined,
    },
  };

  const bodyJson = JSON.stringify(body);
  const endpoint = endpointFor(portalSlug);

  // Existing beacon/fetch to internal tracking
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([bodyJson], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    }
  } catch {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyJson,
      keepalive: true,
    }).catch(() => {});
  }

  // Dual-write to PostHog (no-op when opted out or SDK not initialized)
  try {
    posthog.capture(`portal_${payload.action_type}`, {
      portal: portalSlug,
      page_type: body.page_type,
      section_key: payload.section_key,
      target_kind: payload.target_kind,
      target_id: payload.target_id,
    });
  } catch {
    // PostHog not initialized or opted out — silently skip.
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd web && git add lib/analytics/portal-action-tracker.ts && git commit -m "feat: dual-write portal actions to PostHog"
```

---

### Task 7: Add PostHog env vars to .env.local template and documentation

**Files:**
- Modify: `web/.env.local.example` (or `.env.example`, whichever exists)

- [ ] **Step 1: Check which env file exists**

```bash
ls web/.env*.example web/.env.local.example 2>/dev/null || echo "No .env example file found"
```

- [ ] **Step 2: Add PostHog env vars**

Add the following lines to the env example file (or create `.env.local.example` if none exists):

```bash
# PostHog Analytics (optional — analytics disabled when not set)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=
```

- [ ] **Step 3: Commit**

```bash
cd web && git add .env*.example && git commit -m "docs: add PostHog env vars to env template"
```

---

### Task 8: Final integration verification

- [ ] **Step 1: Run full test suite**

```bash
cd web && npx vitest run 2>&1 | tail -30
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Run TypeScript check**

```bash
cd web && npx tsc --noEmit
```

Expected: clean build, zero errors.

- [ ] **Step 3: Run lint**

```bash
cd web && npm run lint 2>&1 | tail -20
```

Expected: no new lint errors.

- [ ] **Step 4: Verify dev server starts**

```bash
cd web && timeout 15 npm run dev 2>&1 | tail -10 || true
```

Expected: server starts on localhost:3000 without errors. PostHog should log a warning about missing API key (expected in dev without env vars configured).

- [ ] **Step 5: Final commit if any cleanup was needed**

If any fixes were needed, commit them:

```bash
cd web && git add -A && git commit -m "fix: address integration issues from final verification"
```
