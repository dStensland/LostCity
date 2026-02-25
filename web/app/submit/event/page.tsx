"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import ImageUploader from "@/components/ImageUploader";
import VenueAutocomplete from "@/components/VenueAutocomplete";
import OrganizationAutocomplete from "@/components/OrganizationAutocomplete";
import { useAuth } from "@/lib/auth-context";
import type { EventSubmissionData, VenueSubmissionData } from "@/lib/types";
import { getLocalDateString } from "@/lib/formats";
import PageFooter from "@/components/PageFooter";

const EVENT_CATEGORIES = [
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "community", label: "Community" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "sports", label: "Sports" },
  { id: "fitness", label: "Fitness" },
  { id: "nightlife", label: "Nightlife" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "dance", label: "Dance" },
  { id: "outdoors", label: "Outdoors" },
  { id: "markets", label: "Markets" },
  { id: "other", label: "Other" },
];

const VENUE_TYPES = [
  { id: "bar", label: "Bar" },
  { id: "restaurant", label: "Restaurant" },
  { id: "club", label: "Club / Nightlife" },
  { id: "music_venue", label: "Music Venue" },
  { id: "theater", label: "Theater" },
  { id: "gallery", label: "Art Gallery" },
  { id: "museum", label: "Museum" },
  { id: "park", label: "Park / Outdoor" },
  { id: "community_center", label: "Community Center" },
  { id: "brewery", label: "Brewery / Taproom" },
  { id: "coffee_shop", label: "Coffee Shop" },
  { id: "other", label: "Other" },
];

type Step = "details" | "review" | "submitted";

