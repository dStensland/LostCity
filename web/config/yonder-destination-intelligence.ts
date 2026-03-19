export type YonderCommitmentTier =
  | "hour"
  | "halfday"
  | "fullday"
  | "weekend";

export type YonderDestinationType =
  | "state_park"
  | "waterfall"
  | "summit"
  | "trail"
  | "viewpoint"
  | "climbing_area"
  | "water_access"
  | "lake"
  | "river"
  | "cavern"
  | "scenic_drive"
  | "nature_center"
  | "farm"
  | "national_park"
  | "zipline_park"
  | "landmark"
  | "campground"
  | "canyon"
  | "wilderness"
  | "national_forest"
  | "park"
  | "mountain"
  | "historic_site"
  | "scenic_area"
  | "nature_preserve"
  | "community_recreation_center";

export type YonderPrimaryActivity =
  | "hiking"
  | "waterfall_hike"
  | "summit_hike"
  | "scenic_drive"
  | "climbing"
  | "camping_base"
  | "paddling"
  | "rafting"
  | "mountain_biking"
  | "tubing"
  | "caving"
  | "fishing"
  | "swimming"
  | "zip_lining"
  | "agritourism"
  | "camping"
  | "rock_climbing"
  | "disc_golf"
  | "wildlife_viewing";

export type YonderDifficultyLevel = "easy" | "moderate" | "hard";

export type YonderSeason = "spring" | "summer" | "fall" | "winter";

export type YonderWeatherFitTag =
  | "after-rain"
  | "heat-exposed"
  | "summer-friendly"
  | "cool-weather"
  | "leaf-season"
  | "clear-day"
  | "all-season"
  | "dry-weather"
  | "sunrise-friendly";

export type YonderAccommodationType =
  | "campground"
  | "cabin"
  | "lodge"
  | "operator_trip"
  | "day_use_only";

export type YonderOvernightSupport = {
  accommodationTypes: YonderAccommodationType[];
  bookingStyle:
    | "reserveamerica_park"
    | "direct_lodge"
    | "operator_direct"
    | "self_planned";
  overnightReadiness:
    | "camp_capable"
    | "cabin_capable"
    | "lodge_capable"
    | "operator_bookable"
    | "day_use_only";
  inventoryNote: string;
  stayOptions: YonderStayOption[];
  stayProfile: YonderStayProfile;
};

export type YonderStayProfile = {
  inventoryDepth: "single_mode" | "focused" | "balanced" | "broad";
  leadTime: "self_planned" | "same_week" | "book_early" | "seasonal_rush";
  priceSignal: "$" | "$$" | "$$$";
  comparisonNote: string;
};

export type YonderStayUnitType =
  | "tent_site"
  | "rv_site"
  | "cabin"
  | "lodge_room"
  | "guide_package"
  | "day_use";

export type YonderStayOption = {
  unitType: YonderStayUnitType;
  label: string;
  summary: string;
  bookingSurface:
    | "reserveamerica"
    | "direct_lodge"
    | "operator_direct"
    | "self_planned";
};

export type YonderDestinationIntelligence = {
  slug: string;
  name: string;
  launchWave: "wave1" | "wave2" | "wave3" | "wave4" | "wave5" | "wave6" | "wave7" | "wave8" | "wave9" | "wave10" | "wave11" | "wave12" | "wave13" | "wave14" | "wave15" | "wave16";
  commitmentTier: YonderCommitmentTier;
  destinationType: YonderDestinationType;
  primaryActivity: YonderPrimaryActivity;
  difficultyLevel: YonderDifficultyLevel;
  driveTimeMinutes: number;
  typicalDurationMinutes: number;
  bestSeasons: YonderSeason[];
  weatherFitTags: YonderWeatherFitTag[];
  summary: string;
  practicalNotes: string[];
  whyItMatters: string;
  questHooks: string[];
  overnightSupport?: YonderOvernightSupport;
};

