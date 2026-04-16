"use client";

import { useMemo } from "react";
import { parseISO, format } from "date-fns";
import DetailShell from "@/components/detail/DetailShell";
import { ElevatedShell } from "@/components/detail/ElevatedShell";
import { DetailHero } from "./DetailHero";
import { DetailIdentity } from "./DetailIdentity";
import { DetailActions } from "./DetailActions";
import { QuickFactsCard } from "./QuickFactsCard";
import { HeroOverlayNav } from "./HeroOverlayNav";
import { SectionWrapper } from "./SectionWrapper";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import NeonBackButton from "@/components/detail/NeonBackButton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { sectionRegistry } from "@/components/detail/sections";
import { formatEventTime, formatPriceRange } from "@/lib/detail/format";
import type {
  HeroConfig,
  ActionConfig,
  SectionId,
  EntityData,
  EntityType,
  SectionModule,
} from "@/lib/detail/types";

interface DetailLayoutProps {
  heroConfig: HeroConfig;
  identity: React.ReactNode;
  actionConfig: ActionConfig;
  manifest: SectionId[];
  data: EntityData;
  portalSlug: string;
  accentColor: string;
  entityType: EntityType;
  onClose?: () => void;
  accentColorSecondary?: string;
  shellVariant?: "sidebar" | "elevated";
}

