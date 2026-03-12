"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import type { BestOfContest } from "@/lib/best-of-contests";

// ─── Types ────────────────────────────────────────────────────────────────────

type BestOfCategory = {
  id: string;
  slug: string;
  name: string;
};

type ContestStats = {
  totalVotes: number;
  venueCount: number;
  caseCount: number;
  timeRemaining: string;
};

type FormState = {
  title: string;
  prompt: string;
  description: string;
  startsAt: string;
  endsAt: string;
  coverImageUrl: string;
  accentColor: string;
  categoryId: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDatetimeLocal(isoStr: string): string {
  if (!isoStr) return "";
  // Format: "YYYY-MM-DDTHH:mm" (no seconds, local time interpretation)
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(localStr: string): string {
  if (!localStr) return "";
  return new Date(localStr).toISOString();
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  BestOfContest["status"],
  { label: string; bg: string; color: string; border: string }
> = {
  draft: { label: "Draft", bg: "rgba(255,255,255,0.06)", color: "#888", border: "#3A3A45" },
  active: { label: "Active", bg: "rgba(0,217,160,0.12)", color: "#00D9A0", border: "rgba(0,217,160,0.25)" },
  completed: { label: "Completed", bg: "rgba(0,212,232,0.12)", color: "#00D4E8", border: "rgba(0,212,232,0.25)" },
  archived: { label: "Archived", bg: "rgba(255,255,255,0.04)", color: "#555", border: "#2A2A35" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminContestEditPage({
  params,
}: {
  params: Promise<{ portal: string; contestId: string }>;
}) {
  const { portal: slug, contestId } = use(params);
  const { portal } = usePortal();

  const [contest, setContest] = useState<BestOfContest | null>(null);
  const [categories, setCategories] = useState<BestOfCategory[]>([]);
  const [stats, setStats] = useState<ContestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: "",
    prompt: "",
    description: "",
    startsAt: "",
    endsAt: "",
    coverImageUrl: "",
    accentColor: "#E855A0",
    categoryId: "",
  });

  // Load contest + categories
  useEffect(() => {
    async function load() {
      try {
        const [contestRes, categoriesRes] = await Promise.all([
          fetch(`/api/admin/portals/${portal.id}/contests/${contestId}`),
          fetch(`/api/best-of?portal=${slug}`),
        ]);

        if (!contestRes.ok) {
          const data = await contestRes.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? "Contest not found");
          setLoading(false);
          return;
        }

        const contestData = await contestRes.json() as { contest: BestOfContest };
        const c = contestData.contest;
        setContest(c);
        setForm({
          title: c.title,
          prompt: c.prompt ?? "",
          description: c.description ?? "",
          startsAt: toDatetimeLocal(c.startsAt),
          endsAt: toDatetimeLocal(c.endsAt),
          coverImageUrl: c.coverImageUrl ?? "",
          accentColor: c.accentColor ?? "#E855A0",
          categoryId: c.categoryId,
        });

        if (categoriesRes.ok) {
          const catData = await categoriesRes.json() as { categories?: BestOfCategory[] };
          setCategories(catData.categories ?? []);
        }
      } catch {
        setError("Failed to load contest");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [portal.id, contestId, slug]);

  // Load stats when contest is active
  const loadStats = useCallback(async () => {
    if (!contest || contest.status !== "active") return;
    try {
      const res = await fetch(
        `/api/contests/${contest.slug}?portal=${slug}`
      );
      if (!res.ok) return;
      const data = await res.json() as {
        venues?: { voteCount: number; caseCount?: number }[];
        totalVotes?: number;
        timeRemaining?: string;
      };
      const venues = data.venues ?? [];
      const totalVotes: number = data.totalVotes ?? 0;
      const venueCount = venues.length;
      const caseCount = venues.reduce<number>((sum, v) => sum + (v.caseCount ?? 0), 0);
      setStats({
        totalVotes,
        venueCount,
        caseCount,
        timeRemaining: data.timeRemaining ?? "",
      });
    } catch {
      // Non-critical — stats panel is informational only
    }
  }, [contest, slug]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── Form field helpers ─────────────────────────────────────────────────────

  const setField = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError(null);
    setSuccessMessage(null);
  };

  // ─── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contest) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(
        `/api/admin/portals/${portal.id}/contests/${contest.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim() || undefined,
            prompt: form.prompt.trim() || null,
            description: form.description.trim() || null,
            coverImageUrl: form.coverImageUrl.trim() || null,
            accentColor: form.accentColor.trim() || null,
            startsAt: form.startsAt ? fromDatetimeLocal(form.startsAt) : undefined,
            endsAt: form.endsAt ? fromDatetimeLocal(form.endsAt) : undefined,
          }),
        }
      );

      const data = await res.json() as { contest?: BestOfContest; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        return;
      }

      if (data.contest) {
        setContest(data.contest);
      }
      setSuccessMessage("Changes saved");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  // ─── Status transitions ───────────────────────────────────────────────────

  const changeStatus = async (newStatus: BestOfContest["status"] | "complete") => {
    if (!contest) return;
    setStatusChanging(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (newStatus === "complete") {
        // Use the dedicated complete endpoint
        const res = await fetch(
          `/api/admin/portals/${portal.id}/contests/${contest.id}/complete`,
          { method: "POST" }
        );
        const data = await res.json() as { contest?: BestOfContest; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to complete contest");
          return;
        }
        if (data.contest) setContest(data.contest);
        setSuccessMessage("Contest completed and winner announced");
      } else {
        const res = await fetch(
          `/api/admin/portals/${portal.id}/contests/${contest.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }
        );
        const data = await res.json() as { contest?: BestOfContest; error?: string };
        if (!res.ok) {
          setError(data.error ?? "Failed to update status");
          return;
        }
        if (data.contest) setContest(data.contest);
        setSuccessMessage(`Contest status updated to ${newStatus}`);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setStatusChanging(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-64 rounded-lg" style={{ background: "var(--dusk)" }} />
        <div className="h-64 rounded-lg" style={{ background: "var(--dusk)" }} />
      </div>
    );
  }

  if (error && !contest) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div
          className="p-4 rounded-lg"
          style={{
            background: "rgba(255,107,122,0.1)",
            border: "1px solid rgba(255,107,122,0.3)",
          }}
        >
          <p className="font-mono text-sm text-[var(--coral)]">{error}</p>
        </div>
      </div>
    );
  }

  if (!contest) return null;

  const badge = STATUS_BADGE[contest.status];
  const isActive = contest.status === "active";
  const isDraft = contest.status === "draft";
  const isCompleted = contest.status === "completed";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mb-6">
        <Link href={`/${slug}/admin`} className="hover:text-[var(--cream)] transition-colors">
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
        <span className="text-[var(--soft)]">Edit</span>
      </nav>

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--cream)] mb-1">
            {contest.title}
          </h1>
          <p className="font-mono text-xs text-[var(--muted)]">
            {formatDate(contest.startsAt)} → {formatDate(contest.endsAt)}
          </p>
        </div>
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold"
          style={{
            background: badge.bg,
            color: badge.color,
            border: `1px solid ${badge.border}`,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Toast messages */}
      {successMessage && (
        <div
          className="mb-4 p-3 rounded-lg font-mono text-xs"
          style={{
            background: "rgba(0,217,160,0.1)",
            border: "1px solid rgba(0,217,160,0.25)",
            color: "#00D9A0",
          }}
        >
          {successMessage}
        </div>
      )}
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

      {/* Live stats panel (active only) */}
      {isActive && stats && (
        <div
          className="mb-6 p-4 rounded-xl grid grid-cols-4 gap-4"
          style={{
            background: "var(--dusk)",
            border: "1px solid var(--twilight)",
          }}
        >
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-[var(--cream)]">
              {stats.totalVotes}
            </p>
            <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mt-0.5">
              Votes
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-[var(--cream)]">
              {stats.venueCount}
            </p>
            <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mt-0.5">
              Venues
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-[var(--cream)]">
              {stats.caseCount}
            </p>
            <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mt-0.5">
              Cases
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-sm font-bold text-[var(--coral)]">
              {stats.timeRemaining}
            </p>
            <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mt-0.5">
              Remaining
            </p>
          </div>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div
          className="p-5 rounded-xl space-y-5"
          style={{ background: "var(--dusk)", border: "1px solid var(--twilight)" }}
        >
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Contest Details
          </h2>

          {/* Category (read-only — changing category after creation isn't allowed) */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Category
            </label>
            {categories.length > 0 ? (
              <select
                value={form.categoryId}
                disabled
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--muted)] cursor-not-allowed"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={contest.categoryId}
                disabled
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--muted)] cursor-not-allowed"
              />
            )}
            <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1">
              Category cannot be changed after creation
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
              placeholder="Best Rooftop Bar in Atlanta"
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
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
              placeholder="Which rooftop makes you forget it all?"
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
            <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1">
              Shown in italics under the title
            </p>
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
              placeholder="Optional longer description about this contest..."
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

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl font-mono text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: "var(--coral)", color: "var(--void)" }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Status controls */}
      <div
        className="mt-6 p-5 rounded-xl space-y-4"
        style={{ background: "var(--dusk)", border: "1px solid var(--twilight)" }}
      >
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Status Controls
        </h2>

        <div className="space-y-3">
          {isDraft && (
            <div>
              <button
                onClick={() => changeStatus("active")}
                disabled={statusChanging}
                className="w-full py-3 rounded-xl font-mono text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: "rgba(0,217,160,0.12)",
                  border: "1px solid rgba(0,217,160,0.3)",
                  color: "#00D9A0",
                }}
              >
                {statusChanging ? "Activating..." : "Activate Contest"}
              </button>
              <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1.5 text-center">
                Makes the contest public and accepts votes. Only one active contest per portal.
              </p>
            </div>
          )}

          {isActive && (
            <div>
              <button
                onClick={() => changeStatus("complete")}
                disabled={statusChanging}
                className="w-full py-3 rounded-xl font-mono text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: "rgba(0,212,232,0.1)",
                  border: "1px solid rgba(0,212,232,0.25)",
                  color: "#00D4E8",
                }}
              >
                {statusChanging ? "Processing..." : "End & Announce Winner"}
              </button>
              <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1.5 text-center">
                Locks votes, computes final ranking, and saves winner snapshot.
              </p>
            </div>
          )}

          {isCompleted && contest.winnerSnapshot && (
            <div
              className="p-4 rounded-lg"
              style={{
                background: "rgba(255,215,0,0.06)",
                border: "1px solid rgba(255,215,0,0.15)",
              }}
            >
              <p className="font-mono text-xs font-bold text-[var(--cream)] mb-1">
                Winner: {contest.winnerSnapshot.name}
              </p>
              <p className="font-mono text-[10px] text-[var(--muted)]">
                {contest.winnerSnapshot.voteCount} votes ·{" "}
                {contest.winnerSnapshot.totalScore} total score ·{" "}
                announced {new Date(contest.winnerAnnouncedAt!).toLocaleDateString()}
              </p>
            </div>
          )}

          {(isCompleted || isActive) && (
            <div>
              <button
                onClick={() => changeStatus("archived")}
                disabled={statusChanging}
                className="w-full py-2.5 rounded-xl font-mono text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid #2A2A35",
                  color: "#666",
                }}
              >
                {statusChanging ? "Archiving..." : "Archive"}
              </button>
              <p className="font-mono text-[10px] text-[var(--muted)] opacity-60 mt-1.5 text-center">
                Hides from public. Irreversible.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Public contest link */}
      <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--night)", border: "1px solid var(--twilight)" }}>
        <p className="font-mono text-xs text-[var(--muted)] mb-1">Public URL</p>
        <Link
          href={`/${slug}/contests/${contest.slug}`}
          className="font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity break-all"
          target="_blank"
        >
          /{slug}/contests/{contest.slug}
        </Link>
      </div>
    </div>
  );
}
