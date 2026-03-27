"use client";

import { useState, useEffect } from "react";

interface GoblinLoginPromptProps {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
}

export function GoblinLoginPrompt({ open, onClose, onSignIn }: GoblinLoginPromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        open ? "bg-black/80 backdrop-blur-sm" : "bg-black/0 pointer-events-none"
      }`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative bg-black border-2 border-red-800 max-w-sm w-full p-6 transition-all duration-300 ${
          open
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95"
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-600 hover:text-red-400 font-mono text-xs transition-colors"
        >
          ✕
        </button>

        {/* Creepy gif */}
        <div className="flex justify-center mb-4">
          <img
            src="/goblin-day/youmustlogin.gif"
            alt="You must login"
            className="w-48 h-48 object-cover border border-red-900/50"
          />
        </div>

        {/* Message */}
        <p className="font-mono text-sm text-red-400 text-center tracking-wider uppercase mb-1">
          You must login to do stuff
        </p>
        <p className="font-mono text-xs text-zinc-500 text-center tracking-widest uppercase mb-6">
          also don&apos;t turn around
        </p>

        {/* Sign in button */}
        <button
          onClick={onSignIn}
          className="w-full py-3 bg-red-900 text-red-100 font-mono text-sm font-bold uppercase tracking-[0.2em] hover:bg-red-800 hover:shadow-[0_0_20px_rgba(185,28,28,0.4)] transition-all active:scale-95 border border-red-700"
        >
          SIGN IN
        </button>
      </div>
    </div>
  );
}
