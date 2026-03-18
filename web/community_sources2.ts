import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtppvljfrkjtoxmaizea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0MzMxNCwiZXhwIjoyMDgzNzE5MzE0fQ.9Z0uJrvjKg6yFjAEq8fedgFEp8s_GPXKsBzZaRliE5M';

const ATLANTA_ID = '74c2f211-ee11-453d-8386-ac2861705695';
const FAMILIES_ID = '840edaab-ab97-4f15-9dca-fe8dd2101ec3';
const HELPATL_ID = '8d479b53-bab7-433f-8df6-b26cf412cd1d';

async function fetchJSON(url: string): Promise<any> {
  const resp = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  const text = await resp.text();
  try { return JSON.parse(text); }
  catch { return { error: text.slice(0, 200) }; }
}

async function fetchCount(url: string): Promise<number> {
  const resp = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    },
  });
  const cr = resp.headers.get('content-range') || '0-0/0';
  return parseInt(cr.split('/')[1] || '0');
}

const BASE = SUPABASE_URL + '/rest/v1';

async function main() {
  // 1. Source breakdown for Atlanta community events - get all source_ids
  const sourceCounts: Record<string, number> = {};
  let offset = 0;
  while (true) {
    const data = await fetchJSON(
      `${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=source_id&offset=${offset}&limit=1000`
    );
    if (!Array.isArray(data) || data.length === 0) break;
    for (const e of data) {
      const sid = String(e.source_id ?? 'null');
      sourceCounts[sid] = (sourceCounts[sid] || 0) + 1;
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  
  const topSources = Object.entries(sourceCounts).sort(([,a],[,b]) => b - a).slice(0, 25);
  const sourceIds = topSources.map(([id]) => id).filter(id => id !== 'null').join(',');
  
  // Fetch source names in one call
  const sourcesRaw = await fetchJSON(`${BASE}/sources?id=in.(${sourceIds})&select=id,name,slug,owner_portal_id,category`);
  const sourceMap: Record<string, any> = {};
  if (Array.isArray(sourcesRaw)) {
    for (const s of sourcesRaw) sourceMap[String(s.id)] = s;
  }
  
  console.log('=== TOP SOURCES PRODUCING COMMUNITY EVENTS (Atlanta portal) ===');
  for (const [sid, count] of topSources) {
    const s = sourceMap[sid];
    const name = s ? s.name : `?`;
    const slug = s ? s.slug : sid;
    const owner = s?.owner_portal_id ? `owner=${s.owner_portal_id.slice(0, 8)}` : 'no-owner';
    console.log(`  ${count.toString().padStart(5)} | ${name} (${slug}) [${owner}]`);
  }

  // 2. Sample community events to check content
  console.log('\n=== SAMPLE UPCOMING COMMUNITY EVENTS (feed_ready, Atlanta) ===');
  const samples = await fetchJSON(
    `${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&is_feed_ready=eq.true&start_date=gte.2026-03-17&select=id,title,tags,source_id,start_date,genres&limit=25&order=start_date.asc`
  );
  if (Array.isArray(samples)) {
    for (const e of samples) {
      const s = sourceMap[String(e.source_id)];
      const sname = s ? s.slug : `src:${e.source_id}`;
      console.log(`  [${e.start_date}] ${e.title.slice(0, 70)}`);
      console.log(`    src: ${sname} | tags: ${(e.tags||[]).slice(0,5).join(', ')}`);
    }
  }

  // 3. Sources check - what categories do the top community sources have?
  console.log('\n=== SOURCE CATEGORIES FOR TOP COMMUNITY PRODUCERS ===');
  const top10Ids = topSources.slice(0, 10).map(([id]) => id).filter(id => id !== 'null').join(',');
  const top10Sources = await fetchJSON(`${BASE}/sources?id=in.(${top10Ids})&select=id,name,slug,category,owner_portal_id,is_active`);
  if (Array.isArray(top10Sources)) {
    for (const s of top10Sources) {
      const commCount = sourceCounts[String(s.id)] || 0;
      console.log(`  [${String(commCount).padStart(4)}] source ${s.id}: ${s.name}`);
      console.log(`    slug: ${s.slug} | category: ${s.category} | active: ${s.is_active} | owner: ${s.owner_portal_id?.slice(0,8) || 'none'}`);
    }
  }

  // 4. Family portal sources check - do they leak into Atlanta?
  console.log('\n=== FAMILY PORTAL SOURCES - DO ANY FEED ATLANTA? ===');
  const familyPortalSources = await fetchJSON(
    `${BASE}/sources?owner_portal_id=eq.${FAMILIES_ID}&is_active=eq.true&select=id,name,slug&limit=100`
  );
  if (Array.isArray(familyPortalSources) && familyPortalSources.length > 0) {
    console.log(`Family portal has ${familyPortalSources.length} active sources`);
    let leakCount = 0;
    for (const s of familyPortalSources.slice(0, 30)) {
      const atlCount = await fetchCount(`${BASE}/events?source_id=eq.${s.id}&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=id`);
      if (atlCount > 0) {
        leakCount++;
        console.log(`  LEAK: source ${s.id} (${s.slug}) → ${atlCount} events in Atlanta portal`);
      }
    }
    if (leakCount === 0) console.log('  No family sources leaking into Atlanta (first 30 sources checked)');
  } else {
    console.log('Family portal source list:', JSON.stringify(familyPortalSources).slice(0,200));
  }

  // 5. HelpATL sources - community category
  console.log('\n=== HELPATL SOURCES - COMMUNITY EVENTS IN ATLANTA PORTAL ===');
  const helpatlSources = await fetchJSON(
    `${BASE}/sources?owner_portal_id=eq.${HELPATL_ID}&is_active=eq.true&select=id,name,slug&limit=50`
  );
  if (Array.isArray(helpatlSources)) {
    console.log(`HelpATL has ${helpatlSources.length} active owned sources`);
    for (const s of helpatlSources.slice(0, 20)) {
      const commCount = await fetchCount(`${BASE}/events?source_id=eq.${s.id}&category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=id`);
      if (commCount > 0) {
        console.log(`  source ${s.id} (${s.slug}): ${commCount} community events in Atlanta portal`);
      }
    }
  }

  // 6. What does the events table actually show for "community" - is it a catch-all?
  console.log('\n=== COMMUNITY EVENTS - TAG DISTRIBUTION (top 20 tags) ===');
  const communityEvents = await fetchJSON(
    `${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=tags&limit=2000`
  );
  const tagCounts: Record<string, number> = {};
  if (Array.isArray(communityEvents)) {
    for (const e of communityEvents) {
      for (const tag of (e.tags || [])) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }
  const topTags = Object.entries(tagCounts).sort(([,a],[,b]) => b - a).slice(0, 25);
  for (const [tag, count] of topTags) {
    console.log(`  ${count.toString().padStart(5)} | ${tag}`);
  }

  // 7. Is_active vs inactive community events
  console.log('\n=== COMMUNITY EVENTS - ACTIVE vs INACTIVE ===');
  const totalActive = await fetchCount(`${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=id`);
  const totalInactive = await fetchCount(`${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.false&select=id`);
  const totalAll = await fetchCount(`${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&select=id`);
  console.log(`  is_active=true: ${totalActive}`);
  console.log(`  is_active=false: ${totalInactive}`);
  console.log(`  Total (any): ${totalAll}`);
}

main().catch(console.error);
