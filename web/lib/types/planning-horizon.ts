// Planning Horizon types — maps to database/migrations/548_planning_horizon.sql
// Surfaces big future events with advance-planning intelligence.

// ---------------------------------------------------------------------------
// Event importance classification
// ---------------------------------------------------------------------------

/**
 * Three-tier importance system replacing the boolean is_tentpole.
 *
 * - flagship: City-defining events (Dragon Con, Music Midtown, Atlanta Pride).
 *             5,000+ expected attendance. Plan months ahead.
 * - major:    Worth planning around (Tabernacle headliners, popular exhibitions,
 *             mid-size festivals). Plan weeks ahead.
 * - standard: Default for all events. No special planning treatment.
 */
export type EventImportance = "flagship" | "major" | "standard";

// ---------------------------------------------------------------------------
// Sellout risk
// ---------------------------------------------------------------------------

/**
 * Crawler-populated estimate of how likely an event is to sell out.
 * Based on venue size, artist popularity, price point, and historical data.
 */
export type SelloutRisk = "none" | "low" | "medium" | "high";

// ---------------------------------------------------------------------------
// Ticket status (already exists in DB, typed here for co-location)
// ---------------------------------------------------------------------------

export type TicketStatus =
  | "cancelled"
  | "sold-out"
  | "low-tickets"
  | "free"
  | "tickets-available";

// ---------------------------------------------------------------------------
// Planning timeline fields on an event
// ---------------------------------------------------------------------------

/**
 * Planning-relevant dates and ticket intelligence for an event.
 * These fields live directly on the events table.
 */
export interface EventPlanningFields {
  importance: EventImportance;

  // Timeline milestones (all nullable — populated when known)
  on_sale_date: string | null; // When general admission tickets go on sale
  presale_date: string | null; // Early access / presale window opens
  early_bird_deadline: string | null; // Early pricing cutoff
  announce_date: string | null; // When lineup/details are announced
  registration_opens: string | null; // For registration-gated events
  registration_closes: string | null;
  registration_url: string | null;

  // Ticket intelligence
  ticket_status: TicketStatus | null;
  ticket_status_checked_at: string | null; // ISO timestamp of last check
  sellout_risk: SelloutRisk | null;

  // Existing fields included for context
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
}

// ---------------------------------------------------------------------------
// Planning horizon event (what the feed/API returns)
// ---------------------------------------------------------------------------

/**
 * A planning-horizon event as returned by the planning horizon API.
 * Extends the standard event shape with planning-specific fields.
 */
export interface PlanningHorizonEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  importance: EventImportance;
  category: string | null;
  image_url: string | null;
  source_url: string;

  // Planning timeline
  on_sale_date: string | null;
  presale_date: string | null;
  early_bird_deadline: string | null;
  announce_date: string | null;
  registration_opens: string | null;
  registration_closes: string | null;
  registration_url: string | null;

  // Ticket intelligence
  ticket_status: TicketStatus | null;
  ticket_status_checked_at: string | null;
  sellout_risk: SelloutRisk | null;
  ticket_url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;

  // Venue context
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;

  // Festival context
  festival_id: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const IMPORTANCE_LABELS: Record<EventImportance, string> = {
  flagship: "Flagship",
  major: "Major",
  standard: "Standard",
};

export const IMPORTANCE_DESCRIPTIONS: Record<EventImportance, string> = {
  flagship: "City-defining event. Get tickets early.",
  major: "Worth planning around.",
  standard: "",
};

export const SELLOUT_RISK_LABELS: Record<SelloutRisk, string> = {
  none: "No sellout risk",
  low: "Unlikely to sell out",
  medium: "May sell out",
  high: "Likely to sell out",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  cancelled: "Cancelled",
  "sold-out": "Sold Out",
  "low-tickets": "Low Tickets",
  free: "Free",
  "tickets-available": "Tickets Available",
};

// ---------------------------------------------------------------------------
// Urgency detection utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the event's early bird deadline is within the next 7 days.
 */
export function isEarlyBirdUrgent(event: {
  early_bird_deadline: string | null;
}): boolean {
  if (!event.early_bird_deadline) return false;
  const deadline = new Date(event.early_bird_deadline);
  const now = new Date();
  const daysUntil =
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 7 && daysUntil > 0;
}

