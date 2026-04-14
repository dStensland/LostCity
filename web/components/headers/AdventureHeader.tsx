"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import UserMenu from "../UserMenu";
import { LaunchButton } from "@/components/search/LaunchButton";
import { useAuth } from "@/lib/auth-context";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

const PORTAL_SLUG = "adventure";

export default function AdventureHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Build redirect URL so sign-in returns to current page
  const currentUrl =
    pathname && pathname !== "/"
      ? searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname
      : null;
  const loginUrl = currentUrl
    ? `/auth/login?redirect=${encodeURIComponent(currentUrl)}`
    : "/auth/login";

  return (
    <header
      className="sticky top-0 z-[100]"
      style={{ backgroundColor: ADV.CREAM }}
    >
      <div
        className="relative h-14 flex items-center justify-between px-4"
        style={{
          borderBottom: `2px solid ${ADV.DARK}`,
        }}
      >
        {/* Logo */}
        <Link
          href={`/${PORTAL_SLUG}`}
          className="flex items-center gap-2 group"
        >
          <span
            className="group-hover:opacity-75 inline-block"
            style={{
              fontFamily: ADV_FONT,
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "2px",
              color: ADV.DARK,
            }}
          >
            LOST TRACK
          </span>
        </Link>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center"
            style={{ color: ADV.DARK }}
          >
            <LaunchButton />
          </div>

          {/* Auth: brutalist sign-in button when unauthenticated, avatar when authenticated */}
          {!loading && !user ? (
            <Link
              href={loginUrl}
              className="group flex items-center transition-colors"
              style={{
                border: `2px solid ${ADV.DARK}`,
                borderRadius: 0,
                padding: "0.375rem 0.75rem",
                fontFamily: ADV_FONT,
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: ADV.DARK,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = ADV.DARK;
                (e.currentTarget as HTMLAnchorElement).style.color = ADV.CREAM;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLAnchorElement).style.color = ADV.DARK;
              }}
              aria-label="Sign in"
            >
              SIGN IN
            </Link>
          ) : (
            <div
              className="flex items-center"
              style={{ color: ADV.DARK }}
            >
              <UserMenu minimal />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
