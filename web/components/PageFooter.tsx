import Link from "next/link";
import Logo from "@/components/Logo";

interface PageFooterProps {
  cityName?: string;
  tagline?: string;
}

export default function PageFooter({
  cityName = "Atlanta",
  tagline,
}: PageFooterProps) {
  const currentYear = 2026;

  return (
    <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Logo and tagline */}
        <div className="text-center mb-6">
          <Logo size="md" href={undefined} />
          <p className="font-serif text-[var(--muted)] mt-1">
            {tagline || `Find your people in ${cityName}`}
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mb-6">
          <Link
            href="/privacy"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Terms of Service
          </Link>
          <a
            href="mailto:coach@lostcity.ai"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Contact
          </a>
        </div>

        {/* Social links placeholder */}
        {/* <div className="flex justify-center gap-4 mb-6">
          <a href="#" className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">Instagram</svg>
          </a>
          <a href="#" className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">Twitter/X</svg>
          </a>
        </div> */}

        {/* Copyright */}
        <div className="text-center">
          <p className="font-mono text-[0.6rem] text-[var(--muted)] opacity-60">
            © {currentYear} Lost City. All rights reserved.
          </p>
          <p className="font-mono text-[0.5rem] text-[var(--muted)] mt-1 opacity-40">
            AI-powered · Updated continuously
          </p>
        </div>
      </div>
    </footer>
  );
}
