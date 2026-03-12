"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MapPin, CalendarDots, Users, CaretRight } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";

type PlanVenue = {
  id: number;
  name: string;
  slug: string | null;
  image_url: string | null;
  neighborhood: string | null;
};

type PlanEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
};

type PlanItem = {
  id: string;
  title: string;
  sort_order: number;
  event_id: number | null;
  venue_id: number | null;
  note: string | null;
  start_time: string | null;
  event: PlanEvent | null;
  venue: PlanVenue | null;
};

type PlanParticipant = {
  id: string;
  status: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type PlanCreator = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface SharedPlanViewProps {
  plan: {
    id: string;
    title: string;
    description: string | null;
    plan_date: string;
    plan_time: string | null;
    status: string;
    visibility: string;
    created_at: string;
    creator: PlanCreator;
    items: PlanItem[];
    participants: PlanParticipant[];
  };
  portalSlug: string;
  portalName: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function StopCard({ item, index }: { item: PlanItem; index: number }) {
  const venue = item.venue;
  const event = item.event;
  const image = venue?.image_url || event?.image_url;
  const name = venue?.name || event?.title || item.title;
  const subtitle = venue?.neighborhood || (event?.start_time ? formatTime(event.start_time) : null);

  return (
    <div className="flex gap-3 items-start">
      {/* Timeline marker */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className="w-7 h-7 rounded-full bg-[var(--coral)]/15 border border-[var(--coral)]/30 flex items-center justify-center">
          <span className="text-2xs font-mono font-bold text-[var(--coral)]">{index + 1}</span>
        </div>
        <div className="w-px flex-1 bg-[var(--twilight)]/60 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40">
          {image && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--twilight)] relative">
              <Image src={image} alt={name} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--cream)] leading-tight">{name}</p>
            {subtitle && (
              <p className="text-xs text-[var(--soft)] mt-0.5 flex items-center gap-1">
                <MapPin weight="fill" className="w-3 h-3 text-[var(--muted)]" />
                {subtitle}
              </p>
            )}
            {item.start_time && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {formatTime(item.start_time)}
              </p>
            )}
            {item.note && (
              <p className="text-xs text-[var(--muted)] mt-1 italic">{item.note}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharedPlanView({
  plan,
  portalSlug,
  portalName,
}: SharedPlanViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);

  const creatorName = plan.creator.display_name || plan.creator.username;
  const sortedItems = [...plan.items].sort((a, b) => a.sort_order - b.sort_order);
  const goingCount = plan.participants.filter((p) => p.status === "accepted" || p.status === "going").length;
  const hasVenueImages = plan.items.some((i) => i.venue?.image_url);

  // Hero image — first venue with an image
  const heroImage = plan.items.find((i) => i.venue?.image_url)?.venue?.image_url
    || plan.items.find((i) => i.event?.image_url)?.event?.image_url;

  const handleJoin = useCallback(async () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [user.id] }),
      });
      if (res.ok) {
        // Redirect to the plan page where they can interact
        router.push(`/${portalSlug}/plans/${plan.id}`);
      }
    } catch {
      // Silently fail — they can retry
    }
    setJoining(false);
  }, [user, plan.id, portalSlug, router]);

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      {/* Hero */}
      {heroImage && (
        <div className="relative h-48 sm:h-64 w-full overflow-hidden">
          <Image
            src={heroImage}
            alt={plan.title}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/60 to-transparent" />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pb-28" style={{ marginTop: heroImage ? "-3rem" : "0" }}>
        {/* Portal branding */}
        <div className={heroImage ? "relative z-10" : "pt-8"}>
          <Link
            href={`/${portalSlug}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
          >
            {portalName}
            <CaretRight weight="bold" className="w-2.5 h-2.5" />
          </Link>
        </div>

        {/* Plan header */}
        <div className="mt-3 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{plan.title}</h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* Creator */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--twilight)]">
                {plan.creator.avatar_url ? (
                  <Image
                    src={plan.creator.avatar_url}
                    alt={creatorName}
                    width={24}
                    height={24}
                    sizes="24px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xs font-bold text-[var(--muted)]">
                    {creatorName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-sm text-[var(--soft)]">{creatorName}</span>
            </div>

            <span className="text-[var(--muted)]">&middot;</span>

            {/* Date */}
            <div className="flex items-center gap-1.5 text-sm text-[var(--soft)]">
              <CalendarDots weight="duotone" className="w-4 h-4 text-[var(--gold)]" />
              {formatDate(plan.plan_date)}
              {plan.plan_time && ` at ${formatTime(plan.plan_time)}`}
            </div>
          </div>

          {plan.description && (
            <p className="text-sm text-[var(--soft)] leading-relaxed">{plan.description}</p>
          )}

          {/* Social proof */}
          {(goingCount > 0 || plan.participants.length > 0) && (
            <div className="flex items-center gap-3">
              {/* Participant avatars */}
              <div className="flex -space-x-1.5">
                {plan.participants.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="w-7 h-7 rounded-full border-2 border-[var(--void)] bg-[var(--twilight)] flex items-center justify-center overflow-hidden"
                    title={p.user.display_name || p.user.username}
                  >
                    {p.user.avatar_url ? (
                      <Image
                        src={p.user.avatar_url}
                        alt=""
                        width={28}
                        height={28}
                        sizes="28px"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xs font-medium text-[var(--soft)]">
                        {(p.user.display_name || p.user.username || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {goingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs text-[var(--coral)]">
                  <Users weight="fill" className="w-3 h-3" />
                  {goingCount} going
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        {sortedItems.length > 0 && (
          <div className="mt-8">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)] mb-4">
              The Plan — {sortedItems.length} {sortedItems.length === 1 ? "stop" : "stops"}
            </h2>
            <div>
              {sortedItems.map((item, i) => (
                <StopCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Empty stops state */}
        {sortedItems.length === 0 && (
          <div className="mt-8 p-6 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] text-center">
            <p className="text-sm text-[var(--soft)]">
              {creatorName} is still adding stops to this plan
            </p>
          </div>
        )}

        {/* Venue gallery — only if multiple venues with images */}
        {hasVenueImages && sortedItems.filter((i) => i.venue?.image_url).length > 1 && (
          <div className="mt-8">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)] mb-3">
              Where You&apos;ll Go
            </h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
              {sortedItems
                .filter((i) => i.venue?.image_url)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 w-36 snap-start rounded-xl overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40"
                  >
                    <div className="relative h-24">
                      <Image
                        src={item.venue!.image_url!}
                        alt={item.venue!.name}
                        fill
                        sizes="144px"
                        className="object-cover"
                      />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-[var(--cream)] truncate">{item.venue!.name}</p>
                      {item.venue!.neighborhood && (
                        <p className="text-2xs text-[var(--muted)] truncate mt-0.5">{item.venue!.neighborhood}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sticky bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--twilight)] bg-[var(--void)]/95 backdrop-blur-sm z-40">
          <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
            <Link
              href={`/${portalSlug}`}
              className="flex-1 min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
            >
              Explore {portalName}
            </Link>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
            >
              {joining ? "Joining..." : user ? "I\u2019m In" : "Sign Up to Join"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
