"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ActivityWithCount {
  value: string;
  label: string;
  icon: string;
  count: number;
  type: "subcategory" | "category";
}

interface BrowseByActivityProps {
  portalSlug: string;
}

// Curated list of activities to show - prioritized by what people search for
const ACTIVITY_CONFIG: Array<{
  value: string;
  label: string;
  icon: string;
  type: "subcategory" | "category";
}> = [
  { value: "nightlife.trivia", label: "Trivia Night", icon: "🧠", type: "subcategory" },
  { value: "nightlife.dj", label: "DJ Night", icon: "🎧", type: "subcategory" },
  { value: "nightlife.open_mic", label: "Open Mic", icon: "🎤", type: "subcategory" },
  { value: "comedy.standup", label: "Stand-Up Comedy", icon: "😂", type: "subcategory" },
  { value: "nightlife.drag", label: "Drag & Cabaret", icon: "✨", type: "subcategory" },
  { value: "music", label: "Live Music", icon: "🎵", type: "category" },
  { value: "nightlife.karaoke", label: "Karaoke", icon: "🎶", type: "subcategory" },
  { value: "nightlife.happy_hour", label: "Happy Hour", icon: "🍹", type: "subcategory" },
];

export default function BrowseByActivity({ portalSlug }: BrowseByActivityProps) {
  const [activities, setActivities] = useState<ActivityWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivityCounts() {
      try {
        const response = await fetch("/api/activities/popular");
        if (response.ok) {
          const data = await response.json();
          // Merge counts with our config
          const withCounts = ACTIVITY_CONFIG.map((activity) => ({
            ...activity,
            count: data.counts?.[activity.value] || 0,
          })).filter((a) => a.count > 0); // Only show activities with events

          setActivities(withCounts);
        } else {
          // Fallback: show activities without counts
          setActivities(ACTIVITY_CONFIG.map((a) => ({ ...a, count: 0 })));
        }
      } catch {
        // Fallback: show activities without counts
        setActivities(ACTIVITY_CONFIG.map((a) => ({ ...a, count: 0 })));
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivityCounts();
  }, []);

  // Don't render if no activities have events
  if (!isLoading && activities.length === 0) {
    return null;
  }

  // Build URL for activity
  function buildUrl(activity: ActivityWithCount): string {
    const params = new URLSearchParams();
    params.set("view", "find");
    params.set("type", "events");

    if (activity.type === "subcategory") {
      params.set("subcategories", activity.value);
    } else {
      params.set("categories", activity.value);
    }

    return `/${portalSlug}?${params.toString()}`;
  }

  return (
    <section className="py-6">
      <h2 className="text-lg font-display font-medium text-[var(--cream)] mb-4">
        What are you in the mood for?
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {activities.map((activity) => (
            <Link
              key={activity.value}
              href={buildUrl(activity)}
              className="group relative flex flex-col justify-between p-4 rounded-xl
                bg-[var(--card-bg)] border border-[var(--twilight)]
                hover:border-[var(--dusk)] hover:bg-[var(--twilight)]/50
                transition-all duration-200"
            >
              {/* Icon */}
              <span className="text-2xl mb-2">{activity.icon}</span>

              {/* Label and count */}
              <div>
                <h3 className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                  {activity.label}
                </h3>
                {activity.count > 0 && (
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {activity.count} this week
                  </p>
                )}
              </div>

              {/* Hover arrow indicator */}
              <span className="absolute top-4 right-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
