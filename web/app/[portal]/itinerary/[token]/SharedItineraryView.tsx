"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { useItineraryCrew } from "@/lib/hooks/useItineraryCrew";
import type { ItineraryItem, ItineraryCrew, ItineraryParticipant, StopStatus } from "@/lib/itinerary-utils";
import { formatRsvpStatus, getItemTitle, getParticipantStopStatus } from "@/lib/itinerary-utils";
import ItineraryTimeline from "@/components/itinerary/ItineraryTimeline";
import StopAvailabilityRow from "@/components/itinerary/StopAvailabilityRow";

interface SharedItineraryViewProps {
  itinerary: {
    id: string;
    title: string;
    date: string | null;
    description: string | null;
    items: ItineraryItem[];
    crew?: ItineraryCrew;
  };
  owner: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  portalName: string;
  portalSlug: string;
}

function CrewAvatars({ participants }: { participants: ItineraryParticipant[] }) {
  const going = participants.filter((p) => p.rsvp_status === "going");
  const pending = participants.filter((p) => p.rsvp_status === "pending");
  const shown = [...going, ...pending].slice(0, 5);
  const overflow = going.length + pending.length - shown.length;

  if (shown.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <div
            key={p.id}
            className="w-8 h-8 rounded-full border-2 border-[var(--night)] bg-[var(--twilight)] flex items-center justify-center overflow-hidden"
            title={p.display_name || p.username || "Invited"}
          >
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xs font-medium text-[var(--soft)]">
                {(p.display_name || p.username || "?")[0].toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full border-2 border-[var(--night)] bg-[var(--twilight)] flex items-center justify-center">
            <span className="text-2xs font-mono font-medium text-[var(--soft)]">
              +{overflow}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CrewSection({ crew }: { crew: ItineraryCrew }) {
  if (crew.total === 0) return null;

  return (
    <div className="border border-[var(--twilight)] rounded-card bg-[var(--night)] p-4">
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--coral)] mb-3">
        Who&apos;s In
      </h3>

      {/* Summary pills */}
      <div className="flex items-center gap-2 mb-4">
        {crew.going > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs text-[var(--coral)]">
            <span>&#10003;</span> {crew.going} going
          </span>
        )}
        {crew.pending > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/20 font-mono text-xs text-[var(--gold)]">
            {crew.pending} pending
          </span>
        )}
      </div>

      {/* Participant list */}
      <div className="space-y-2">
        {crew.participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--twilight)] flex items-center justify-center overflow-hidden flex-shrink-0">
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xs font-medium text-[var(--soft)]">
                  {(p.display_name || p.username || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-sm text-[var(--cream)] font-medium truncate">
              {p.display_name || p.username || "Invited"}
            </span>
            <span
              className={`ml-auto text-xs font-mono ${
                p.rsvp_status === "going"
                  ? "text-[var(--coral)]"
                  : p.rsvp_status === "cant_go"
                    ? "text-[var(--muted)]"
                    : "text-[var(--gold)]"
              }`}
            >
              {formatRsvpStatus(p.rsvp_status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SharedItineraryView({
  itinerary,
  owner,
  portalName,
  portalSlug,
}: SharedItineraryViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const { updateStops } = useItineraryCrew(itinerary.id);
  const [joinState, setJoinState] = useState<"idle" | "joining" | "joined" | "leaving" | "left">("idle");
  const [participantId, setParticipantId] = useState<string | null>(null);
  // Local stop overrides for optimistic UI
  const [localStops, setLocalStops] = useState<
    Record<string, { status: StopStatus; arrival_time: string | null; note: string | null }>
  >({});
  const hasCrew = itinerary.crew && itinerary.crew.total > 0;
  const ownerName = owner?.display_name || owner?.username;

  // Check if the current user is already in the crew
  const myParticipant = useMemo(() => {
    if (!user || !itinerary.crew) return null;
    return itinerary.crew.participants.find((p) => p.user_id === user.id) ?? null;
  }, [user, itinerary.crew]);

  const isAlreadyIn = !!myParticipant;
  const isOrganizer = !!(user && owner && itinerary.crew === undefined);
  const activeParticipantId = participantId || myParticipant?.id || null;

  const handleJoin = async () => {
    if (!user) {
      router.push(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }

    setJoinState("joining");
    const { data, error } = await authFetch<{ participant_id: string }>(
      `/api/itineraries/${itinerary.id}/join`,
      { method: "POST" }
    );

    if (!error && data) {
      setJoinState("joined");
      setParticipantId(data.participant_id);
    } else {
      setJoinState("idle");
    }
  };

  const handleLeave = async () => {
    if (!activeParticipantId) return;

    setJoinState("leaving");
    const { error } = await authFetch(
      `/api/itineraries/${itinerary.id}/participants/${activeParticipantId}/stops`,
      {
        method: "PATCH",
        body: { rsvp_status: "cant_go" },
      }
    );

    if (!error) {
      setJoinState("left");
    } else {
      setJoinState("joined");
    }
  };

  const handleStopUpdate = useCallback(
    (update: { item_id: string; status: StopStatus; arrival_time?: string; note?: string }) => {
      if (!activeParticipantId) return;

      // Optimistic local update
      setLocalStops((prev) => ({
        ...prev,
        [update.item_id]: {
          status: update.status,
          arrival_time: update.arrival_time ?? null,
          note: update.note ?? null,
        },
      }));

      // Send to API
      updateStops(activeParticipantId, [update]);
    },
    [activeParticipantId, updateStops]
  );

  const showJoinedState = (joinState === "joined" || isAlreadyIn) && joinState !== "left";
  const showLeftState = joinState === "left" || myParticipant?.rsvp_status === "cant_go";
  const showStopControls = showJoinedState && itinerary.items.length > 0;

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        {/* Portal branding */}
        <div className="mb-6">
          <Link
            href={`/${portalSlug}`}
            className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
          >
            {portalName}
          </Link>

          <h1 className="text-2xl font-semibold mt-2">{itinerary.title}</h1>

          {/* Owner + date line */}
          <div className="flex items-center gap-2 mt-2">
            {ownerName && (
              <span className="text-sm text-[var(--soft)]">
                by {ownerName}
              </span>
            )}
            {ownerName && itinerary.date && (
              <span className="text-[var(--muted)]">&middot;</span>
            )}
            {itinerary.date && (
              <span className="text-sm text-[var(--soft)]">
                {new Date(itinerary.date + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "short", month: "short", day: "numeric" }
                )}
              </span>
            )}
          </div>

          {itinerary.description && (
            <p className="text-sm text-[var(--soft)] mt-3 leading-relaxed">
              {itinerary.description}
            </p>
          )}

          {/* Crew avatar row */}
          {hasCrew && (
            <div className="mt-4">
              <CrewAvatars participants={itinerary.crew!.participants} />
            </div>
          )}
        </div>

        {/* Timeline */}
        <ItineraryTimeline items={itinerary.items} compact crew={itinerary.crew} />

        {/* Per-stop availability — shown after joining */}
        {showStopControls && (
          <div className="mt-6">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--coral)] mb-3">
              Your Stops
            </h3>
            <div className="space-y-2">
              {itinerary.items.map((item) => {
                // Merge server state with local optimistic state
                const serverStop = myParticipant
                  ? getParticipantStopStatus(myParticipant, item.id)
                  : { status: "joining" as StopStatus, arrival_time: null, note: null };
                const local = localStops[item.id];
                const currentStatus = local?.status ?? serverStop.status;
                const currentArrival = local?.arrival_time ?? serverStop.arrival_time;
                const currentNote = local?.note ?? serverStop.note;

                return (
                  <StopAvailabilityRow
                    key={item.id}
                    itemId={item.id}
                    stopTitle={getItemTitle(item)}
                    status={currentStatus}
                    arrivalTime={currentArrival}
                    note={currentNote}
                    onUpdate={handleStopUpdate}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Crew section */}
        {hasCrew && (
          <div className="mt-6">
            <CrewSection crew={itinerary.crew!} />
          </div>
        )}

        {/* Sticky bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--twilight)] bg-[var(--void)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
            <Link
              href={`/${portalSlug}`}
              className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
            >
              Explore {portalName}
            </Link>
            {!isOrganizer && (
              <>
                {showJoinedState ? (
                  <>
                    <button
                      className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg font-mono text-sm font-medium bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/20"
                      disabled
                    >
                      <Check size={16} weight="bold" />
                      You&apos;re In
                    </button>
                    <button
                      className="min-h-[44px] px-4 flex items-center justify-center rounded-lg font-mono text-xs text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--coral)]/10 border border-[var(--twilight)] transition-colors"
                      onClick={handleLeave}
                      disabled={joinState === "leaving"}
                    >
                      {joinState === "leaving" ? "..." : "Can\u2019t Go"}
                    </button>
                  </>
                ) : (
                  <button
                    className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg font-mono text-sm font-medium transition-all ${
                      showLeftState
                        ? "bg-[var(--twilight)] text-[var(--muted)] border border-[var(--twilight)]"
                        : "bg-[var(--coral)] text-[var(--void)] hover:brightness-110"
                    }`}
                    onClick={handleJoin}
                    disabled={joinState === "joining"}
                  >
                    {showLeftState ? (
                      "Rejoin"
                    ) : joinState === "joining" ? (
                      "Joining..."
                    ) : (
                      "I\u2019m In"
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
