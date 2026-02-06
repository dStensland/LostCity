"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

type PortalBranding = {
  logo_url?: string;
  hero_image_url?: string;
  favicon_url?: string;
  og_image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  muted_color?: string;
  font_heading?: string;
  font_body?: string;
  theme_mode?: "dark" | "light";
  // Enterprise white-label options
  hide_attribution?: boolean;
  footer_text?: string;
  footer_links?: { label: string; url: string }[];
  sharing_brand_name?: string;
};

type FeedSettings = {
  feed_type: "default" | "sections" | "custom";
  featured_event_id?: number;
  featured_section_ids?: string[];
  section_order?: string[];
  show_activity_tab?: boolean;
  items_per_section?: number;
};

type NavLabels = {
  feed?: string;
  events?: string;
  spots?: string;
};

type PortalFilters = {
  city?: string;
  geo_center?: [number, number]; // [lat, lng]
  geo_radius_km?: number;
  categories?: string[];
  exclude_categories?: string[];
  date_range_start?: string;
  date_range_end?: string;
  price_max?: number;
  venue_ids?: number[];
  tags?: string[];
  neighborhoods?: string[];
};

const ALL_CATEGORIES = [
  { id: "music", label: "Music" },
  { id: "film", label: "Film" },
  { id: "comedy", label: "Comedy" },
  { id: "theater", label: "Theater" },
  { id: "art", label: "Art" },
  { id: "sports", label: "Sports" },
  { id: "food_drink", label: "Food & Drink" },
  { id: "nightlife", label: "Nightlife" },
  { id: "community", label: "Community" },
  { id: "fitness", label: "Fitness" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "dance", label: "Dance" },
  { id: "tours", label: "Tours" },
  { id: "meetup", label: "Meetup" },
  { id: "words", label: "Words" },
  { id: "religious", label: "Religious" },
  { id: "markets", label: "Markets" },
  { id: "wellness", label: "Wellness" },
  { id: "gaming", label: "Gaming" },
  { id: "outdoors", label: "Outdoors" },
  { id: "other", label: "Other" },
];

type PortalSection = {
  id: string;
  title: string;
  slug: string;
  section_type: "auto" | "curated" | "mixed";
  is_visible: boolean;
  display_order: number;
};

type Portal = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: "city" | "event" | "business" | "personal";
  owner_type: string | null;
  owner_id: string | null;
  status: "draft" | "active" | "archived";
  visibility: "public" | "unlisted" | "private";
  filters: PortalFilters;
  branding: PortalBranding;
  settings: Record<string, unknown> & { feed?: FeedSettings };
  // B2B fields
  plan?: "starter" | "professional" | "enterprise";
  custom_domain?: string | null;
  custom_domain_verified?: boolean;
  custom_domain_verification_token?: string | null;
  parent_portal_id?: string | null;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  }>;
  sections?: PortalSection[];
  member_count: number;
  content_count: number;
  section_count: number;
  created_at: string;
  updated_at: string;
};

