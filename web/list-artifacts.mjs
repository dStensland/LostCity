import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read env
const envFile = readFileSync('/Users/coach/Projects/LostCity/web/.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY
);

const { data: track } = await supabase
  .from('explore_tracks')
  .select('id, name, slug')
  .eq('slug', 'artefacts-of-the-lost-city')
  .single();

if (!track) { console.log('Track not found'); process.exit(1); }

console.log(`Track: ${track.name} (${track.slug})\n`);

const { data: mappings, error } = await supabase
  .from('explore_track_venues')
  .select('sort_order, is_featured, editorial_blurb, venue:venues(id, name, slug, city, neighborhood, venue_type)')
  .eq('track_id', track.id)
  .order('sort_order', { ascending: true });

if (error) { console.log('Error:', error.message); process.exit(1); }

console.log(`Total venues: ${mappings.length}\n`);

mappings.forEach((m, i) => {
  const v = m.venue;
  const featured = m.is_featured ? ' ★' : '';
  const loc = v.neighborhood || v.city || '';
  console.log(`${String(i+1).padStart(2)}. ${v.name}${featured} — ${loc} (${v.venue_type || 'venue'})`);
});
