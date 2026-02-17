"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export type SettingsTab =
  | "profile"
  | "privacy"
  | "notifications"
  | "preferences"
  | "taste"
  | "account";

const TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  {
    key: "profile",
    label: "Profile",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    key: "privacy",
    label: "Privacy",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    key: "preferences",
    label: "Preferences",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    key: "taste",
    label: "Taste Profile",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "account",
    label: "Account",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function SettingsShellInner({ children }: { children: (activeTab: SettingsTab) => React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams?.get("tab") as SettingsTab) || "profile";

  const handleTabChange = (tab: SettingsTab) => {
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-200px)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 flex-shrink-0 border-r border-[var(--twilight)] bg-[var(--night)]">
        <nav className="sticky top-16 py-4">
          <h2 className="px-4 pb-3 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            Settings
          </h2>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-mono text-sm transition-colors ${
                activeTab === tab.key
                  ? "bg-[var(--dusk)] text-[var(--cream)] border-l-2 border-[var(--coral)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]/50 border-l-2 border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile tab bar */}
      <div className="md:hidden border-b border-[var(--twilight)] bg-[var(--night)] overflow-x-auto">
        <div className="flex px-2 py-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 font-mono text-xs whitespace-nowrap transition-colors rounded-md ${
                activeTab === tab.key
                  ? "text-[var(--cream)] bg-[var(--dusk)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content panel */}
      <main className="flex-1 max-w-2xl px-4 md:px-8 py-8">
        {children(activeTab)}
      </main>
    </div>
  );
}

export default function SettingsShell({
  children,
}: {
  children: (activeTab: SettingsTab) => React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-200px)]">
          <div className="hidden md:block w-60 border-r border-[var(--twilight)] bg-[var(--night)]" />
          <div className="flex-1 p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 rounded bg-[var(--twilight)]" />
              <div className="h-32 rounded-lg bg-[var(--twilight)]" />
              <div className="h-32 rounded-lg bg-[var(--twilight)]" />
            </div>
          </div>
        </div>
      }
    >
      <SettingsShellInner>{children}</SettingsShellInner>
    </Suspense>
  );
}
