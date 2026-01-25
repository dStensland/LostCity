import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";

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
      <header className="relative px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)] bg-[var(--night)]">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="gradient-text text-xl font-bold tracking-tight">
            Lost City
          </Link>
          <span className="px-2 py-1 bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/40 font-mono text-[0.6rem] font-medium uppercase tracking-wider rounded">
            Admin
          </span>
        </div>
        <AdminNav />
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
