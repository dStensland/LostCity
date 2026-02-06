"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onError?: (error: string) => void;
  maxSize?: number; // in bytes, default 5MB
  allowedTypes?: string[];
  placeholder?: string;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({
  value,
  onChange,
  onError,
  maxSize = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  placeholder = "Drag and drop an image, or click to browse",
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const progressClass = createCssVarClassForLength(
    "--upload-progress",
    `${uploadProgress}%`,
    "upload-progress"
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type. Allowed: ${allowedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ")}`;
    }
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`;
    }
    return null;
  }, [allowedTypes, maxSize]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress (since fetch doesn't support progress natively)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const res = await fetch("/api/submissions/upload-image", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onChange, onError, validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <ScopedStyles css={progressClass?.css} />
      {value ? (
        // Image preview
        <div className="relative rounded-lg overflow-hidden border border-[var(--twilight)] h-48">
          <Image
            src={value}
            alt="Uploaded preview"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center p-4">
            <button
              type="button"
              onClick={handleRemove}
              className="px-4 py-2 rounded-lg bg-red-500 text-white font-mono text-sm hover:bg-red-600 transition-colors"
            >
              Remove Image
            </button>
          </div>
        </div>
      ) : (
        // Upload area
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-[var(--coral)] bg-[var(--coral)]/5"
              : "border-[var(--twilight)] hover:border-[var(--coral)] hover:bg-[var(--twilight)]/30"
          } ${isUploading ? "pointer-events-none" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={allowedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-3">
              <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[var(--muted)] font-mono text-sm">
                Uploading... {uploadProgress}%
              </p>
              <div className="w-full bg-[var(--twilight)] rounded-full h-1.5">
                <div
                  className={`bg-[var(--coral)] h-1.5 rounded-full transition-all w-[var(--upload-progress)] ${progressClass?.className ?? ""}`}
                />
              </div>
            </div>
          ) : (
            <>
              <svg
                className="w-12 h-12 mx-auto text-[var(--muted)] mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-[var(--cream)] font-mono text-sm mb-1">
                {placeholder}
              </p>
              <p className="text-[var(--muted)] font-mono text-xs">
                JPEG, PNG, or WebP up to {Math.round(maxSize / 1024 / 1024)}MB
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-400 font-mono text-xs">{error}</p>
      )}

      {/* URL input fallback */}
      {!value && !isUploading && (
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <div className="flex-1 h-px bg-[var(--twilight)]" />
          <span className="font-mono text-xs">or paste URL</span>
          <div className="flex-1 h-px bg-[var(--twilight)]" />
        </div>
      )}

      {!value && !isUploading && (
        <input
          type="url"
          placeholder="https://example.com/image.jpg"
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value);
            }
          }}
          className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
        />
      )}
    </div>
  );
}
