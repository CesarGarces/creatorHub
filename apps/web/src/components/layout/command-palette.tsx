"use client";

import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@creator-hub/ui";
import {
  Palette,
  Bot,
  LayoutDashboard,
  Wrench,
  CreditCard,
  History,
  Settings,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
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
  {
    id: "thumbnail",
    label: "Thumbnail Generator",
    description: "Create stunning thumbnails",
    icon: <Palette className="h-4 w-4 text-text-dim" />,
    href: "/tools/thumbnail-generator",
    category: "Tools",
  },
  {
    id: "x-post-agent",
    label: "X Post Agent",
    description: "Publish tweets to X",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/tools/x-post-tweet",
    category: "Agents",
  },
  {
    id: "x-research-agent",
    label: "X Research Agent",
    description: "Search X trends",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/tools/x-search-trends",
    category: "Agents",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Go to dashboard",
    icon: <LayoutDashboard className="h-4 w-4 text-text-dim" />,
    href: "/dashboard",
    category: "Navigation",
  },
  {
    id: "tools",
    label: "All Tools",
    description: "Browse all tools",
    icon: <Wrench className="h-4 w-4 text-text-dim" />,
    href: "/tools",
    category: "Navigation",
  },
  {
    id: "agents",
    label: "All Agents",
    description: "Browse all agents",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/agents",
    category: "Navigation",
  },
  {
    id: "credits",
    label: "Credits",
    description: "Manage your credits",
    icon: <CreditCard className="h-4 w-4 text-text-dim" />,
    href: "/credits",
    category: "Account",
  },
  {
    id: "history",
    label: "History",
    description: "View generation history",
    icon: <History className="h-4 w-4 text-text-dim" />,
    href: "/history",
    category: "Navigation",
  },
  {
    id: "settings",
    label: "Settings",
    description: "App settings",
    icon: <Settings className="h-4 w-4 text-text-dim" />,
    href: "/settings",
    category: "Account",
  },
];

export function CommandPalette({
  isOpen,
  onClose,
  items = defaultItems,
}: CommandPaletteProps) {
  const router = useRouter();

  const grouped = items.reduce(
    (acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, CommandItem[]>,
  );

  const handleSelect = (item: CommandItem) => {
    if (item.action) item.action();
    else if (item.href) router.push(item.href);
    onClose();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CommandInput placeholder="Search tools, agents, pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(grouped).map(([category, items]) => (
          <CommandGroup key={category} heading={category}>
            {items.map((item) => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item)}>
                {item.icon}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-text-dim truncate mt-0.5">
                      {item.description}
                    </p>
                  )}
                </div>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