export const YONDER_WAVE1_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  {
    slug: "amicalola-falls",
    name: "Amicalola Falls State Park",
    launchWave: "wave1",
    commitmentTier: "fullday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "moderate",
    driveTimeMinutes: 85,
    typicalDurationMinutes: 240,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "Georgia's tallest waterfall — a 729-foot cascade tumbling through old-growth forest, 90 minutes north of Atlanta.",
    practicalNotes: [
      "Arrive early on fall weekends; the upper parking lot fills by mid-morning.",
      "Water volume is strongest after recent rain — worth timing your trip accordingly.",
      "The approach trail involves significant stairs; plan for a steady 3-4 hour outing.",
    ],
    whyItMatters:
      "One of the most visually dramatic waterfalls in the Southeast, and the official southern approach to the Appalachian Trail.",
    questHooks: [
      "North Georgia waterfall circuit",
      "Appalachian gateway collection",
      "first real mountain-day quest",
    ],
  },
  {
    slug: "tallulah-gorge",
    name: "Tallulah Gorge State Park",
    launchWave: "wave1",
    commitmentTier: "fullday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "hard",
    driveTimeMinutes: 105,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "One of the most dramatic gorge hikes in the Southeast — 1,000-foot canyon walls, suspension bridges, and Class V rapids far below.",
    practicalNotes: [
      "Cooler months are best; the stairs and exposed sections are punishing in summer heat.",
      "Gorge-floor access requires a permit (limited daily) — check availability before you go.",
      "Budget a full day: the rim trails alone are 3+ hours, and the gorge floor adds significant time.",
    ],
    whyItMatters:
      "The scale and drama here is genuinely hard to believe until you're standing at the rim — worth the two-hour drive.",
    questHooks: [
      "Georgia canyon collection",
      "high-payoff overlook run",
      "fall-color signature trips",
    ],
  },
  {
    slug: "cloudland-canyon",
    name: "Cloudland Canyon State Park",
    launchWave: "wave1",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "moderate",
    driveTimeMinutes: 130,
    typicalDurationMinutes: 360,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "A canyon-carved state park in northwest Georgia with two waterfalls, a 1,000-foot gorge, and some of the best camping in the state.",
    practicalNotes: [
      "The canyon rim loop and waterfall descent involve significant stairs — wear real shoes.",
      "Peak weekends (fall foliage especially) book up months in advance; reserve early via ReserveAmerica.",
      "Day visitors are welcome, but staying overnight turns this into a genuinely different experience.",
    ],
    whyItMatters:
      "The canyon views rival places people fly to see — this is one of Georgia's genuine natural wonders, and it's only two hours from Atlanta.",
    questHooks: [
      "Georgia canyon weekends",
      "waterfalls plus overlooks quest",
      "first overnight-worthy escapes",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "Best treated as a camp-or-cabin state park weekend where reservations usually matter on peak dates.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Tent Sites",
          summary: "Classic park-camping option for a full canyon weekend.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Lower-friction overnight setup when you want Cloudland without full campsite logistics.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "seasonal_rush",
        priceSignal: "$$",
        comparisonNote:
          "A high-demand park on peak weekends — book tent sites and cabins well in advance, especially in fall.",
      },
    },
  },
  {
    slug: "blood-mountain",
    name: "Blood Mountain",
    launchWave: "wave1",
    commitmentTier: "fullday",
    destinationType: "summit",
    primaryActivity: "summit_hike",
    difficultyLevel: "hard",
    driveTimeMinutes: 115,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season", "heat-exposed"],

    summary:
      "Georgia's highest point on the Appalachian Trail — a demanding summit hike with exposed ridgeline views and a stone shelter at the top.",
    practicalNotes: [
      "This is a real mountain hike: 4.3 miles round-trip with 1,100 feet of elevation gain. Not a casual walk.",
      "Clear days deliver panoramic views from the summit; cloudy days are atmospheric but views are limited.",
      "The Byron Reece trailhead parking fills early on weekends — arrive by 8am.",
    ],
    whyItMatters:
      "The most iconic summit hike in the state, with the satisfaction of a genuine Appalachian Trail peak and views that earn every step.",
    questHooks: [
      "Appalachian starter pack",
      "Georgia summit ladder",
      "big-hike brag list",
    ],
  },
  {
    slug: "springer-mountain",
    name: "Springer Mountain",
    launchWave: "wave1",
    commitmentTier: "weekend",
    destinationType: "trail",
    primaryActivity: "summit_hike",
    difficultyLevel: "hard",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 360,
    bestSeasons: ["spring", "fall"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "The southern terminus of the Appalachian Trail — a 2,193-mile journey starts at this summit bronze plaque in the North Georgia mountains.",
    practicalNotes: [
      "Access is via forest road and trail — a 4WD-capable vehicle helps on the approach road, especially in wet conditions.",
      "The most common approach from Amicalola Falls adds 8.8 miles each way; plan accordingly.",
      "Spring thru-hiker season (March–April) brings a genuine energy to the summit worth experiencing.",
    ],
    whyItMatters:
      "Standing at the Appalachian Trail's southern terminus is a legitimately moving experience, even if you're only there for the day.",
    questHooks: [
      "Appalachian origin quest",
      "Georgia trail milestones",
      "future long-trail series",
    ],
    overnightSupport: {
      accommodationTypes: ["day_use_only"],
      bookingStyle: "self_planned",
      overnightReadiness: "day_use_only",
      inventoryNote:
        "This is a self-planned trail objective, not a bookable stay or managed overnight base.",
      stayOptions: [
        {
          unitType: "day_use",
          label: "Trail Objective",
          summary: "Self-planned hike or backpack-style objective rather than destination-managed lodging.",
          bookingSurface: "self_planned",
        },
      ],
      stayProfile: {
        inventoryDepth: "single_mode",
        leadTime: "self_planned",
        priceSignal: "$",
        comparisonNote:
          "No bookable lodging here — plan your own transportation and overnight logistics for a multi-day approach.",
      },
    },
  },
  {
    slug: "brasstown-bald",
    name: "Brasstown Bald",
    launchWave: "wave1",
    commitmentTier: "fullday",
    destinationType: "viewpoint",
    primaryActivity: "scenic_drive",
    difficultyLevel: "easy",
    driveTimeMinutes: 130,
    typicalDurationMinutes: 180,
    bestSeasons: ["summer", "fall", "winter"],
    weatherFitTags: ["clear-day", "leaf-season", "sunrise-friendly"],
    summary:
      "Georgia's highest peak at 4,784 feet — drive most of the way up, then walk a quarter-mile to 360-degree views across four states.",
    practicalNotes: [
      "Visibility is everything here — check the forecast before going; haze or clouds kill the payoff.",
      "A shuttle runs from the parking lot to the summit in season; otherwise it's a short steep walk.",
      "Fall foliage windows (mid-October) are the single best time to visit.",
    ],
    whyItMatters:
      "The biggest views accessible to anyone, regardless of fitness level — on a clear day you can see into the Carolinas and Tennessee.",
    questHooks: [
      "Georgia high points",
      "best scenic drives",
      "fall-color heavy hitters",
    ],
  },
  {
    slug: "raven-cliff-falls",
    name: "Raven Cliff Falls",
    launchWave: "wave1",
    commitmentTier: "fullday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "moderate",
    driveTimeMinutes: 105,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "A 5-mile round-trip through Chattahoochee National Forest to a 100-foot waterfall framed by a dramatic rock cleft.",
    practicalNotes: [
      "Water flow is best after recent rain — the falls are significantly more impressive with good volume.",
      "The trail follows Dodd Creek the entire way; some crossings may require wet feet in high water.",
      "Cooler months are most comfortable; the forest canopy makes this pleasant even in summer.",
    ],
    whyItMatters:
      "The combination of trail length, forest scenery, and the final reveal of the falls through the rock cleft makes this one of the most satisfying waterfall hikes in North Georgia.",
    questHooks: [
      "North Georgia waterfall circuit",
      "cool-weather day-hike picks",
      "best first scenic drives from Atlanta",
    ],
  },
  {
    slug: "vogel-state-park",
    name: "Vogel State Park",
    launchWave: "wave1",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 115,
    typicalDurationMinutes: 300,
    bestSeasons: ["summer", "fall"],
    weatherFitTags: ["summer-friendly", "leaf-season", "clear-day"],
    summary:
      "A mountain lake state park in the Blue Ridge foothills with hiking, swimming, and campgrounds nestled between Blood Mountain and Brasstown Bald.",
    practicalNotes: [
      "The lake is the centerpiece — swimming, fishing, and paddling all work well here.",
      "Fall weekends and summer holiday weekends book up fast; reserve via ReserveAmerica well in advance.",
      "Combine with a hike up Coosa Backcountry Trail for a full mountain day beyond the lake.",
    ],
    whyItMatters:
      "One of Georgia's most beloved state parks, with mountain scenery, lake access, and a relaxed pace that makes the two-hour drive feel worth it.",
    questHooks: [
      "mountain-lake weekends",
      "first overnight escapes",
      "low-friction scenic weekends",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "cabin_capable",
      inventoryNote:
        "One of Georgia's most-loved mountain lake parks — campgrounds and cabins both available through ReserveAmerica.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Lake-and-mountain camping base for a straightforward state-park weekend.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Best softer-landing overnight option when you want Vogel’s scenery with less setup friction.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "seasonal_rush",
        priceSignal: "$$",
        comparisonNote:
          "Strong all-around scenic overnight with enough comfort range to serve both campers and cabin-seekers.",
      },
    },
  },
  {
    slug: "fort-mountain-state-park",
    name: "Fort Mountain State Park",
    launchWave: "wave1",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "moderate",
    driveTimeMinutes: 95,
    typicalDurationMinutes: 300,
    bestSeasons: ["summer", "fall"],
    weatherFitTags: ["clear-day", "leaf-season", "cool-weather"],
    summary:
      "A mountain park in the Cohutta Highlands with an ancient stone wall, lake swimming, and over 15 miles of trails through forested ridgelines.",
    practicalNotes: [
      "The mysterious 855-foot stone wall at the summit is genuinely interesting — no one knows exactly who built it.",
      "Multiple trail loops give this more replay value than a single-attraction destination.",
      "Fall foliage here can rival the more famous parks at a fraction of the crowd.",
    ],
    whyItMatters:
      "More to explore than its reputation suggests — a strong second or third North Georgia trip for people who've already hit the obvious ones.",
    questHooks: [
      "less-obvious Georgia state parks",
      "mountain overlook loop",
      "weekend alternatives to the usual picks",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "Campgrounds and cabins available through ReserveAmerica — book early for fall weekends.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Best fit for scenic park weekends centered on trails and overlooks.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "More comfortable base for a slower overlook-and-loop weekend.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "book_early",
        priceSignal: "$$",
        comparisonNote:
          "A good alternative to the better-known parks when you want mountain scenery without the weekend crowds.",
      },
    },
  },
  {
    slug: "boat-rock",
    name: "Boat Rock",
    launchWave: "wave1",
    commitmentTier: "halfday",
    destinationType: "climbing_area",
    primaryActivity: "climbing",
    difficultyLevel: "moderate",
    driveTimeMinutes: 30,
    typicalDurationMinutes: 180,
    bestSeasons: ["fall", "winter", "spring"],
    weatherFitTags: ["dry-weather", "cool-weather", "clear-day"],
    summary:
      "A cluster of massive granite boulders in southwest Atlanta — one of the best urban bouldering spots in the South, hiding in plain sight.",
    practicalNotes: [
      "Dry weather only — the granite becomes dangerously slick when wet.",
      "No formal climbing grades are posted; newcomers should come with an experienced boulderer or do research beforehand.",
      "The area has a strong stewardship culture — leave it cleaner than you found it.",
    ],
    whyItMatters:
      "Few cities have a legitimate bouldering area 30 minutes from downtown — this one is worth knowing about whether you climb or just want to scramble around on rocks.",
    questHooks: [
      "Atlanta outdoors locals know",
      "climbing and bouldering starter path",
      "weird-and-worth-it local nature",
    ],
  },
];

