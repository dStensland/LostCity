import Link from "next/link";
import Image from "@/components/SmartImage";
import Logo from "@/components/Logo";

interface FooterLink {
  label: string;
  url: string;
}

interface PageFooterProps {
  cityName?: string;
  tagline?: string;
  /** Enterprise only: Hide LostCity branding */
  hideAttribution?: boolean;
  /** Enterprise only: Custom footer text replacing "© LostCity" */
  footerText?: string;
  /** Enterprise only: Custom footer links */
  footerLinks?: FooterLink[];
  /** Custom logo URL (for white-label portals) */
  logoUrl?: string;
}

export default function PageFooter({
  cityName = "Atlanta",
  tagline,
  hideAttribution = false,
  footerText,
  footerLinks,
  logoUrl,
}: PageFooterProps) {
  const currentYear = 2026;

  // Use custom footer text or default to LostCity
  const copyrightText = footerText || `© ${currentYear} Lost City. All rights reserved.`;

  // Determine if we should show LostCity logo or hide it
  const showLostCityLogo = !hideAttribution && !logoUrl;

  return (
    <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Logo and tagline */}
        <div className="text-center mb-6">
          {showLostCityLogo ? (
            <Logo size="md" href={undefined} />
          ) : logoUrl ? (
            <Image src={logoUrl} alt="" width={120} height={32} className="h-8 mx-auto object-contain" />
          ) : null}
          <p className="font-serif text-[var(--muted)] mt-1">
            {tagline || `Find your people in ${cityName}`}
          </p>
        </div>

        {/* Links - use custom links if provided, otherwise default */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm mb-6">
          {footerLinks && footerLinks.length > 0 ? (
            // Custom footer links (Enterprise)
            footerLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </a>
            ))
          ) : (
            // Default LostCity links
            <>
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
            </>
          )}
        </div>

        {/* Copyright */}
        <div className="text-center">
          <p className="font-mono text-[0.6rem] text-[var(--muted)] opacity-60">
            {copyrightText}
          </p>
          {/* Only show "AI-powered" for LostCity branded portals */}
          {!hideAttribution && (
            <p className="font-mono text-[0.5rem] text-[var(--muted)] mt-1 opacity-40">
              AI-powered · Updated continuously
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
