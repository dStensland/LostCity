"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  House,
  Buildings,
  Heart,
} from "@phosphor-icons/react";
import { hospitalBodyFont } from "@/lib/hospital-art";

type TabKey = "home" | "campuses" | "resources";

type Tab = {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  href: string;
};

function isActive(tab: TabKey, pathname: string, portalSlug: string): boolean {
  switch (tab) {
    case "home":
      return pathname === `/${portalSlug}` && !pathname.includes("/hospitals");
    case "campuses":
      return pathname.startsWith(`/${portalSlug}/hospitals`);
    case "resources":
      return pathname === `/${portalSlug}/community-hub`;
    default:
      return false;
  }
}

export default function EmoryMobileBottomNav({
  portalSlug,
}: {
  portalSlug: string;
}) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get("view");

  // Also treat ?view=community on portal root as "resources" active
  const isCommunityView =
    pathname === `/${portalSlug}` && viewParam === "community";

  const tabs: Tab[] = [
    { key: "home", label: "Home", icon: House, href: `/${portalSlug}` },
    {
      key: "campuses",
      label: "Campuses",
      icon: Buildings,
      href: `/${portalSlug}/hospitals`,
    },
    {
      key: "resources",
      label: "Resources",
      icon: Heart,
      href: `/${portalSlug}/community-hub`,
    },
  ];

  return (
    <nav
      className={`${hospitalBodyFont.className} fixed bottom-0 inset-x-0 z-[140] border-t border-[#d7dce4] bg-[#f8f8f8]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f8f8f8]/85 lg:hidden`}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.key === "resources"
              ? isCommunityView || isActive(tab.key, pathname, portalSlug)
              : tab.key === "home"
                ? !isCommunityView && isActive(tab.key, pathname, portalSlug)
                : isActive(tab.key, pathname, portalSlug);

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                active
                  ? "text-[#002f6c]"
                  : "text-[#6b7280] hover:text-[#374151]"
              }`}
            >
              <Icon
                size={22}
                weight={active ? "fill" : "regular"}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
