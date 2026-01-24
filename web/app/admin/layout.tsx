import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Prevent static generation - admin pages require auth
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check if user is authenticated and is admin
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const profile = profileData as { is_admin: boolean } | null;
  if (!profile?.is_admin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Admin Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)] bg-[var(--night)]">
        <div className="flex items-center gap-6">
          <Link href="/" className="gradient-text text-xl font-bold tracking-tight">
            Lost City
          </Link>
          <span className="px-2 py-0.5 bg-[var(--coral)] text-[var(--void)] font-mono text-[0.6rem] font-bold uppercase rounded">
            Admin
          </span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/admin"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/analytics"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Analytics
          </Link>
          <Link
            href="/admin/sources"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Sources
          </Link>
          <Link
            href="/admin/federation"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Federation
          </Link>
          <Link
            href="/admin/events"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Events
          </Link>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Users
          </Link>
          <Link
            href="/"
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
