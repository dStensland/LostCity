"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Buildings,
  Check,
  CheckCircle,
  Globe,
  HandHeart,
  MapPin,
  Minus,
  Plus,
  Users,
  X,
} from "@phosphor-icons/react";
import { usePortalInterestChannels, type PortalChannel } from "@/lib/hooks/usePortalInterestChannels";
import { useAuth } from "@/lib/auth-context";

// ─── Design tokens (light civic theme) ───────────────────────────────────────
const CIVIC = {
  BG: "#F5F4F1",
  CARD_BG: "#FFFFFF",
  BORDER: "#E5E4E1",
  TEXT_PRIMARY: "#1A1918",
  TEXT_SECONDARY: "#6D6C6A",
  TEXT_MUTED: "#9C9B99",
  GREEN: "#16A34A",
  GREEN_DARK: "#2D6A4F",
  GREEN_BG: "#DCFCE7",
  GREEN_BORDER: "#86EFAC",
  BLUE: "#1D4ED8",
  BLUE_BG: "#DBEAFE",
  BLUE_BORDER: "#93C5FD",
} as const;

// ─── Channel type metadata ────────────────────────────────────────────────────
const CHANNEL_TYPE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  jurisdiction: { label: "Jurisdiction", color: CIVIC.BLUE, bg: CIVIC.BLUE_BG, border: CIVIC.BLUE_BORDER, icon: Buildings },
  institution:  { label: "Institution",  color: "#7C3AED", bg: "#EDE9FE", border: "#C4B5FD", icon: Buildings },
  topic:        { label: "Topic",        color: "#B45309", bg: "#FEF3C7", border: "#FCD34D", icon: Globe },
  community:    { label: "Community",    color: "#0F766E", bg: "#CCFBF1", border: "#5EEAD4", icon: Users },
  intent:       { label: "Intent",       color: "#9D174D", bg: "#FCE7F3", border: "#F9A8D4", icon: HandHeart },
};

const TYPE_ORDER = ["jurisdiction", "institution", "topic", "community", "intent"] as const;

function getTypeMeta(channelType: string) {
  return CHANNEL_TYPE_META[channelType] ?? { label: channelType, color: CIVIC.TEXT_SECONDARY, bg: "#F3F4F6", border: "#D1D5DB", icon: Globe };
}

// ─── Prop types ───────────────────────────────────────────────────────────────
export interface CivicOnboardingProps {
  portalSlug: string;
  portalName: string;
  stats?: {
    meetingsThisMonth: number;
    volunteerOpportunities: number;
    upcomingDeadlines: number;
  };
  onComplete: () => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            backgroundColor: i === current ? CIVIC.GREEN : CIVIC.BORDER,
          }}
        />
      ))}
    </div>
  );
}

