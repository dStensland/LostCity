"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary for non-critical feed sections.
 * Renders nothing on error so one broken section can't crash the whole feed.
 */
export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[SectionErrorBoundary] Section crashed:", error.message);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
