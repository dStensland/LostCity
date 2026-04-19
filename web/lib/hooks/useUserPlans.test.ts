/**
 * useUserPlans — happy-path + error coverage for all 11 hooks.
 *
 * Pattern:
 *  - renderHook with QueryClientProvider wrapper
 *  - global fetch mocked via vi.stubGlobal
 *  - useAuth mocked to return a fake user
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const FAKE_USER = { id: "user-abc-123" };
const FAKE_PORTAL_ID = "portal-xyz-456";
const FAKE_PLAN_ID = "plan-111-222";
const FAKE_EVENT_ID = 42;
const FAKE_PLACE_ID = 99;

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(() => ({ user: FAKE_USER, session: null, profile: null })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe("useMyPlans", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches plans list (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch({ plans: [{ id: FAKE_PLAN_ID, status: "planning" }] }));

    const { useMyPlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useMyPlans(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plans).toHaveLength(1);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      "/api/plans?scope=mine&status=upcoming"
    );
  });

  it("surfaces error when fetch fails", async () => {
    vi.stubGlobal("fetch", makeFetch({ error: "Server error" }, 500));

    const { useMyPlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useMyPlans(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/500/);
  });

  it("is disabled when user is null", async () => {
    const { useAuth } = await import("@/lib/auth-context");
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);
    vi.stubGlobal("fetch", vi.fn());

    const { useMyPlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useMyPlans(), { wrapper: makeWrapper() });

    // Query should stay in pending/idle state — fetch must NOT be called
    expect(result.current.isFetching).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("usePlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches plan detail (happy path)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ plan: { id: FAKE_PLAN_ID }, anchor: {}, invitees: [] })
    );

    const { usePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => usePlan(FAKE_PLAN_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plan.id).toBe(FAKE_PLAN_ID);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      `/api/plans/${FAKE_PLAN_ID}`
    );
  });

  it("is disabled when id is null", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { usePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => usePlan(null), { wrapper: makeWrapper() });

    expect(result.current.isFetching).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("surfaces error when fetch fails", async () => {
    vi.stubGlobal("fetch", makeFetch({ error: "Not found" }, 404));

    const { usePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => usePlan(FAKE_PLAN_ID), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/404/);
  });
});

describe("useEventPlans", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns aggregate with going_count (happy path)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        plans: [
          { id: "p1", status: "planning" },
          { id: "p2", status: "active" },
        ],
      })
    );

    const { useEventPlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useEventPlans(FAKE_EVENT_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.going_count).toBe(2);
    expect(result.current.data?.friend_going_count).toBe(0);
  });

  it("is disabled when eventId is null", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { useEventPlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useEventPlans(null), { wrapper: makeWrapper() });

    expect(result.current.isFetching).toBe(false);
  });
});

describe("usePlacePlans", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns aggregate with active_count (happy path)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        plans: [
          { id: "p1", status: "active" },
          { id: "p2", status: "planning" },
          { id: "p3", status: "active" },
        ],
      })
    );

    const { usePlacePlans } = await import("./useUserPlans");
    const { result } = renderHook(() => usePlacePlans(FAKE_PLACE_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Only plans with status="active" are counted
    expect(result.current.data?.active_count).toBe(2);
    expect(result.current.data?.friends_here).toEqual([]);
  });

  it("is disabled when placeId is null", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { usePlacePlans } = await import("./useUserPlans");
    const { result } = renderHook(() => usePlacePlans(null), { wrapper: makeWrapper() });

    expect(result.current.isFetching).toBe(false);
  });
});

describe("useActivePlans", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches active plans (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch({ plans: [{ id: FAKE_PLAN_ID, status: "active" }] }));

    const { useActivePlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useActivePlans(FAKE_PORTAL_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plans).toHaveLength(1);
  });

  it("is disabled when portalId is null", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { useActivePlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useActivePlans(null), { wrapper: makeWrapper() });

    expect(result.current.isFetching).toBe(false);
  });

  it("is disabled when user is null", async () => {
    const { useAuth } = await import("@/lib/auth-context");
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);
    vi.stubGlobal("fetch", vi.fn());

    const { useActivePlans } = await import("./useUserPlans");
    const { result } = renderHook(() => useActivePlans(FAKE_PORTAL_ID), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe("useCreatePlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to /api/plans and returns plan id + share_token (happy path)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ plan: { id: FAKE_PLAN_ID, share_token: "tok_abc123" } }, 201)
    );

    const { useCreatePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useCreatePlan(), { wrapper: makeWrapper() });

    result.current.mutate({
      anchor_type: "event",
      anchor_id: FAKE_EVENT_ID,
      portal_id: FAKE_PORTAL_ID,
      starts_at: "2026-05-01T20:00:00Z",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.plan.id).toBe(FAKE_PLAN_ID);
    expect(result.current.data?.plan.share_token).toBe("tok_abc123");

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/plans");
    expect(call[1].method).toBe("POST");
  });

  it("surfaces error on non-ok response", async () => {
    vi.stubGlobal("fetch", makeFetch("Bad request", 400));

    const { useCreatePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useCreatePlan(), { wrapper: makeWrapper() });

    result.current.mutate({
      anchor_type: "event",
      anchor_id: FAKE_EVENT_ID,
      portal_id: FAKE_PORTAL_ID,
      starts_at: "2026-05-01T20:00:00Z",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdatePlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("PATCHes /api/plans/:id (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch(null, 204));

    const { useUpdatePlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useUpdatePlan(FAKE_PLAN_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ title: "Updated title" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`/api/plans/${FAKE_PLAN_ID}`);
    expect(call[1].method).toBe("PATCH");
  });
});

describe("useCancelPlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("DELETEs /api/plans/:id (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch(null, 204));

    const { useCancelPlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useCancelPlan(FAKE_PLAN_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`/api/plans/${FAKE_PLAN_ID}`);
    expect(call[1].method).toBe("DELETE");
  });
});

describe("useInviteToPlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to /api/plans/:id/invitees (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch(null, 201));

    const { useInviteToPlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useInviteToPlan(FAKE_PLAN_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ user_ids: ["user-a", "user-b"] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`/api/plans/${FAKE_PLAN_ID}/invitees`);
    expect(call[1].method).toBe("POST");
  });
});

describe("useRespondToPlan", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("PATCHes /api/plans/:id/invitees/me (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch(null, 200));

    const { useRespondToPlan } = await import("./useUserPlans");
    const { result } = renderHook(() => useRespondToPlan(FAKE_PLAN_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({ rsvp_status: "going" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`/api/plans/${FAKE_PLAN_ID}/invitees/me`);
    expect(call[1].method).toBe("PATCH");
    const body = JSON.parse(call[1].body as string);
    expect(body.rsvp_status).toBe("going");
  });
});

describe("useMarkPlanSeen", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("PATCHes /api/plans/:id/invitees/me/seen (happy path)", async () => {
    vi.stubGlobal("fetch", makeFetch(null, 200));

    const { useMarkPlanSeen } = await import("./useUserPlans");
    const { result } = renderHook(() => useMarkPlanSeen(FAKE_PLAN_ID), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain(`/api/plans/${FAKE_PLAN_ID}/invitees/me/seen`);
    expect(call[1].method).toBe("PATCH");
  });
});