export const YONDER_WAVE2_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  {
    slug: "desoto-falls",
    name: "DeSoto Falls Recreation Area",
    launchWave: "wave2",
    commitmentTier: "fullday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "moderate",
    driveTimeMinutes: 95,
    typicalDurationMinutes: 240,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "Two waterfalls in a single recreation area — an upper falls of 35 feet and a dramatic lower falls of 90 feet — connected by a forested trail.",
    practicalNotes: [
      "Water volume is strongest after recent rain; the lower falls especially rewards a post-rain visit.",
      "The trail is moderate with some rocky sections — sturdy footwear recommended.",
      "Combine with a stop at nearby Vogel or Helton Creek for a full North Georgia waterfall day.",
    ],
    whyItMatters:
      "Getting two distinct waterfalls in one stop makes this punches above its mileage — a genuinely satisfying payoff for the drive.",
    questHooks: [
      "North Georgia waterfall circuit",
      "cool-weather scenic hikes",
      "rain-week payoff trips",
    ],
  },
  {
    slug: "helton-creek-falls",
    name: "Helton Creek Falls",
    launchWave: "wave2",
    commitmentTier: "fullday",
    destinationType: "waterfall",
    primaryActivity: "waterfall_hike",
    difficultyLevel: "easy",
    driveTimeMinutes: 110,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["after-rain", "summer-friendly", "leaf-season"],
    summary:
      "A pair of stacked waterfalls on an easy 0.4-mile trail — an accessible North Georgia gem that rewards even a short detour.",
    practicalNotes: [
      "One of the shortest hikes to a genuinely beautiful waterfall in North Georgia — good for all fitness levels.",
      "Flow is best after rain, but the two-tier cascade is scenic even in drier conditions.",
      "Often combined with nearby Blood Mountain or Vogel State Park for a fuller day.",
    ],
    whyItMatters:
      "The payoff-to-effort ratio here is unusually high — a beautiful waterfall just minutes from the parking area.",
    questHooks: [
      "easy-payoff waterfall list",
      "first North Georgia scenic trips",
      "summer-friendly mountain stops",
    ],
  },
  {
    slug: "rabun-bald",
    name: "Rabun Bald",
    launchWave: "wave2",
    commitmentTier: "fullday",
    destinationType: "summit",
    primaryActivity: "summit_hike",
    difficultyLevel: "hard",
    driveTimeMinutes: 135,
    typicalDurationMinutes: 330,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season", "sunrise-friendly"],
    summary:
      "Georgia's second-highest peak at 4,696 feet, with a wooden observation tower at the summit and panoramic views into the Carolinas.",
    practicalNotes: [
      "Clear days are essential — the observation tower views on a hazy day are a letdown.",
      "The most common approach (Beegum Gap trailhead) is 5.4 miles round-trip with 1,350 feet of gain — a committed outing.",
      "Less crowded than Blood Mountain on weekends, making it a good choice when parking pressure is a concern.",
    ],
    whyItMatters:
      "The observation tower at the summit turns an already-excellent summit view into something even more dramatic — worth every step of the climb.",
    questHooks: [
      "Georgia summit ladder",
      "hard-hike brag list",
      "sunrise mountain missions",
    ],
  },
  {
    slug: "black-rock-mountain",
    name: "Black Rock Mountain State Park",
    launchWave: "wave2",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 120,
    typicalDurationMinutes: 300,
    bestSeasons: ["summer", "fall", "winter"],
    weatherFitTags: ["clear-day", "leaf-season", "cool-weather", "sunrise-friendly"],
    summary:
      "Georgia's highest state park at 3,640 feet, with sweeping overlooks across the Blue Ridge and Nantahala mountain ranges.",
    practicalNotes: [
      "Clear days are essential — the overlook views in haze or clouds are dramatically reduced.",
      "Fall foliage from this elevation is spectacular; mid-October is prime.",
      "The park is in the mountains above Clayton — combine with a stop in town for a complete day.",
    ],
    whyItMatters:
      "The elevation gives you views that most Georgia parks can't match — on a clear fall day this is as good as it gets in the state.",
    questHooks: [
      "overlook weekends",
      "fall-color mountain parks",
      "camp-capable scenic escapes",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "Georgia's highest state park, with campgrounds and cabins available — best reserved well ahead for peak foliage weekends.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Strong fit for cooler-weather scenic camping weekends.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Simpler overnight option when the goal is overlooks and foliage rather than camp setup.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "seasonal_rush",
        priceSignal: "$$",
        comparisonNote:
          "Best compared as a foliage and scenic-payoff mountain park where booking pressure rises on prime weekends.",
      },
    },
  },
  {
    slug: "cohutta-overlook",
    name: "Cohutta Overlook",
    launchWave: "wave2",
    commitmentTier: "weekend",
    destinationType: "viewpoint",
    primaryActivity: "scenic_drive",
    difficultyLevel: "easy",
    driveTimeMinutes: 95,
    typicalDurationMinutes: 180,
    bestSeasons: ["fall", "winter", "spring"],
    weatherFitTags: ["clear-day", "leaf-season", "cool-weather", "sunrise-friendly"],
    summary:
      "A backcountry overlook on the edge of the Cohutta Wilderness with expansive ridge views — reached via forest road rather than technical trail.",
    practicalNotes: [
      "Access requires a high-clearance vehicle on rough forest road — not a passenger car destination.",
      "Clear weather is essential; the views in clouds or haze are limited.",
      "Best paired with a broader Cohutta area exploration — this is a highlight stop, not a full-day destination on its own.",
    ],
    whyItMatters:
      "The wilderness scale of the view here feels genuinely remote — the kind of overlook that rewards the extra effort to reach it.",
    questHooks: [
      "North Georgia overlook run",
      "wilderness-edge weekends",
      "clear-day mountain drives",
    ],
    overnightSupport: {
      accommodationTypes: ["day_use_only"],
      bookingStyle: "self_planned",
      overnightReadiness: "day_use_only",
      inventoryNote:
        "No overnight facilities at this location — pair with a nearby campground or plan as a day trip.",
      stayOptions: [
        {
          unitType: "day_use",
          label: "Scenic Objective",
          summary: "Better paired with a broader trip plan than treated as a standalone overnight booking.",
          bookingSurface: "self_planned",
        },
      ],
      stayProfile: {
        inventoryDepth: "single_mode",
        leadTime: "self_planned",
        priceSignal: "$",
        comparisonNote:
          "No overnight facilities at the overlook itself — pair this as a stop within a broader trip to the Cohutta area.",
      },
    },
  },
];

