"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface MapErrorBoundaryProps {
  children: ReactNode;
  /** href to navigate to when the user clicks "Switch to List view" */
  listHref?: string;
  onSwitchToList?: () => void;
}

interface MapErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary for MapViewWrapper.
 *
 * WebGL contexts are a finite GPU resource — browsers cap them per page (often
 * 8–16). Opening/closing the map repeatedly, or having multiple portals open,
 * can exhaust them. When that happens the canvas throws "WebGL context lost"
 * or similar, crashing the component subtree.
 *
 * This boundary catches those crashes and shows a graceful fallback instead of
 * a blank or broken page, with a button to switch back to list view.
 */
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message ?? "Unknown map error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for debugging without leaking to the user
    console.error("[MapErrorBoundary] Map render failed:", error, info);
  }

  handleSwitchToList = () => {
    // Reset boundary state so a future switch-back-to-map attempt starts fresh
    this.setState({ hasError: false, errorMessage: "" });
    this.props.onSwitchToList?.();
    if (this.props.listHref) {
      window.location.href = this.props.listHref;
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center"
        style={{
          background: "var(--night)",
          borderTop: "1px solid color-mix(in srgb, var(--twilight) 85%, transparent)",
          minHeight: "clamp(200px, 40vh, 400px)",
        }}
      >
        {/* Map icon with slash */}
        <div
          className="relative flex items-center justify-center w-12 h-12 rounded-full"
          style={{ background: "color-mix(in srgb, var(--twilight) 60%, transparent)" }}
          aria-hidden="true"
        >
          <svg
            className="w-6 h-6"
            style={{ color: "var(--muted)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <svg
            className="absolute inset-0 w-12 h-12"
            style={{ color: "var(--coral)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 48 48"
          >
            <line x1="8" y1="8" x2="40" y2="40" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="space-y-1">
          <p
            className="font-mono text-sm font-semibold"
            style={{ color: "var(--cream)" }}
          >
            Map unavailable
          </p>
          <p
            className="font-mono text-xs"
            style={{ color: "var(--muted)" }}
          >
            Your browser&rsquo;s GPU ran out of map contexts.
            <br />
            Switch to List view to continue browsing.
          </p>
        </div>

        <button
          onClick={this.handleSwitchToList}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "color-mix(in srgb, var(--coral) 18%, transparent)",
            border: "1px solid color-mix(in srgb, var(--coral) 55%, transparent)",
            color: "var(--coral)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Switch to List view
        </button>
      </div>
    );
  }
}
