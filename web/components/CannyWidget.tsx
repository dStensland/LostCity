"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const BOARD_TOKEN = "a061ee84-f6bf-3a78-bab6-f28a78ebc912";

declare global {
  interface Window {
    Canny?: (...args: unknown[]) => void;
  }
}

export default function CannyWidget() {
  const [open, setOpen] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const rendered = useRef(false);
  const scriptLoading = useRef(false);

  // Load Canny SDK only when user opens the panel
  const loadCannySdk = useCallback(() => {
    if (scriptLoading.current || window.Canny) {
      if (window.Canny) setSdkReady(true);
      return;
    }
    scriptLoading.current = true;
    const script = document.createElement("script");
    script.src = "https://sdk.canny.io/sdk.js";
    script.id = "canny-jssdk";
    script.async = true;
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, []);

  const renderBoard = useCallback(() => {
    if (window.Canny && !rendered.current) {
      window.Canny("render", {
        boardToken: BOARD_TOKEN,
        basePath: null,
        ssoToken: null,
        theme: "dark",
      });
      rendered.current = true;
    }
  }, []);

  // Render the board when panel opens and SDK is ready
  useEffect(() => {
    if (open && sdkReady) {
      const t = setTimeout(renderBoard, 100);
      return () => clearTimeout(t);
    }
  }, [open, sdkReady, renderBoard]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleOpenPanel = useCallback(() => {
    loadCannySdk();
    setOpen(true);
  }, [loadCannySdk]);

  const ui = (
    <>
      {/* Floating feedback button */}
      {!open && (
        <button
          onClick={handleOpenPanel}
          className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full
            bg-[var(--twilight)] border border-[var(--neon-cyan)]/30 text-[var(--soft)]
            hover:text-[var(--cream)] hover:border-[var(--neon-cyan)]/60
            shadow-lg backdrop-blur-sm transition-all text-sm font-mono
            hover:shadow-[0_0_20px_rgba(94,240,255,0.15)]"
          aria-label="Give feedback"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Feedback
        </button>
      )}

      {/* Slide-out panel */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed top-0 right-0 z-[10000] h-full w-full max-w-lg
              bg-[var(--deep)] border-l border-[var(--twilight)]
              shadow-2xl overflow-y-auto
              animate-[slideInRight_0.2s_ease-out]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[var(--deep)] border-b border-[var(--twilight)]">
              <h2 className="text-[var(--cream)] font-semibold text-lg">Feedback</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
                aria-label="Close feedback panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4" data-canny />
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {mounted ? createPortal(ui, document.body) : null}
    </>
  );
}
