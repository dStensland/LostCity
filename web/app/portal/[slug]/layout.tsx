import { getPortalBySlug } from "@/lib/portals";
import { notFound } from "next/navigation";
import { Metadata } from "next";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const portal = await getPortalBySlug(slug);

  if (!portal) {
    return { title: "Not Found" };
  }

  return {
    title: `${portal.name} | Lost City`,
    description:
      portal.settings.meta_description ||
      portal.tagline ||
      `Discover events in ${portal.name}`,
    openGraph: {
      title: portal.name,
      description: portal.tagline || undefined,
      images: portal.settings.og_image_url
        ? [portal.settings.og_image_url]
        : portal.branding.hero_image_url
          ? [portal.branding.hero_image_url]
          : undefined,
    },
  };
}

export default async function PortalLayout({ children, params }: Props) {
  const { slug } = await params;
  const portal = await getPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  // Generate CSS variables from branding
  const brandingStyles = `
    :root {
      --portal-primary: ${portal.branding.primary_color || "#FF6B35"};
      --portal-secondary: ${portal.branding.secondary_color || "#1a1a2e"};
      --portal-bg: ${portal.branding.background_color || "#f9fafb"};
    }
    ${portal.branding.custom_css || ""}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandingStyles }} />
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--portal-bg)" }}
      >
        {children}
      </div>
    </>
  );
}
