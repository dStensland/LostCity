import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { isDestinationNodeIdentityTier } from "@/lib/destination-graph";
import {
  getYonderDestinationNodePayload,
} from "@/lib/yonder-destination-nodes";
import { isValidString, parseIntParam } from "@/lib/api-utils";
import {
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
  type YonderDestinationNodeQuestId,
} from "@/config/yonder-launch-destination-nodes";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const questIdParam = searchParams.get("quest_id");
  const identityTierParam = searchParams.get("identity_tier");
  const limitParam = parseIntParam(searchParams.get("limit"));
  const validQuestIds = new Set<string>(
    YONDER_LAUNCH_DESTINATION_NODE_QUESTS.map((quest) => quest.id),
  );

  const questId =
    questIdParam && isValidString(questIdParam, 1, 64) && validQuestIds.has(questIdParam)
      ? (questIdParam as YonderDestinationNodeQuestId)
      : null;
  const identityTier =
    identityTierParam && isDestinationNodeIdentityTier(identityTierParam)
      ? identityTierParam
      : null;
  const limit =
    typeof limitParam === "number" && limitParam > 0
      ? Math.min(limitParam, 24)
      : null;

  const result = await getYonderDestinationNodePayload(slug, {
    questId,
    identityTier,
    limit,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
