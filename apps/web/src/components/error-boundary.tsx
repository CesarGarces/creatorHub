"use client";

import { Component, type ReactNode } from "react";
import { useI18n } from "@/i18n/i18n-provider";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center p-4 text-sm text-text-muted">
      <p>{t("ui.errorBoundary")}</p>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chat widget error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback />;
    }

    return this.props.children;
  }
}