export function DetailLayout({
  heroConfig,
  identity,
  actionConfig,
  manifest,
  data,
  portalSlug,
  accentColor,
  entityType,
  onClose,
  accentColorSecondary,
  shellVariant = "sidebar",
}: DetailLayoutProps) {
  // Resolve accent color CSS
  const accentClass = useMemo(
    () => createCssVarClass("--detail-accent", accentColor, "detail-accent"),
    [accentColor],
  );
  const secondaryAccentClass = useMemo(
    () =>
      accentColorSecondary
        ? createCssVarClass("--detail-accent-secondary", accentColorSecondary, "detail-accent-2")
        : null,
    [accentColorSecondary],
  );

  // Filter manifest through trait checks and allowedEntityTypes
  const resolvedSections = useMemo(() => {
    const sections: SectionModule[] = [];
    for (const id of manifest) {
      const mod = sectionRegistry.get(id);
      if (!mod) continue;
      if (!mod.allowedEntityTypes.includes(entityType)) continue;
      if (!mod.trait(data)) continue;
      sections.push(mod);
    }

    // Thin state: if <3 sections, try injecting nearby and connections
    if (sections.length < 3) {
      for (const fallbackId of ["nearby", "connections"] as SectionId[]) {
        if (sections.some((s) => s.id === fallbackId)) continue;
        const mod = sectionRegistry.get(fallbackId);
        if (mod && mod.allowedEntityTypes.includes(entityType) && mod.trait(data)) {
          sections.push(mod);
        }
      }
    }

    // Elevated shell: remove socialProof from content (to be shown in rail instead)
    if (shellVariant === "elevated") {
      return sections.filter((s) => s.id !== "socialProof");
    }

    return sections;
  }, [manifest, data, entityType, shellVariant]);

  // Combine CSS for scoped styles (filter out null/empty)
  const scopedCss = useMemo(() => {
    const parts = [accentClass?.css, secondaryAccentClass?.css].filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : null;
  }, [accentClass?.css, secondaryAccentClass?.css]);

  // Build shared content sections (used by both shell variants)
  const contentSections = (
    <>
      {resolvedSections.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center mb-4 opacity-20">
            <span className="text-2xl">?</span>
          </div>
          <h3 className="text-base font-semibold text-[var(--cream)] mb-1">
            We&apos;re still learning about this place
          </h3>
          <p className="text-sm text-[var(--muted)]">
            Check back soon — or help us out by suggesting details
          </p>
        </div>
      ) : (
        resolvedSections.map((module, index) => {
          const Section = module.component;
          return (
            <SectionWrapper key={module.id} module={module} data={data} index={index}>
              <Section
                data={data}
                portalSlug={portalSlug}
                accentColor={accentColor}
                entityType={entityType}
              />
            </SectionWrapper>
          );
        })
      )}
    </>
  );

  // Build bottom bar (sticky on mobile) — shared by both variants
  const bottomBar = actionConfig.stickyBar.enabled ? (
    <DetailStickyBar
      primaryAction={
        actionConfig.primaryCTA
          ? {
              label: actionConfig.primaryCTA.label,
              href: actionConfig.primaryCTA.href,
              onClick: actionConfig.primaryCTA.onClick,
            }
          : undefined
      }
      primaryVariant={actionConfig.primaryCTA?.variant}
      primaryColor={accentColor}
      scrollThreshold={actionConfig.stickyBar.scrollThreshold}
      showShareButton
    />
  ) : undefined;

  // ── Elevated shell path ─────────────────────────────────────────────────────

  if (shellVariant === "elevated") {
    // Build quick facts from event data
    let quickFactsDate = "";
    let quickFactsVenueName: string | null = null;
    let quickFactsVenueSlug: string | null = null;
    let quickFactsPriceText: string | null = null;
    let quickFactsAgePolicy: string | null = null;

    if (data.entityType === "event") {
      const event = data.payload.event;
      const dateObj = parseISO(event.start_date);
      const datePart =
        event.end_date && event.end_date !== event.start_date
          ? `${format(dateObj, "MMM d")} – ${format(parseISO(event.end_date), "MMM d")}`
          : format(dateObj, "EEE, MMM d");
      const timePart = formatEventTime(event.is_all_day, event.start_time, event.end_time);
      quickFactsDate = timePart ? `${datePart} · ${timePart}` : datePart;
      quickFactsVenueName = event.venue?.name ?? null;
      quickFactsVenueSlug = event.venue?.slug ?? null;
      quickFactsPriceText = formatPriceRange(event.is_free, event.price_min, event.price_max);
      quickFactsAgePolicy = event.age_policy ?? null;
    }

    const rail = (
      <>
        <DetailActions config={actionConfig} accentColor={accentColor} variant="rail" />
        <div className="mt-4">
          <QuickFactsCard
            date={quickFactsDate}
            venueName={quickFactsVenueName}
            venueSlug={quickFactsVenueSlug}
            portalSlug={portalSlug}
            priceText={quickFactsPriceText}
            agePolicy={quickFactsAgePolicy}
          />
        </div>
      </>
    );

    const elevatedHeroConfig = {
      ...heroConfig,
      // Inject back-navigation overlay for the elevated hero
      overlaySlot: <HeroOverlayNav onClose={onClose} portalSlug={portalSlug} />,
    };

    return (
      <>
        <ScopedStyles css={scopedCss} />
        <ElevatedShell
          hero={<DetailHero {...elevatedHeroConfig} />}
          identity={identity}
          rail={rail}
          content={contentSections}
          bottomBar={bottomBar}
        />
      </>
    );
  }

  // ── Sidebar shell path (default — unchanged) ────────────────────────────────

  const sidebar = (
    <>
      <DetailHero {...heroConfig} />
      <DetailIdentity>{identity}</DetailIdentity>
      <DetailActions config={actionConfig} accentColor={accentColor} />
    </>
  );

  // Build top bar — NeonBackButton requires onClose; only render if provided
  const topBar = onClose ? (
    <div className="flex items-center justify-between w-full px-4 py-3">
      <NeonBackButton onClose={onClose} floating={false} />
    </div>
  ) : undefined;

  return (
    <>
      <ScopedStyles css={scopedCss} />
      <DetailShell
        topBar={topBar}
        sidebar={sidebar}
        content={contentSections}
        bottomBar={bottomBar}
        onClose={onClose}
      />
    </>
  );
}
