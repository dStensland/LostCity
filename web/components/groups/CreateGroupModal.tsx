"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useCreateGroup } from "@/lib/hooks/useGroups";
import {
  GROUP_VISIBILITY_OPTIONS,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_DESCRIPTION_LENGTH,
} from "@/lib/types/groups";
import type { GroupVisibility } from "@/lib/types/groups";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal = memo(function CreateGroupModal({
  isOpen,
  onClose,
}: CreateGroupModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [emoji, setEmoji] = useState("👥");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<GroupVisibility>("private");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createGroup = useCreateGroup();

  // Mount/unmount — setState in effect is required here for entrance animation timing
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for entrance animation timing
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional form reset on modal open
      setEmoji("👥");
      setName("");
      setDescription("");
      setVisibility("private");
      setSubmitError(null);
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setSubmitError("Group name must be at least 2 characters.");
      return;
    }

    try {
      await createGroup.mutateAsync({
        name: trimmedName,
        ...(description.trim() && { description: description.trim() }),
        ...(emoji && { emoji }),
        visibility,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create group.");
    }
  }, [name, description, emoji, visibility, createGroup, onClose]);

  if (typeof document === "undefined" || !isVisible) return null;

  const isSubmitting = createGroup.isPending;
  const nameLength = name.trim().length;
  const isValid = nameLength >= 2 && nameLength <= MAX_GROUP_NAME_LENGTH;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-200 ${
        isOpen ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Create group"
    >
      <div className="relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--twilight)] transition-colors"
          aria-label="Close"
        >
          <X size={18} className="text-[var(--muted)]" />
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          New Group
        </h2>

        <div className="space-y-5">
          {/* Emoji input */}
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Emoji
            </p>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-[var(--vibe)]/10 border border-[var(--vibe)]/20 flex items-center justify-center text-3xl leading-none select-none">
                {emoji || "👥"}
              </div>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                placeholder="👥"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--vibe)] transition-colors"
              />
            </div>
          </div>

          {/* Name input */}
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Group Name <span className="text-[var(--coral)] normal-case tracking-normal">*</span>
            </p>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, MAX_GROUP_NAME_LENGTH))}
                placeholder="The Crew"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--vibe)] transition-colors"
              />
              <span
                className={`absolute bottom-2 right-2.5 font-mono text-xs tabular-nums ${
                  name.length >= MAX_GROUP_NAME_LENGTH
                    ? "text-[var(--coral)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {name.length}/{MAX_GROUP_NAME_LENGTH}
              </span>
            </div>
          </div>

          {/* Description textarea */}
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Description{" "}
              <span className="normal-case tracking-normal opacity-60">(optional)</span>
            </p>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_GROUP_DESCRIPTION_LENGTH))}
                placeholder="What's this group about?"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--vibe)] transition-colors resize-none"
              />
              <span
                className={`absolute bottom-2 right-2.5 font-mono text-xs tabular-nums ${
                  description.length >= MAX_GROUP_DESCRIPTION_LENGTH
                    ? "text-[var(--coral)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {description.length}/{MAX_GROUP_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          {/* Visibility toggle */}
          <div>
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
              Visibility
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GROUP_VISIBILITY_OPTIONS.map((opt) => {
                const isActive = visibility === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setVisibility(opt.value)}
                    className={`min-h-[44px] flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border font-mono text-xs font-medium transition-all text-left ${
                      isActive
                        ? "bg-[var(--vibe)]/15 border-[var(--vibe)]/60 text-[var(--vibe)]"
                        : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span>{opt.label}</span>
                    <span
                      className={`text-2xs normal-case tracking-normal font-normal ${
                        isActive ? "text-[var(--vibe)]/70" : "text-[var(--muted)]"
                      }`}
                    >
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {submitError && (
            <div className="p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]">
              <p className="font-mono text-xs text-[var(--coral)]">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isValid}
            className="flex-1 py-2.5 bg-[var(--vibe)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export type { CreateGroupModalProps };
