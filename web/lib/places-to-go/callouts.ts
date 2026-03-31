import type { PlaceContext } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  if (!s) return s;
  // Handle hyphenated strings like "craft-cocktails"
  return s
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** Split a comma-separated cuisine string and return the first item. */
function firstCuisine(cuisine: string | null): string | null {
  if (!cuisine) return null;
  const parts = cuisine.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rule types
// ---------------------------------------------------------------------------

type CalloutRule = {
  check: (ctx: PlaceContext) => boolean;
  emit: (ctx: PlaceContext) => string;
};

type CategoryCalloutConfig = {
  timeSensitive: CalloutRule[];
  activity: CalloutRule[];
  static: CalloutRule[];
};

// ---------------------------------------------------------------------------
// Callout config
// ---------------------------------------------------------------------------

const CALLOUT_CONFIG: Record<string, CategoryCalloutConfig> = {
  parks_gardens: {
    timeSensitive: [
      {
        check: (ctx) => ctx.weatherMatch,
        emit: () => "Great weather today",
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} events this week`,
      },
    ],
    static: [
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("dog_friendly"),
        emit: () => "Dog-friendly",
      },
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("family_friendly"),
        emit: () => "Family-friendly",
      },
    ],
  },

  trails_nature: {
    timeSensitive: [
      {
        check: (ctx) => ctx.weatherMatch,
        emit: () => "Perfect hiking weather",
      },
      {
        check: (ctx) => ctx.seasonMatch,
        emit: (ctx) => {
          // Use a generic label if we don't have the current season in context
          return "Great seasonal hiking";
        },
      },
    ],
    activity: [],
    static: [
      {
        check: (ctx) => !!ctx.difficulty,
        emit: (ctx) => capitalize(ctx.difficulty!),
      },
      {
        check: (ctx) => ctx.driveTimeMinutes !== null,
        emit: (ctx) => `${ctx.driveTimeMinutes} min drive`,
      },
    ],
  },

  museums: {
    timeSensitive: [],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} exhibitions now`,
      },
    ],
    static: [
      {
        check: (ctx) => ctx.libraryPass === true,
        emit: () => "Library pass",
      },
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("family_friendly"),
        emit: () => "Family-friendly",
      },
    ],
  },

  galleries_studios: {
    timeSensitive: [
      {
        check: (ctx) => ctx.eventsToday > 0 && !!ctx.todayEventTitle,
        emit: () => "Opening reception today",
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} shows current`,
      },
    ],
    static: [
      {
        check: (ctx) => !!ctx.neighborhood,
        emit: (ctx) => ctx.neighborhood!,
      },
      {
        check: (ctx) => Array.isArray(ctx.vibes) && ctx.vibes.length > 0,
        emit: (ctx) => capitalize(ctx.vibes![0]),
      },
    ],
  },

  theaters_stage: {
    timeSensitive: [
      {
        check: (ctx) => ctx.eventsToday > 0 && !!ctx.todayEventTitle,
        emit: (ctx) => `Tonight: ${truncate(ctx.todayEventTitle!, 30)}`,
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} shows this week`,
      },
    ],
    static: [],
  },

  music_venues: {
    timeSensitive: [
      {
        check: (ctx) => ctx.eventsToday > 0 && !!ctx.todayEventTitle,
        emit: (ctx) => `Tonight: ${truncate(ctx.todayEventTitle!, 30)}`,
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} acts this week`,
      },
    ],
    static: [
      {
        check: (ctx) => {
          if (!Array.isArray(ctx.vibes)) return false;
          const musicVibes = ["divey", "intimate", "upscale", "rooftop", "casual"];
          return ctx.vibes.some((v) => musicVibes.includes(v));
        },
        emit: (ctx) => {
          const musicVibes = ["divey", "intimate", "upscale", "rooftop", "casual"];
          const match = ctx.vibes!.find((v) => musicVibes.includes(v))!;
          return capitalize(match);
        },
      },
    ],
  },

  restaurants: {
    timeSensitive: [
      {
        check: (ctx) => ctx.hasActiveSpecial && !!ctx.specialTimeEnd,
        emit: (ctx) => `Happy hour til ${ctx.specialTimeEnd}`,
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.isNew,
        emit: () => "New this month",
      },
    ],
    static: [
      {
        check: (ctx) => !!firstCuisine(ctx.cuisine),
        emit: (ctx) => capitalize(firstCuisine(ctx.cuisine)!),
      },
      {
        check: (ctx) => {
          if (!Array.isArray(ctx.occasions)) return false;
          return ctx.occasions.some((o) =>
            ["date_night", "groups", "outdoor_dining"].includes(o)
          );
        },
        emit: (ctx) => {
          const labels: Record<string, string> = {
            date_night: "Date night",
            groups: "Groups",
            outdoor_dining: "Outdoor dining",
          };
          const match = ctx.occasions!.find((o) =>
            ["date_night", "groups", "outdoor_dining"].includes(o)
          )!;
          return labels[match];
        },
      },
    ],
  },

  bars_nightlife: {
    timeSensitive: [
      {
        check: (ctx) => ctx.hasActiveSpecial,
        emit: () => "Happy hour now",
      },
      {
        check: (ctx) => ctx.eventsToday > 0 && !!ctx.todayEventTitle,
        emit: (ctx) => `Tonight: ${truncate(ctx.todayEventTitle!, 30)}`,
      },
    ],
    activity: [
      {
        check: (ctx) => ctx.eventsToday > 0,
        emit: (ctx) => `${ctx.eventsToday} events tonight`,
      },
    ],
    static: [
      {
        check: (ctx) => {
          if (!Array.isArray(ctx.vibes)) return false;
          const barVibes = ["rooftop", "craft-cocktails", "divey", "intimate"];
          return ctx.vibes.some((v) => barVibes.includes(v));
        },
        emit: (ctx) => {
          const barVibes = ["rooftop", "craft-cocktails", "divey", "intimate"];
          const match = ctx.vibes!.find((v) => barVibes.includes(v))!;
          return capitalize(match);
        },
      },
    ],
  },

  markets_local: {
    timeSensitive: [
      {
        check: (ctx) => ctx.eventsToday > 0,
        emit: () => "Market today",
      },
    ],
    activity: [],
    static: [
      {
        check: (ctx) => !!ctx.indoorOutdoor,
        emit: (ctx) => capitalize(ctx.indoorOutdoor!),
      },
    ],
  },

  libraries_learning: {
    timeSensitive: [],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} programs this week`,
      },
    ],
    static: [
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("family_friendly"),
        emit: () => "Family-friendly",
      },
      {
        check: (ctx) => !!ctx.nearestMarta,
        emit: (ctx) => `Near ${ctx.nearestMarta}`,
      },
    ],
  },

  fun_games: {
    timeSensitive: [],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} events this week`,
      },
    ],
    static: [
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("family_friendly"),
        emit: () => "Family-friendly",
      },
      {
        check: (ctx) => Array.isArray(ctx.occasions) && ctx.occasions.includes("groups"),
        emit: () => "Group-friendly",
      },
    ],
  },

  historic_sites: {
    timeSensitive: [],
    activity: [
      {
        check: (ctx) => ctx.eventsThisWeek > 0,
        emit: (ctx) => `${ctx.eventsThisWeek} tours this week`,
      },
    ],
    static: [
      {
        check: (ctx) => !!ctx.shortDescription,
        emit: (ctx) => {
          const desc = ctx.shortDescription!;
          return desc.length > 50 ? desc.slice(0, 50) + "…" : desc;
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// buildCallouts
// ---------------------------------------------------------------------------

/**
 * Generate up to 2 callout strings for a place in a given category.
 * Cascade order: timeSensitive → activity → static. Stops at 2 collected.
 */
export function buildCallouts(categoryKey: string, ctx: PlaceContext): string[] {
  const config = CALLOUT_CONFIG[categoryKey];
  if (!config) return [];

  const result: string[] = [];

  const allRules = [
    ...config.timeSensitive,
    ...config.activity,
    ...config.static,
  ];

  for (const rule of allRules) {
    if (result.length >= 2) break;
    if (rule.check(ctx)) {
      result.push(rule.emit(ctx));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Summary config
// ---------------------------------------------------------------------------

type SummaryRule = {
  check: (stats: Record<string, number | string | undefined>) => boolean;
  emit: (stats: Record<string, number | string | undefined>) => string;
};

const SUMMARY_CONFIG: Record<string, SummaryRule[]> = {
  parks_gardens: [
    {
      check: (s) => Number(s.weatherMatchCount) > 0,
      emit: (s) => `${s.weatherMatchCount} match today's weather`,
    },
    {
      check: (s) => Number(s.eventsThisWeekCount) > 0,
      emit: (s) => `${s.eventsThisWeekCount} with events this week`,
    },
    {
      check: (s) => Number(s.dogFriendlyCount) > 0,
      emit: (s) => `${s.dogFriendlyCount} dog-friendly`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} places`,
    },
  ],

  trails_nature: [
    {
      check: (s) => Number(s.withinDriveTime) > 0,
      emit: (s) => `${s.withinDriveTime} within 45 min`,
    },
    {
      check: (s) => Number(s.easyCount) > 0,
      emit: (s) => `${s.easyCount} easy trails`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} trails`,
    },
  ],

  museums: [
    {
      check: (s) => Number(s.exhibitionsCount) > 0,
      emit: (s) => `${s.exhibitionsCount} exhibitions showing`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} museums`,
    },
  ],

  galleries_studios: [
    {
      check: (s) => Number(s.openingsThisWeek) > 0,
      emit: (s) => `${s.openingsThisWeek} opening receptions this week`,
    },
    {
      check: (s) => Number(s.showsCurrent) > 0,
      emit: (s) => `${s.showsCurrent} shows current`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} galleries`,
    },
  ],

  theaters_stage: [
    {
      check: (s) => Number(s.showsTonight) > 0,
      emit: (s) => `${s.showsTonight} shows tonight`,
    },
    {
      check: (s) => Number(s.showsThisWeek) > 0,
      emit: (s) => `${s.showsThisWeek} shows this week`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} venues`,
    },
  ],

  music_venues: [
    {
      check: (s) => Number(s.actsTonight) > 0,
      emit: (s) => `${s.actsTonight} acts tonight`,
    },
    {
      check: (s) => Number(s.actsThisWeek) > 0,
      emit: (s) => `${s.actsThisWeek} acts this week`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} venues`,
    },
  ],

  restaurants: [
    {
      check: (s) => Number(s.happyHourNow) > 0,
      emit: (s) => `${s.happyHourNow} with happy hour now`,
    },
    {
      check: (s) => Number(s.newThisMonth) > 0,
      emit: (s) => `${s.newThisMonth} new this month`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} restaurants`,
    },
  ],

  bars_nightlife: [
    {
      check: (s) => Number(s.happyHourNow) > 0,
      emit: (s) => `${s.happyHourNow} happy hours active now`,
    },
    {
      check: (s) => Number(s.eventsTonight) > 0,
      emit: (s) => `${s.eventsTonight} events tonight`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} bars`,
    },
  ],

  markets_local: [
    {
      check: (s) => Number(s.marketsThisWeekend) > 0,
      emit: (s) => `${s.marketsThisWeekend} markets this weekend`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} markets`,
    },
  ],

  libraries_learning: [
    {
      check: (s) => Number(s.programsThisWeek) > 0,
      emit: (s) => `${s.programsThisWeek} free programs this week`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} libraries`,
    },
  ],

  fun_games: [
    {
      check: (s) => Number(s.eventsThisWeek) > 0,
      emit: (s) => `${s.eventsThisWeek} events this week`,
    },
    {
      check: () => true,
      emit: (s) => `Family-friendly: ${s.familyCount ?? 0}`,
    },
  ],

  historic_sites: [
    {
      check: (s) => Number(s.toursThisWeek) > 0,
      emit: (s) => `${s.toursThisWeek} tours this week`,
    },
    {
      check: () => true,
      emit: (s) => `${s.totalCount ?? 0} landmarks`,
    },
  ],
};

// ---------------------------------------------------------------------------
// buildSummary
// ---------------------------------------------------------------------------

/**
 * Generate a single editorial summary string for a category based on
 * aggregate stats. Returns the first matching rule's string.
 */
export function buildSummary(
  categoryKey: string,
  stats: Record<string, number | string | undefined>
): string {
  const rules = SUMMARY_CONFIG[categoryKey];
  if (!rules) {
    return `${stats.totalCount ?? 0} places`;
  }

  for (const rule of rules) {
    if (rule.check(stats)) {
      return rule.emit(stats);
    }
  }

  return `${stats.totalCount ?? 0} places`;
}
