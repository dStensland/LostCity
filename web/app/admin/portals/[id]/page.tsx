"use client";

import Link from "next/link";
import { usePortalEdit } from "@/lib/admin/portal-edit-context";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default function PortalOverviewPage() {
  const {
    portal,
    loading,
    saving,
    error,
    success,
    setError,
    setSuccess,
    name,
    setName,
    tagline,
    setTagline,
    status,
    setStatus,
    visibility,
    setVisibility,
    navLabels,
    setNavLabels,
    handleSave,
    handleDelete,
  } = usePortalEdit();

  if (loading || !portal) return null;

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-400/10 border border-red-400/30 rounded flex items-center justify-between">
          <p className="text-red-400 font-mono text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-400/10 border border-green-400/30 rounded flex items-center justify-between">
          <p className="text-green-400 font-mono text-sm">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300 ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Basic Info */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Basic Info</h2>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Labels */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Navigation</h2>
        <p className="font-mono text-xs text-[var(--soft)] mb-4">
          Customize the navigation tab labels for this portal. Leave empty to use defaults.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Feed Tab</label>
            <input
              type="text"
              value={navLabels.feed || ""}
              onChange={(e) => setNavLabels({ ...navLabels, feed: e.target.value || undefined })}
              placeholder="Feed"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Events Tab</label>
            <input
              type="text"
              value={navLabels.events || ""}
              onChange={(e) => setNavLabels({ ...navLabels, events: e.target.value || undefined })}
              placeholder="Events"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Spots Tab</label>
            <input
              type="text"
              value={navLabels.spots || ""}
              onChange={(e) => setNavLabels({ ...navLabels, spots: e.target.value || undefined })}
              placeholder="Spots"
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-[var(--night)] rounded border border-[var(--twilight)]">
          <div className="font-mono text-xs text-[var(--muted)] uppercase mb-2">Preview</div>
          <div className="flex gap-2">
            {[
              { key: "feed" as const, default: "Feed" },
              { key: "events" as const, default: "Events" },
              { key: "spots" as const, default: "Spots" },
            ].map((tab) => (
              <span
                key={tab.key}
                className="px-3 py-1.5 rounded-md font-mono text-xs bg-[var(--twilight)] text-[var(--cream)]"
              >
                {navLabels[tab.key] || tab.default}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Content Summary */}
      <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Content</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="font-mono text-2xl text-[var(--cream)]">{portal.member_count}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Members</div>
          </div>
          <div>
            <div className="font-mono text-2xl text-[var(--cream)]">{portal.content_count}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Content Items</div>
          </div>
          <div>
            <div className="font-mono text-2xl text-[var(--cream)]">{portal.section_count}</div>
            <div className="font-mono text-xs text-[var(--muted)]">Sections</div>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/admin/portals/${portal.id}/sections`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded hover:bg-[var(--muted)]/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Manage Sections
          </Link>
          <Link
            href={`/admin/portals/${portal.id}/feed-headers`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded hover:bg-[var(--muted)]/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Feed Headers
          </Link>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        {portal.slug !== DEFAULT_PORTAL_SLUG && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-400 font-mono text-sm hover:text-red-300"
          >
            Delete Portal
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
