import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync('/Users/coach/Projects/LostCity/web/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => { const [k, ...v] = line.split('='); if (k && v.length) env[k.trim()] = v.join('=').trim(); });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const { data: track } = await supabase.from('explore_tracks').select('id').eq('slug', 'artefacts-of-the-lost-city').single();
const { data: mappings } = await supabase
  .from('explore_track_venues')
  .select('sort_order, venue:venues(id, name, slug, lat, lng, image_url, hero_image_url, description, short_description, website, neighborhood, city)')
  .eq('track_id', track.id)
  .order('sort_order', { ascending: true });

let noImage = [], noGeo = [], noDesc = [], noShortDesc = [], noNeighborhood = [];
let hasImage = 0, hasGeo = 0, hasDesc = 0, hasWebsite = 0;

mappings.forEach(m => {
  const v = m.venue;
  const img = v.image_url || v.hero_image_url;
  if (img) { hasImage++; } else { noImage.push(`${v.name} (${v.slug})`); }
  if (v.lat && v.lng) { hasGeo++; } else { noGeo.push(`${v.name} (${v.slug})`); }
  if (v.description) { hasDesc++; } else { noDesc.push(`${v.name} (${v.slug})`); }
  if (v.website) { hasWebsite++; }
  if (v.short_description) { /* ok */ } else { noShortDesc.push(v.name); }
  if (v.neighborhood) { /* ok */ } else { noNeighborhood.push(v.name); }
});

console.log(`=== DATA QUALITY: Artefacts Track (${mappings.length} venues) ===\n`);
console.log(`Images:       ${hasImage}/${mappings.length} have an image`);
console.log(`Geo:          ${hasGeo}/${mappings.length} have lat/lng`);
console.log(`Description:  ${hasDesc}/${mappings.length} have a description`);
console.log(`Website:      ${hasWebsite}/${mappings.length} have a website`);
console.log();
if (noImage.length) console.log(`MISSING IMAGE (${noImage.length}):\n  ${noImage.join('\n  ')}`);
if (noGeo.length) console.log(`\nMISSING GEO (${noGeo.length}):\n  ${noGeo.join('\n  ')}`);
if (noDesc.length) console.log(`\nMISSING DESC (${noDesc.length}):\n  ${noDesc.join('\n  ')}`);
if (noNeighborhood.length) console.log(`\nMISSING NEIGHBORHOOD (${noNeighborhood.length}):\n  ${noNeighborhood.join('\n  ')}`);
