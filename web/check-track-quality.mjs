import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const envFile = readFileSync('/Users/coach/Projects/LostCity/web/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => { const [k, ...v] = line.split('='); if (k && v.length) env[k.trim()] = v.join('=').trim(); });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const slug = process.argv[2] || 'resurgens';

const { data: track } = await supabase.from('explore_tracks').select('id, name, slug').eq('slug', slug).single();
if (!track) { console.log('Track not found for slug:', slug); process.exit(1); }

console.log(`Track: ${track.name} (${track.slug})\n`);

const { data: mappings } = await supabase
  .from('explore_track_venues')
  .select('sort_order, is_featured, editorial_blurb, venue:venues(id, name, slug, image_url, hero_image_url, venue_type, neighborhood, city, description, short_description)')
  .eq('track_id', track.id)
  .order('sort_order', { ascending: true });

let noImage = 0, hasImage = 0;
mappings.forEach((m, i) => {
  const v = m.venue;
  const img = v.image_url || v.hero_image_url;
  const imgStatus = img ? `IMG: ${img.substring(0, 60)}...` : 'NO IMAGE';
  const featured = m.is_featured ? ' ★' : '';
  const loc = v.neighborhood || v.city || '';
  console.log(`${String(i+1).padStart(2)}. ${v.name}${featured} — ${loc} (${v.venue_type || 'venue'})`);
  console.log(`    ${imgStatus}`);
  if (!img) noImage++; else hasImage++;
});

console.log(`\nTotal: ${mappings.length} | With image: ${hasImage} | Missing: ${noImage}`);
