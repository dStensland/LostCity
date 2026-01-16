import Logo from "@/components/Logo";

interface PageFooterProps {
  cityName?: string;
  tagline?: string;
}

export default function PageFooter({
  cityName = "Atlanta",
  tagline,
}: PageFooterProps) {
  return (
    <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <Logo size="md" href={undefined} />
        <p className="font-serif text-[var(--muted)] mt-1">
          {tagline || `The real ${cityName}, found`}
        </p>
        <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-4 opacity-60">
          AI-powered · Updated continuously
        </p>
      </div>
    </footer>
  );
}
