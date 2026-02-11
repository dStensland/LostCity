"use client";

import { memo } from "react";
import type { Portal, PortalFeedConfig } from "@/lib/portal-context";
import { VerticalFeed } from "./layouts/VerticalFeed";
import { GridFeed } from "./layouts/GridFeed";
import { HorizontalFeed } from "./layouts/HorizontalFeed";

interface FeedRendererProps {
  portal: Portal;
  children: React.ReactNode;
}

function MasonryFeed({ children }: { children: React.ReactNode }) {
  return (
    <div className="masonry-feed">
      <div className="feed-content columns-1 sm:columns-2 xl:columns-3 gap-4 [column-fill:_balance]">
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

function TimelineFeed({ children }: { children: React.ReactNode }) {
  return (
    <div className="timeline-feed">
      <div className="feed-content relative pl-5 sm:pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-[var(--twilight)]/70 space-y-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Default feed configuration for portals without custom config.
 */
const DEFAULT_FEED_CONFIG: PortalFeedConfig = {
  layout: "vertical",
  card_variant: "standard",
  sections: ["featured", "for_you"],
  hero_style: "none",
  show_filters: true,
  group_by: "none",
};

/**
 * FeedRenderer dynamically selects the appropriate feed layout
 * based on portal configuration. Falls back to vertical layout
 * for backwards compatibility.
 */
export const FeedRenderer = memo(function FeedRenderer({
  portal,
  children,
}: FeedRendererProps) {
  // Merge portal feed config with defaults
  const config: PortalFeedConfig = {
    ...DEFAULT_FEED_CONFIG,
    ...(portal.settings.feed_config || {}),
  };

  // Select layout component based on config
  switch (config.layout) {
    case "grid":
      return <GridFeed config={config}>{children}</GridFeed>;

    case "horizontal":
      return <HorizontalFeed config={config}>{children}</HorizontalFeed>;

    case "masonry":
      return <MasonryFeed>{children}</MasonryFeed>;

    case "timeline":
      return <TimelineFeed>{children}</TimelineFeed>;

    case "vertical":
    default:
      return <VerticalFeed config={config}>{children}</VerticalFeed>;
  }
});

export type { FeedRendererProps };
