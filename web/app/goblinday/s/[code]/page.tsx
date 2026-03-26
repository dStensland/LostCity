import { createServiceClient } from "@/lib/supabase/service";
import GoblinJoinPage from "./GoblinJoinPage";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const serviceClient = createServiceClient();
  const { data: session } = await serviceClient
    .from("goblin_sessions")
    .select("name, date")
    .eq("invite_code", code)
    .single();

  const title = session
    ? `Join ${(session as { name: string }).name || "Goblin Day"}`
    : "Goblin Day";

  return {
    title,
    description: "You've been invited to a Goblin Day horror movie marathon.",
    openGraph: { title, description: "Click the link you fool" },
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <GoblinJoinPage code={code} />;
}
