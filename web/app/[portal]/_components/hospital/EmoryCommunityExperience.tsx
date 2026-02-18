import type { Portal } from "@/lib/portal-context";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getPortalHospitalLocations } from "@/lib/hospitals";
import { getEmoryCommunityHubDigest } from "@/lib/emory-community-category-feed";
import { getEmoryFederationShowcase } from "@/lib/emory-federation-showcase";
import { getSupportPolicyCounts } from "@/lib/support-source-policy";
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

type EmoryCommunityExperienceProps = {
  portal: Portal;
  mode: HospitalAudienceMode;
  includeSupportSensitive?: boolean;
};

export default async function EmoryCommunityExperience({
  portal,
  mode,
  includeSupportSensitive = false,
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

        <section className="emory-panel p-4 sm:p-5">
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
