"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@creator-hub/ui";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  href?: string;
  action?: () => void;
  category?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items?: CommandItem[];
}

const defaultItems: CommandItem[] = [
  { id: "thumbnail", label: "Thumbnail Generator", description: "Create stunning thumbnails", icon: "🎨", href: "/tools/thumbnail-generator", category: "Tools" },
  { id: "youtube-agent", label: "YouTube Agent", description: "Plan and optimize YouTube content", icon: "🤖", href: "/agents/youtube", category: "Agents" },
  { id: "dashboard", label: "Dashboard", description: "Go to dashboard", icon: "🏠", href: "/dashboard", category: "Navigation" },
  { id: "tools", label: "All Tools", description: "Browse all tools", icon: "🛠️", href: "/tools", category: "Navigation" },
  { id: "agents", label: "All Agents", description: "Browse all agents", icon: "🤖", href: "/agents", category: "Navigation" },
  { id: "credits", label: "Credits", description: "Manage your credits", icon: "💎", href: "/credits", category: "Account" },
  { id: "history", label: "History", description: "View generation history", icon: "📜", href: "/history", category: "Navigation" },
  { id: "settings", label: "Settings", description: "App settings", icon: "⚙️", href: "/settings", category: "Account" },
];

export function CommandPalette({ isOpen, onClose, items = defaultItems }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const flatFiltered = Object.values(grouped).flat();

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action) item.action();
      else if (item.href) router.push(item.href);
      onClose();
      setQuery("");
    },
    [router, onClose]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
        handleSelect(flatFiltered[selectedIndex]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatFiltered, selectedIndex, handleSelect]);

  if (!isOpen) return null;

  let runningIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, agents, pages..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-dim outline-none"
          />
          <kbd className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-dim font-mono">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-dim">
                {category}
              </div>
              {items.map((item) => {
                runningIndex++;
                const idx = runningIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      idx === selectedIndex ? "bg-primary/10 text-text" : "text-text-muted hover:bg-surface-elevated"
                    )}
                  >
                    {item.icon && <span className="text-lg">{item.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-text-dim truncate">{item.description}</p>
                      )}
                    </div>
                    {idx === selectedIndex && (
                      <span className="text-[10px] text-text-dim">↵</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {flatFiltered.length === 0 && (
            <div className="py-8 text-center text-sm text-text-dim">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
}