export const YONDER_WAVE3_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  {
    slug: "sweetwater-creek-state-park",
    name: "Sweetwater Creek State Park",
    launchWave: "wave3",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 30,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["after-rain", "cool-weather", "leaf-season"],
    summary:
      "Creek-side trails past Civil War-era textile mill ruins, 30 minutes from downtown Atlanta — a genuine natural escape without the road trip.",
    practicalNotes: [
      "Creek flow and the ruins atmosphere are both best after rain and in cooler months.",
      "Multiple trail loops offer flexibility from 2 to 5+ miles depending on how long you want to be out.",
      "Parking fills on weekend mornings — arrive before 10am or come on a weekday.",
    ],
    whyItMatters:
      "The combination of old-growth forest, rushing creek, and crumbling ruins creates an atmosphere that doesn't feel like 30 minutes from Midtown.",
    questHooks: [
      "metro-to-mountain progression",
      "best first half-day hikes",
      "after-rain close-in picks",
    ],
  },
  {
    slug: "panola-mountain",
    name: "Panola Mountain State Park",
    launchWave: "wave3",
    commitmentTier: "halfday",
    destinationType: "state_park",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 30,
    typicalDurationMinutes: 150,
    bestSeasons: ["spring", "fall", "winter"],
    weatherFitTags: ["clear-day", "cool-weather", "leaf-season"],
    summary:
      "A granite monadnock with open rock outcrops, wildflower meadows, and guided summit hikes — 30 minutes southeast of Atlanta.",
    practicalNotes: [
      "The summit is only accessible via guided ranger hike (check the park schedule before going).",
      "The lower trails and rock outcrops are open to self-guided hiking and offer their own compelling scenery.",
      "Spring wildflowers on the granite flats are a genuine seasonal highlight.",
    ],
    whyItMatters:
      "The exposed granite landscape and guided summit access make this feel different from any other close-in Atlanta trail — worth the short drive.",
    questHooks: [
      "Atlanta monadnock circuit",
      "close-in nature variety",
      "easy scenic half-days",
    ],
  },
  {
    slug: "cochran-shoals-trail",
    name: "Cochran Shoals Trail",
    launchWave: "wave3",
    commitmentTier: "halfday",
    destinationType: "trail",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 25,
    typicalDurationMinutes: 150,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A flat, paved river loop through Chattahoochee National Recreation Area — one of Atlanta's best close-in outdoor routines at any pace.",
    practicalNotes: [
      "The main Wetlands Loop is 3.1 miles and completely flat — accessible to almost any fitness level.",
      "Works year-round; popular enough that early mornings are less crowded.",
      "Dogs are welcome on leash, making this a reliable local favorite for that reason alone.",
    ],
    whyItMatters:
      "One of the most-visited trails in Georgia for good reason — the river views, wildlife, and ease of access make this endlessly repeatable.",
    questHooks: [
      "river-loop regulars",
      "best close-in mileage",
      "low-friction reset days",
    ],
  },
  {
    slug: "shoot-the-hooch-powers-island",
    name: "Shoot the Hooch at Powers Island",
    launchWave: "wave3",
    commitmentTier: "halfday",
    destinationType: "water_access",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 25,
    typicalDurationMinutes: 180,
    bestSeasons: ["summer", "spring", "fall"],
    weatherFitTags: ["summer-friendly", "clear-day", "all-season"],
    summary:
      "Atlanta's favorite summer float — rent a tube or kayak at Powers Island and drift down the Chattahoochee back to the car.",
    practicalNotes: [
      "Water temperature stays cool even in summer, making this the city's go-to heat escape.",
      "Tubing season runs roughly May through September depending on water levels — check conditions before going.",
      "Bring a dry bag for your phone and something to secure anything you don't want wet.",
    ],
    whyItMatters:
      "There's no better way to spend a hot Atlanta afternoon — a lazy river float that feels like a real escape without leaving the metro.",
    questHooks: [
      "Chattahoochee crossings",
      "summer water escapes",
      "bring-the-crew paddles",
    ],
  },
  {
    slug: "island-ford-crnra-boat-ramp",
    name: "Island Ford CRNRA Boat Ramp",
    launchWave: "wave3",
    commitmentTier: "halfday",
    destinationType: "water_access",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 25,
    typicalDurationMinutes: 120,
    bestSeasons: ["summer", "spring", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A quiet Chattahoochee put-in inside the national recreation area — a calmer launch point for kayaks and canoes away from the tubing crowds.",
    practicalNotes: [
      "Best for paddlers who want a peaceful float rather than a group tubing scene.",
      "The surrounding trails through Island Ford are worth adding before or after a paddle.",
      "Parking is free and rarely crowded compared to the busier Powers Island launch.",
    ],
    whyItMatters:
      "A more serene alternative to the busy tubing sections — the forested river corridor here is genuinely beautiful.",
    questHooks: [
      "Chattahoochee crossings",
      "river access starter pack",
      "summer cool-down map",
    ],
  },
  {
    slug: "chattahoochee-bend-state-park",
    name: "Chattahoochee Bend State Park",
    launchWave: "wave3",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 55,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A riverside state park just 55 minutes from Atlanta with riverside camping, 20 miles of trails, and the Chattahoochee flowing through the property.",
    practicalNotes: [
      "One of the closest full-service campgrounds to Atlanta — a good first overnight for people new to camping.",
      "The river frontage makes this feel more remote than the drive time suggests.",
      "Cabins are available if you want the experience without the tent setup.",
    ],
    whyItMatters:
      "Proves you don't have to drive two hours to get a real outdoor overnight — a genuinely satisfying park that's easy to get to.",
    questHooks: [
      "first overnight escapes",
      "close-in weekend basecamps",
      "river park weekends",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "One of the closest camp-capable state parks to Atlanta — campgrounds and cabins available through ReserveAmerica.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "One of the closest full-service campgrounds to Atlanta — great for a first overnight.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Easy bridge from day-trip behavior into first overnighters.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "book_early",
        priceSignal: "$",
        comparisonNote:
          "Close-in basecamp with easier logistics than the mountain set and comparatively accessible overnight planning.",
      },
    },
  },
];

