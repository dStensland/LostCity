"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [step, setStep] = useState<"details" | "review" | "submitted">("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editRejectionReason, setEditRejectionReason] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

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

  useEffect(() => {
    if (!user) {
      router.push("/auth/login?redirect=/submit/org");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (!editId || !user) return;
    let isActive = true;
    setEditSubmissionId(editId);
    setEditLoading(true);

    fetch(`/api/submissions/${editId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isActive || !data?.submission) return;
        const submission = data.submission as {
          submission_type: string;
          status: string;
          rejection_reason: string | null;
          image_urls: string[] | null;
          data: ProducerSubmissionData;
        };

        if (!["organization", "producer"].includes(submission.submission_type)) {
          setError("This submission is not an organization.");
          return;
        }

        const orgData = submission.data;
        setName(orgData.name || "");
        setOrgType(orgData.org_type || "");
        setDescription(orgData.description || "");
        setWebsite(orgData.website || "");
        setEmail(orgData.email || "");
        setInstagram(orgData.instagram || "");
        setFacebook(orgData.facebook || "");
        setNeighborhood(orgData.neighborhood || "");
        setSelectedCategories(orgData.categories || []);
        setImageUrl(submission.image_urls?.[0] || null);
        setEditStatus(submission.status);
        setEditRejectionReason(submission.rejection_reason);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load submission for editing.");
      })
      .finally(() => {
        if (isActive) setEditLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [editId, user]);

  if (!user) {
    return null;
  }

  const buildOrgData = (): ProducerSubmissionData => ({
    name: name.trim(),
    org_type: orgType || undefined,
    description: description.trim() || undefined,
    website: website.trim() || undefined,
    email: email.trim() || undefined,
    instagram: instagram.trim() || undefined,
    facebook: facebook.trim() || undefined,
    neighborhood: neighborhood.trim() || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
  });

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Organization name is required");
      return;
    }

    setStep("review");
  };

  const submitOrg = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const isEditing = Boolean(editSubmissionId);
      const res = await fetch(isEditing ? `/api/submissions/${editSubmissionId}` : "/api/submissions", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? {
                data: buildOrgData(),
                image_urls: imageUrl ? [imageUrl] : undefined,
              }
            : {
                submission_type: "producer",
                data: buildOrgData(),
                image_urls: imageUrl ? [imageUrl] : undefined,
              }
        ),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit organization");
      }

      setStep("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit organization");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("details");
    setSubmitting(false);
    setError(null);
    setConfirmAccuracy(false);
    setName("");
    setOrgType("");
    setDescription("");
    setWebsite("");
    setEmail("");
    setInstagram("");
    setFacebook("");
    setNeighborhood("");
    setSelectedCategories([]);
    setImageUrl(null);
    setEditSubmissionId(null);
    setEditStatus(null);
    setEditRejectionReason(null);
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

        <div className="grid gap-4 mb-6">
          <div className="p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)]">
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              Review process
            </div>
            <p className="text-[var(--soft)] text-sm mt-2">
              New organizations are reviewed before appearing publicly. Helpful links speed up verification.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)]">
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              Track your status
            </div>
            <p className="text-[var(--soft)] text-sm mt-2">
              Visit your{" "}
              <Link href="/dashboard/submissions" className="text-[var(--coral)] hover:text-[var(--rose)]">
                submissions dashboard
              </Link>{" "}
              for updates or requests for edits.
            </p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
          {["Details", "Review", "Submit"].map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full border ${
                  (step === "details" && index === 0) ||
                  (step === "review" && index <= 1) ||
                  (step === "submitted" && index <= 2)
                    ? "border-[var(--coral)] text-[var(--coral)]"
                    : "border-[var(--twilight)]"
                }`}
              >
                {index + 1}. {label}
              </span>
              {index < 2 && <span className="text-[var(--twilight)]">—</span>}
            </div>
          ))}
        </div>

        {editSubmissionId && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)] text-[var(--soft)] font-mono text-xs">
            Editing submission {editSubmissionId.slice(0, 8)}… {editStatus ? `(${editStatus})` : ""}
            {editRejectionReason && (
              <div className="mt-2 text-[var(--muted)]">
                Feedback: {editRejectionReason}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
            {error}
          </div>
        )}

        {editLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : step === "submitted" ? (
          <div className="p-8 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
              Submission received
            </h2>
            <p className="text-[var(--soft)] mb-6">
              {editSubmissionId
                ? "Your updates were submitted. We’ll review them shortly."
                : "We’ll review your organization and publish it soon."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard/submissions"
                className="px-5 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:border-[var(--coral)] transition-colors"
              >
                View submissions
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-lg text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] transition-colors"
              >
                Submit another
              </button>
            </div>
          </div>
        ) : step === "review" ? (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
              <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">Review your submission</h2>
              <div className="space-y-3 text-sm text-[var(--soft)]">
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Name</span>
                  <span className="text-[var(--cream)]">{name || "—"}</span>
                </div>
                {orgType && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Type</span>
                    <span className="text-[var(--cream)]">{ORG_TYPES.find((t) => t.id === orgType)?.label || orgType}</span>
                  </div>
                )}
                {selectedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Categories</span>
                    <span className="text-[var(--cream)]">{selectedCategories.map((c) => c.replace("_", " ")).join(", ")}</span>
                  </div>
                )}
                {website && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Website</span>
                    <span className="text-[var(--cream)]">{website}</span>
                  </div>
                )}
                {email && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Email</span>
                    <span className="text-[var(--cream)]">{email}</span>
                  </div>
                )}
                {(instagram || facebook) && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Social</span>
                    <span className="text-[var(--cream)]">
                      {[instagram && `@${instagram.replace("@", "")}`, facebook].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {neighborhood && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Neighborhood</span>
                    <span className="text-[var(--cream)]">{neighborhood}</span>
                  </div>
                )}
                {description && (
                  <div className="pt-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Description</span>
                    <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{description}</p>
                  </div>
                )}
                {imageUrl && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Logo</span>
                    <span className="text-[var(--cream)]">Uploaded</span>
                  </div>
                )}
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-[var(--soft)]">
              <input
                type="checkbox"
                checked={confirmAccuracy}
                onChange={(e) => setConfirmAccuracy(e.target.checked)}
                className="mt-1"
              />
              I confirm this information is accurate and public.
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setConfirmAccuracy(false);
                }}
                className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={submitOrg}
                disabled={submitting || !confirmAccuracy}
                className="px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : editSubmissionId ? "Submit updates" : "Submit organization"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleReview} className="space-y-6">
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
              <p className="mt-2 text-[var(--muted)] font-mono text-xs">
                Official links help us confirm legitimacy and speed review.
              </p>
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
              <p className="mt-2 text-[var(--muted)] font-mono text-xs">
                Use a domain email when possible for faster verification.
              </p>
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
              <p className="mt-2 text-[var(--muted)] font-mono text-xs">
                A logo helps members recognize the organization in the directory.
              </p>
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
                Review submission
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
