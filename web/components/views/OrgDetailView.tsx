"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import { format, parseISO } from "date-fns";
import { formatTimeSplit } from "@/lib/formats";
import FollowButton from "@/components/FollowButton";
import RecommendButton from "@/components/RecommendButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import LinkifyText from "@/components/LinkifyText";
import Skeleton from "@/components/Skeleton";
import CollapsibleSection, { CategoryIcons, CATEGORY_COLORS } from "@/components/CollapsibleSection";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { InfoCard } from "@/components/detail/InfoCard";
import NeonBackButton from "@/components/detail/NeonBackButton";
import Badge from "@/components/ui/Badge";
import {
  CaretRight,
  Globe,
  InstagramLogo,
  Envelope,
  CalendarBlank,
} from "@phosphor-icons/react";

type ProducerData = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  city: string | null;
};

type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

type VolunteerOpportunityData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  commitment_level: "drop_in" | "ongoing" | "lead_role";
  time_horizon: "one_day" | "multi_week" | "multi_month" | "ongoing" | null;
  onboarding_level: "none" | "light" | "screening_required" | "training_required" | null;
  schedule_summary: string | null;
  location_summary: string | null;
  remote_allowed: boolean;
  background_check_required: boolean;
  training_required: boolean;
  application_url: string;
};

interface OrgDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

// Org type configuration
const ORG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  arts_nonprofit: { label: "Arts & Culture", color: "#C4B5FD" },
  film_society: { label: "Film", color: "#A5B4FC" },
  community_group: { label: "Community", color: "#6EE7B7" },
  running_club: { label: "Fitness", color: "#5EEAD4" },
  cultural_org: { label: "Cultural", color: "#FBBF24" },
  food_festival: { label: "Food & Drink", color: "#FDBA74" },
  venue: { label: "Venue", color: "#A78BFA" },
  festival: { label: "Festival", color: "#F9A8D4" },
};

function getDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return domain;
  } catch {
    return url;
  }
}