export const YONDER_WAVE4_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  {
    slug: "chattahoochee-river-nra",
    name: "Chattahoochee River National Recreation Area",
    launchWave: "wave4",
    commitmentTier: "halfday",
    destinationType: "water_access",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 30,
    typicalDurationMinutes: 180,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A 48-mile stretch of protected river corridor through metro Atlanta — trails, canoe launches, and wildlife within 30 minutes of the city.",
    practicalNotes: [
      "The NRA covers 15 separate units from Buford Dam to Peachtree Creek — pick a unit based on what you want to do (trail, paddle, fish, or just be outside).",
      "Cochran Shoals, East Palisades, and Island Ford are the most popular units for first-timers.",
      "Free to visit; parking can fill at popular units on weekends.",
    ],
    whyItMatters:
      "One of the most visited national recreation areas in the country — and most Atlantans don't realize how much of the river they can actually access.",
    questHooks: [
      "Chattahoochee crossings",
      "river regulars",
      "close-in water reset",
    ],
  },
  {
    slug: "east-palisades-trail",
    name: "East Palisades Trail",
    launchWave: "wave4",
    commitmentTier: "halfday",
    destinationType: "trail",
    primaryActivity: "hiking",
    difficultyLevel: "moderate",
    driveTimeMinutes: 25,
    typicalDurationMinutes: 150,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A 4-mile loop along high river bluffs above the Chattahoochee, with bamboo forests, a small beach, and dramatic elevation changes.",
    practicalNotes: [
      "More challenging than the flat Cochran Shoals loop — expect real climbs and some rocky footing.",
      "The bamboo forest section is surprisingly atmospheric and unlike anything else close to Atlanta.",
      "Multiple entry points; the Whitewater Creek trailhead is the most common start.",
    ],
    whyItMatters:
      "The bluff views and bamboo sections make this feel genuinely unexpected for a trail this close to the city.",
    questHooks: [
      "Chattahoochee crossings",
      "Atlanta trails locals know",
      "short-drive scenic wins",
    ],
  },
  {
    slug: "indian-trail-entrance-east-palisades-unit-chattahoochee-nra",
    name: "Indian Trail Entrance, East Palisades Unit - Chattahoochee NRA",
    launchWave: "wave4",
    commitmentTier: "halfday",
    destinationType: "water_access",
    primaryActivity: "hiking",
    difficultyLevel: "easy",
    driveTimeMinutes: 25,
    typicalDurationMinutes: 120,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A secondary entrance to the East Palisades unit with river access and a quieter approach through forested trails down to the Chattahoochee.",
    practicalNotes: [
      "Less trafficked than the main Whitewater Creek entrance — a better choice on busy weekend mornings.",
      "River access at the bottom of the trail makes this a good spot for fishing or just sitting by the water.",
      "The trail down to the river is steep in places — bring good footwear.",
    ],
    whyItMatters:
      "A genuinely peaceful stretch of the Chattahoochee that most people drive right past — worth knowing about.",
    questHooks: [
      "Chattahoochee crossings",
      "access-point starter pack",
      "river-entry map",
    ],
  },
  {
    slug: "whitewater-express-columbus",
    name: "Whitewater Express",
    launchWave: "wave4",
    commitmentTier: "weekend",
    destinationType: "water_access",
    primaryActivity: "rafting",
    difficultyLevel: "moderate",
    driveTimeMinutes: 110,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "clear-day", "all-season"],
    summary:
      "Guided whitewater rafting on the Chattahoochee below Columbus — Class II-IV rapids depending on water release, run by a professional outfitter.",
    practicalNotes: [
      "This is a booked experience with a guide company, not a self-guided float — reserve in advance.",
      "Rapid intensity varies with dam release schedules; check with the operator before booking.",
      "Works well as a group trip — they accommodate crews of all experience levels.",
    ],
    whyItMatters:
      "The closest legitimate whitewater rafting to Atlanta — a real adventure that doesn't require going to Tennessee.",
    questHooks: [
      "Georgia water weekends",
      "crew adventure days",
      "first rafting trips",
    ],
    overnightSupport: {
      accommodationTypes: ["operator_trip"],
      bookingStyle: "operator_direct",
      overnightReadiness: "operator_bookable",
      inventoryNote:
        "Book directly with Whitewater Express — this is a guided experience, not a self-planned campsite stay.",
      stayOptions: [
        {
          unitType: "guide_package",
          label: "Rafting Package",
          summary: "Book the adventure itself directly with the operator instead of choosing a campsite or room type.",
          bookingSurface: "operator_direct",
        },
      ],
      stayProfile: {
        inventoryDepth: "single_mode",
        leadTime: "book_early",
        priceSignal: "$$$",
        comparisonNote:
          "Book the rafting experience directly — this isn't a campsite or cabin reservation, it's a guided adventure.",
      },
    },
  },
  {
    slug: "etowah-river-park",
    name: "Etowah River Park",
    launchWave: "wave4",
    commitmentTier: "halfday",
    destinationType: "water_access",
    primaryActivity: "paddling",
    difficultyLevel: "easy",
    driveTimeMinutes: 45,
    typicalDurationMinutes: 150,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "clear-day", "all-season"],
    summary:
      "A north-metro riverside park with canoe launch, fishing access, and trails along the Etowah River just 45 minutes from Atlanta.",
    practicalNotes: [
      "A low-key alternative to the busier Chattahoochee spots — rarely crowded and easy to access.",
      "Good for a casual morning paddle or fishing session without a long drive.",
      "The Etowah is a smaller, calmer river than the Chattahoochee — better suited to beginners.",
    ],
    whyItMatters:
      "A peaceful river outing that doesn't require fighting weekend crowds at the more popular Chattahoochee access points.",
    questHooks: [
      "north-metro water reset",
      "river regulars",
      "summer cool-down map",
    ],
  },
];

