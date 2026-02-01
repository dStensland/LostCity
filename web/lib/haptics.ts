/**
 * Haptic feedback utilities for mobile devices
 * Uses Vibration API with progressive enhancement
 */

export type HapticFeedbackType = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof window !== "undefined" && "vibrate" in navigator;
}

/**
 * Trigger haptic feedback
 * Progressive enhancement - fails silently if not supported
 */
export function triggerHaptic(type: HapticFeedbackType = "light"): void {
  if (!isHapticSupported()) return;

  try {
    switch (type) {
      case "light":
      case "selection":
        navigator.vibrate(10);
        break;
      case "medium":
        navigator.vibrate(20);
        break;
      case "heavy":
        navigator.vibrate(30);
        break;
      case "success":
        navigator.vibrate([10, 50, 10]);
        break;
      case "warning":
        navigator.vibrate([20, 100, 20]);
        break;
      case "error":
        navigator.vibrate([30, 100, 30, 100, 30]);
        break;
    }
  } catch {
    // Fail silently - some browsers may restrict vibration API
  }
}
