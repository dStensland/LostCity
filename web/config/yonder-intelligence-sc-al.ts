import type { YonderDestinationIntelligence } from "./yonder-destination-intelligence";

export const YONDER_SC_AL_INTELLIGENCE: YonderDestinationIntelligence[] = [
  // ── South Carolina ──────────────────────────────────────────────────────────

  {
    slug: "caesars-head-state-park",
    name: "Caesars Head State Park",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 135,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season", "after-rain"],
    summary:
      "A granite overlook at 3,208 feet on the Blue Ridge Escarpment — the views drop 2,000 feet straight into the Piedmont below, and the trail system reaches multiple waterfalls on the same day.",
    practicalNotes: [
      "The overlook itself is a five-minute walk from the visitor center; budget extra time for the Raven Cliff Falls trail (4 miles round-trip) to make the drive worthwhile.",
      "Raptor migration in September and October turns this into one of the Southeast's best hawk-watching spots — thousands of birds funnel through on clear cold-front days.",
      "The escarpment gets fog and clouds regularly; check the forecast and aim for clear mornings before afternoon mist rolls in.",
    ],
    whyItMatters:
      "The freefall drop from the escarpment rim is visually unlike anything in Georgia — standing here feels like the edge of the continent.",
    questHooks: [
      "Blue Ridge Escarpment rim circuit",
      "tri-state waterfall series",
      "hawk migration fall missions",
    ],
  },

  {
    slug: "chattooga-belle-farm",
    name: "Chattooga Belle Farm",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "farm",
    primaryActivity: "agritourism",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["clear-day", "summer-friendly", "leaf-season"],
    summary:
      "A mountain farm at 2,000 feet on the edge of the Chattooga River watershed — u-pick berries, a working distillery, and mountain views that justify the drive on their own.",
    practicalNotes: [
      "Berry season runs May through August depending on variety; call ahead or check their site for what's currently ripe before making the trip.",
      "The distillery tasting room is open most days — their brandy and fruit spirits are genuinely worth trying, not just a curiosity.",
      "Pair with a stop at nearby Stumphouse Tunnel or Issaqueena Falls to turn this into a full scenic day rather than a single-stop destination.",
    ],
    whyItMatters:
      "Mountain agritourism rarely comes with this much scenery — the elevation and landscape make Chattooga Belle feel distinctly different from the flatland pick-your-own farms closer to Atlanta.",
    questHooks: [
      "Blue Ridge farm-and-forage circuit",
      "mountain artisan distillery trail",
      "seasonal harvest day-trips",
    ],
  },

  {
    slug: "cherokee-foothills-scenic-hwy",
    name: "Cherokee Foothills Scenic Highway (SC-11)",
    launchWave: "wave6",
    commitmentTier: "weekend",
    destinationType: "scenic_drive",
    primaryActivity: "scenic_drive",
    difficultyLevel: "easy",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 600,
    bestSeasons: ["spring", "fall"],
    weatherFitTags: ["clear-day", "leaf-season", "cool-weather"],
    summary:
      "A 110-mile state scenic byway along the base of the Blue Ridge in South Carolina — connecting Gaffney to the Georgia border through peach orchards, rivers, and mountain foothills.",
    practicalNotes: [
      "This is a full weekend drive, not a day-trip detour — the route threads together eight state parks, multiple waterfalls, and historic towns best explored with overnight stops in the area.",
      "Fall color (mid-October) and spring wildflower season are the peak windows; summer is pleasant but the real visual drama is in those two shoulder seasons.",
      "Oconee State Park and Table Rock State Park make ideal base camps for exploring the corridor — both have camping and cabin options via ReserveAmerica.",
    ],
    whyItMatters:
      "SC-11 is one of the most underrated scenic drives in the Southeast — most Atlantans default to Blue Ridge Parkway but this runs parallel and far less traveled.",
    questHooks: [
      "Southeast scenic byway collection",
      "Blue Ridge foothills corridor weekend",
      "state park hop along SC-11",
    ],
  },

  {
    slug: "congaree-national-park",
    name: "Congaree National Park",
    launchWave: "wave6",
    commitmentTier: "weekend",
    destinationType: "national_park",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 600,
    bestSeasons: ["fall", "winter", "spring"],
    weatherFitTags: ["cool-weather", "all-season", "after-rain"],
    summary:
      "The largest intact expanse of old-growth bottomland hardwood forest in the United States — ancient trees, elevated boardwalks over floodplain, and a sky-canopy that feels prehistoric.",
    practicalNotes: [
      "The park floods frequently; check current conditions before going — the boardwalk trail is impassable when water levels are high, but the flooding is also part of the ecological spectacle.",
      "Summer heat and mosquitoes are genuinely brutal — fall through spring is by far the better window for comfortable hiking.",
      "The synchronous firefly event in late May/early June (lottery-entry only) is one of the rarest natural phenomena in the region and worth planning a trip around separately.",
    ],
    whyItMatters:
      "This is old-growth forest on a scale that no longer exists anywhere else in the Southeast — some of the champion trees here were standing when the country was founded.",
    questHooks: [
      "Southeast national park checklist",
      "old-growth forest pilgrimage",
      "synchronous firefly bucket list",
    ],
  },

  {
    slug: "croft-state-park",
    name: "Croft State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["all-season", "cool-weather", "clear-day"],
    summary:
      "A converted WWII training base turned 7,000-acre park near Spartanburg — equestrian trails, fishing lakes, and enough trail mileage to get genuinely lost in for a few hours.",
    practicalNotes: [
      "This park is built around equestrian use — trail surfaces and layout reflect that, which actually makes them pleasant for hikers who prefer wider, well-maintained paths.",
      "Three lakes in the park offer fishing and paddling; bring a canoe or rent from the park for a different pace than the trails.",
      "Spartanburg has a surprisingly strong food and brewery scene — turn this into a half-day park, half-day town trip for a full Saturday.",
    ],
    whyItMatters:
      "Croft is far larger and wilder than its proximity to a mid-size city would suggest — a useful discovery for anyone willing to drive past the obvious Upstate SC stops.",
    questHooks: [
      "Upstate SC undiscovered parks",
      "fishing-and-trails combo days",
      "WWII history meets natural landscape",
    ],
  },

  {
    slug: "devils-fork-state-park",
    name: "Devils Fork State Park",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "state_park",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["clear-day", "summer-friendly", "leaf-season"],
    summary:
      "The only public access point to Lake Jocassee from the South Carolina side — clear water, submerged waterfalls, and Blue Ridge mountain views from the water.",
    practicalNotes: [
      "The park itself is small; the draw is lake access for kayaking, fishing, and swimming in exceptionally clear water with underwater visibility of 20+ feet.",
      "Boat rentals are available at the park, but the lake rewards those who bring their own kayak — the submerged waterfalls and coves are best explored at a slow pace.",
      "Summer fills the parking lot early on weekends; arrive by 9am or risk being turned away.",
    ],
    whyItMatters:
      "Lake Jocassee's clarity and the submerged waterfall geology make it feel unlike any lake in Georgia — worth the drive specifically for the water experience.",
    questHooks: [
      "Jocassee Gorges paddle circuit",
      "crystal-clear mountain lakes",
      "underwater waterfall exploration",
    ],
  },

  {
    slug: "jones-gap-state-park",
    name: "Jones Gap State Park",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 135,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "A mountain gorge park in the Jocassee Gorges corridor with a creek-side trail system, multiple waterfalls, and a trailhead that connects into the larger Middle Saluda River watershed.",
    practicalNotes: [
      "The Middle Saluda River trail follows the creek for miles — waterfall volume rewards a visit after good rainfall, which also cools the gorge in warmer months.",
      "This is a fee-based park with a required registration at the trailhead; bring cash or a card.",
      "Combine with Caesars Head (30 minutes away) for a full Jocassee Gorges day — the two parks share the same watershed and the contrast between gorge floor and escarpment rim is striking.",
    ],
    whyItMatters:
      "Jones Gap is the quieter companion to Caesars Head — fewer crowds, creek-side atmosphere, and waterfall hiking that rewards the extra effort to get here.",
    questHooks: [
      "Jocassee Gorges deep-dive weekend",
      "SC waterfall gorge trail series",
      "cool-weather creek-walking circuit",
    ],
  },

  {
    slug: "keowee-toxaway-state-park",
    name: "Keowee-Toxaway State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "A compact lakeside park on the northern shore of Lake Keowee with Cherokee history, a natural bridge, and mountain lake views accessible on easy trail loops.",
    practicalNotes: [
      "The Raven Rock Trail (4.5 miles) is the park's signature — it passes a natural bridge and reaches lake overlooks that are most dramatic in clear weather.",
      "Lake Keowee is ringed by private development, making this park one of the only public access points to the water for non-residents.",
      "Interpretive exhibits on the Cherokee town of Keowee, submerged beneath the lake, are worth reading — the park's landscape carries real historical weight.",
    ],
    whyItMatters:
      "The Cherokee history layered into this landscape — including a town that now lies beneath the lake — gives Keowee-Toxaway a depth that the scenic payoff alone would justify.",
    questHooks: [
      "Cherokee heritage landscape series",
      "Lake Keowee public access run",
      "Upstate SC natural bridge finds",
    ],
  },

  {
    slug: "kings-mountain-state-park",
    name: "Kings Mountain State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 210,
    bestSeasons: ["fall", "winter", "spring"],
    weatherFitTags: ["cool-weather", "leaf-season", "clear-day"],
    summary:
      "A Revolutionary War battlefield and state park on the SC-NC border — backcountry trails, a working living history farm, and the ridge terrain that determined the outcome of a pivotal 1780 battle.",
    practicalNotes: [
      "The adjacent Kings Mountain National Military Park (no entrance fee) has the battlefield and interpretive center — visit both for the full historical picture before hitting the trails.",
      "Trail conditions can be muddy after rain; the ridgeline trails drain well but creek-bottom sections stay wet.",
      "The historic Catawba River Nature Center and the park's living history farm add programming on weekends that makes this more than a hiking-only stop.",
    ],
    whyItMatters:
      "The battle fought here effectively turned the momentum of the Revolutionary War in the South — hiking these ridges carries historical weight that most trailheads don't.",
    questHooks: [
      "Revolutionary War battlefield hiking",
      "SC-NC border ridge traverses",
      "living history + trails combo days",
    ],
  },

  {
    slug: "lake-jocassee",
    name: "Lake Jocassee",
    launchWave: "wave6",
    commitmentTier: "weekend",
    destinationType: "lake",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 600,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["clear-day", "summer-friendly", "leaf-season"],
    summary:
      "A crystal-clear mountain reservoir in the Jocassee Gorges — waterfalls that cascade directly into the lake, 75 miles of undeveloped shoreline, and water so clear you can see the bottom in 30 feet.",
    practicalNotes: [
      "The best experience here is by boat — rent a pontoon or bring your own kayak to reach the hidden waterfalls and coves unreachable by land.",
      "Lake temperatures stay cold enough for swimming to feel genuinely refreshing even in July; the water clarity is remarkable at any depth.",
      "Camping at Laurel Fork Heritage Preserve and nearby Table Rock State Park provides a base for a multi-day Jocassee Gorges trip — plan this as a full weekend, not a day trip.",
    ],
    whyItMatters:
      "Jocassee is frequently called the most beautiful lake in the Southeast — the combination of clarity, mountain backdrop, and waterfalls falling directly into the water is legitimately unusual.",
    questHooks: [
      "Jocassee Gorges multi-day expedition",
      "Southeast's clearest lakes",
      "waterfall kayak circuit",
    ],
  },

  {
    slug: "oconee-state-park",
    name: "Oconee State Park",
    launchWave: "wave6",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 600,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "leaf-season", "cool-weather"],
    summary:
      "A classic CCC-built mountain park in the Sumter National Forest — two lakes, cabin-style lodges, and a trailhead connecting into the Foothills Trail system.",
    practicalNotes: [
      "The cabins here are genuine CCC-era structures from the 1930s — rustic, well-maintained, and among the most atmospheric state park lodging in the Carolinas. Book far in advance.",
      "The Foothills Trail — a 76-mile backcountry route — starts near the park; even hiking the first few miles into the Chattooga watershed rewards the drive.",
      "Lake swimming is available in summer and the surrounding national forest terrain gives this more depth than the park boundaries suggest.",
    ],
    whyItMatters:
      "The CCC cabin stock here is genuinely special — a weekend at Oconee delivers the full mountain escape package without driving to Tennessee or North Carolina.",
    questHooks: [
      "CCC cabin heritage weekends",
      "Foothills Trail entry points",
      "SC national forest overnight circuit",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "cabin_capable",
      inventoryNote:
        "CCC-era cabins are the standout inventory here — high demand, book well in advance for peak season.",
      stayOptions: [
        {
          unitType: "cabin",
          label: "Historic CCC Cabins",
          summary: "1930s-era Civilian Conservation Corps cabins, rustic and atmospheric.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Standard park camping adjacent to the lake and national forest trailheads.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "focused",
        leadTime: "book_early",
        priceSignal: "$$",
        comparisonNote:
          "Cabin demand is high and supply is limited — treat this like a competitive state-park weekend that requires early planning.",
      },
    },
  },

  {
    slug: "paris-mountain-state-park",
    name: "Paris Mountain State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["cool-weather", "clear-day", "leaf-season"],
    summary:
      "A forested mountain park on the outskirts of Greenville — 15 miles of trail, lake swimming, and a CCC reservoir that makes for a surprisingly complete escape just minutes from downtown.",
    practicalNotes: [
      "The Summit Trail (4.4 miles to the fire tower) is the main event — a genuine workout with views of the Greenville skyline and Blue Ridge foothills on clear days.",
      "Lake Placid in the park is open for swimming in summer and has a pleasant beach area for a low-key finish after the hike.",
      "Combine with Greenville's Falls Park on the Reedy and the walkable downtown to make this a full-day trip rather than just a trail stop.",
    ],
    whyItMatters:
      "Paris Mountain punches well above its size — it's a real mountain park inside a city's footprint, and the trail quality reflects decades of intentional investment.",
    questHooks: [
      "Greenville day-trip outdoor anchor",
      "urban mountain park circuit",
      "CCC reservoir trail collection",
    ],
  },

  {
    slug: "stumphouse-tunnel-issaqueena-falls",
    name: "Stumphouse Tunnel & Issaqueena Falls",
    launchWave: "wave6",
    commitmentTier: "hour",
    destinationType: "landmark",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 75,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["all-season", "after-rain", "summer-friendly"],
    summary:
      "An unfinished 1850s railroad tunnel bored into blue granite and a 100-foot waterfall 200 yards away — two genuinely unusual things in less than half a mile of walking.",
    practicalNotes: [
      "The tunnel is open to walk into; bring a flashlight — it's 1,617 feet long and pitch black past the first hundred yards.",
      "Issaqueena Falls drops 100 feet to a narrow gorge; the overlook view is dramatic and the short trail to the base rewards the few minutes it takes.",
      "This is a natural add-on to Oconee State Park or Chattooga Belle Farm rather than a standalone destination — three sites in one area justifies the drive.",
    ],
    whyItMatters:
      "The tunnel alone is a legitimately strange and memorable place — walking into 150-year-old granite darkness next to a waterfall is not something most people expect to find in the South Carolina foothills.",
    questHooks: [
      "abandoned infrastructure + nature combos",
      "Walhalla area micro-loop",
      "waterfall hits under an hour",
    ],
  },

  {
    slug: "twin-falls-eastatoe",
    name: "Twin Falls (Eastatoe Gorge)",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "moderate",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "Two waterfalls dropping into the same gorge — Reedy Cove Falls and Lower Reedy Cove Falls — on a creek-side trail through the Eastatoe Creek Heritage Preserve.",
    practicalNotes: [
      "The trail is about 2 miles round-trip but involves multiple creek crossings that can be wet or tricky in high water — wear waterproof footwear.",
      "Water volume is the key variable; the falls are dramatically better after several days of rain than in dry summer conditions.",
      "The heritage preserve has no facilities — pack in and pack out, and check current trail conditions before going.",
    ],
    whyItMatters:
      "Eastatoe Gorge sits inside one of the most biologically rich natural areas in the Carolinas — the waterfalls are the hook, but the creek ecosystem is the real story.",
    questHooks: [
      "Jocassee Gorges waterfall series",
      "heritage preserve trail collection",
      "creek-crossing adventure hikes",
    ],
  },

  {
    slug: "yellow-branch-falls",
    name: "Yellow Branch Falls",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "A 50-foot wide curtain waterfall at the end of a 1.5-mile walk through Sumter National Forest near Walhalla — wide, graceful, and significantly less visited than the bigger-name falls in the area.",
    practicalNotes: [
      "The trail is well-maintained and gradual — one of the more accessible waterfall hikes in the Upstate with a genuinely rewarding payoff for the effort.",
      "The falls are widest in spring and after rain; they thin considerably by midsummer in dry years.",
      "Walhalla is a good lunch stop before or after — a small historic town with a few solid local options and the Oconee Brewing Company.",
    ],
    whyItMatters:
      "Yellow Branch doesn't appear on most waterfall lists, which is exactly what makes it worth going to — a broad, beautiful falls with a fraction of the foot traffic of its Upstate competitors.",
    questHooks: [
      "underrated SC waterfall finds",
      "Sumter National Forest trail series",
      "Walhalla area day-trip loop",
    ],
  },

  // ── Alabama ─────────────────────────────────────────────────────────────────

  {
    slug: "cathedral-caverns-state-park",
    name: "Cathedral Caverns State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "cavern",
    primaryActivity: "caving",
    difficultyLevel: "easy",
    driveTimeMinutes: 150,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["all-season", "summer-friendly", "cool-weather"],
    summary:
      "A cavern with one of the largest cave entrances in the world — the opening is 126 feet wide and 25 feet tall, and the interior holds massive stalagmite columns and the largest stalagmite forest on record.",
    practicalNotes: [
      "Tours run on a fixed schedule; check the park's hours in advance since this is a ranger-led experience, not self-guided.",
      "The cave maintains a constant 60°F year-round, making it a legitimate summer escape when surface temperatures are brutal — bring a layer regardless.",
      "Visitors with mobility concerns should know the tour is on paved paths throughout — Cathedral Caverns is one of the most accessible cave experiences in the region.",
    ],
    whyItMatters:
      "The entrance alone justifies the trip — 'one of the largest cave openings in the world' sounds like tourism copy until you're standing inside looking back out.",
    questHooks: [
      "Southeast cavern circuit",
      "world-record natural features",
      "summer heat-escape underground",
    ],
  },

  {
    slug: "cheaha-state-park",
    name: "Cheaha State Park",
    launchWave: "wave6",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 600,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season", "sunrise-friendly"],
    summary:
      "Alabama's highest point at 2,407 feet — the park sits at the summit with sweeping Talladega National Forest views, rock scramble trails, and some of the best sunrise access of any Alabama park.",
    practicalNotes: [
      "The Pulpit Rock and Bald Rock trails (short but with significant rock scramble sections) deliver the best views in the park; Bald Rock is accessible to all fitness levels.",
      "Fall foliage here peaks in late October — the elevated position gives you views across the canopy that most Alabama hiking can't match.",
      "The park has cabins, a lodge, and camping; the lodge balcony restaurant has coffee and mountain views in the morning, making this an unusually comfortable overnight.",
    ],
    whyItMatters:
      "Most people don't think of Alabama as mountain country — Cheaha corrects that assumption with genuine summit terrain and national forest scale.",
    questHooks: [
      "Alabama high points collection",
      "Southern Appalachian tail-end peaks",
      "Talladega Forest weekend basecamp",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin", "lodge"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "lodge_capable",
      inventoryNote:
        "The lodge and cabins make Cheaha the most comfortable overnight in the Alabama state park system — high demand in fall.",
      stayOptions: [
        {
          unitType: "lodge_room",
          label: "Cheaha Resort Lodge",
          summary: "Summit lodge with mountain views — the highest-comfort overnight option in Alabama state parks.",
          bookingSurface: "direct_lodge",
        },
        {
          unitType: "cabin",
          label: "Chalets & Cabins",
          summary: "Mountain chalets with views; range from rustic to renovated.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "High-elevation camping at the summit for a full mountain experience.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "broad",
        leadTime: "book_early",
        priceSignal: "$$",
        comparisonNote:
          "Broadest overnight inventory of any Alabama state park; fall weekends and holidays require early booking.",
      },
    },
  },

  {
    slug: "coldwater-mountain",
    name: "Coldwater Mountain",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "trail",
    primaryActivity: "mountain_biking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 135,
    typicalDurationMinutes: 360,
    bestSeasons: ["fall", "winter", "spring"],
    weatherFitTags: ["dry-weather", "cool-weather", "clear-day"],
    summary:
      "An IMBA-designed trail system in the Anniston area with 30+ miles of flow trails, technical sections, and Appalachian foothills terrain that rivals anything in the Southeast.",
    practicalNotes: [
      "The trail system was purpose-built with professional trail design — grades, drainage, and berms are all intentional, which shows in how well it rides after rain compared to natural trails.",
      "Skill levels range widely; the green flow trails are genuinely fun for intermediate riders while the black diamond sections can challenge experts.",
      "Anniston has a surprisingly good food scene for its size — Oxford Exchange and a few local spots make for a solid post-ride stop.",
    ],
    whyItMatters:
      "Coldwater Mountain is quietly one of the best mountain bike destinations in the region — the trail quality is professional-grade and the Appalachian foothills terrain is more diverse than most Alabama riding.",
    questHooks: [
      "Southeast mountain bike trail circuit",
      "Alabama trail system sampler",
      "flow trail hunting across the South",
    ],
  },

  {
    slug: "desoto-caverns",
    name: "DeSoto Caverns",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "cavern",
    primaryActivity: "caving",
    difficultyLevel: "easy",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 360,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["all-season", "summer-friendly", "cool-weather"],
    summary:
      "A massive onyx cavern used by Indigenous peoples for over 2,000 years, with a light-and-sound show in the main chamber and a family-friendly outdoor activity park on the surface.",
    practicalNotes: [
      "The cave tour includes a narrated light show in the Great Onyx Chamber — it's theatrical but the cave itself is genuinely impressive, one of the largest cave chambers in the East.",
      "The outdoor attraction park (mazes, mining sluice, water activities) skews family-oriented but extends the visit significantly if you're traveling with kids.",
      "The cave maintains a constant 60°F; the park on the surface is fully exposed — dress in layers if you're doing both.",
    ],
    whyItMatters:
      "The Great Onyx Chamber is legitimately one of the largest cave rooms in the eastern United States — the showmanship around it shouldn't obscure that the geology is the real thing.",
    questHooks: [
      "Alabama cave circuit",
      "Indigenous history underground",
      "family geology adventure trail",
    ],
  },

  {
    slug: "dismals-canyon",
    name: "Dismals Canyon",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "canyon",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 360,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["cool-weather", "after-rain", "summer-friendly"],
    summary:
      "A sandstone canyon in northwest Alabama sheltering a microclimate of ferns, waterfalls, swimming holes, and — uniquely — 'dismalites,' bioluminescent larvae that glow blue-green in the dark.",
    practicalNotes: [
      "The dismalites (glow worms) are the most unusual feature; night tours run on specific schedules in spring and summer — book in advance if that's your target.",
      "The canyon walls and canopy create a significantly cooler microclimate than the surrounding landscape; it can feel 15-20°F cooler inside the canyon in summer.",
      "The property is privately owned with a fee; it operates as a nature preserve with camping and cabin rentals for overnight stays.",
    ],
    whyItMatters:
      "Bioluminescent glow worms are not common in North America — Dismals Canyon is one of a handful of places in the US where you can see them, and the canyon itself is striking independent of the light show.",
    questHooks: [
      "bioluminescence bucket list",
      "Alabama canyon microclimate exploration",
      "rare natural phenomena circuit",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "operator_direct",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "Private preserve with camping and cabins; book directly — required for nighttime dismalite tours.",
      stayOptions: [
        {
          unitType: "cabin",
          label: "Canyon Cabins",
          summary: "Private-preserve cabins near the canyon rim; required for night tour access.",
          bookingSurface: "operator_direct",
        },
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Canyon camping with access to the dismalite viewing areas after dark.",
          bookingSurface: "operator_direct",
        },
      ],
      stayProfile: {
        inventoryDepth: "focused",
        leadTime: "book_early",
        priceSignal: "$$",
        comparisonNote:
          "Private preserve inventory is limited; night tour dates book out early in spring and summer.",
      },
    },
  },

  {
    slug: "lake-martin-al",
    name: "Lake Martin",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "lake",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 210,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["clear-day", "summer-friendly", "leaf-season"],
    summary:
      "A 40,000-acre reservoir in the Alabama Piedmont with 750 miles of shoreline, clear water, and the kind of boat-culture lake town (Alexander City) that builds a good weekend around.",
    practicalNotes: [
      "Lake Martin is primarily a boating and water-sports lake — kayaking and paddleboarding work from public access points, but a motorboat or pontoon rental opens the full experience.",
      "Wind Creek State Park on the eastern shore is the best public-land base for swimming, camping, and non-motorized paddling without renting a slip.",
      "Alexander City has a small-town food and shop scene concentrated on Highway 280 — Sinclair's is the local dining anchor worth knowing about.",
    ],
    whyItMatters:
      "Lake Martin delivers full-scale lake recreation without the Tennessee crowds — a three-hour drive from Atlanta gets you to a genuinely large and beautiful body of water.",
    questHooks: [
      "Alabama lake weekend circuit",
      "southeastern reservoir paddling list",
      "boat-town half-day getaways",
    ],
  },

  {
    slug: "little-river-canyon-national-preserve",
    name: "Little River Canyon National Preserve",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "canyon",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 240,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season", "after-rain"],
    summary:
      "A 600-foot sandstone canyon carved by the Little River — one of the longest mountaintop rivers in North America — with a scenic rim drive, waterfalls, and canyon-floor trail access.",
    practicalNotes: [
      "The Canyon Rim Parkway (11 miles) delivers overlook views without any hiking; the trailhead for the canyon floor descent adds significant elevation change and a different landscape entirely.",
      "Little River Falls at the canyon's head is the signature photo stop — best volume in spring and after rain, thin in late summer drought.",
      "Fort Payne, adjacent to the preserve, has a handful of dining options and is worth a quick stop — it's also the hometown of the band Alabama, if that's your kind of trivia.",
    ],
    whyItMatters:
      "A river running along a mountain plateau long enough to carve a 600-foot canyon is geologically unusual — Little River Canyon is one of the genuinely distinctive natural features in the South.",
    questHooks: [
      "Alabama canyon rim drives",
      "mountaintop river geology",
      "Northeast Alabama national lands circuit",
    ],
  },

  {
    slug: "monte-sano-state-park",
    name: "Monte Sano State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 240,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "A mountain park on the plateau above Huntsville with 20 miles of trails, historic stone structures, and views across the Tennessee Valley that reward the climb.",
    practicalNotes: [
      "Monte Sano means 'Mountain of Health' in Spanish — the plateau sits 1,100 feet above Huntsville and the temperature difference is noticeable on summer days.",
      "The Burritt on the Mountain historic site (adjacent to the park) is worth adding to the visit — a Depression-era mansion with period farmstead buildings and valley views.",
      "Huntsville is a legitimate city-stop with a strong restaurant scene and the U.S. Space & Rocket Center on the way in or out.",
    ],
    whyItMatters:
      "Monte Sano transforms a Huntsville drive into a mountain day — the park quality and trail system are well above what most people expect from an Alabama urban park.",
    questHooks: [
      "Tennessee Valley rim overlooks",
      "Huntsville outdoor anchor days",
      "CCC stone structure trail series",
    ],
  },

  {
    slug: "noccalula-falls-park",
    name: "Noccalula Falls Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "easy",
    driveTimeMinutes: 90,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "all-season"],
    summary:
      "A 90-foot waterfall in Black Creek Gorge inside Gadsden — the closest large waterfall to Atlanta that requires no mountain driving, accessible by city street.",
    practicalNotes: [
      "The gorge trail descends into the canyon below the falls for a completely different perspective — plan time for both the overlook and the canyon floor.",
      "Flow is highly variable; after significant rain the falls are dramatic, but in summer drought years they can be thin. Check recent rainfall before going.",
      "The park also has a botanical garden, petting zoo, and historic pioneer village — more to do than a typical waterfall stop, though the falls are clearly the main event.",
    ],
    whyItMatters:
      "A 90-foot urban waterfall 90 minutes from Atlanta that most people don't know exists — the closest significant waterfall to the city that doesn't require mountain roads.",
    questHooks: [
      "closest waterfalls to Atlanta",
      "easy-access gorge drops",
      "Alabama nature finds under two hours",
    ],
  },

  {
    slug: "oak-mountain-state-park",
    name: "Oak Mountain State Park",
    launchWave: "wave6",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 240,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["cool-weather", "clear-day", "leaf-season"],
    summary:
      "Alabama's largest state park at 9,940 acres on the southern edge of Birmingham — ridge trails, a mountain bike system, two lakes, a raptor center, and enough terrain to fill multiple visits.",
    practicalNotes: [
      "The park has a dedicated mountain bike trail system (separate from hiking trails) and a disc golf course — more activity variety than almost any other park in the region.",
      "The Alabama Wildlife Center on-site rehabilitates raptors and native wildlife; the up-close encounters with eagles and owls are an unexpected bonus.",
      "Birmingham's food scene has genuinely leveled up — treat this as a park-plus-city day with a dinner stop in Avondale or Five Points South.",
    ],
    whyItMatters:
      "The sheer size and infrastructure of Oak Mountain — in the middle of Alabama's largest metro — makes it a model for what an urban state park can be.",
    questHooks: [
      "Alabama's biggest park checklist",
      "Birmingham outdoor-to-dinner days",
      "Southeast urban state park comparison",
    ],
  },

  {
    slug: "sipsey-wilderness-bankhead-nf",
    name: "Sipsey Wilderness (Bankhead National Forest)",
    launchWave: "wave6",
    commitmentTier: "fullday",
    destinationType: "wilderness",
    primaryActivity: "hiking",
    difficultyLevel: "hard",
    driveTimeMinutes: 180,
    typicalDurationMinutes: 420,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "The largest federally designated wilderness in Alabama — a sandstone canyon system with old-growth hemlock, waterfalls, and the Sipsey River threading through sandstone bluffs.",
    practicalNotes: [
      "This is real wilderness: no maintained facilities, trails can be unmarked, and the creek crossings are genuine — waterproof boots and navigation skills matter here.",
      "Sipsey Fork waterfalls are the anchor — the canyon walls and hemlock groves make this feel like Appalachian wilderness in miniature, an experience that surprises most visitors.",
      "Overcrowding has become a problem on spring and fall weekends; the trailhead parking fills early. Arrive by 7am or plan a midweek visit.",
    ],
    whyItMatters:
      "Old-growth hemlock in a sandstone canyon system is not what people expect to find in Alabama — Sipsey is the region's best-kept wilderness secret and one of the genuine natural gems of the South.",
    questHooks: [
      "Alabama wilderness designation circuit",
      "old-growth canyon waterfall hunting",
      "Southeast wilderness beginner expeditions",
    ],
  },
];
