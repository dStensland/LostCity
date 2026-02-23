"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PortalEditProvider, usePortalEdit } from "@/lib/admin/portal-edit-context";

function PortalEditHeader() {
  const { portal, loading, error } = usePortalEdit();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm mb-4">{error || "Portal not found"}</p>
          <Link href="/admin/portals" className="text-[var(--coral)] font-mono text-sm hover:underline">
            Back to Portals
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function TabBar({ portalId }: { portalId: string }) {
  const pathname = usePathname();
  const { portal } = usePortalEdit();

  if (!portal) return null;

  const basePath = `/admin/portals/${portalId}`;
  const tabs = [
    { label: "Overview", href: basePath },
    { label: "Branding", href: `${basePath}/branding` },
    { label: "Feed", href: `${basePath}/feed` },
    { label: "Sections", href: `${basePath}/sections` },
    { label: "Feed Headers", href: `${basePath}/feed-headers` },
  ];

  return (
    <div className="border-b border-[var(--twilight)]">
      <div className="max-w-6xl mx-auto px-4">
        {/* Portal identity */}
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--cream)]">{portal.name}</h1>
            <p className="font-mono text-xs text-[var(--muted)]">
              /{portal.slug} · {portal.portal_type}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-1 rounded font-mono text-xs ${
                portal.status === "active"
                  ? "bg-green-400/20 text-green-400"
                  : portal.status === "draft"
                  ? "bg-yellow-400/20 text-yellow-400"
                  : "bg-[var(--twilight)] text-[var(--muted)]"
              }`}
            >
              {portal.status}
            </span>
            <Link
              href={`/${portal.slug}`}
              className="font-mono text-xs text-[var(--coral)] hover:opacity-80"
              target="_blank"
            >
              View Live
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            const isActive =
              tab.href === basePath
                ? pathname === basePath
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2.5 font-mono text-xs border-b-2 transition-colors ${
                  isActive
                    ? "border-[var(--coral)] text-[var(--cream)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function PortalEditLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);

  return (
    <PortalEditProvider portalId={id}>
      <PortalEditHeader />
      <TabBar portalId={id} />
      <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
    </PortalEditProvider>
  );
}
