"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const variantStyles = {
    danger: "bg-[var(--coral)] hover:bg-[var(--rose)]",
    warning: "bg-[var(--gold)] text-[var(--void)] hover:opacity-90",
    default: "bg-[var(--cream)] text-[var(--void)] hover:bg-[var(--soft)]",
  };

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl animate-in scale-in"
      >
        <div className="p-6">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-semibold text-[var(--cream)] mb-2"
          >
            {title}
          </h2>
          <p
            id="confirm-dialog-message"
            className="font-mono text-sm text-[var(--muted)]"
          >
            {message}
          </p>
        </div>
        <div className="flex gap-3 p-4 border-t border-[var(--twilight)]">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm font-medium hover:bg-[var(--muted)]/20 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]} ${
              variant === "danger" || variant === "default"
                ? "text-[var(--void)]"
                : ""
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root
  if (typeof document !== "undefined") {
    return createPortal(dialog, document.body);
  }

  return null;
}

// Hook for easier usage
import { useState } from "react";

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "default";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const confirm = useCallback(
    (options: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "danger" | "warning" | "default";
      onConfirm: () => void | Promise<void>;
    }) => {
      setConfig(options);
      setIsOpen(true);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    if (config?.onConfirm) {
      setLoading(true);
      try {
        await config.onConfirm();
      } finally {
        setLoading(false);
        setIsOpen(false);
        setConfig(null);
      }
    }
  }, [config]);

  const handleClose = useCallback(() => {
    if (!loading) {
      setIsOpen(false);
      setConfig(null);
    }
  }, [loading]);

  const DialogComponent = config ? (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={config.title}
      message={config.message}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      variant={config.variant}
      loading={loading}
    />
  ) : null;

  return { confirm, DialogComponent };
}
