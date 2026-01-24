"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import { formatDistanceToNow } from "date-fns";

type Source = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  sharingRule?: {
    id: string;
    shareScope: string;
    allowedCategories: string[] | null;
    updatedAt: string;
  } | null;
  subscriberCount?: number;
};

const CATEGORIES = [
  "music", "film", "comedy", "theater", "art", "sports",
  "food_drink", "nightlife", "community", "fitness", "family",
  "learning", "dance", "tours", "meetup", "words", "religious",
  "markets", "wellness", "gaming", "outdoors", "other"
];

export default function PortalSourcesPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<number | null>(null);
  const [editShareScope, setEditShareScope] = useState<"all" | "selected" | "none">("none");
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSources();
  }, [portal.id]);

  async function loadSources() {
    try {
      const fedRes = await fetch("/api/admin/federation/stats");
      if (!fedRes.ok) throw new Error("Failed to fetch sources");
      const fedData = await fedRes.json();

      const ownedSources = (fedData.sources || []).filter(
        (s: { ownerPortalId: string | null }) => s.ownerPortalId === portal.id
      );

      setSources(ownedSources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function startEditing(source: Source) {
    setEditingSource(source.id);
    setEditShareScope((source.sharingRule?.shareScope as "all" | "selected" | "none") || "none");
    setEditCategories(source.sharingRule?.allowedCategories || []);
  }

  function cancelEditing() {
    setEditingSource(null);
    setEditShareScope("none");
    setEditCategories([]);
  }

  async function saveSharing(sourceId: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sources/${sourceId}/sharing`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_scope: editShareScope,
          allowed_categories: editShareScope === "selected" ? editCategories : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update sharing");
      }

      // Reload sources
      await loadSources();
      setEditingSource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category: string) {
    setEditCategories((prev) =>
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-1">Owned Sources</h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Configure sharing rules for sources you own
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)] mb-4">
            Your portal doesn&apos;t own any sources yet.
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">
            Contact an administrator to assign sources to your portal.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg overflow-hidden"
            >
              {/* Source Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      source.isActive ? "bg-green-400" : "bg-[var(--muted)]"
                    }`}
                  />
                  <div>
                    <p className="font-mono text-sm text-[var(--cream)]">{source.name}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{source.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {source.sharingRule && (
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[0.6rem] uppercase ${
                        source.sharingRule.shareScope === "all"
                          ? "bg-green-500/20 text-green-400"
                          : source.sharingRule.shareScope === "selected"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-[var(--twilight)] text-[var(--muted)]"
                      }`}
                    >
                      {source.sharingRule.shareScope === "none" ? "Private" : source.sharingRule.shareScope}
                    </span>
                  )}
                  {(source.subscriberCount ?? 0) > 0 && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono text-[0.6rem]">
                      {source.subscriberCount} subscriber{(source.subscriberCount ?? 0) !== 1 ? "s" : ""}
                    </span>
                  )}
                  {editingSource !== source.id ? (
                    <button
                      onClick={() => startEditing(source)}
                      className="px-3 py-1 bg-[var(--night)] text-[var(--cream)] rounded font-mono text-xs hover:bg-[var(--twilight)]"
                    >
                      Edit Sharing
                    </button>
                  ) : (
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1 bg-[var(--night)] text-[var(--muted)] rounded font-mono text-xs hover:bg-[var(--twilight)]"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Editing Panel */}
              {editingSource === source.id && (
                <div className="p-4 border-t border-[var(--twilight)] bg-[var(--night)]">
                  <div className="space-y-4">
                    {/* Share Scope */}
                    <div>
                      <p className="font-mono text-xs text-[var(--muted)] mb-2">Sharing Scope</p>
                      <div className="flex gap-4">
                        {(["none", "all", "selected"] as const).map((scope) => (
                          <label key={scope} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={editShareScope === scope}
                              onChange={() => setEditShareScope(scope)}
                              className="w-4 h-4 accent-[var(--coral)]"
                            />
                            <span className="font-mono text-sm text-[var(--soft)]">
                              {scope === "none" && "Private"}
                              {scope === "all" && "Share All"}
                              {scope === "selected" && "Select Categories"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Category Selection */}
                    {editShareScope === "selected" && (
                      <div>
                        <p className="font-mono text-xs text-[var(--muted)] mb-2">
                          Categories to Share
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => toggleCategory(cat)}
                              className={`px-2 py-1 rounded font-mono text-xs transition-colors ${
                                editCategories.includes(cat)
                                  ? "bg-[var(--coral)] text-[var(--void)]"
                                  : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
                              }`}
                            >
                              {cat.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => saveSharing(source.id)}
                        disabled={saving}
                        className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded font-mono text-sm hover:opacity-90 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                      {source.sharingRule && (
                        <p className="font-mono text-xs text-[var(--muted)]">
                          Last updated:{" "}
                          {formatDistanceToNow(new Date(source.sharingRule.updatedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
        <h3 className="font-mono text-sm text-[var(--coral)] mb-2">Sharing Options</h3>
        <ul className="font-mono text-xs text-[var(--muted)] space-y-2">
          <li>
            <strong className="text-[var(--soft)]">Private:</strong> Only your portal can access events from this source
          </li>
          <li>
            <strong className="text-[var(--soft)]">Share All:</strong> Other portals can subscribe and receive all event categories
          </li>
          <li>
            <strong className="text-[var(--soft)]">Select Categories:</strong> Other portals can only subscribe to the categories you choose
          </li>
        </ul>
      </div>
    </div>
  );
}
