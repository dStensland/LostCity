import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import type { EmoryCommunityCategory } from "@/lib/emory-community-categories";
import { getDayOfWeekKey, type DayKey, type Season } from "@/lib/campus-hours-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CampusResourceAudience = "patient" | "visitor" | "staff" | "caregiver";

export type VisitStage = "pre_admission" | "inpatient" | "discharge";

export type CampusResource = {
  id: string;
  category: string;
  name: string;
  description: string;
  openHours: string;
  locationHint: string;
  audience: CampusResourceAudience;
  ctaLabel: string | null;
  ctaUrl: string | null;
  stages?: VisitStage[];
  dischargeBundle?: boolean;
};

export type NeighborhoodTip = {
  text: string;
  audience: CampusResourceAudience | "all";
  season?: Season;
  dayOfWeek?: DayKey;
  timeContext?: "day" | "night";
};

export type StaffBoardItemCategory = "cme" | "wellness" | "food_special" | "announcement";

export type StaffBoardItem = {
  id: string;
  title: string;
  description: string;
  category: StaffBoardItemCategory;
  schedule: "today" | "weekday" | "weekend" | DayKey;
  timeHint: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type DischargeTransportCard = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type DischargeFollowUpCard = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type HospitalCurationProfile = {
  slug: string;
  displayName: string;
  shortName: string;
  neighborhood: string;
  campusType: "flagship" | "urban" | "regional" | "suburban";
  categoryBoosts: Partial<Record<EmoryCommunityCategory, number>>;
  highlightOrgOverrides: Partial<Record<EmoryCommunityCategory, string[]>>;
  campusResources: CampusResource[];
  neighborhoodTips: NeighborhoodTip[];
  staffBoardItems?: StaffBoardItem[];
  stageHeroHints?: Partial<Record<VisitStage, string>>;
  dischargeCategoryBoosts?: EmoryCommunityCategory[];
  dischargeTransport?: DischargeTransportCard[];
  dischargeFollowUp?: DischargeFollowUpCard[];
};

// ---------------------------------------------------------------------------
// Hospital profiles
// ---------------------------------------------------------------------------

const EMORY_UNIVERSITY_HOSPITAL: HospitalCurationProfile = {
  slug: "emory-university-hospital",
  displayName: "Emory University Hospital",
  shortName: "Emory Main",
  neighborhood: "Druid Hills",
  campusType: "flagship",
  categoryBoosts: { specialized_care: 3, support_groups: 2 },
  highlightOrgOverrides: {
    specialized_care: [
      "georgia-transplant-foundation",
      "american-lung-georgia",
      "shepherd-center",
    ],
  },
  stageHeroHints: {
    pre_admission: "Preparing for your visit — complete lab work at Clinic Building A, bring your insurance card and medication list, and arrive 30 minutes early for registration.",
    inpatient: "On-campus support — pharmacy, chaplaincy, healing garden access, and your care team are all nearby. Ask your nurse about anything you need.",
    discharge: "Getting ready to go home — pick up prescriptions at the outpatient pharmacy, schedule follow-ups through MyChart, and review community resources below.",
  },
  dischargeCategoryBoosts: ["food_nutrition", "support_groups", "life_essentials"],
  dischargeTransport: [
    { id: "euh-dt-shuttle", title: "Emory Cliff Shuttle", description: "Free shuttle to MARTA, parking decks, and campus buildings. Runs every 10-15 min weekdays. Stop at the main entrance.", ctaLabel: "Shuttle Map", ctaUrl: "https://transportation.emory.edu/shuttle" },
    { id: "euh-dt-rideshare", title: "Rideshare Pickup", description: "Uber and Lyft: use the main entrance circle for pickup. Ask the front desk for the exact address to share with your driver.", ctaLabel: null, ctaUrl: null },
    { id: "euh-dt-marta", title: "MARTA — via Cliff Shuttle", description: "Take the free Cliff shuttle to Decatur MARTA station (15 min). From there, rail runs to the airport, Midtown, and Five Points transfer.", ctaLabel: "MARTA Trip Planner", ctaUrl: "https://www.itsmarta.com/trip-planner.aspx" },
    { id: "euh-dt-parking", title: "Parking & Valet", description: "Validate parking at the main entrance desk before leaving. Visitor deck adjacent to main entrance. Wheelchair assistance available — ask at discharge.", ctaLabel: null, ctaUrl: null },
  ],
  dischargeFollowUp: [
    { id: "euh-df-mychart", title: "Schedule Follow-Up via MyChart", description: "Log in to MyChart to schedule post-discharge appointments, view test results, and message your care team.", ctaLabel: "Open MyChart", ctaUrl: "https://mychart.emoryhealthcare.org" },
    { id: "euh-df-pharmacy-delivery", title: "Prescription Delivery", description: "Can't pick up in person? Emory Pharmacy offers mail-order refills and delivery for maintenance medications.", ctaLabel: "Pharmacy Services", ctaUrl: "https://www.emoryhealthcare.org/centers-programs/pharmacy" },
    { id: "euh-df-home-health", title: "Home Health & Nursing", description: "If your doctor ordered home health visits, the care coordination team will set up your schedule before you leave.", ctaLabel: null, ctaUrl: null },
  ],
  campusResources: [
    // -- Patient (7) --
    {
      id: "euh-pharmacy",
      category: "Pharmacy",
      name: "Outpatient Pharmacy",
      description: "Prescription pickup and over-the-counter essentials near discharge.",
      openHours: "Mon-Fri 8 AM-7 PM",
      locationHint: "Main level, near discharge lobby",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "euh-lab-imaging",
      category: "Lab & Imaging",
      name: "Lab & Imaging Center",
      description: "Blood draws, diagnostic imaging, and same-day results.",
      openHours: "Mon-Fri 7 AM-5 PM",
      locationHint: "Clinic Building A, 2nd floor",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "euh-spiritual-care",
      category: "Spiritual Care",
      name: "Chaplaincy & Spiritual Care",
      description: "Interfaith chaplains available for patients and families.",
      openHours: "Daily, 24/7 on-call",
      locationHint: "Main hospital, 1st floor chapel",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient"],
    },
    {
      id: "euh-transplant-checkin",
      category: "Specialty Check-In",
      name: "Transplant Center Check-In",
      description: "Dedicated check-in for transplant patients and follow-ups.",
      openHours: "Mon-Fri 7:30 AM-4:30 PM",
      locationHint: "Clinic Building C, 1st floor",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "euh-patient-portal",
      category: "Patient Support",
      name: "MyChart & Patient Financial Services",
      description: "Billing questions, payment plans, and portal assistance.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Main lobby information desk",
      audience: "patient",
      ctaLabel: "Open MyChart",
      ctaUrl: "https://mychart.emoryhealthcare.org",
      stages: ["pre_admission", "inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "euh-interpreter",
      category: "Language Services",
      name: "Interpreter & Language Services",
      description: "In-person and video interpreters for 200+ languages, including ASL. Request through your nurse or call the front desk.",
      openHours: "24/7",
      locationHint: "Available at any nurse station",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    {
      id: "euh-transplant-education",
      category: "Patient Education",
      name: "Transplant Patient Education Center",
      description: "Pre- and post-transplant classes, medication management workshops, and one-on-one education with transplant coordinators.",
      openHours: "Mon-Fri 8:30 AM-4:30 PM",
      locationHint: "Clinic Building C, 2nd floor",
      audience: "patient",
      ctaLabel: "Transplant Resources",
      ctaUrl: "https://www.emoryhealthcare.org/transplant-center",
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    // -- Visitor (7) --
    {
      id: "euh-parking",
      category: "Parking",
      name: "Visitor Parking Deck",
      description: "Parking validation, accessible spaces, and gate assistance.",
      openHours: "Daily 5 AM-11 PM",
      locationHint: "Parking structure adjacent to main entrance",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-cafe",
      category: "Dining",
      name: "Main Concourse Cafe",
      description: "Sandwiches, salads, coffee, and grab-and-go meals.",
      openHours: "Daily 6:30 AM-8 PM",
      locationHint: "Main concourse, ground floor",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-gift-shop",
      category: "Gift Shop",
      name: "Emory Gift Shop",
      description: "Flowers, cards, snacks, and personal care items.",
      openHours: "Mon-Fri 9 AM-7 PM, Sat-Sun 10 AM-5 PM",
      locationHint: "Main lobby",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-wifi",
      category: "Connectivity",
      name: "Guest Wi-Fi",
      description: "Free wireless internet throughout the hospital. Network: Emory-Guest.",
      openHours: "Always available",
      locationHint: "Campus-wide",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-family-lounge",
      category: "Family Support",
      name: "Family Waiting Lounge",
      description: "Quiet lounge with recliners and charging stations for families.",
      openHours: "24/7",
      locationHint: "3rd floor, near surgical suites",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-visiting-hours",
      category: "Visiting Hours",
      name: "Visiting Hours & Policies",
      description: "General visiting hours are 8 AM-8 PM daily. ICU allows two visitors at a time. All visitors must check in at the front desk and wear a visitor badge.",
      openHours: "Daily 8 AM-8 PM",
      locationHint: "Check in at main entrance desk",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-shuttle",
      category: "Transportation",
      name: "Emory Cliff Shuttle",
      description: "Free shuttle connecting Emory campus buildings, parking decks, and MARTA. Runs every 10-15 minutes on weekdays.",
      openHours: "Mon-Fri 6:30 AM-11 PM, Sat 9 AM-5 PM",
      locationHint: "Shuttle stops at main entrance and parking deck",
      audience: "visitor",
      ctaLabel: "Shuttle Map",
      ctaUrl: "https://transportation.emory.edu/shuttle",
    },
    {
      id: "euh-nearby-pharmacy",
      category: "Nearby Pharmacy",
      name: "CVS Pharmacy — Clifton Rd",
      description: "Full-service pharmacy with drive-through, 3 minutes from campus. Accepts most insurance plans.",
      openHours: "Daily 8 AM-10 PM, Pharmacy closes 9 PM",
      locationHint: "1525 Clifton Rd NE, 0.3 miles from main entrance",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-nearby-dining",
      category: "Nearby Dining",
      name: "Emory Village Restaurants",
      description: "Everybody's Pizza, Doc Chey's Noodle House, and Panera Bread — all within a 5-minute walk for sit-down or takeout meals.",
      openHours: "Most open 11 AM-9 PM",
      locationHint: "Emory Village, N. Decatur Rd at Oxford Rd",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Caregiver (3) --
    {
      id: "euh-caregiver-respite",
      category: "Caregiver Support",
      name: "Caregiver Respite Room",
      description: "Quiet rest area for family caregivers with recliners, outlets, and refreshments.",
      openHours: "24/7",
      locationHint: "3rd floor, east wing",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-caregiver-desk",
      category: "Caregiver Support",
      name: "Caregiver Support Desk",
      description: "Help navigating insurance, discharge planning, and community resources.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Main lobby information desk",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
    },
    {
      id: "euh-lactation-room",
      category: "Family Support",
      name: "Lactation Room",
      description: "Private lactation room with hospital-grade pumps for nursing mothers.",
      openHours: "24/7",
      locationHint: "2nd floor, near family lounge",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Staff (5) --
    {
      id: "euh-staff-dining",
      category: "Staff Dining",
      name: "Staff Cafeteria",
      description: "Employee-only dining with hot meals, salad bar, and coffee.",
      openHours: "Daily 6 AM-2 AM",
      locationHint: "Lower level, Building B",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-wellness-room",
      category: "Wellness",
      name: "Wellness & Meditation Room",
      description: "A quiet space for breaks, meditation, and mindfulness.",
      openHours: "24/7 badge access",
      locationHint: "2nd floor, east wing",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-lockers",
      category: "Amenities",
      name: "Staff Lockers & Changing Rooms",
      description: "Secure lockers and shower facilities for staff.",
      openHours: "24/7 badge access",
      locationHint: "Lower level near staff entrance",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-oncall-rooms",
      category: "On-Call",
      name: "On-Call Rooms",
      description: "Rest rooms for overnight staff and residents.",
      openHours: "24/7 badge access",
      locationHint: "3rd and 6th floors",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "euh-professional-dev",
      category: "Professional Development",
      name: "Continuing Education Center",
      description: "CME programs, grand rounds, and professional development resources.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Medical Education Building",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
  ],
  neighborhoodTips: [
    { text: "Walk the tree-lined paths of Lullwater Preserve for a peaceful break, just minutes from campus.", audience: "all", timeContext: "day" },
    { text: "Emory Village has cafes, bookshops, and quick lunch spots a short walk from the hospital.", audience: "visitor", timeContext: "day" },
    { text: "The CDC Museum on Clifton Rd is free and open to the public on weekdays.", audience: "visitor" },
    { text: "Staff can access Emory's Woodruff PE Center gym at reduced rates.", audience: "staff" },
    { text: "Patients: ask your care team about healing garden access on the 4th floor terrace.", audience: "patient" },
    { text: "Spring wildflowers are beautiful along the Lullwater trails — perfect for a short walk.", audience: "all", season: "spring", timeContext: "day" },
    { text: "The 24-hour CVS on Clifton Rd is a 3-minute drive for late-night essentials.", audience: "all", timeContext: "night" },
    { text: "Saturday morning farmers market at Emory Village features local produce and prepared foods.", audience: "visitor", dayOfWeek: "sat" },
    { text: "Caregivers: the Emory Conference Center Hotel is a 5-minute walk for overnight stays near the hospital.", audience: "caregiver" },
    { text: "Caregivers: DoorDash and Uber Eats deliver to the main lobby — ask for the visitor entrance address.", audience: "caregiver", timeContext: "night" },
    { text: "Kroger on N. Decatur Rd (10 min walk) has a deli, pharmacy, and groceries for longer stays.", audience: "visitor", timeContext: "day" },
    { text: "Starbucks in the Emory Student Center is a 7-minute walk — quieter than the hospital cafe.", audience: "all", timeContext: "day" },
    { text: "Winter tip: the hospital tunnels connect main buildings — ask at the front desk for walking directions.", audience: "all", season: "winter" },
    { text: "Staff: Java Monkey in Decatur has late-night coffee and live music on weekends.", audience: "staff", timeContext: "night" },
    { text: "General Muir in Emory Village has excellent brunch and deli — 5-min walk from the front entrance.", audience: "visitor", timeContext: "day" },
    { text: "Wahoo! Grill in Decatur is a 10-min drive — great for a sit-down dinner after visiting hours.", audience: "visitor", timeContext: "night" },
    { text: "Taqueria del Sol on Clifton Rd has quick tacos and a patio — popular with staff and visitors.", audience: "all", timeContext: "day" },
    { text: "For healthy delivery: Sweetgreen and CAVA deliver to the hospital via DoorDash.", audience: "all", timeContext: "day" },
    { text: "The Emory Conference Center has a full-service restaurant and lounge — ideal for a longer family dinner.", audience: "caregiver", timeContext: "night" },
    { text: "CVS MinuteClinic on N. Decatur Rd handles minor care needs so visitors don't have to go to the ER.", audience: "visitor", timeContext: "day" },
    { text: "Krog Street Market (15 min) has diverse food stalls — good for groups with different tastes.", audience: "visitor", timeContext: "day" },
    { text: "Courtyard by Marriott Decatur is a 10-min drive with hospital-rate packages for extended family stays.", audience: "caregiver" },
  ],
  staffBoardItems: [
    { id: "euh-sb-grand-rounds", title: "Grand Rounds: Transplant Immunology Update", description: "Dr. Smith presents latest transplant immunology protocols. CME credit available.", category: "cme", schedule: "wed", timeHint: "12:00 PM", ctaLabel: "Register", ctaUrl: "https://med.emory.edu/education/cme" },
    { id: "euh-sb-yoga", title: "Staff Yoga & Stretching", description: "30-minute guided session in the wellness room. All levels welcome.", category: "wellness", schedule: "weekday", timeHint: "7:00 AM", ctaLabel: "Wellness Resources", ctaUrl: "https://hr.emory.edu/eu/wellness" },
    { id: "euh-sb-cafe-special", title: "Cafe Special: Harvest Bowl", description: "Grain bowl with seasonal vegetables and grilled chicken. Staff price $6.", category: "food_special", schedule: "today", timeHint: "Lunch", ctaLabel: "View Menu", ctaUrl: "https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital" },
    { id: "euh-sb-flu-clinic", title: "Staff Flu Vaccination Clinic", description: "Walk-in flu shots available in the staff lounge this week.", category: "announcement", schedule: "weekday", timeHint: "All day", ctaLabel: "Employee Health", ctaUrl: "https://hr.emory.edu/eu/wellness/employee-health" },
  ],
};

const EMORY_MIDTOWN: HospitalCurationProfile = {
  slug: "emory-university-hospital-midtown",
  displayName: "Emory University Hospital Midtown",
  shortName: "Emory Midtown",
  neighborhood: "Midtown Atlanta",
  campusType: "urban",
  categoryBoosts: { stay_well: 3, food_nutrition: 2 },
  highlightOrgOverrides: {
    stay_well: [
      "ymca-atlanta",
      "beltline-fitness",
    ],
    food_nutrition: [
      "open-hand-atlanta",
      "community-farmers-markets",
    ],
  },
  stageHeroHints: {
    pre_admission: "Getting ready — complete pre-op labs at the 2nd floor Peachtree wing, bring your medication list, and check in at the ground floor registration desk.",
    inpatient: "Support while you're here — pharmacy, cardiac rehab, chaplaincy, and your care team are steps away. The BeltLine is nearby for visitors who need fresh air.",
    discharge: "Heading home — fill prescriptions at the ground floor pharmacy, schedule cardiac rehab follow-ups, and review community support programs below.",
  },
  dischargeCategoryBoosts: ["food_nutrition", "support_groups", "life_essentials"],
  dischargeTransport: [
    { id: "emtw-dt-marta", title: "MARTA — Arts Center Station", description: "Walk 2 blocks west on 15th St to Arts Center MARTA station. Direct rail to the airport (30 min), Buckhead, and Five Points transfer.", ctaLabel: "MARTA Trip Planner", ctaUrl: "https://www.itsmarta.com/trip-planner.aspx" },
    { id: "emtw-dt-rideshare", title: "Rideshare Pickup", description: "Uber and Lyft: use the Peachtree Street entrance for pickup. The main entrance circle has a covered waiting area.", ctaLabel: null, ctaUrl: null },
    { id: "emtw-dt-parking", title: "Linden Avenue Garage", description: "Validate parking at the lobby information desk. Wheelchair transport to the garage is available — ask your nurse before discharge.", ctaLabel: null, ctaUrl: null },
  ],
  dischargeFollowUp: [
    { id: "emtw-df-mychart", title: "Schedule Follow-Up via MyChart", description: "Log in to MyChart for post-discharge appointments, cardiac rehab scheduling, and messaging your care team.", ctaLabel: "Open MyChart", ctaUrl: "https://mychart.emoryhealthcare.org" },
    { id: "emtw-df-cardiac-rehab", title: "Cardiac Rehabilitation", description: "If referred for cardiac rehab, your first appointment will be scheduled before discharge. Sessions are on the 3rd floor, south tower.", ctaLabel: "Heart & Vascular", ctaUrl: "https://www.emoryhealthcare.org/heart-vascular" },
    { id: "emtw-df-pharmacy-delivery", title: "Prescription Delivery", description: "Mail-order refills and delivery available for maintenance medications. Ask at the pharmacy window or call for details.", ctaLabel: "Pharmacy Services", ctaUrl: "https://www.emoryhealthcare.org/centers-programs/pharmacy" },
  ],
  campusResources: [
    // -- Patient (7) --
    {
      id: "emtw-pharmacy",
      category: "Pharmacy",
      name: "Midtown Outpatient Pharmacy",
      description: "Prescription pickup, medication counseling, and OTC supplies.",
      openHours: "Mon-Fri 8 AM-6:30 PM",
      locationHint: "Ground floor near main lobby",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "emtw-lab",
      category: "Lab & Imaging",
      name: "Lab Services & Imaging",
      description: "Walk-in lab draws and scheduled imaging appointments.",
      openHours: "Mon-Fri 7 AM-4:30 PM",
      locationHint: "2nd floor, Peachtree wing",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "emtw-spiritual",
      category: "Spiritual Care",
      name: "Spiritual Care & Chaplaincy",
      description: "Chaplain visits, prayer support, and interfaith services.",
      openHours: "Daily, 24/7 on-call",
      locationHint: "Ground floor chapel near information desk",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient"],
    },
    {
      id: "emtw-cardiac-rehab",
      category: "Specialty Check-In",
      name: "Cardiac Rehabilitation Center",
      description: "Outpatient cardiac rehab check-in and exercise programs.",
      openHours: "Mon-Fri 7 AM-4 PM",
      locationHint: "3rd floor, south tower",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "emtw-patient-portal",
      category: "Patient Support",
      name: "MyChart & Financial Counseling",
      description: "Billing help, insurance questions, and portal support.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Main lobby information desk",
      audience: "patient",
      ctaLabel: "Open MyChart",
      ctaUrl: "https://mychart.emoryhealthcare.org",
      stages: ["pre_admission", "inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "emtw-interpreter",
      category: "Language Services",
      name: "Interpreter & Language Services",
      description: "In-person and video interpreters for 200+ languages, including ASL. Request through your nurse or call the front desk.",
      openHours: "24/7",
      locationHint: "Available at any nurse station",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    {
      id: "emtw-cardiac-education",
      category: "Patient Education",
      name: "Cardiac Patient Education",
      description: "Heart health classes, cardiac rehab orientation, dietary counseling, and one-on-one sessions with cardiac nurse educators.",
      openHours: "Mon-Fri 8 AM-4 PM",
      locationHint: "3rd floor, south tower cardiac center",
      audience: "patient",
      ctaLabel: "Heart Health Resources",
      ctaUrl: "https://www.emoryhealthcare.org/heart-vascular",
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    // -- Visitor (7) --
    {
      id: "emtw-parking",
      category: "Parking",
      name: "Visitor Parking Garage",
      description: "Covered parking with validation at the information desk.",
      openHours: "24/7",
      locationHint: "Linden Avenue garage entrance",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-cafe",
      category: "Dining",
      name: "Cafe at Midtown",
      description: "Coffee, fresh sandwiches, and daily specials.",
      openHours: "Daily 6:30 AM-7:30 PM",
      locationHint: "Ground floor atrium",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-gift-shop",
      category: "Gift Shop",
      name: "Midtown Gift Shop",
      description: "Flowers, snacks, reading material, and comfort items.",
      openHours: "Mon-Fri 9 AM-6 PM",
      locationHint: "Main lobby near elevators",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-wifi",
      category: "Connectivity",
      name: "Guest Wi-Fi",
      description: "Complimentary wireless access. Network: Emory-Guest.",
      openHours: "Always available",
      locationHint: "Campus-wide",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-prayer-room",
      category: "Family Support",
      name: "Prayer & Meditation Room",
      description: "Open interfaith space for reflection and prayer.",
      openHours: "24/7",
      locationHint: "Ground floor, east corridor",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-visiting-hours",
      category: "Visiting Hours",
      name: "Visiting Hours & Policies",
      description: "General visiting: 7 AM-9 PM daily. Cardiac ICU allows one visitor at a time during designated hours. All visitors must check in at the lobby desk.",
      openHours: "Daily 7 AM-9 PM",
      locationHint: "Check in at Peachtree Street entrance lobby",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-marta",
      category: "Transportation",
      name: "MARTA — Arts Center Station",
      description: "Arts Center MARTA station is two blocks west on 15th Street. Direct rail access to the airport, Buckhead, and Five Points transfer.",
      openHours: "Daily 5 AM-1 AM",
      locationHint: "1255 West Peachtree St, 0.2 miles west",
      audience: "visitor",
      ctaLabel: "MARTA Trip Planner",
      ctaUrl: "https://www.itsmarta.com/trip-planner.aspx",
    },
    {
      id: "emtw-nearby-pharmacy",
      category: "Nearby Pharmacy",
      name: "Walgreens — Peachtree St",
      description: "Full-service pharmacy and convenience items, 5-minute walk south on Peachtree. Open late for after-hours needs.",
      openHours: "Daily 7 AM-10 PM, Pharmacy closes 9 PM",
      locationHint: "1050 Peachtree St NE, 0.3 miles south",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-nearby-dining",
      category: "Nearby Dining",
      name: "Peachtree Street Dining",
      description: "Einstein Bros. Bagels, Moe's Southwest Grill, and Ponce City Market (10 min drive) for a wider selection of restaurants and food halls.",
      openHours: "Most open 7 AM-10 PM",
      locationHint: "Within 5-minute walk on Peachtree St",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Caregiver (2) --
    {
      id: "emtw-caregiver-lounge",
      category: "Caregiver Support",
      name: "Caregiver Lounge",
      description: "Quiet space for family caregivers with TV, recliners, and snack area.",
      openHours: "24/7",
      locationHint: "4th floor, near ICU",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-caregiver-desk",
      category: "Caregiver Support",
      name: "Social Work & Caregiver Services",
      description: "Help with discharge planning, community referrals, and caregiver burnout resources.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "2nd floor social work office",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
    },
    // -- Staff (5) --
    {
      id: "emtw-staff-dining",
      category: "Staff Dining",
      name: "Staff Dining Room",
      description: "Hot meals, salad bar, and employee specials.",
      openHours: "Daily 6 AM-midnight",
      locationHint: "Lower level",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-wellness",
      category: "Wellness",
      name: "Wellness Room",
      description: "Quiet retreat for meditation and decompression breaks.",
      openHours: "24/7 badge access",
      locationHint: "4th floor, west wing",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-lockers",
      category: "Amenities",
      name: "Staff Lockers",
      description: "Secure lockers with shower access.",
      openHours: "24/7 badge access",
      locationHint: "Lower level near staff entrance",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-oncall",
      category: "On-Call",
      name: "On-Call Rest Rooms",
      description: "Overnight rest rooms for residents and on-call staff.",
      openHours: "24/7 badge access",
      locationHint: "5th floor",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "emtw-cme",
      category: "Professional Development",
      name: "CME & Grand Rounds",
      description: "Continuing medical education and lecture series.",
      openHours: "See schedule",
      locationHint: "Conference Center, 2nd floor",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
  ],
  neighborhoodTips: [
    { text: "Peachtree Street has dozens of restaurants within a 5-minute walk for meals between visits.", audience: "all", timeContext: "day" },
    { text: "The Atlanta BeltLine Eastside Trail is a short walk east - great for a mental health break.", audience: "all", timeContext: "day" },
    { text: "MARTA Arts Center station is two blocks away for easy transit.", audience: "visitor" },
    { text: "Piedmont Park is a 10-minute walk for exercise or fresh air.", audience: "staff" },
    { text: "Patients: ask about the hospital's healing arts program for music and art therapy sessions.", audience: "patient" },
    { text: "Piedmont Park Saturday farmers market is a short walk — fresh produce and prepared foods.", audience: "all", dayOfWeek: "sat" },
    { text: "Late-night Waffle House on 10th Street is a 5-minute walk for post-shift meals.", audience: "staff", timeContext: "night" },
    { text: "Summer concerts at Piedmont Park are within walking distance on weekends.", audience: "all", season: "summer" },
    { text: "Caregivers: the W Atlanta Midtown and Loews Atlanta are within walking distance for overnight stays.", audience: "caregiver" },
    { text: "Caregivers: Publix on 14th St (5 min walk) has groceries, a deli counter, and a pharmacy for longer stays.", audience: "caregiver", timeContext: "day" },
    { text: "The Vortex on Peachtree is a 10-minute walk — burgers and comfort food until late.", audience: "all", timeContext: "night" },
    { text: "Whole Foods at Ponce City Market (10 min drive) has a hot bar, salad bar, and seating area.", audience: "visitor", timeContext: "day" },
    { text: "Winter: the heated breezeway connects the parking garage to the main entrance — follow signs from Level 2.", audience: "all", season: "winter" },
    { text: "Staff: Colony Square food court has quick lunch options just a block north on Peachtree.", audience: "staff", timeContext: "day" },
    { text: "South City Kitchen on Crescent Ave (8 min walk) has Southern comfort food and a great patio.", audience: "visitor", timeContext: "day" },
    { text: "Antico Pizza on Hemphill (10 min drive) is widely considered the best Neapolitan pizza in Atlanta.", audience: "all", timeContext: "day" },
    { text: "Biltong Bar at Ponce City Market has healthy grain bowls and smoothies — good for post-discharge nutrition.", audience: "patient", timeContext: "day" },
    { text: "The Starbucks Reserve on Peachtree Walk is a 3-min walk for specialty coffee.", audience: "all", timeContext: "day" },
    { text: "For late-night pharmacy needs: CVS on Peachtree at 10th is open until midnight.", audience: "all", timeContext: "night" },
    { text: "W Atlanta Midtown, Loews, and AC Hotel are all within 3 blocks for overnight stays.", audience: "caregiver" },
    { text: "Uber Eats and DoorDash deliver to the Peachtree entrance — use the hospital address for drop-off.", audience: "caregiver", timeContext: "night" },
    { text: "Fred's Meat & Bread at Krog Street Market (12 min) has comfort food sandwiches — staff favorite.", audience: "staff", timeContext: "day" },
    { text: "High Museum of Art is a 10-min walk — free second Sundays for a cultural break.", audience: "visitor", season: "fall" },
  ],
  staffBoardItems: [
    { id: "emtw-sb-cardiac-conf", title: "Cardiac Care Conference", description: "Latest guidelines in cardiac rehabilitation. CME credit available.", category: "cme", schedule: "thu", timeHint: "12:30 PM", ctaLabel: "Register", ctaUrl: "https://med.emory.edu/education/cme" },
    { id: "emtw-sb-mindfulness", title: "Mindfulness Monday", description: "Guided meditation session in the wellness room. 15 minutes.", category: "wellness", schedule: "mon", timeHint: "7:15 AM", ctaLabel: "Wellness Portal", ctaUrl: "https://hr.emory.edu/eu/wellness" },
    { id: "emtw-sb-cafe-special", title: "Cafe Special: Mediterranean Wrap", description: "Hummus, grilled vegetables, and feta in a warm wrap. Staff price $5.50.", category: "food_special", schedule: "today", timeHint: "Lunch", ctaLabel: "View Menu", ctaUrl: "https://www.emoryhealthcare.org/locations/hospitals/emory-university-hospital-midtown" },
    { id: "emtw-sb-parking-update", title: "Linden Garage Resurfacing", description: "Levels 3-4 closed this week. Use Peachtree entrance for additional parking.", category: "announcement", schedule: "weekday", timeHint: "All week", ctaLabel: "Parking Map", ctaUrl: "https://transportation.emory.edu/parking" },
  ],
};

const EMORY_SAINT_JOSEPHS: HospitalCurationProfile = {
  slug: "emory-saint-josephs-hospital",
  displayName: "Emory Saint Joseph's Hospital",
  shortName: "Saint Joseph's",
  neighborhood: "Sandy Springs",
  campusType: "regional",
  categoryBoosts: { family_children: 3, stay_well: 2 },
  highlightOrgOverrides: {
    family_children: [
      "choa-community-events",
      "healthy-mothers-ga",
    ],
    stay_well: [
      "ymca-atlanta",
      "good-samaritan-health-center",
    ],
  },
  stageHeroHints: {
    pre_admission: "Getting ready — complete pre-admission labs and registration on the ground floor, review your birth plan with your OB team, and pack your hospital bag checklist.",
    inpatient: "Here for you — pharmacy, birth center, chaplaincy, and the courtyard healing garden are all on campus. Your nurse can help with anything you need.",
    discharge: "Heading home — pick up prescriptions on the ground floor, schedule your postpartum or follow-up visit, and review community resources for new parents below.",
  },
  dischargeCategoryBoosts: ["food_nutrition", "family_children", "life_essentials"],
  dischargeTransport: [
    { id: "esj-dt-rideshare", title: "Rideshare Pickup", description: "Uber and Lyft: use the main entrance circle for pickup. A covered drop-off area is available for loading car seats and strollers.", ctaLabel: null, ctaUrl: null },
    { id: "esj-dt-parking", title: "Parking — Free Lot", description: "Free surface lot and covered garage. No validation needed. Wheelchair transport to your car available — ask your nurse before discharge.", ctaLabel: null, ctaUrl: null },
    { id: "esj-dt-marta", title: "MARTA — Sandy Springs Station", description: "Sandy Springs MARTA station is a 10-minute drive or rideshare. Rail connects to Midtown, downtown, and the airport.", ctaLabel: "MARTA Trip Planner", ctaUrl: "https://www.itsmarta.com/trip-planner.aspx" },
  ],
  dischargeFollowUp: [
    { id: "esj-df-mychart", title: "Schedule Follow-Up via MyChart", description: "Log in to MyChart for postpartum or follow-up appointments, newborn visit scheduling, and messaging your care team.", ctaLabel: "Open MyChart", ctaUrl: "https://mychart.emoryhealthcare.org" },
    { id: "esj-df-newborn-care", title: "Newborn & Postpartum Support", description: "Lactation consultants available by phone after discharge. Your first pediatric visit should be within 2-3 days of going home.", ctaLabel: "Birth Center Resources", ctaUrl: "https://www.emoryhealthcare.org/centers-programs/birthing-center" },
    { id: "esj-df-home-health", title: "Home Health & Nursing", description: "If your doctor ordered home health visits, the social work team will coordinate your schedule before you leave.", ctaLabel: null, ctaUrl: null },
  ],
  campusResources: [
    // -- Patient (7) --
    {
      id: "esj-pharmacy",
      category: "Pharmacy",
      name: "Saint Joseph's Pharmacy",
      description: "Outpatient prescriptions and medication counseling.",
      openHours: "Mon-Fri 8 AM-6 PM",
      locationHint: "Ground floor, near main entrance",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "esj-lab",
      category: "Lab & Imaging",
      name: "Lab & Diagnostic Imaging",
      description: "Blood work, X-ray, MRI, and CT scans.",
      openHours: "Mon-Fri 7 AM-5 PM",
      locationHint: "1st floor, west wing",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "esj-spiritual",
      category: "Spiritual Care",
      name: "Pastoral Care & Chapel",
      description: "Catholic heritage chapel with interfaith chaplains available.",
      openHours: "Daily, 24/7 on-call",
      locationHint: "Main building, 1st floor",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient"],
    },
    {
      id: "esj-birth-center",
      category: "Specialty Check-In",
      name: "Birth Center Check-In",
      description: "Labor & delivery registration, prenatal visits, and birthing suites.",
      openHours: "24/7",
      locationHint: "Women's Pavilion, 2nd floor",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "esj-patient-portal",
      category: "Patient Support",
      name: "MyChart & Patient Financial Services",
      description: "Billing, payment plans, and online portal assistance.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Main lobby desk",
      audience: "patient",
      ctaLabel: "Open MyChart",
      ctaUrl: "https://mychart.emoryhealthcare.org",
      stages: ["pre_admission", "inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "esj-interpreter",
      category: "Language Services",
      name: "Interpreter & Language Services",
      description: "In-person and video interpreters for 200+ languages, including ASL. Request through your nurse or the front desk.",
      openHours: "24/7",
      locationHint: "Available at any nurse station",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    {
      id: "esj-childbirth-education",
      category: "Patient Education",
      name: "Childbirth & New Parent Education",
      description: "Lamaze classes, breastfeeding workshops, infant CPR, and newborn care courses. Partners welcome.",
      openHours: "Classes scheduled evenings & weekends",
      locationHint: "Women's Pavilion, 1st floor classroom",
      audience: "patient",
      ctaLabel: "Class Schedule",
      ctaUrl: "https://www.emoryhealthcare.org/centers-programs/birthing-center",
      stages: ["pre_admission"],
    },
    // -- Visitor (7) --
    {
      id: "esj-parking",
      category: "Parking",
      name: "Visitor Parking",
      description: "Free surface lot and covered garage for visitors.",
      openHours: "24/7",
      locationHint: "Main entrance lot",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-cafe",
      category: "Dining",
      name: "Courtyard Cafe",
      description: "Meals, snacks, and beverages in a garden-view setting.",
      openHours: "Daily 7 AM-7 PM",
      locationHint: "Ground floor courtyard",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-gift-shop",
      category: "Gift Shop",
      name: "Saint Joseph's Gift Shop",
      description: "Cards, flowers, baby gifts, and comfort items.",
      openHours: "Mon-Fri 9 AM-5 PM",
      locationHint: "Main lobby",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-wifi",
      category: "Connectivity",
      name: "Guest Wi-Fi",
      description: "Free wireless internet. Network: Emory-Guest.",
      openHours: "Always available",
      locationHint: "Campus-wide",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-family-lounge",
      category: "Family Support",
      name: "Family Lounge & Nursery Viewing",
      description: "Comfortable waiting area near labor and delivery with nursery window.",
      openHours: "24/7",
      locationHint: "Women's Pavilion, 2nd floor",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-visiting-hours",
      category: "Visiting Hours",
      name: "Visiting Hours & Policies",
      description: "General visiting: 8 AM-8 PM daily. Birth Center allows two support persons 24/7 during labor. All visitors check in at the main entrance.",
      openHours: "Daily 8 AM-8 PM",
      locationHint: "Check in at main entrance desk",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-marta",
      category: "Transportation",
      name: "MARTA — Sandy Springs Station",
      description: "Sandy Springs MARTA station is a 10-minute drive. Ride south to Midtown, downtown, or the airport. Rideshare pickup at the main entrance circle.",
      openHours: "Daily 5 AM-1 AM",
      locationHint: "7010 MARTA Blvd, Sandy Springs",
      audience: "visitor",
      ctaLabel: "MARTA Trip Planner",
      ctaUrl: "https://www.itsmarta.com/trip-planner.aspx",
    },
    {
      id: "esj-nearby-pharmacy",
      category: "Nearby Pharmacy",
      name: "CVS Pharmacy — Johnson Ferry Rd",
      description: "Full-service pharmacy with drive-through, 5 minutes from campus. Open late for evening needs.",
      openHours: "Daily 8 AM-10 PM, Pharmacy closes 9 PM",
      locationHint: "6309 Johnson Ferry Rd, 0.5 miles south",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-nearby-dining",
      category: "Nearby Dining",
      name: "Hammond Drive Restaurants",
      description: "Chick-fil-A, Panda Express, and La Parrilla Mexican restaurant within a 5-minute drive on Hammond Drive. Korean and Vietnamese options on Buford Highway (15 min).",
      openHours: "Most open 11 AM-10 PM",
      locationHint: "Hammond Drive corridor, 0.5 miles east",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Caregiver (3) --
    {
      id: "esj-caregiver-lounge",
      category: "Caregiver Support",
      name: "Birth Partner Lounge",
      description: "Rest area for birth partners and family near labor and delivery.",
      openHours: "24/7",
      locationHint: "Women's Pavilion, 2nd floor",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-caregiver-social-work",
      category: "Caregiver Support",
      name: "Social Work & Caregiver Support",
      description: "Discharge planning, community referrals, and caregiver wellness check-ins.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "1st floor, social services",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
    },
    {
      id: "esj-lactation-room",
      category: "Family Support",
      name: "Lactation Suite",
      description: "Private lactation rooms with hospital-grade pumps and nursing support.",
      openHours: "24/7",
      locationHint: "Women's Pavilion, 2nd floor",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Staff (4) --
    {
      id: "esj-staff-dining",
      category: "Staff Dining",
      name: "Staff Cafe",
      description: "Employee meals and daily specials at discounted rates.",
      openHours: "Daily 6:30 AM-10 PM",
      locationHint: "Lower level",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-wellness",
      category: "Wellness",
      name: "Staff Wellness Room",
      description: "Quiet space for meditation and lactation room.",
      openHours: "24/7 badge access",
      locationHint: "2nd floor, east corridor",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-lockers",
      category: "Amenities",
      name: "Staff Lockers & Showers",
      description: "Secure storage and shower facilities for staff.",
      openHours: "24/7 badge access",
      locationHint: "Lower level",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "esj-cme",
      category: "Professional Development",
      name: "Education & CME Programs",
      description: "Continuing education, nursing certifications, and skills labs.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Education Center",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
  ],
  neighborhoodTips: [
    { text: "Morgan Falls Overlook Park is a 10-minute drive with trails, playgrounds, and river views.", audience: "all", timeContext: "day" },
    { text: "Hammond Drive has a wide selection of international restaurants within a few minutes.", audience: "visitor" },
    { text: "Sandy Springs MARTA station offers easy transit connections south into the city.", audience: "visitor" },
    { text: "Staff can walk to several coffee shops on Johnson Ferry Rd during breaks.", audience: "staff" },
    { text: "Patients: the Healing Garden courtyard is accessible on the ground floor for fresh air.", audience: "patient" },
    { text: "Sandy Springs Farmers Market on Saturdays features local produce and artisan foods.", audience: "all", dayOfWeek: "sat" },
    { text: "Fall foliage at Morgan Falls Overlook Park is especially beautiful for a scenic drive.", audience: "all", season: "fall", timeContext: "day" },
    { text: "Caregivers: Hampton Inn Sandy Springs is 5 minutes away for overnight stays near the birth center.", audience: "caregiver" },
    { text: "Caregivers: Target and Publix on Hammond Drive (5 min) have baby supplies, snacks, and a pharmacy.", audience: "caregiver", timeContext: "day" },
    { text: "New parents: the Chick-fil-A on Johnson Ferry Rd has a drive-through — handy with a newborn.", audience: "caregiver", timeContext: "day" },
    { text: "Kroger on Johnson Ferry Rd (5 min drive) is open until 11 PM for late-evening grocery runs.", audience: "all", timeContext: "night" },
    { text: "Spring: the azaleas at Morgan Falls Overlook Park are gorgeous — a perfect short outing for recovering patients.", audience: "all", season: "spring", timeContext: "day" },
    { text: "Staff: Top Spice Thai on Roswell Rd has quick lunch specials and delivery options.", audience: "staff", timeContext: "day" },
    { text: "La Parrilla Mexican on Hammond Drive is a 5-min drive — good for families and large groups.", audience: "visitor", timeContext: "day" },
    { text: "Buford Highway (15 min south) has dozens of authentic Korean, Vietnamese, and Chinese restaurants.", audience: "all", timeContext: "day" },
    { text: "Starbucks on Johnson Ferry Rd is a 3-min drive with a drive-through — no need to unbuckle the car seat.", audience: "caregiver", timeContext: "day" },
    { text: "CVS on Roswell Rd (5 min) has an open-until-10 PM pharmacy and baby supplies.", audience: "caregiver", timeContext: "night" },
    { text: "Hammond Drive has Trader Joe's and Whole Foods both within 5 minutes for healthy groceries.", audience: "all", timeContext: "day" },
    { text: "Hyatt Place Sandy Springs is 7 minutes away with extended-stay rates for families.", audience: "caregiver" },
    { text: "Sweet Hut Bakery on Buford Hwy (15 min) has Asian pastries and boba — open late.", audience: "all", timeContext: "night" },
    { text: "Goldberg's Fine Foods on Roswell Rd has quick deli sandwiches and breakfast all day.", audience: "staff", timeContext: "day" },
  ],
  staffBoardItems: [
    { id: "esj-sb-ob-seminar", title: "OB/GYN Case Review", description: "Monthly case review for birth center staff. CME credit available.", category: "cme", schedule: "tue", timeHint: "1:00 PM", ctaLabel: "Register", ctaUrl: "https://med.emory.edu/education/cme" },
    { id: "esj-sb-walking-group", title: "Staff Walking Group", description: "Lunchtime walk around the courtyard garden. Meet at the cafe.", category: "wellness", schedule: "weekday", timeHint: "12:15 PM", ctaLabel: "Wellness Portal", ctaUrl: "https://hr.emory.edu/eu/wellness" },
    { id: "esj-sb-cafe-special", title: "Cafe Special: Garden Salad Bowl", description: "Fresh salad with seasonal toppings. Staff price $5.", category: "food_special", schedule: "today", timeHint: "Lunch", ctaLabel: "View Menu", ctaUrl: "https://www.emoryhealthcare.org/locations/hospitals/emory-saint-josephs-hospital" },
    { id: "esj-sb-nursery-reno", title: "Nursery Wing Renovation Update", description: "The west nursery wing renovation is on schedule. New family suites open next month. Staff detour signs posted.", category: "announcement", schedule: "weekday", timeHint: "All week", ctaLabel: null, ctaUrl: null },
  ],
};

const EMORY_JOHNS_CREEK: HospitalCurationProfile = {
  slug: "emory-johns-creek-hospital",
  displayName: "Emory Johns Creek Hospital",
  shortName: "Johns Creek",
  neighborhood: "Johns Creek",
  campusType: "suburban",
  categoryBoosts: { family_children: 4, food_nutrition: 2 },
  highlightOrgOverrides: {
    family_children: [
      "choa-community-events",
      "camp-twin-lakes",
    ],
    food_nutrition: [
      "atlanta-community-food-bank",
      "community-farmers-markets",
    ],
  },
  stageHeroHints: {
    pre_admission: "Preparing for your visit — complete labs on the 1st floor, bring your insurance card and medication list, and use the free parking lot at the main entrance.",
    inpatient: "Support while you're here — pharmacy, chaplaincy, the healing garden, and your care team are all nearby. Family can visit 8 AM-8 PM.",
    discharge: "Take-home resources — fill prescriptions on the 1st floor, schedule follow-ups through MyChart, and review community programs for families below.",
  },
  dischargeCategoryBoosts: ["food_nutrition", "family_children", "life_essentials"],
  dischargeTransport: [
    { id: "ejc-dt-rideshare", title: "Rideshare Pickup", description: "Uber and Lyft: use the main entrance circle for pickup. Covered drop-off area available. Ask the front desk for the exact pickup address.", ctaLabel: null, ctaUrl: null },
    { id: "ejc-dt-parking", title: "Parking — Free Lot", description: "Free surface lot parking. No validation needed. Wheelchair transport to your car available — ask your nurse before discharge.", ctaLabel: null, ctaUrl: null },
    { id: "ejc-dt-valet", title: "Valet Service", description: "Complimentary valet parking at the main entrance, weekdays 7 AM-5 PM. Ask the front desk to have your car brought around.", ctaLabel: null, ctaUrl: null },
  ],
  dischargeFollowUp: [
    { id: "ejc-df-mychart", title: "Schedule Follow-Up via MyChart", description: "Log in to MyChart for follow-up appointments, test results, and messaging your care team.", ctaLabel: "Open MyChart", ctaUrl: "https://mychart.emoryhealthcare.org" },
    { id: "ejc-df-womens-health", title: "Women's Health Follow-Up", description: "If you visited for mammography or women's health services, results are typically available in MyChart within 5-7 business days.", ctaLabel: "Women's Health", ctaUrl: "https://www.emoryhealthcare.org/centers-programs/womens-health" },
    { id: "ejc-df-pharmacy-delivery", title: "Prescription Delivery", description: "Publix Pharmacy on Medlock Bridge Rd (5 min) offers prescription delivery. Emory Pharmacy also offers mail-order refills.", ctaLabel: "Pharmacy Services", ctaUrl: "https://www.emoryhealthcare.org/centers-programs/pharmacy" },
  ],
  campusResources: [
    // -- Patient (7) --
    {
      id: "ejc-pharmacy",
      category: "Pharmacy",
      name: "Johns Creek Outpatient Pharmacy",
      description: "Prescription services and medication review.",
      openHours: "Mon-Fri 8 AM-6 PM",
      locationHint: "1st floor, near main lobby",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "ejc-lab",
      category: "Lab & Imaging",
      name: "Lab & Imaging Services",
      description: "Blood draws, imaging, and diagnostic testing.",
      openHours: "Mon-Fri 7 AM-4:30 PM",
      locationHint: "1st floor, south corridor",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient"],
    },
    {
      id: "ejc-spiritual",
      category: "Spiritual Care",
      name: "Chaplaincy Services",
      description: "Interfaith chaplain available for spiritual support.",
      openHours: "Mon-Fri, on-call weekends",
      locationHint: "1st floor near family lounge",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient"],
    },
    {
      id: "ejc-womens-center",
      category: "Specialty Check-In",
      name: "Women's Center",
      description: "Mammography, bone density, and women's health check-in.",
      openHours: "Mon-Fri 8 AM-4:30 PM",
      locationHint: "2nd floor, women's health wing",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission"],
    },
    {
      id: "ejc-patient-portal",
      category: "Patient Support",
      name: "MyChart & Patient Services",
      description: "Billing support, insurance coordination, and portal help.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Main lobby information desk",
      audience: "patient",
      ctaLabel: "Open MyChart",
      ctaUrl: "https://mychart.emoryhealthcare.org",
      stages: ["pre_admission", "inpatient", "discharge"],
      dischargeBundle: true,
    },
    {
      id: "ejc-interpreter",
      category: "Language Services",
      name: "Interpreter & Language Services",
      description: "In-person and video interpreters for 200+ languages, including ASL and Korean. Request through your nurse or the front desk.",
      openHours: "24/7",
      locationHint: "Available at any nurse station",
      audience: "patient",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["pre_admission", "inpatient", "discharge"],
    },
    {
      id: "ejc-womens-education",
      category: "Patient Education",
      name: "Women's Health Education Center",
      description: "Mammography prep, bone health workshops, menopause support groups, and breast cancer survivorship programs.",
      openHours: "Mon-Fri 9 AM-4 PM",
      locationHint: "2nd floor, women's health wing",
      audience: "patient",
      ctaLabel: "Women's Health Programs",
      ctaUrl: "https://www.emoryhealthcare.org/centers-programs/womens-health",
      stages: ["pre_admission", "discharge"],
    },
    // -- Visitor (7) --
    {
      id: "ejc-parking",
      category: "Parking",
      name: "Visitor Parking",
      description: "Free parking in the main lot with covered drop-off area.",
      openHours: "24/7",
      locationHint: "Main entrance parking lot",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-cafe",
      category: "Dining",
      name: "Hospital Cafe",
      description: "Fresh meals, coffee, and vending options.",
      openHours: "Daily 7 AM-7 PM",
      locationHint: "Ground floor, main atrium",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-gift-shop",
      category: "Gift Shop",
      name: "Johns Creek Gift Shop",
      description: "Gifts, snacks, magazines, and personal items.",
      openHours: "Mon-Fri 9 AM-5 PM",
      locationHint: "Main lobby",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-wifi",
      category: "Connectivity",
      name: "Guest Wi-Fi",
      description: "Complimentary wireless internet. Network: Emory-Guest.",
      openHours: "Always available",
      locationHint: "Campus-wide",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-family-lounge",
      category: "Family Support",
      name: "Healing Garden & Family Lounge",
      description: "Outdoor healing garden and indoor lounge with refreshments.",
      openHours: "Garden: dawn to dusk. Lounge: 24/7",
      locationHint: "Ground floor courtyard & 2nd floor",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-visiting-hours",
      category: "Visiting Hours",
      name: "Visiting Hours & Policies",
      description: "General visiting: 8 AM-8 PM daily. Two visitors per patient at a time. Children under 12 must be accompanied by an adult. Check in at the main lobby.",
      openHours: "Daily 8 AM-8 PM",
      locationHint: "Check in at main entrance lobby",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-rideshare",
      category: "Transportation",
      name: "Rideshare & Parking",
      description: "Uber and Lyft pickup/drop-off at the main entrance circle. Free surface lot parking — no garage. Valet available weekdays.",
      openHours: "Valet: Mon-Fri 7 AM-5 PM",
      locationHint: "Main entrance circle and front lot",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-nearby-pharmacy",
      category: "Nearby Pharmacy",
      name: "Publix Pharmacy — Johns Creek",
      description: "Full-service pharmacy inside Publix grocery, 5 minutes from campus. Also has a deli and bakery for quick meals.",
      openHours: "Mon-Sat 9 AM-9 PM, Sun 11 AM-6 PM",
      locationHint: "10700 Medlock Bridge Rd, 0.5 miles south",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-nearby-dining",
      category: "Nearby Dining",
      name: "Medlock Bridge Rd Dining",
      description: "Chick-fil-A, Taco Mac, and multiple Korean restaurants (Jang Su Jang, So Kong Dong) within a 5-minute drive.",
      openHours: "Most open 11 AM-10 PM",
      locationHint: "Medlock Bridge Rd corridor, 0.5 miles",
      audience: "visitor",
      ctaLabel: null,
      ctaUrl: null,
    },
    // -- Caregiver (2) --
    {
      id: "ejc-caregiver-lounge",
      category: "Caregiver Support",
      name: "Family Caregiver Lounge",
      description: "Comfortable space for family caregivers with recliners and refreshments.",
      openHours: "24/7",
      locationHint: "2nd floor, near family lounge",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-caregiver-coordinator",
      category: "Caregiver Support",
      name: "Patient & Family Coordinator",
      description: "Help with discharge planning, care coordination, and community referrals.",
      openHours: "Mon-Fri 8 AM-4:30 PM",
      locationHint: "1st floor, patient services",
      audience: "caregiver",
      ctaLabel: null,
      ctaUrl: null,
      stages: ["inpatient", "discharge"],
    },
    // -- Staff (4) --
    {
      id: "ejc-staff-dining",
      category: "Staff Dining",
      name: "Staff Break Room & Cafe",
      description: "Employee dining area with subsidized meals.",
      openHours: "Daily 6:30 AM-9 PM",
      locationHint: "Lower level",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-wellness",
      category: "Wellness",
      name: "Meditation & Wellness Room",
      description: "Quiet retreat for staff decompression and wellness.",
      openHours: "24/7 badge access",
      locationHint: "2nd floor, west wing",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-lockers",
      category: "Amenities",
      name: "Staff Lockers",
      description: "Secure lockers with shower access.",
      openHours: "24/7 badge access",
      locationHint: "Lower level",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: "ejc-continuing-ed",
      category: "Professional Development",
      name: "Continuing Education",
      description: "Skills training, certifications, and professional development.",
      openHours: "Mon-Fri 8 AM-5 PM",
      locationHint: "Conference room, 3rd floor",
      audience: "staff",
      ctaLabel: null,
      ctaUrl: null,
    },
  ],
  neighborhoodTips: [
    { text: "Medlock Bridge Road has a variety of family restaurants and fast-casual dining within 5 minutes.", audience: "all", timeContext: "day" },
    { text: "Autrey Mill Nature Preserve offers short nature trails and a historic village for a peaceful outing.", audience: "visitor", timeContext: "day" },
    { text: "Johns Creek Town Center has shops, restaurants, and a weekly community market.", audience: "all" },
    { text: "Staff: nearby Ocee Park has walking trails, perfect for a lunchtime break.", audience: "staff", timeContext: "day" },
    { text: "Patients: ask about the outdoor healing garden accessible from the ground floor.", audience: "patient" },
    { text: "Spring blooms at Autrey Mill Nature Preserve make for a lovely short walk.", audience: "visitor", season: "spring", timeContext: "day" },
    { text: "Saturday farmers market at Johns Creek Town Center has local produce and baked goods.", audience: "all", dayOfWeek: "sat" },
    { text: "Caregivers: Hilton Garden Inn Johns Creek is 5 minutes away for overnight stays.", audience: "caregiver" },
    { text: "Caregivers: Publix on Medlock Bridge Rd (5 min) has groceries, pharmacy, and a hot deli counter.", audience: "caregiver", timeContext: "day" },
    { text: "H Mart on Pleasant Hill Rd (15 min south) has a large Asian grocery and food court — great for Korean, Japanese, and Chinese food.", audience: "all", timeContext: "day" },
    { text: "Walgreens on State Bridge Rd (3 min drive) is open until 10 PM for evening pharmacy needs.", audience: "all", timeContext: "night" },
    { text: "Summer: Newtown Park has an amphitheater with free outdoor movies and concerts on weekends.", audience: "all", season: "summer", timeContext: "day" },
    { text: "Staff: Brio Italian at Johns Creek Town Center has a quick lunch express menu.", audience: "staff", timeContext: "day" },
    { text: "Jang Su Jang on Old Alabama Rd (5 min) has authentic Korean tofu soup — open for lunch and dinner.", audience: "all", timeContext: "day" },
    { text: "Taco Mac on Medlock Bridge Rd has bar food and games — good for visitors waiting during procedures.", audience: "visitor", timeContext: "day" },
    { text: "Starbucks and Dunkin' on Medlock Bridge are both within 3 minutes for quick coffee runs.", audience: "all", timeContext: "day" },
    { text: "Kroger on Jones Bridge Rd (7 min) is open until 11 PM with pharmacy, deli, and grocery pickup.", audience: "caregiver", timeContext: "night" },
    { text: "Patel Brothers on Peachtree Industrial (10 min) has a wide Indian/South Asian grocery and hot food bar.", audience: "all", timeContext: "day" },
    { text: "Embassy Suites Johns Creek (10 min) has suites with kitchenettes — good for longer family stays.", audience: "caregiver" },
    { text: "DoorDash and Uber Eats deliver to the main entrance lobby — ask reception for the delivery address.", audience: "caregiver", timeContext: "night" },
    { text: "Alpharetta Greenway trail (10 min) connects to Big Creek Greenway — a scenic 8-mile walk or bike path.", audience: "all", timeContext: "day" },
    { text: "Staff: So Kong Dong on Old Alabama Rd has the best Korean soft tofu in the area — quick lunch.", audience: "staff", timeContext: "day" },
  ],
  staffBoardItems: [
    { id: "ejc-sb-skills-lab", title: "Nursing Skills Lab", description: "Hands-on practice with new IV pump models. Required for new staff.", category: "cme", schedule: "fri", timeHint: "2:00 PM", ctaLabel: "Register", ctaUrl: "https://med.emory.edu/education/cme" },
    { id: "ejc-sb-stretch-break", title: "Staff Stretch Break", description: "5-minute guided stretching in the break room. Drop in anytime.", category: "wellness", schedule: "weekday", timeHint: "2:30 PM", ctaLabel: "Wellness Portal", ctaUrl: "https://hr.emory.edu/eu/wellness" },
    { id: "ejc-sb-cafe-special", title: "Cafe Special: BBQ Chicken Plate", description: "BBQ chicken with coleslaw and cornbread. Staff price $6.", category: "food_special", schedule: "today", timeHint: "Lunch", ctaLabel: "View Menu", ctaUrl: "https://www.emoryhealthcare.org/locations/hospitals/emory-johns-creek-hospital" },
    { id: "ejc-sb-garden-open", title: "Healing Garden Open for Staff", description: "The healing garden courtyard is now open for staff breaks and lunch.", category: "announcement", schedule: "weekday", timeHint: "All day", ctaLabel: null, ctaUrl: null },
  ],
};

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

const PROFILES: HospitalCurationProfile[] = [
  EMORY_UNIVERSITY_HOSPITAL,
  EMORY_MIDTOWN,
  EMORY_SAINT_JOSEPHS,
  EMORY_JOHNS_CREEK,
];

const PROFILE_BY_SLUG = new Map(PROFILES.map((p) => [p.slug, p]));

export function getHospitalProfile(slug: string | null | undefined): HospitalCurationProfile | null {
  if (!slug) return null;
  return PROFILE_BY_SLUG.get(slug) ?? null;
}

const AUDIENCE_SORT_ORDER: Record<HospitalAudienceMode, CampusResourceAudience[]> = {
  urgent: ["patient", "caregiver", "visitor", "staff"],
  treatment: ["patient", "caregiver", "visitor", "staff"],
  visitor: ["visitor", "caregiver", "patient", "staff"],
  staff: ["staff", "patient", "caregiver", "visitor"],
};

export const AUDIENCE_LABELS: Record<CampusResourceAudience, string> = {
  patient: "For Patients",
  visitor: "For Visitors",
  staff: "For Staff",
  caregiver: "For Caregivers",
};

export function getProfileCampusResources(
  profile: HospitalCurationProfile,
  mode: HospitalAudienceMode
): CampusResource[] {
  const order = AUDIENCE_SORT_ORDER[mode] || AUDIENCE_SORT_ORDER.visitor;
  return [...profile.campusResources].sort((a, b) => {
    const aIdx = order.indexOf(a.audience);
    const bIdx = order.indexOf(b.audience);
    return aIdx - bIdx;
  });
}

export function getProfileNeighborhoodTips(
  profile: HospitalCurationProfile,
  mode: HospitalAudienceMode
): NeighborhoodTip[] {
  const audienceForMode: CampusResourceAudience =
    mode === "urgent" || mode === "treatment" ? "patient" : mode === "visitor" ? "visitor" : "staff";

  return profile.neighborhoodTips.filter(
    (tip) => tip.audience === "all" || tip.audience === audienceForMode
  );
}

// ---------------------------------------------------------------------------
// Stage-aware resource filtering (Feature 2)
// ---------------------------------------------------------------------------

export function getProfileCampusResourcesForStage(
  profile: HospitalCurationProfile,
  mode: HospitalAudienceMode,
  stage: VisitStage
): CampusResource[] {
  const sorted = getProfileCampusResources(profile, mode);
  const matching: CampusResource[] = [];
  const rest: CampusResource[] = [];

  for (const resource of sorted) {
    if (resource.stages?.includes(stage)) {
      matching.push(resource);
    } else {
      rest.push(resource);
    }
  }

  return [...matching, ...rest];
}

// ---------------------------------------------------------------------------
// Enhanced neighborhood tips filtering (Feature 6)
// ---------------------------------------------------------------------------

export function getProfileNeighborhoodTipsFiltered(
  profile: HospitalCurationProfile,
  mode: HospitalAudienceMode,
  opts?: { timeContext?: "day" | "night"; season?: Season; dayOfWeek?: DayKey }
): NeighborhoodTip[] {
  const baseTips = getProfileNeighborhoodTips(profile, mode);

  // Also include caregiver tips when mode implies caregiving
  const withCaregiverTips = mode === "visitor" || mode === "treatment"
    ? profile.neighborhoodTips.filter(
        (tip) => tip.audience === "caregiver" && !baseTips.includes(tip)
      )
    : [];

  const allTips = [...baseTips, ...withCaregiverTips];

  if (!opts) return allTips;

  return allTips.filter((tip) => {
    // Tips without temporal fields always pass through
    if (!tip.season && !tip.dayOfWeek && !tip.timeContext) return true;

    // If tip has temporal fields, check each one that exists
    if (tip.season && opts.season && tip.season !== opts.season) return false;
    if (tip.dayOfWeek && opts.dayOfWeek && tip.dayOfWeek !== opts.dayOfWeek) return false;
    if (tip.timeContext && opts.timeContext && tip.timeContext !== opts.timeContext) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Staff board (Feature 8)
// ---------------------------------------------------------------------------

const WEEKDAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND_KEYS: DayKey[] = ["sat", "sun"];

export function getStaffBoardItemsForToday(profile: HospitalCurationProfile, now?: Date): StaffBoardItem[] {
  if (!profile.staffBoardItems) return [];

  const dayKey = getDayOfWeekKey(now);
  const isWeekday = WEEKDAY_KEYS.includes(dayKey);
  const isWeekend = WEEKEND_KEYS.includes(dayKey);

  return profile.staffBoardItems.filter((item) => {
    if (item.schedule === "today") return true;
    if (item.schedule === "weekday" && isWeekday) return true;
    if (item.schedule === "weekend" && isWeekend) return true;
    if (item.schedule === dayKey) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Hospital handoff (Feature 4)
// ---------------------------------------------------------------------------

export type HospitalHandoffDiff = {
  fromName: string;
  toName: string;
  differences: string[];
};

export function buildHospitalHandoffDiff(
  fromSlug: string,
  toSlug: string
): HospitalHandoffDiff | null {
  const from = getHospitalProfile(fromSlug);
  const to = getHospitalProfile(toSlug);
  if (!from || !to) return null;

  const differences: string[] = [];

  // Compare parking
  const fromParking = from.campusResources.find((r) => r.category === "Parking");
  const toParking = to.campusResources.find((r) => r.category === "Parking");
  if (fromParking && toParking && fromParking.openHours !== toParking.openHours) {
    differences.push(`Parking hours differ: ${to.shortName} is ${toParking.openHours}`);
  }
  if (fromParking && toParking && fromParking.description !== toParking.description) {
    differences.push(`Parking: ${toParking.description}`);
  }

  // Compare cafe hours
  const fromCafe = from.campusResources.find((r) => r.category === "Dining");
  const toCafe = to.campusResources.find((r) => r.category === "Dining");
  if (fromCafe && toCafe && fromCafe.openHours !== toCafe.openHours) {
    differences.push(`Cafe hours differ: ${to.shortName} cafe is ${toCafe.openHours}`);
  }

  // Compare campus type
  if (from.campusType !== to.campusType) {
    differences.push(`Campus type: ${to.campusType} (was ${from.campusType})`);
  }

  // Compare neighborhood
  if (from.neighborhood !== to.neighborhood) {
    differences.push(`Neighborhood: ${to.neighborhood}`);
  }

  if (differences.length === 0) return null;

  return {
    fromName: from.shortName,
    toName: to.shortName,
    differences,
  };
}

// ---------------------------------------------------------------------------
// Discharge resources (Feature 3)
// ---------------------------------------------------------------------------

export function getDischargeResources(profile: HospitalCurationProfile): CampusResource[] {
  return profile.campusResources.filter(
    (r) => r.dischargeBundle || r.stages?.includes("discharge")
  );
}