export default function OrgDetailView({ slug, portalSlug, onClose }: OrgDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [producer, setProducer] = useState<ProducerData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [volunteerOpportunities, setVolunteerOpportunities] = useState<VolunteerOpportunityData[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function fetchProducer() {
      setStatus("loading");
      setError(null);
      setImageLoaded(false);
      setImageError(false);

      const MAX_RETRIES = 2;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            if (cancelled) return;
          }
          activeController = new AbortController();
          const timeoutId = setTimeout(() => activeController?.abort(), 10000);
          const res = await fetch(`/api/organizations/by-slug/${slug}`, {
            signal: activeController.signal,
          });
          clearTimeout(timeoutId);
          if (cancelled) return;
          if (!res.ok) {
            if ((res.status === 503 || res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
              continue;
            }
            throw new Error(res.status === 404 ? "Organizer not found" : `Failed to load organizer (${res.status})`);
          }
          const data = await res.json();
          if (cancelled) return;
          setProducer(data.organization);
          setEvents(data.events || []);
          setVolunteerOpportunities(data.volunteer_opportunities || []);
          setStatus("ready");
          return;
        } catch (err) {
          if (activeController?.signal.aborted) return;
          if (cancelled) return;
          if (attempt === MAX_RETRIES) {
            setError(err instanceof Error ? err.message : "Failed to load organizer");
            setStatus("error");
          }
        }
      }
    }

    fetchProducer();

    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [slug]);

  const navigateToDetail = (param: string, value: string | number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set(param, String(value));
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  };

  const handleEventClick = (id: number) => navigateToDetail("event", id);

  const formatCommitmentLevel = (value: VolunteerOpportunityData["commitment_level"]) => {
    if (value === "lead_role") return "Lead";
    if (value === "ongoing") return "Ongoing";
    return "Drop-in";
  };

  const formatTimeHorizon = (value: VolunteerOpportunityData["time_horizon"]) => {
    if (value === "multi_month") return "Multi-month";
    if (value === "multi_week") return "Multi-week";
    if (value === "one_day") return "One day";
    if (value === "ongoing") return "Open-ended";
    return null;
  };

  const formatOnboarding = (value: VolunteerOpportunityData["onboarding_level"]) => {
    if (value === "screening_required") return "Screening required";
    if (value === "training_required") return "Training required";
    if (value === "light") return "Light onboarding";
    if (value === "none") return "No onboarding";
    return null;
  };

  if (status === "loading") {
    return (
      <div className="pt-6 pb-8" role="status" aria-label="Loading organization details">
        <NeonBackButton onClose={onClose} floating={false} />

        {/* Info card skeleton */}
        <div className="border border-[var(--twilight)] rounded-card p-6 bg-[var(--dusk)]">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <Skeleton className="w-20 h-20 rounded-xl flex-shrink-0" />

            {/* Name + type + neighborhood */}
            <div className="flex-1 min-w-0">
              <Skeleton className="h-6 w-[55%] rounded" delay="0.06s" />
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-5 w-20 rounded-md" delay="0.1s" />
                <Skeleton className="h-4 w-24 rounded" delay="0.12s" />
              </div>
            </div>

            {/* Follow/recommend */}
            <div className="flex gap-2 flex-shrink-0">
              <Skeleton className="w-9 h-9 rounded-lg" delay="0.14s" />
              <Skeleton className="w-9 h-9 rounded-lg" delay="0.16s" />
            </div>
          </div>

          {/* Description */}
          <div className="mt-5 pt-5 border-t border-[var(--twilight)]">
            <Skeleton className="h-3 w-12 rounded mb-3" delay="0.2s" />
            <Skeleton className="h-4 w-full rounded" delay="0.24s" />
            <Skeleton className="h-4 w-[85%] rounded mt-1.5" delay="0.26s" />
            <Skeleton className="h-4 w-[60%] rounded mt-1.5" delay="0.28s" />
          </div>

          {/* Category tags */}
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-lg" delay="0.32s" />
            <Skeleton className="h-6 w-24 rounded-lg" delay="0.34s" />
          </div>

          {/* Links */}
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" delay="0.38s" />
            <Skeleton className="h-8 w-24 rounded-lg" delay="0.4s" />
          </div>
        </div>

        {/* Events section skeleton */}
        <div className="mt-8">
          <Skeleton className="h-5 w-36 rounded mb-4" delay="0.46s" />
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-card" delay="0.5s" />
            <Skeleton className="h-20 w-full rounded-card" delay="0.54s" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !producer) {
    return (
      <div className="pt-6" role="alert">
        <NeonBackButton onClose={onClose} floating={false} />
        <div className="text-center py-12">
          <p className="text-[var(--muted)]">{error || "Organizer not found"}</p>
        </div>
      </div>
    );
  }

  const orgConfig = ORG_TYPE_CONFIG[producer.org_type];
  const orgAccent = orgConfig?.color || "var(--muted)";
  const orgAccentClass = createCssVarClass("--accent-color", orgAccent, "accent");
  const showLogo = producer.logo_url && !imageError;
  const primaryCategory = producer.categories?.[0];
  const categoryAccentClass = primaryCategory
    ? createCssVarClass("--accent-color", getCategoryColor(primaryCategory), "accent")
    : null;

  return (
    <div className={`pt-6 pb-8 ${orgAccentClass?.className ?? ""}`}>
      <ScopedStyles css={orgAccentClass?.css} />
      {/* Back button */}
      <NeonBackButton onClose={onClose} floating={false} />

      {/* Main info card */}
      <InfoCard className="!p-6">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            {showLogo ? (
              <div className="w-20 h-20 rounded-xl bg-[var(--cream)] flex items-center justify-center overflow-hidden relative">
                {!imageLoaded && (
                  <Skeleton className="absolute inset-0" />
                )}
                <Image
                  src={producer.logo_url!}
                  alt={producer.name}
                  width={80}
                  height={80}
                  className={`object-contain transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div
                className={`w-20 h-20 rounded-xl flex items-center justify-center ${
                  primaryCategory ? "bg-accent-20" : "bg-[var(--twilight)]"
                } ${categoryAccentClass?.className ?? ""}`}
              >
                <ScopedStyles css={categoryAccentClass?.css} />
                <CategoryIcon
                  type={producer.categories?.[0] || "community"}
                  size={40}
                  glow="subtle"
                />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--cream)]">
                  {producer.name}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {orgConfig?.color ? (
                    <Badge variant="accent" accentColor={orgConfig.color}>{orgConfig.label}</Badge>
                  ) : (
                    <Badge variant="neutral">{producer.org_type.replace(/_/g, " ")}</Badge>
                  )}
                  {producer.neighborhood && (
                    <span className="text-sm text-[var(--muted)]">
                      {producer.neighborhood}
                      {producer.city && producer.city !== "Atlanta" ? `, ${producer.city}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <FollowButton targetProducerId={producer.id} size="sm" />
                <RecommendButton organizationId={producer.id} size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {producer.description && (
          <div className="mt-5 pt-5 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
              About
            </h2>
            <p className="text-[var(--soft)] text-sm leading-relaxed whitespace-pre-wrap">
              <LinkifyText text={producer.description} />
            </p>
          </div>
        )}

        {/* Category tags */}
        {producer.categories && producer.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {producer.categories.map((cat) => {
              const color = getCategoryColor(cat);
              const tagAccentClass = createCssVarClass("--accent-color", color, "accent");
              return (
                <span
                  key={cat}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono uppercase tracking-widest bg-accent-15 text-accent ${tagAccentClass?.className ?? ""}`}
                >
                  <ScopedStyles css={tagAccentClass?.css} />
                  <CategoryIcon type={cat} size={12} />
                  {cat.replace(/_/g, " ")}
                </span>
              );
            })}
          </div>
        )}

        {/* Links */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {producer.website && (
            <a
              href={producer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
            >
              <Globe weight="light" className="w-4 h-4" aria-hidden="true" />
              {getDomainFromUrl(producer.website)}
            </a>
          )}
          {producer.instagram && (
            <a
              href={`https://instagram.com/${producer.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
            >
              <InstagramLogo weight="light" className="w-4 h-4" aria-hidden="true" />
              Instagram
            </a>
          )}
          {producer.email && (
            <a
              href={`mailto:${producer.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] hover:text-[var(--cream)] transition-colors text-sm focus-ring"
            >
              <Envelope weight="light" className="w-4 h-4" aria-hidden="true" />
              Email
            </a>
          )}
        </div>

      </InfoCard>

      {volunteerOpportunities.length > 0 && (
        <div className="mt-8">
          <CollapsibleSection
            title="Ongoing Opportunities"
            count={volunteerOpportunities.length}
            icon={CategoryIcons.events}
            accentColor={CATEGORY_COLORS.events}
            defaultOpen
          >
            <div className="space-y-2">
              {volunteerOpportunities.map((opportunity) => {
                const onboardingLabel = formatOnboarding(opportunity.onboarding_level);
                const timeHorizonLabel = formatTimeHorizon(opportunity.time_horizon);

                return (
                  <div
                    key={opportunity.id}
                    className="border border-[var(--twilight)] rounded-card bg-[var(--dusk)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge>{formatCommitmentLevel(opportunity.commitment_level)}</Badge>
                          {timeHorizonLabel && <Badge>{timeHorizonLabel}</Badge>}
                          {opportunity.remote_allowed && <Badge>Remote-friendly</Badge>}
                        </div>
                        <h3 className="text-[var(--cream)] font-medium">{opportunity.title}</h3>
                        <p className="text-sm text-[var(--muted)] mt-1">
                          {opportunity.summary || opportunity.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3 text-xs text-[var(--muted)]">
                          {opportunity.schedule_summary && <span>{opportunity.schedule_summary}</span>}
                          {opportunity.location_summary && <span>{opportunity.location_summary}</span>}
                          {onboardingLabel && <span>{onboardingLabel}</span>}
                          {opportunity.background_check_required && <span>Background check</span>}
                          {opportunity.training_required && <span>Training</span>}
                        </div>
                      </div>
                      <a
                        href={opportunity.application_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--coral)] hover:text-[var(--cream)] transition-colors"
                      >
                        Learn more
                        <CaretRight weight="bold" className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* Upcoming Events */}
      <div className="mt-8">
        {events.length > 0 ? (
          <CollapsibleSection
            title="Upcoming Events"
            count={events.length}
            icon={CategoryIcons.events}
            accentColor={CATEGORY_COLORS.events}
            defaultOpen={false}
          >
            <div className="space-y-2">
              {events.map((event) => {
                const dateObj = parseISO(event.start_date);
                const { time, period } = formatTimeSplit(event.start_time);

                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event.id)}
                    aria-label={`View ${event.title}`}
                    className="block w-full text-left p-4 border border-[var(--twilight)] rounded-card bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group focus-ring"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                          {event.title}
                        </h3>
                        <p className="text-sm text-[var(--muted)] mt-1">
                          {format(dateObj, "EEE, MMM d")}
                          {event.start_time && ` · ${time} ${period}`}
                        </p>
                        {event.venue && (
                          <p className="text-sm text-[var(--muted)] mt-0.5">
                            {event.venue.name}
                            {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
                          </p>
                        )}
                      </div>
                      <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" aria-hidden="true">
                        <CaretRight weight="bold" className="w-4 h-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleSection>
        ) : (
          <div className="py-8 text-center border border-[var(--twilight)] rounded-card bg-[var(--dusk)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <CalendarBlank weight="light" className="w-6 h-6 text-[var(--muted)]" aria-hidden="true" />
            </div>
            <p className="text-[var(--muted)] text-sm">No upcoming events</p>
            <p className="text-[var(--muted)] text-xs mt-1">
              Follow {producer.name} to get notified about new events
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
