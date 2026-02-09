import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient, canManagePortal } from "@/lib/supabase/server";
import { getCachedPortalBySlug } from "@/lib/portal";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
};

export default async function PortalAdminLayout({ children, params }: Props) {
  const { portal: slug } = await params;
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/${slug}/admin`);
  }

  // Get portal from database
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  // Check if user can manage this portal
  if (!(await canManagePortal(portal.id))) {
    redirect(`/${slug}`);
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Portal Admin Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)] bg-[var(--night)]">
        <div className="flex items-center gap-4">
          <Link href={`/${slug}`} className="gradient-text text-xl font-bold tracking-tight">
            {portal.name}
          </Link>
          <span className="px-2 py-0.5 bg-[var(--coral)] text-[var(--void)] font-mono text-[0.6rem] font-bold uppercase rounded">
            Portal Admin
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href={`/${slug}/admin`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href={`/${slug}/admin/sources`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Sources
          </Link>
          <Link
            href={`/${slug}/admin/subscriptions`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Subscriptions
          </Link>
          <Link
            href={`/${slug}/admin/qr`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            QR Codes
          </Link>
          <Link
            href={`/${slug}/admin/analytics`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Analytics
          </Link>
          <Link
            href={`/${slug}`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Exit Admin
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
