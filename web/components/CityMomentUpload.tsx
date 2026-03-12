"use client";

import { useRef, useState } from "react";
import { ENABLE_CITY_MOMENTS } from "@/lib/launch-flags";
import {
  validateVideoFile,
  validateDuration,
  extractThumbnail,
} from "@/lib/video-processing";
import Dot from "@/components/ui/Dot";

interface CityMomentUploadProps {
  currentMomentUrl: string | null;
  onUploadComplete: () => void;
}

export default function CityMomentUpload({
  currentMomentUrl,
  onUploadComplete,
}: CityMomentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  if (!ENABLE_CITY_MOMENTS) return null;

  const previewUrl = localPreview || currentMomentUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setError(null);

    // Step 1: Validate type + size (instant)
    const typeCheck = validateVideoFile(file);
    if (!typeCheck.valid) {
      setError(typeCheck.error);
      return;
    }

    // Step 2: Check duration
    const durationCheck = await validateDuration(file);
    if (!durationCheck.valid) {
      setError(durationCheck.error);
      return;
    }

    // Step 3: Show local preview
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);

    try {
      // Step 4: Extract thumbnail
      const thumbnailBlob = await extractThumbnail(file);

      // Step 5: Upload via API
      const formData = new FormData();
      formData.append("video", file);
      formData.append(
        "thumbnail",
        new File([thumbnailBlob], "thumbnail.jpg", { type: "image/jpeg" }),
      );

      const res = await fetch("/api/auth/city-moment", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setUploading(true);
    setLocalPreview(null);

    try {
      const res = await fetch("/api/auth/city-moment", { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
        City Moment
      </label>
      <p className="font-mono text-xs text-[var(--muted)]">
        A 3-5 second loop. Your SNL intro.
      </p>

      {/* Preview */}
      {previewUrl ? (
        <div className="relative w-full max-w-[200px] aspect-square rounded-xl overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]">
          <video
            src={previewUrl}
            className="w-full h-full object-cover"
            loop
            muted
            playsInline
            autoPlay
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full max-w-[200px] aspect-square rounded-xl bg-[var(--dusk)] border border-dashed border-[var(--twilight)] flex flex-col items-center justify-center gap-2 hover:border-[var(--coral)] transition-colors disabled:opacity-50"
        >
          <svg
            className="w-8 h-8 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <span className="font-mono text-xs text-[var(--muted)]">
            Upload video
          </span>
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {previewUrl && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors disabled:opacity-50"
            >
              Change
            </button>
            <Dot className="text-[var(--muted)]" />
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
        <p className="font-mono text-xs text-[var(--coral)] max-w-[280px]">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