export default function EditPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [filters, setFilters] = useState<PortalFilters>({});
  const [branding, setBranding] = useState<PortalBranding>({});
  const [feedSettings, setFeedSettings] = useState<FeedSettings>({
    feed_type: "default",
    show_activity_tab: true,
    items_per_section: 5,
  });
  const [navLabels, setNavLabels] = useState<NavLabels>({});
  const [sections, setSections] = useState<PortalSection[]>([]);

  // B2B form state
  const [plan, setPlan] = useState<"starter" | "professional" | "enterprise">("starter");
  const [customDomain, setCustomDomain] = useState("");
  const [parentPortalId, setParentPortalId] = useState<string | null>(null);
  const [allPortals, setAllPortals] = useState<{ id: string; name: string; slug: string; portal_type: string }[]>([]);
  const [domainVerification, setDomainVerification] = useState<{
    verified: boolean;
    token: string | null;
  } | null>(null);
  const [verifyingDomain, setVerifyingDomain] = useState(false);

  const previewBgClass = createCssVarClass(
    "--preview-bg",
    branding.background_color || "#0a0a12",
    "preview-bg"
  );
  const previewBorderClass = createCssVarClass(
    "--preview-border",
    branding.secondary_color || "#2a2a4a",
    "preview-border"
  );
  const previewPrimaryClass = createCssVarClass(
    "--preview-primary",
    branding.primary_color || "#E87B6B",
    "preview-primary"
  );
  const previewSecondaryClass = createCssVarClass(
    "--preview-secondary",
    branding.secondary_color || "#2a2a4a",
    "preview-secondary"
  );
  const previewButtonTextClass = createCssVarClass(
    "--preview-button-text",
    branding.background_color || "#0a0a12",
    "preview-button-text"
  );

  const previewCss = [
    previewBgClass?.css,
    previewBorderClass?.css,
    previewPrimaryClass?.css,
    previewSecondaryClass?.css,
    previewButtonTextClass?.css,
  ]
    .filter(Boolean)
    .join("\n");

  const loadPortal = useCallback(async () => {
    try {
      const [portalRes, sectionsRes, portalsListRes] = await Promise.all([
        fetch(`/api/admin/portals/${id}`),
        fetch(`/api/admin/portals/${id}/sections`),
        fetch(`/api/admin/portals`), // For parent portal dropdown
      ]);

      if (!portalRes.ok) throw new Error("Portal not found");
      const data = await portalRes.json();
      setPortal(data.portal);
      setName(data.portal.name);
      setTagline(data.portal.tagline || "");
      setStatus(data.portal.status);
      setVisibility(data.portal.visibility);
      setFilters(data.portal.filters || {});
      setBranding(data.portal.branding || {});
      setFeedSettings(data.portal.settings?.feed || {
        feed_type: "default",
        show_activity_tab: true,
        items_per_section: 5,
      });
      setNavLabels(data.portal.settings?.nav_labels || {});

      // Load B2B fields
      setPlan(data.portal.plan || "starter");
      setCustomDomain(data.portal.custom_domain || "");
      setParentPortalId(data.portal.parent_portal_id || null);
      setDomainVerification(data.portal.custom_domain ? {
        verified: data.portal.custom_domain_verified || false,
        token: data.portal.custom_domain_verification_token || null,
      } : null);

      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json();
        setSections(sectionsData.sections || []);
      }

      // Load all portals for parent selection (exclude current portal)
      if (portalsListRes.ok) {
        const portalsData = await portalsListRes.json();
        setAllPortals(
          (portalsData.portals || [])
            .filter((p: { id: string }) => p.id !== id)
            .map((p: { id: string; name: string; slug: string; portal_type: string }) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              portal_type: p.portal_type,
            }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  async function handleVerifyDomain() {
    if (!portal) return;

    setVerifyingDomain(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/portals/${id}/verify-domain`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.verified) {
        setDomainVerification({ verified: true, token: domainVerification?.token || null });
        setSuccess("Domain verified successfully! Your custom domain is now active.");
      } else if (data.error) {
        setError(data.error);
      } else {
        setError(data.message || "Domain verification failed. Please ensure the DNS record is set correctly and try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify domain");
    } finally {
      setVerifyingDomain(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/portals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tagline: tagline || null,
          status,
          visibility,
          filters,
          branding,
          settings: {
            ...portal?.settings,
            feed: feedSettings,
            nav_labels: navLabels,
          },
          // B2B fields
          plan,
          custom_domain: customDomain || null,
          parent_portal_id: parentPortalId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save");
      }

      // If domain verification info is returned, update state
      if (data.domainVerification) {
        setDomainVerification({
          verified: false,
          token: data.domainVerification.txtValue,
        });
      }

      setSuccess("Portal updated successfully");
      loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this portal? This cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/portals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      router.push("/admin/portals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm mb-4">{error || "Portal not found"}</p>
          <Link href="/admin/portals" className="text-[var(--coral)] font-mono text-sm hover:underline">
            Back to Portals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ScopedStyles css={previewCss} />
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
            Admin
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/admin/portals" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)]">
            Portals
          </Link>
          <Link href={`/portal/${portal.slug}`} className="font-mono text-xs text-[var(--coral)] hover:opacity-80" target="_blank">
            View Live
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--cream)]">{portal.name}</h1>
            <p className="font-mono text-xs text-[var(--muted)]">/{portal.slug} · {portal.portal_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded font-mono text-xs ${
              status === "active" ? "bg-green-400/20 text-green-400" :
              status === "draft" ? "bg-yellow-400/20 text-yellow-400" :
              "bg-[var(--twilight)] text-[var(--muted)]"
            }`}>
              {status}
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded">
            <p className="text-red-400 font-mono text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-400/10 border border-green-400/30 rounded">
            <p className="text-green-400 font-mono text-sm">{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Basic Info</h2>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="The real Denver, found"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* B2B Settings */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">B2B Settings</h2>
            <p className="font-mono text-xs text-[var(--soft)] mb-4">
              Configure plan tier, custom domains, and white-label options for B2B portals.
            </p>

            {/* Plan Tier */}
            <div className="mb-6">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Plan Tier</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "starter", label: "Starter", price: "Free", features: "Subdomain, basic branding" },
                  { value: "professional", label: "Professional", price: "$299/mo", features: "Custom domain, full branding" },
                  { value: "enterprise", label: "Enterprise", price: "$999/mo", features: "Full white-label, API access" },
                ].map((tier) => (
                  <label
                    key={tier.value}
                    className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      plan === tier.value
                        ? "border-[var(--coral)] bg-[var(--coral)]/10"
                        : "border-[var(--twilight)] hover:border-[var(--muted)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={tier.value}
                      checked={plan === tier.value}
                      onChange={(e) => setPlan(e.target.value as typeof plan)}
                      className="sr-only"
                    />
                    <div className="font-mono text-sm text-[var(--cream)] font-medium">{tier.label}</div>
                    <div className="font-mono text-xs text-[var(--coral)] mt-0.5">{tier.price}</div>
                    <div className="font-mono text-[0.6rem] text-[var(--muted)] mt-2">{tier.features}</div>
                    {plan === tier.value && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-4 h-4 text-[var(--coral)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Parent Portal (for business portals) */}
            {portal?.portal_type === "business" && (
              <div className="mb-6">
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Parent City Portal</label>
                <p className="font-mono text-[0.65rem] text-[var(--soft)] mb-2">
                  Link to a city portal to inherit its shared event sources via federation.
                </p>
                <select
                  value={parentPortalId || ""}
                  onChange={(e) => setParentPortalId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                >
                  <option value="">No parent (standalone)</option>
                  {allPortals
                    .filter((p) => p.portal_type === "city")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (/{p.slug})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Custom Domain */}
            <div className="mb-6">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Custom Domain</label>
              {plan === "starter" ? (
                <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded text-center">
                  <p className="font-mono text-xs text-[var(--muted)]">
                    Upgrade to Professional or Enterprise to use a custom domain
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-mono text-[0.65rem] text-[var(--soft)] mb-2">
                    Use your own domain (e.g., events.yourcompany.com) instead of {portal?.slug}.lostcity.ai
                  </p>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().replace(/^www\./, ""))}
                    placeholder="events.yourcompany.com"
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />

                  {/* Domain verification status */}
                  {customDomain && domainVerification && (
                    <div className={`mt-3 p-3 rounded border ${
                      domainVerification.verified
                        ? "bg-green-400/10 border-green-400/30"
                        : "bg-yellow-400/10 border-yellow-400/30"
                    }`}>
                      {domainVerification.verified ? (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-mono text-xs text-green-400">Domain verified</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-mono text-xs text-yellow-400">Domain pending verification</span>
                          </div>
                          <p className="font-mono text-[0.65rem] text-[var(--soft)] mb-2">
                            Add this TXT record to your DNS to verify ownership:
                          </p>
                          <div className="bg-[var(--void)] p-2 rounded font-mono text-[0.6rem] space-y-1">
                            <div><span className="text-[var(--muted)]">Host:</span> <span className="text-[var(--cream)]">_lostcity-verify.{customDomain}</span></div>
                            <div><span className="text-[var(--muted)]">Type:</span> <span className="text-[var(--cream)]">TXT</span></div>
                            <div><span className="text-[var(--muted)]">Value:</span> <span className="text-[var(--cream)]">{domainVerification.token}</span></div>
                          </div>
                          <button
                            type="button"
                            onClick={handleVerifyDomain}
                            disabled={verifyingDomain}
                            className="mt-3 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs rounded hover:opacity-90 disabled:opacity-50 w-full"
                          >
                            {verifyingDomain ? "Checking DNS..." : "Verify Domain Now"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Enterprise White-Label Options */}
            {plan === "enterprise" && (
              <div className="pt-4 border-t border-[var(--twilight)]">
                <h3 className="font-mono text-xs text-[var(--soft)] mb-3">White-Label Options</h3>

                <div className="space-y-4">
                  {/* Hide Attribution */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={branding.hide_attribution || false}
                      onChange={(e) => setBranding({ ...branding, hide_attribution: e.target.checked })}
                      className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                    />
                    <div>
                      <span className="font-mono text-sm text-[var(--cream)]">Hide &quot;Powered by Lost City&quot;</span>
                      <p className="font-mono text-[0.6rem] text-[var(--muted)]">Remove all LostCity branding from headers</p>
                    </div>
                  </label>

                  {/* Custom Footer Text */}
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Custom Footer Text</label>
                    <input
                      type="text"
                      value={branding.footer_text || ""}
                      onChange={(e) => setBranding({ ...branding, footer_text: e.target.value || undefined })}
                      placeholder="© 2026 Your Company. All rights reserved."
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>

                  {/* Sharing Brand Name */}
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Sharing Brand Name</label>
                    <p className="font-mono text-[0.65rem] text-[var(--soft)] mb-1">
                      Used in share messages: &quot;Discovered on [Brand Name]&quot;
                    </p>
                    <input
                      type="text"
                      value={branding.sharing_brand_name || ""}
                      onChange={(e) => setBranding({ ...branding, sharing_brand_name: e.target.value || undefined })}
                      placeholder="Your Brand"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>

                  {/* Footer Links */}
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Footer Links</label>
                    <p className="font-mono text-[0.65rem] text-[var(--soft)] mb-2">
                      Add custom links to display in the footer (e.g., Privacy Policy, Terms of Service)
                    </p>

                    {/* Existing links */}
                    <div className="space-y-2 mb-3">
                      {(branding.footer_links || []).map((link, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => {
                              const updated = [...(branding.footer_links || [])];
                              updated[index] = { ...updated[index], label: e.target.value };
                              setBranding({ ...branding, footer_links: updated });
                            }}
                            placeholder="Label"
                            className="flex-1 px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                          />
                          <input
                            type="text"
                            value={link.url}
                            onChange={(e) => {
                              const updated = [...(branding.footer_links || [])];
                              updated[index] = { ...updated[index], url: e.target.value };
                              setBranding({ ...branding, footer_links: updated });
                            }}
                            placeholder="https://..."
                            className="flex-[2] px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (branding.footer_links || []).filter((_, i) => i !== index);
                              setBranding({ ...branding, footer_links: updated.length > 0 ? updated : undefined });
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded"
                            title="Remove link"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add new link button */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = branding.footer_links || [];
                        setBranding({
                          ...branding,
                          footer_links: [...current, { label: "", url: "" }],
                        });
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-[var(--coral)] font-mono text-xs hover:bg-[var(--coral)]/10 rounded border border-dashed border-[var(--twilight)] hover:border-[var(--coral)] w-full justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Footer Link
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Navigation Labels */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Navigation</h2>
            <p className="font-mono text-xs text-[var(--soft)] mb-4">
              Customize the navigation tab labels for this portal. Leave empty to use defaults.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Feed Tab</label>
                <input
                  type="text"
                  value={navLabels.feed || ""}
                  onChange={(e) => setNavLabels({ ...navLabels, feed: e.target.value || undefined })}
                  placeholder="Feed"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Events Tab</label>
                <input
                  type="text"
                  value={navLabels.events || ""}
                  onChange={(e) => setNavLabels({ ...navLabels, events: e.target.value || undefined })}
                  placeholder="Events"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Spots Tab</label>
                <input
                  type="text"
                  value={navLabels.spots || ""}
                  onChange={(e) => setNavLabels({ ...navLabels, spots: e.target.value || undefined })}
                  placeholder="Spots"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>

            </div>

            <div className="mt-4 p-3 bg-[var(--night)] rounded border border-[var(--twilight)]">
              <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase mb-2">Preview</div>
              <div className="flex gap-2">
                {[
                  { key: "feed", default: "Feed" },
                  { key: "events", default: "Events" },
                  { key: "spots", default: "Spots" },
                ].map((tab) => (
                  <span
                    key={tab.key}
                    className="px-3 py-1.5 rounded-md font-mono text-xs bg-[var(--twilight)] text-[var(--cream)]"
                  >
                    {navLabels[tab.key as keyof NavLabels] || tab.default}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Filters */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Filters</h2>
            <p className="font-mono text-xs text-[var(--soft)] mb-4">
              Define what events appear in this portal. Events matching these criteria will be shown.
            </p>

            {/* Location */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Location</h3>
              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={filters.city || ""}
                    onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                    placeholder="Atlanta"
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Geo Lat</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={filters.geo_center?.[0] ?? ""}
                      onChange={(e) => {
                        const lat = e.target.value ? parseFloat(e.target.value) : undefined;
                        if (lat !== undefined) {
                          setFilters({ ...filters, geo_center: [lat, filters.geo_center?.[1] ?? -84.388] });
                        } else {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
const { geo_center: _geo_center, ...rest } = filters;
                          setFilters(rest);
                        }
                      }}
                      placeholder="33.749"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Geo Lng</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={filters.geo_center?.[1] ?? ""}
                      onChange={(e) => {
                        const lng = e.target.value ? parseFloat(e.target.value) : undefined;
                        if (lng !== undefined) {
                          setFilters({ ...filters, geo_center: [filters.geo_center?.[0] ?? 33.749, lng] });
                        } else {
                          // eslint-disable-next-line @typescript-eslint/no-unused-vars
const { geo_center: _geo_center, ...rest } = filters;
                          setFilters(rest);
                        }
                      }}
                      placeholder="-84.388"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Radius (km)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="100"
                      value={filters.geo_radius_km ?? ""}
                      onChange={(e) => setFilters({ ...filters, geo_radius_km: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="25"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Neighborhoods (comma-separated)</label>
                  <input
                    type="text"
                    value={filters.neighborhoods?.join(", ") || ""}
                    onChange={(e) => {
                      const hoods = e.target.value.split(",").map(h => h.trim()).filter(Boolean);
                      setFilters({ ...filters, neighborhoods: hoods.length ? hoods : undefined });
                    }}
                    placeholder="Midtown, East Atlanta, Little Five Points"
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Categories</h3>
              <p className="font-mono text-[0.65rem] text-[var(--muted)] mb-2">
                Select categories to include. Leave all unchecked to include all categories.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {ALL_CATEGORIES.map(cat => {
                  const isChecked = filters.categories?.includes(cat.id) || false;
                  return (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = filters.categories || [];
                          if (e.target.checked) {
                            setFilters({ ...filters, categories: [...current, cat.id] });
                          } else {
                            const updated = current.filter(c => c !== cat.id);
                            setFilters({ ...filters, categories: updated.length ? updated : undefined });
                          }
                        }}
                        className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)] focus:ring-offset-0"
                      />
                      <span className={`font-mono text-xs ${isChecked ? "text-[var(--cream)]" : "text-[var(--muted)] group-hover:text-[var(--soft)]"}`}>
                        {cat.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4">
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Exclude Categories</label>
                <input
                  type="text"
                  value={filters.exclude_categories?.join(", ") || ""}
                  onChange={(e) => {
                    const cats = e.target.value.split(",").map(c => c.trim()).filter(Boolean);
                    setFilters({ ...filters, exclude_categories: cats.length ? cats : undefined });
                  }}
                  placeholder="sports, fitness"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Date Range</h3>
              <p className="font-mono text-[0.65rem] text-[var(--muted)] mb-2">
                Optional: Limit events to a specific date window.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.date_range_start || ""}
                    onChange={(e) => setFilters({ ...filters, date_range_start: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.date_range_end || ""}
                    onChange={(e) => setFilters({ ...filters, date_range_end: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Price</h3>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">
                  Maximum Price {filters.price_max ? `($${filters.price_max})` : "(no limit)"}
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={filters.price_max || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFilters({ ...filters, price_max: val > 0 ? val : undefined });
                  }}
                  className="w-full h-2 bg-[var(--twilight)] rounded-lg appearance-none cursor-pointer accent-[var(--coral)]"
                />
                <div className="flex justify-between font-mono text-[0.6rem] text-[var(--muted)] mt-1">
                  <span>Any</span>
                  <span>$50</span>
                  <span>$100</span>
                  <span>$150</span>
                  <span>$200</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Tags</h3>
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Required Tags (comma-separated)</label>
                <input
                  type="text"
                  value={filters.tags?.join(", ") || ""}
                  onChange={(e) => {
                    const tags = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
                    setFilters({ ...filters, tags: tags.length ? tags : undefined });
                  }}
                  placeholder="outdoor, family-friendly, 21+"
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                />
              </div>
            </div>
          </section>

          {/* Branding */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Branding</h2>

            {/* Theme Mode */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Theme Mode</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme_mode"
                    value="dark"
                    checked={!branding.theme_mode || branding.theme_mode === "dark"}
                    onChange={() => setBranding({ ...branding, theme_mode: "dark" })}
                    className="w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                  />
                  <span className="font-mono text-sm text-[var(--cream)]">Dark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme_mode"
                    value="light"
                    checked={branding.theme_mode === "light"}
                    onChange={() => setBranding({ ...branding, theme_mode: "light" })}
                    className="w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                  />
                  <span className="font-mono text-sm text-[var(--cream)]">Light</span>
                </label>
              </div>
            </div>

            {/* Colors */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Colors</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Background</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.background_color || (branding.theme_mode === "light" ? "#ffffff" : "#0a0a12")}
                      onChange={(e) => setBranding({ ...branding, background_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.background_color || ""}
                      onChange={(e) => setBranding({ ...branding, background_color: e.target.value || undefined })}
                      placeholder={branding.theme_mode === "light" ? "#ffffff" : "#0a0a12"}
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Text</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.text_color || (branding.theme_mode === "light" ? "#1a1a1a" : "#f5f0eb")}
                      onChange={(e) => setBranding({ ...branding, text_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.text_color || ""}
                      onChange={(e) => setBranding({ ...branding, text_color: e.target.value || undefined })}
                      placeholder={branding.theme_mode === "light" ? "#1a1a1a" : "#f5f0eb"}
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Muted</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.muted_color || "#888888"}
                      onChange={(e) => setBranding({ ...branding, muted_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.muted_color || ""}
                      onChange={(e) => setBranding({ ...branding, muted_color: e.target.value || undefined })}
                      placeholder="#888888"
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Primary/Button</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.primary_color || "#E87B6B"}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.primary_color || ""}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value || undefined })}
                      placeholder="#E87B6B"
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Accent</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.accent_color || "#00d4ff"}
                      onChange={(e) => setBranding({ ...branding, accent_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.accent_color || ""}
                      onChange={(e) => setBranding({ ...branding, accent_color: e.target.value || undefined })}
                      placeholder="#00d4ff"
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Border</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.secondary_color || "#2a2a4a"}
                      onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                      className="w-10 h-10 rounded border border-[var(--twilight)] cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={branding.secondary_color || ""}
                      onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value || undefined })}
                      placeholder="#2a2a4a"
                      className="flex-1 px-2 py-1 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="mb-6">
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Images</h3>
              <div className="space-y-3">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={branding.logo_url || ""}
                    onChange={(e) => setBranding({ ...branding, logo_url: e.target.value || undefined })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Hero Image URL</label>
                  <input
                    type="text"
                    value={branding.hero_image_url || ""}
                    onChange={(e) => setBranding({ ...branding, hero_image_url: e.target.value || undefined })}
                    placeholder="https://example.com/hero.jpg"
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Favicon URL</label>
                    <input
                      type="text"
                      value={branding.favicon_url || ""}
                      onChange={(e) => setBranding({ ...branding, favicon_url: e.target.value || undefined })}
                      placeholder="https://example.com/favicon.ico"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">OG Image URL</label>
                    <input
                      type="text"
                      value={branding.og_image_url || ""}
                      onChange={(e) => setBranding({ ...branding, og_image_url: e.target.value || undefined })}
                      placeholder="https://example.com/og.png"
                      className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div>
              <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Typography</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Heading Font</label>
                  <select
                    value={branding.font_heading || ""}
                    onChange={(e) => setBranding({ ...branding, font_heading: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  >
                    <option value="">Default (Playfair Display)</option>
                    <option value="Playfair Display">Playfair Display</option>
                    <option value="Cormorant Garamond">Cormorant Garamond</option>
                    <option value="Libre Baskerville">Libre Baskerville</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="Outfit">Outfit</option>
                    <option value="Syne">Syne</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Body Font</label>
                  <select
                    value={branding.font_body || ""}
                    onChange={(e) => setBranding({ ...branding, font_body: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  >
                    <option value="">Default (Inter)</option>
                    <option value="Inter">Inter</option>
                    <option value="DM Sans">DM Sans</option>
                    <option value="Space Grotesk">Space Grotesk</option>
                    <option value="IBM Plex Sans">IBM Plex Sans</option>
                    <option value="Work Sans">Work Sans</option>
                    <option value="Nunito">Nunito</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Preview */}
            {(branding.primary_color || branding.secondary_color || branding.background_color) && (
              <div className="mt-6 pt-4 border-t border-[var(--twilight)]">
                <h3 className="font-mono text-xs text-[var(--soft)] mb-3">Preview</h3>
                <div
                  className={`p-4 rounded-lg border bg-[var(--preview-bg)] border-[var(--preview-border)] ${
                    previewBgClass?.className ?? ""
                  } ${previewBorderClass?.className ?? ""} ${previewPrimaryClass?.className ?? ""} ${
                    previewSecondaryClass?.className ?? ""
                  } ${previewButtonTextClass?.className ?? ""}`}
                >
                  <div
                    className="font-serif text-lg mb-2 text-[var(--preview-primary)]"
                  >
                    {name || "Portal Name"}
                  </div>
                  <div
                    className="font-mono text-sm text-[var(--preview-secondary)]"
                  >
                    {tagline || "Portal tagline goes here"}
                  </div>
                  <button
                    className="mt-3 px-4 py-1.5 rounded font-mono text-xs bg-[var(--preview-primary)] text-[var(--preview-button-text)]"
                  >
                    Sample Button
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Feed Configuration */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Feed Configuration</h2>
            <p className="font-mono text-xs text-[var(--soft)] mb-4">
              Configure how the portal feed displays content to visitors.
            </p>

            {/* Feed Type */}
            <div className="mb-6">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Feed Type</label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="feed_type"
                    value="default"
                    checked={feedSettings.feed_type === "default"}
                    onChange={() => setFeedSettings({ ...feedSettings, feed_type: "default" })}
                    className="mt-1 w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                  />
                  <div>
                    <div className="font-mono text-sm text-[var(--cream)] group-hover:text-[var(--coral)]">Default Feed</div>
                    <div className="font-mono text-xs text-[var(--muted)]">User-personalized events based on their preferences</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="feed_type"
                    value="sections"
                    checked={feedSettings.feed_type === "sections"}
                    onChange={() => setFeedSettings({ ...feedSettings, feed_type: "sections" })}
                    className="mt-1 w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                  />
                  <div>
                    <div className="font-mono text-sm text-[var(--cream)] group-hover:text-[var(--coral)]">Section-Based Feed</div>
                    <div className="font-mono text-xs text-[var(--muted)]">Display curated sections you&apos;ve created</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="feed_type"
                    value="custom"
                    checked={feedSettings.feed_type === "custom"}
                    onChange={() => setFeedSettings({ ...feedSettings, feed_type: "custom" })}
                    className="mt-1 w-4 h-4 text-[var(--coral)] border-[var(--twilight)] bg-[var(--night)] focus:ring-[var(--coral)]"
                  />
                  <div>
                    <div className="font-mono text-sm text-[var(--cream)] group-hover:text-[var(--coral)]">Hybrid Feed</div>
                    <div className="font-mono text-xs text-[var(--muted)]">Featured sections + personalized recommendations</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Section Selection - show when sections or custom feed type */}
            {(feedSettings.feed_type === "sections" || feedSettings.feed_type === "custom") && (
              <div className="mb-6 pt-4 border-t border-[var(--twilight)]">
                <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">Featured Sections</label>
                {sections.length === 0 ? (
                  <div className="p-4 bg-[var(--night)] rounded border border-[var(--twilight)] text-center">
                    <p className="font-mono text-xs text-[var(--muted)] mb-2">No sections created yet</p>
                    <Link
                      href={`/admin/portals/${id}/sections`}
                      className="font-mono text-xs text-[var(--coral)] hover:underline"
                    >
                      Create sections first
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sections.map((section) => {
                      const isSelected = feedSettings.featured_section_ids?.includes(section.id) || false;
                      return (
                        <label
                          key={section.id}
                          className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[var(--coral)]/10 border-[var(--coral)]"
                              : "bg-[var(--night)] border-[var(--twilight)] hover:border-[var(--muted)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const current = feedSettings.featured_section_ids || [];
                              if (e.target.checked) {
                                setFeedSettings({
                                  ...feedSettings,
                                  featured_section_ids: [...current, section.id],
                                });
                              } else {
                                setFeedSettings({
                                  ...feedSettings,
                                  featured_section_ids: current.filter((id) => id !== section.id),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-[var(--cream)]">{section.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-mono ${
                                section.section_type === "curated"
                                  ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                                  : "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                              }`}>
                                {section.section_type}
                              </span>
                              {!section.is_visible && (
                                <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-mono bg-[var(--twilight)] text-[var(--muted)]">
                                  hidden
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[0.6rem] text-[var(--muted)]">/{section.slug}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Feed Options */}
            <div className="pt-4 border-t border-[var(--twilight)]">
              <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-3">Options</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feedSettings.show_activity_tab ?? true}
                    onChange={(e) => setFeedSettings({ ...feedSettings, show_activity_tab: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--twilight)] bg-[var(--night)] text-[var(--coral)] focus:ring-[var(--coral)]"
                  />
                  <span className="font-mono text-sm text-[var(--cream)]">Show Activity/Friends tab</span>
                </label>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-1">Items per Section</label>
                  <select
                    value={feedSettings.items_per_section || 5}
                    onChange={(e) => setFeedSettings({ ...feedSettings, items_per_section: parseInt(e.target.value) })}
                    className="px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
                  >
                    <option value={3}>3 items</option>
                    <option value={5}>5 items</option>
                    <option value={10}>10 items</option>
                    <option value={15}>15 items</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Content Management */}
          <section className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg p-6">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">Content</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="font-mono text-2xl text-[var(--cream)]">{portal.member_count}</div>
                <div className="font-mono text-xs text-[var(--muted)]">Members</div>
              </div>
              <div>
                <div className="font-mono text-2xl text-[var(--cream)]">{portal.content_count}</div>
                <div className="font-mono text-xs text-[var(--muted)]">Content Items</div>
              </div>
              <div>
                <div className="font-mono text-2xl text-[var(--cream)]">{portal.section_count}</div>
                <div className="font-mono text-xs text-[var(--muted)]">Sections</div>
              </div>
            </div>
            <Link
              href={`/admin/portals/${id}/sections`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded hover:bg-[var(--muted)]/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Manage Sections
            </Link>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            {portal.slug !== DEFAULT_PORTAL_SLUG && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-400 font-mono text-sm hover:text-red-300"
              >
                Delete Portal
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
