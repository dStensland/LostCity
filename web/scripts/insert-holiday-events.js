const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SUPABASE_URL = "https://rtppvljfrkjtoxmaizea.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDMzMTQsImV4cCI6MjA4MzcxOTMxNH0.KN1csOc0xOTDb3VSz5LgT-tMrcQNxOHNmp0yWsa83Wg";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PORTAL_ID = "74c2f211-ee11-453d-8386-ac2861705695";
const SOURCE_ID = 783;

// Venue IDs from lookup
const VENUE_GEORGIA_TECH = 627;

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

const events = [
  // ===== RAMADAN EVENTS =====
  {
    title: "Atlanta Suhoor Festival",
    start_date: "2026-02-20",
    start_time: "22:00:00",
    end_date: "2026-02-21",
    end_time: "05:00:00",
    category: "festival",
    description:
      "THE BIGGEST HALAL FOOD FEST IN ATLANTA — 20,000+ expected visitors. 120+ food/dessert vendors: Mediterranean, Pakistani, Bengali, tacos, burgers, wings, BBQ, sushi, Asian fusion, street food, and viral desserts including kunafa. Horse dance performances, horseback riding, live cooking demos. Family-friendly, all ages. Also Feb 21.",
    tags: ["ramadan", "festival", "food", "high-energy", "all-ages", "ticketed"],
    is_free: false,
    price_min: 11,
    price_max: 17,
    source_url:
      "https://www.eventbrite.com/e/atlanta-suhoor-festival-tickets-1982313466942",
    ticket_url:
      "https://www.eventbrite.com/e/atlanta-suhoor-festival-tickets-1982313466942",
    venue_id: null,
  },
  {
    title: "Atlanta Ramadan Food Festival",
    start_date: "2026-02-27",
    start_time: "21:00:00",
    end_time: "06:00:00",
    category: "festival",
    description:
      "Outdoor late-night celebration of faith, food, and community during Ramadan. Curated halal food vendors from across the Southeast with no menu overlap. Partnering with Waffle House for a custom waffle bar — first 500 ticket buyers get free waffles. Limited tickets.",
    tags: ["ramadan", "festival", "food", "high-energy", "ticketed"],
    is_free: false,
    source_url:
      "https://www.atlantamuslimfestivalcollective.com/atlanta-ramadan-food-festival",
    venue_id: null,
  },
  {
    title: "Mashawi Mediterranean Iftar Buffet",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "food",
    description:
      "Billed as the largest iftar buffet in the state. Grand feast of authentic Eastern/Mediterranean cuisine, refreshing juices, and delightful desserts. $39.99/adult, $20/kids 5-9, 4 and under free. Nightly during Ramadan. Reservations recommended.",
    tags: ["ramadan", "food", "ticketed"],
    is_free: false,
    price_min: 20,
    price_max: 40,
    price_note: "$39.99/adult, $20/kids 5-9, 4 and under free",
    source_url: "https://mashawimediterranean.com/",
    venue_id: null,
  },
  {
    title: "Namak Iftar Buffet",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "food",
    description:
      "Authentic Pakistani halal iftar buffet at Namak in Alpharetta. $29.99/adult, kids 5 and under free. Nightly during Ramadan.",
    tags: ["ramadan", "food", "ticketed"],
    is_free: false,
    price_min: 30,
    price_max: 30,
    price_note: "$29.99/adult, kids 5 and under free",
    source_url: "https://www.yelp.com/biz/namak-restaurant-alpharetta",
    venue_id: null,
  },
  {
    title: "Kabul Kabob All-You-Can-Eat Iftar Buffet",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "food",
    description:
      "Afghan cuisine iftar buffet with all-you-can-eat for $30/person. Available Fridays, Saturdays, and Sundays during Ramadan. Reservations recommended: (470) 282-1767.",
    tags: ["ramadan", "food", "ticketed"],
    is_free: false,
    price_min: 30,
    price_max: 30,
    source_url: "https://www.kabulkabobga.com",
    venue_id: null,
  },
  {
    title: "Zouq Restaurant Iftar Buffet",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "food",
    description:
      "Affordable halal Pakistani/Indian iftar buffet at Zouq in Duluth. Historically $14.99/person. Nightly during Ramadan.",
    tags: ["ramadan", "food", "ticketed"],
    is_free: false,
    price_min: 15,
    price_max: 15,
    source_url: "https://www.zouqatl.com/",
    venue_id: null,
  },
  {
    title: "The Peri Peri Grill Ramadan Iftar Box",
    start_date: "2026-02-28",
    start_time: "17:00:00",
    category: "food",
    description:
      "Special iftar box with chicken over rice, 2 samosas, date, gulab jamun, and drink for $13.99. Halal-certified African-Portuguese cuisine in downtown Atlanta, near Olympic Park. Available during Ramadan.",
    tags: ["ramadan", "food"],
    is_free: false,
    price_min: 14,
    price_max: 14,
    price_note: "$13.99 per iftar box",
    source_url: "https://theperiperigrill.com/",
    venue_id: null,
  },
  {
    title: "ICNF Nightly Iftar & Taraweeh — Alpharetta",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "community",
    description:
      "Nightly community iftar serving 150+ people weeknights and 250+ on weekends at the Islamic Center of North Fulton, followed by Taraweeh prayers led by a Hafiz. One of the largest mosque iftars in north metro Atlanta. Free and open to all.",
    tags: ["ramadan", "free", "community", "food"],
    is_free: true,
    source_url: "https://icnf.org/",
    venue_id: null,
  },
  {
    title: "Georgia Tech MSA Campus Iftars",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "community",
    description:
      "Georgia Tech's Muslim Students Association organizes community iftars providing warm, nourishing meals to students throughout Ramadan. Free and open to Georgia Tech students, faculty, and staff.",
    tags: ["ramadan", "free", "community", "food", "university"],
    is_free: true,
    source_url: "https://www.georgiatechmsa.com/",
    venue_id: VENUE_GEORGIA_TECH,
  },
  {
    title: "Roswell Community Masjid Ramadan Iftars & Youth Qiyaam",
    start_date: "2026-02-28",
    start_time: "18:00:00",
    category: "community",
    description:
      "RCM hosts iftars and participates in the Urban Ummah Iftar Series on Thursdays. Also runs 'UpLift' Qiyaam nights during Ramadan for youth (rising 9th graders+) with team games, Xbox tournaments, catering, and arts & crafts.",
    tags: ["ramadan", "free", "community", "food", "all-ages"],
    is_free: true,
    source_url: "https://roswellmasjid.org/",
    venue_id: null,
  },

  // ===== HOLI EVENTS =====
  {
    title: "Simply Vedic Festival of Colors",
    start_date: "2026-04-04",
    start_time: "11:00:00",
    category: "festival",
    description:
      "Annual outdoor Festival of Colors celebrating the arrival of spring. Organic, safe, dry colors supplied on-site — outside colors strictly prohibited. Free admission; organic color bags $2.50 donation each. Family-friendly, open to all.",
    tags: [
      "holi",
      "festival",
      "free",
      "outdoor",
      "family-friendly",
      "all-ages",
    ],
    is_free: true,
    source_url: "https://www.thefestivalofcolors.org/",
    venue_id: null,
  },
  {
    title: "Holi Dahan and Holi Purnima Katha at Sanatan Mandir",
    start_date: "2026-03-08",
    start_time: "17:30:00",
    end_time: "20:30:00",
    category: "community",
    description:
      "Traditional Holika Dahan ceremony at the oldest Hindu Mandir in Atlanta. 5:30-7 PM Holi Purnima Katha, 7 PM Mangal Aarti, 7:15 PM Holi Dahan bonfire, 7:30-8:30 PM Mahaprasad community dinner. Rain or shine. Sponsorship available.",
    tags: ["holi", "free", "community", "family-friendly", "all-ages"],
    is_free: true,
    source_url:
      "https://sanatanmandiratlanta.org/upcoming-events/holi-dahan-and-holi-purnima-katha-9grxg-dljxl-rxkr7-yn7d7",
    venue_id: null,
  },
];

