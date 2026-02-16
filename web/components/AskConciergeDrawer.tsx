"use client";

import { useState, useCallback } from "react";

type RequestType = "restaurant_reservation" | "activity_booking" | "transportation" | "custom";

const REQUEST_TYPES: Array<{
  id: RequestType;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
}> = [
  {
    id: "restaurant_reservation",
    label: "Restaurant",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
      </svg>
    ),
    placeholder: "e.g., Table for 2 at an Italian restaurant, 8pm Saturday",
  },
  {
    id: "activity_booking",
    label: "Activity",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    placeholder: "e.g., Tickets to tonight's comedy show at The Punchline",
  },
  {
    id: "transportation",
    label: "Transport",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
      </svg>
    ),
    placeholder: "e.g., Car to the airport at 6am Monday",
  },
  {
    id: "custom",
    label: "Other",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
      </svg>
    ),
    placeholder: "Tell us what you need...",
  },
];

interface AskConciergeDrawerProps {
  portalSlug: string;
  open: boolean;
  onClose: () => void;
}

export default function AskConciergeDrawer({
  portalSlug,
  open,
  onClose,
}: AskConciergeDrawerProps) {
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [details, setDetails] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [guestRoom, setGuestRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = REQUEST_TYPES.find((t) => t.id === requestType);

  const handleSubmit = useCallback(async () => {
    if (!requestType || !details.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/portals/${portalSlug}/concierge/requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_type: requestType,
            details: details.trim(),
            preferred_time: preferredTime || undefined,
            party_size: partySize,
            guest_contact: {
              name: guestName || undefined,
              room: guestRoom || undefined,
            },
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit request");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }, [portalSlug, requestType, details, preferredTime, partySize, guestName, guestRoom]);

  const handleClose = useCallback(() => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setRequestType(null);
      setDetails("");
      setPreferredTime("");
      setPartySize(2);
      setGuestName("");
      setGuestRoom("");
      setSubmitted(false);
      setError(null);
    }, 300);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-lg bg-[var(--bg-primary,#1a1a2e)] rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-5 flex-1 overflow-y-auto">
          {submitted ? (
            // Success state
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Request Submitted
              </h3>
              <p className="text-sm text-white/50 max-w-xs mx-auto">
                Our concierge team will be in touch shortly. You can check the
                status anytime.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white mb-1">
                Ask Concierge
              </h3>
              <p className="text-sm text-white/50 mb-4">
                What can we help you with?
              </p>

              {/* Request type selection */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {REQUEST_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setRequestType(type.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                      requestType === type.id
                        ? "border-[var(--accent,#f97316)] bg-[var(--accent,#f97316)]/10 text-white"
                        : "border-white/8 bg-white/3 text-white/50 hover:border-white/15"
                    }`}
                  >
                    {type.icon}
                    <span className="text-[10px] font-medium">{type.label}</span>
                  </button>
                ))}
              </div>

              {requestType && (
                <div className="space-y-3">
                  {/* Details */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1">
                      Details
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder={selectedType?.placeholder}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 resize-none"
                    />
                  </div>

                  {/* Conditional fields */}
                  {(requestType === "restaurant_reservation" ||
                    requestType === "activity_booking") && (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-white/50 mb-1">
                          Preferred Time
                        </label>
                        <input
                          type="text"
                          value={preferredTime}
                          onChange={(e) => setPreferredTime(e.target.value)}
                          placeholder="e.g., 8pm Saturday"
                          className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-white/50 mb-1">
                          Party
                        </label>
                        <select
                          value={partySize}
                          onChange={(e) => setPartySize(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 [color-scheme:dark]"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(
                            (n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Guest info */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-white/50 mb-1">
                        Name (optional)
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Guest name"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-white/50 mb-1">
                        Room #
                      </label>
                      <input
                        type="text"
                        value={guestRoom}
                        onChange={(e) => setGuestRoom(e.target.value)}
                        placeholder="e.g., 412"
                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-400">{error}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={!details.trim() || submitting}
                    className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
                      details.trim() && !submitting
                        ? "bg-[var(--accent,#f97316)] text-white hover:brightness-110"
                        : "bg-white/10 text-white/30 cursor-not-allowed"
                    }`}
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
