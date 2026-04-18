import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level React error boundary.
 *
 * Catches render-phase exceptions anywhere below it, renders a user-friendly
 * fallback, and ships a minimal telemetry payload to /api/client-errors so the
 * ops team can see production crashes. Never throws itself — telemetry failures
 * are swallowed.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Fire-and-forget telemetry. No retries — if it fails, we don't know.
    try {
      const payload = {
        message: error?.message ?? "Unknown error",
        stack: (error?.stack ?? "").slice(0, 4000),
        componentStack: (errorInfo?.componentStack ?? "").slice(0, 4000),
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        timestamp: new Date().toISOString(),
      };
      fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
    // Also log to console for local dev
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  handleHome = () => {
    if (typeof window !== "undefined") window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. Our team has been notified. You can try reloading
              the page, or return home.
            </p>
            {this.state.error?.message && (
              <details className="text-xs text-muted-foreground text-left bg-muted/40 rounded-lg p-3">
                <summary className="cursor-pointer select-none">Technical details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                Reload
              </button>
              <button
                onClick={this.handleHome}
                className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-accent"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
