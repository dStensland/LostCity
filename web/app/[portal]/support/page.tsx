import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  HandHeart,
  Heartbeat,
  HouseLine,
  Lifebuoy,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  getHelpAtlSupportDirectorySections,
  getHelpAtlSupportDirectoryStats,
  getHelpAtlTrustedPartners,
} from "@/lib/helpatl-support-directory";
import { isHelpAtlSupportDirectoryEnabled } from "@/lib/helpatl-support";
import { resolveCommunityPageRequest } from "../_surfaces/community/resolve-community-page-request";

export const revalidate = 180;

export default async function PortalSupportPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: portalSlug } = await params;
  const request = await resolveCommunityPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/support`,
  });
  const portal = request?.portal ?? null;

  if (!portal || !isHelpAtlSupportDirectoryEnabled(portal.slug)) {
    notFound();
  }

  const stats = getHelpAtlSupportDirectoryStats();
  const sections = getHelpAtlSupportDirectorySections();
  const trustedPartners = getHelpAtlTrustedPartners(9);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6">
      <section className="overflow-hidden rounded-[28px] border border-[var(--twilight)] bg-[var(--card-bg,var(--night))]">
        <div
          className="h-1"
          style={{
            background:
              "linear-gradient(90deg, var(--action-primary) 0%, color-mix(in srgb, var(--action-primary) 60%, #60a5fa) 100%)",
          }}
        />
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-center gap-2 text-2xs font-mono font-bold uppercase tracking-[0.14em] text-[var(--action-primary)]">
            <Lifebuoy className="h-4 w-4" weight="duotone" />
            Support Resource Directory
          </div>

          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-[var(--cream)] sm:text-5xl">
            Find help across Atlanta without hunting through ten different sites.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--soft)] sm:text-base">
            This directory pulls together trusted metro Atlanta organizations for food, housing, legal aid,
            public health, family support, refugee support, recovery, and long-term care. It is a resource
            map, not a real-time availability guarantee.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/${portal.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--action-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--action-primary-hover)]"
            >
              <ArrowLeft className="h-4 w-4" weight="bold" />
              Back to {portal.name}
            </Link>
            <Link
              href={`/${portal.slug}/volunteer/opportunities`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--twilight)] px-4 py-2.5 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-[var(--action-primary)]/40 hover:text-[var(--action-primary)]"
            >
              <HandHeart className="h-4 w-4" weight="duotone" />
              Ways to Help
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="Organizations" value={String(stats.totalOrganizations)} icon={<UsersThree className="h-4 w-4" weight="duotone" />} />
            <StatCard label="Support Tracks" value={String(stats.totalTracks)} icon={<Heartbeat className="h-4 w-4" weight="duotone" />} />
            <StatCard label="Directory Sections" value={String(stats.totalSections)} icon={<HouseLine className="h-4 w-4" weight="duotone" />} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cream)]">
            <ShieldCheck className="h-4 w-4 text-[var(--action-primary)]" weight="duotone" />
            Start Here
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
            Use this page when you need support infrastructure. Use the main HelpATL feed when you want dated
            meetings, trainings, volunteer shifts, or civic actions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.key}
                href={`#${section.key}`}
                className="rounded-full border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--action-primary)]/40 hover:text-[var(--action-primary)]"
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--cream)]">
            <Lifebuoy className="h-4 w-4 text-[var(--action-primary)]" weight="duotone" />
            Trusted Partners
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
            High-signal organizations that anchor Atlanta&apos;s support network.
          </p>
          <div className="mt-4 space-y-3">
            {trustedPartners.map((organization) => (
              <a
                key={organization.id}
                href={organization.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-[var(--twilight)]/70 bg-[var(--night)]/70 p-3 transition-colors hover:border-[var(--action-primary)]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--cream)]">{organization.name}</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{organization.focus}</p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" weight="bold" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-5">
        {sections.map((section) => (
          <section
            key={section.key}
            id={section.key}
            className="rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-5 sm:p-6"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--twilight)]/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--cream)]">{section.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--soft)]">{section.description}</p>
              </div>
              <div className="inline-flex w-fit items-center rounded-full border border-[var(--action-primary)]/30 bg-[var(--action-primary)]/8 px-3 py-1 text-xs font-mono font-bold uppercase tracking-[0.14em] text-[var(--action-primary)]">
                {section.organizationCount} organizations
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {section.organizations.map((organization) => (
                <a
                  key={organization.id}
                  href={organization.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border border-[var(--twilight)]/70 bg-[var(--night)]/70 p-4 transition-colors hover:border-[var(--action-primary)]/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--cream)]">{organization.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{organization.focus}</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--action-primary)]" weight="bold" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--twilight)]/70 bg-[var(--night)]/70 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        <span className="text-[var(--action-primary)]">{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-[var(--cream)]">{value}</div>
    </div>
  );
}
