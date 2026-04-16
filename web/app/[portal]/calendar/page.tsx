import { redirect } from "next/navigation";

export default async function CalendarRedirect({
  params,
}: {
  params: Promise<{ portal: string }>;
}) {
  const { portal } = await params;
  redirect(`/${portal}/plans`);
}
