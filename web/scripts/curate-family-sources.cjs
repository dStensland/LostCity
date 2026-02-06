/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Curate sources for Atlanta Families portal
 * More refined categorization with manual overrides
 *
 * Run with: node scripts/curate-family-sources.cjs
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/coach/Projects/LostCity/web/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Manual overrides - source names that should be INCLUDED
const MANUAL_INCLUDE = [
  'atlanta-fulton public library',
  'dekalb county public library',
  'publix aprons cooking school',
  'peachtree city running club',
  'monday night run club',
  'punchline comedy club', // Family-friendly comedy shows
  'helium comedy club',
  'level up gaming lounge', // Gaming can be family-friendly
  'dragon con',
  'momocon',
  'world of coca-cola',
  'atlanta beltline',
  'georgia tech athletics',
  'georgia tech events',
  'emory events',
  'georgia state athletics',
  'scad atlanta',
  'spivey hall',
  'moca ga',
  'atlanta contemporary',
  'whitespace gallery',
  'abv gallery',
  'zucot gallery',
  'puttshack', // Mini golf
  'fowling warehouse',
  'battle & brew', // Gaming venue
  'criminal records', // Record store
  'wax n facts',
  'highland yoga',
  'yonder yoga',
  'dancing dogs yoga',
  'vista yoga',
  'evolation yoga',
  'sur la table',
  'forward warrior',
  'big peach running co',
  'atlanta cycling',
  'landmark midtown art cinema',
  '7 stages', // Theater
  'theatrical outfit',
  'actor\'s express',
  'stage door players',
  'working title playwrights',
  'onstage atlanta',
  'dad\'s garage', // Improv comedy
  'little shop of stories', // Children's bookstore
  'eddie\'s attic', // Acoustic music venue
  'variety playhouse', // Concert venue
  'terminal west',
  'the eastern',
  'tabernacle',
  'state farm arena',
  'mercedes-benz stadium',
  'gas south arena',
  'coca-cola roxy',
  'atlanta motor speedway',
  'the battery atlanta',
  'peachtree road race',
  'sweet auburn springfest',
  'east atlanta strut',
  'atlanta pride', // Family-friendly events
  'fancons georgia',
  'southern-fried gaming expo',
  'render atl', // Tech conference
  'atlanta tech week',
  'atlanta tech village',
  'hands on atlanta', // Volunteering
  'discover atlanta',
  'access atlanta',
  'creative loafing',
  'do404',
  'bicycle tours of atlanta',
  'piedmont healthcare',
  'georgia chess association',
  '13 stories haunted house', // Seasonal family fun
  'netherworld haunted house',
  'folklore haunted house',
  'paranoia haunted house',
  'nightmare\'s gate',
  'poem88 gallery',
  'kai lin art',
  'marcia wood gallery',
  'mason fine art',
  'hathaway contemporary',
  'academy ballroom', // Dance studios
  'ballroom impact',
  'dancing4fun',
  'arthur murray atlanta',
  'eeg arena', // Gaming/esports
  'atl gaming',
  // Additional family-friendly venues
  'college football hall of fame',
  'piedmont park conservancy',
  'candler park fall fest',
  'truist park', // Baseball stadium
  'spelman college',
  'morehouse college',
  'clark atlanta university',
  'kennesaw state university',
  'agnes scott college',
  'oglethorpe university',
  'artsatl',
  'activate games atlanta',
  'the painted pin', // Bowling
  'the painted duck', // Bowling
  'believe music hall', // Concert venue
  'knock music house',
  'moods music', // Record store
  'the cooking school at irwin street',
  'atlanta dance ballroom', // Dance studio
];

