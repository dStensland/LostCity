"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

type Portal = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  owner_type: string | null;
  owner_id: string | null;
  status: "draft" | "active" | "archived";
  visibility: "public" | "unlisted" | "private";
  filters: Record<string, unknown>;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  }>;
  member_count: number;
  content_count: number;
  section_count: number;
  created_at: string;
  updated_at: string;
};

export default function EditPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [branding, setBranding] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadPortal();
  }, [id]);

  async function loadPortal() {
    try {
      const res = await fetch(`/api/admin/portals/${id}`);
      if (!res.ok) throw new Error("Portal not found");
      const data = await res.json();
      setPortal(data.portal);
      setName(data.portal.name);
      setTagline(data.portal.tagline || "");
      setStatus(data.portal.status);
      setVisibility(data.portal.visibility);
      setFilters(data.portal.filters || {});
      setBranding(data.portal.branding || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/portals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tagline: tagline || null,
          status,
          visibility,
          filters,
          branding,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSuccess("Portal updated successfully");
      loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this portal? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/portals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      router.push("/admin/portals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm mb-4">{error || "Portal not found"}</p>
          <Link href="/admin/portals" className="text-[var(--coral)] font-mono text-sm hover:underline">
            Back to Portals
          </Link>
        </div>
      </div>
    );
  }

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
          <Link href="/admin/portals" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]">
            Portals
          </Link>
          <Link href={`/portal/${portal.slug}`} className="font-mono text-xs text-[var(--coral)] hover:opacity-80" target="_blank">
            View Live
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-2xl text-[var(--cream)] italic">{portal.name}</h1>
            <p className="font-mono text-xs text-[var(--muted)]">/{portal.slug} · {portal.portal_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded font-mono text-xs ${
              status === "active" ? "bg-green-400/20 text-green-400" :
              status === "draft" ? "bg-yellow-400/20 text-yellow-400" :
              "bg-[var(--twilight)] text-[var(--muted)]"
            }`}>
              {status}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-400/10 border border-green-400/30 rounded">
            <p className="text-green-400 font-mono text-sm">{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
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

          {/* Filters */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Filters</h2>
            <p className="font-mono text-xs text-[var(--soft)] mb-4">
              Define what events appear in this portal. For city portals, set the city name.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">City</label>
                <input
                  type="text"
                  value={(filters.city as string) || ""}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                  placeholder="Atlanta"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Categories (comma-separated)</label>
                <input
                  type="text"
                  value={Array.isArray(filters.categories) ? (filters.categories as string[]).join(", ") : ""}
                  onChange={(e) => {
                    const cats = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                    setFilters({ ...filters, categories: cats.length ? cats : undefined });
                  }}
                  placeholder="music, art, food_drink"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
          </section>

          {/* Branding */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Branding</h2>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Logo URL</label>
                <input
                  type="text"
                  value={(branding.logo_url as string) || ""}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value || undefined })}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Primary Color</label>
                <input
                  type="text"
                  value={(branding.primary_color as string) || ""}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value || undefined })}
                  placeholder="#E87B6B"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Stats</h2>
            <div className="grid grid-cols-3 gap-4">
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
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            {portal.slug !== "atlanta" && (
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
      </main>
    </div>
  );
}
