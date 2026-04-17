/**
 * Yonder feed manifest.
 *
 * Extends the default Atlanta manifest with the two Yonder-specific sections
 * (Regional Escapes + Destination Node Quests) that used to hang off the
 * legacy shell's `portalSlug === "yonder"` branch.
 *
 * See docs/plans/feed-shell-server-split-2026-04-17.md (step 6).
 */
import dynamic from "next/dynamic";
import { ATLANTA_FEED_MANIFEST } from "./atlanta";
import type {
  FeedSection,
  FeedSectionComponentProps,
} from "../feed-section-contract";

// `ssr: false` omitted — manifest is imported from a Server Component and
// `next/dynamic` rejects it there. Underlying sections are `"use client"`.
const YonderRegionalEscapesSection = dynamic(
  () => import("@/components/feed/sections/YonderRegionalEscapesSection"),
);
const YonderDestinationNodeQuestsSection = dynamic(
  () => import("@/components/feed/sections/YonderDestinationNodeQuestsSection"),
);

function YonderRegionalEscapesIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <YonderRegionalEscapesSection
      portalSlug={ctx.portalSlug}
      weatherSignal={null}
      dayOfWeek={null}
      timeSlot={null}
    />
  );
}

function YonderDestinationNodeQuestsIsland({ ctx }: FeedSectionComponentProps) {
  return <YonderDestinationNodeQuestsSection portalSlug={ctx.portalSlug} />;
}

export const YONDER_FEED_MANIFEST: FeedSection[] = [
  ...ATLANTA_FEED_MANIFEST,
  {
    id: "yonder_regional_escapes",
    mode: "client-island",
    component: YonderRegionalEscapesIsland,
  },
  {
    id: "yonder_destination_quests",
    mode: "client-island",
    component: YonderDestinationNodeQuestsIsland,
  },
];
