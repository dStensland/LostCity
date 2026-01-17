"use client";

import { useState } from "react";
import CreateCollectionModal from "./CreateCollectionModal";

export default function CreateCollectionButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-[var(--neon-magenta)] text-white rounded-lg font-mono text-sm font-medium shadow-[0_0_15px_hsl(var(--neon-magenta-hsl)/0.3)] hover:opacity-90 transition-all flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Collection
      </button>

      <CreateCollectionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
