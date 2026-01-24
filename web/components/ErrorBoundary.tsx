"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  onRetry,
  title = "Something broke",
  description = "Probably our fault. This stuff is hard, ok?",
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Error illustration */}
      <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--neon-red)]/10" />
        <svg
          className="w-10 h-10 text-[var(--neon-red)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-medium text-[var(--cream)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--muted)] mb-6 max-w-sm">{description}</p>

      {/* Error details (collapsed by default in production) */}
      {error && process.env.NODE_ENV === "development" && (
        <details className="mb-6 w-full max-w-md text-left">
          <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-[var(--soft)]">
            Error details
          </summary>
          <pre className="mt-2 p-3 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-xs text-[var(--neon-red)] overflow-auto max-h-40">
            {error.message}
            {error.stack && (
              <>
                {"\n\n"}
                {error.stack}
              </>
            )}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors font-mono text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Try again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]/80 transition-colors font-mono text-sm"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}

// Hook for error boundaries with async error handling
export function useErrorHandler() {
  return (error: Error) => {
    // Re-throw to be caught by nearest error boundary
    throw error;
  };
}

export default ErrorBoundary;
