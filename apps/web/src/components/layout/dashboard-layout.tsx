"use client";

import { cn } from "@creator-hub/ui";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { useMobileNavStore } from "@/store/mobile-nav.store";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * App shell, mobile-first:
 * - phones & portrait tablets: full-width content, navigation in a drawer
 *   (closed by default) opened from the top bar;
 * - `lg` and up: docked, collapsible sidebar.
 * `h-dvh` follows the browser UI and the on-screen keyboard.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const mobileNavOpen = useMobileNavStore((s) => s.isOpen);
  const closeMobileNav = useMobileNavStore((s) => s.close);

  return (
    <div className="group/shell flex h-dvh overflow-hidden bg-bg">
      <Sidebar />
      {/* Drawer backdrop: tap outside to close (below lg only). */}
      <div
        aria-hidden="true"
        data-testid="mobile-nav-backdrop"
        onClick={closeMobileNav}
        className={cn(
          "fixed inset-0 z-[105] bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Bottom room on every screen so the chat launcher never covers
            the last row of content (cards' action buttons, pagination…).
            Pages with their own bottom composer (`data-composer`) fill the
            height instead — the launcher floats above the composer — and
            desktop split layouts sized to the viewport (`data-full-height`)
            keep no extra room from lg. */}
        <main className="flex-1 overflow-y-auto overscroll-contain pb-[calc(5.5rem+env(safe-area-inset-bottom))] has-[[data-composer]]:pb-0 lg:has-[[data-full-height]]:pb-0">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
