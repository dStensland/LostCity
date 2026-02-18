import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDive() {
  console.log('=== Deep Dive: Data Quality Issues ===\n');

  // Check for missing venue data on dog-friendly places
  console.log('1. Dog-friendly venues missing critical fields:');
  const { data: venuesMissingData } = await supabase
    .from('venues')
    .select('id, name, address, lat, lng, neighborhood, image_url, venue_type')
    .eq('active', true)
    .contains('vibes', ['dog-friendly']);
  
  if (venuesMissingData) {
    const missing = {
      address: venuesMissingData.filter(v => !v.address).length,
      latLng: venuesMissingData.filter(v => !v.lat || !v.lng).length,
      neighborhood: venuesMissingData.filter(v => !v.neighborhood).length,
      image: venuesMissingData.filter(v => !v.image_url).length,
      venueType: venuesMissingData.filter(v => !v.venue_type).length,
    };
    console.log(`  Missing address: ${missing.address}`);
    console.log(`  Missing lat/lng: ${missing.latLng}`);
    console.log(`  Missing neighborhood: ${missing.neighborhood}`);
    console.log(`  Missing image: ${missing.image}`);
    console.log(`  Missing venue_type: ${missing.venueType}`);
    
    // Sample some missing images
    const noImage = venuesMissingData.filter(v => !v.image_url).slice(0, 10);
    console.log('\n  Sample venues without images:');
    noImage.forEach(v => console.log(`    - ${v.name} (${v.venue_type || 'unknown type'})`));
  }

  // Check event data quality
  console.log('\n2. Dog-friendly events missing critical fields:');
  const { data: eventsMissingData } = await supabase
    .from('events')
    .select('id, title, start_date, start_time, description, image_url, venue_id, source_id')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null)
    .limit(500);
  
  if (eventsMissingData) {
    const missing = {
      startTime: eventsMissingData.filter(e => !e.start_time).length,
      description: eventsMissingData.filter(e => !e.description || e.description.length < 20).length,
      image: eventsMissingData.filter(e => !e.image_url).length,
      venue: eventsMissingData.filter(e => !e.venue_id).length,
    };
    console.log(`  Missing start_time: ${missing.startTime} / ${eventsMissingData.length}`);
    console.log(`  Missing/short description: ${missing.description} / ${eventsMissingData.length}`);
    console.log(`  Missing image: ${missing.image} / ${eventsMissingData.length}`);
    console.log(`  Missing venue: ${missing.venue} / ${eventsMissingData.length}`);
  }

  // Check which sources are producing dog-friendly content
  console.log('\n3. Top sources for dog-friendly events:');
  const { data: dogEvents } = await supabase
    .from('events')
    .select('source_id, sources(name)')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null);
  
  if (dogEvents) {
    const sourceCounts = {};
    dogEvents.forEach(e => {
      const sourceName = e.sources?.name || 'Unknown';
      sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
    });
    Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count} events`);
      });
  }

  // Check tag consistency
  console.log('\n4. Tag analysis for dog-friendly events:');
  const { data: allDogEvents } = await supabase
    .from('events')
    .select('tags')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null);
  
  if (allDogEvents) {
    const tagCounts = {};
    allDogEvents.forEach(e => {
      if (e.tags) {
        e.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    // Filter to dog-related tags
    const dogTags = Object.entries(tagCounts)
      .filter(([tag]) => 
        tag.includes('dog') || tag.includes('pet') || tag.includes('pup') || 
        tag.includes('adoption') || tag.includes('animal')
      )
      .sort((a, b) => b[1] - a[1]);
    
    console.log('  Dog-related tags:');
    dogTags.forEach(([tag, count]) => {
      console.log(`    ${tag}: ${count}`);
    });
  }

  // Check for potential data quality issues
  console.log('\n5. Potential data quality issues:');
  
  // Parks tagged as bars?
  const { data: parkBars } = await supabase
    .from('venues')
    .select('name, venue_type, vibes')
    .eq('active', true)
    .eq('venue_type', 'bar')
    .contains('vibes', ['dog-friendly'])
    .or('name.ilike.%park%,name.ilike.%trail%');
  
  console.log(`  Bars with "park" or "trail" in name: ${parkBars?.length || 0}`);
  if (parkBars && parkBars.length > 0) {
    parkBars.slice(0, 5).forEach(v => console.log(`    - ${v.name} (type: ${v.venue_type})`));
  }

  // Events at parks
  console.log('\n6. Events at dog-friendly parks:');
  const { data: parkVenues } = await supabase
    .from('venues')
    .select('id, name')
    .eq('active', true)
    .eq('venue_type', 'park')
    .contains('vibes', ['dog-friendly']);
  
  if (parkVenues) {
    console.log(`  Total dog-friendly parks: ${parkVenues.length}`);
    
    // Check how many have upcoming events
    const parkIds = parkVenues.map(v => v.id);
    const { count: parkEventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', new Date().toISOString().split('T')[0])
      .in('venue_id', parkIds)
      .is('canonical_event_id', null);
    
    console.log(`  Parks with upcoming events: ${parkEventCount} events across parks`);
  }

  // Check recurring events
  console.log('\n7. Dog-friendly recurring events:');
  const { data: recurringDog } = await supabase
    .from('events')
    .select('title, canonical_event_id')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .not('canonical_event_id', 'is', null)
    .limit(10);
  
  console.log(`  Sample recurring events: ${recurringDog?.length || 0}`);
  if (recurringDog && recurringDog.length > 0) {
    recurringDog.forEach(e => console.log(`    - ${e.title}`));
  }

  // Price info for dog events
  console.log('\n8. Pricing for dog-friendly events:');
  const { data: pricedEvents } = await supabase
    .from('events')
    .select('is_free, price_min, price_max')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null);
  
  if (pricedEvents) {
    const free = pricedEvents.filter(e => e.is_free).length;
    const paid = pricedEvents.filter(e => !e.is_free && (e.price_min || e.price_max)).length;
    const unknown = pricedEvents.filter(e => !e.is_free && !e.price_min && !e.price_max).length;
    
    console.log(`  Free: ${free}`);
    console.log(`  Paid: ${paid}`);
    console.log(`  Unknown pricing: ${unknown}`);
  }
}

deepDive().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
