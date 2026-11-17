import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import tailwindcss from "@tailwindcss/vite";
import {
  appAliasPlugin,
  repoRoot,
  workspaceSourceAliases,
} from "./monorepo-aliases.ts";

const configDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Storybook for the Creator Hub monorepo.
 *
 * - Framework: Next.js on Vite (`next/link`, `next/navigation`, `next/image`
 *   work in stories of app components).
 * - Styling: Tailwind CSS v4 through its Vite plugin; `preview.css` imports
 *   the web app's design tokens and scans every UI source folder.
 * - Stories live in `apps/storybook/stories`, mirroring the component tree
 *   (`tests/story-coverage.spec.ts` enforces one story per component).
 */
const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-themes",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  // Logos and other public assets referenced as `/isologo_white.png`.
  staticDirs: [{ from: "../../web/public", to: "/" }],
  core: {
    disableTelemetry: true,
  },
  typescript: {
    // Prop tables and controls come from the components' TypeScript types
    // and JSDoc. Inherited DOM attributes are hidden to keep them readable.
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      // Covers the component sources outside this package.
      tsconfigPath: path.join(configDir, "../tsconfig.docgen.json"),
      // Globs are resolved from this package: list the monorepo sources.
      include: [
        "../../packages/ui/src/**/*.tsx",
        "../../packages/i18n/src/**/*.tsx",
        "../web/src/components/**/*.tsx",
        "../admin/src/components/**/*.tsx",
      ],
      exclude: ["**/*.stories.tsx", "**/__tests__/**"],
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
  async viteFinal(viteConfig) {
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      tailwindcss(),
      appAliasPlugin(),
    ];
    viteConfig.resolve = {
      ...viteConfig.resolve,
      alias: [
        ...Object.entries(workspaceSourceAliases).map(
          ([find, replacement]) => ({
            find: new RegExp(`^${find.replace("/", "\\/")}$`),
            replacement,
          }),
        ),
        ...(Array.isArray(viteConfig.resolve?.alias)
          ? viteConfig.resolve.alias
          : Object.entries(viteConfig.resolve?.alias ?? {}).map(
              ([find, replacement]) => ({ find, replacement }),
            )),
      ],
    };
    viteConfig.server = {
      ...viteConfig.server,
      fs: { ...viteConfig.server?.fs, allow: [repoRoot] },
    };
    viteConfig.define = {
      ...viteConfig.define,
      // The apps read these at module load; stories never reach a backend
      // (see `.storybook/mocks/api.ts`).
      "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
        "http://localhost:3001/api/v1",
      ),
    };
    viteConfig.build = {
      ...viteConfig.build,
      // The static build is a dev tool: keep it quiet about large chunks.
      chunkSizeWarningLimit: 4096,
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        onwarn(warning, warn) {
          // `"use client"` is meaningful to Next.js only; Vite drops it.
          // (dropping it also leaves the source map unable to point at it).
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" ||
            warning.code === "SOURCEMAP_ERROR"
          ) {
            return;
          }
          warn(warning);
        },
      },
    };
    return viteConfig;
  },
};

export default config;
