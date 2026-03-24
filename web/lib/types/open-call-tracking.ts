// Personal pipeline types for open call tracking

export type TrackingStatus = "saved" | "applied" | "dismissed";

export interface OpenCallTracking {
  id: string;
  user_id: string;
  open_call_id: string;
  status: TrackingStatus;
  remind_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  dismissed: "Dismissed",
};
