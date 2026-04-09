import GoblinRankingGamePage from "@/components/goblin/GoblinRankingGamePage";

export const dynamic = "force-dynamic";

export default async function RankingGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const id = parseInt(gameId);

  if (isNaN(id)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="font-mono text-sm text-zinc-500">Invalid game.</p>
      </div>
    );
  }

  return <GoblinRankingGamePage gameId={id} />;
}
