import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageFooter from "@/components/PageFooter";

export const metadata = {
  title: "Settings | Lost City",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login?redirect=/settings");
  }

  const supabase = await createClient();

  const [{ data: profileRow }, { data: privacyRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_public")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_preferences")
      .select("cross_portal_recommendations, hide_adult_content")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isPublicProfile =
    (profileRow as { is_public: boolean | null } | null)?.is_public ?? true;
  const crossPortalRecommendations =
    (
      privacyRow as {
        cross_portal_recommendations: boolean | null;
        hide_adult_content: boolean | null;
      } | null
    )?.cross_portal_recommendations ?? true;
  const hideAdultContent =
    (
      privacyRow as {
        cross_portal_recommendations: boolean | null;
        hide_adult_content: boolean | null;
      } | null
    )?.hide_adult_content ?? false;

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-8">
          Settings
        </h1>

        <div className="space-y-8">
          <section>
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
              Identity and Privacy
            </h2>
            <div className="space-y-3">
              <SettingsLinkCard
                href="/settings/profile"
                title="Profile Details"
                description="Edit your display name, bio, location, and website."
              />
              <SettingsLinkCard
                href="/settings/privacy"
                title="Privacy Controls"
                description="Manage profile visibility and recommendation privacy settings."
              />
              <div className="p-4 rounded-lg bg-[var(--night)] border border-[var(--twilight)]">
                <p className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                  Current Privacy State
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-[var(--twilight)] text-[var(--soft)] font-mono text-xs">
                    Profile: {isPublicProfile ? "Public" : "Private"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--twilight)] text-[var(--soft)] font-mono text-xs">
                    Feed:{" "}
                    {crossPortalRecommendations
                      ? "Cross-portal"
                      : "Current portal only"}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[var(--twilight)] text-[var(--soft)] font-mono text-xs">
                    Mature content: {hideAdultContent ? "Hidden" : "Shown"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
              Recommendations
            </h2>
            <div className="space-y-3">
              <SettingsLinkCard
                href="/settings/preferences"
                title="Discovery Preferences"
                description="Set categories, genres, needs, neighborhoods, price, and cross-portal feed behavior."
              />
              <SettingsLinkCard
                href="/settings/taste-profile"
                title="Taste Profile"
                description="See what the system learned from your follows, RSVPs, and activity."
              />
            </div>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
              Notifications
            </h2>
            <div className="space-y-3">
              <SettingsLinkCard
                href="/settings/notifications"
                title="Notification Preferences"
                description="Choose which social, event, and system alerts you want."
              />
            </div>
          </section>

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

      <PageFooter />
    </div>
  );
}

function SettingsLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
            {title}
          </h3>
          <p className="font-mono text-xs text-[var(--muted)] mt-1">
            {description}
          </p>
        </div>
        <svg
          className="w-5 h-5 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
