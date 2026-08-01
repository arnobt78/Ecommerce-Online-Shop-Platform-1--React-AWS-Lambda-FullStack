import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Sentry } from "../../lib/sentry";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level React error boundary.
 * Catches render-time errors in the component tree below it and shows a
 * recoverable fallback instead of an unstyled white screen. Must be a class
 * component — React error boundaries have no hook equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled UI error:", error, errorInfo);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: errorInfo.componentStack } },
    });
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = "/";
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark px-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h1 className="text-xl font-medium text-red-800 dark:text-red-200 mb-2">
                Something went wrong
              </h1>
              <p className="text-red-700 dark:text-red-300 mb-4 text-sm">
                An unexpected error occurred. Please try reloading the page.
              </p>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-sm"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
