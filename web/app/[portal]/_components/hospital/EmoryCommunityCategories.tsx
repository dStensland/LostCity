"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Heart,
  Carrot,
  UsersThree,
  Baby,
  Lifebuoy,
  ShieldCheck,
  Stethoscope,
  Lock,
} from "@phosphor-icons/react";
import type { EmoryCommunityCategory, CategorySensitivity } from "@/lib/emory-community-categories";

type CategorySummary = {
  key: EmoryCommunityCategory;
  title: string;
  blurb: string;
  iconName: string;
  sensitivity: CategorySensitivity;
  storyCount: number;
  orgCount: number;
};

type EmoryCommunityBrowseProps = {
  categories: CategorySummary[];
  includeSensitive: boolean;
  portalSlug: string;
};

const ICON_MAP: Record<string, React.ElementType> = {
  Heart,
  Carrot,
  UsersThree,
  Baby,
  Lifebuoy,
  ShieldCheck,
  Stethoscope,
};

export default function EmoryCommunityCategories({
  categories,
  includeSensitive,
}: EmoryCommunityBrowseProps) {
  const t = useTranslations("communityHub");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCategory = searchParams.get("community_category");
  const [announcement, setAnnouncement] = useState("");
  const [localSensitive, setLocalSensitive] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("emory_show_sensitive");
    if (stored === "1") setLocalSensitive(true);
  }, []);

  const handleCategoryClick = useCallback(
    (categoryKey: string) => {
      const category = categories.find(cat => cat.key === categoryKey);
      const categoryTitle = category?.title || categoryKey;

      const params = new URLSearchParams(searchParams);
      params.set("community_category", categoryKey);
      router.replace(`${pathname}?${params.toString()}`);

      setAnnouncement(`${categoryTitle} selected. Loading results.`);
      setTimeout(() => setAnnouncement(""), 1000);

      setTimeout(() => {
        const resultsElement = document.getElementById("community-results");
        if (resultsElement) {
          resultsElement.focus();
          resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    },
    [router, pathname, searchParams, categories]
  );

  const hasSensitiveCategories = categories.some((cat) => cat.sensitivity === "opt_in");
  const showSensitive = includeSensitive || localSensitive;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((category) => {
        if (category.sensitivity === "opt_in" && !showSensitive) {
          return null;
        }

        const IconComponent = ICON_MAP[category.iconName];
        const isActive = selectedCategory === category.key;

        return (
          <div
            key={category.key}
            className={`emory-category-card ${isActive ? "emory-category-card-active" : ""}`}
            onClick={() => handleCategoryClick(category.key)}
            role="button"
            aria-pressed={isActive}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCategoryClick(category.key);
              }
            }}
          >
            <div className="flex items-start gap-3">
              {IconComponent && (
                <div className="flex-shrink-0 text-[var(--portal-accent)]">
                  <IconComponent size={32} weight="duotone" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-[var(--cream)]">{category.title}</h3>
                  {category.sensitivity === "opt_in" && (
                    <span className="emory-private-badge">
                      <Lock size={12} weight="fill" />
                      {t("private")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2">{category.blurb}</p>
                <div className="text-xs text-[var(--muted)]">
                  {t("eventCount", { count: category.storyCount })} · {t("orgCount", { count: category.orgCount })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      </div>
      {hasSensitiveCategories && !showSensitive && (
        <p className="text-sm text-[var(--charcoal)]/50 mt-3 text-center">
          {t("hiddenCategoriesHint")}{" "}
          <button
            onClick={() => {
              setLocalSensitive(true);
              sessionStorage.setItem("emory_show_sensitive", "1");
            }}
            className="underline hover:text-[var(--charcoal)]/70"
          >
            {t("showAll")}
          </button>
        </p>
      )}
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
    </>
  );
}
