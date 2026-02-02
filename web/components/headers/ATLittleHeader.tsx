"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import { useAuth } from "@/lib/auth-context";

/*
 * ATLittle Header
 * Design: "Adventure Guide" - Bold, playful, illustrated feeling
 */

type NavTab = {
  key: "feed" | "find" | "community";
  label: string;
  emoji: string;
  href: string;
};

const TABS: NavTab[] = [
  { key: "feed", label: "Home", emoji: "🏠", href: "" },
  { key: "find", label: "Explore", emoji: "🔍", href: "?view=find" },
  { key: "community", label: "Friends", emoji: "👋", href: "?view=community" },
];

const C = {
  orange: "#FF5722",
  green: "#4CAF50",
  purple: "#9C27B0",
  cream: "#FFF8E7",
  paper: "#FFFDF5",
  ink: "#1A1A1A",
};

export default function ATLittleHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  useAuth();

  const currentView = searchParams?.get("view") || "feed";
  const portalSlug = "atlanta-families";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [mobileMenuOpen]);

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

  const isActive = (tab: NavTab) => {
    const isPortalPage = pathname === `/${portalSlug}`;
    if (tab.key === "feed") return isPortalPage && (!currentView || currentView === "feed");
    if (tab.key === "find") return isPortalPage && ["find", "events", "spots", "map", "calendar"].includes(currentView);
    if (tab.key === "community") return isPortalPage && currentView === "community";
    return false;
  };

  // Keyboard navigation for tabs
  const handleKeyDown = useCallback((event: React.KeyboardEvent, currentIndex: number) => {
    let targetIndex: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        targetIndex = currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
        break;
      case "ArrowRight":
        event.preventDefault();
        targetIndex = currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
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
      const targetTab = TABS[targetIndex];
      router.push(`/${portalSlug}${targetTab.href}`);
    }
  }, [router]);

  return (
    <header
      className="sticky top-0 z-[100]"
      style={{ backgroundColor: C.cream }}
    >
      {/* Main bar */}
      <div
        className="relative h-16 flex items-center justify-between px-4 transition-shadow duration-200"
        style={{
          boxShadow: isScrolled ? `0 4px 0 ${C.ink}` : "none",
          borderBottom: `3px solid ${C.ink}`,
        }}
      >
        {/* Logo */}
        <Link
          href={`/${portalSlug}`}
          className="flex items-center gap-2 group"
        >
          {/* Badge style logo */}
          <div
            className="relative px-4 py-1.5 rounded-full transition-transform group-hover:scale-105 group-hover:-rotate-2"
            style={{
              backgroundColor: C.orange,
              border: `3px solid ${C.ink}`,
              boxShadow: `3px 3px 0 ${C.ink}`,
            }}
          >
            <span
              className="text-xl font-black text-white"
              style={{ fontFamily: "var(--font-baloo), var(--font-nunito), system-ui" }}
            >
              ATLittle
            </span>
          </div>
        </Link>

        {/* Desktop Nav - Pill style */}
        <nav className="hidden sm:flex items-center" role="tablist" aria-label="Main navigation">
          <div
            className="flex items-center gap-1 p-1 rounded-full"
            style={{ backgroundColor: C.paper, border: `2px solid ${C.ink}` }}
          >
            {TABS.map((tab, index) => {
              const active = isActive(tab);
              return (
                <Link
                  key={tab.key}
                  href={`/${portalSlug}${tab.href}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all"
                  style={{
                    backgroundColor: active ? C.ink : "transparent",
                    color: active ? "white" : C.ink,
                    fontFamily: "var(--font-nunito), system-ui",
                  }}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${tab.key}-panel`}
                  tabIndex={active ? 0 : -1}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div
            className="rounded-full transition-transform hover:scale-105"
            style={{
              border: `2px solid ${C.ink}`,
              boxShadow: `2px 2px 0 ${C.ink}`,
              backgroundColor: C.paper,
            }}
          >
            <HeaderSearchButton />
          </div>

          {/* User */}
          <div
            className="rounded-full transition-transform hover:scale-105"
            style={{
              border: `2px solid ${C.ink}`,
              boxShadow: `2px 2px 0 ${C.ink}`,
              backgroundColor: C.paper,
            }}
          >
            <UserMenu />
          </div>

          {/* Mobile menu */}
          <div className="relative sm:hidden" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all"
              style={{
                backgroundColor: mobileMenuOpen ? C.ink : C.paper,
                color: mobileMenuOpen ? "white" : C.ink,
                border: `2px solid ${C.ink}`,
                boxShadow: `2px 2px 0 ${C.ink}`,
              }}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <span className="text-lg">{mobileMenuOpen ? "✕" : "☰"}</span>
            </button>

            {mobileMenuOpen && (
              <div
                className="absolute right-0 top-full mt-3 w-52 rounded-2xl overflow-hidden z-50"
                style={{
                  backgroundColor: C.paper,
                  border: `3px solid ${C.ink}`,
                  boxShadow: `4px 4px 0 ${C.ink}`,
                }}
              >
                {TABS.map((tab) => {
                  const active = isActive(tab);
                  return (
                    <Link
                      key={tab.key}
                      href={`/${portalSlug}${tab.href}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 font-bold text-base transition-colors"
                      style={{
                        backgroundColor: active ? C.orange : "transparent",
                        color: active ? "white" : C.ink,
                        fontFamily: "var(--font-nunito), system-ui",
                      }}
                    >
                      <span className="text-xl">{tab.emoji}</span>
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
