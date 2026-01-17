"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

type Portal = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  status: "draft" | "active" | "archived";
  visibility: "public" | "unlisted" | "private";
  filters: Record<string, unknown>;
  branding: Record<string, unknown>;
  member_count: number;
  content_count: number;
  created_at: string;
  updated_at: string;
};

type Summary = {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
};

const PORTAL_TYPE_LABELS: Record<string, string> = {
  city: "City",
  event: "Event",
  business: "Business",
  personal: "Personal",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400",
  draft: "text-yellow-400",
  archived: "text-[var(--muted)]",
};

export default function AdminPortalsPage() {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "city" | "event" | "business" | "personal">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/portals");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPortals(data.portals);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const filteredPortals = portals.filter((p) => {
    if (filter === "all") return true;
    return p.portal_type === filter;
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
            Admin
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/admin" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]">
            Dashboard
          </Link>
          <Link href="/admin/sources" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]">
            Sources
          </Link>
          <Link href="/" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]">
            Home
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Portals</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 transition-opacity"
          >
            + New Portal
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total" value={summary.total} />
            <SummaryCard label="Cities" value={summary.by_type.city} accent="coral" />
            <SummaryCard label="Events" value={summary.by_type.event} accent="gold" />
            <SummaryCard label="Active" value={summary.by_status.active} accent="green" />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(["all", "city", "event", "business", "personal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-mono text-xs rounded-full whitespace-nowrap transition-colors ${
                filter === f
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {f === "all" ? "All" : PORTAL_TYPE_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full mx-auto" />
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}

        {/* Portals Table */}
        {!loading && !error && (
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--twilight)]">
                  <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase">Portal</th>
                  <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-left font-mono text-xs text-[var(--muted)] uppercase hidden lg:table-cell">Filters</th>
                  <th className="px-4 py-3 text-right font-mono text-xs text-[var(--muted)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortals.map((portal) => (
                  <PortalRow key={portal.id} portal={portal} onRefresh={loadData} />
                ))}
                {filteredPortals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)] font-mono text-sm">
                      No portals found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePortalModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const accentClass = accent === "coral" ? "text-[var(--coral)]" : accent === "gold" ? "text-[var(--gold)]" : accent === "green" ? "text-green-400" : "text-[var(--cream)]";
  return (
    <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-4">
      <div className={`font-mono text-2xl font-bold ${accentClass}`}>{value}</div>
      <div className="font-mono text-xs text-[var(--muted)] uppercase">{label}</div>
    </div>
  );
}

function PortalRow({ portal, onRefresh }: { portal: Portal; onRefresh: () => void }) {
  const [updating, setUpdating] = useState(false);

  async function toggleStatus() {
    setUpdating(true);
    const newStatus = portal.status === "active" ? "draft" : "active";
    try {
      const res = await fetch(`/api/admin/portals/${portal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onRefresh();
    } finally {
      setUpdating(false);
    }
  }

  const filterSummary = Object.entries(portal.filters || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");

  return (
    <tr className="border-b border-[var(--twilight)] last:border-0 hover:bg-[var(--twilight)]/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center">
            <span className="font-mono text-xs text-[var(--coral)]">
              {portal.portal_type[0].toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-sans text-sm text-[var(--cream)]">{portal.name}</div>
            <div className="font-mono text-xs text-[var(--muted)]">/{portal.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="font-mono text-xs text-[var(--soft)]">
          {PORTAL_TYPE_LABELS[portal.portal_type]}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`font-mono text-xs ${STATUS_COLORS[portal.status]}`}>
          {portal.status}
        </span>
        <span className="font-mono text-xs text-[var(--muted)] ml-2">
          · {portal.visibility}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="font-mono text-xs text-[var(--muted)] truncate max-w-[200px] block">
          {filterSummary || "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/portal/${portal.slug}`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]"
            target="_blank"
          >
            View
          </Link>
          <button
            onClick={toggleStatus}
            disabled={updating}
            className={`font-mono text-xs ${portal.status === "active" ? "text-yellow-400" : "text-green-400"} hover:opacity-80 disabled:opacity-50`}
          >
            {updating ? "..." : portal.status === "active" ? "Deactivate" : "Activate"}
          </button>
          <Link
            href={`/admin/portals/${portal.id}`}
            className="font-mono text-xs text-[var(--coral)] hover:opacity-80"
          >
            Edit
          </Link>
        </div>
      </td>
    </tr>
  );
}

function CreatePortalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [portalType, setPortalType] = useState<"city" | "event" | "business" | "personal">("city");
  const [cityFilter, setCityFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [name, slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const filters: Record<string, unknown> = {};
      if (portalType === "city" && cityFilter) {
        filters.city = cityFilter;
      }

      const res = await fetch("/api/admin/portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          tagline: tagline || null,
          portal_type: portalType,
          filters,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create portal");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg max-w-md w-full p-6">
        <h2 className="font-serif text-xl text-[var(--cream)] italic mb-4">Create Portal</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Type</label>
            <select
              value={portalType}
              onChange={(e) => setPortalType(e.target.value as typeof portalType)}
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            >
              <option value="city">City</option>
              <option value="event">Event</option>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={portalType === "city" ? "Denver" : "My Portal"}
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="denver"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="The real Denver, found"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>

          {portalType === "city" && (
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">City Filter</label>
              <input
                type="text"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Denver"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              />
              <p className="font-mono text-xs text-[var(--muted)] mt-1">Events will be filtered to this city</p>
            </div>
          )}

          {error && (
            <p className="text-red-400 font-mono text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm rounded hover:text-[var(--cream)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || !slug}
              className="flex-1 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Portal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
