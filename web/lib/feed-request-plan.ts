export type FeedRequestPlanInput = {
  personalized: boolean;
  hasCategories: boolean;
  hasSearchQuery: boolean;
  hasTags: boolean;
  hasNeighborhoods: boolean;
  hasDateFilter: boolean;
  freeOnly: boolean;
  hasCursor: boolean;
};

export type FeedRequestPlan = {
  shouldFetchTrending: boolean;
  shouldRunSupplementalQueries: boolean;
  shouldRestrictToPersonalizedMatches: boolean;
  shouldBuildSections: boolean;
};

function isUnfilteredPersonalizedBrowse(
  input: FeedRequestPlanInput,
): boolean {
  return (
    input.personalized &&
    !input.hasCategories &&
    !input.hasSearchQuery &&
    !input.hasTags &&
    !input.hasNeighborhoods &&
    !input.hasDateFilter &&
    !input.freeOnly
  );
}

export function buildFeedRequestPlan(
  input: FeedRequestPlanInput,
): FeedRequestPlan {
  const unfilteredPersonalizedBrowse = isUnfilteredPersonalizedBrowse(input);

  return {
    shouldFetchTrending: !input.hasCursor,
    shouldRunSupplementalQueries: unfilteredPersonalizedBrowse,
    shouldRestrictToPersonalizedMatches:
      input.personalized &&
      !input.hasCategories &&
      !input.hasSearchQuery &&
      !input.hasTags &&
      !input.hasNeighborhoods,
    shouldBuildSections:
      !input.hasCursor && unfilteredPersonalizedBrowse,
  };
}
