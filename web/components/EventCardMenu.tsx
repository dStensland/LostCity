"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

interface EventCardMenuProps {
  eventId: number;
  onHide?: () => void;
  className?: string;
}

export default function EventCardMenu({ eventId, onHide, className = "" }: EventCardMenuProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleHide = async (reason?: string) => {
    if (!user) return;

    setIsHiding(true);
    try {
      const res = await fetch("/api/events/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, reason }),
      });

      if (res.ok) {
        onHide?.();
      }
    } catch (err) {
      console.error("Failed to hide event:", err);
    } finally {
      setIsHiding(false);
      setIsOpen(false);
    }
  };

  // Don't render for logged out users
  if (!user) {
    return null;
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      {/* Menu trigger button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Event options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[var(--twilight)] shadow-xl z-50 overflow-hidden bg-[var(--void)]"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="p-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHide("not_interested");
              }}
              disabled={isHiding}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors disabled:opacity-50"
              role="menuitem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Not interested
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHide("wrong_category");
              }}
              disabled={isHiding}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors disabled:opacity-50"
              role="menuitem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Hide events like this
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