export const YONDER_WAVE5_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  {
    slug: "red-top-mountain-state-park",
    name: "Red Top Mountain State Park",
    launchWave: "wave5",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 50,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A lake-centered state park on Lake Allatoona, 50 minutes north of Atlanta — swimming, fishing, hiking, and camping without the mountain drive.",
    practicalNotes: [
      "Lake Allatoona offers swimming and boating in addition to trails — bring a change of clothes.",
      "Summer weekends fill up; reserve your site or cabin well in advance.",
      "The 7-mile trail network is easy and well-marked — good for kids and casual hikers.",
    ],
    whyItMatters:
      "Everything a weekend outdoors should be without requiring a two-hour drive — lake access, good trails, and a campground that doesn't feel like parking lot camping.",
    questHooks: [
      "first overnight escapes",
      "close-in lake weekends",
      "easy getaway ladder",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "cabin_capable",
      inventoryNote:
        "50 minutes from Atlanta with campgrounds and cabins on Lake Allatoona — a great first overnight trip.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Best first overnighter if you want lake access without a long drive.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Good fallback when you want a softer overnight setup close to Atlanta.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "seasonal_rush",
        priceSignal: "$$",
        comparisonNote:
          "Reachable and versatile enough to support first overnighters, but still subject to peak-date pressure.",
      },
    },
  },
  {
    slug: "hard-labor-creek-state-park",
    name: "Hard Labor Creek State Park",
    launchWave: "wave5",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 65,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A relaxed east-side state park with two lakes, a beach, disc golf, and equestrian trails — 65 minutes from Atlanta in Morgan County.",
    practicalNotes: [
      "The beach and swimming lake are the main draw in summer — worth planning a half-day around.",
      "Disc golfers will find one of the nicer public courses in the region here.",
      "Less crowded than the parks west or north of Atlanta — a genuinely peaceful place to spend a weekend.",
    ],
    whyItMatters:
      "An underrated park with more to do than most people expect — the beach and disc golf course alone make it worth the drive.",
    questHooks: [
      "first overnight escapes",
      "camp-close-to-home",
      "weekend reset ladder",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "A quieter park with campgrounds and cabins — good for a low-key weekend without the scenery crowds.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Lower-key east-metro camping option for a quieter weekend reset.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Easier overnight mode when the goal is staying out, not roughing it.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "book_early",
        priceSignal: "$",
        comparisonNote:
          "A lower-key overnight option when the goal is a peaceful getaway, not maximum scenery.",
      },
    },
  },
  {
    slug: "fort-yargo-state-park",
    name: "Fort Yargo State Park",
    launchWave: "wave5",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 55,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "all-season", "clear-day"],
    summary:
      "A historic fort site turned lake park 55 minutes east of Atlanta — swimming, boating, and camping around a 260-acre lake.",
    practicalNotes: [
      "The 1792 log fort is one of the oldest structures in Georgia and worth a look.",
      "The lake has a swimming beach and boat ramp — kayak and canoe rentals available in season.",
      "A solid choice for families or groups who want a complete lake weekend without a long drive.",
    ],
    whyItMatters:
      "Packs more into a single park than most — history, lake access, and a proper campground, all within an hour of the city.",
    questHooks: [
      "easy getaway ladder",
      "lake park weekends",
      "crew-friendly overnighters",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "cabin_capable",
      inventoryNote:
        "Campgrounds and cabins available on the lake — a solid choice for a family or group weekend without a long drive.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Straightforward lake-park camping weekend for families or crews.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Best lower-friction stay option when you want Fort Yargo without campsite setup.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "book_early",
        priceSignal: "$$",
        comparisonNote:
          "A relaxed lake-park weekend with campgrounds and cabins available — easy booking and no long drive.",
      },
    },
  },
  {
    slug: "don-carter-state-park",
    name: "Don Carter State Park",
    launchWave: "wave5",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 70,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall"],
    weatherFitTags: ["summer-friendly", "clear-day", "all-season"],
    summary:
      "A lakefront state park on Lake Lanier with boat ramps, swimming, and camping — 70 minutes from Atlanta in the Georgia foothills.",
    practicalNotes: [
      "Lake Lanier is one of the largest lakes in the Southeast — the open water here feels genuinely expansive.",
      "The park has its own boat ramp; bring your own kayak or canoe for day use.",
      "Summer weekends are busy; reserve early or plan for shoulder-season visits.",
    ],
    whyItMatters:
      "The best place to actually camp on Lake Lanier — spacious sites, real lake access, and a park that doesn't feel cramped.",
    questHooks: [
      "lake weekends",
      "overnight water escapes",
      "summer getaway ladder",
    ],
    overnightSupport: {
      accommodationTypes: ["campground", "cabin"],
      bookingStyle: "reserveamerica_park",
      overnightReadiness: "camp_capable",
      inventoryNote:
        "Campground and cabins right on Lake Lanier — bring a kayak or canoe for full use of the water.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Good fit for water-adjacent summer weekends built around the lake.",
          bookingSurface: "reserveamerica",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Simpler overnight mode when the goal is water access with less gear friction.",
          bookingSurface: "reserveamerica",
        },
      ],
      stayProfile: {
        inventoryDepth: "balanced",
        leadTime: "seasonal_rush",
        priceSignal: "$$",
        comparisonNote:
          "A lake-centered park best enjoyed in summer — the water access is the main event, with trails as a bonus.",
      },
    },
  },
  {
    slug: "unicoi-state-park",
    name: "Unicoi State Park & Lodge",
    launchWave: "wave5",
    commitmentTier: "weekend",
    destinationType: "state_park",
    primaryActivity: "camping_base",
    difficultyLevel: "easy",
    driveTimeMinutes: 95,
    typicalDurationMinutes: 300,
    bestSeasons: ["spring", "summer", "fall", "winter"],
    weatherFitTags: ["summer-friendly", "leaf-season", "clear-day", "all-season"],
    summary:
      "A mountain lake resort park near Helen, with a full-service lodge, cabins, campground, and trails through the Chattahoochee National Forest.",
    practicalNotes: [
      "The lodge is a genuine option — full rooms with a restaurant, no camping required.",
      "Proximity to Helen adds a fun German-village stop to any weekend itinerary.",
      "Smith Creek Trail from the park leads to Anna Ruby Falls — a worthwhile add-on hike.",
    ],
    whyItMatters:
      "One of the few places in North Georgia where you can stay in a proper lodge room, hike to a waterfall, and still be home by Sunday afternoon.",
    questHooks: [
      "soft-landing weekends",
      "Helen basecamp ideas",
      "lodge-and-lake escapes",
    ],
    overnightSupport: {
      accommodationTypes: ["lodge", "cabin", "campground"],
      bookingStyle: "direct_lodge",
      overnightReadiness: "lodge_capable",
      inventoryNote:
        "The most accommodation-flexible North Georgia weekend — lodge rooms, cabins, and campground all available through the same park.",
      stayOptions: [
        {
          unitType: "lodge_room",
          label: "Lodge Rooms",
          summary: "Best soft-landing overnight option when you want Helen-adjacent mountain access without campsite logistics.",
          bookingSurface: "direct_lodge",
        },
        {
          unitType: "cabin",
          label: "Cabins",
          summary: "Middle-ground stay option between lodge comfort and full campground setup.",
          bookingSurface: "direct_lodge",
        },
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Available for a more traditional state-park weekend around the lake.",
          bookingSurface: "direct_lodge",
        },
      ],
      stayProfile: {
        inventoryDepth: "broad",
        leadTime: "book_early",
        priceSignal: "$$$",
        comparisonNote:
          "The most accommodation-flexible North Georgia destination — lodge rooms, cabins, and tent sites all available in one park.",
      },
    },
  },
];

