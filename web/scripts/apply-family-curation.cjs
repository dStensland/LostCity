/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Apply family source curation - removes non-family subscriptions
 *
 * Run with: node scripts/apply-family-curation.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('=== Apply Family Source Curation ===\n');

  // Read the removal list
  const removalFile = '/tmp/family-sources-to-remove.json';
  if (!fs.existsSync(removalFile)) {
    console.error('Removal file not found. Run curate-family-sources.cjs first.');
    return;
  }

  const subscriptionIds = JSON.parse(fs.readFileSync(removalFile, 'utf8'));
  console.log('Subscriptions to remove:', subscriptionIds.length);

  if (subscriptionIds.length === 0) {
    console.log('No subscriptions to remove.');
    return;
  }

  // Get Atlanta Families portal
  const { data: afPortal } = await supabase
    .from('portals')
    .select('id')
    .eq('slug', 'atlanta-families')
    .single();

  if (!afPortal) {
    console.error('Atlanta Families portal not found');
    return;
  }

  // Delete the subscriptions
  console.log('\nRemoving subscriptions...');
  const { error } = await supabase
    .from('source_subscriptions')
    .delete()
    .in('id', subscriptionIds)
    .eq('subscriber_portal_id', afPortal.id); // Safety check

  if (error) {
    console.error('Error removing subscriptions:', error.message);
    return;
  }

  console.log('✅ Removed', subscriptionIds.length, 'subscriptions');

  // Refresh materialized view
  console.log('\nRefreshing portal_source_access view...');
  const { error: refreshError } = await supabase.rpc('refresh_portal_source_access');

  if (refreshError) {
    console.log('Note: Could not auto-refresh view:', refreshError.message);
    console.log('Run manually: REFRESH MATERIALIZED VIEW portal_source_access;');
  } else {
    console.log('✅ View refreshed');
  }

  // Verify final state
  const { data: remaining } = await supabase
    .from('source_subscriptions')
    .select('id')
    .eq('subscriber_portal_id', afPortal.id)
    .eq('is_active', true);

  const { data: access } = await supabase
    .from('portal_source_access')
    .select('source_id')
    .eq('portal_id', afPortal.id);

  console.log('\n=== Final State ===');
  console.log('Active subscriptions:', remaining?.length || 0);
  console.log('Accessible sources:', access?.length || 0);
}

main().catch(console.error);
