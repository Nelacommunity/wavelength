"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

/** Keeps one failing section from taking down the whole page. */
export class SectionBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          {this.props.label ?? "This section"} couldn&apos;t load right now.
          <button type="button" className="ml-auto font-semibold text-fg hover:underline" onClick={() => location.reload()}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
