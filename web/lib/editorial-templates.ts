export interface TemplateContext {
  events: Array<{
    category_id?: string;
    is_tentpole?: boolean;
    festival_id?: string | null;
    title: string;
    importance?: string | null;
  }>;
  sectionType: string;
  categoryCounts: Record<string, number>;
  holidays: Array<{ name: string; date: string }>;
  cityName?: string;
}

export interface EditorialResult {
  highlightText: string;
  remainderText: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  music: "music",
  comedy: "comedy",
  food_drink: "food & drink",
  arts: "art",
  nightlife: "nightlife",
  sports: "sports",
  community: "community",
  film: "film",
  theatre: "theatre",
  wellness: "wellness",
  education: "education",
  family: "family",
};

function getTimingPhrase(sectionType: string): string {
  switch (sectionType) {
    case "tonight":
    case "right_now":
      return "tonight";
    case "this_weekend":
      return "this weekend";
    case "this_week":
    case "coming_up":
      return "this week";
    case "planning_horizon":
      return "coming up";
    default:
      return "soon";
  }
}

function getCategoryLabel(categoryId: string | undefined): string {
  if (!categoryId) return "events";
  return CATEGORY_LABELS[categoryId] ?? categoryId.replace(/_/g, " ");
}

function tentpoleCallout(
  ctx: TemplateContext
): EditorialResult | null {
  const event = ctx.events.find((e) => e.is_tentpole || e.festival_id != null);
  if (!event) return null;

  const timing = getTimingPhrase(ctx.sectionType);
  const categoryLabel = getCategoryLabel(event.category_id);
  const city = ctx.cityName ?? "Atlanta";

  return {
    highlightText: `${city}'s biggest ${categoryLabel} event starts ${timing}.`,
    remainderText: `${event.title} — don't miss it.`,
  };
}

function holidayCallout(
  ctx: TemplateContext
): EditorialResult | null {
  if (ctx.holidays.length === 0) return null;

  const timing = getTimingPhrase(ctx.sectionType);
  const count = ctx.events.length;
  const holiday = ctx.holidays[0];

  return {
    highlightText: `${holiday.name} is ${timing}.`,
    remainderText: `${count} event${count !== 1 ? "s" : ""} celebrating across Atlanta.`,
  };
}

function densityCallout(
  ctx: TemplateContext
): EditorialResult | null {
  const HIGH_DENSITY_THRESHOLD = 10;

  let topCategory: string | null = null;
  let topCount = 0;

  for (const [category, count] of Object.entries(ctx.categoryCounts)) {
    if (count > HIGH_DENSITY_THRESHOLD && count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }

  if (topCategory === null) return null;

  const timing = getTimingPhrase(ctx.sectionType);
  const label = getCategoryLabel(topCategory);

  // Map timing phrase to period form for density callout
  const timingPeriod = timing === "tonight" ? "tonight" : `this ${timing.replace("this ", "")}`;

  return {
    highlightText: `${topCount} ${label} events ${timingPeriod}.`,
    remainderText: `More than usual — Atlanta's ${label} scene is buzzing.`,
  };
}

export function generateEditorialCallout(
  ctx: TemplateContext
): EditorialResult | null {
  return (
    tentpoleCallout(ctx) ??
    holidayCallout(ctx) ??
    densityCallout(ctx) ??
    null
  );
}

export { CATEGORY_LABELS, getTimingPhrase };
