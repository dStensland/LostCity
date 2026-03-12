export type PortalFeedDateFilter =
  | "today"
  | "tomorrow"
  | "this_weekend"
  | "next_7_days"
  | "next_30_days";

export type PortalFeedAutoSectionInput = {
  blockType: string;
  sectionType: "auto" | "curated" | "mixed";
  maxItems: number;
  autoFilter: {
    eventIds?: number[];
    sourceSlugs?: string[];
    sourceIds?: number[];
    venueIds?: number[];
    dateFilter?: PortalFeedDateFilter;
    nightlifeMode?: boolean;
  } | null;
};

export type PortalFeedAutoSectionPlan = {
  requestedSourceSlugs: string[];
  constrainedSourceIds: number[];
  constrainedVenueIds: number[];
  maxEndDate: string;
  perBucketLimit: number;
  hasNightlifeSection: boolean;
  constrainedSupplementalLimit: number;
};

const NON_EVENT_BLOCK_TYPES = new Set([
  "category_grid",
  "announcement",
  "external_link",
  "countdown",
]);

function uniqueSortedNumbers(values: number[]): number[] {
  return Array.from(
    new Set(values.filter((value) => Number.isFinite(value))),
  ).sort((a, b) => a - b);
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort();
}

export function shouldSectionUseAutoEventPool(
  section: PortalFeedAutoSectionInput,
): boolean {
  return (
    (section.sectionType === "auto" || section.sectionType === "mixed") &&
    Boolean(section.autoFilter) &&
    !(section.autoFilter?.eventIds?.length) &&
    !NON_EVENT_BLOCK_TYPES.has(section.blockType)
  );
}

export function buildPortalFeedAutoSectionPlan(input: {
  sections: PortalFeedAutoSectionInput[];
  defaultLimit: number;
  itemsPerSection: number | null | undefined;
  defaultMaxEndDate: string;
  resolveDateRangeEnd: (filter: PortalFeedDateFilter) => string;
}): PortalFeedAutoSectionPlan {
  const requestedSourceSlugs = uniqueSortedStrings(
    input.sections.flatMap(
      (section) => section.autoFilter?.sourceSlugs || [],
    ),
  );
  const constrainedSourceIds = uniqueSortedNumbers(
    input.sections.flatMap((section) => section.autoFilter?.sourceIds || []),
  );
  const constrainedVenueIds = uniqueSortedNumbers(
    input.sections.flatMap((section) => section.autoFilter?.venueIds || []),
  );

  let maxEndDate = input.defaultMaxEndDate;
  for (const section of input.sections) {
    const dateFilter = section.autoFilter?.dateFilter;
    if (!dateFilter) continue;
    const end = input.resolveDateRangeEnd(dateFilter);
    if (end > maxEndDate) {
      maxEndDate = end;
    }
  }

  const requestedPerBucket = input.sections.reduce((sum, section) => {
    return (
      sum +
      (section.maxItems || input.itemsPerSection || input.defaultLimit) * 2
    );
  }, 0);
  const hasNightlifeSection = input.sections.some(
    (section) => section.autoFilter?.nightlifeMode === true,
  );
  const poolCeiling = hasNightlifeSection ? 200 : 120;
  const perBucketLimit = Math.max(
    40,
    Math.min(requestedPerBucket, poolCeiling),
  );
  const constrainedSupplementalLimit = Math.min(
    220,
    Math.max(
      constrainedSourceIds.length * 30,
      constrainedVenueIds.length * 25,
      80,
    ),
  );

  return {
    requestedSourceSlugs,
    constrainedSourceIds,
    constrainedVenueIds,
    maxEndDate,
    perBucketLimit,
    hasNightlifeSection,
    constrainedSupplementalLimit,
  };
}
