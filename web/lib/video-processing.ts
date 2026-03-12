/**
 * Client-side video validation and thumbnail extraction.
 * No heavy dependencies — uses native browser APIs only.
 */

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DURATION = 5; // seconds
const THUMBNAIL_SIZE = 256;
const THUMBNAIL_QUALITY = 0.85;

export type VideoValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Validate file type and size (synchronous, no network). */
export function validateVideoFile(file: File): VideoValidationResult {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Unsupported format. Use MP4, WebM, or MOV.",
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`,
    };
  }
  return { valid: true };
}

/** Get video duration in seconds via a hidden <video> element. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!isFinite(duration) || duration <= 0) {
        reject(new Error("Could not determine video duration"));
      } else {
        resolve(duration);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video. The file may be corrupted."));
    };

    video.src = URL.createObjectURL(file);
  });
}

/** Validate duration is within the allowed range. */
export async function validateDuration(
  file: File,
): Promise<VideoValidationResult> {
  try {
    const duration = await getVideoDuration(file);
    if (duration > MAX_DURATION) {
      return {
        valid: false,
        error: `Video is ${duration.toFixed(1)}s. Maximum is ${MAX_DURATION}s. Trim it on your phone first.`,
      };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Could not read video file.",
    };
  }
}

/**
 * Extract a JPEG thumbnail from a video file.
 * Seeks to `timeOffset` seconds (default 0.5s), draws to canvas, returns a Blob.
 */
export function extractThumbnail(
  file: File,
  timeOffset = 0.5,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Clamp offset to video duration
      const seekTime = Math.min(timeOffset, video.duration * 0.5);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Canvas not supported"));
        return;
      }

      // Scale to square thumbnail preserving aspect ratio
      const { videoWidth, videoHeight } = video;
      const size = Math.min(videoWidth, videoHeight);
      const sx = (videoWidth - size) / 2;
      const sy = (videoHeight - size) / 2;

      canvas.width = THUMBNAIL_SIZE;
      canvas.height = THUMBNAIL_SIZE;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        "image/jpeg",
        THUMBNAIL_QUALITY,
      );
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail extraction"));
    };

    video.src = URL.createObjectURL(file);
  });
}
