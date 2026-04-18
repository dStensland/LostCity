import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseSpy } from './_supabase-spy';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('loadThisWeek — portal scoping regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters via portal_id on screening_runs (not places.portal_id)', async () => {
    const { client, eqCalls } = createSupabaseSpy([]);

    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { loadThisWeek } = await import('../this-week-loader');

    await loadThisWeek({ portalSlug: 'atlanta' });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).toContain('portal_id');
    expect(columns).not.toContain('places.portal_id');
    expect(columns).not.toContain('screening_runs.places.portal_id');
  });
});
