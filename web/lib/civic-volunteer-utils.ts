import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";

const VOLUNTEER_EVENT_TAGS = [
  "volunteer",
  "volunteer-opportunity",
  "drop-in",
  "service",
  "mutual aid",
];

const CIVIC_EXCLUSION_TAGS = [
  "government",
  "public-meeting",
  "public-comment",
  "civic-engagement",
  "school-board",
  "npu",
  "zoning",
  "land-use",
];

const CIVIC_EXCLUSION_TITLE_RE =
  /\b(meeting|committee|board|council|hearing|agenda|commission)\b/i;

export type VolunteerEvent = CityPulseEventItem["event"];

function todayStart(): Date {
  const now = new Date();
  if (now.getHours() < 5) {
    now.setDate(now.getDate() - 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function isVolunteerCommunityEvent(event: VolunteerEvent): boolean {
  const category = (event.category || "").toLowerCase();
  const tags = [...(event.tags || []), ...(event.genres || [])]
    .map((value) => value.toLowerCase());

  const hasCivicExclusionTag = CIVIC_EXCLUSION_TAGS.some((needle) =>
    tags.some((value) => value.includes(needle)),
  );
  if (hasCivicExclusionTag) return false;
  if (CIVIC_EXCLUSION_TITLE_RE.test(event.title)) return false;

  if (category === "volunteer") return true;

  return VOLUNTEER_EVENT_TAGS.some((needle) =>
    tags.some((value) => value.includes(needle)),
  );
}

export function getVolunteerThisWeekItems(sections: CityPulseSection[]): VolunteerEvent[] {
  const start = todayStart();
  const end = addDays(start, 7);
  const seenIds = new Set<number>();
  const seenKeys = new Set<string>();

  return sections
    .flatMap((section) => section.items)
    .filter((item): item is CityPulseEventItem => item.item_type === "event")
    .map((item) => item.event)
    .filter((event) => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      return true;
    })
    .filter((event) => {
      const eventDate = new Date(`${event.start_date}T00:00:00`);
      return eventDate >= start && eventDate <= end;
    })
    .filter(isVolunteerCommunityEvent)
    .filter((event) => {
      const normalizedTitle = event.title.trim().toLowerCase().replace(/\s+/g, " ");
      const dedupeKey = `${normalizedTitle}|${event.start_date}|${event.start_time || "all-day"}`;
      if (seenKeys.has(dedupeKey)) return false;
      seenKeys.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      const leftKey = `${left.start_date}T${left.start_time || "23:59:59"}`;
      const rightKey = `${right.start_date}T${right.start_time || "23:59:59"}`;
      return leftKey.localeCompare(rightKey);
    });
}
