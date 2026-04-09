import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

function createQuery(result: { data: unknown; error?: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: result.data,
    error: result.error ?? null,
  });
  query.then = undefined;
  query.catch = undefined;
  return query;
}

function makeAwaitableQuery(query: ReturnType<typeof createQuery>, result: { data: unknown; error?: unknown }) {
  query.then = (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve(resolve({ data: result.data, error: result.error ?? null }));
  query.catch = () => Promise.resolve();
  return query;
}

describe("getFestivalScreenings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when screening tables have no data for the festival", async () => {
    const emptyRunsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null })),
      catch: () => Promise.resolve(),
    };

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "screening_runs") return emptyRunsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { getFestivalScreenings } = await import("@/lib/festivals");
    const screenings = await getFestivalScreenings("atlanta-film-festival");

    expect(screenings).toBeNull();
  });
});
