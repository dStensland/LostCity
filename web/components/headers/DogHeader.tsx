"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import { useAuth } from "@/lib/auth-context";

type NavTab = {
  key: string;
  label: string;
  href: string;
};

const TABS: NavTab[] = [
  { key: "feed", label: "Explore", href: "" },
  { key: "find", label: "Map", href: "?view=find" },
  { key: "community", label: "Saved", href: "?view=community" },
];

interface DogHeaderProps {
  portalSlug: string;
  showBackButton?: boolean;
  pageTitle?: string;
}

export default function DogHeader({
  portalSlug,
  showBackButton = false,
  pageTitle,
}: DogHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  useAuth();

  const currentView = searchParams?.get("view") || "feed";

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mobileMenuOpen]);

  // Scroll detection
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isDeepPage =
    pathname.startsWith(`/${portalSlug}/`) &&
    ["/parks", "/pup-cups", "/adopt", "/training", "/services"].some((p) =>
      pathname.startsWith(`/${portalSlug}${p}`)
    );

  const isActive = (tab: NavTab) => {
    const isPortalPage = pathname === `/${portalSlug}`;
    if (tab.key === "feed")
      return (isPortalPage && (!currentView || currentView === "feed")) || isDeepPage;
    if (tab.key === "find")
      return (
        isPortalPage &&
        ["find", "events", "spots", "map", "calendar"].includes(currentView)
      );
    if (tab.key === "community")
      return isPortalPage && currentView === "community";
    return false;
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let targetIndex: number | null = null;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          targetIndex =
            currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
          break;
        case "ArrowRight":
          event.preventDefault();
          targetIndex =
            currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
          break;
        case "Home":
          event.preventDefault();
          targetIndex = 0;
          break;
        case "End":
          event.preventDefault();
          targetIndex = TABS.length - 1;
          break;
        default:
          return;
      }
      if (targetIndex !== null) {
        const href = TABS[targetIndex].href;
        router.push(`/${portalSlug}${href ? `${href}` : ""}`);
      }
    },
    [portalSlug, router]
  );

  return (
    <>
      <header
        className="sticky top-0 z-[100] transition-shadow duration-200"
        style={{
          background: isScrolled
            ? "rgba(255, 251, 235, 0.92)"
            : "var(--dog-cream, #FFFBEB)",
          backdropFilter: isScrolled ? "blur(12px)" : undefined,
          WebkitBackdropFilter: isScrolled ? "blur(12px)" : undefined,
          borderBottom: isScrolled
            ? "1px solid var(--dog-border, #FDE68A)"
            : "1px solid transparent",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo / Back button */}
          {showBackButton ? (
            <Link
              href={`/${portalSlug}`}
              className="flex items-center gap-1.5 flex-shrink-0 group"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--dog-orange, #FF6B35)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span
                className="text-sm font-semibold hidden sm:inline"
                style={{ color: "var(--dog-orange, #FF6B35)" }}
              >
                {pageTitle || "Back"}
              </span>
            </Link>
          ) : (
            <Link
              href={`/${portalSlug}`}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <span
                className="text-xl font-extrabold tracking-tighter"
                style={{
                  color: "var(--dog-orange, #FF6B35)",
                  fontFamily:
                    "var(--font-dog), 'Plus Jakarta Sans', system-ui, sans-serif",
                }}
              >
                ROMP
              </span>
            </Link>
          )}

          {/* Page title for mobile deep pages */}
          {showBackButton && pageTitle && (
            <span
              className="sm:hidden text-sm font-bold truncate"
              style={{ color: "var(--dog-charcoal, #292524)" }}
            >
              {pageTitle}
            </span>
          )}

          {/* Desktop nav pills */}
          {!showBackButton && (
            <nav
              className="hidden sm:flex items-center gap-1 rounded-full px-1 py-1"
              style={{
                background: "rgba(253, 232, 138, 0.25)",
              }}
              role="tablist"
              aria-label="Portal navigation"
            >
              {TABS.map((tab, i) => {
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.key}
                    href={`/${portalSlug}${tab.href ? `${tab.href}` : ""}`}
                    role="tab"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    className="px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-150"
                    style={{
                      background: active
                        ? "var(--dog-orange, #FF6B35)"
                        : "transparent",
                      color: active
                        ? "#FFFFFF"
                        : "var(--dog-charcoal, #292524)",
                      opacity: active ? 1 : 0.7,
                    }}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right side: search + user */}
          <div className="flex items-center gap-2">
            <HeaderSearchButton />
            <UserMenu />

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 -mr-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                style={{ color: "var(--dog-charcoal, #292524)" }}
              >
                {mobileMenuOpen ? (
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ) : (
                  <>
                    <path
                      d="M3 5h14M3 10h14M3 15h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="sm:hidden border-t"
            style={{
              background: "var(--dog-cream, #FFFBEB)",
              borderColor: "var(--dog-border, #FDE68A)",
            }}
          >
            <nav className="px-4 py-3 space-y-1">
              {TABS.map((tab) => {
                const active = isActive(tab);
                return (
                  <Link
                    key={tab.key}
                    href={`/${portalSlug}${tab.href ? `${tab.href}` : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{
                      background: active
                        ? "rgba(255, 107, 53, 0.1)"
                        : "transparent",
                      color: active
                        ? "var(--dog-orange, #FF6B35)"
                        : "var(--dog-charcoal, #292524)",
                    }}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] border-t"
        style={{
          background: "rgba(255, 251, 235, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "var(--dog-border, #FDE68A)",
        }}
      >
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                href={`/${portalSlug}${tab.href ? `${tab.href}` : ""}`}
                className="flex flex-col items-center gap-0.5 px-4 py-1"
              >
                <BottomNavIcon tabKey={tab.key} active={active} />
                <span
                  className="text-[10px] font-semibold"
                  style={{
                    color: active
                      ? "var(--dog-orange, #FF6B35)"
                      : "var(--dog-stone, #78716C)",
                  }}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function BottomNavIcon({
  tabKey,
  active,
}: {
  tabKey: string;
  active: boolean;
}) {
  const color = active
    ? "var(--dog-orange, #FF6B35)"
    : "var(--dog-stone, #78716C)";
  const strokeWidth = active ? "2.2" : "1.8";

  switch (tabKey) {
    case "feed":
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      );
    case "find":
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "community":
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    default:
      return null;
  }
}
