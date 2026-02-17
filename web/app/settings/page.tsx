"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import SettingsShell, { type SettingsTab } from "@/components/settings/SettingsShell";
import { useAuth } from "@/lib/auth-context";

// Lazy-load panels
const ProfilePanel = dynamic(() => import("@/components/settings/ProfilePanel"), {
  loading: () => <PanelSkeleton />,
});
const PrivacyPanel = dynamic(() => import("@/components/settings/PrivacyPanel"), {
  loading: () => <PanelSkeleton />,
});
const NotificationsPanel = dynamic(() => import("@/components/settings/NotificationsPanel"), {
  loading: () => <PanelSkeleton />,
});
const PreferencesPanel = dynamic(() => import("@/components/settings/PreferencesPanel"), {
  loading: () => <PanelSkeleton />,
});
const TasteProfilePanel = dynamic(() => import("@/components/settings/TasteProfilePanel"), {
  loading: () => <PanelSkeleton />,
});
const AccountPanel = dynamic(() => import("@/components/settings/AccountPanel"), {
  loading: () => <PanelSkeleton />,
});

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-[var(--twilight)]" />
      <div className="h-32 rounded-lg bg-[var(--twilight)]" />
      <div className="h-32 rounded-lg bg-[var(--twilight)]" />
    </div>
  );
}

function renderPanel(tab: SettingsTab) {
  switch (tab) {
    case "profile":
      return <ProfilePanel />;
    case "privacy":
      return <PrivacyPanel />;
    case "notifications":
      return <NotificationsPanel />;
    case "preferences":
      return <PreferencesPanel />;
    case "taste":
      return <TasteProfilePanel />;
    case "account":
      return <AccountPanel />;
    default:
      return <ProfilePanel />;
  }
}

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login?redirect=/settings");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <div className="flex min-h-[calc(100vh-200px)]">
          <div className="hidden md:block w-60 border-r border-[var(--twilight)] bg-[var(--night)]" />
          <div className="flex-1 p-8">
            <PanelSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <UnifiedHeader />
      <SettingsShell>{(activeTab) => renderPanel(activeTab)}</SettingsShell>
      <PageFooter />
    </div>
  );
}
