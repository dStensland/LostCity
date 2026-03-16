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
  | "water_access";

export type YonderPrimaryActivity =
  | "hiking"
  | "waterfall_hike"
  | "summit_hike"
  | "scenic_drive"
  | "climbing"
  | "camping_base"
  | "paddling"
  | "rafting";

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
  launchWave: "wave1" | "wave2" | "wave3" | "wave4" | "wave5";
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
      "Iconic waterfall day trip with enough payoff to anchor a full day without requiring an overnight.",
    practicalNotes: [
      "Arrive early on fall weekends to avoid parking friction.",
      "Best promoted after recent rain when waterfall flow is stronger.",
      "Use as a gateway destination for users graduating from metro trails.",
    ],
    whyItMatters:
      "Amicalola is the easiest high-payoff regional anchor to understand and market inside Lost Track's full-day shelf.",
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
      "A dramatic gorge destination that delivers clear 'worth the trip' energy for committed day hikers.",
    practicalNotes: [
      "Promote more aggressively in cooler months due to stairs and sun exposure.",
      "Gorge-floor permits and access rules can change, so keep recommendations scoped to what is currently reliable.",
      "Strong visual choice for users deciding between scenic payoff and lower-friction metro plans.",
    ],
    whyItMatters:
      "Tallulah makes Lost Track feel regional and intentional rather than like a city portal with a hiking tab.",
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
      "A canyon-scale regional anchor that can support both a long day trip and early weekend-escape framing.",
    practicalNotes: [
      "Use this as a weekend idea even before full camping inventory exists.",
      "Stair-heavy routes mean this should not be framed as beginner-easy despite the broad appeal.",
      "Good candidate for 'if you only do one big trip this month' modules.",
    ],
    whyItMatters:
      "Cloudland is the strongest current bridge from Lost Track's full-day discovery into true weekend positioning.",
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
          "Best compared as a high-demand state-park weekend where scenery and overnight utility both drive demand.",
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
      "A classic Appalachian summit hike for users who want a real mountain benchmark, not just a scenic walk.",
    practicalNotes: [
      "Frame as a committed mountain hike rather than a casual scenic option.",
      "Clear-weather days make the summit payoff materially stronger.",
      "Useful as a graduation step after easier North Georgia trails.",
    ],
    whyItMatters:
      "Blood Mountain gives Lost Track an unmistakable Appalachian identity and a true effort-reward ladder.",
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
      "The southern Appalachian Trail anchor, better suited to quest framing and committed outings than casual browse traffic.",
    practicalNotes: [
      "Treat as a high-intent destination, not a generic weekend suggestion.",
      "Works best when paired with Appalachian or milestone editorial framing.",
      "Road and trail access details matter more here than for park-style destinations.",
    ],
    whyItMatters:
      "Springer Mountain is foundational quest infrastructure for Lost Track even if it stays lower-volume in broad consumer use.",
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
          "This compares more like a self-planned trail objective than a stay inventory decision.",
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
      "Georgia's highest point with broad scenic payoff and much lower friction than a full summit hike.",
    practicalNotes: [
      "Use this for scenic-full-day recommendations aimed at broader audiences.",
      "Visibility matters, so promote most heavily on clear-weather windows.",
      "Strong option when users want mountain payoff without a difficult hike.",
    ],
    whyItMatters:
      "Brasstown Bald gives Lost Track a broadly accessible regional escape instead of only hard-hike recommendations.",
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
      "A classic North Georgia waterfall hike with enough broad appeal to be one of Lost Track's most reusable full-day recommendations.",
    practicalNotes: [
      "Best after recent rain and in cooler-weather windows.",
      "High-value choice when users want scenic payoff without the intensity of summit-first hikes.",
      "Strong counterpart to Amicalola inside a waterfall-focused recommendation stack.",
    ],
    whyItMatters:
      "Raven Cliff is one of the cleanest full-day recommendations Lost Track can make without requiring special user context.",
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
      "A mountain-lake anchor that makes weekend energy feel attainable even before Camp Finder becomes a full product.",
    practicalNotes: [
      "Use for lower-barrier weekend escape framing.",
      "Good option when recommending scenic over strenuous.",
      "Peak weekends can book up, so pair with realistic planning copy rather than scarcity-blind promotion.",
    ],
    whyItMatters:
      "Vogel is the easiest early weekend destination to understand and package for a broad audience.",
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
        "Strong early-weekend anchor for campground and cabin planning with broad scenic appeal.",
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
      "A mountain-park anchor with scenic range that helps Lost Track stretch beyond the most obvious North Georgia picks.",
    practicalNotes: [
      "Useful as a weekend shelf pick once users have seen the more obvious flagship destinations.",
      "Stronger when positioned around overlooks, loops, and a fuller day rather than a single signature attraction.",
      "Good candidate for 'less obvious but worth it' editorial framing.",
    ],
    whyItMatters:
      "Fort Mountain adds range and keeps Lost Track's regional layer from collapsing into the same three names.",
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
        "Best framed as a scenic mountain park weekend with campground and cabin-style planning.",
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
          "Useful alternative to flagship parks when users want mountain range without the most obvious crowds.",
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
      "Atlanta's most distinctive outdoor climbing anchor and one of Lost Track's best chances to feel locally specific instead of generic.",
    practicalNotes: [
      "Promote only in dry-weather windows.",
      "Useful for 'mildly weird / deeply local' editorial framing as much as for strict climbing audiences.",
      "Pair with stewardship or access-context copy where appropriate.",
    ],
    whyItMatters:
      "Boat Rock is the strongest local-difference destination in the Wave 1 set and gives Lost Track an outdoor identity no generic event feed can fake.",
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
      "A high-signal North Georgia waterfall stop that broadens Lost Track's full-day waterfall shelf beyond the obvious flagships.",
    practicalNotes: [
      "Best promoted after recent rain when water volume is stronger.",
      "Works well as a lower-friction scenic hike compared with harder summit days.",
      "Useful support anchor when the homepage needs more than one waterfall-driven recommendation.",
    ],
    whyItMatters:
      "DeSoto gives Lost Track more waterfall density, which is critical for seasonal recommendation logic and future quest clustering.",
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
      "A lower-friction waterfall destination with strong scenic payoff, ideal for users who want mountain energy without an all-day grind.",
    practicalNotes: [
      "Strong for broad-audience scenic recommendations and less intense day-trip framing.",
      "Rain improves payoff, but the easier access makes it useful even outside peak flow windows.",
      "A good alternate when harder waterfall hikes feel like too much commitment.",
    ],
    whyItMatters:
      "Helton Creek helps Lost Track avoid making every scenic full-day recommendation feel strenuous or expert-coded.",
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
      "A true summit payoff for high-intent hikers, giving Lost Track a second hard-hike benchmark beyond Blood Mountain.",
    practicalNotes: [
      "Promote on clear days when summit-view payoff is strongest.",
      "Best used for committed hikers rather than general scenic audiences.",
      "Strong candidate for quest framing around Georgia summit progression.",
    ],
    whyItMatters:
      "Rabun Bald deepens Lost Track's summit ladder so the portal can serve ambitious hikers without repeating the same flagship every time.",
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
      "An overlook-heavy mountain park that expands Lost Track's weekend shelf with another scenic, camp-capable escape.",
    practicalNotes: [
      "Useful when weekend recommendations need something more scenic-drive and overlook oriented.",
      "Visibility matters, so clear days and foliage windows are especially valuable.",
      "Good backup weekend anchor when the most obvious parks are overexposed or crowded.",
    ],
    whyItMatters:
      "Black Rock Mountain gives the weekend layer more range and keeps Lost Track from collapsing into a tiny set of repeat park names.",
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
        "Works as a scenic mountain-park weekend with camp-capable inventory and clear-day payoff.",
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
      "A high-upside overlook anchor that gives Lost Track a cleaner wilderness-edge weekend idea without requiring a big technical hike.",
    practicalNotes: [
      "Best framed around overlook payoff, foliage, and clear-weather windows.",
      "Useful as a scenic-weekend alternative to more hike-centric recommendations.",
      "Can support future Cohutta-area quest clustering once additional anchors are seeded.",
    ],
    whyItMatters:
      "Cohutta Overlook starts to make the portal's wilderness-scale weekend promise feel broader than state parks alone.",
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
        "Best treated as a scenic wilderness-edge objective, not a stayable overnight base on its own.",
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
          "This is a trip objective to pair with another base, not a destination with its own stay inventory.",
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
      "The cleanest metro-edge trail anchor for when Lost Track needs a real nature reset without turning the day into a road trip.",
    practicalNotes: [
      "Best after rain and in cooler months when creek flow and ruins payoff are strongest.",
      "Ideal bridge between urban quick hits and full-day regional hikes.",
      "Use when users want an actual trail day but only have half a day to spare.",
    ],
    whyItMatters:
      "Sweetwater is the most useful metro support anchor for keeping Lost Track credible below the regional mountain layer.",
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
      "A distinctive granite-landscape half-day option that keeps Lost Track's close-in nature shelf from collapsing into the same river and forest pattern.",
    practicalNotes: [
      "Stronger in cooler-weather windows and clear-day conditions.",
      "Useful when the portal needs a scenic half-day recommendation outside the Chattahoochee corridor.",
      "Good candidate for beginner-friendly but still memorable trail prompts.",
    ],
    whyItMatters:
      "Panola widens Lost Track's metro support map and gives the half-day shelf a more distinctive geological identity.",
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
      "A reliable river-adjacent half-day trail that gives Lost Track a low-friction answer when users want mileage without mountain logistics.",
    practicalNotes: [
      "Works year-round and is especially useful for repeatable close-in outdoor routines.",
      "Good fallback when bigger mountain plans feel like too much friction.",
      "Use as a confidence-building recommendation for users easing into longer trail time.",
    ],
    whyItMatters:
      "Cochran Shoals gives Lost Track repeatable half-day depth, which reduces pressure on the regional shelf to do all the work.",
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
      "The strongest current metro water-access node for summer escape framing, group paddles, and heat-aware recommendations.",
    practicalNotes: [
      "Best used for warm-weather and group-friendly outdoor suggestions.",
      "Useful when the portal needs a real water answer instead of another trail card.",
      "Pair with safety and river-condition context once the conditions layer deepens.",
    ],
    whyItMatters:
      "Powers Island is the most direct way to make Lost Track's water lane feel real in Atlanta before the broader paddle graph is built out.",
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
      "A cleaner put-in style support node that helps Lost Track grow beyond a single Chattahoochee access story.",
    practicalNotes: [
      "Use as support inventory for water-focused modules rather than a flagship scenic card.",
      "Most valuable in heat-aware routing and Chattahoochee-specific collections.",
      "Helpful for expanding future artifact and access-point logic without needing a new data model yet.",
    ],
    whyItMatters:
      "Island Ford starts the access-node layer Lost Track needs if it wants to own water discovery rather than just mentioning the river abstractly.",
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
      "A lower-friction camp-capable park that gives Lost Track a weekend option closer to Atlanta than the North Georgia mountain set.",
    practicalNotes: [
      "Useful as a 'try a weekend outside without driving two hours' recommendation.",
      "Pairs well with early camping-adjacent messaging even before Camp Finder exists.",
      "Good counterweight when the weekend shelf feels too mountain-heavy.",
    ],
    whyItMatters:
      "Chattahoochee Bend makes Lost Track's weekend layer feel more reachable and less dependent on a narrow North Georgia pattern.",
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
        "Close-in state park weekend with real campground and cabin-style planning upside.",
      stayOptions: [
        {
          unitType: "tent_site",
          label: "Campground",
          summary: "Closest true camp-capable weekend in the Lost Track set.",
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
      "The core Chattahoochee anchor that ties trails, launches, and river-day planning into one recognizable Lost Track lane.",
    practicalNotes: [
      "Use as the parent water-and-trail anchor when Lost Track needs to explain the river system, not just a single put-in.",
      "Strong in warm-weather and clear-day windows, but useful year-round for lower-friction outdoor plans.",
      "Best paired with more specific access nodes when the recommendation needs execution-level clarity.",
    ],
    whyItMatters:
      "The NRA is the umbrella destination that makes Lost Track's water and river logic legible instead of feeling like disconnected access points.",
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
      "A river-bluff trail with real local distinctiveness that helps Lost Track connect hiking and water-adjacent discovery in one place.",
    practicalNotes: [
      "Useful when recommendations need more payoff and texture than a basic flat river loop.",
      "Good bridge between close-in trails and water-access collections.",
      "Works across seasons, especially when users want a short-drive trail that still feels memorable.",
    ],
    whyItMatters:
      "East Palisades gives the half-day shelf a more cinematic Chattahoochee option than generic river-path inventory.",
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
      "A practical access-node layer for East Palisades that starts to make Lost Track's access-point logic real rather than theoretical.",
    practicalNotes: [
      "Use when route clarity matters more than broad scenic framing.",
      "Strong support inventory for future artifact and access-point collections.",
      "Best treated as a precision node inside Chattahoochee recommendations, not a flagship destination card.",
    ],
    whyItMatters:
      "Indian Trail Entrance is the kind of support node Lost Track needs if it wants to graduate from destination list to usable outdoor graph.",
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
      "A true whitewater operator anchor that gives Lost Track's water lane a bigger-adventure option beyond metro floats and river trails.",
    practicalNotes: [
      "Useful when the weekend shelf needs an actual water-adventure answer, not just another park with a river nearby.",
      "Warm-weather and group-oriented framing works best here.",
      "Should be positioned as a trip prompt and operator anchor, not a generic scenic place card.",
    ],
    whyItMatters:
      "Whitewater Express is the quickest way to make Lost Track's water category feel more ambitious than tubing and launches alone.",
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
        "This is an operator-booked adventure weekend, not a campsite or cabin inventory play.",
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
          "This compares like a bookable adventure package, not a lodging decision with multiple stay formats.",
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
      "A north-metro river support anchor that helps Lost Track avoid making every water recommendation about the Chattahoochee.",
    practicalNotes: [
      "Best used to broaden the water lane and reduce repetition in warm-weather shelves.",
      "Good for closer-in paddle and riverfront recommendations north of core Atlanta.",
      "Most valuable as support density rather than a top-of-feed flagship.",
    ],
    whyItMatters:
      "Etowah River Park expands Lost Track's water identity geographically and prevents the summer lane from feeling too single-river dependent.",
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
      "A close-in lake weekend that gives Lost Track a realistic overnight shelf without making every escape a mountain mission.",
    practicalNotes: [
      "Best used for reachable weekend prompts and first overnighters.",
      "Strong fallback when users want a real getaway without a long North Georgia drive.",
      "Useful for broad-audience cabin-or-camp framing, not just trail-first recommendations.",
    ],
    whyItMatters:
      "Red Top Mountain is the fastest way to make Lost Track's weekend layer feel more repeatable and less dependent on the same mountain pattern.",
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
        "Reachable lake-park weekend with real cabin and campground utility for first overnighters.",
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
      "A quieter east-metro basecamp that broadens Lost Track's weekend shelf beyond scenic-heavy mountain recommendations.",
    practicalNotes: [
      "Useful for lower-key weekend prompts and first camp-capable trips.",
      "Good when the weekend shelf needs variety instead of another overlook or waterfall card.",
      "Works well for family-friendly or crew-friendly overnight suggestions.",
    ],
    whyItMatters:
      "Hard Labor Creek gives Lost Track another real overnight-capable option that makes the weekend shelf feel less repetitive.",
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
        "Useful as a lower-key campground and cabin base rather than a scenery-first flagship trip.",
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
          "Lower-key overnight profile that compares well when users value calm logistics over maximum spectacle.",
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
      "A lake-centered park that gives Lost Track a broad-audience weekend base with easier logistics than the farthest regional anchors.",
    practicalNotes: [
      "Best used for approachable weekend escapes and broad family-friendly outdoors prompts.",
      "Good counterweight when the shelf is leaning too hard into mountain-only adventure.",
      "Useful for cabin-or-campsite messaging even before a true lodging layer exists.",
    ],
    whyItMatters:
      "Fort Yargo adds a repeatable, broadly usable overnight option to Lost Track's weekend shelf instead of another one-off scenic anchor.",
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
        "Broad-audience weekend base with cabin-and-camp options and easier logistics than mountain-heavy picks.",
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
          "Broad-audience lake-park weekend with a relatively approachable comfort profile.",
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
      "A lake-forward weekend base that strengthens Lost Track's overnight water lane instead of only its hiking shelf.",
    practicalNotes: [
      "Best used for warm-weather weekend prompts and water-adjacent overnight ideas.",
      "Useful when Lost Track needs a real overnight water answer rather than another access point or float launch.",
      "Good bridge between paddling logic and camp-capable recommendations.",
    ],
    whyItMatters:
      "Don Carter helps Lost Track connect its water and weekend strategies instead of treating them as separate categories.",
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
        "Best understood as a lake-forward camp-and-cabin weekend rather than a pure paddling day trip.",
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
          "Best compared as a summer-forward overnight water base rather than a pure hiking weekend.",
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
      "A North Georgia lodge-and-lake base that gives Lost Track a softer-landing weekend option than campsite-only mountain prompts.",
    practicalNotes: [
      "Best for cabin-capable or lodge-capable weekend prompts and lower-friction North Georgia escapes.",
      "Useful bridge between scenic mountain discovery and easier booking-oriented planning.",
      "Strong choice when the portal needs a weekend answer that feels adventurous without feeling hard-core.",
    ],
    whyItMatters:
      "Unicoi gives Lost Track a more accommodation-friendly weekend archetype, which the current shelf still lacks.",
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
        "This is the clearest lodge-capable North Georgia weekend in the current Yonder set.",
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
          "The strongest comfort-forward weekend in the current set, with the broadest accommodation mix and the highest softness level.",
      },
    },
  },
];

export const YONDER_DESTINATION_INTELLIGENCE: YonderDestinationIntelligence[] = [
  ...YONDER_WAVE1_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE2_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE3_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE4_DESTINATION_INTELLIGENCE,
  ...YONDER_WAVE5_DESTINATION_INTELLIGENCE,
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
