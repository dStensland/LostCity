export type ExploreClassesStudiosRequestKeyArgs = {
  category?: string | null;
  dateWindow?: string | null;
  skillLevel?: string | null;
  search?: string | null;
};

export type ExploreClassesScheduleRequestKeyArgs = {
  portalSlug: string;
  studioSlug: string;
  category?: string | null;
  dateWindow?: string | null;
  skillLevel?: string | null;
};

export function buildClassesStudiosRequestKey({
  category,
  dateWindow,
  skillLevel,
  search,
}: ExploreClassesStudiosRequestKeyArgs): string {
  return `studios:${category ?? ""}|${dateWindow ?? ""}|${skillLevel ?? ""}|${search ?? ""}`;
}

export function buildClassesScheduleRequestKey({
  portalSlug,
  studioSlug,
  category,
  dateWindow,
  skillLevel,
}: ExploreClassesScheduleRequestKeyArgs): string {
  return `schedule:${portalSlug}|${studioSlug}|${category ?? ""}|${dateWindow ?? ""}|${skillLevel ?? ""}`;
}
