"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { hospitalDisplayFont } from "@/lib/hospital-art";
import { formatSmartDate, formatTime } from "@/lib/formats";
import type { EmoryCommunityHubDigest, AlwaysAvailableOrg } from "@/lib/emory-community-category-feed";
import type { EmoryCommunityStory } from "@/lib/emory-community-feed";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { ArrowSquareOut, CheckCircle } from "@phosphor-icons/react";

type EmoryCommunityResultsProps = {
  digest: EmoryCommunityHubDigest;
  portalSlug: string;
  mode: HospitalAudienceMode;
};

export default function EmoryCommunityResults({
  digest,
  portalSlug,
  mode,
}: EmoryCommunityResultsProps) {
  const t = useTranslations("communityHub");
  const searchParams = useSearchParams();
  const selectedCategoryKey = searchParams.get("community_category");

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryKey) return null;
    return digest.categories.find((cat) => cat.key === selectedCategoryKey);
  }, [digest.categories, selectedCategoryKey]);

  if (!selectedCategory) {
    return (
      <div id="community-results" tabIndex={-1} className="py-12 text-center">
        <p className="text-sm text-[var(--muted)]">{t("selectCategoryHint")}</p>
      </div>
    );
  }

  const displayStories = selectedCategory.stories.slice(0, 8);
  const hasContent = displayStories.length > 0 || selectedCategory.alwaysAvailableOrgs.length > 0;

  return (
    <div id="community-results" tabIndex={-1} aria-live="polite" className="space-y-6">
      {/* Category Header */}
      <div className="border-b border-[var(--twilight)] pb-3">
        <h2 className={`${hospitalDisplayFont.className} text-2xl text-[var(--cream)]`}>
          {selectedCategory.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{selectedCategory.blurb}</p>
      </div>

      {/* Empty State */}
      {!hasContent && (
        <div className="text-center py-12 text-[var(--charcoal)]/60">
          <p>{t("emptyCategoryState")}</p>
        </div>
      )}

      {/* Events Section */}
      {displayStories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--cream)] mb-3 uppercase tracking-wide">
            {t("upcomingEvents")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayStories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                portalSlug={portalSlug}
                mode={mode}
                categoryKey={selectedCategory.key}
              />
            ))}
          </div>
        </div>
      )}

      {/* Always Available Organizations */}
      {selectedCategory.alwaysAvailableOrgs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--cream)] mb-3 uppercase tracking-wide">
            {t("alwaysAvailable")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedCategory.alwaysAvailableOrgs.map((org) => (
              <OrgCard key={org.id} org={org} portalSlug={portalSlug} mode={mode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type StoryCardProps = {
  story: EmoryCommunityStory;
  portalSlug: string;
  mode: HospitalAudienceMode;
  categoryKey: string;
};

function StoryCard({ story, portalSlug, mode, categoryKey }: StoryCardProps) {
  const t = useTranslations("communityHub");
  const scheduleDisplay = useMemo(() => {
    const smartDate = formatSmartDate(story.startDate);
    const dateStr = smartDate.label;
    if (story.isAllDay) {
      return `${dateStr} · All day`;
    }
    if (story.startTime) {
      const timeStr = formatTime(story.startTime);
      return `${dateStr} · ${timeStr}`;
    }
    return dateStr;
  }, [story.startDate, story.startTime, story.isAllDay]);

  const detailHref = story.eventId ? `/${portalSlug}?event=${story.eventId}` : null;

  return (
    <div className="emory-story-card">
      <div className="flex flex-col gap-2">
        <div className="emory-kicker" style={{ fontSize: "11px" }}>
          {story.sourceName}
        </div>
        <h4 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">{story.title}</h4>
        <p className="text-xs text-[var(--muted)] line-clamp-2">{story.summary}</p>
        <div className="text-xs text-[var(--muted)]">
          {scheduleDisplay}
          {story.neighborhood && ` · ${story.neighborhood}`}
        </div>
        {story.eventId && (
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {detailHref && (
              <HospitalTrackedLink
                href={detailHref}
                className="text-xs font-semibold text-[var(--portal-accent)] hover:underline inline-flex items-center gap-1"
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug,
                  pageType: "community",
                  modeContext: mode,
                  sectionKey: categoryKey,
                  targetKind: "event",
                  targetId: String(story.eventId),
                  targetLabel: story.title,
                  targetUrl: detailHref,
                }}
              >
                {t("learnMore")}
              </HospitalTrackedLink>
            )}
            <HospitalTrackedLink
              href={story.sourceUrl}
              external
              className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--portal-accent)] hover:underline inline-flex items-center gap-1"
              tracking={{
                actionType: "resource_clicked",
                portalSlug,
                pageType: "community",
                modeContext: mode,
                sectionKey: categoryKey,
                targetKind: "event_source",
                targetId: String(story.eventId),
                targetLabel: story.title,
                targetUrl: story.sourceUrl,
              }}
            >
              Source
              <ArrowSquareOut size={12} weight="bold" />
            </HospitalTrackedLink>
          </div>
        )}
      </div>
    </div>
  );
}

type OrgCardProps = {
  org: AlwaysAvailableOrg;
  portalSlug: string;
  mode: HospitalAudienceMode;
};

function OrgCard({ org, portalSlug, mode }: OrgCardProps) {
  const t = useTranslations("communityHub");
  return (
    <div className="emory-org-card">
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-[var(--cream)]">{org.name}</h4>
        <p className="text-xs text-[var(--muted)] line-clamp-2">{org.focus}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="emory-always-available">
            <CheckCircle size={14} weight="fill" />
            {t("alwaysAvailable")}
          </span>
        </div>
        <HospitalTrackedLink
          href={org.url}
          external
          className="text-xs font-semibold text-[var(--portal-accent)] hover:underline inline-flex items-center gap-1 mt-1"
          tracking={{
            actionType: "resource_clicked",
            portalSlug,
            pageType: "community",
            modeContext: mode,
            targetKind: "organization",
            targetId: org.id,
            targetLabel: org.name,
            targetUrl: org.url,
          }}
        >
          {t("visitWebsite")}
          <ArrowSquareOut size={14} weight="bold" />
        </HospitalTrackedLink>
      </div>
    </div>
  );
}
