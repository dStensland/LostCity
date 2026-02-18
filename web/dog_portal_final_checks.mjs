import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalChecks() {
  console.log('=== Final Portal-Specific Checks ===\n');

  // Check portal categorization
  console.log('1. How many dog-friendly venues per category for portal tabs:');
  const categories = {
    'Parks & Trails': ['park', 'trail', 'dog_park'],
    'Food & Drink': ['restaurant', 'coffee_shop', 'bar', 'brewery'],
    'Pet Services': ['vet', 'groomer', 'pet_store', 'pet_daycare', 'animal_shelter'],
    'Shopping & Retail': ['market', 'farmers_market', 'pet_store'],
    'Activities': ['event_space', 'fitness_center', 'organization'],
  };

  for (const [category, types] of Object.entries(categories)) {
    const { count } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .contains('vibes', ['dog-friendly'])
      .in('venue_type', types);
    console.log(`  ${category}: ${count || 0}`);
  }

  // Check events by category
  console.log('\n2. Dog-friendly events by category:');
  const eventCategories = ['outdoor', 'social', 'market', 'sports', 'wellness', 'community'];
  for (const cat of eventCategories) {
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', new Date().toISOString().split('T')[0])
      .contains('tags', ['dog-friendly'])
      .contains('categories', [cat])
      .is('canonical_event_id', null);
    if (count > 0) console.log(`  ${cat}: ${count}`);
  }

  // Check specific high-value content
  console.log('\n3. High-value dog content:');
  
  // Dog parks specifically
  const { data: dogParks } = await supabase
    .from('venues')
    .select('name, neighborhood, image_url')
    .eq('active', true)
    .eq('venue_type', 'dog_park')
    .order('name');
  
  console.log(`\n  Dog parks (${dogParks?.length || 0}):`);
  if (dogParks) {
    dogParks.forEach(p => {
      const hasImage = p.image_url ? '✓' : '✗';
      const hood = p.neighborhood || 'no neighborhood';
      console.log(`    ${hasImage} ${p.name} (${hood})`);
    });
  }

  // Off-leash areas beyond dog parks
  const { data: offLeash } = await supabase
    .from('venues')
    .select('name, venue_type, neighborhood')
    .eq('active', true)
    .contains('vibes', ['off-leash'])
    .neq('venue_type', 'dog_park');
  
  console.log(`\n  Off-leash areas (non-dog-park): ${offLeash?.length || 0}`);
  if (offLeash && offLeash.length > 0) {
    offLeash.forEach(v => console.log(`    - ${v.name} (${v.venue_type})`));
  }

  // Check for veterinary/emergency services
  const { data: vets } = await supabase
    .from('venues')
    .select('name, address, neighborhood')
    .eq('active', true)
    .eq('venue_type', 'vet')
    .order('name');
  
  console.log(`\n  Veterinary clinics: ${vets?.length || 0}`);
  if (vets && vets.length > 0) {
    vets.forEach(v => console.log(`    - ${v.name} (${v.neighborhood || 'no neighborhood'})`));
  }

  // Check pet stores
  const { data: petStores } = await supabase
    .from('venues')
    .select('name, neighborhood, vibes')
    .eq('active', true)
    .eq('venue_type', 'pet_store')
    .order('name');
  
  console.log(`\n  Pet stores: ${petStores?.length || 0}`);
  if (petStores && petStores.length > 0) {
    petStores.forEach(s => {
      const isDogFriendly = s.vibes && s.vibes.includes('dog-friendly') ? '(dog-friendly)' : '';
      console.log(`    - ${s.name} ${isDogFriendly}`);
    });
  }

  // Check shelters/rescues
  const { data: shelters } = await supabase
    .from('venues')
    .select('name, neighborhood')
    .eq('active', true)
    .eq('venue_type', 'animal_shelter')
    .order('name');
  
  console.log(`\n  Animal shelters/rescues: ${shelters?.length || 0}`);
  if (shelters && shelters.length > 0) {
    shelters.forEach(s => console.log(`    - ${s.name} (${s.neighborhood || 'no neighborhood'})`));
  }

  // Check upcoming adoption events detail
  const { data: adoptions } = await supabase
    .from('events')
    .select('title, start_date, venues(name), source_id, sources(name)')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .or('tags.cs.{adoption-event},tags.cs.{adoption}')
    .is('canonical_event_id', null)
    .order('start_date')
    .limit(5);
  
  console.log(`\n  Upcoming adoption events detail:`);
  if (adoptions && adoptions.length > 0) {
    adoptions.forEach(e => {
      const venue = e.venues?.name || 'Unknown venue';
      const source = e.sources?.name || 'Unknown source';
      console.log(`    - ${e.title}`);
      console.log(`      Date: ${e.start_date}, Venue: ${venue}, Source: ${source}`);
    });
  } else {
    console.log('    None found');
  }

  // Check for dog-specific events that might be miscategorized
  console.log('\n4. Events with "dog" in title but not tagged dog-friendly:');
  const { data: dogInTitle } = await supabase
    .from('events')
    .select('title, tags, start_date, venues(name)')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .ilike('title', '%dog%')
    .is('canonical_event_id', null)
    .limit(20);
  
  if (dogInTitle) {
    const notTagged = dogInTitle.filter(e => !e.tags || !e.tags.includes('dog-friendly'));
    console.log(`  Found ${notTagged.length} events with "dog" in title NOT tagged dog-friendly:`);
    notTagged.slice(0, 10).forEach(e => {
      const venue = e.venues?.name || 'Unknown';
      console.log(`    - ${e.title} @ ${venue} (${e.start_date})`);
      console.log(`      Tags: ${e.tags?.join(', ') || 'none'}`);
    });
  }

  // Check for puppy/pup events
  const { data: puppyEvents } = await supabase
    .from('events')
    .select('title, tags')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .or('title.ilike.%puppy%,title.ilike.%pup %')
    .is('canonical_event_id', null)
    .limit(10);
  
  console.log(`\n  Events with "puppy" or "pup" in title: ${puppyEvents?.length || 0}`);
  if (puppyEvents && puppyEvents.length > 0) {
    puppyEvents.forEach(e => {
      const hasDogTag = e.tags && e.tags.includes('dog-friendly') ? '✓' : '✗';
      console.log(`    ${hasDogTag} ${e.title}`);
    });
  }
}

finalChecks().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
