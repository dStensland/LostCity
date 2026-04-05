import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { DOG_THEME_SCOPE_CLASS, DOG_THEME_CSS, isDogPortal } from "@/lib/dog-art";
import { DogHeader } from "@/components/headers";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import DogMapView from "../_components/dog/DogMapView";

type Props = {
  params: Promise<{ portal: string }>;
};

export const revalidate = 300;

export default async function DogMapPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug: portalSlug,
    headersList,
    pathname: `/${portalSlug}/map`,
    surface: "explore",
  });
  if (!request) notFound();
  if (!request.isDog && !isDogPortal(request.portal.slug)) notFound();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#FFFBEB" }}>
      <style>{`
        body::before { opacity: 0 !important; }
        body::after { opacity: 0 !important; }
        .ambient-glow { opacity: 0 !important; }
        .rain-overlay { display: none !important; }
        .cursor-glow { display: none !important; }
      `}</style>
      <DogHeader portalSlug={request.portal.slug} />
      <div className={DOG_THEME_SCOPE_CLASS}>
        <style dangerouslySetInnerHTML={{ __html: DOG_THEME_CSS }} />
        <DogMapView />
      </div>
      <div className="h-20 sm:hidden" />
    </div>
  );
}
