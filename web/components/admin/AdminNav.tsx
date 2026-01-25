"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/portals", label: "Portals" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/federation", label: "Federation" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`font-mono text-xs transition-colors ${
              isActive(link.href, link.exact)
                ? "text-[var(--coral)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/"
          className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          Exit Admin
        </Link>
      </nav>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden bg-[var(--night)] border-b border-[var(--twilight)] z-50">
          <nav className="flex flex-col p-4 gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-lg font-mono text-sm transition-colors ${
                  isActive(link.href, link.exact)
                    ? "bg-[var(--coral)]/10 text-[var(--coral)]"
                    : "text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-[var(--twilight)] mt-2 pt-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-lg font-mono text-sm text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors block"
              >
                Exit Admin
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
