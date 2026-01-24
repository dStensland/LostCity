"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Portal = {
  id: string;
  slug: string;
  name: string;
};

type SharingRule = {
  id: string;
  share_scope: "all" | "selected" | "none";
  allowed_categories: string[] | null;
  created_at: string;
  updated_at: string;
};

type Subscriber = {
  id: string;
  subscription_scope: "all" | "selected";
  subscribed_categories: string[] | null;
  created_at: string;
  subscriber: Portal | null;
};

type Source = {
  id: number;
  name: string;
  slug: string;
  url: string;
  source_type: string;
  is_active: boolean;
  owner_portal_id: string | null;
  owner_portal: Portal | null;
};

type SourceData = {
  source: Source;
  sharingRule: SharingRule | null;
  subscriberCount: number;
  subscribers: Subscriber[];
};

const CATEGORIES = [
  "music", "film", "comedy", "theater", "art", "sports",
  "food_drink", "nightlife", "community", "fitness", "family",
  "learning", "dance", "tours", "meetup", "words", "religious",
  "markets", "wellness", "gaming", "outdoors", "other"
];

export default function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sourceId = parseInt(id, 10);

  const [data, setData] = useState<SourceData | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("global");
  const [shareScope, setShareScope] = useState<"all" | "selected" | "none">("none");
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Load source data
        const sharingRes = await fetch(`/api/admin/sources/${sourceId}/sharing`);
        if (!sharingRes.ok) throw new Error("Failed to fetch source data");
        const sourceData = await sharingRes.json();
        setData(sourceData);

        // Set form state
        setSelectedOwnerId(sourceData.source.owner_portal_id || "global");
        if (sourceData.sharingRule) {
          setShareScope(sourceData.sharingRule.share_scope);
          setAllowedCategories(sourceData.sharingRule.allowed_categories || []);
        }

        // Load portals for owner dropdown
        const portalsRes = await fetch("/api/admin/portals");
        if (portalsRes.ok) {
          const portalsData = await portalsRes.json();
          setPortals(portalsData.portals || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sourceId]);

  async function handleOwnershipChange() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/ownership`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_portal_id: selectedOwnerId === "global" ? null : selectedOwnerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update ownership");
      }

      // Reload data
      const sharingRes = await fetch(`/api/admin/sources/${sourceId}/sharing`);
      const sourceData = await sharingRes.json();
      setData(sourceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSharingChange() {
    if (!data?.source.owner_portal_id) {
      setError("Cannot set sharing rules for global sources");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/sharing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_scope: shareScope,
          allowed_categories: shareScope === "selected" ? allowedCategories : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update sharing");
      }

      // Reload data
      const sharingRes = await fetch(`/api/admin/sources/${sourceId}/sharing`);
      const sourceData = await sharingRes.json();
      setData(sourceData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category: string) {
    setAllowedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="p-4 text-[var(--muted)]">Source not found</div>
      </div>
    );
  }

  const { source, sharingRule, subscriberCount, subscribers } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/admin/sources"
          className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]"
        >
          &larr; Sources
        </Link>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`w-3 h-3 rounded-full ${
              source.is_active ? "bg-green-400" : "bg-[var(--muted)]"
            }`}
          />
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">{source.name}</h1>
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">{source.slug}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Basic Info Card */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6 mb-6">
        <h2 className="font-serif text-lg text-[var(--cream)] italic mb-4">Source Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">URL</p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[var(--coral)] hover:underline break-all"
            >
              {source.url}
            </a>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">Type</p>
            <p className="font-mono text-sm text-[var(--soft)]">{source.source_type}</p>
          </div>
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase mb-1">Status</p>
            <p className="font-mono text-sm text-[var(--soft)]">
              {source.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        </div>
      </div>

      {/* Ownership Card */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6 mb-6">
        <h2 className="font-serif text-lg text-[var(--cream)] italic mb-4">Ownership</h2>
        <p className="font-mono text-xs text-[var(--muted)] mb-4">
          Assign this source to a portal. Global sources appear in all portals automatically.
        </p>

        <div className="flex items-center gap-4">
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
          >
            <option value="global">Global (all portals)</option>
            {portals.map((portal) => (
              <option key={portal.id} value={portal.id}>
                {portal.name} ({portal.slug})
              </option>
            ))}
          </select>

          <button
            onClick={handleOwnershipChange}
            disabled={saving || selectedOwnerId === (source.owner_portal_id || "global")}
            className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Update Owner"}
          </button>
        </div>

        {source.owner_portal && (
          <p className="mt-3 font-mono text-xs text-[var(--soft)]">
            Currently owned by:{" "}
            <Link
              href={`/admin/portals/${source.owner_portal.id}`}
              className="text-[var(--coral)] hover:underline"
            >
              {source.owner_portal.name}
            </Link>
          </p>
        )}
      </div>

      {/* Sharing Rules Card */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6 mb-6">
        <h2 className="font-serif text-lg text-[var(--cream)] italic mb-4">Sharing Rules</h2>

        {!source.owner_portal_id ? (
          <p className="font-mono text-sm text-[var(--muted)]">
            Global sources are automatically available to all portals. Assign an owner to configure
            sharing rules.
          </p>
        ) : (
          <>
            <p className="font-mono text-xs text-[var(--muted)] mb-4">
              Control which categories from this source other portals can subscribe to.
            </p>

            <div className="space-y-4">
              <div className="flex gap-4">
                {(["none", "all", "selected"] as const).map((scope) => (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shareScope"
                      checked={shareScope === scope}
                      onChange={() => setShareScope(scope)}
                      className="w-4 h-4 accent-[var(--coral)]"
                    />
                    <span className="font-mono text-sm text-[var(--soft)]">
                      {scope === "none" && "Private"}
                      {scope === "all" && "Share All Categories"}
                      {scope === "selected" && "Share Selected Categories"}
                    </span>
                  </label>
                ))}
              </div>

              {shareScope === "selected" && (
                <div className="border-t border-[var(--twilight)] pt-4">
                  <p className="font-mono text-xs text-[var(--muted)] mb-3">
                    Select categories to share:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors ${
                          allowedCategories.includes(cat)
                            ? "bg-[var(--coral)] text-[var(--void)]"
                            : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {cat.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleSharingChange}
                disabled={saving}
                className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Update Sharing Rules"}
              </button>
            </div>

            {sharingRule && (
              <p className="mt-4 font-mono text-xs text-[var(--muted)]">
                Last updated:{" "}
                {formatDistanceToNow(new Date(sharingRule.updated_at), { addSuffix: true })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Subscribers Card */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-[var(--cream)] italic">Subscribers</h2>
          <span className="px-2 py-1 bg-[var(--night)] rounded font-mono text-xs text-[var(--muted)]">
            {subscriberCount} portal{subscriberCount !== 1 ? "s" : ""}
          </span>
        </div>

        {subscribers.length === 0 ? (
          <p className="font-mono text-sm text-[var(--muted)]">
            {!source.owner_portal_id
              ? "Global sources don't have subscribers - they're available to all portals."
              : sharingRule?.share_scope === "none"
              ? "This source is private. Enable sharing to allow subscriptions."
              : "No portals have subscribed to this source yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {subscribers.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-3 bg-[var(--night)] rounded-lg"
              >
                <div>
                  <p className="font-mono text-sm text-[var(--cream)]">
                    {sub.subscriber?.name || "Unknown Portal"}
                  </p>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {sub.subscription_scope === "all"
                      ? "All shared categories"
                      : `${sub.subscribed_categories?.length || 0} categories`}
                  </p>
                </div>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