/**
 * Returns true if the event just went on sale within the last 3 days.
 */
export function isJustOnSale(event: {
  on_sale_date: string | null;
}): boolean {
  if (!event.on_sale_date) return false;
  const onSale = new Date(event.on_sale_date);
  const now = new Date();
  const daysSince =
    (now.getTime() - onSale.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 0 && daysSince <= 3;
}

/**
 * Returns true if the event's registration deadline is within the next 7 days.
 */
export function isRegistrationClosingSoon(event: {
  registration_closes: string | null;
}): boolean {
  if (!event.registration_closes) return false;
  const closes = new Date(event.registration_closes);
  const now = new Date();
  const daysUntil =
    (closes.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 7 && daysUntil > 0;
}

/**
 * Returns true if the ticket_status may be stale (last checked > 24 hours ago).
 */
export function isTicketStatusStale(event: {
  ticket_status: string | null;
  ticket_status_checked_at: string | null;
}): boolean {
  if (!event.ticket_status || !event.ticket_status_checked_at) return false;
  const checked = new Date(event.ticket_status_checked_at);
  const now = new Date();
  const hoursSince =
    (now.getTime() - checked.getTime()) / (1000 * 60 * 60);
  return hoursSince > 24;
}

/**
 * Returns a human-readable freshness label for ticket status.
 * "as of 2 hours ago", "as of yesterday", etc.
 */
export function ticketStatusFreshness(
  checkedAt: string | null
): string | null {
  if (!checkedAt) return null;
  const checked = new Date(checkedAt);
  const now = new Date();
  const hoursSince =
    (now.getTime() - checked.getTime()) / (1000 * 60 * 60);

  if (hoursSince < 1) return "moments ago";
  if (hoursSince < 2) return "as of 1 hour ago";
  if (hoursSince < 24) return `as of ${Math.floor(hoursSince)} hours ago`;
  const daysSince = Math.floor(hoursSince / 24);
  if (daysSince === 1) return "as of yesterday";
  return `as of ${daysSince} days ago`;
}

/**
 * Determines the most urgent planning signal for an event.
 * Used to pick the right badge/label in the UI.
 */
export type PlanningUrgency =
  | { type: "selling_fast"; label: string }
  | { type: "just_on_sale"; label: string }
  | { type: "early_bird_ending"; label: string; daysLeft: number }
  | { type: "registration_closing"; label: string; daysLeft: number }
  | { type: "sold_out"; label: string }
  | { type: "cancelled"; label: string }
  | null;

export function getPlanningUrgency(event: {
  ticket_status: TicketStatus | null;
  sellout_risk: SelloutRisk | null;
  on_sale_date: string | null;
  early_bird_deadline: string | null;
  registration_closes: string | null;
}): PlanningUrgency {
  // Highest priority: terminal states
  if (event.ticket_status === "cancelled") {
    return { type: "cancelled", label: "Cancelled" };
  }
  if (event.ticket_status === "sold-out") {
    return { type: "sold_out", label: "Sold Out" };
  }

  // Selling fast
  if (
    event.ticket_status === "low-tickets" ||
    event.sellout_risk === "high"
  ) {
    return { type: "selling_fast", label: "Selling Fast" };
  }

  // Early bird ending soon
  if (event.early_bird_deadline) {
    const deadline = new Date(event.early_bird_deadline);
    const now = new Date();
    const daysLeft = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft > 0 && daysLeft <= 7) {
      return {
        type: "early_bird_ending",
        label: daysLeft === 1 ? "Early bird ends tomorrow" : `Early bird ends in ${daysLeft} days`,
        daysLeft,
      };
    }
  }

  // Registration closing soon
  if (event.registration_closes) {
    const closes = new Date(event.registration_closes);
    const now = new Date();
    const daysLeft = Math.ceil(
      (closes.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft > 0 && daysLeft <= 7) {
      return {
        type: "registration_closing",
        label: daysLeft === 1 ? "Registration closes tomorrow" : `Registration closes in ${daysLeft} days`,
        daysLeft,
      };
    }
  }

  // Just went on sale
  if (isJustOnSale(event)) {
    return { type: "just_on_sale", label: "Just Went On Sale" };
  }

  return null;
}
