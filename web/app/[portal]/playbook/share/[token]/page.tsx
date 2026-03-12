import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ portal: string; token: string }>;
};

// Redirect old /playbook/share/[token] URLs to /itinerary/[token]
export default async function PlaybookShareRedirect({ params }: Props) {
  const { portal, token } = await params;
  redirect(`/${portal}/itinerary/${token}`);
}
