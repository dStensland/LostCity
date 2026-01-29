"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, authState } = useAuth();

  // Redirect to login if not authenticated
  // Middleware already protects this route, this is a fallback for client-side navigation
  useEffect(() => {
    if (authState === "unauthenticated") {
      router.push("/auth/login?redirect=/dashboard");
    }
  }, [authState, router]);

  // Only show loading during initial auth check
  // If authState is "checking" or "initializing", show minimal loading
  if (authState === "initializing" || authState === "checking") {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Show header shell to prevent layout shift */}
        <header className="sticky top-0 z-40 border-b bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="h-8 w-24 rounded skeleton-shimmer" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full skeleton-shimmer" />
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // Middleware should have already redirected, but handle edge case
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <UnifiedHeader />
      <main className="flex-1">{children}</main>
      <PageFooter />
    </div>
  );
}
