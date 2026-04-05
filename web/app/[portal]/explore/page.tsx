import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { ExploreSurface } from "./_components/ExploreSurface";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const revalidate = 300;

export default async function PortalExplorePage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;
  const normalizedEntries = Object.entries(searchParamsData).flatMap(([key, value]) =>
    value === undefined
      ? []
      : Array.isArray(value)
        ? value.map((entry) => [key, entry])
        : [[key, value]],
  ) as string[][];
  const rawParams = new URLSearchParams(normalizedEntries);
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug,
    headersList,
    pathname: `/${slug}/explore`,
    searchParams: rawParams,
    surface: "explore",
  });

  if (!request) {
    notFound();
  }

  if (request.isHotel || request.isMarketplace) {
    redirect(`/${request.portal.slug}`);
  }

  if (request.isDog) {
    const dogParams = Object.entries(searchParamsData).flatMap(([key, value]) =>
      value === undefined
        ? []
        : Array.isArray(value)
          ? value.map((entry) => [key, entry])
          : [[key, value]],
    ) as string[][];
    const paramsString = new URLSearchParams(
      dogParams,
    ).toString();
    redirect(`/${request.portal.slug}/map${paramsString ? `?${paramsString}` : ""}`);
  }

  return <ExploreSurface request={request} rawParams={rawParams} />;
}