export default function SubmitEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [step, setStep] = useState<Step>("details");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);
  const [approvedEventId, setApprovedEventId] = useState<number | null>(null);
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [editSubmissionId, setEditSubmissionId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [editRejectionReason, setEditRejectionReason] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [scanningPoster, setScanningPoster] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [posterScanned, setPosterScanned] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("");
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState("");
  const [recurrenceNotes, setRecurrenceNotes] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [venueMode, setVenueMode] = useState<"existing" | "new">("existing");
  const [selectedVenue, setSelectedVenue] = useState<{ id: number; name: string } | null>(null);
  const [existingVenueId, setExistingVenueId] = useState<number | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueWebsite, setVenueWebsite] = useState("");
  const [venueType, setVenueType] = useState("");

  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [existingOrganizationId, setExistingOrganizationId] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const minDate = useMemo(() => getLocalDateString(), []);

  useEffect(() => {
    if (!user) {
      router.push("/auth/login?redirect=/submit/event");
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
          data: EventSubmissionData;
        };

        if (submission.submission_type !== "event") {
          setError("This submission is not an event.");
          return;
        }

        const eventData = submission.data;
        setTitle(eventData.title || "");
        setDescription(eventData.description || "");
        setStartDate(eventData.start_date || "");
        setStartTime(eventData.start_time || "");
        setEndDate(eventData.end_date || "");
        setEndTime(eventData.end_time || "");
        setIsAllDay(Boolean(eventData.is_all_day));
        setSeriesTitle(eventData.series_title || "");
        const recurring = Boolean(eventData.recurrence_pattern || eventData.recurrence_notes || eventData.recurrence_ends_on);
        setIsRecurring(recurring);
        setRecurrencePattern(eventData.recurrence_pattern || "");
        setRecurrenceEndsOn(eventData.recurrence_ends_on || "");
        setRecurrenceNotes(eventData.recurrence_notes || "");
        setCategory(eventData.category || "");
        setTagsInput(eventData.tags?.join(", ") || "");
        setIsFree(Boolean(eventData.is_free));
        setPriceMin(eventData.price_min !== undefined && eventData.price_min !== null ? String(eventData.price_min) : "");
        setPriceMax(eventData.price_max !== undefined && eventData.price_max !== null ? String(eventData.price_max) : "");
        setPriceNote(eventData.price_note || "");
        setTicketUrl(eventData.ticket_url || "");
        setSourceUrl(eventData.source_url || "");
        setImageUrl(eventData.image_url || submission.image_urls?.[0] || null);

        if (eventData.venue_id) {
          setVenueMode("existing");
          setExistingVenueId(eventData.venue_id);
          setSelectedVenue(null);
        } else if (eventData.venue?.name) {
          setVenueMode("new");
          setVenueName(eventData.venue.name || "");
          setVenueAddress(eventData.venue.address || "");
          setVenueWebsite(eventData.venue.website || "");
          setVenueType(eventData.venue.venue_type || "");
        }

        if (eventData.organization_id) {
          setExistingOrganizationId(eventData.organization_id);
        }

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

  const buildVenueData = (): VenueSubmissionData | undefined => {
    if (venueMode === "existing" || !venueName.trim()) return undefined;
    return {
      name: venueName.trim(),
      address: venueAddress.trim() || undefined,
      website: venueWebsite.trim() || undefined,
      venue_type: venueType || undefined,
      city: "Atlanta",
      state: "GA",
    };
  };

  const buildEventData = (): EventSubmissionData => {
    const eventData: EventSubmissionData = {
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      start_time: isAllDay ? undefined : startTime || undefined,
      end_date: endDate || undefined,
      end_time: isAllDay ? undefined : endTime || undefined,
      is_all_day: isAllDay || undefined,
      series_title: seriesTitle.trim() || undefined,
      recurrence_pattern: isRecurring ? recurrencePattern.trim() || undefined : undefined,
      recurrence_ends_on: isRecurring ? recurrenceEndsOn || undefined : undefined,
      recurrence_notes: isRecurring ? recurrenceNotes.trim() || undefined : undefined,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      is_free: isFree || undefined,
      price_min: !isFree && priceMin ? Number(priceMin) : undefined,
      price_max: !isFree && priceMax ? Number(priceMax) : undefined,
      price_note: priceNote.trim() || undefined,
      ticket_url: ticketUrl.trim() || undefined,
      source_url: sourceUrl.trim() || undefined,
      image_url: imageUrl || undefined,
      organization_id: selectedOrg?.id ?? existingOrganizationId ?? undefined,
    };

    if (venueMode === "existing") {
      eventData.venue_id = selectedVenue?.id ?? existingVenueId ?? undefined;
    } else {
      eventData.venue = buildVenueData();
    }

    return eventData;
  };

  const validateForReview = () => {
    if (!title.trim()) return "Event title is required";
    if (!startDate) return "Event date is required";
    if (venueMode === "existing" && !selectedVenue && !existingVenueId) return "Please select a venue";
    if (venueMode === "new" && !venueName.trim()) return "Venue name is required";
    return null;
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicateWarning(null);

    const validationError = validateForReview();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStep("review");
  };

  const submitEvent = async (duplicateAcknowledged = false) => {
    setError(null);
    setDuplicateWarning(null);
    setSubmitting(true);

    try {
      const eventData = buildEventData();
      const isEditing = Boolean(editSubmissionId);
      const res = await fetch(isEditing ? `/api/submissions/${editSubmissionId}` : "/api/submissions", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing
            ? {
                data: eventData,
                image_urls: imageUrl ? [imageUrl] : undefined,
              }
            : {
                submission_type: "event",
                data: eventData,
                duplicate_acknowledged: duplicateAcknowledged || undefined,
                image_urls: imageUrl ? [imageUrl] : undefined,
              }
        ),
      });

      const result = await res.json();

      if (!editSubmissionId && res.status === 409) {
        setDuplicateWarning(result.warning || "Potential duplicate detected.");
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit event");
      }

      if (!editSubmissionId && result.autoApproved && result.approved_event_id) {
        setAutoApproved(true);
        setApprovedEventId(result.approved_event_id);
      }

      setStep("submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit event");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setIsAllDay(false);
    setSeriesTitle("");
    setIsRecurring(false);
    setRecurrencePattern("");
    setRecurrenceEndsOn("");
    setRecurrenceNotes("");
    setCategory("");
    setTagsInput("");
    setIsFree(false);
    setPriceMin("");
    setPriceMax("");
    setPriceNote("");
    setTicketUrl("");
    setSourceUrl("");
    setImageUrl(null);
    setVenueMode("existing");
    setSelectedVenue(null);
    setVenueName("");
    setVenueAddress("");
    setVenueWebsite("");
    setVenueType("");
    setSelectedOrg(null);
    setExistingVenueId(null);
    setExistingOrganizationId(null);
    setConfirmAccuracy(false);
    setDuplicateWarning(null);
    setAutoApproved(false);
    setApprovedEventId(null);
    setError(null);
    setEditSubmissionId(null);
    setEditStatus(null);
    setEditRejectionReason(null);
    setScanError(null);
    setScanningPoster(false);
    setPosterScanned(false);
    setStep("details");
  };

  const handlePosterScan = async (uploadedUrl: string) => {
    setImageUrl(uploadedUrl);
    setScanError(null);
    setScanningPoster(true);

    try {
      const res = await fetch("/api/extract/event-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: uploadedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422) {
          setScanError("This doesn't appear to be an event poster. You can still fill in the form manually.");
          return;
        }
        throw new Error(data.error || "Extraction failed");
      }

      const ext = data.extracted;
      if (ext.title) setTitle(ext.title);
      if (ext.start_date) setStartDate(ext.start_date);
      if (ext.start_time) setStartTime(ext.start_time);
      if (ext.category) setCategory(ext.category);
      if (ext.description) setDescription(ext.description);
      if (ext.is_free) setIsFree(ext.is_free);
      if (ext.price_note) setPriceNote(ext.price_note);

      // If venue name was extracted, pre-fill new venue fields
      if (ext.venue_name) {
        setVenueMode("new");
        setVenueName(ext.venue_name);
        if (ext.venue_address) setVenueAddress(ext.venue_address);
      }

      setPosterScanned(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to read poster");
    } finally {
      setScanningPoster(false);
    }
  };

  const venueSummary = venueMode === "existing"
    ? selectedVenue?.name || (existingVenueId ? `Venue #${existingVenueId}` : "Not selected")
    : venueName || "Not provided";

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/submit"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">
              Submit an Event
            </h1>
            <p className="text-[var(--muted)] font-mono text-xs mt-1">
              Fill in the details, review, then submit.
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
                : autoApproved
                  ? "Your event was auto-approved and is live now."
                  : "We’ll review your event and publish it soon."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {!editSubmissionId && autoApproved && approvedEventId && (
                <Link
                  href={`/events/${approvedEventId}`}
                  className="px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
                >
                  View Event
                </Link>
              )}
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
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Title</span>
                  <span className="text-[var(--cream)]">{title || "—"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Date</span>
                  <span className="text-[var(--cream)]">
                    {startDate || "—"} {isAllDay ? "(All day)" : startTime ? `at ${startTime}` : ""}
                  </span>
                </div>
                {endDate && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Ends</span>
                    <span className="text-[var(--cream)]">
                      {endDate} {isAllDay ? "" : endTime ? `at ${endTime}` : ""}
                    </span>
                  </div>
                )}
                {seriesTitle && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Series</span>
                    <span className="text-[var(--cream)]">{seriesTitle}</span>
                  </div>
                )}
                {isRecurring && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Recurring</span>
                    <span className="text-[var(--cream)]">
                      {recurrencePattern || "Recurring schedule"}
                      {recurrenceEndsOn ? ` (until ${recurrenceEndsOn})` : ""}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Venue</span>
                  <span className="text-[var(--cream)]">{venueSummary}</span>
                </div>
                {(selectedOrg || existingOrganizationId) && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Organization</span>
                    <span className="text-[var(--cream)]">
                      {selectedOrg?.name || `Organization #${existingOrganizationId}`}
                    </span>
                  </div>
                )}
                {category && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Category</span>
                    <span className="text-[var(--cream)]">{EVENT_CATEGORIES.find((c) => c.id === category)?.label || category}</span>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Tags</span>
                    <span className="text-[var(--cream)]">{tags.join(", ")}</span>
                  </div>
                )}
                {(ticketUrl || sourceUrl) && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Links</span>
                    <span className="text-[var(--cream)]">{ticketUrl || sourceUrl}</span>
                  </div>
                )}
                {imageUrl && (
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Poster</span>
                    <span className="text-[var(--cream)]">Uploaded</span>
                  </div>
                )}
                {description && (
                  <div className="pt-2">
                    <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Description</span>
                    <p className="text-[var(--soft)] mt-1 whitespace-pre-wrap">{description}</p>
                  </div>
                )}
              </div>
            </div>

            {!editSubmissionId && duplicateWarning && (
              <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500 text-orange-300 font-mono text-xs">
                {duplicateWarning} If this is a different event, you can submit anyway.
              </div>
            )}

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
                onClick={() => submitEvent(false)}
                disabled={submitting || !confirmAccuracy}
                className="px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting..." : editSubmissionId ? "Submit updates" : "Submit Event"}
              </button>
              {!editSubmissionId && duplicateWarning && (
                <button
                  type="button"
                  onClick={() => submitEvent(true)}
                  disabled={submitting || !confirmAccuracy}
                  className="px-6 py-2.5 rounded-lg border border-orange-400 text-orange-200 font-mono text-sm hover:bg-orange-400/10 transition-colors disabled:opacity-50"
                >
                  Submit anyway
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleReview} className="space-y-6">
            {/* Poster scan shortcut */}
            {!posterScanned && (
              <div className="p-5 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
                <div className="flex items-center gap-3 mb-3">
                  <svg className="w-6 h-6 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="text-[var(--cream)] font-medium text-sm">Have a poster or flyer?</p>
                    <p className="text-[var(--muted)] font-mono text-xs">Upload it and we&apos;ll fill in the details automatically.</p>
                  </div>
                </div>

                {scanningPoster ? (
                  <div className="flex items-center gap-3 py-4 justify-center">
                    <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[var(--soft)] font-mono text-sm">Reading poster...</span>
                  </div>
                ) : (
                  <ImageUploader
                    value={null}
                    onChange={(url) => {
                      if (url) handlePosterScan(url);
                    }}
                    placeholder="Drop a poster here, or click to upload"
                  />
                )}

                {scanError && (
                  <p className="mt-3 text-orange-300 font-mono text-xs">{scanError}</p>
                )}
              </div>
            )}

            {posterScanned && (
              <div className="p-4 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-[var(--cream)] font-mono text-sm">Poster scanned — review the details below and edit anything that needs fixing.</p>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              <div className="p-4 rounded-lg bg-[var(--void)]/60 border border-[var(--twilight)]">
                <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  What happens next
                </div>
                <p className="text-[var(--soft)] text-sm mt-2">
                  If you include a ticket link, source link, or poster, we can verify faster.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Event Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Spring Jazz Festival"
                maxLength={200}
                required
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={minDate}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={isAllDay}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[var(--soft)] font-mono text-xs">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
              />
              All day event
            </label>

            <div className="border-t border-[var(--twilight)] pt-6 space-y-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Series name (optional)
                </label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  placeholder="e.g., Jazz on the Patio"
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>

              <label className="flex items-center gap-2 text-[var(--soft)] font-mono text-xs">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                This event repeats on a schedule
              </label>

              {isRecurring && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                      Recurrence pattern
                    </label>
                    <input
                      type="text"
                      value={recurrencePattern}
                      onChange={(e) => setRecurrencePattern(e.target.value)}
                      placeholder="Every Friday, first Saturday, monthly, etc."
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                      Recurrence end date (optional)
                    </label>
                    <input
                      type="date"
                      value={recurrenceEndsOn}
                      onChange={(e) => setRecurrenceEndsOn(e.target.value)}
                      min={startDate || minDate}
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                      Recurrence notes
                    </label>
                    <textarea
                      value={recurrenceNotes}
                      onChange={(e) => setRecurrenceNotes(e.target.value)}
                      rows={2}
                      placeholder="Any extra details about the schedule"
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || minDate}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={isAllDay}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Venue *
              </label>
              <div className="flex flex-wrap gap-2 mb-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setVenueMode("existing")}
                  className={`px-3 py-1.5 rounded-full border transition-colors ${
                    venueMode === "existing"
                      ? "border-[var(--coral)] text-[var(--coral)]"
                      : "border-[var(--twilight)] text-[var(--muted)]"
                  }`}
                >
                  Search existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVenueMode("new");
                    setSelectedVenue(null);
                    setExistingVenueId(null);
                  }}
                  className={`px-3 py-1.5 rounded-full border transition-colors ${
                    venueMode === "new"
                      ? "border-[var(--coral)] text-[var(--coral)]"
                      : "border-[var(--twilight)] text-[var(--muted)]"
                  }`}
                >
                  Add new venue
                </button>
              </div>

              {venueMode === "existing" ? (
                <div className="space-y-2">
                  <VenueAutocomplete
                    value={selectedVenue}
                    onChange={(venue) => {
                      setSelectedVenue(venue);
                      if (venue) setExistingVenueId(null);
                    }}
                    placeholder="Search for a venue..."
                    required
                  />
                  {existingVenueId && !selectedVenue && (
                    <p className="text-[var(--muted)] font-mono text-xs">
                      Currently linked to venue #{existingVenueId}. Search to change it.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Venue name"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                  <input
                    type="text"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="Address (optional)"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      value={venueType}
                      onChange={(e) => setVenueType(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    >
                      <option value="">Venue type</option>
                      {VENUE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="url"
                    value={venueWebsite}
                    onChange={(e) => setVenueWebsite(e.target.value)}
                    placeholder="Venue website (optional)"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Organization (optional)
              </label>
              <OrganizationAutocomplete
                value={selectedOrg}
                onChange={(org) => {
                  setSelectedOrg(org);
                  if (org) setExistingOrganizationId(null);
                }}
                placeholder="Search for an organization..."
              />
              {existingOrganizationId && !selectedOrg && (
                <div className="mt-2 flex items-center gap-3 text-[var(--muted)] font-mono text-xs">
                  <span>Currently linked to organization #{existingOrganizationId}.</span>
                  <button
                    type="button"
                    onClick={() => setExistingOrganizationId(null)}
                    className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
                  >
                    Remove link
                  </button>
                </div>
              )}
              <p className="mt-2 text-[var(--muted)] font-mono text-xs">
                If it&apos;s an independent event, you can leave this blank.
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
              >
                <option value="">Select category</option>
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Tags (optional)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="jazz, outdoor, family-friendly"
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Share the details people should know..."
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Ticket URL
                </label>
                <input
                  type="url"
                  value={ticketUrl}
                  onChange={(e) => setTicketUrl(e.target.value)}
                  placeholder="https://tickets..."
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                  Source URL
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://event page..."
                  className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Pricing
              </label>
              <label className="flex items-center gap-2 text-[var(--soft)] font-mono text-xs mb-3">
                <input
                  type="checkbox"
                  checked={isFree}
                  onChange={(e) => setIsFree(e.target.checked)}
                />
                Free event
              </label>
              {!isFree && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="Min price"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="Max price"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                  <input
                    type="text"
                    value={priceNote}
                    onChange={(e) => setPriceNote(e.target.value)}
                    placeholder="Pricing note"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Poster / Image
              </label>
              <ImageUploader value={imageUrl} onChange={setImageUrl} />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/submit"
                className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
              >
                Review submission
              </button>
            </div>
          </form>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
