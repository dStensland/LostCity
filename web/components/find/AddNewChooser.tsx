"use client";

import { useState, useEffect, useRef } from "react";
import SubmitVenueModal from "@/components/SubmitVenueModal";
import SubmitEventModal from "@/components/find/SubmitEventModal";
import SubmitOrgModal from "@/components/find/SubmitOrgModal";

interface AddNewChooserProps {
  portalSlug: string;
}

type Option = "event" | "destination" | "organization";

const OPTIONS: { key: Option; label: string; icon: React.ReactNode }[] = [
  {
    key: "event",
    label: "Event",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "destination",
    label: "Destination",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "organization",
    label: "Organization",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function AddNewChooser({ portalSlug }: AddNewChooserProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<Option | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const handleOptionClick = (option: Option) => {
    setIsDropdownOpen(false);
    setActiveModal(option);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-[var(--coral)] text-[var(--coral)] hover:bg-[var(--coral)]/10 transition-colors"
          aria-label="Add new"
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            {OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => handleOptionClick(option.key)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
              >
                <span className="text-[var(--muted)]">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <SubmitVenueModal
        isOpen={activeModal === "destination"}
        onClose={closeModal}
        portalSlug={portalSlug}
      />
      <SubmitEventModal
        isOpen={activeModal === "event"}
        onClose={closeModal}
      />
      <SubmitOrgModal
        isOpen={activeModal === "organization"}
        onClose={closeModal}
      />
    </>
  );
}
