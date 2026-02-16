import { formatTime } from "@/lib/formats";

type ShowSignalInput = {
  title?: string | null;
  description?: string | null;
  price_note?: string | null;
  tags?: string[] | null;
  start_time?: string | null;
  doors_time?: string | null;
  end_time?: string | null;
  is_all_day?: boolean | null;
  is_free?: boolean | null;
  is_adult?: boolean | null;
  ticket_url?: string | null;
  age_policy?: string | null;
  ticket_status?: string | null;
  reentry_policy?: string | null;
  set_times_mentioned?: boolean | null;
};

export type ShowSignals = {
  doorsTime: string | null;
  showTime: string | null;
  endTime: string | null;
  agePolicy: string | null;
  ticketStatus: string | null;
  reentryPolicy: string | null;
  hasSetTimesMention: boolean;
};

const DOORS_PATTERN =
  /\b(?:doors?|door)\s*(?:open|opens|opening|at)?\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i;
const SHOW_PATTERN =
  /\b(?:show|music|performance|sets?)\s*(?:starts?|at|time)?\s*[:\-]?\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i;
const TIME_TOKEN_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*([ap])(?:\.?m\.?)?/i;
const SET_TIMES_PATTERN =
  /\b(?:set\s*times?|full\s*lineup\s*times?|1st\s*set|2nd\s*set|set\s*1|set\s*2|schedule\s*posted)\b/i;
const NO_REENTRY_PATTERN = /\bno\s*re[\s-]?entry\b|\bre[\s-]?entry\s*not\s*permitted\b/i;
const REENTRY_ALLOWED_PATTERN = /\bre[\s-]?entry\s*(?:allowed|welcome|permitted)\b/i;

function normalizeText(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function parseClockToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(TIME_TOKEN_PATTERN);
  if (!match) return null;

  const hourNum = Number.parseInt(match[1], 10);
  const minuteNum = Number.parseInt(match[2] || "0", 10);
  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) return null;
  if (hourNum < 1 || hourNum > 12 || minuteNum < 0 || minuteNum > 59) return null;

  const isPm = match[3].toLowerCase() === "p";
  let hour24 = hourNum % 12;
  if (isPm) hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minuteNum).padStart(2, "0")}`;
}

function normalizeAgePolicy(value: string | null | undefined): string | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  const mapping: Record<string, string> = {
    "21+": "21+",
    "21_plus": "21+",
    "21 plus": "21+",
    "18+": "18+",
    "18_plus": "18+",
    "18 plus": "18+",
    "all-ages": "All ages",
    "all_ages": "All ages",
    "all ages": "All ages",
    "adults-only": "Adults only",
    "adults_only": "Adults only",
    "adults only": "Adults only",
  };
  return mapping[raw] || null;
}

function normalizeTicketStatus(value: string | null | undefined): string | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  const mapping: Record<string, string> = {
    "sold-out": "Sold out",
    "sold_out": "Sold out",
    "sold out": "Sold out",
    "low-tickets": "Low tickets",
    "low_tickets": "Low tickets",
    "low tickets": "Low tickets",
    free: "Free",
    "tickets-available": "Tickets available",
    "tickets_available": "Tickets available",
    "tickets available": "Tickets available",
    available: "Tickets available",
  };
  return mapping[raw] || null;
}

function normalizeReentryPolicy(value: string | null | undefined): string | null {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return null;
  const mapping: Record<string, string> = {
    "no-reentry": "No re-entry",
    "no_reentry": "No re-entry",
    "no reentry": "No re-entry",
    "no re-entry": "No re-entry",
    "reentry-allowed": "Re-entry allowed",
    "reentry_allowed": "Re-entry allowed",
    "reentry allowed": "Re-entry allowed",
    "re-entry allowed": "Re-entry allowed",
  };
  return mapping[raw] || null;
}

function detectAgePolicy(text: string, tags: Set<string>, isAdult: boolean | null | undefined): string | null {
  if (
    tags.has("21+") ||
    /\b21\+\b|\b21\s*(?:and|&)\s*(?:over|up)\b|\bmust\s*be\s*21\b/.test(text)
  ) {
    return "21+";
  }

  if (
    tags.has("18+") ||
    /\b18\+\b|\b18\s*(?:and|&)\s*(?:over|up)\b|\bmust\s*be\s*18\b/.test(text)
  ) {
    return "18+";
  }

  if (
    tags.has("all-ages") ||
    tags.has("family-friendly") ||
    /\ball[\s-]?ages\b|\bopen\s*to\s*all\s*ages\b/.test(text)
  ) {
    return "All ages";
  }

  if (isAdult) {
    return "Adults only";
  }

  return null;
}

function detectTicketStatus(text: string, tags: Set<string>, isFree: boolean | null | undefined, hasTicketUrl: boolean): string | null {
  if (tags.has("sold-out") || /\bsold[\s-]?out\b/.test(text)) {
    return "Sold out";
  }

  if (
    tags.has("limited-seating") ||
    /\blow\s*tickets?\b|\bfew\s*tickets?\s*left\b|\blimited\s*tickets?\b|\balmost\s*sold\s*out\b/.test(text)
  ) {
    return "Low tickets";
  }

  if (isFree || tags.has("free")) {
    return "Free";
  }

  if (hasTicketUrl || tags.has("ticketed")) {
    return "Tickets available";
  }

  return null;
}

export function deriveShowSignals(input: ShowSignalInput): ShowSignals {
  const text = normalizeText(
    [input.title, input.description, input.price_note].filter(Boolean).join(" ")
  );
  const tagSet = new Set((input.tags || []).map((tag) => tag.toLowerCase()));

  const extractedDoors = parseClockToken(text.match(DOORS_PATTERN)?.[1]);
  const extractedShow = parseClockToken(text.match(SHOW_PATTERN)?.[1]);

  const normalizedDoors = input.doors_time?.slice(0, 5) || null;
  const normalizedStart = input.start_time?.slice(0, 5) || null;
  const normalizedEnd = input.end_time?.slice(0, 5) || null;

  const doorsTime = normalizedDoors
    ? formatTime(normalizedDoors)
    : extractedDoors
      ? formatTime(extractedDoors)
      : null;
  const showTime = extractedShow ? formatTime(extractedShow) : formatTime(normalizedStart, Boolean(input.is_all_day));
  const endTime = normalizedEnd ? formatTime(normalizedEnd) : null;
  const agePolicy = normalizeAgePolicy(input.age_policy) || detectAgePolicy(text, tagSet, input.is_adult);
  const ticketStatus =
    normalizeTicketStatus(input.ticket_status) ||
    detectTicketStatus(text, tagSet, input.is_free, Boolean(input.ticket_url));

  let reentryPolicy: string | null =
    normalizeReentryPolicy(input.reentry_policy) || null;
  if (!reentryPolicy) {
    if (NO_REENTRY_PATTERN.test(text)) {
      reentryPolicy = "No re-entry";
    } else if (REENTRY_ALLOWED_PATTERN.test(text)) {
      reentryPolicy = "Re-entry allowed";
    }
  }

  return {
    doorsTime,
    showTime: showTime === "TBA" ? null : showTime,
    endTime,
    agePolicy,
    ticketStatus,
    reentryPolicy,
    hasSetTimesMention:
      input.set_times_mentioned === true || SET_TIMES_PATTERN.test(text),
  };
}