// Wave 6+ regional intelligence files
import { YONDER_GA_INTELLIGENCE } from "./yonder-intelligence-ga";
import { YONDER_TN_KY_INTELLIGENCE } from "./yonder-intelligence-tn-ky";
import { YONDER_NC_INTELLIGENCE } from "./yonder-intelligence-nc";
import { YONDER_SC_AL_INTELLIGENCE } from "./yonder-intelligence-sc-al";

export const YONDER_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  ...YONDER_WAVE1_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE2_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE3_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE4_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE5_DESTINATION_INTELLIGENCE,
  ...YONDER_GA_INTELLIGENCE,
  ...YONDER_TN_KY_INTELLIGENCE,
  ...YONDER_NC_INTELLIGENCE,
  ...YONDER_SC_AL_INTELLIGENCE,
];

export const YONDER_DESTINATION_INTELLIGENCE_BY_SLUG = Object.fromEntries(
  YONDER_DESTINATION_INTELLIGENCE.map((item) => [item.slug, item]),
) as Record<string, YonderDestinationIntelligence>;

export function getYonderDestinationIntelligence(
  slug: string | null | undefined,
): YonderDestinationIntelligence | null {
  if (!slug) return null;
  return YONDER_DESTINATION_INTELLIGENCE_BY_SLUG[slug] ?? null;
}
