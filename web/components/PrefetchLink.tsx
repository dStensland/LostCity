"use client";

import { useCallback, useState } from "react";
import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type PrefetchLinkProps = LinkProps & {
  children: React.ReactNode;
  className?: string;
  requiresAuth?: boolean;
};

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/admin", "/settings", "/onboarding", "/foryou", "/saved"];

function isProtectedRoute(href: string): boolean {
  return PROTECTED_ROUTES.some((route) => href.startsWith(route));
}

/**
 * Smart Link component that handles prefetching based on auth state:
 * - Public routes: standard Next.js prefetch behavior
 * - Protected routes: only prefetch if user is authenticated
 * - Prefetch on hover for better performance
 */
export default function PrefetchLink({
  href,
  children,
  className,
  requiresAuth,
  prefetch,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter();
  const { user, authState } = useAuth();
  const [hasPrefetched, setHasPrefetched] = useState(false);

  const hrefString = typeof href === "string" ? href : href.pathname || "";
  const isProtected = requiresAuth ?? isProtectedRoute(hrefString);
  const isAuthenticated = authState === "authenticated" && user;

  // For protected routes, disable automatic prefetch and do it on hover
  const shouldDisablePrefetch = isProtected && !isAuthenticated;

  const handleMouseEnter = useCallback(() => {
    // Only prefetch once and only if authenticated for protected routes
    if (hasPrefetched) return;
    if (isProtected && !isAuthenticated) return;

    router.prefetch(hrefString);
    setHasPrefetched(true);
  }, [hasPrefetched, isProtected, isAuthenticated, router, hrefString]);

  return (
    <Link
      href={href}
      className={className}
      prefetch={shouldDisablePrefetch ? false : prefetch}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Link>
  );
}
