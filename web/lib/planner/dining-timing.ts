export type DiningServiceStyle =
  | "quick_service"
  | "casual_dine_in"
  | "full_service"
  | "tasting_menu"
  | "bar_food"
  | "coffee_dessert";

export type OnTimeConfidence = "safe" | "tight" | "risky" | "unknown";

export interface VenueDiningProfile {
  venue_type?: string | null;
  service_style?: DiningServiceStyle | null;
  meal_duration_min_minutes?: number | null;
  meal_duration_max_minutes?: number | null;
  walk_in_wait_minutes?: number | null;
  payment_buffer_minutes?: number | null;
  accepts_reservations?: boolean | null;
  reservation_recommended?: boolean | null;
}

export interface DiningTimingAssumptions {
  serviceStyle: DiningServiceStyle;
  mealDurationMinMinutes: number;
  mealDurationMaxMinutes: number;
  walkInWaitMinutes: number;
  paymentBufferMinutes: number;
  acceptsReservations: boolean | null;
  reservationRecommended: boolean | null;
}

export interface PreShowDiningTimingInput {
  eventStartTime: string;
  travelToVenueMinutes?: number | null;
  venueEntryBufferMinutes?: number | null;
  hasReservation?: boolean;
  nowTime?: string | null;
  profile?: VenueDiningProfile | null;
}

export interface PreShowDiningTimingResult {
  canEstimate: boolean;
  latestSeatByTime: string | null;
  latestLeaveRestaurantByTime: string | null;
  seatWindowStartTime: string | null;
  seatWindowEndTime: string | null;
  requiredLeadMinMinutes: number | null;
  requiredLeadMaxMinutes: number | null;
  minutesUntilShowFromNow: number | null;
  slackFromNowMinutes: number | null;
  onTimeConfidence: OnTimeConfidence;
  assumptions: DiningTimingAssumptions;
}

const DEFAULT_ENTRY_BUFFER_MINUTES = 20;
const DEFAULT_TRAVEL_MINUTES = 15;

const DEFAULTS_BY_STYLE: Record<
  DiningServiceStyle,
  { mealMin: number; mealMax: number; walkInWait: number }
> = {
  quick_service: { mealMin: 30, mealMax: 50, walkInWait: 8 },
  casual_dine_in: { mealMin: 60, mealMax: 90, walkInWait: 15 },
  full_service: { mealMin: 90, mealMax: 120, walkInWait: 20 },
  tasting_menu: { mealMin: 120, mealMax: 180, walkInWait: 25 },
  bar_food: { mealMin: 45, mealMax: 75, walkInWait: 10 },
  coffee_dessert: { mealMin: 25, mealMax: 45, walkInWait: 4 },
};

const SERVICE_STYLE_BY_VENUE_TYPE: Record<string, DiningServiceStyle> = {
  fast_casual: "quick_service",
  food_hall: "quick_service",
  cafe: "coffee_dessert",
  coffee_shop: "coffee_dessert",
  bakery: "coffee_dessert",
  restaurant: "casual_dine_in",
  bar: "bar_food",
  brewery: "bar_food",
  winery: "bar_food",
  fine_dining: "full_service",
};

