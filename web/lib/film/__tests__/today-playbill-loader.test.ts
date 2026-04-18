import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseSpy } from './_supabase-spy';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('loadTodayPlaybill — portal scoping regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters via screening_runs.portal_id (not places.portal_id)', async () => {
    const { client, eqCalls } = createSupabaseSpy([]);

    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue(client as never);

    const { loadTodayPlaybill } = await import('../today-playbill-loader');

    await loadTodayPlaybill({ portalSlug: 'atlanta', date: '2026-04-18' });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).toContain('screening_runs.portal_id');
    expect(columns).not.toContain('places.portal_id');
    expect(columns).not.toContain('screening_runs.places.portal_id');
  });
});
