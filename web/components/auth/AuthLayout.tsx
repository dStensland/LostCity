"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { extractPortalFromRedirect } from "@/lib/auth-utils";
import { AuthHeroPhoto } from "./AuthHeroPhoto";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const PORTAL_BRANDING: Record<string, { label: string; accentColor: string }> = {
  helpatl: { label: "LOST CITIZEN", accentColor: "#2D6A4F" },
  "arts-atlanta": { label: "LOST ARTS", accentColor: "#C9874F" },
  "atlanta-families": { label: "LOST YOUTH", accentColor: "#5E7A5E" },
  adventure: { label: "LOST TRACK", accentColor: "#C45A3B" },
};

function AuthLayoutInner({ children }: AuthLayoutProps) {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");

  const portalSlug =
    searchParams.get("portal") ||
    extractPortalFromRedirect(rawRedirect ?? "/");

  const branding = portalSlug ? PORTAL_BRANDING[portalSlug] : undefined;

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-[var(--void)]">
      {/* Photo: full-width header on mobile, fixed left half on desktop */}
      <div className="h-[200px] sm:h-auto sm:w-1/2 sm:fixed sm:inset-y-0 sm:left-0 relative">
        <AuthHeroPhoto
          portalSlug={portalSlug}
          portalAccentColor={branding?.accentColor}
          portalLabel={branding?.label}
        />
      </div>

      {/* Form: below photo on mobile, right half on desktop */}
      <div className="flex-1 sm:ml-[50%] flex items-start sm:items-center justify-center px-6 py-8 sm:py-0">
        <div className="w-full max-w-sm sm:bg-[var(--night)] sm:rounded-card sm:border sm:border-[var(--twilight)] sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
          <div className="animate-pulse text-[var(--muted)]">Loading...</div>
        </div>
      }
    >
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </Suspense>
  );
}

export type { AuthLayoutProps };
