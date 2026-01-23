import { supabase } from "@/lib/supabase";
import Link from "next/link";
import Image from "next/image";
import UnifiedHeader from "@/components/UnifiedHeader";
import CreateCollectionButton from "@/components/CreateCollectionButton";

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
      <UnifiedHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">Collections</h1>
          <CreateCollectionButton />
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
      className={`card-interactive block p-4 rounded-xl group ${
        featured ? "sm:p-6" : ""
      }`}
    >
      {collection.cover_image_url ? (
        <div className="aspect-[2/1] mb-3 rounded-lg overflow-hidden bg-[var(--twilight)] relative">
          <Image
            src={collection.cover_image_url}
            alt={`Cover image for ${collection.title} collection`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-[2/1] mb-3 rounded-lg bg-gradient-to-br from-[var(--neon-magenta)]/20 to-[var(--neon-cyan)]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      )}

      {/* Featured badge */}
      {featured && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-2 text-[0.6rem] font-mono font-medium bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] rounded">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Featured
        </span>
      )}

      <h3 className={`font-display font-semibold text-[var(--cream)] group-hover:text-[var(--neon-magenta)] transition-colors ${
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
