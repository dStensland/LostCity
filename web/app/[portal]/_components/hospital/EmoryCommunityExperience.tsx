import type { Portal } from "@/lib/portal-context";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import { getPortalHospitalLocations } from "@/lib/hospitals";
import { getEmoryCommunityHubDigest } from "@/lib/emory-community-category-feed";
import { getEmoryFederationShowcase } from "@/lib/emory-federation-showcase";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
} from "@/lib/hospital-art";
import { getServerLocale, getMessages } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import EmoryCommunityHero from "@/app/[portal]/_components/hospital/EmoryCommunityHero";
import EmoryCommunityCategories from "@/app/[portal]/_components/hospital/EmoryCommunityCategories";
import EmoryCommunityResults from "@/app/[portal]/_components/hospital/EmoryCommunityResults";
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
      <div className="emory-brand-native p-8 text-center" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
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

  const categorySummaries = hubDigest.categories.map((cat) => {
    const titleKey = `category_${cat.key}`;
    const blurbKey = `category_${cat.key}_blurb`;
    return {
      key: cat.key,
      title: communityMessages[titleKey] || cat.title,
      blurb: communityMessages[blurbKey] || cat.blurb,
      iconName: cat.iconName,
      sensitivity: cat.sensitivity,
      storyCount: cat.stories.filter((s) => !s.isMock).length,
      orgCount: cat.alwaysAvailableOrgs.length,
    };
  });

  if (hubDigest.categories.length === 0) {
    return (
      <div className="emory-brand-native p-8 text-center" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
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

  const uniqueNeighborhoods = new Set<string>();
  for (const cat of hubDigest.categories) {
    for (const story of cat.stories) {
      if (story.neighborhood) uniqueNeighborhoods.add(story.neighborhood);
    }
  }

  const calendarHref = `/${portal.slug}?view=community&tab=groups`;

  const modeSubheadKey = `modeSubhead_${mode}`;
  const heroTitle = communityMessages.heroTitle || "How can we help today?";
  const subhead = communityMessages[modeSubheadKey] || "";

  return (
    <>
      <style>{EMORY_THEME_CSS}</style>

      <I18nProvider locale={locale} messages={messages}>
        <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-6 space-y-5`}>
          <EmoryCommunityHero
            mode={mode}
            stats={{
              eventsThisWeek: showcase.counts.events,
              organizations: showcase.counts.organizations,
              neighborhoods: Math.max(uniqueNeighborhoods.size, 6),
              sources: hubDigest.sourceCount,
            }}
            portalSlug={portal.slug}
            heroTitle={heroTitle}
            subhead={subhead}
            chipLabels={{
              events: communityMessages.eventsThisWeek || "{count} Events This Week",
              orgs: communityMessages.organizations || "{count} Organizations",
              neighborhoods: communityMessages.neighborhoods || "{count} Neighborhoods",
              sources: communityMessages.verifiedSources || "{count} Verified Sources",
            }}
          />

        <section className="emory-panel p-4 sm:p-5">
          <EmoryCommunityCategories
            categories={categorySummaries}
            includeSensitive={includeSupportSensitive}
            portalSlug={portal.slug}
          />
        </section>

        <section className="emory-panel p-4 sm:p-5">
          <EmoryCommunityResults
            digest={hubDigest}
            portalSlug={portal.slug}
            mode={mode}
          />
        </section>

        <section className="emory-panel p-4 sm:p-5">
          <EmoryDiscoveryDeck
            stateKey="community_hub"
            title={communityMessages.browseTitle || "Browse programs and resources"}
            subtitle={communityMessages.browseSubtitle || "Search health programs, venues, and community organizations."}
            events={showcase.events}
            venues={showcase.venues}
            organizations={showcase.organizations}
            defaultTab="events"
            emptyHref={calendarHref}
            allowedViews={["list", "map"]}
            quickFilters={[
              { id: "all", label: communityMessages.filterAll || "All", keywords: [] },
              { id: "healthy_eating", label: communityMessages.filterHealthyEating || "Healthy eating", keywords: ["food", "meal", "nutrition", "market", "produce", "kitchen", "pantry", "grocery"] },
              { id: "fitness", label: communityMessages.filterFitness || "Fitness", keywords: ["fitness", "walk", "movement", "yoga", "run", "exercise", "wellness"] },
              { id: "mental_health", label: communityMessages.filterMentalHealth || "Mental health", keywords: ["mental", "mindful", "stress", "peer", "wellness", "nami", "counseling", "therapy", "behavioral"] },
              { id: "support_groups", label: communityMessages.filterSupportGroups || "Support groups", keywords: ["support group", "peer support", "recovery", "grief", "caregiver", "survivor"] },
              { id: "family_children", label: communityMessages.filterFamilyChildren || "Family & children", keywords: ["family", "child", "pediatric", "parent", "baby", "maternal", "prenatal", "youth", "camp"] },
              { id: "veterans_seniors", label: communityMessages.filterVeteransSeniors || "Veterans & seniors", keywords: ["veteran", "military", "senior", "aging", "elder", "aarp", "retirement"] },
              { id: "housing_jobs", label: communityMessages.filterHousingJobs || "Housing & jobs", keywords: ["housing", "homeless", "shelter", "job", "employment", "workforce", "career", "rent", "utility"] },
              { id: "disability", label: communityMessages.filterDisability || "Disability services", keywords: ["disability", "accessible", "adaptive", "special olympics", "deaf", "blind", "vision", "hearing"] },
              { id: "crisis", label: communityMessages.filterCrisis || "Crisis & safety", keywords: ["crisis", "domestic violence", "safety", "hotline", "emergency", "harm reduction", "suicide"] },
            ]}
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