function normalizeInt(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function inferServiceStyleFromVenueType(
  venueType: string | null | undefined
): DiningServiceStyle | null {
  if (!venueType) return null;
  return SERVICE_STYLE_BY_VENUE_TYPE[venueType.toLowerCase()] || null;
}

export function resolveDiningTimingAssumptions(
  profile: VenueDiningProfile | null | undefined,
  hasReservation = false
): DiningTimingAssumptions {
  const inferredStyle =
    profile?.service_style || inferServiceStyleFromVenueType(profile?.venue_type) || "casual_dine_in";

  const styleDefaults = DEFAULTS_BY_STYLE[inferredStyle];

  const mealDurationMinMinutes =
    normalizeInt(profile?.meal_duration_min_minutes, 15, 360) ?? styleDefaults.mealMin;
  const rawMealDurationMaxMinutes =
    normalizeInt(profile?.meal_duration_max_minutes, 15, 480) ?? styleDefaults.mealMax;
  const mealDurationMaxMinutes = Math.max(mealDurationMinMinutes, rawMealDurationMaxMinutes);

  const rawWalkInWaitMinutes =
    normalizeInt(profile?.walk_in_wait_minutes, 0, 240) ?? styleDefaults.walkInWait;
  const walkInWaitMinutes = hasReservation ? 0 : rawWalkInWaitMinutes;

  const paymentBufferMinutes =
    normalizeInt(profile?.payment_buffer_minutes, 0, 60) ?? 10;

  return {
    serviceStyle: inferredStyle,
    mealDurationMinMinutes,
    mealDurationMaxMinutes,
    walkInWaitMinutes,
    paymentBufferMinutes,
    acceptsReservations:
      typeof profile?.accepts_reservations === "boolean"
        ? profile.accepts_reservations
        : null,
    reservationRecommended:
      typeof profile?.reservation_recommended === "boolean"
        ? profile.reservation_recommended
        : null,
  };
}

function getConfidence(slackFromNowMinutes: number | null): OnTimeConfidence {
  if (slackFromNowMinutes == null) return "unknown";
  if (slackFromNowMinutes >= 20) return "safe";
  if (slackFromNowMinutes >= 5) return "tight";
  return "risky";
}

export function calculatePreShowDiningTiming(
  input: PreShowDiningTimingInput
): PreShowDiningTimingResult {
  const showStartMinutes = parseTimeToMinutes(input.eventStartTime);
  const nowMinutes = parseTimeToMinutes(input.nowTime);

  const assumptions = resolveDiningTimingAssumptions(
    input.profile,
    Boolean(input.hasReservation)
  );

  if (showStartMinutes == null) {
    return {
      canEstimate: false,
      latestSeatByTime: null,
      latestLeaveRestaurantByTime: null,
      seatWindowStartTime: null,
      seatWindowEndTime: null,
      requiredLeadMinMinutes: null,
      requiredLeadMaxMinutes: null,
      minutesUntilShowFromNow: null,
      slackFromNowMinutes: null,
      onTimeConfidence: "unknown",
      assumptions,
    };
  }

  const travelToVenueMinutes =
    normalizeInt(input.travelToVenueMinutes, 0, 240) ?? DEFAULT_TRAVEL_MINUTES;
  const venueEntryBufferMinutes =
    normalizeInt(input.venueEntryBufferMinutes, 0, 120) ?? DEFAULT_ENTRY_BUFFER_MINUTES;

  const requiredLeadMinMinutes =
    assumptions.mealDurationMinMinutes +
    assumptions.walkInWaitMinutes +
    assumptions.paymentBufferMinutes +
    travelToVenueMinutes +
    venueEntryBufferMinutes;

  const requiredLeadMaxMinutes =
    assumptions.mealDurationMaxMinutes +
    assumptions.walkInWaitMinutes +
    assumptions.paymentBufferMinutes +
    travelToVenueMinutes +
    venueEntryBufferMinutes;

  const latestSeatByMinutes = showStartMinutes - requiredLeadMaxMinutes;
  const seatWindowEndMinutes = showStartMinutes - requiredLeadMinMinutes;
  const latestLeaveRestaurantByMinutes =
    showStartMinutes - travelToVenueMinutes - venueEntryBufferMinutes;

  let minutesUntilShowFromNow: number | null = null;
  let slackFromNowMinutes: number | null = null;

  if (nowMinutes != null) {
    minutesUntilShowFromNow = showStartMinutes - nowMinutes;
    slackFromNowMinutes = minutesUntilShowFromNow - requiredLeadMaxMinutes;
  }

  return {
    canEstimate: true,
    latestSeatByTime: formatMinutesAsTime(latestSeatByMinutes),
    latestLeaveRestaurantByTime: formatMinutesAsTime(latestLeaveRestaurantByMinutes),
    seatWindowStartTime: formatMinutesAsTime(latestSeatByMinutes),
    seatWindowEndTime: formatMinutesAsTime(seatWindowEndMinutes),
    requiredLeadMinMinutes,
    requiredLeadMaxMinutes,
    minutesUntilShowFromNow,
    slackFromNowMinutes,
    onTimeConfidence: getConfidence(slackFromNowMinutes),
    assumptions,
  };
}
