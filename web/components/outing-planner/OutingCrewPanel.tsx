"use client";

import { useState, useCallback } from "react";
import { UserPlus, Check, X, Clock, PaperPlaneTilt } from "@phosphor-icons/react";
import { useItineraryCrew } from "@/lib/hooks/useItineraryCrew";
import { formatRsvpStatus } from "@/lib/itinerary-utils";
import type { ItineraryParticipant } from "@/lib/itinerary-utils";

interface OutingCrewPanelProps {
  itineraryId: string | null;
  isOwner: boolean;
}

function RsvpIcon({ status }: { status: string }) {
  switch (status) {
    case "going":
      return <Check size={12} weight="bold" className="text-[var(--coral)]" />;
    case "cant_go":
      return <X size={12} weight="bold" className="text-[var(--muted)]" />;
    default:
      return <Clock size={12} weight="bold" className="text-[var(--gold)]" />;
  }
}

function ParticipantRow({ participant }: { participant: ItineraryParticipant }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center overflow-hidden flex-shrink-0">
        {participant.avatar_url ? (
          <img
            src={participant.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xs font-medium text-[var(--soft)]">
            {(participant.display_name || participant.username || "?")[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)] font-medium truncate">
          {participant.display_name || participant.username || "Invited"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <RsvpIcon status={participant.rsvp_status} />
        <span
          className={`text-xs font-mono ${
            participant.rsvp_status === "going"
              ? "text-[var(--coral)]"
              : participant.rsvp_status === "cant_go"
                ? "text-[var(--muted)]"
                : "text-[var(--gold)]"
          }`}
        >
          {formatRsvpStatus(participant.rsvp_status)}
        </span>
      </div>
    </div>
  );
}

export default function OutingCrewPanel({
  itineraryId,
  isOwner,
}: OutingCrewPanelProps) {
  const { crew, loading, inviting, fetchCrew, invite } = useItineraryCrew(itineraryId);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);

  // Fetch crew on mount
  useState(() => {
    if (itineraryId) fetchCrew();
  });

  const handleInvite = useCallback(async () => {
    const value = inviteInput.trim();
    if (!value) return;
    setInviteError(null);

    // Determine if it's an email/phone (contact) or username search
    const isContact = value.includes("@") || /^\+?\d{10,}$/.test(value);

    const success = await invite(
      isContact
        ? { contact: value }
        : { user_id: value } // For now, pass as user_id — will need username lookup later
    );

    if (success) {
      setInviteInput("");
      setInvited(true);
      setTimeout(() => setInvited(false), 2000);
    } else {
      setInviteError("Couldn't send invite");
    }
  }, [inviteInput, invite]);

  if (!itineraryId) {
    return (
      <div className="text-center py-8">
        <UserPlus size={24} className="mx-auto text-[var(--muted)] mb-2" />
        <p className="text-sm text-[var(--muted)]">
          Add stops to your plan first, then invite friends
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with counts */}
      <div className="flex items-center gap-2">
        <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--coral)]">
          Crew
        </h3>
        {crew && crew.total > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-[var(--coral)]/10 font-mono text-2xs text-[var(--coral)]">
            {crew.going} / {crew.total}
          </span>
        )}
      </div>

      {/* Invite input — owner only */}
      {isOwner && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInvite();
            }}
            placeholder="Email or phone to invite..."
            className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteInput.trim()}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-mono font-medium shrink-0 transition-all ${
              invited
                ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)]"
                : "bg-[var(--coral)] text-[var(--void)] hover:brightness-110 disabled:opacity-50"
            }`}
          >
            {invited ? (
              <>
                <Check size={14} weight="bold" />
                Sent
              </>
            ) : (
              <>
                <PaperPlaneTilt size={14} weight="bold" />
                Invite
              </>
            )}
          </button>
        </div>
      )}

      {inviteError && (
        <p className="text-xs text-[var(--coral)] font-mono">{inviteError}</p>
      )}

      {/* Participant list */}
      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[var(--twilight)]" />
              <div className="flex-1 h-4 bg-[var(--twilight)] rounded" />
            </div>
          ))}
        </div>
      ) : crew && crew.total > 0 ? (
        <div className="divide-y divide-[var(--twilight)]/40">
          {crew.participants.map((p) => (
            <ParticipantRow key={p.id} participant={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-[var(--muted)]">
            {isOwner
              ? "No one invited yet — share the link or invite by email"
              : "No crew members yet"}
          </p>
        </div>
      )}
    </div>
  );
}
