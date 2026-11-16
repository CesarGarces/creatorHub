"use client";

import Link from "next/link";
import { ExternalLink, Wrench } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { toolUrl } from "@/lib/content-planner/ai-plan";
import type { ToolAction } from "@/lib/content-planner/types";
import { useToolsStore } from "@/store/tools.store";
import { useToolText } from "@/i18n/use-tool-text";

/**
 * A platform tool suggested for a step or session: which tool, why
 * (intention), what to ask it, and a link that opens it pre-filled.
 */
export function ToolActionCard({
  action,
  toolName,
  compact = false,
  className,
}: {
  action: ToolAction;
  /** Name from the plan; otherwise looked up in the tool catalogue. */
  toolName?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const tools = useToolsStore((s) => s.tools);
  const { toolName: localizedName } = useToolText();
  const tool = tools.find((x) => x.id === action.toolId);
  const name = tool ? localizedName(tool) : (toolName ?? action.toolId);

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs",
        className,
      )}
      data-testid="tool-action"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 font-medium text-primary">
          <Wrench className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </p>
        <Link
          href={toolUrl(action)}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
          aria-label={t("contentPlanner.ai.openToolAria", { tool: name })}
        >
          {t("contentPlanner.ai.openTool")}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-1 text-text-muted">
        <span className="text-text-dim">
          {t("contentPlanner.ai.intention")}:{" "}
        </span>
        {action.intention}
      </p>
      {!compact && action.prompt && (
        <p className="mt-1 line-clamp-2 italic text-text-dim">
          “{action.prompt}”
        </p>
      )}
    </div>
  );
}
