/** Format Google rating to 1 decimal (e.g., "4.7") */
export function formatRating(rating: number): string {
  return rating % 1 === 0 ? String(rating) + ".0" : rating.toFixed(1);
}

/** Format close time from "HH:MM" to "Xpm" or "X:MMpm" */
export function formatCloseTime(closes_at: string): string {
  const [h, m] = closes_at.split(":").map(Number);
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const period = h >= 12 && h < 24 ? "pm" : "am";
  return m === 0 ? `${hr}${period}` : `${hr}:${String(m).padStart(2, "0")}${period}`;
}

/** Format distance in km to miles string */
export function formatDistance(km: number): string {
  return `${(km * 0.621371).toFixed(1)} mi`;
}

export const COMMITMENT_LABELS: Record<string, string> = {
  hour: "1 Hour",
  halfday: "Half Day",
  fullday: "Full Day",
  weekend: "Weekend",
};
