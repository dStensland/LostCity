import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { notFound } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { format, parseISO } from "date-fns";
import type { Metadata } from "next";

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
};

type CollectionItem = {
  id: number;
  note: string | null;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    is_free: boolean;
    price_min: number | null;
    category: string | null;
    image_url: string | null;
    venue: {
      name: string;
      slug: string;
      neighborhood: string | null;
    } | null;
  };
};

type CollectionData = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  user_id: string | null;
  visibility: string;
  is_featured: boolean;
  created_at: string;
  owner: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

async function getCollection(slug: string) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collectionData, error } = await (supabase as any)
    .from("collections")
    .select(`
      id,
      slug,
      title,
      description,
      cover_image_url,
      user_id,
      visibility,
      is_featured,
      created_at
    `)
    .eq("slug", slug)
    .eq("visibility", "public")
    .maybeSingle();

  if (error || !collectionData) return null;

  // Fetch owner profile separately since FK join doesn't work
  let owner: { username: string; display_name: string | null; avatar_url: string | null } | null = null;
  if (collectionData.user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileData } = await (supabase as any)
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", collectionData.user_id)
      .maybeSingle();
    owner = profileData;
  }

  const collection: CollectionData = {
    ...collectionData,
    owner,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase as any)
    .from("collection_items")
    .select(`
      id,
      note,
      event:events(
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        price_min,
        category,
        image_url,
        venue:venues(name, slug, neighborhood)
      )
    `)
    .eq("collection_id", collection.id)
    .order("position", { ascending: true });

  const validItems = (items || []).filter((item: { event: unknown }) => item.event !== null) as CollectionItem[];

  return { collection, items: validItems };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCollection(slug);

  if (!data) {
    return { title: "Collection Not Found | Lost City" };
  }

  return {
    title: `${data.collection.title} | Lost City`,
    description: data.collection.description || `A curated collection of ${data.items.length} events.`,
    openGraph: {
      title: data.collection.title,
      description: data.collection.description || undefined,
      images: data.collection.cover_image_url ? [{ url: data.collection.cover_image_url }] : [],
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCollection(slug);

  if (!data) {
    notFound();
  }

  const { collection, items } = data;
  const owner = collection.owner as { username: string; display_name: string | null; avatar_url: string | null } | null;

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Collections
        </Link>

        {/* Collection Header */}
        <div className="mb-8">
          {collection.cover_image_url && (
            <div className="aspect-[3/1] mb-4 rounded-lg overflow-hidden bg-[var(--twilight)] relative">
              <Image
                src={collection.cover_image_url}
                alt={`Cover image for ${collection.title} collection`}
                fill
                className="object-cover"
              />
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            {collection.title}
          </h1>

          {collection.description && (
            <p className="font-mono text-sm text-[var(--soft)] mb-4">
              {collection.description}
            </p>
          )}

          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-[var(--muted)]">
              {items.length} {items.length === 1 ? "event" : "events"}
            </span>

            {owner && (
              <Link
                href={`/profile/${owner.username}`}
                className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                {owner.avatar_url ? (
                  <Image src={owner.avatar_url} alt={`${owner.display_name || owner.username}'s profile photo`} width={20} height={20} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[var(--coral)] flex items-center justify-center">
                    <span className="text-[0.5rem] font-bold text-[var(--void)]">
                      {(owner.display_name || owner.username)[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {owner.display_name || owner.username}
              </Link>
            )}
          </div>
        </div>

        {/* Events List */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <CollectionEventCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-[var(--muted)] font-mono text-sm">Empty. Add some stuff.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function CollectionEventCard({ item }: { item: CollectionItem }) {
  const { event } = item;
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-4 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)] transition-colors group"
    >
      {/* Image or Category Icon */}
      <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--twilight)] flex items-center justify-center relative">
        {event.image_url ? (
          <Image src={event.image_url} alt={`${event.title} event image`} fill className="object-cover" />
        ) : (
          <CategoryIcon type={event.category || "other"} size={24} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-sans text-base font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {event.title}
        </h3>

        <div className="flex items-center gap-2 mt-1 text-[var(--muted)]">
          <span className="font-mono text-xs">{formattedDate}</span>
          <span className="text-[var(--twilight)]">·</span>
          <span className="font-mono text-xs">
            {time}
            <span className="text-[var(--twilight)]">{period}</span>
          </span>
        </div>

        {event.venue && (
          <p className="font-mono text-xs text-[var(--muted)] mt-1 truncate">
            {event.venue.name}
            {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
          </p>
        )}

        {item.note && (
          <p className="font-mono text-xs text-[var(--soft)] mt-2 italic">
            &ldquo;{item.note}&rdquo;
          </p>
        )}
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right">
        <span className={`font-mono text-sm ${event.is_free ? "text-green-400" : "text-[var(--gold)]"}`}>
          {event.is_free ? "Free" : event.price_min ? `$${event.price_min}` : "—"}
        </span>
      </div>
    </Link>
  );
}
