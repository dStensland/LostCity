import type { Portal } from "@/lib/portal-context";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getPortalHospitalLocations } from "@/lib/hospitals";
import { getEmoryCommunityHubDigest } from "@/lib/emory-community-category-feed";
import { getEmoryFederationShowcase } from "@/lib/emory-federation-showcase";
import { getSupportPolicyCounts, getSourcesByTrack, SUPPORT_SOURCE_POLICY_ITEMS } from "@/lib/support-source-policy";
import { COMMUNITY_CATEGORIES } from "@/lib/emory-community-categories";
import { getHospitalProfile } from "@/lib/emory-hospital-profiles";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
} from "@/lib/hospital-art";
import { getServerLocale, getMessages } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import EmoryCommunityHero from "@/app/[portal]/_components/hospital/EmoryCommunityHero";
import EmoryCommunityFooter from "@/app/[portal]/_components/hospital/EmoryCommunityFooter";
import EmoryDiscoveryDeck from "@/app/[portal]/_components/hospital/EmoryDiscoveryDeck";
import EmoryCategoryPathways from "@/app/[portal]/_components/hospital/EmoryCategoryPathways";

type EmoryCommunityExperienceProps = {
  portal: Portal;
  mode: HospitalAudienceMode;
  includeSupportSensitive?: boolean;
  hospitalSlug?: string | null;
};