async function main() {
  console.log(`Inserting ${events.length} holiday events...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const event of events) {
    const content_hash = md5(event.title + event.start_date);

    const row = {
      portal_id: PORTAL_ID,
      source_id: SOURCE_ID,
      content_hash,
      is_live: true,
      extraction_confidence: 1.0,
      title: event.title,
      start_date: event.start_date,
      start_time: event.start_time || null,
      end_date: event.end_date || null,
      end_time: event.end_time || null,
      category: event.category,
      description: event.description,
      tags: event.tags,
      is_free: event.is_free,
      price_min: event.price_min || null,
      price_max: event.price_max || null,
      price_note: event.price_note || null,
      source_url: event.source_url,
      ticket_url: event.ticket_url || null,
      venue_id: event.venue_id || null,
    };

    const { data, error } = await supabase
      .from("events")
      .insert(row)
      .select("id, title");

    if (error) {
      console.log(`FAIL: "${event.title}" -- ${error.message}`);
      failCount++;
    } else if (data && data.length > 0) {
      console.log(`OK: [id=${data[0].id}] "${data[0].title}"`);
      successCount++;
    } else {
      console.log(`WARN: "${event.title}" -- no data returned (possible RLS issue)`);
      failCount++;
    }
  }

  console.log(`\n===== SUMMARY =====`);
  console.log(`Total:   ${events.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed:  ${failCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
