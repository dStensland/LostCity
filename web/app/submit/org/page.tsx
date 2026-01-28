"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import ImageUploader from "@/components/ImageUploader";
import { useAuth } from "@/lib/auth-context";
import type { ProducerSubmissionData } from "@/lib/types";

const ORG_TYPES = [
  { id: "arts_nonprofit", label: "Arts Nonprofit" },
  { id: "film_society", label: "Film Society" },
  { id: "cultural_org", label: "Cultural Organization" },
  { id: "community_group", label: "Community Group" },
  { id: "running_club", label: "Running / Fitness Club" },
  { id: "food_festival", label: "Food Festival / Organizer" },
  { id: "music_collective", label: "Music Collective" },
  { id: "theater_company", label: "Theater Company" },
  { id: "event_producer", label: "Event Producer" },
  { id: "other", label: "Other" },
];

const CATEGORIES = [
  "music",
  "art",
  "comedy",
  "theater",
  "film",
  "food_drink",
  "community",
  "fitness",
  "family",
  "learning",
];

export default function SubmitOrgPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  if (!user) {
    router.push("/auth/login?redirect=/submit/org");
    return null;
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!name.trim()) {
      setError("Organization name is required");
      setSubmitting(false);
      return;
    }

    const data: ProducerSubmissionData = {
      name: name.trim(),
      org_type: orgType || undefined,
      description: description.trim() || undefined,
      website: website.trim() || undefined,
      email: email.trim() || undefined,
      instagram: instagram.trim() || undefined,
      facebook: facebook.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    };

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "producer",
          data,
          image_urls: imageUrl ? [imageUrl] : undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit organization");
      }

      router.push("/dashboard/submissions?success=org");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit organization");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/submit"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">
            Add an Organization
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's this organization called?"
              required
              maxLength={200}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Organization Type
            </label>
            <select
              value={orgType}
              onChange={(e) => setOrgType(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
            >
              <option value="">Select type</option>
              {ORG_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about this organization..."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-mono text-xs transition-colors ${
                    selectedCategories.includes(cat)
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] border border-[var(--twilight)] hover:border-[var(--coral)]"
                  }`}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Contact Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@organization.com"
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Instagram
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Facebook
              </label>
              <input
                type="text"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="facebook.com/..."
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Neighborhood / Area
            </label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g., Midtown, Decatur"
              className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Logo / Image
            </label>
            <ImageUploader value={imageUrl} onChange={setImageUrl} />
          </div>

          <div className="flex gap-3 pt-4">
            <Link
              href="/submit"
              className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Organization"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
