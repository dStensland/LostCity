// Programs entity types — maps to database/schema.sql programs table

/**
 * Library pass data embedded in the venues.library_pass JSONB column.
 * Shared between LibraryPassCallout and LibraryPassSection.
 */
export type LibraryPassData = {
  eligible: boolean;
  program: string;
  benefit: string;
  passes_per_checkout: number | null;
  notes: string | null;
  url: string;
};

export type ProgramType =
  | "camp"
  | "enrichment"
  | "league"
  | "club"
  | "class"
  | "rec_program";

export type ProgramSeason =
  | "summer"
  | "fall"
  | "spring"
  | "winter"
  | "year_round";

export type CostPeriod =
  | "per_session"
  | "per_week"
  | "per_month"
  | "per_season";

export type RegistrationStatus =
  | "open"
  | "waitlist"
  | "closed"
  | "walk_in"
  | "sold_out"
  | "upcoming"
  | "unknown";

export interface Program {
  id: string;
  portal_id: string | null;
  source_id: number | null;
  venue_id: number | null;
  name: string;
  slug: string | null;
  description: string | null;
  program_type: ProgramType;
  provider_name: string | null;
  age_min: number | null;
  age_max: number | null;
  season: ProgramSeason | null;
  session_start: string | null;
  session_end: string | null;
  schedule_days: number[] | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  cost_amount: number | null;
  cost_period: CostPeriod | null;
  cost_notes: string | null;
  registration_status: RegistrationStatus;
  registration_opens: string | null;
  registration_closes: string | null;
  registration_url: string | null;
  last_status_check_at: string | null;
  before_after_care: boolean;
  lunch_included: boolean;
  tags: string[] | null;
  status: "active" | "draft" | "archived";
  created_at: string;
  updated_at: string;
}

/** Venue environment classification — mirrors DB enum venue_environment */
export type VenueEnvironment = "indoor" | "outdoor" | "both";

export interface ProgramWithVenue extends Program {
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    image_url: string | null;
    indoor_outdoor: VenueEnvironment | null;
  } | null;
}

export interface SchoolCalendarEvent {
  id: string;
  school_system: SchoolSystem;
  event_type: SchoolEventType;
  name: string;
  start_date: string;
  end_date: string;
  school_year: string;
}

export type SchoolSystem = "aps" | "dekalb" | "cobb" | "gwinnett";

export type SchoolEventType =
  | "no_school"
  | "half_day"
  | "break"
  | "holiday"
  | "early_release";

// Display helpers

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  camp: "Camp",
  enrichment: "Enrichment",
  league: "League",
  club: "Club",
  class: "Class",
  rec_program: "Rec Program",
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  open: "Open",
  waitlist: "Waitlist",
  closed: "Closed",
  walk_in: "Walk-in",
  sold_out: "Sold Out",
  upcoming: "Coming Soon",
  unknown: "Check Site",
};

export const REGISTRATION_STATUS_COLORS: Record<RegistrationStatus, string> = {
  open: "text-[#3D6B3D] bg-[#5E7A5E]/10 border-[#5E7A5E]/25",
  waitlist: "text-[#7A5C00] bg-[#C48B1D]/10 border-[#C48B1D]/25",
  closed: "text-[#756E63] bg-[#756E63]/10 border-[#756E63]/20",
  walk_in: "text-[#5E7A5E] bg-[#5E7A5E]/10 border-[#5E7A5E]/20",
  sold_out: "text-[#8B3A3A] bg-[#8B3A3A]/10 border-[#8B3A3A]/20",
  upcoming: "text-[#7A5C00] bg-[#C48B1D]/10 border-[#C48B1D]/25",
  unknown: "text-[#756E63] bg-[#756E63]/10 border-[#756E63]/20",
};

export const SEASON_LABELS: Record<ProgramSeason, string> = {
  summer: "Summer",
  fall: "Fall",
  spring: "Spring",
  winter: "Winter",
  year_round: "Year-Round",
};

export const SCHOOL_SYSTEM_LABELS: Record<SchoolSystem, string> = {
  aps: "Atlanta Public Schools",
  dekalb: "DeKalb County",
  cobb: "Cobb County",
  gwinnett: "Gwinnett County",
};

export const SCHOOL_EVENT_TYPE_LABELS: Record<SchoolEventType, string> = {
  no_school: "No School",
  half_day: "Half Day",
  break: "School Break",
  holiday: "Holiday",
  early_release: "Early Release",
};

export const ISO_DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function formatScheduleDays(days: number[] | null): string {
  if (!days || days.length === 0) return "";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)))
    return "Weekdays";
  if (days.length === 7) return "Every day";
  return days
    .sort()
    .map((d) => ISO_DAY_LABELS[d] || "")
    .filter(Boolean)
    .join(", ");
}

export function formatCost(
  amount: number | null,
  period: CostPeriod | null
): string {
  if (amount === null || amount === 0) return "Free";
  const formatted = amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
  if (!period) return formatted;
  const periodLabels: Record<CostPeriod, string> = {
    per_session: "/session",
    per_week: "/week",
    per_month: "/month",
    per_season: "",
  };
  return `${formatted}${periodLabels[period]}`;
}

export function formatAgeRange(
  min: number | null,
  max: number | null
): string {
  if (min === null && max === null) return "All ages";
  if (min !== null && max !== null) {
    if (min === max) return `Age ${min}`;
    return `Ages ${min}–${max}`;
  }
  if (min !== null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}

export function isRegistrationUrgent(program: Program): boolean {
  if (program.registration_status === "waitlist") return true;
  if (!program.registration_closes) return false;
  const closes = new Date(program.registration_closes);
  const now = new Date();
  const daysUntilClose =
    (closes.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilClose <= 7 && daysUntilClose > 0;
}

export function isRegistrationOpeningSoon(program: Program): boolean {
  if (program.registration_status !== "upcoming") return false;
  if (!program.registration_opens) return false;
  const opens = new Date(program.registration_opens);
  const now = new Date();
  const daysUntilOpen =
    (opens.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilOpen <= 14 && daysUntilOpen > 0;
}
