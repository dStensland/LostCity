// Types for Best Of Contests feature
// Contest-scoped scoring: only votes/cases within the contest time window count

export interface BestOfContest {
  id: string;
  categoryId: string;
  portalId: string;
  slug: string;
  title: string;
  prompt: string | null;
  description: string | null;
  coverImageUrl: string | null;
  accentColor: string | null;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  winnerVenueId: number | null;
  winnerSnapshot: WinnerSnapshot | null;
  winnerAnnouncedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WinnerSnapshot {
  venueId: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  finalRank: 1;
  totalScore: number;
  voteCount: number;
  caseCount: number;
  topCaseContent: string | null;
  topCaseAuthor: string | null;
  runnerUp: {
    venueId: number;
    name: string;
    totalScore: number;
  } | null;
  totalContestVotes: number;
  snapshotAt: string;
}

export interface ContestLeaderboardEntry {
  venueId: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
  venueType: string | null;
  rank: number;
  voteCount: number;
  caseCount: number;
  totalScore: number;
  topCase: {
    id: string;
    content: string;
    author: { id: string; username: string; avatarUrl: string | null };
    upvoteCount: number;
  } | null;
  hasVoted: boolean;
}

export interface ContestLeaderboardData {
  contest: BestOfContest;
  categoryName: string;
  venues: ContestLeaderboardEntry[];
  userVoteVenueId: number | null;
  totalVotes: number;
  timeRemaining: string;
}

// Admin types
export interface CreateContestRequest {
  categoryId: string;
  slug: string;
  title: string;
  prompt?: string;
  description?: string;
  coverImageUrl?: string;
  accentColor?: string;
  startsAt: string;
  endsAt: string;
}

export interface UpdateContestRequest {
  title?: string;
  prompt?: string;
  description?: string;
  coverImageUrl?: string;
  accentColor?: string;
  startsAt?: string;
  endsAt?: string;
  status?: 'draft' | 'active' | 'completed' | 'archived';
}

/** Map DB row to our type */
export function mapContestRow(row: Record<string, unknown>): BestOfContest {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    portalId: row.portal_id as string,
    slug: row.slug as string,
    title: row.title as string,
    prompt: row.prompt as string | null,
    description: row.description as string | null,
    coverImageUrl: row.cover_image_url as string | null,
    accentColor: row.accent_color as string | null,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    status: row.status as BestOfContest['status'],
    winnerVenueId: row.winner_venue_id as number | null,
    winnerSnapshot: row.winner_snapshot as WinnerSnapshot | null,
    winnerAnnouncedAt: row.winner_announced_at as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Compute a human-readable time remaining string */
export function formatTimeRemaining(endsAt: string): string {
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  const diffMs = end - now;

  if (diffMs <= 0) return 'Ended';

  const diffSec = Math.floor(diffMs / 1000);
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);

  if (days > 1) return `${days} days left`;
  if (days === 1) return `1 day left`;
  if (hours > 1) return `${hours} hours left`;
  if (hours === 1) return `1 hour left`;
  if (minutes > 1) return `${minutes} minutes left`;
  return 'Less than a minute left';
}