// ─── Channel card ─────────────────────────────────────────────────────────────
const ChannelCard = memo(function ChannelCard({
  channel,
  onToggle,
  isUpdating,
  isLoggedIn,
}: {
  channel: PortalChannel;
  onToggle: () => void;
  isUpdating: boolean;
  isLoggedIn: boolean;
}) {
  const meta = getTypeMeta(channel.channel_type);
  const TypeIcon = meta.icon;

  return (
    <div
      className="rounded-xl p-3.5 transition-all duration-150"
      style={{
        backgroundColor: channel.is_subscribed ? "#F0FDF4" : CIVIC.CARD_BG,
        border: `1px solid ${channel.is_subscribed ? CIVIC.GREEN_BORDER : CIVIC.BORDER}`,
        boxShadow: channel.is_subscribed ? `0 0 0 1px ${CIVIC.GREEN_BORDER}` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Type icon */}
          <div
            className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}
          >
            <TypeIcon size={14} color={meta.color} weight="duotone" />
          </div>
          {/* Content */}
          <div className="min-w-0">
            {/* Type badge */}
            <span
              className="inline-block rounded px-1.5 py-0.5 text-xs font-mono font-medium uppercase tracking-wide mb-1"
              style={{ backgroundColor: meta.bg, color: meta.color, fontSize: "0.625rem", letterSpacing: "0.1em" }}
            >
              {meta.label}
            </span>
            <p
              className="text-sm font-semibold leading-tight"
              style={{ color: CIVIC.TEXT_PRIMARY }}
            >
              {channel.name}
            </p>
            {channel.description && (
              <p
                className="mt-0.5 text-xs leading-relaxed line-clamp-2"
                style={{ color: CIVIC.TEXT_SECONDARY }}
              >
                {channel.description}
              </p>
            )}
          </div>
        </div>

        {/* Toggle button */}
        {isLoggedIn ? (
          <button
            onClick={onToggle}
            disabled={isUpdating}
            className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 disabled:opacity-60"
            style={
              channel.is_subscribed
                ? { backgroundColor: CIVIC.GREEN_BG, color: CIVIC.GREEN_DARK, border: `1px solid ${CIVIC.GREEN_BORDER}` }
                : { backgroundColor: "#F9FAFB", color: CIVIC.TEXT_SECONDARY, border: `1px solid ${CIVIC.BORDER}` }
            }
          >
            {isUpdating ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : channel.is_subscribed ? (
              <>
                <Check size={12} weight="bold" />
                <span>Joined</span>
              </>
            ) : (
              <>
                <Plus size={12} weight="bold" />
                <span>Join</span>
              </>
            )}
          </button>
        ) : (
          <div
            className="flex-shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
            style={{ color: CIVIC.TEXT_MUTED }}
          >
            <Minus size={12} />
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({
  portalName,
  stats,
  onNext,
  onSkip,
}: {
  portalName: string;
  stats?: CivicOnboardingProps["stats"];
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-8 flex-1">
      {/* Skip */}
      <div className="w-full flex justify-end mb-6">
        <button
          onClick={onSkip}
          className="text-xs font-mono flex items-center gap-1 transition-colors"
          style={{ color: CIVIC.TEXT_MUTED }}
        >
          Skip
          <X size={12} />
        </button>
      </div>

      {/* Logo mark */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: CIVIC.GREEN, boxShadow: `0 8px 24px ${CIVIC.GREEN}40` }}
      >
        <MapPin size={32} weight="fill" color="white" />
      </div>

      {/* Headline */}
      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ fontFamily: "Outfit, sans-serif", color: CIVIC.TEXT_PRIMARY }}
      >
        {portalName}
      </h1>
      <p
        className="text-base mb-8"
        style={{ color: CIVIC.TEXT_SECONDARY }}
      >
        Your civic companion for Atlanta
      </p>

      {/* Stats strip */}
      {stats && (
        <div
          className="w-full rounded-xl px-4 py-4 mb-8 flex items-center justify-around gap-2"
          style={{ backgroundColor: CIVIC.CARD_BG, border: `1px solid ${CIVIC.BORDER}` }}
        >
          <Stat value={stats.meetingsThisMonth} label="meetings this month" />
          <div style={{ width: 1, height: 32, backgroundColor: CIVIC.BORDER }} />
          <Stat value={stats.volunteerOpportunities} label="volunteer opportunities" />
          <div style={{ width: 1, height: 32, backgroundColor: CIVIC.BORDER }} />
          <Stat value={stats.upcomingDeadlines} label="upcoming deadlines" />
        </div>
      )}

      {/* What you get */}
      <div className="w-full space-y-2.5 mb-8 text-left">
        {[
          "Follow boards, commissions, and civic groups",
          "Get notified when meetings affect your neighborhood",
          "Track deadlines for public comment and applications",
        ].map((point) => (
          <div key={point} className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: CIVIC.GREEN_BG }}
            >
              <Check size={11} weight="bold" color={CIVIC.GREEN_DARK} />
            </div>
            <p className="text-sm" style={{ color: CIVIC.TEXT_SECONDARY }}>
              {point}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98]"
        style={{ backgroundColor: CIVIC.GREEN, boxShadow: `0 4px 14px ${CIVIC.GREEN}50` }}
      >
        Get Started
        <ArrowRight size={18} weight="bold" />
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-xl font-bold"
        style={{ fontFamily: "Outfit, sans-serif", color: CIVIC.TEXT_PRIMARY }}
      >
        {value}
      </span>
      <span
        className="text-xs text-center leading-tight"
        style={{ color: CIVIC.TEXT_MUTED, maxWidth: 72 }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Step 2: Pick groups ──────────────────────────────────────────────────────
function StepGroups({
  portalSlug,
  onNext,
  onSkip,
  onSubscribedCountChange,
}: {
  portalSlug: string;
  onNext: (count: number) => void;
  onSkip: () => void;
  onSubscribedCountChange: (count: number) => void;
}) {
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);

  const {
    orderedChannels,
    isLoading,
    error,
    updatingChannelId,
    subscribedCount,
    toggleSubscription,
  } = usePortalInterestChannels({
    portalSlug,
    trackingContext: {
      pageType: "community",
      sectionKey: "onboarding_groups",
      surface: "onboarding",
    },
  });

  // Notify parent of count changes for the Done step
  useEffect(() => {
    onSubscribedCountChange(subscribedCount);
  }, [subscribedCount, onSubscribedCountChange]);

  // Group channels by type in display order
  const channelsByType = useMemo(() => {
    const grouped = new Map<string, PortalChannel[]>();
    for (const type of TYPE_ORDER) {
      const group = orderedChannels.filter((c) => c.channel_type === type);
      if (group.length > 0) grouped.set(type, group);
    }
    // Any types not in TYPE_ORDER go last
    for (const channel of orderedChannels) {
      if (!TYPE_ORDER.includes(channel.channel_type as typeof TYPE_ORDER[number])) {
        const existing = grouped.get(channel.channel_type) ?? [];
        if (!existing.some((c) => c.id === channel.id)) {
          grouped.set(channel.channel_type, [...existing, channel]);
        }
      }
    }
    return grouped;
  }, [orderedChannels]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "Outfit, sans-serif", color: CIVIC.TEXT_PRIMARY }}
            >
              What do you care about?
            </h2>
            <p className="text-sm mt-1" style={{ color: CIVIC.TEXT_SECONDARY }}>
              Follow groups to personalize your feed
            </p>
          </div>
          <button
            onClick={onSkip}
            className="text-xs font-mono flex items-center gap-1 mt-1"
            style={{ color: CIVIC.TEXT_MUTED }}
          >
            Skip
            <X size={12} />
          </button>
        </div>

        {/* Subscribed count pill */}
        {subscribedCount > 0 && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: CIVIC.GREEN_BG, color: CIVIC.GREEN_DARK, border: `1px solid ${CIVIC.GREEN_BORDER}` }}
          >
            <Check size={11} weight="bold" />
            Following {subscribedCount} {subscribedCount === 1 ? "group" : "groups"}
          </div>
        )}

        {!isLoggedIn && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: "#FEF9C3", color: "#854D0E", border: "1px solid #FEF08A" }}
          >
            Sign in to save your groups. You can browse them now.
          </div>
        )}
      </div>

      {/* Scrollable channel list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl animate-pulse"
                style={{ backgroundColor: CIVIC.BORDER }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
          >
            {error}
          </div>
        ) : orderedChannels.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: CIVIC.TEXT_MUTED }}>
            No groups available yet.
          </div>
        ) : (
          Array.from(channelsByType.entries()).map(([type, channels]) => {
            const meta = getTypeMeta(type);
            return (
              <div key={type}>
                <p
                  className="font-mono text-xs font-bold uppercase tracking-widest mb-2.5"
                  style={{ color: meta.color }}
                >
                  {meta.label}s
                </p>
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      onToggle={() => void toggleSubscription(channel)}
                      isUpdating={updatingChannelId === channel.id}
                      isLoggedIn={isLoggedIn}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderTop: `1px solid ${CIVIC.BORDER}`, backgroundColor: CIVIC.BG }}
      >
        <button
          onClick={() => onNext(subscribedCount)}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98]"
          style={{ backgroundColor: CIVIC.GREEN }}
        >
          Continue
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Done ─────────────────────────────────────────────────────────────
function StepDone({
  subscribedCount,
  onComplete,
}: {
  subscribedCount: number;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-8 flex-1">
      {/* Checkmark */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: CIVIC.GREEN_BG, border: `2px solid ${CIVIC.GREEN_BORDER}` }}
      >
        <CheckCircle size={44} weight="fill" color={CIVIC.GREEN} />
      </div>

      <h2
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ fontFamily: "Outfit, sans-serif", color: CIVIC.TEXT_PRIMARY }}
      >
        {"You're all set!"}
      </h2>

      {subscribedCount > 0 ? (
        <p className="text-base mb-2" style={{ color: CIVIC.TEXT_SECONDARY }}>
          Following{" "}
          <span className="font-semibold" style={{ color: CIVIC.GREEN_DARK }}>
            {subscribedCount} {subscribedCount === 1 ? "group" : "groups"}
          </span>
        </p>
      ) : (
        <p className="text-base mb-2" style={{ color: CIVIC.TEXT_SECONDARY }}>
          Your civic feed is ready.
        </p>
      )}

      <p className="text-sm mb-10" style={{ color: CIVIC.TEXT_MUTED }}>
        {subscribedCount > 0
          ? "Your feed will surface meetings, votes, and deadlines from the groups you follow."
          : "You can follow groups anytime from the Groups tab."}
      </p>

      <button
        onClick={onComplete}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98]"
        style={{ backgroundColor: CIVIC.GREEN, boxShadow: `0 4px 14px ${CIVIC.GREEN}50` }}
      >
        Go to Feed
        <ArrowRight size={18} weight="bold" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const CivicOnboarding = memo(function CivicOnboarding({
  portalSlug,
  portalName,
  stats,
  onComplete,
}: CivicOnboardingProps) {
  const STORAGE_KEY = `civic_onboarding_${portalSlug}_completed`;

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [visible, setVisible] = useState(false);

  // Fade in on mount
  useEffect(() => {
    const rafId = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage may be unavailable
    }
    setVisible(false);
    // Wait for fade-out before calling onComplete
    setTimeout(onComplete, 200);
  }, [STORAGE_KEY, onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleSubscribedCountChange = useCallback((count: number) => {
    setSubscribedCount(count);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 transition-opacity duration-200"
        style={{
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleSkip}
      />

      {/* Panel */}
      <div
        className="fixed z-50 flex flex-col overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: CIVIC.BG,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
          // Mobile: full screen. Desktop: centered modal.
          inset: "0 0 0 0",
          // Override on desktop via max-w + centering trick below
        }}
      >
        {/* Inner container — mobile full-screen, desktop max-w-lg centered */}
        <div className="flex flex-col h-full sm:items-center sm:justify-center">
          <div
            className="flex flex-col overflow-hidden w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[90vh]"
            style={{
              backgroundColor: CIVIC.BG,
              height: "100%",
              // On sm+ let it shrink to content height
            }}
          >
            {/* Progress bar */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: `1px solid ${CIVIC.BORDER}` }}
            >
              <StepDots current={step} total={3} />
              <p className="font-mono text-xs" style={{ color: CIVIC.TEXT_MUTED }}>
                Step {step + 1} of 3
              </p>
            </div>

            {/* Step content */}
            <div className="flex flex-col flex-1 overflow-hidden relative">
              {/* Step 0 */}
              <div
                className="absolute inset-0 flex flex-col transition-all duration-300"
                style={{
                  opacity: step === 0 ? 1 : 0,
                  transform: step === 0 ? "translateX(0)" : step > 0 ? "translateX(-100%)" : "translateX(100%)",
                  pointerEvents: step === 0 ? "auto" : "none",
                }}
              >
                <StepWelcome
                  portalName={portalName}
                  stats={stats}
                  onNext={() => setStep(1)}
                  onSkip={handleSkip}
                />
              </div>

              {/* Step 1 */}
              <div
                className="absolute inset-0 flex flex-col transition-all duration-300"
                style={{
                  opacity: step === 1 ? 1 : 0,
                  transform: step === 1 ? "translateX(0)" : step > 1 ? "translateX(-100%)" : "translateX(100%)",
                  pointerEvents: step === 1 ? "auto" : "none",
                }}
              >
                {step >= 1 && (
                  <StepGroups
                    portalSlug={portalSlug}
                    onNext={(count) => {
                      setSubscribedCount(count);
                      setStep(2);
                    }}
                    onSkip={handleSkip}
                    onSubscribedCountChange={handleSubscribedCountChange}
                  />
                )}
              </div>

              {/* Step 2 */}
              <div
                className="absolute inset-0 flex flex-col transition-all duration-300"
                style={{
                  opacity: step === 2 ? 1 : 0,
                  transform: step === 2 ? "translateX(0)" : "translateX(100%)",
                  pointerEvents: step === 2 ? "auto" : "none",
                }}
              >
                {step === 2 && (
                  <StepDone
                    subscribedCount={subscribedCount}
                    onComplete={handleComplete}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export type { CivicOnboardingProps };
