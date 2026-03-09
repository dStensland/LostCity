"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PortalBranding = {
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
};

export type FeedSettings = {
  feed_type: "default" | "sections" | "custom";
  featured_event_id?: number;
  featured_section_ids?: string[];
  section_order?: string[];
  show_activity_tab?: boolean;
  items_per_section?: number;
};

export type NavLabels = {
  feed?: string;
  find?: string;
  community?: string;
  groups?: string;
  events?: string;
  spots?: string;
};

export type PortalFilters = {
  city?: string;
  geo_center?: [number, number];
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

export type PortalSection = {
  id: string;
  title: string;
  slug: string;
  section_type: "auto" | "curated" | "mixed";
  is_visible: boolean;
  display_order: number;
};

export type Portal = {
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
  settings: Record<string, unknown> & { feed?: FeedSettings; nav_labels?: NavLabels };
  members: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
  sections?: PortalSection[];
  member_count: number;
  content_count: number;
  section_count: number;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

type PortalEditContextValue = {
  portal: Portal | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;

  // Form state
  name: string;
  setName: (v: string) => void;
  tagline: string;
  setTagline: (v: string) => void;
  status: "draft" | "active" | "archived";
  setStatus: (v: "draft" | "active" | "archived") => void;
  visibility: "public" | "unlisted" | "private";
  setVisibility: (v: "public" | "unlisted" | "private") => void;
  filters: PortalFilters;
  setFilters: (v: PortalFilters) => void;
  branding: PortalBranding;
  setBranding: (v: PortalBranding) => void;
  feedSettings: FeedSettings;
  setFeedSettings: (v: FeedSettings) => void;
  navLabels: NavLabels;
  setNavLabels: (v: NavLabels) => void;
  sections: PortalSection[];

  // Actions
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  reload: () => Promise<void>;
};

const PortalEditContext = createContext<PortalEditContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PortalEditProvider({
  portalId,
  children,
}: {
  portalId: string;
  children: ReactNode;
}) {
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

  const loadPortal = useCallback(async () => {
    try {
      const [portalRes, sectionsRes] = await Promise.all([
        fetch(`/api/admin/portals/${portalId}`),
        fetch(`/api/admin/portals/${portalId}/sections`),
      ]);

      if (!portalRes.ok) throw new Error("Portal not found");
      const data = await portalRes.json();
      const p = data.portal as Portal;
      setPortal(p);
      setName(p.name);
      setTagline(p.tagline || "");
      setStatus(p.status);
      setVisibility(p.visibility);
      setFilters(p.filters || {});
      setBranding(p.branding || {});
      setFeedSettings(
        p.settings?.feed || {
          feed_type: "default",
          show_activity_tab: true,
          items_per_section: 5,
        }
      );
      setNavLabels((p.settings?.nav_labels as NavLabels) || {});

      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json();
        setSections(sectionsData.sections || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [portalId]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  const handleSave = useCallback(async () => {
    if (!portal) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/portals/${portalId}`, {
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
            ...portal.settings,
            feed: feedSettings,
            nav_labels: navLabels,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setSuccess("Portal updated successfully");
      loadPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    portal,
    portalId,
    name,
    tagline,
    status,
    visibility,
    filters,
    branding,
    feedSettings,
    navLabels,
    loadPortal,
  ]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this portal? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/portals/${portalId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      // Redirect handled by the calling component
      window.location.href = "/admin/portals";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }, [portalId]);

  return (
    <PortalEditContext.Provider
      value={{
        portal,
        loading,
        saving,
        error,
        success,
        setError,
        setSuccess,
        name,
        setName,
        tagline,
        setTagline,
        status,
        setStatus,
        visibility,
        setVisibility,
        filters,
        setFilters,
        branding,
        setBranding,
        feedSettings,
        setFeedSettings,
        navLabels,
        setNavLabels,
        sections,
        handleSave,
        handleDelete,
        reload: loadPortal,
      }}
    >
      {children}
    </PortalEditContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePortalEdit() {
  const ctx = useContext(PortalEditContext);
  if (!ctx) throw new Error("usePortalEdit must be used inside PortalEditProvider");
  return ctx;
}
