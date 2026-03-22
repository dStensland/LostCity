import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtppvljfrkjtoxmaizea.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0MzMxNCwiZXhwIjoyMDgzNzE5MzE0fQ.9Z0uJrvjKg6yFjAEq8fedgFEp8s_GPXKsBzZaRliE5M';

const ATLANTA_ID = '74c2f211-ee11-453d-8386-ac2861705695';
const FAMILIES_ID = '840edaab-ab97-4f15-9dca-fe8dd2101ec3';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJSON(url: string): Promise<any[]> {
  const resp = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  return resp.json();
}

async function fetchCount(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    },
  });
  return resp.headers.get('content-range') || 'ERROR';
}

const BASE = SUPABASE_URL + '/rest/v1';

async function main() {
  // 1. Source breakdown for Atlanta community events
  console.log('=== COMMUNITY EVENTS BY SOURCE (Atlanta portal) ===');
  
  // Fetch all community events with source_id (paginate)
  const sourceCounts: Record<string, number> = {};
  let offset = 0;
  while (true) {
    const data = await fetchJSON(
      `${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&select=source_id&offset=${offset}&limit=1000`
    );
    if (!Array.isArray(data) || data.length === 0) break;
    for (const e of data) {
      const sid = String(e.source_id || 'null');
      sourceCounts[sid] = (sourceCounts[sid] || 0) + 1;
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  
  const topSources = Object.entries(sourceCounts).sort(([,a],[,b]) => b - a).slice(0, 20);
  const sourceIds = topSources.map(([id]) => id).filter(id => id !== 'null');
  
  // Fetch source names
  const sources = await fetchJSON(`${BASE}/sources?id=in.(${sourceIds.join(',')})&select=id,name,slug,category`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceMap: Record<string, any> = {};
  for (const s of sources) sourceMap[String(s.id)] = s;
  
  console.log('Top 20 sources producing community events:');
  for (const [sid, count] of topSources) {
    const s = sourceMap[sid];
    const name = s ? `${s.name} (${s.slug})` : `source_id=${sid}`;
    console.log(`  ${count.toString().padStart(5)} | ${name}`);
  }

  // 2. Sample 10 community events to check if they're legit
  console.log('\n=== SAMPLE COMMUNITY EVENTS (Atlanta, upcoming, feed_ready) ===');
  const samples = await fetchJSON(
    `${BASE}/events?category_id=eq.community&portal_id=eq.${ATLANTA_ID}&is_active=eq.true&is_feed_ready=eq.true&start_date=gte.2026-03-17&select=id,title,tags,source_id,start_date&limit=20&order=start_date.asc`
  );
  for (const e of samples) {
    const s = sourceMap[String(e.source_id)];
    const sname = s ? s.name : `source ${e.source_id}`;
    console.log(`  [${e.start_date}] [src:${e.source_id}/${sname}] ${e.title}`);
    if (e.tags && e.tags.length > 0) console.log(`    tags: ${e.tags.slice(0, 6).join(', ')}`);
  }

  // 3. Families portal - community leak check
  console.log('\n=== FAMILY PORTAL COMMUNITY EVENTS ===');
  const familyCommunity = await fetchJSON(
    `${BASE}/events?category_id=eq.community&portal_id=eq.${FAMILIES_ID}&is_active=eq.true&select=id,title,tags,source_id&limit=10`
  );
  for (const e of familyCommunity) {
    console.log(`  [src:${e.source_id}] ${e.title}`);
  }

  // 4. Check: are any family portal sources ALSO attributed to Atlanta?
  // Get all source_ids used in family portal community events
  console.log('\n=== SOURCE OVERLAP: FAMILY PORTAL SOURCES IN ATLANTA? ===');
  const familySources = await fetchJSON(
    `${BASE}/events?portal_id=eq.${FAMILIES_ID}&is_active=eq.true&select=source_id&limit=5000`
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familySourceIds = [...new Set(familySources.map((e: any) => e.source_id))];
  console.log(`Family portal has ${familySourceIds.length} distinct source_ids`);
  
  // Check if any of these sources also appear in Atlanta portal
  const overlapSources = await fetchJSON(
    `${BASE}/sources?id=in.(${familySourceIds.slice(0, 50).join(',')})&owner_portal_id=eq.${FAMILIES_ID}&select=id,name,slug`
  );
  console.log(`Sources with owner_portal_id=Families: ${overlapSources.length}`);
  
  // Check sources that are claimed by families but producing events in Atlanta
  if (overlapSources.length > 0) {
    console.log('Families-owned sources:');
    for (const s of overlapSources.slice(0, 15)) {
      // Count their events in Atlanta portal vs Families portal
      const atlCount = await fetchCount(`${BASE}/events?source_id=eq.${s.id}&portal_id=eq.${ATLANTA_ID}&select=id`);
      const famCount = await fetchCount(`${BASE}/events?source_id=eq.${s.id}&portal_id=eq.${FAMILIES_ID}&select=id`);
      console.log(`  source ${s.id} (${s.name}): Atlanta=${atlCount.split('/')[1]}, Families=${famCount.split('/')[1]}`);
    }
  }

  // 5. HOA source check - the HelpATL civic data
  console.log('\n=== HOA / CIVIC SOURCES IN COMMUNITY CATEGORY ===');
  const hoaSources = await fetchJSON(`${BASE}/sources?slug=like.%25hoa%25&select=id,name,slug,owner_portal_id`);
  const civicSources = await fetchJSON(`${BASE}/sources?slug=like.%25civic%25&select=id,name,slug,owner_portal_id`);
  const volunteerSources = await fetchJSON(`${BASE}/sources?slug=like.%25volunteer%25&select=id,name,slug,owner_portal_id`);
  console.log('HOA sources:', hoaSources.length);
  console.log('Civic sources:', civicSources.length);
  console.log('Volunteer sources:', volunteerSources.length);
  
  for (const s of [...hoaSources, ...civicSources, ...volunteerSources].slice(0, 20)) {
    const count = await fetchCount(`${BASE}/events?source_id=eq.${s.id}&category_id=eq.community&portal_id=eq.${ATLANTA_ID}&select=id`);
    console.log(`  source ${s.id} (${s.slug}) owner=${s.owner_portal_id}: community count=${count.split('/')[1]}`);
  }
}

main().catch(console.error);
