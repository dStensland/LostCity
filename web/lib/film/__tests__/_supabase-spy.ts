// Shared test helper that creates a spy Supabase query builder.
// Captures all .eq(column, value) calls so regression tests can assert
// the filter column matches expectations (and does not drift back to
// places.portal_id, which silently returns an error at runtime).
//
// Not a true integration test — does not hit Supabase. Strict mock-level
// regression tool.

import { vi } from 'vitest';

export type EqCall = [column: string, value: unknown];

/**
 * Creates a minimal Supabase client spy.
 *
 * - `from('portals')` returns a builder whose `.maybeSingle()` resolves with
 *   `{ data: { id: 'portal-atlanta-uuid' }, error: null }` so `resolvePortalId`
 *   succeeds.
 * - All other `from(...)` calls return a builder that:
 *   - records every `.eq(column, value)` call in `eqCalls`
 *   - is thenable (`await builder` resolves to `{ data: rows, error: null }`)
 *
 * The `eqCalls` array is populated across ALL `from(...)` calls, so
 * regression assertions can check that the correct column name was used
 * in the main query.
 */
export function createSupabaseSpy(rows: unknown[] = []) {
  const eqCalls: EqCall[] = [];
  const finalResult = { data: rows, error: null };

  function makeBuilder(resolveValue: unknown) {
    const builder: Record<string, unknown> = {};

    const chainFns = ['select', 'gte', 'lte', 'order', 'limit', 'range'] as const;
    for (const fn of chainFns) {
      builder[fn] = vi.fn().mockReturnValue(builder);
    }

    builder.eq = vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    });

    builder.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'portal-atlanta-uuid' },
      error: null,
    });

    // Make the builder awaitable so `const { data, error } = await builder`
    // works. Using a proper thenable that returns a Promise.
    builder.then = function <T>(
      onFulfilled: (v: unknown) => T,
      onRejected?: (reason: unknown) => T,
    ): Promise<T> {
      return Promise.resolve(resolveValue).then(onFulfilled, onRejected);
    };

    return builder;
  }

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'portals') {
        // resolvePortalId: .eq('slug', ...).eq('status', 'active').maybeSingle()
        return makeBuilder({ data: { id: 'portal-atlanta-uuid' }, error: null });
      }
      // Main data query
      return makeBuilder(finalResult);
    }),
  };

  return { client, eqCalls };
}
