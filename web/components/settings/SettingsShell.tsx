"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { User, Lock, Bell, Faders, ChartBar, Gear } from "@phosphor-icons/react";

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
    icon: <User className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
  {
    key: "privacy",
    label: "Privacy",
    icon: <Lock className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: <Bell className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
  {
    key: "preferences",
    label: "Preferences",
    icon: <Faders className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
  {
    key: "taste",
    label: "Taste Profile",
    icon: <ChartBar className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
  {
    key: "account",
    label: "Account",
    icon: <Gear className="w-4 h-4" weight="duotone" aria-hidden="true" />,
  },
];

function SettingsShellInner({ children }: { children: (activeTab: SettingsTab) => React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams?.get("tab") as SettingsTab) || "profile";
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const activeTabButtonRef = useRef<HTMLButtonElement>(null);

  const handleTabChange = (tab: SettingsTab) => {
    router.push(`/settings?tab=${tab}`, { scroll: false });
  };

  // Scroll the active tab into view on the mobile tab bar
  useEffect(() => {
    if (activeTabButtonRef.current && mobileScrollRef.current) {
      activeTabButtonRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeTab]);

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
      <div className="md:hidden border-b border-[var(--twilight)] bg-[var(--night)] overflow-x-auto scrollbar-hide" ref={mobileScrollRef}>
        <div className="flex px-2 py-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              ref={activeTab === tab.key ? activeTabButtonRef : undefined}
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
