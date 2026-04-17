/**
 * Portal feed manifest registry.
 *
 * `resolveFeedManifest(slug)` returns the section list for a given portal.
 * Portals without a dedicated manifest fall back to Atlanta — the "default"
 * template — so adding a new city only requires creating its manifest file
 * and wiring it here.
 */
import type { FeedSection } from "../feed-section-contract";
import { ATLANTA_FEED_MANIFEST } from "./atlanta";
import { YONDER_FEED_MANIFEST } from "./yonder";

const MANIFESTS: Record<string, FeedSection[]> = {
  atlanta: ATLANTA_FEED_MANIFEST,
  yonder: YONDER_FEED_MANIFEST,
};

export function resolveFeedManifest(portalSlug: string): FeedSection[] {
  return MANIFESTS[portalSlug] ?? ATLANTA_FEED_MANIFEST;
}
