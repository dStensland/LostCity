"use client";

import { useRef, useState } from "react";
import UserAvatar from "@/components/UserAvatar";

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  displayName: string;
  username: string;
  size?: "md" | "lg" | "xl";
  onUploadComplete: (newUrl: string) => void;
  onRemove?: () => void;
}

export default function AvatarUpload({
  currentAvatarUrl,
  displayName,
  username,
  size = "xl",
  onUploadComplete,
  onRemove,
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeMap = { md: 64, lg: 96, xl: 128 };
  const px = sizeMap[size];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/auth/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      onUploadComplete(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setUploading(true);

    try {
      const res = await fetch("/api/auth/avatar", { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove avatar");
      }

      onRemove?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar with overlay */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative group cursor-pointer disabled:cursor-wait"
        style={{ width: px, height: px }}
      >
        <UserAvatar
          src={currentAvatarUrl}
          name={displayName || username}
          size={size === "xl" ? "xl" : size === "lg" ? "lg" : "md"}
          className="w-full h-full"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-6 h-6 text-[var(--coral)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </button>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors disabled:opacity-50"
        >
          {currentAvatarUrl ? "Change photo" : "Upload photo"}
        </button>
        {currentAvatarUrl && (
          <>
            <span className="text-[var(--twilight)]">·</span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="font-mono text-xs text-[var(--muted)] hover:text-[var(--coral)] transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="font-mono text-xs text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
