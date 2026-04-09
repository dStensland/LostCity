# Zod Validation Layer + PostHog Cloud Integration

**Date:** 2026-04-09
**Status:** Approved
**Workstreams:** 2 (independent, parallelizable)

---

## Workstream 1: Zod Validation Layer

### Problem

323 API routes with scattered validation. Manual `as { field: Type }` casts on request bodies (~100+ routes), inconsistent parsing (mix of `parseIntParam()`, raw `parseInt()`, inline regex), UUID validation exists but only 4 routes use it, and error responses use three different patterns.

### Design

**Dependency:** `zod` added to `web/package.json`.

**Shared schemas** in `web/lib/validation/schemas.ts`:

- `paginationSchema` — `{ limit?: number, offset?: number }` with sensible defaults and max caps
- `uuidParamSchema` — validated UUID string
- `portalSlugSchema` — normalized, lowercased string
- `sortSchema` — reusable `sort_by` + `sort_order` pattern

**Merged into `withAuth`** in `web/lib/api-middleware.ts`:

`withAuth` gains an optional first argument: an object with named schema slots `{ params?, query?, body? }`. Each slot accepts a Zod schema. On validation failure, returns `validationError()` with formatted Zod errors. On success, passes typed data to handler.

```ts
// Authenticated route with body validation
export const POST = withAuth({ body: createRsvpSchema }, async (ctx, { body }) => {
  // body is typed from z.infer<typeof createRsvpSchema>
});

// Authenticated route with query + params
export const GET = withAuth({ query: paginationSchema, params: uuidParamSchema }, async (ctx, { query, params }) => {
  // both typed
});

// Auth-only, no validation (backwards compatible)
export const POST = withAuth(async (ctx) => {
  // existing pattern still works
});
```

**Standalone `withValidation`** for public (unauthenticated) routes:

```ts
export const GET = withValidation({ query: searchSchema }, async (req, { query }) => {
  // no auth needed
});
```

**Migration strategy:** No batch migration. New routes use the schema pattern. Existing routes upgraded when touched for other reasons. When upgrading a route, remove any `as { field: Type }` casts on request bodies — they must not survive alongside Zod schemas.

### Architecture decisions

- **Auth runs before validation** on authenticated routes. This prevents unauthenticated users from probing schema shapes via validation error messages.
- **No HTTP method sniffing.** The wrapper does not auto-detect GET vs POST. Named slots (`params`, `query`, `body`) are explicit — the route author decides what to validate.
- **Composable, not combinatorial.** Schema validation is absorbed into `withAuth` as an optional parameter rather than creating a separate `withValidation` wrapper for authenticated routes. This avoids wrapper explosion (`withAuthAndValidation`, `withAuthAndParamsAndValidation`, etc.).

---

## Workstream 2: PostHog Cloud Integration

### Problem

Existing analytics captures raw events (page views, 3 action types, weighted signals) but provides no analysis layer. Cannot answer: which explore tracks drive saves, where users drop off in funnels, which portals have highest engagement, or how signed-in users differ from anonymous.

### Design

**Dependencies:** `posthog-js` (client), `posthog-node` (server).

**Environment variables:**

- `NEXT_PUBLIC_POSTHOG_KEY` — public project API key (client-safe, designed for exposure)
- `POSTHOG_API_KEY` — server-only personal API key (never bundled)
- `NEXT_PUBLIC_POSTHOG_HOST` — defaults to `https://us.i.posthog.com`

**Client-side provider:**

New `PostHogProvider` wrapping the app in root layout (`web/app/layout.tsx` or a shared providers file). Configuration:

- `opt_out_capturing()` on initialization — only activates after cookie consent (`opt_in_capturing()`)
- `maskAllInputs: true` — prevents form input capture in session replay
- `maskTextContent: true` — prevents PII text capture
- Autocapture enabled (clicks, page views)
- Session replay gated by consent
- No `posthog.identify()` — stays fully anonymous. If authenticated funnels are needed later, use an opaque hash of user ID, never raw Supabase auth UUID or email.

**Dual-write at existing emission points:**

- `trackPortalAction()` in `web/lib/analytics/portal-action-tracker.ts` — alongside the existing `sendBeacon` call, also fires `posthog.capture()` with the same event name and properties
- `usePortalTracking` hook — fires a PostHog page view event alongside the existing beacon to `/api/portals/[slug]/track`
- Signal tracking (`/api/signals/track`) stays untouched — it feeds FORTH scoring and preference inference, which is application logic, not analytics

**Server-side:**

`posthog-node` client initialized once in a shared module (`web/lib/analytics/posthog-server.ts`). Used in existing track API routes as a fallback for client-side ad-blockers that strip PostHog JS.

**Privacy and compliance:**

- `data-ph-no-capture` attribute on components rendering user PII (profile pages, settings)
- No raw user IDs or emails sent to PostHog
- PostHog added to privacy policy
- Cookie consent banner gates PostHog initialization (do not load SDK until consent granted)
- Data processing agreement with PostHog (available in dashboard)

### What this unlocks

- **Funnels:** feed -> filter -> detail -> action conversion
- **Session replay:** see how people actually navigate (with masking)
- **Retention cohorts:** who comes back, from which portal
- **Feature usage:** which of 43 portal routes get meaningful traffic
- **No migration required:** existing `portal_page_views` and `portal_interaction_events` tables continue operating independently

---

## Non-goals

- No batch migration of existing 323 API routes to Zod
- No `posthog.identify()` or user-level tracking
- No self-hosted PostHog
- No removal of existing custom analytics tables
- No cookie consent banner implementation (prerequisite, not in scope). PostHog initializes in opt-out mode by default — zero data captured until a consent system calls `opt_in_capturing()`. Session replay and event capture are inert until then.
