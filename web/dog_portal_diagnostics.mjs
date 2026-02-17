import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rtppvljfrkjtoxmaizea.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0MzMxNCwiZXhwIjoyMDgzNzE5MzE0fQ.9Z0uJrvjKg6yFjAEq8fedgFEp8s_GPXKsBzZaRliE5M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostics() {
  console.log('=== ROMP Dog Portal Data Quality Diagnostic ===\n');

  // 1. Dog-friendly venues by type
  console.log('1. Dog-friendly venues by type:');
  const { data: dogVenues1 } = await supabase
    .from('venues')
    .select('venue_type')
    .eq('active', true)
    .contains('vibes', ['dog-friendly']);
  
  if (dogVenues1) {
    const counts = {};
    dogVenues1.forEach(v => {
      const type = v.venue_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log(`  TOTAL: ${dogVenues1.length}`);
  }

  // 2. Off-leash parks
  console.log('\n2. Off-leash parks:');
  const { count: dogParkCount } = await supabase
    .from('venues')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .eq('venue_type', 'dog_park');
  const { count: offLeashCount } = await supabase
    .from('venues')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .contains('vibes', ['off-leash']);
  console.log(`  Dog parks: ${dogParkCount}`);
  console.log(`  Off-leash tagged: ${offLeashCount}`);

  // 3. Pup cup spots
  console.log('\n3. Pup cup / dog menu spots:');
  const { data: pupCups } = await supabase
    .from('venues')
    .select('name, vibes')
    .eq('active', true)
    .or('vibes.cs.{pup-cup},vibes.cs.{dog-menu},vibes.cs.{treats-available}')
    .order('name')
    .limit(20);
  console.log(`  Total found: ${pupCups ? pupCups.length : 0}`);
  if (pupCups && pupCups.length > 0) {
    pupCups.forEach(v => {
      const relevantVibes = v.vibes.filter(vibe => 
        ['pup-cup', 'dog-menu', 'treats-available'].includes(vibe)
      );
      console.log(`    - ${v.name} [${relevantVibes.join(', ')}]`);
    });
  }

  // 4. Pet services by type
  console.log('\n4. Pet services by type:');
  const petTypes = ['vet', 'groomer', 'pet_store', 'pet_daycare', 'animal_shelter'];
  for (const type of petTypes) {
    const { count } = await supabase
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .eq('venue_type', type);
    if (count > 0) console.log(`  ${type}: ${count}`);
  }

  // 5. Dog events (upcoming)
  console.log('\n5. Upcoming dog-friendly events:');
  const { count: dogEventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null);
  console.log(`  Total: ${dogEventCount || 0}`);

  // 6. Adoption events
  console.log('\n6. Adoption events:');
  const { data: adoptionEvents, count: adoptionCount } = await supabase
    .from('events')
    .select('title, start_date', { count: 'exact' })
    .gte('start_date', new Date().toISOString().split('T')[0])
    .or('tags.cs.{adoption-event},tags.cs.{adoption}')
    .is('canonical_event_id', null)
    .order('start_date')
    .limit(10);
  console.log(`  Total: ${adoptionCount || 0}`);
  if (adoptionEvents && adoptionEvents.length > 0) {
    adoptionEvents.forEach(e => console.log(`    - ${e.title} (${e.start_date})`));
  } else {
    console.log('    (No adoption events found)');
  }

  // 7. Training events
  console.log('\n7. Dog training classes:');
  const { count: trainingCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', new Date().toISOString().split('T')[0])
    .eq('is_class', true)
    .or('tags.cs.{dog-training},tags.cs.{puppy-class},tags.cs.{obedience},tags.cs.{agility}')
    .is('canonical_event_id', null);
  console.log(`  Total: ${trainingCount || 0}`);

  // 8. Venue images
  console.log('\n8. Dog-friendly venue images:');
  const { data: allDogVenues } = await supabase
    .from('venues')
    .select('image_url')
    .eq('active', true)
    .contains('vibes', ['dog-friendly']);
  if (allDogVenues) {
    const withImage = allDogVenues.filter(v => v.image_url).length;
    const withoutImage = allDogVenues.length - withImage;
    console.log(`  With image: ${withImage}`);
    console.log(`  Without image: ${withoutImage}`);
    console.log(`  Coverage: ${((withImage / allDogVenues.length) * 100).toFixed(1)}%`);
  }

  // 9. Neighborhoods
  console.log('\n9. Neighborhoods represented:');
  const { data: allNeighborhoods } = await supabase
    .from('venues')
    .select('neighborhood')
    .eq('active', true)
    .contains('vibes', ['dog-friendly'])
    .not('neighborhood', 'is', null);
  if (allNeighborhoods) {
    const counts = {};
    allNeighborhoods.forEach(v => {
      counts[v.neighborhood] = (counts[v.neighborhood] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    sorted.forEach(([neighborhood, count]) => {
      console.log(`  ${neighborhood}: ${count}`);
    });
    console.log(`  Total neighborhoods: ${Object.keys(counts).length}`);
  }

  // 10. Sample feed query
  console.log('\n10. Sample dog feed (next 10 events):');
  const { data: feedSample } = await supabase
    .from('events')
    .select('id, title, start_date, start_time, tags, venues(name)')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .contains('tags', ['dog-friendly'])
    .is('canonical_event_id', null)
    .order('start_date')
    .order('start_time')
    .limit(10);
  if (feedSample && feedSample.length > 0) {
    feedSample.forEach(e => {
      const venue = e.venues ? e.venues.name : 'Unknown venue';
      console.log(`    - ${e.title} @ ${venue} (${e.start_date} ${e.start_time || ''})`);
    });
  } else {
    console.log('    (No upcoming dog-friendly events found)');
  }

  // Additional diagnostics
  console.log('\n11. Venue type distribution (all dog-friendly):');
  const { data: allDogFriendly } = await supabase
    .from('venues')
    .select('venue_type, vibes')
    .eq('active', true)
    .contains('vibes', ['dog-friendly']);
  
  if (allDogFriendly) {
    console.log(`  Total dog-friendly venues: ${allDogFriendly.length}`);
    
    // Check how many have multiple relevant vibes
    const vibeStats = {
      'outdoor-seating': 0,
      'patio': 0,
      'beer-garden': 0,
      'park': 0,
      'off-leash': 0,
      'pup-cup': 0,
      'dog-menu': 0,
    };
    
    allDogFriendly.forEach(v => {
      Object.keys(vibeStats).forEach(vibe => {
        if (v.vibes && v.vibes.includes(vibe)) {
          vibeStats[vibe]++;
        }
      });
    });
    
    console.log('\n  Common co-occurring vibes:');
    Object.entries(vibeStats)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([vibe, count]) => {
        console.log(`    ${vibe}: ${count}`);
      });
  }
}

runDiagnostics().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
