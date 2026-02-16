import Link from "next/link";

interface Props {
  portalSlug: string;
}

export default function DogCommunityCTA({ portalSlug }: Props) {
  return (
    <section
      className="text-center py-8 px-4 rounded-2xl mt-10"
      style={{
        background: "rgba(253, 232, 138, 0.15)",
        border: "1px solid rgba(253, 232, 138, 0.3)",
      }}
    >
      <p className="dog-display text-base font-semibold">Missing a spot?</p>
      <p className="text-sm mt-1" style={{ color: "var(--dog-stone)" }}>
        Help us map every dog-friendly place in Atlanta.
      </p>
      <Link
        href={`/${portalSlug}?view=find`}
        className="dog-btn-secondary inline-block mt-4 text-sm"
      >
        Tag a spot
      </Link>
    </section>
  );
}
