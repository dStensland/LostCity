"use client";

import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY, type Visibility } from "@/lib/visibility";
import Lasers from "./ui/Lasers";
import Sparkles from "./ui/Sparkles";

export type RSVPStatus = "going" | "interested" | "went" | null;

type RSVPButtonProps = {
  eventId: number;
  size?: "sm" | "md";
  variant?: "default" | "compact" | "primary";
  className?: string;
  /** Callback when RSVP status changes successfully */
  onRSVPChange?: (newStatus: RSVPStatus, prevStatus: RSVPStatus) => void;
};

const STATUS_CONFIG = {
  going: { label: "I'm in", icon: "check", color: "bg-[var(--coral)]" },
  interested: { label: "Maybe", icon: "star", color: "bg-[var(--gold)]" },
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
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<RSVPStatus>(null);
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);
  const [actionLoading, setActionLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showLasers, setShowLasers] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const statusOptions = Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[];
  const menuItemCount = statusOptions.length + (status ? 1 : 0); // +1 for "Remove RSVP"

  const updateMenuPosition = useCallback(() => {
    if (!menuOpen) return;
    if (!buttonRef.current || !portalMenuRef.current) return;

    const triggerRect = buttonRef.current.getBoundingClientRect();
    const menuRect = portalMenuRef.current.getBoundingClientRect();
    // First paint after opening can report 0x0; we'll retry via rAF below.
    if (menuRect.width === 0 && menuRect.height === 0) return;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;

    // Right-align the menu with the button to match previous "right-0" behavior.
    let left = triggerRect.right - menuRect.width;
    if (left < margin) left = margin;
    if (left + menuRect.width > viewportW - margin) left = viewportW - menuRect.width - margin;

    const preferred: "top" | "bottom" = variant === "compact" ? "top" : "bottom";
    const topBottom = triggerRect.bottom + margin;
    const topTop = triggerRect.top - menuRect.height - margin;

    let top = preferred === "top" ? topTop : topBottom;

    // Flip if clipped.
    if (top < margin) top = topBottom;
    if (top + menuRect.height > viewportH - margin) top = topTop;

    // Clamp final.
    if (top < margin) top = margin;
    if (top + menuRect.height > viewportH - margin) top = Math.max(margin, viewportH - menuRect.height - margin);

    setMenuPos({ top, left });
  }, [menuOpen, variant]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // When the dropdown is portaled to <body>, we need to check both the anchor and the menu itself.
      if (buttonRef.current?.contains(target)) return;
      if (portalMenuRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
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

  // Position the portaled dropdown so it's never clipped by overflow-hidden containers (e.g. calendar cells).
  useLayoutEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, status, visibility, focusedIndex]);

  // Ensure we position correctly after the portal DOM is actually laid out.
  useEffect(() => {
    if (!menuOpen) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      updateMenuPosition();
      raf2 = window.requestAnimationFrame(() => updateMenuPosition());
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;

    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("resize", onScrollOrResize);
    // Capture scroll events from any scrollable parent.
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [menuOpen, updateMenuPosition]);

  // Load existing RSVP via API
  useEffect(() => {
    let isMounted = true;

    async function loadRSVP() {
      // Wait for auth to settle
      if (authLoading) return;

      if (!user) {
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`/api/rsvp?event_id=${eventId}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!isMounted) return;

        if (response.ok) {
          const { rsvp } = await response.json();
          if (rsvp) {
            setStatus(rsvp.status as RSVPStatus);
            setVisibility(rsvp.visibility as Visibility);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to load RSVP:", err);
        }
      }
    }

    loadRSVP();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, eventId]);

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

    // Trigger lasers for "going" status
    if (newStatus === "going" && status !== "going") {
      setShowLasers(true);
      setTimeout(() => setShowLasers(false), 100);
    }

    // Trigger sparkles for "maybe" status
    if (newStatus === "interested" && status !== "interested") {
      setShowSparkles(true);
      setTimeout(() => setShowSparkles(false), 100);
    }

    // Optimistic update
    setStatus(newStatus);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response: Response;

      if (newStatus === null) {
        // Remove RSVP
        response = await fetch(`/api/rsvp?event_id=${eventId}`, {
          method: "DELETE",
          signal: controller.signal,
        });
      } else {
        // Create or update RSVP
        response = await fetch("/api/rsvp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventId,
            status: newStatus,
            visibility,
          }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
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

      // Check for specific errors
      const err = error as { message?: string; code?: string };
      let errMsg = "Failed to save";

      if (err.code === "23503" || err.message?.includes("foreign key") || err.message?.includes("profiles")) {
        // Foreign key violation - user doesn't have a profile
        errMsg = "Please complete your profile setup first";
      } else if (err.message) {
        errMsg = err.message;
      }

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
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status,
          visibility: newVisibility,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update visibility");
      }
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
  const primarySizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
  };

  // Variant-specific styles
  const getButtonClasses = () => {
    const baseClasses = "font-mono font-medium rounded-xl transition-all duration-150 flex items-center gap-2 active:scale-[0.98]";
    const animationClass = isAnimating ? "scale-95" : "scale-100";

    if (variant === "compact") {
      // Icon-only button for sticky bar
      return `${baseClasses} w-11 h-11 justify-center border backdrop-blur-[2px] ${
        status
          ? `${currentConfig?.color} text-[var(--void)] border-transparent shadow-[0_0_12px_var(--cta-glow,rgba(255,107,122,0.25))]`
          : "bg-[var(--dusk)]/70 text-[var(--muted)] border-[var(--twilight)]/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))]"
      } ${animationClass}`;
    }

    if (variant === "primary") {
      // Full-width primary button for sticky bar
      return `${baseClasses} ${primarySizeClasses[size]} shadow-sm hover:shadow-md ${
        status
          ? `${currentConfig?.color} text-[var(--void)]`
          : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
      } ${animationClass}`;
    }

    // Default variant
    return `${baseClasses} ${sizeClasses[size]} ${
      status
        ? `${currentConfig?.color} text-[var(--void)] shadow-sm`
        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
    } ${animationClass}`;
  };

  // No loading skeleton - show functional button immediately
  // Button works for logged-out users too (redirects to login on click)

  const currentConfig = status && status in STATUS_CONFIG
    ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    : null;

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
      <Lasers isActive={showLasers} originRef={buttonRef} />
      <Sparkles isActive={showSparkles} originRef={buttonRef} />
      <button
        ref={buttonRef}
        onClick={(e) => {
          // Prevent parent cards/cells from treating this as a navigation click.
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        onMouseDown={(e) => {
          // Prevent document-level handlers in parent containers from immediately closing the menu.
          e.preventDefault();
          e.stopPropagation();
        }}
        disabled={actionLoading}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={getButtonClasses()}
      >
        {renderButtonContent()}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Transparent backdrop to capture clicks and avoid underlying card/cell navigation */}
            <div
              className="fixed inset-0 z-[9998]"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
              }}
            />
            <div
              ref={portalMenuRef}
              className="fixed w-48 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-lg z-[9999] overflow-hidden"
              style={{ top: menuPos.top, left: menuPos.left }}
              role="menu"
              aria-orientation="vertical"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Status Options */}
              <div className="p-1">
                {statusOptions.map((s, index) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStatusChange(s);
                    }}
                    disabled={actionLoading}
                    role="menuitem"
                    tabIndex={focusedIndex === index ? 0 : -1}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStatusChange(null);
                    }}
                    disabled={actionLoading}
                    role="menuitem"
                    tabIndex={focusedIndex === statusOptions.length ? 0 : -1}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs text-[var(--coral)] hover:bg-[var(--twilight)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleVisibilityChange(opt.value);
                        }}
                        disabled={actionLoading}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded font-mono text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
          </>,
          document.body
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
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
