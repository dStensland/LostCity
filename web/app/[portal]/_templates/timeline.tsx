import type { Portal } from "@/lib/portal-context";
import { FeedRenderer } from "@/components/feed/FeedRenderer";

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
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-display text-[var(--cream)] mb-2">
            Timeline View
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Events organized chronologically
          </p>
        </div>

        {/* TODO: Implement timeline-specific event fetching and rendering */}
        <div className="text-center py-12 text-[var(--muted)]">
          Timeline content coming soon
        </div>
      </div>
    </FeedRenderer>
  );
}

export type { TimelineTemplateProps };