// Manual overrides - source names that should be EXCLUDED
const MANUAL_EXCLUDE = [
  // Adult LGBTQ venues (bars/clubs)
  'the heretic',
  'my sister\'s room',
  'atlanta eagle',
  'bulldogs atlanta',
  'woofs atlanta',
  'woody\'s atlanta',
  'pisces atlanta',
  'future atlanta',
  'lips atlanta', // Drag venue
  // Nightclubs
  'tongue & groove',
  'gold room',
  'domaine atlanta',
  'lyfe atlanta',
  'opera nightclub',
  'district atlanta',
  'the masquerade',
  'basement atlanta',
  'compound atlanta',
  'mjq concourse',
  'jungle atlanta',
  'club wander',
  'sound table',
  'johnny\'s hideaway',
  // Bars
  'smith\'s olde bar',
  'northside tavern',
  'park tavern',
  'midway pub',
  'fado irish pub',
  'stats brewpub',
  'meehan\'s public house',
  'mary\'s bar',
  'joystick gamebar',
  'token gaming pub',
  'friends on ponce',
  'red light cafe',
  'the loft',
  'blind willie\'s',
  'venkman\'s',
  'aisle 5',
  'the earl',
  'ravine atlanta',
  'st. james live',
  'lore atlanta',
  'side saddle',
  'spaceman rooftop',
  'rowdy tiger',
  'urban grind',
  'kat\'s cafe',
  'gypsy kitchen',
  'brewhouse cafe',
  // Breweries
  'reformation brewery',
  'three taverns craft brewery',
  'asw distillery',
  'city winery atlanta',
  'monday night brewing',
  'sweetwater brewing company',
  'orpheus brewing',
  'pontoon brewing',
  'wild heaven beer',
  'scofflaw brewing',
  'second self beer company',
  'bold monk brewing',
  'steady hand beer co',
  'cherry street brewing',
  'round trip brewing',
  'halfway crooks',
  'fire maker brewing',
  'eventide brewing',
  // Adult entertainment
  'southern fried queer pride', // Adult-focused events
  'out on film', // Film festival with mature content
  // Comedy with adult content
  'laughing skull lounge',
  'uptown comedy corner',
  // Coworking (not event venues)
  'wework atlanta',
  'industrious atlanta',
  'switchyards',
  // Restaurant/bar only
  'the sun dial restaurant',
  'punch bowl social', // Bar-focused
  '529', // Music venue/bar
  // Medical/professional
  'piedmont cme/ce portal',
  'piedmont heart conferences',
  'piedmont womens heart support',
  'piedmont luminaria',
  'piedmont transplant support',
  'piedmont athens spiritual care',
  'piedmont healthcare events',
  'piedmont atlanta hospital auxiliary',
  'piedmont foundation events',
  'piedmont cancer institute support',
  'piedmont classes',
  // Business events
  'young professionals of atlanta',
  'americasmart atlanta',
  'freeroll atlanta', // Poker
  'williams sonoma - lenox', // Retail, not event venue
];

function categorizeSource(source) {
  const name = (source.name || '').toLowerCase();

  // Check manual overrides first
  if (MANUAL_INCLUDE.some(m => name.includes(m.toLowerCase()))) {
    return 'include';
  }

  if (MANUAL_EXCLUDE.some(m => name.includes(m.toLowerCase()))) {
    return 'exclude';
  }

  // Check for family-friendly keywords
  const familyKeywords = [
    'museum', 'zoo', 'aquarium', 'botanical', 'garden', 'library',
    'children', 'kids', 'family', 'youth', 'puppet', 'theater', 'theatre',
    'science', 'discovery', 'nature', 'wildlife', 'education',
    'festival', 'fair', 'market', 'farmers', 'community', 'civic',
    'church', 'temple', 'faith', 'center', 'centre',
    'ballet', 'opera', 'symphony', 'orchestra',
    'book', 'reading', 'camp', 'recreation',
    'eventbrite', 'ticketmaster', 'meetup',
  ];

  for (const keyword of familyKeywords) {
    if (name.includes(keyword)) {
      return 'include';
    }
  }

  // Default to exclude if no clear indicator
  return 'exclude';
}

async function main() {
  console.log('=== Curate Sources for Atlanta Families ===\n');

  // Get portals
  const { data: afPortal } = await supabase
    .from('portals')
    .select('id')
    .eq('slug', 'atlanta-families')
    .single();

  if (!afPortal) {
    console.error('Atlanta Families portal not found');
    return;
  }

  // Get all subscribed sources
  const { data: subscriptions, error } = await supabase
    .from('source_subscriptions')
    .select(`
      id,
      source_id,
      sources (id, name, slug, source_type)
    `)
    .eq('subscriber_portal_id', afPortal.id)
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Current subscriptions:', subscriptions.length);

  const toKeep = [];
  const toRemove = [];

  for (const sub of subscriptions) {
    const source = sub.sources;
    if (!source) continue;

    const category = categorizeSource(source);
    if (category === 'include') {
      toKeep.push({ subId: sub.id, name: source.name, type: source.source_type });
    } else {
      toRemove.push({ subId: sub.id, name: source.name, type: source.source_type });
    }
  }

  console.log('\n=== KEEPING ===');
  console.log('Count:', toKeep.length);
  toKeep.forEach(s => console.log(`  ✅ ${s.name}`));

  console.log('\n=== REMOVING ===');
  console.log('Count:', toRemove.length);
  toRemove.forEach(s => console.log(`  ❌ ${s.name}`));

  // Ask for confirmation
  console.log('\n=== SUMMARY ===');
  console.log('Keep:', toKeep.length);
  console.log('Remove:', toRemove.length);

  // Save the removal list
  const fs = require('fs');
  fs.writeFileSync(
    '/tmp/family-sources-to-remove.json',
    JSON.stringify(toRemove.map(s => s.subId), null, 2)
  );
  console.log('\nRemoval IDs saved to: /tmp/family-sources-to-remove.json');
  console.log('\nTo apply changes, run: node scripts/apply-family-curation.cjs');
}

main().catch(console.error);
