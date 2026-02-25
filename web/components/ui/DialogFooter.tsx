/**
 * DialogFooter — Cancel + Primary action button pair for modals/dialogs.
 *
 * Replaces 6+ inline implementations of the modal footer pattern.
 * Follows the Modal/Dialog recipe from the Design System Contract.
 *
 * Usage:
 *   <DialogFooter
 *     onCancel={() => setOpen(false)}
 *     onConfirm={handleSave}
 *     confirmLabel="Save"
 *     loading={isSaving}
 *   />
 */

interface DialogFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Disables confirm button and shows loading state */
  loading?: boolean;
  /** Disables confirm button without loading state */
  disabled?: boolean;
  /** Destructive action — confirms in coral/red */
  destructive?: boolean;
  className?: string;
}

export default function DialogFooter({
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  loading = false,
  disabled = false,
  destructive = false,
  className = "",
}: DialogFooterProps) {
  return (
    <div className={`flex gap-3 mt-6 ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || disabled}
        className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-medium transition-colors disabled:opacity-50 ${
          destructive
            ? "bg-[var(--neon-red)] text-white hover:bg-[var(--neon-red)]/80"
            : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
        }`}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {confirmLabel}
          </span>
        ) : (
          confirmLabel
        )}
      </button>
    </div>
  );
}
