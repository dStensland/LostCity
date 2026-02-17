"use client";

import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import Confetti from "@/components/ui/Confetti";

interface CelebrationToastProps {
  isActive: boolean;
  friendName: string;
  friendUsername: string;
  friendAvatar: string | null;
  onDismiss: () => void;
}

export function CelebrationToast({
  isActive,
  friendName,
  friendUsername,
  friendAvatar,
  onDismiss,
}: CelebrationToastProps) {
  const [show, setShow] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (!isActive) {
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [isActive, onDismiss]);

  if (!show) return null;

  return (
    <>
      {!reducedMotion && <Confetti isActive={isActive} duration={3000} />}
      <div className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none">
        <div
          className={`pointer-events-auto bg-[var(--dusk)] border border-[var(--coral)]/40 rounded-2xl shadow-2xl shadow-[var(--coral)]/20 p-6 max-w-sm mx-4 text-center ${
            reducedMotion ? "" : "animate-celebration-toast"
          }`}
        >
          {/* Merging avatars */}
          <div className="flex items-center justify-center -space-x-3 mb-4">
            <div className={`relative z-10 ${reducedMotion ? "" : "animate-slide-right"}`}>
              <UserAvatar
                src={null}
                name="You"
                size="lg"
                glow
              />
            </div>
            <div className={`relative z-20 ${reducedMotion ? "" : "animate-slide-left"}`}>
              <UserAvatar
                src={friendAvatar}
                name={friendName}
                size="lg"
                glow
              />
            </div>
          </div>

          {/* Connection line */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--coral)]" />
            <svg className="w-5 h-5 text-[var(--coral)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--coral)]" />
          </div>

          <h3 className="text-lg font-semibold text-[var(--cream)] mb-1">
            You&apos;re now friends!
          </h3>
          <p className="font-mono text-sm text-[var(--muted)]">
            You and <span className="text-[var(--coral)]">@{friendUsername}</span> are connected
          </p>

          <button
            onClick={() => {
              setShow(false);
              onDismiss();
            }}
            className="mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Awesome!
          </button>
        </div>
      </div>
    </>
  );
}
