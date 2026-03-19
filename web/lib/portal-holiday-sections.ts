import type { PortalFeedDateFilter } from "@/lib/portal-feed-plan";

type HolidayStyle = {
  accent_color: string;
  icon: string;
};

type HolidaySectionConfig = {
  idPrefix: string;
  title: string;
  slug: string;
  description: string;
  tag: string;
  dateFilter: PortalFeedDateFilter;
  displayOrder: number;
  style: HolidayStyle;
};

export type PortalHolidaySection = {
  id: string;
  title: string;
  slug: string;
  description: string;
  section_type: "auto";
  block_type: "collapsible_events";
  layout: "grid";
  items_per_row: 2;
  max_items: 20;
  auto_filter: {
    tags: [string];
    date_filter: PortalFeedDateFilter;
    sort_by: "date";
  };
  block_content: null;
  display_order: number;
  is_visible: true;
  schedule_start: null;
  schedule_end: null;
  show_on_days: null;
  show_after_time: null;
  show_before_time: null;
  style: HolidayStyle;
  portal_section_items: [];
};

function createHolidaySection(
  currentYear: number,
  config: HolidaySectionConfig,
): PortalHolidaySection {
  return {
    id: `${config.idPrefix}-${currentYear}`,
    title: config.title,
    slug: config.slug,
    description: config.description,
    section_type: "auto",
    block_type: "collapsible_events",
    layout: "grid",
    items_per_row: 2,
    max_items: 20,
    auto_filter: {
      tags: [config.tag],
      date_filter: config.dateFilter,
      sort_by: "date",
    },
    block_content: null,
    display_order: config.displayOrder,
    is_visible: true,
    schedule_start: null,
    schedule_end: null,
    show_on_days: null,
    show_after_time: null,
    show_before_time: null,
    style: config.style,
    portal_section_items: [],
  };
}

export function buildPortalHolidaySections(
  currentDate: Date,
): PortalHolidaySection[] {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();
  const holidaySections: PortalHolidaySection[] = [];

  const showHolidaySections =
    (currentMonth === 1 && currentDay >= 20) ||
    currentMonth === 2 ||
    currentMonth === 3;

  if (!showHolidaySections) {
    return holidaySections;
  }

  if (currentMonth === 2 && currentDay >= 10 && currentDay <= 13) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "friday-the-13th",
        title: "Friday the 13th",
        slug: "friday-the-13th",
        description: "Embrace the unlucky",
        tag: "friday-13",
        dateFilter: "next_7_days",
        displayOrder: -8,
        style: {
          accent_color: "#00ff41",
          icon: "knife",
        },
      }),
    );
  }

  if (
    (currentMonth === 1 && currentDay >= 20) ||
    (currentMonth === 2 && currentDay <= 14)
  ) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "valentines",
        title: "Valentine's Day",
        slug: "valentines-day",
        description: "Be still thy beating heart",
        tag: "valentines",
        dateFilter: "next_30_days",
        displayOrder: -5,
        style: {
          accent_color: "#FF69B4",
          icon: "anatomical-heart",
        },
      }),
    );
  }

  if (currentMonth === 2 && currentDay >= 12 && currentDay <= 17) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "mardi-gras",
        title: "Mardi Gras",
        slug: "mardi-gras",
        description: "Laissez les bons temps rouler",
        tag: "mardi-gras",
        dateFilter: "next_7_days",
        displayOrder: -3,
        style: {
          accent_color: "#ffd700",
          icon: "mardi-gras-mask",
        },
      }),
    );
  }

  if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "lunar-new-year",
        title: "Lunar New Year",
        slug: "lunar-new-year",
        description: "A Year of Fire Horsin' Around",
        tag: "lunar-new-year",
        dateFilter: "next_30_days",
        displayOrder: -4,
        style: {
          accent_color: "#DC143C",
          icon: "fire-horse",
        },
      }),
    );
  }

  if (currentMonth === 2 && currentDay >= 2 && currentDay <= 9) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "super-bowl",
        title: "Super Bowl LX",
        slug: "super-bowl",
        description: "Patriots vs Seahawks - Watch parties & game day events",
        tag: "super-bowl",
        dateFilter: "next_7_days",
        displayOrder: -7,
        style: {
          accent_color: "var(--neon-green)",
          icon: "football",
        },
      }),
    );
  }

  if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "black-history-month",
        title: "Black History Month",
        slug: "black-history-month",
        description: "Celebrate and learn",
        tag: "black-history-month",
        dateFilter: "next_30_days",
        displayOrder: -6,
        style: {
          accent_color: "#e53935",
          icon: "raised-fist",
        },
      }),
    );
  }

  if (
    (currentMonth === 2 && currentDay >= 28) ||
    (currentMonth === 3 && currentDay <= 5)
  ) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "holi",
        title: "Holi",
        slug: "holi",
        description: "Festival of Colors",
        tag: "holi",
        dateFilter: "next_7_days",
        displayOrder: -10,
        style: {
          accent_color: "#e040fb",
          icon: "paint-palette",
        },
      }),
    );
  }

  if ((currentMonth === 2 && currentDay >= 25) || currentMonth === 3) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "womens-history-month",
        title: "Women's History Month",
        slug: "womens-history-month",
        description: "Celebrating the women shaping Atlanta",
        tag: "womens-history-month",
        dateFilter: "next_30_days",
        displayOrder: -11,
        style: {
          accent_color: "#ab47bc",
          icon: "purple-heart",
        },
      }),
    );
  }

  if (currentMonth === 3 && currentDay >= 10 && currentDay <= 17) {
    holidaySections.push(
      createHolidaySection(currentYear, {
        idPrefix: "st-patricks-day",
        title: "St. Patrick's Day",
        slug: "st-patricks-day",
        description: "Parade, pubs & plenty of green",
        tag: "st-patricks-day",
        dateFilter: "next_7_days",
        displayOrder: -12,
        style: {
          accent_color: "#4caf50",
          icon: "shamrock",
        },
      }),
    );
  }

  return holidaySections;
}
