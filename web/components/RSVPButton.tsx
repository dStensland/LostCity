"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY, type Visibility } from "@/lib/visibility";
import type { Database } from "@/lib/types";
import Confetti from "./ui/Confetti";

export type RSVPStatus = "going" | "interested" | "went" | null;

type RSVPButtonProps = {
  eventId: number;
  size?: "sm" | "md";
  variant?: "default" | "compact" | "primary";
  className?: string;
  /** Callback when RSVP status changes successfully */
  onRSVPChange?: (newStatus: RSVPStatus, prevStatus: RSVPStatus) => void;
};

type RSVPRow = Database["public"]["Tables"]["event_rsvps"]["Row"];

const STATUS_CONFIG = {
  going: { label: "I'm in", icon: "check", color: "bg-[var(--coral)]" },
  interested: { label: "Maybe", icon: "star", color: "bg-[var(--gold)]" },
  went: { label: "Was there", icon: "check-double", color: "bg-[var(--lavender)]" },
};


export default function RSVPButton({
  eventId,
  size = "md",
  variant = "default",
  className = "",
  onRSVPChange,
}: RSVPButtonProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const supabase = createClient();
  const menuRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<RSVPStatus>(null);
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const statusOptions = (Object.keys(STATUS_CONFIG) as NonNullable<RSVPStatus>[]);
  const menuItemCount = statusOptions.length + (status ? 1 : 0); // +1 for "Remove RSVP"

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % menuItemCount);
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + menuItemCount) % menuItemCount);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (focusedIndex < statusOptions.length) {
            handleStatusChange(statusOptions[focusedIndex]);
          } else if (status) {
            handleStatusChange(null);
          }
          break;
        case "Escape":
          event.preventDefault();
          setMenuOpen(false);
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, focusedIndex, menuItemCount, statusOptions, status]);

  // Reset focus when menu opens
  useEffect(() => {
    if (menuOpen) {
      setFocusedIndex(0);
    }
  }, [menuOpen]);

  // Load existing RSVP
  useEffect(() => {
    let isMounted = true;

    async function loadRSVP() {
      // Wait for auth to settle
      if (authLoading) return;

      if (!user) {
        return;
      }

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<{ data: null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 5000)
        );

        const queryPromise = supabase
          .from("event_rsvps")
          .select("*")
          .eq("user_id", user.id)
          .eq("event_id", eventId)
          .maybeSingle();

        const { data } = await Promise.race([queryPromise, timeoutPromise]);

        if (!isMounted) return;

        const rsvp = data as RSVPRow | null;
        if (rsvp) {
          setStatus(rsvp.status as RSVPStatus);
          setVisibility(rsvp.visibility as Visibility);
        }
      } catch (err) {
        console.error("Failed to load RSVP:", err);
      }
    }

    loadRSVP();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, eventId, supabase]);

  const handleStatusChange = async (newStatus: RSVPStatus) => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setActionLoading(true);
    const previousStatus = status;

    // Trigger pop animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 150);

    // Trigger confetti for "going" status
    if (newStatus === "going" && status !== "going") {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 100);
    }

    // Optimistic update
    setStatus(newStatus);

    // Helper to add timeout to Supabase operations
    const withTimeout = <T,>(
      queryBuilder: PromiseLike<T>,
      ms: number = 10000
    ): Promise<T> => {
      return Promise.race([
        Promise.resolve(queryBuilder),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), ms)
        ),
      ]);
    };

    try {
      if (newStatus === null) {
        // Remove RSVP
        const result = await withTimeout(
          supabase
            .from("event_rsvps")
            .delete()
            .eq("user_id", user.id)
            .eq("event_id", eventId)
        );
        if ((result as { error?: unknown }).error) throw (result as { error: unknown }).error;
      } else if (previousStatus === null) {
        // Create new RSVP
        const result = await withTimeout(
          supabase.from("event_rsvps").insert({
            user_id: user.id,
            event_id: eventId,
            status: newStatus,
            visibility,
          } as never)
        );
        if ((result as { error?: unknown }).error) throw (result as { error: unknown }).error;
      } else {
        // Update existing RSVP
        const result = await withTimeout(
          supabase
            .from("event_rsvps")
            .update({ status: newStatus } as never)
            .eq("user_id", user.id)
            .eq("event_id", eventId)
        );
        if ((result as { error?: unknown }).error) throw (result as { error: unknown }).error;
      }
      setMenuOpen(false);

      // Notify parent of successful status change
      if (onRSVPChange) {
        onRSVPChange(newStatus, previousStatus);
      }
    } catch (error) {
      // Rollback on error
      setStatus(previousStatus);
      console.error("Failed to update RSVP:", error);
      const errMsg = (error as { message?: string })?.message || "Failed to save";
      showToast(errMsg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVisibilityChange = async (newVisibility: Visibility) => {
    if (!user || status === null) return;

    const previousVisibility = visibility;

    // Optimistic update
    setVisibility(newVisibility);

    try {
      const { error } = await supabase
        .from("event_rsvps")
        .update({ visibility: newVisibility } as never)
        .eq("user_id", user.id)
        .eq("event_id", eventId);
      if (error) throw error;
    } catch (error) {
      // Rollback on error
      setVisibility(previousVisibility);
      console.error("Failed to update visibility:", error);
      showToast("Failed to update visibility", "error");
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  // Variant-specific styles
  const getButtonClasses = () => {
    const baseClasses = "font-mono font-medium rounded-lg transition-all duration-150 flex items-center gap-2";
    const animationClass = isAnimating ? "scale-95" : "scale-100";

    if (variant === "compact") {
      // Icon-only button for sticky bar
      return `${baseClasses} w-11 h-11 justify-center border ${
        status
          ? `${currentConfig?.color} text-[var(--void)] border-transparent`
          : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border-[var(--twilight)]"
      } ${animationClass}`;
    }

    if (variant === "primary") {
      // Full-width primary button for sticky bar
      return `${baseClasses} px-6 py-3 ${
        status
          ? `${currentConfig?.color} text-[var(--void)]`
          : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
      } ${animationClass}`;
    }

    // Default variant
    return `${baseClasses} ${sizeClasses[size]} ${
      status
        ? `${currentConfig?.color} text-[var(--void)]`
        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
    } ${animationClass}`;
  };

  // No loading skeleton - show functional button immediately
  // Button works for logged-out users too (redirects to login on click)

  const currentConfig = status ? STATUS_CONFIG[status] : null;

  // Render button content based on variant
  const renderButtonContent = () => {
    if (actionLoading) {
      return <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
    }

    if (variant === "compact") {
      // Icon only - star for interest
      return status ? (
        <StatusIcon status={status} />
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    }

    if (variant === "primary") {
      return status ? (
        <>
          <StatusIcon status={status} />
          {currentConfig?.label}
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Show Interest
        </>
      );
    }

    // Default variant
    return status ? (
      <>
        <StatusIcon status={status} />
        {currentConfig?.label}
        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </>
    ) : (
      <>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Show Interest
      </>
    );
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <Confetti isActive={showConfetti} />
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        disabled={actionLoading}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={getButtonClasses()}
      >
        {renderButtonContent()}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          className={`absolute right-0 w-48 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-lg z-[1050] overflow-hidden ${
            variant === "compact" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Status Options */}
          <div className="p-1">
            {statusOptions.map((s, index) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                role="menuitem"
                tabIndex={focusedIndex === index ? 0 : -1}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs transition-colors ${
                  focusedIndex === index ? "ring-1 ring-[var(--coral)] ring-inset" : ""
                } ${
                  status === s
                    ? "bg-[var(--twilight)] text-[var(--cream)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]"
                }`}
              >
                <StatusIcon status={s} />
                {STATUS_CONFIG[s].label}
                {status === s && (
                  <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}

            {status && (
              <button
                onClick={() => handleStatusChange(null)}
                role="menuitem"
                tabIndex={focusedIndex === statusOptions.length ? 0 : -1}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs text-[var(--coral)] hover:bg-[var(--twilight)] transition-colors ${
                  focusedIndex === statusOptions.length ? "ring-1 ring-[var(--coral)] ring-inset" : ""
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                I&apos;m out
              </button>
            )}
          </div>

          {/* Visibility Options */}
          {status && (
            <>
              <div className="border-t border-[var(--twilight)]" />
              <div className="p-1">
                <div className="px-3 py-1 font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
                  Who can see
                </div>
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleVisibilityChange(opt.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs transition-colors ${
                      visibility === opt.value
                        ? "bg-[var(--twilight)] text-[var(--cream)]"
                        : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]"
                    }`}
                  >
                    <VisibilityIcon type={opt.icon} />
                    {opt.label}
                    {visibility === opt.value && (
                      <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: NonNullable<RSVPStatus> }) {
  switch (status) {
    case "going":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "interested":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    case "went":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function VisibilityIcon({ type }: { type: string }) {
  switch (type) {
    case "globe":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "users":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "lock":
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    default:
      return null;
  }
}
