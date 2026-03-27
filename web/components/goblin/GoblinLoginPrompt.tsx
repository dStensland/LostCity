"use client";

import { useState, useEffect } from "react";

interface GoblinLoginPromptProps {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
}

export function GoblinLoginPrompt({ open, onClose, onSignIn }: GoblinLoginPromptProps) {
  const [visible, setVisible] = useState(false);
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Random flicker effect
      const interval = setInterval(() => {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 50 + Math.random() * 100);
      }, 2000 + Math.random() * 3000);
      return () => clearInterval(interval);
    } else {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-500 ${
        open ? "bg-black/90" : "bg-black/0 pointer-events-none"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Scanline overlay on entire backdrop */}
      {open && (
        <div
          className="fixed inset-0 pointer-events-none z-[51] opacity-[0.03]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.3) 2px, rgba(255,0,0,0.3) 4px)",
          }}
        />
      )}

      <div
        className={`relative max-w-md w-full transition-all duration-500 z-[52] ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-110"
        } ${flicker ? "opacity-70" : ""}`}
      >
        {/* The gif — big, dominating, bleeding edge */}
        <div className="relative">
          <img
            src="/goblin-day/youmustlogin.gif"
            alt=""
            className="w-full aspect-square object-cover"
            style={{
              filter: "contrast(1.2) brightness(0.9)",
              mixBlendMode: "lighten",
            }}
          />
          {/* Red vignette overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, transparent 40%, rgba(80,0,0,0.6) 100%)",
            }}
          />
          {/* Bottom fade to black for text */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background: "linear-gradient(to top, black 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Text + button overlaid on bottom of image */}
        <div className="bg-black px-6 pb-6 pt-2 -mt-1">
          <p
            className="font-mono text-lg text-red-500 text-center tracking-[0.3em] uppercase mb-1 animate-pulse"
            style={{ textShadow: "0 0 20px rgba(220,38,38,0.6), 0 0 40px rgba(220,38,38,0.3)" }}
          >
            You must login
          </p>
          <p
            className="font-mono text-xs text-zinc-600 text-center tracking-[0.4em] uppercase mb-6"
            style={{ textShadow: "0 0 8px rgba(100,0,0,0.4)" }}
          >
            also don&apos;t turn around
          </p>

          <button
            onClick={onSignIn}
            className="w-full py-3.5 bg-red-900/80 text-red-200 font-mono text-sm font-bold uppercase tracking-[0.25em] hover:bg-red-800 hover:text-white transition-all active:scale-95 border border-red-700/50 hover:border-red-500"
            style={{
              boxShadow: "0 0 30px rgba(185,28,28,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            SIGN IN
          </button>

          <button
            onClick={onClose}
            className="w-full mt-2 py-2 text-zinc-700 font-mono text-2xs uppercase tracking-[0.3em] hover:text-zinc-500 transition-colors"
          >
            nevermind
          </button>
        </div>

        {/* Corner decorations — occult feel */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-800/40" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-800/40" />
      </div>
    </div>
  );
}
