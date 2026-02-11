"use client";

import Link from "next/link";

type PortalSummary = {
  portal_id: string;
  portal_name: string;
  portal_slug: string;
  total_views: number;
  total_rsvps: number;
  total_signups: number;
  avg_active_users: number;
  wayfinding_opened: number;
  resource_clicked: number;
};

type SortColumn = "views" | "rsvps" | "signups" | "active";

type Props = {
  portals: PortalSummary[];
  sortBy?: SortColumn;
  onSort?: (column: SortColumn) => void;
};

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function SortHeader({
  column,
  label,
  sortBy,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sortBy: SortColumn;
  onSort?: (column: SortColumn) => void;
}) {
  return (
    <th
      className={`text-right px-4 py-3 font-mono text-xs uppercase tracking-wide cursor-pointer hover:text-[var(--cream)] transition-colors ${
        sortBy === column ? "text-[var(--coral)]" : "text-[var(--muted)]"
      }`}
      onClick={() => onSort?.(column)}
    >
      {label}
      {sortBy === column && <span className="ml-1">&#9660;</span>}
    </th>
  );
}

export default function PortalStatsTable({ portals, sortBy = "views", onSort }: Props) {
  const sortedPortals = [...portals].sort((a, b) => {
    switch (sortBy) {
      case "rsvps":
        return b.total_rsvps - a.total_rsvps;
      case "signups":
        return b.total_signups - a.total_signups;
      case "active":
        return b.avg_active_users - a.avg_active_users;
      default:
        return b.total_views - a.total_views;
    }
  });

  if (portals.length === 0) {
    return (
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-8 text-center">
        <p className="font-mono text-sm text-[var(--muted)]">No portal data available</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-[var(--night)]">
          <tr className="border-b border-[var(--twilight)]">
            <th className="text-left px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase tracking-wide">
              Portal
            </th>
            <SortHeader column="views" label="Views" sortBy={sortBy} onSort={onSort} />
            <SortHeader column="rsvps" label="RSVPs" sortBy={sortBy} onSort={onSort} />
            <SortHeader column="signups" label="Signups" sortBy={sortBy} onSort={onSort} />
            <SortHeader column="active" label="Avg Active" sortBy={sortBy} onSort={onSort} />
            <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase tracking-wide">
              Wayfinding
            </th>
            <th className="text-right px-4 py-3 font-mono text-xs text-[var(--muted)] uppercase tracking-wide">
              Resources
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPortals.map((portal, index) => (
            <tr
              key={portal.portal_id}
              className={`border-b border-[var(--twilight)] hover:bg-[var(--night)] transition-colors ${
                index % 2 === 0 ? "bg-[var(--dusk)]" : "bg-[var(--void)]/30"
              }`}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/analytics/portal/${portal.portal_id}`}
                  className="hover:text-[var(--coral)] transition-colors"
                >
                  <p className="font-mono text-sm text-[var(--cream)]">{portal.portal_name}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">/{portal.portal_slug}</p>
                </Link>
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.total_views)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.total_rsvps)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.total_signups)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.avg_active_users)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.wayfinding_opened)}
              </td>
              <td className="text-right px-4 py-3 font-mono text-sm text-[var(--cream)]">
                {formatNumber(portal.resource_clicked)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
