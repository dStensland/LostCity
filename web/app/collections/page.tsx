import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";

export const dynamic = "force-dynamic";

type Collection = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  item_count: number;
  owner: {
    username: string;
    display_name: string | null;
  } | null;
};

type CollectionRow = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  owner: { username: string; display_name: string | null } | null;
  item_count: { count: number }[] | number;
};

async function getFeaturedCollections(): Promise<Collection[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("collections")
    .select(`
      id,
      slug,
      title,
      description,
      cover_image_url,
      is_featured,
      owner:profiles!collections_user_id_fkey(username, display_name),
      item_count:collection_items(count)
    `)
    .eq("visibility", "public")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  return ((data || []) as CollectionRow[]).map((c) => ({
    ...c,
    item_count: Array.isArray(c.item_count) ? c.item_count[0]?.count || 0 : 0,
  })) as Collection[];
}

export default async function CollectionsPage() {
  const collections = await getFeaturedCollections();

  const featured = collections.filter((c) => c.is_featured);
  const community = collections.filter((c) => !c.is_featured);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Events
          </Link>
          <UserMenu />
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Collections</h1>
        </div>

        {/* Featured Collections */}
        {featured.length > 0 && (
          <section className="mb-10">
            <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-4">
              Featured
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featured.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} featured />
              ))}
            </div>
          </section>
        )}

        {/* Community Collections */}
        {community.length > 0 && (
          <section>
            <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-4">
              Community
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {community.map((collection) => (
                <CollectionCard key={collection.id} collection={collection} />
              ))}
            </div>
          </section>
        )}

        {collections.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[var(--muted)] font-mono text-sm">No collections yet</p>
          </div>
        )}
      </main>
    </div>
  );
}

function CollectionCard({ collection, featured }: { collection: Collection; featured?: boolean }) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className={`block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)] transition-colors group ${
        featured ? "sm:p-6" : ""
      }`}
    >
      {collection.cover_image_url && (
        <div className="aspect-[2/1] mb-3 rounded overflow-hidden bg-[var(--twilight)]">
          <img
            src={collection.cover_image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      )}

      <h3 className={`font-sans font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors ${
        featured ? "text-lg" : "text-base"
      }`}>
        {collection.title}
      </h3>

      {collection.description && (
        <p className="font-mono text-xs text-[var(--muted)] mt-1 line-clamp-2">
          {collection.description}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3">
        <span className="font-mono text-xs text-[var(--soft)]">
          {collection.item_count} {collection.item_count === 1 ? "event" : "events"}
        </span>
        {collection.owner && (
          <>
            <span className="text-[var(--twilight)]">·</span>
            <span className="font-mono text-xs text-[var(--muted)]">
              by {collection.owner.display_name || collection.owner.username}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
