import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const vibesData: { slug: string; vibes: string[] }[] = [
  // Arcade bars and gaming lounges
  { slug: 'joystick-gamebar', vibes: ['late-night', 'good-for-groups'] },
  { slug: 'big-boss-arcade-bar', vibes: ['late-night', 'good-for-groups'] },
  { slug: 'battle-and-brew', vibes: ['late-night', 'good-for-groups'] },
  { slug: 'versus-atl', vibes: ['late-night', 'good-for-groups'] },

  // Bowling and entertainment centers
  { slug: 'bowlero-atlanta', vibes: ['good-for-groups', 'late-night'] },
  { slug: 'stars-and-strikes-dacula', vibes: ['good-for-groups'] },
  { slug: 'stars-and-strikes-cumming', vibes: ['good-for-groups'] },
  { slug: 'round1-north-point', vibes: ['good-for-groups'] },
  { slug: 'round1-perimeter', vibes: ['good-for-groups'] },

  // Upscale games
  { slug: 'painted-pin', vibes: ['date-spot', 'craft-cocktails', 'good-for-groups'] },
  { slug: 'painted-duck', vibes: ['date-spot', 'craft-cocktails', 'good-for-groups'] },
  { slug: 'puttshack-atlanta', vibes: ['date-spot', 'good-for-groups'] },
  { slug: 'flight-club-atlanta', vibes: ['date-spot', 'good-for-groups'] },

  // Family entertainment centers
  { slug: 'andretti-marietta', vibes: ['good-for-groups'] },
  { slug: 'andretti-buford', vibes: ['good-for-groups'] },
  { slug: 'main-event-alpharetta', vibes: ['good-for-groups'] },
  { slug: 'main-event-sandy-springs', vibes: ['good-for-groups'] },
  { slug: 'dave-and-busters-marietta', vibes: ['good-for-groups'] },
  { slug: 'dave-and-busters-lawrenceville', vibes: ['good-for-groups'] },
  { slug: 'monster-mini-golf-marietta', vibes: ['good-for-groups'] },

  // Escape rooms
  { slug: 'breakout-games-atlanta', vibes: ['good-for-groups'] },
  { slug: 'escape-the-room-atlanta', vibes: ['good-for-groups'] },

  // Topgolf
  { slug: 'topgolf-midtown', vibes: ['outdoor-seating', 'good-for-groups'] },
  { slug: 'topgolf-alpharetta', vibes: ['outdoor-seating', 'good-for-groups'] },

  // Music venues
  { slug: 'the-earl', vibes: ['late-night', 'live-music', 'divey'] },
  { slug: '529', vibes: ['late-night', 'live-music'] },
  { slug: 'city-winery-atlanta', vibes: ['live-music', 'date-spot'] },
  { slug: 'eddies-attic', vibes: ['live-music', 'date-spot'] },

  // Comedy clubs
  { slug: 'laughing-skull-lounge', vibes: ['late-night', 'date-spot', 'good-for-groups'] },
  { slug: 'punchline-comedy-club', vibes: ['late-night', 'date-spot', 'good-for-groups'] },

  // Theaters
  { slug: 'dads-garage', vibes: ['date-spot'] },

  // Cinemas
  { slug: 'landmark-midtown-art-cinema', vibes: ['date-spot'] },
  { slug: 'plaza-theatre', vibes: ['date-spot'] },
  { slug: 'tara-theatre', vibes: ['date-spot'] },

  // Galleries
  { slug: 'atlanta-contemporary', vibes: ['date-spot'] },
  { slug: 'whitespace-gallery', vibes: ['date-spot'] },
  { slug: 'kai-lin-art', vibes: ['date-spot'] },
  { slug: 'mason-fine-art', vibes: ['date-spot'] },
  { slug: 'sandler-hudson-gallery', vibes: ['date-spot'] },
  { slug: 'marcia-wood-gallery', vibes: ['date-spot'] },
  { slug: 'alan-avery-art', vibes: ['date-spot'] },
  { slug: 'tew-galleries', vibes: ['date-spot'] },
  { slug: 'poem-88', vibes: ['date-spot'] },
  { slug: 'besharat-gallery', vibes: ['date-spot'] },
  { slug: 'notch8-gallery', vibes: ['date-spot'] },
  { slug: 'zucot-gallery', vibes: ['date-spot'] },
  { slug: 'get-this-gallery', vibes: ['date-spot'] },
  { slug: 'dashboard-co-op', vibes: ['date-spot'] },

  // Museums - good for groups
  { slug: 'georgia-aquarium', vibes: ['good-for-groups'] },
  { slug: 'world-of-coca-cola', vibes: ['good-for-groups'] },
  { slug: 'childrens-museum-atlanta', vibes: ['good-for-groups'] },
  { slug: 'fernbank-museum', vibes: ['good-for-groups'] },
  { slug: 'fernbank-science-center', vibes: ['good-for-groups'] },
  { slug: 'college-football-hall-of-fame', vibes: ['good-for-groups'] },
  { slug: 'delta-flight-museum', vibes: ['good-for-groups'] },

  // Museums - date spots
  { slug: 'high-museum-of-art', vibes: ['date-spot'] },
  { slug: 'center-for-civil-and-human-rights', vibes: ['date-spot'] },
  { slug: 'atlanta-history-center', vibes: ['date-spot'] },
  { slug: 'michael-c-carlos-museum', vibes: ['date-spot'] },
  { slug: 'moda-atlanta', vibes: ['date-spot'] },
  { slug: 'hammonds-house-museum', vibes: ['date-spot'] },
  { slug: 'apex-museum', vibes: ['date-spot'] },
  { slug: 'margaret-mitchell-house', vibes: ['date-spot'] },
  { slug: 'wrens-nest-museum', vibes: ['date-spot'] },
  { slug: 'carter-presidential-library', vibes: ['date-spot'] },
  { slug: 'mlk-national-historical-park', vibes: ['date-spot'] },
  { slug: 'center-for-puppetry-arts', vibes: ['date-spot'] },

  // Outdoor venues
  { slug: 'atlanta-beltline', vibes: ['outdoor-seating', 'dog-friendly'] },
  { slug: 'centennial-olympic-park', vibes: ['outdoor-seating', 'good-for-groups'] },
  { slug: 'atlanta-botanical-garden', vibes: ['outdoor-seating', 'date-spot'] },
];

async function main() {
  console.log(`Updating vibes for ${vibesData.length} venues...`);

  let updated = 0;
  let notFound = 0;

  for (const { slug, vibes } of vibesData) {
    const { error, count } = await supabase
      .from('venues')
      .update({ vibes })
      .eq('slug', slug);

    if (error) {
      console.error(`Error updating ${slug}:`, error.message);
    } else {
      updated++;
    }
  }

  console.log(`Done! Updated ${updated} venues.`);
}

main();