export default async function EmoryCommunityExperience({
  portal,
  mode,
  includeSupportSensitive = false,
  hospitalSlug = null,
}: EmoryCommunityExperienceProps) {
  const hospitals = await getPortalHospitalLocations(portal.id);
  const primaryHospital = hospitals[0] || null;

  let hubDigest, showcase, locale;
  try {
    [hubDigest, showcase, locale] = await Promise.all([
      getEmoryCommunityHubDigest({
        portalSlug: portal.slug,
        mode,
        includeSensitive: includeSupportSensitive,
        hospitalSlug,
      }),
      getEmoryFederationShowcase({
        portalId: portal.id,
        portalSlug: portal.slug,
        hospital: primaryHospital,
        includeSensitive: includeSupportSensitive,
      }),
      getServerLocale(),
    ]);
  } catch (error) {
    console.error("[EmoryCommunityExperience] Data fetch failed:", error);
    return (
      <div className="emory-brand-native p-8 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
            Temporarily Unavailable
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            We&apos;re having trouble loading community resources right now. Please try again in a few minutes.
          </p>
          <a
            href={`/${portal.slug}`}
            className="inline-block px-4 py-2 rounded-lg bg-[var(--portal-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Return to Hospital Hub
          </a>
        </div>
      </div>
    );
  }

  const messages = await getMessages(locale);
  const communityMessages = messages.communityHub as Record<string, string>;

  if (hubDigest.categories.length === 0) {
    return (
      <div className="emory-brand-native p-8 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
            No Community Programs Available
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            No community programs are available at this time. Please check back later.
          </p>
          <a
            href={`/${portal.slug}`}
            className="inline-block px-4 py-2 rounded-lg bg-[var(--portal-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Return to Hospital Hub
          </a>
        </div>
      </div>
    );
  }

  const calendarHref = `/${portal.slug}?view=community&tab=groups`;

  // Mode-specific default Discovery Deck tab/filter
  const modeDefaultTab = mode === "urgent" ? "organizations" as const : "events" as const;

  const modeSubheadKey = `modeSubhead_${mode}`;
  const heroTitle = communityMessages.heroTitle || "How can we help today?";
  const subhead = communityMessages[modeSubheadKey] || "";

  // Build category-based quickFilters from digest categories
  const categoryFilters = hubDigest.categories.map((cat) => {
    const titleKey = `category_${cat.key}`;
    return {
      id: cat.key,
      label: communityMessages[titleKey] || cat.title,
      keywords: cat.keywordHints,
    };
  });
  const quickFilters = [
    { id: "all", label: communityMessages.filterAll || "All", keywords: [] as string[] },
    ...categoryFilters,
  ];

  // Build ID → name lookup for curated highlight orgs
  const orgNameById = new Map(SUPPORT_SOURCE_POLICY_ITEMS.map((item) => [item.id, item.name]));
  const hospitalProfile = getHospitalProfile(hospitalSlug);

  // Build pathway cards from digest categories
  const pathwayCards = hubDigest.categories.map((cat) => {
    const catDef = COMMUNITY_CATEGORIES.find((c) => c.key === cat.key);
    const trackKeys = catDef?.trackKeys || [];

    const allOrgs: { name: string; focus: string }[] = [];
    for (const track of trackKeys) {
      for (const org of getSourcesByTrack(track)) {
        if (!allOrgs.some((o) => o.name === org.name)) {
          allOrgs.push({ name: org.name, focus: org.focus });
        }
      }
    }

    // Hospital-specific highlight overrides take precedence over global defaults
    const overrideIds = hospitalProfile?.highlightOrgOverrides[cat.key];
    const effectiveHighlightIds = overrideIds ?? catDef?.highlightOrgIds ?? [];

    // Privacy gate: opt-in categories never expose org names
    const highlightOrgs =
      catDef?.sensitivity === "opt_in"
        ? []
        : effectiveHighlightIds
            .map((id) => orgNameById.get(id))
            .filter((name): name is string => Boolean(name));

    return {
      key: cat.key,
      title: communityMessages[`category_${cat.key}`] || cat.title,
      blurb: cat.blurb,
      iconName: cat.iconName,
      orgCount: allOrgs.length,
      highlightOrgs,
      filterHref: `/${portal.slug}/community-hub?community_hub_filter=${cat.key}#discovery-deck`,
    };
  });

  // Merge always-available orgs from all categories into showcase organizations (deduplicate by name)
  const showcaseOrgNames = new Set(showcase.organizations.map((o) => o.name));
  const mergedOrganizations = [...showcase.organizations];
  for (const cat of hubDigest.categories) {
    for (const org of cat.alwaysAvailableOrgs) {
      if (!showcaseOrgNames.has(org.name)) {
        showcaseOrgNames.add(org.name);
        mergedOrganizations.push({
          id: org.id,
          name: org.name,
          slug: null,
          orgType: org.focus,
          imageUrl: null,
          upcomingCount: 0,
          detailHref: org.url,
        });
      }
    }
  }

  return (
    <>
      <style>{EMORY_THEME_CSS}</style>

      <I18nProvider locale={locale} messages={messages}>
        <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-6 space-y-5`}>
          <EmoryCommunityHero
            mode={mode}
            stats={{
              eventsThisWeek: showcase.counts.events,
              organizations: getSupportPolicyCounts().totalOrganizations,
            }}
            portalSlug={portal.slug}
            heroTitle={heroTitle}
            subhead={subhead}
            chipLabels={{
              events: communityMessages.eventsThisWeek || "{count} Events This Week",
              orgs: communityMessages.organizations || "{count}+ Organizations",
            }}
          />

          <EmoryCategoryPathways
            cards={pathwayCards}
          />

        <section id="discovery-deck" className="emory-panel p-4 sm:p-5">
          <EmoryDiscoveryDeck
            stateKey="community_hub"
            title={communityMessages.browseTitle || "Browse programs and resources"}
            subtitle={communityMessages.browseSubtitle || "Search health programs, venues, and community organizations."}
            events={showcase.events}
            venues={showcase.venues}
            organizations={mergedOrganizations}
            defaultTab={modeDefaultTab}
            emptyHref={calendarHref}
            allowedViews={["list", "map"]}
            quickFilters={quickFilters}
          />
        </section>

        <EmoryCommunityFooter
          sourceCount={hubDigest.sourceCount}
          crisisLabel={communityMessages.crisisLabel}
          crisisLifelineName={communityMessages.crisisLifeline}
          georgiaCrisisLineName={communityMessages.georgiaCrisisLine}
          attributionText={communityMessages.sourceAttribution}
        />
        </div>
      </I18nProvider>
    </>
  );
}
