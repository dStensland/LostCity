"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

interface ActivityWithCount {
  value: string;
  label: string;
  iconType: string;
  count: number;
  type: "subcategory" | "category";
  color: string;
}

interface BrowseByActivityProps {
  portalSlug: string;
}

// 6 curated activities with vector icons
const ACTIVITY_CONFIG: Array<{
  value: string;
  label: string;
  iconType: string; // Maps to CategoryIcon type
  type: "subcategory" | "category";
}> = [
  { value: "music", label: "Live Music", iconType: "music", type: "category" },
  { value: "comedy", label: "Comedy", iconType: "comedy", type: "category" },
  { value: "nightlife", label: "Nightlife", iconType: "club", type: "category" },
  { value: "art", label: "Art & Culture", iconType: "art", type: "category" },
  { value: "food_drink", label: "Food & Drink", iconType: "food_drink", type: "category" },
  { value: "community", label: "Community", iconType: "community", type: "category" },
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
          // Merge counts with our config and add colors
          const withCounts = ACTIVITY_CONFIG.map((activity) => ({
            ...activity,
            count: data.counts?.[activity.value] || 0,
            color: getCategoryColor(activity.iconType) || "#F97068",
          }));

          setActivities(withCounts);
        } else {
          // Fallback: show activities without counts
          setActivities(ACTIVITY_CONFIG.map((a) => ({
            ...a,
            count: 0,
            color: getCategoryColor(a.iconType) || "#F97068",
          })));
        }
      } catch {
        // Fallback: show activities without counts
        setActivities(ACTIVITY_CONFIG.map((a) => ({
          ...a,
          count: 0,
          color: getCategoryColor(a.iconType) || "#F97068",
        })));
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivityCounts();
  }, []);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activities.map((activity) => (
            <Link
              key={activity.value}
              href={buildUrl(activity)}
              className="group relative flex flex-col justify-between p-4 rounded-xl
                bg-[var(--card-bg)] border border-[var(--twilight)]
                hover:border-opacity-60 hover:bg-[var(--twilight)]/30
                transition-all duration-200 overflow-hidden"
              style={{
                "--activity-color": activity.color,
                borderColor: `color-mix(in srgb, ${activity.color} 20%, transparent)`,
              } as React.CSSProperties}
            >
              {/* Subtle glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${activity.color} 8%, transparent), transparent 70%)`,
                }}
              />

              {/* Icon with glow */}
              <div
                className="relative z-10 w-10 h-10 flex items-center justify-center rounded-lg mb-3 transition-all duration-200 group-hover:scale-110"
                style={{
                  backgroundColor: `color-mix(in srgb, ${activity.color} 15%, transparent)`,
                }}
              >
                <CategoryIcon
                  type={activity.iconType}
                  size={22}
                  glow="subtle"
                  style={{ color: activity.color }}
                />
              </div>

              {/* Label and count */}
              <div className="relative z-10">
                <h3
                  className="font-medium text-[var(--cream)] transition-colors group-hover:text-[var(--activity-color)]"
                  style={{ "--activity-color": activity.color } as React.CSSProperties}
                >
                  {activity.label}
                </h3>
                {activity.count > 0 && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
                    {activity.count} this week
                  </p>
                )}
              </div>

              {/* Hover arrow indicator */}
              <span
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: activity.color }}
              >
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
