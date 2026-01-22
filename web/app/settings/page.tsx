import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Settings | Lost City",
};

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login?redirect=/settings");
  }

  return (
    <div className="min-h-screen">
      <PageHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-8">
          Settings
        </h1>

        <div className="space-y-4">
          {/* Profile Settings */}
          <Link
            href="/settings/profile"
            className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  Profile
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Edit your username, display name, bio, and avatar
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Preferences */}
          <Link
            href="/settings/preferences"
            className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  Preferences
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Set your favorite categories, neighborhoods, and vibes
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Privacy */}
          <Link
            href="/settings/privacy"
            className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  Privacy
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Control who can see your profile and activity
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Notifications */}
          <Link
            href="/settings/notifications"
            className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  Notifications
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Event reminders, friend activity, and digest settings
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Appearance */}
          <Link
            href="/settings/appearance"
            className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                  Appearance
                </h2>
                <p className="font-mono text-xs text-[var(--muted)] mt-1">
                  Theme, rain effects, cursor glow, and visual settings
                </p>
              </div>
              <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Account Info */}
          <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
            <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
              Account
            </h2>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              {user.email}
            </p>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
