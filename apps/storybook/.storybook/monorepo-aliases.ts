import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");

const WEB_SRC = path.join(repoRoot, "apps/web/src");
const ADMIN_SRC = path.join(repoRoot, "apps/admin/src");

/**
 * Workspace packages are read from source (not `dist/`), so stories, docs
 * (react-docgen) and the app components all share one copy of each module —
 * e.g. a single React context for `UiLabelsProvider`.
 */
export const workspaceSourceAliases: Record<string, string> = {
  "@creator-hub/ui": path.join(repoRoot, "packages/ui/src/index.ts"),
  "@creator-hub/i18n": path.join(repoRoot, "packages/i18n/src/index.ts"),
  // Its dist is CommonJS; the TypeScript source is plain ESM.
  "@creator-hub/shared-types": path.join(
    repoRoot,
    "packages/shared-types/src/index.ts",
  ),
};

/**
 * Both Next.js apps map `@/*` to their own `src/`. Stories render components
 * of both apps, so `@/` is resolved per importer: files under apps/admin use
 * the admin sources, everything else uses the web app's. Stories import
 * admin components through `@admin/*`.
 */
export function appAliasPlugin(): Plugin {
  return {
    name: "creator-hub:app-alias",
    enforce: "pre",
    async resolveId(source, importer, options) {
      let target: string;
      if (source.startsWith("@admin/")) {
        // Explicit entry point for admin components in stories.
        target = path.join(ADMIN_SRC, source.slice("@admin/".length));
      } else if (source.startsWith("@/")) {
        const base =
          importer && path.resolve(importer).startsWith(ADMIN_SRC)
            ? ADMIN_SRC
            : WEB_SRC;
        target = path.join(base, source.slice(2));
      } else {
        return null;
      }
      const resolved = await this.resolve(target, importer, {
        ...options,
        skipSelf: true,
      });
      return resolved ?? target;
    },
  };
}
