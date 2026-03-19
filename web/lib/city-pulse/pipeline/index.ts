/**
 * City Pulse pipeline — barrel exports.
 *
 * Stages:
 *  1. resolve-portal   — Portal lookup, auth, time context, manifest
 *  2. fetch-events     — Event pools (today, trending, horizon, tab mode)
 *  3. fetch-counts     — Pre-computed tab/category counts
 *  4. fetch-enrichments — Weather venues, specials, curated sections, social proof
 *  5. build-sections   — Section assembly from pools + enrichments
 *  6. assemble-response — Final response object + dedup + moderation
 */

export { resolvePortalContext } from "./resolve-portal";
export type { PipelineContext, PortalData, PortalFilters } from "./resolve-portal";

export {
  fetchEventPools,
  fetchTabEventPool,
  fetchNewFromSpots,
  buildEventQuery,
  buildInterestQueries,
  mergeEventPools,
  postProcessEvents,
  EVENT_SELECT,
} from "./fetch-events";
export type { EventPools } from "./fetch-events";

export {
  fetchFeedCounts,
  buildPrecomputedCategoryCounts,
  buildAllWindowCategoryCounts,
  countForWindow,
  buildCountCategoryQuery,
} from "./fetch-counts";
export type { FeedCounts, PrecomputedCountRow } from "./fetch-counts";

export {
  fetchPhaseAEnrichments,
  fetchPhaseBEnrichments,
  VENUE_SELECT,
} from "./fetch-enrichments";
export type { PhaseAEnrichments, PhaseBEnrichments } from "./fetch-enrichments";

export { buildSections } from "./build-sections";
export type { BuiltSections } from "./build-sections";

export { assembleResponse } from "./assemble-response";
