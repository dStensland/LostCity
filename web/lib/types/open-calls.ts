// Open Call entity types — maps to open_calls table

export type CallType =
  | "submission"
  | "residency"
  | "grant"
  | "commission"
  | "exhibition_proposal";

export type CallStatus = "open" | "closed" | "reviewing" | "awarded";

export interface OpenCall {
  id: string;
  slug: string;
  organization_id: string | null;
  venue_id: number | null;
  source_id: number | null;
  portal_id: string | null;
  title: string;
  description: string | null;
  deadline: string | null;
  application_url: string;
  fee: number | null;
  eligibility: string | null;
  medium_requirements: string[] | null;
  call_type: CallType;
  status: CallStatus;
  source_url: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpenCallWithOrg extends OpenCall {
  organization: {
    id: string;
    name: string;
    slug: string;
    website: string | null;
  } | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
}

// Display helpers

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  submission: "Open Submission",
  residency: "Residency",
  grant: "Grant",
  commission: "Commission",
  exhibition_proposal: "Exhibition Proposal",
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  open: "Open",
  closed: "Closed",
  reviewing: "Under Review",
  awarded: "Awarded",
};

export const CALL_STATUS_COLORS: Record<CallStatus, string> = {
  open: "text-emerald-700 bg-emerald-50 border-emerald-200",
  closed: "text-gray-500 bg-gray-50 border-gray-200",
  reviewing: "text-amber-700 bg-amber-50 border-amber-200",
  awarded: "text-violet-700 bg-violet-50 border-violet-200",
};

export function isDeadlineSoon(call: OpenCall, daysThreshold = 14): boolean {
  if (!call.deadline) return false;
  if (call.status !== "open") return false;
  const deadline = new Date(call.deadline);
  const now = new Date();
  const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysLeft > 0 && daysLeft <= daysThreshold;
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Rolling";
  const d = new Date(deadline + "T12:00:00");
  const now = new Date();
  const daysLeft = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft < 0) return "Closed";
  if (daysLeft === 0) return "Due today";
  if (daysLeft <= 7) return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatFee(fee: number | null): string {
  if (fee === null || fee === 0) return "No fee";
  return `$${fee % 1 === 0 ? fee : fee.toFixed(2)} fee`;
}
