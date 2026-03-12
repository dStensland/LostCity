import {
  addDays,
  isFriday,
  isSaturday,
  isSunday,
  nextFriday,
  nextSunday,
  startOfDay,
} from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import type { PortalFeedDateFilter } from "@/lib/portal-feed-plan";

type PortalScheduledSection = {
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
};

type PortalCommunitySection = {
  slug: string;
  title: string;
  auto_filter?: {
    categories?: string[];
    subcategories?: string[];
    tags?: string[];
  } | null;
};

const COMMUNITY_SECTION_HINT =
  /\b(get[-\s]?involved|volunteer|activism|civic|community\s+support|community\s+action)\b/i;

export function isPortalSectionVisible(
  section: PortalScheduledSection,
  now = new Date(),
): boolean {
  const today = getLocalDateString(now);
  const currentTime = now.toTimeString().slice(0, 5);
  const currentDay = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();

  if (section.schedule_start && today < section.schedule_start) {
    return false;
  }
  if (section.schedule_end && today > section.schedule_end) {
    return false;
  }
  if (section.show_on_days?.length && !section.show_on_days.includes(currentDay)) {
    return false;
  }
  if (section.show_after_time && currentTime < section.show_after_time) {
    return false;
  }
  if (section.show_before_time && currentTime > section.show_before_time) {
    return false;
  }

  return true;
}

export function getPortalFeedDateRange(
  filter: PortalFeedDateFilter | string,
  now = new Date(),
): { start: string; end: string } {
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(today),
      };
    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return {
        start: getLocalDateString(tomorrow),
        end: getLocalDateString(tomorrow),
      };
    }
    case "this_weekend": {
      let friday: Date;
      let sunday: Date;

      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        friday = isFriday(now) ? today : addDays(today, -(now.getDay() - 5));
        sunday = isSunday(now) ? today : addDays(today, 7 - now.getDay());
      } else {
        friday = nextFriday(today);
        sunday = nextSunday(today);
      }

      return {
        start: getLocalDateString(friday),
        end: getLocalDateString(sunday),
      };
    }
    case "next_7_days":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 7)),
      };
    case "next_30_days":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 30)),
      };
    default:
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 14)),
      };
  }
}

export function isPortalCommunityActionSection(
  section: PortalCommunitySection,
): boolean {
  const categories = section.auto_filter?.categories || [];
  const subcategories = section.auto_filter?.subcategories || [];
  const tags = section.auto_filter?.tags || [];

  if (
    categories.some(
      (category) => category === "community" || category === "activism",
    )
  ) {
    return true;
  }

  if (
    subcategories.some((subcategory) =>
      /\b(community|volunteer|activism|civic)\b/i.test(subcategory),
    )
  ) {
    return true;
  }

  if (
    tags.some((tag) => /\b(volunteer|activism|community|civic)\b/i.test(tag))
  ) {
    return true;
  }

  return COMMUNITY_SECTION_HINT.test(`${section.slug} ${section.title}`);
}
