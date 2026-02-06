/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Subscribe Atlanta Families portal to Atlanta's shared sources
 *
 * Run with: node scripts/subscribe-atlanta-families.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('=== Subscribe Atlanta Families to Shared Sources ===\n');

  // 1. Get Atlanta Families portal
  const { data: afPortal, error: afError } = await supabase
    .from('portals')
    .select('id, slug, name')
    .eq('slug', 'atlanta-families')
    .single();

  if (afError || !afPortal) {
    console.error('Error finding Atlanta Families portal:', afError?.message || 'Not found');
    return;
  }
  console.log('Atlanta Families portal:', afPortal.id);

  // 2. Get Atlanta portal
  const { data: atlPortal, error: atlError } = await supabase
    .from('portals')
    .select('id, slug, name')
    .eq('slug', 'atlanta')
    .single();

  if (atlError || !atlPortal) {
    console.error('Error finding Atlanta portal:', atlError?.message || 'Not found');
    return;
  }
  console.log('Atlanta portal:', atlPortal.id);

  // 3. Get all shared sources from Atlanta (share_scope = 'all')
  const { data: sharedSources, error: ssError } = await supabase
    .from('source_sharing_rules')
    .select('source_id')
    .eq('owner_portal_id', atlPortal.id)
    .eq('share_scope', 'all');

  if (ssError) {
    console.error('Error fetching shared sources:', ssError.message);
    return;
  }

  console.log('\nShared sources from Atlanta:', sharedSources?.length || 0);

  if (!sharedSources || sharedSources.length === 0) {
    console.log('No shared sources to subscribe to.');
    return;
  }

  // 4. Check existing subscriptions
  const { data: existingSubs } = await supabase
    .from('source_subscriptions')
    .select('source_id')
    .eq('subscriber_portal_id', afPortal.id);

  const existingSourceIds = new Set((existingSubs || []).map(s => s.source_id));
  console.log('Existing subscriptions:', existingSourceIds.size);

  // 5. Create subscriptions for sources not already subscribed
  const newSubs = sharedSources
    .filter(s => !existingSourceIds.has(s.source_id))
    .map(s => ({
      subscriber_portal_id: afPortal.id,
      source_id: s.source_id,
      subscription_scope: 'all',
      is_active: true
    }));

  console.log('New subscriptions to create:', newSubs.length);

  if (newSubs.length > 0) {
    const { error: insertError } = await supabase
      .from('source_subscriptions')
      .insert(newSubs);

    if (insertError) {
      console.error('Error creating subscriptions:', insertError.message);
      return;
    }

    console.log('\n✅ Created', newSubs.length, 'subscriptions');

    // 6. Refresh the materialized view
    console.log('\nRefreshing portal_source_access view...');
    const { error: refreshError } = await supabase.rpc('refresh_portal_source_access');

    if (refreshError) {
      console.log('Note: Could not auto-refresh view:', refreshError.message);
      console.log('Run manually: REFRESH MATERIALIZED VIEW portal_source_access;');
    } else {
      console.log('✅ View refreshed');
    }
  }

  // 7. Verify access
  const { data: finalAccess } = await supabase
    .from('portal_source_access')
    .select('source_id, source_name, access_type')
    .eq('portal_id', afPortal.id);

  console.log('\n=== Final Source Access ===');
  console.log('Total sources accessible:', finalAccess?.length || 0);
  if (finalAccess && finalAccess.length > 0) {
    finalAccess.slice(0, 5).forEach(a => {
      console.log('  -', a.source_name, '(' + a.access_type + ')');
    });
    if (finalAccess.length > 5) {
      console.log('  ... and', finalAccess.length - 5, 'more');
    }
  }
}

main().catch(console.error);
