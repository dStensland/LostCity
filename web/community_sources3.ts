import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtppvljfrkjtoxmaizea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0MzMxNCwiZXhwIjoyMDgzNzE5MzE0fQ.9Z0uJrvjKg6yFjAEq8fedgFEp8s_GPXKsBzZaRliE5M';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const ATLANTA_ID = '74c2f211-ee11-453d-8386-ac2861705695';
const FAMILIES_ID = '840edaab-ab97-4f15-9dca-fe8dd2101ec3';

async function main() {
  // 1. Get source breakdown for Atlanta community events
  const { data: communityEvents } = await supabase
    .from('events')
    .select('source_id')
    .eq('category_id', 'community')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true);

  const sourceCounts: Record<number, number> = {};
  for (const e of (communityEvents || [])) {
    sourceCounts[e.source_id] = (sourceCounts[e.source_id] || 0) + 1;
  }
  
  const topSourceIds = Object.entries(sourceCounts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 25)
    .map(([id]) => Number(id));

  // Fetch source details
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name, slug, category, owner_portal_id, is_active')
    .in('id', topSourceIds);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceMap: Record<number, any> = {};
  for (const s of (sources || [])) sourceMap[s.id] = s;
  
  console.log('=== TOP SOURCES PRODUCING COMMUNITY EVENTS (Atlanta portal, active) ===');
  const sorted = Object.entries(sourceCounts).sort(([,a],[,b]) => b - a).slice(0, 25);
  for (const [sid, count] of sorted) {
    const s = sourceMap[Number(sid)];
    const name = s?.name || `?`;
    const slug = s?.slug || sid;
    const cat = s?.category || '?';
    const owner = s?.owner_portal_id ? s.owner_portal_id.slice(0, 8) : 'none';
    console.log(`  ${count.toString().padStart(5)} | [${cat.padEnd(12)}] ${name} (${slug}) [owner:${owner}]`);
  }

  // 2. Total count check
  console.log('\n=== COMMUNITY COUNT BREAKDOWN ===');
  console.log('Total active community (Atlanta portal):', communityEvents?.length);

  // Feed-ready
  const { data: feedReady } = await supabase
    .from('events')
    .select('source_id', { count: 'exact' })
    .eq('category_id', 'community')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true)
    .eq('is_feed_ready', true);
  console.log('Feed-ready:', feedReady?.length);
  
  const now = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from('events')
    .select('id', { count: 'exact' })
    .eq('category_id', 'community')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true)
    .gte('start_date', now);
  console.log('Upcoming (active):', upcoming?.length);

  // 3. Get ALL categories breakdown for Atlanta (active, is_feed_ready)
  console.log('\n=== CATEGORY BREAKDOWN - ATLANTA PORTAL (active, feed_ready) ===');
  const { data: allFeedReady } = await supabase
    .from('events')
    .select('category_id')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true)
    .eq('is_feed_ready', true);

  const catCounts: Record<string, number> = {};
  for (const e of (allFeedReady || [])) {
    const cat = e.category_id || 'null';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const totalFR = Object.values(catCounts).reduce((a,b) => a+b, 0);
  for (const [cat, count] of Object.entries(catCounts).sort(([,a],[,b]) => b - a)) {
    const pct = ((count / totalFR) * 100).toFixed(1);
    console.log(`  ${count.toString().padStart(5)} (${pct.padStart(4)}%) | ${cat}`);
  }
  console.log(`  TOTAL feed_ready: ${totalFR}`);

  // 4. Family portal - check sources and if any leak
  console.log('\n=== FAMILY PORTAL SOURCES ===');
  const { data: famSources } = await supabase
    .from('sources')
    .select('id, name, slug, owner_portal_id, is_active')
    .eq('owner_portal_id', FAMILIES_ID);
  console.log(`Sources owned by Families portal: ${famSources?.length || 0}`);
  
  // Check if any family-owned sources have portal_id=ATLANTA events
  if (famSources && famSources.length > 0) {
    const famSourceIds = famSources.map(s => s.id);
    const { data: leakEvents } = await supabase
      .from('events')
      .select('source_id, category_id, title')
      .eq('portal_id', ATLANTA_ID)
      .in('source_id', famSourceIds)
      .eq('is_active', true)
      .limit(20);
    console.log(`Events from Families-owned sources in Atlanta portal: ${leakEvents?.length || 0}`);
    if (leakEvents && leakEvents.length > 0) {
      for (const e of leakEvents.slice(0, 10)) {
        console.log(`  LEAK: src=${e.source_id} cat=${e.category_id} | ${e.title?.slice(0, 60)}`);
      }
    }
  }

  // 5. Sample community events with source names - show variety
  console.log('\n=== COMMUNITY CATEGORY CONTENT AUDIT - Are these real community events? ===');
  const { data: sampleEvents } = await supabase
    .from('events')
    .select('id, title, tags, source_id, start_date')
    .eq('category_id', 'community')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true)
    .eq('is_feed_ready', true)
    .gte('start_date', now)
    .order('source_id')
    .limit(60);

  // Group by source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bySource: Record<number, any[]> = {};
  for (const e of (sampleEvents || [])) {
    if (!bySource[e.source_id]) bySource[e.source_id] = [];
    bySource[e.source_id].push(e);
  }
  
  // Show 2-3 events per source to characterize what each source is producing
  for (const [sid, events] of Object.entries(bySource).slice(0, 15)) {
    const s = sourceMap[Number(sid)];
    const sname = s ? `${s.name} [cat:${s.category}]` : `source_id=${sid}`;
    console.log(`\n  SOURCE ${sid}: ${sname}`);
    for (const e of events.slice(0, 3)) {
      console.log(`    [${e.start_date}] ${e.title?.slice(0, 65)}`);
      console.log(`      tags: ${(e.tags||[]).slice(0,4).join(', ')}`);
    }
  }

  // 6. Roswell - a clear example of leaking family/learning content tagged community
  console.log('\n=== ROSWELL-TAGGED COMMUNITY EVENTS (potential family/learning miscategorization) ===');
  const { data: roswellEvents } = await supabase
    .from('events')
    .select('id, title, category_id, source_id, tags, start_date')
    .eq('portal_id', ATLANTA_ID)
    .eq('is_active', true)
    .contains('tags', ['roswell'])
    .order('start_date')
    .limit(10);
  for (const e of (roswellEvents || [])) {
    const s = sourceMap[e.source_id];
    console.log(`  [${e.category_id}] [src:${e.source_id}/${s?.slug||'?'}] ${e.title?.slice(0,60)}`);
  }

  // 7. Source 1067 deep-dive - big community producer with roswell tags
  console.log('\n=== SOURCE 1067 DEEP-DIVE ===');
  const { data: src1067 } = await supabase
    .from('sources')
    .select('id, name, slug, category, owner_portal_id, is_active, url')
    .eq('id', 1067)
    .single();
  console.log('Source 1067:', JSON.stringify(src1067, null, 2));

  // 8. Sources with most community events - full lookup
  console.log('\n=== SOURCE LOOKUP FOR TOP COMMUNITY PRODUCERS ===');
  const topIds = sorted.slice(0, 15).map(([id]) => Number(id));
  const { data: topSourcesData } = await supabase
    .from('sources')
    .select('id, name, slug, category, owner_portal_id, is_active, url')
    .in('id', topIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topSourceMap: Record<number, any> = {};
  for (const s of (topSourcesData || [])) topSourceMap[s.id] = s;
  
  console.log('Top 15 community producers with full details:');
  for (const [sid, count] of sorted.slice(0, 15)) {
    const s = topSourceMap[Number(sid)];
    if (s) {
      console.log(`  ${count.toString().padStart(5)} | source ${sid}: ${s.name}`);
      console.log(`           slug=${s.slug} category=${s.category} owner=${s.owner_portal_id?.slice(0,8)||'none'} active=${s.is_active}`);
      if (s.url) console.log(`           url=${s.url.slice(0, 80)}`);
    } else {
      console.log(`  ${count.toString().padStart(5)} | source ${sid}: [NOT FOUND IN SOURCES TABLE]`);
    }
  }
}

main().catch(console.error);
