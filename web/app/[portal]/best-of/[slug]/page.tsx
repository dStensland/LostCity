import { redirect } from "next/navigation";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} | Best Of | Lost City`,
    description: `Community-ranked leaderboard — ${title}`,
  };
}

export default async function BestOfLeaderboardPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  redirect(`/${portalSlug}?view=community`);
}
