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
import { useI18n } from "@/i18n/i18n-provider";

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

type DefaultItemId =
  | "thumbnail"
  | "xPostAgent"
  | "xResearchAgent"
  | "dashboard"
  | "tools"
  | "agents"
  | "credits"
  | "history"
  | "settings";

type GroupId = "tools" | "agents" | "navigation" | "account";

const defaultItemDefs: {
  id: DefaultItemId;
  icon: React.ReactNode;
  href: string;
  group: GroupId;
}[] = [
  {
    id: "thumbnail",
    icon: <Palette className="h-4 w-4 text-text-dim" />,
    href: "/tools/thumbnail-generator",
    group: "tools",
  },
  {
    id: "xPostAgent",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/tools/x-post-tweet",
    group: "agents",
  },
  {
    id: "xResearchAgent",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/tools/x-search-trends",
    group: "agents",
  },
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-4 w-4 text-text-dim" />,
    href: "/dashboard",
    group: "navigation",
  },
  {
    id: "tools",
    icon: <Wrench className="h-4 w-4 text-text-dim" />,
    href: "/tools",
    group: "navigation",
  },
  {
    id: "agents",
    icon: <Bot className="h-4 w-4 text-text-dim" />,
    href: "/agents",
    group: "navigation",
  },
  {
    id: "credits",
    icon: <CreditCard className="h-4 w-4 text-text-dim" />,
    href: "/credits",
    group: "account",
  },
  {
    id: "history",
    icon: <History className="h-4 w-4 text-text-dim" />,
    href: "/history",
    group: "navigation",
  },
  {
    id: "settings",
    icon: <Settings className="h-4 w-4 text-text-dim" />,
    href: "/settings",
    group: "account",
  },
];

export function CommandPalette({
  isOpen,
  onClose,
  items,
}: CommandPaletteProps) {
  const router = useRouter();
  const { t } = useI18n();

  const resolvedItems: CommandItem[] =
    items ??
    defaultItemDefs.map((def) => ({
      id: def.id,
      label: t(`commandPalette.items.${def.id}.label`),
      description: t(`commandPalette.items.${def.id}.description`),
      icon: def.icon,
      href: def.href,
      category: t(`commandPalette.groups.${def.group}`),
    }));

  const grouped = resolvedItems.reduce(
    (acc, item) => {
      const cat = item.category || t("commandPalette.groups.other");
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
      <CommandInput placeholder={t("commandPalette.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("commandPalette.empty")}</CommandEmpty>
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
