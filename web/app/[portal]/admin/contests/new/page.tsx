"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";

type BestOfCategory = {
  id: string;
  slug: string;
  name: string;
};

type FormState = {
  categoryId: string;
  slug: string;
  title: string;
  prompt: string;
  description: string;
  startsAt: string;
  endsAt: string;
  coverImageUrl: string;
  accentColor: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export default function AdminNewContestPage({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();
  const router = useRouter();

  const [categories, setCategories] = useState<BestOfCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default: starts now, ends in 7 days
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const [form, setForm] = useState<FormState>({
    categoryId: "",
    slug: "",
    title: "",
    prompt: "",
    description: "",
    startsAt: toLocal(now),
    endsAt: toLocal(weekFromNow),
    coverImageUrl: "",
    accentColor: "#E855A0",
  });

  // Load categories
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/best-of?portal=${slug}`);
        if (res.ok) {
          const data = (await res.json()) as { categories?: BestOfCategory[] };
          const cats = data.categories ?? [];
          setCategories(cats);
          if (cats.length > 0 && !form.categoryId) {
            setForm((prev) => ({ ...prev, categoryId: cats[0].id }));
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const setField =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // Auto-generate slug from title
        if (key === "title") {
          const weekNum = `week-${Math.ceil((now.getDate()) / 7)}`;
          next.slug = slugify(value) + "-" + weekNum;
        }
        return next;
      });
      setError(null);
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId) {
      setError("Please select a category");
      return;
    }
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/portals/${portal.id}/contests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: form.categoryId,
          slug: form.slug || slugify(form.title),
          title: form.title.trim(),
          prompt: form.prompt.trim() || undefined,
          description: form.description.trim() || undefined,
          coverImageUrl: form.coverImageUrl.trim() || undefined,
          accentColor: form.accentColor.trim() || undefined,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        }),
      });

      const data = (await res.json()) as { contest?: { id: string }; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to create contest");
        return;
      }

      // Redirect to the edit page for the new contest
      router.push(`/${slug}/admin/contests/${data.contest?.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mb-6">
        <Link
          href={`/${slug}/admin`}
          className="hover:text-[var(--cream)] transition-colors"
        >
          {portal.name}
        </Link>
        <span className="opacity-40">/</span>
        <Link
          href={`/${slug}/admin/contests`}
          className="hover:text-[var(--cream)] transition-colors"
        >
          Contests
        </Link>
        <span className="opacity-40">/</span>
        <span className="text-[var(--soft)]">New</span>
      </nav>

      <h1 className="text-xl font-semibold text-[var(--cream)] mb-6">
        New Contest
      </h1>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg font-mono text-xs"
          style={{
            background: "rgba(255,107,122,0.1)",
            border: "1px solid rgba(255,107,122,0.3)",
            color: "var(--coral)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div
          className="p-5 rounded-xl space-y-5"
          style={{
            background: "var(--dusk)",
            border: "1px solid var(--twilight)",
          }}
        >
          {/* Category */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Category <span className="text-[var(--coral)]">*</span>
            </label>
            {loading ? (
              <div
                className="h-10 rounded-lg animate-pulse"
                style={{ background: "var(--night)" }}
              />
            ) : categories.length > 0 ? (
              <select
                value={form.categoryId}
                onChange={setField("categoryId")}
                required
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                No categories found. Create Best Of categories first.
              </p>
            )}
            <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1">
              Which Best Of category should this contest use?
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Title <span className="text-[var(--coral)]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={setField("title")}
              required
              maxLength={200}
              placeholder="Best Medium-Effort First Date"
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Slug
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={setField("slug")}
              maxLength={100}
              placeholder="best-medium-effort-first-date-week-1"
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
            <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1">
              Auto-generated from title. Used in the public URL.
            </p>
          </div>

          {/* The Question / Prompt */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              The Question
            </label>
            <textarea
              value={form.prompt}
              onChange={setField("prompt")}
              maxLength={500}
              rows={2}
              placeholder="Not too fancy, not too basic — where do you take someone you actually like?"
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={setField("description")}
              maxLength={2000}
              rows={3}
              placeholder="Optional longer description..."
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Start Date <span className="text-[var(--coral)]">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={setField("startsAt")}
                required
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                End Date <span className="text-[var(--coral)]">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={setField("endsAt")}
                required
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          </div>

          {/* Cover image + accent color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Cover Image URL
              </label>
              <input
                type="url"
                value={form.coverImageUrl}
                onChange={setField("coverImageUrl")}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={setField("accentColor")}
                  className="w-10 h-10 rounded-lg border border-[var(--twilight)] cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={form.accentColor}
                  onChange={setField("accentColor")}
                  maxLength={9}
                  placeholder="#E855A0"
                  className="flex-1 px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || categories.length === 0}
          className="w-full py-3 rounded-xl font-mono text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: "var(--coral)", color: "var(--void)" }}
        >
          {saving ? "Creating..." : "Create Contest (as Draft)"}
        </button>
        <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 text-center">
          Contest will be created in Draft status. Activate it from the edit page when ready.
        </p>
      </form>
    </div>
  );
}
