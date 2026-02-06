"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass, createCssVarClassForLength } from "@/lib/css-utils";

type Portal = {
  id: string;
  slug: string;
  name: string;
  filters: {
    categories?: string[];
    neighborhoods?: string[];
  };
  branding: {
    logo_url?: string;
    primary_color?: string;
  };
};

type Category = {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
};

type Neighborhood = {
  id: string;
  label: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  org_type: string;
  event_count: number;
};

const CATEGORIES: Category[] = [
  {
    id: "music",
    label: "Live Music",
    color: "#E879F9",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    id: "comedy",
    label: "Comedy",
    color: "#FBBF24",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "art",
    label: "Art & Culture",
    color: "#C4B5FD",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "theater",
    label: "Theater",
    color: "#F472B6",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  {
    id: "food_drink",
    label: "Food & Drink",
    color: "#FB923C",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "nightlife",
    label: "Nightlife",
    color: "#A855F7",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: "sports",
    label: "Sports",
    color: "#22D3EE",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
  {
    id: "community",
    label: "Community",
    color: "#34D399",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

const NEIGHBORHOODS: Neighborhood[] = [
  { id: "East Atlanta", label: "East Atlanta" },
  { id: "Little Five Points", label: "Little Five Points" },
  { id: "Midtown", label: "Midtown" },
  { id: "Downtown", label: "Downtown" },
  { id: "Virginia-Highland", label: "Virginia-Highland" },
  { id: "Decatur", label: "Decatur" },
  { id: "Inman Park", label: "Inman Park" },
  { id: "Old Fourth Ward", label: "Old Fourth Ward" },
  { id: "Grant Park", label: "Grant Park" },
  { id: "Buckhead", label: "Buckhead" },
  { id: "Kirkwood", label: "Kirkwood" },
  { id: "West End", label: "West End" },
];

type Step = "categories" | "neighborhoods" | "producers" | "complete";

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalSlug = searchParams.get("portal");
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("categories");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  // Load portal data if specified
  useEffect(() => {
    async function loadPortal() {
      if (!portalSlug) return;

      const { data } = await supabase
        .from("portals")
        .select("id, slug, name, filters, branding")
        .eq("slug", portalSlug)
        .eq("status", "active")
        .maybeSingle();

      if (data) {
        setPortal(data as Portal);
      }
    }
    loadPortal();
  }, [portalSlug, supabase]);

  // Load featured organizations (portal-filtered if applicable)
  useEffect(() => {
    async function loadOrganizations() {
      setLoading(true);
      const url = portal
        ? `/api/organizations?limit=12&portal_id=${portal.id}`
        : "/api/organizations?limit=12";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Sort by event count and take top ones
        const sorted = (data.organizations || [])
          .sort((a: Organization, b: Organization) => (b.event_count || 0) - (a.event_count || 0))
          .slice(0, 12);
        setOrganizations(sorted);
      }
      setLoading(false);
    }
    loadOrganizations();
  }, [portal]);

  // Filter categories and neighborhoods based on portal
  const displayCategories = portal?.filters?.categories?.length
    ? CATEGORIES.filter((c) => portal.filters.categories!.includes(c.id))
    : CATEGORIES;

  const displayNeighborhoods = portal?.filters?.neighborhoods?.length
    ? NEIGHBORHOODS.filter((n) => portal.filters.neighborhoods!.includes(n.id))
    : NEIGHBORHOODS;

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleNeighborhood = (id: string) => {
    setSelectedNeighborhoods((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const toggleOrganization = (id: string) => {
    setSelectedOrganizations((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (step === "categories") {
      setStep("neighborhoods");
    } else if (step === "neighborhoods") {
      setStep("producers");
    } else if (step === "producers") {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (step === "categories") {
      setStep("neighborhoods");
    } else if (step === "neighborhoods") {
      setStep("producers");
    } else if (step === "producers") {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setSaving(true);

    // Save preferences
    if (selectedCategories.length > 0 || selectedNeighborhoods.length > 0) {
      await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          favorite_categories: selectedCategories.length > 0 ? selectedCategories : null,
          favorite_neighborhoods: selectedNeighborhoods.length > 0 ? selectedNeighborhoods : null,
        } as never);
    }

    // Follow selected organizations
    if (selectedOrganizations.length > 0) {
      const follows = selectedOrganizations.map((organizationId) => ({
        follower_id: user.id,
        followed_organization_id: organizationId,
      }));
      await supabase.from("follows").insert(follows as never);
    }

    setSaving(false);
    setStep("complete");
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progress = step === "categories" ? 33 : step === "neighborhoods" ? 66 : step === "producers" ? 90 : 100;

  const progressClass = createCssVarClassForLength(
    "--welcome-progress",
    `${progress}%`,
    "welcome-progress"
  );

  const categoryAccentClasses = Object.fromEntries(
    displayCategories.map((category) => [
      category.id,
      createCssVarClass("--accent-color", category.color, "welcome-cat"),
    ])
  ) as Record<string, ReturnType<typeof createCssVarClass> | null>;

  const scopedCss = [
    progressClass?.css,
    ...Object.values(categoryAccentClasses).map((entry) => entry?.css),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="min-h-screen flex flex-col">
      <ScopedStyles css={scopedCss} />
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-[var(--twilight)]">
        <div className="flex items-center gap-3">
          {portal?.branding?.logo_url ? (
            <Image
              src={portal.branding.logo_url}
              alt={portal.name}
              width={32}
              height={32}
              className="rounded-lg"
            />
          ) : (
            <Logo />
          )}
          {portal && (
            <span className="font-mono text-xs text-[var(--muted)]">
              {portal.name}
            </span>
          )}
        </div>
      </header>

      {/* Progress bar */}
      {step !== "complete" && (
        <div className="h-1 bg-[var(--twilight)]">
          <div
            className={`h-full bg-[var(--coral)] transition-all duration-300 w-[var(--welcome-progress)] ${progressClass?.className ?? ""}`}
          />
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          {step === "categories" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
                  {portal ? `Welcome to ${portal.name}` : "Welcome to Lost City"}
                </h1>
                <p className="text-[var(--soft)] text-sm">
                  What kind of events interest you?
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {displayCategories.map((category) => {
                  const isSelected = selectedCategories.includes(category.id);
                  const accentClass = categoryAccentClasses[category.id];
                  return (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-[var(--coral)] bg-[var(--coral)]/10"
                          : "border-[var(--twilight)] hover:border-[var(--soft)]"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-accent-20 text-accent ${accentClass?.className ?? ""}`}
                      >
                        {category.icon}
                      </div>
                      <p className="font-mono text-xs text-[var(--cream)] text-center">
                        {category.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "neighborhoods" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
                  Where do you like to go?
                </h1>
                <p className="text-[var(--soft)] text-sm">
                  {portal ? `Select neighborhoods for ${portal.name} events` : "Select your favorite Atlanta neighborhoods"}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {displayNeighborhoods.map((neighborhood) => {
                  const isSelected = selectedNeighborhoods.includes(neighborhood.id);
                  return (
                    <button
                      key={neighborhood.id}
                      onClick={() => toggleNeighborhood(neighborhood.id)}
                      className={`px-4 py-2 rounded-full font-mono text-sm transition-all ${
                        isSelected
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--soft)] hover:bg-[var(--dusk)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {neighborhood.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "producers" && (
            <div className="animate-fadeIn">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
                  Follow some organizers
                </h1>
                <p className="text-[var(--soft)] text-sm">
                  Get notified when they post new events
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {organizations.map((organization) => {
                    const isSelected = selectedOrganizations.includes(organization.id);
                    return (
                      <button
                        key={organization.id}
                        onClick={() => toggleOrganization(organization.id)}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? "border-[var(--coral)] bg-[var(--coral)]/10"
                            : "border-[var(--twilight)] hover:border-[var(--soft)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {organization.logo_url ? (
                            <Image
                              src={organization.logo_url}
                              alt={organization.name}
                              width={40}
                              height={40}
                              className="rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[var(--twilight)] flex items-center justify-center">
                              <span className="font-mono text-sm text-[var(--muted)]">
                                {organization.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-[var(--cream)] truncate">
                              {organization.name}
                            </p>
                            {organization.event_count > 0 && (
                              <p className="font-mono text-xs text-[var(--muted)]">
                                {organization.event_count} events
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <svg className="w-5 h-5 text-[var(--coral)] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="animate-fadeIn text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--coral)]/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
                You&apos;re all set!
              </h1>
              <p className="text-[var(--soft)] text-sm mb-8">
                {portal
                  ? `Your personalized feed is ready. Discover ${portal.name} events.`
                  : "Your personalized feed is ready. Discover events happening in Atlanta."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={portal ? `/${portal.slug}` : "/foryou"}
                  className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
                >
                  {portal ? `Explore ${portal.name}` : "See Your Feed"}
                </Link>
                <Link
                  href={portal ? "/foryou" : "/"}
                  className="px-6 py-3 border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded-lg hover:bg-[var(--twilight)] transition-colors"
                >
                  {portal ? "Your Feed" : "Explore Events"}
                </Link>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {step !== "complete" && (
            <div className="flex justify-between items-center mt-8">
              <button
                onClick={handleSkip}
                className="font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : step === "producers" ? "Finish" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
