"use client";

import { useCallback } from "react";
import { DEFAULT_LOCALE } from "./config";
import { useI18n } from "./i18n-provider";

interface ToolLike {
  id: string;
  name: string;
  description: string;
}

/**
 * Localized display text for tools that come from the API.
 *
 * Tool records are authored in English in the database, so English shows
 * them verbatim (respecting admin edits). Other languages use the
 * `toolCatalog` translations and fall back to the API text for unknown tools.
 */
export function useToolText() {
  const { locale, tOptional } = useI18n();
  const useSource = locale === DEFAULT_LOCALE;

  const toolName = useCallback(
    (tool: ToolLike) =>
      useSource
        ? tool.name
        : tOptional(`toolCatalog.${tool.id}.name`, tool.name),
    [useSource, tOptional],
  );

  const toolDescription = useCallback(
    (tool: ToolLike) =>
      useSource
        ? tool.description
        : tOptional(`toolCatalog.${tool.id}.description`, tool.description),
    [useSource, tOptional],
  );

  const categoryLabel = useCallback(
    (category: string) =>
      tOptional(`toolCatalog.categories.${category}`, category),
    [tOptional],
  );

  return { toolName, toolDescription, categoryLabel };
}
