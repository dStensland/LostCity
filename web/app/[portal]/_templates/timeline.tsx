import type { Portal } from "@/lib/portal-context";
import { FeedRenderer } from "@/components/feed/FeedRenderer";
import FeedView from "@/components/FeedView";

interface TimelineTemplateProps {
  portal: Portal;
}

/**
 * Timeline template - date-grouped chronological layout.
 * Optimized for conference schedules and event calendars.
 */
export async function TimelineTemplate({ portal }: TimelineTemplateProps) {
  return (
    <FeedRenderer portal={portal}>
      <FeedView />
    </FeedRenderer>
  );
}

export type { TimelineTemplateProps };
