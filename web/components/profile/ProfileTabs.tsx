"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export type ProfileSection = "activity" | "upcoming" | "venues" | "taste";

const TABS: { key: ProfileSection; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "upcoming", label: "Upcoming" },
  { key: "venues", label: "Venues" },
  { key: "taste", label: "Taste" },
];

function ProfileTabsInner({
  username,
  children,
}: {
  username: string;
  children: (activeSection: ProfileSection) => React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = (searchParams?.get("section") as ProfileSection) || "activity";

  const handleTabChange = (section: ProfileSection) => {
    const url = section === "activity"
      ? `/profile/${username}`
      : `/profile/${username}?section=${section}`;
    router.push(url, { scroll: false });
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="max-w-3xl mx-auto px-4">
        <nav className="flex gap-1 border-b border-[var(--twilight)]">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-3 font-mono text-sm transition-colors relative ${
                activeSection === tab.key
                  ? "text-[var(--cream)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {tab.label}
              {activeSection === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--coral)]" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {children(activeSection)}
      </div>
    </div>
  );
}

export default function ProfileTabs({
  username,
  children,
}: {
  username: string;
  children: (activeSection: ProfileSection) => React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-16 rounded-lg bg-[var(--twilight)]" />
            <div className="h-16 rounded-lg bg-[var(--twilight)]" />
          </div>
        </div>
      }
    >
      <ProfileTabsInner username={username}>{children}</ProfileTabsInner>
    </Suspense>
  );
}
