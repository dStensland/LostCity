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
      // TODO: Implement masonry layout
      return <GridFeed config={config}>{children}</GridFeed>;

    case "timeline":
      // TODO: Implement timeline layout
      return <VerticalFeed config={config}>{children}</VerticalFeed>;

    case "vertical":
    default:
      return <VerticalFeed config={config}>{children}</VerticalFeed>;
  }
});

export type { FeedRendererProps };
