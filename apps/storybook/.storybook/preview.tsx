import type { Preview } from "@storybook/nextjs-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { LocaleSync, toLocale } from "./decorators/locale";
import { installApiMock, setApiRoutes, type ApiRoutes } from "./mocks/api";
import { creatorHubTheme } from "./theme";
import { VIEWPORTS } from "./viewports";
import "./preview.css";

installApiMock();

/**
 * Project-wide annotations. Every story gets:
 * - the app stylesheet (Tailwind v4 + tokens) and the dark theme,
 * - a theme switch (Dark · Light preview) and a language switch (EN/ES/PT)
 *   in the toolbar — app components read `globals.locale`,
 * - responsive viewport presets (mobile → desktop),
 * - the mocked API (`parameters.api`), and Next.js App Router mocks.
 */
const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    locale: {
      description: "Interface language of the app components",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: [
          { value: "en", right: "🇺🇸", title: "English" },
          { value: "es", right: "🇪🇸", title: "Español" },
          { value: "pt", right: "🇧🇷", title: "Português" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: "en",
    viewport: { value: undefined, isRotated: false },
  },
  parameters: {
    layout: "centered",
    controls: {
      expanded: true,
      sort: "requiredFirst",
      matchers: {
        color: /(background|color)$/i,
        date: /(Date|At)$/,
      },
    },
    // The theme addon paints the canvas with the app background.
    backgrounds: { disable: true },
    docs: {
      theme: creatorHubTheme,
      toc: true,
    },
    viewport: {
      options: VIEWPORTS,
    },
    a11y: {
      // axe runs on every story with the rule set of the e2e audits
      // (apps/e2e/fixtures/a11y.ts). Findings show in the Accessibility
      // panel; `apps/e2e/tests/storybook.stories.spec.ts` fails the build on
      // any contrast, missing-name/label or critical violation.
      test: "todo",
      options: {
        runOnly: {
          type: "tag",
          values: [
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22aa",
            "best-practice",
          ],
        },
      },
    },
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/dashboard" },
    },
  },
  decorators: [
    (Story, { parameters, globals }) => {
      setApiRoutes(parameters.api as ApiRoutes | undefined);
      return (
        <LocaleSync locale={toLocale(globals.locale)}>
          <Story />
        </LocaleSync>
      );
    },
    withThemeByClassName({
      themes: { Dark: "dark", "Light (preview)": "light" },
      defaultTheme: "Dark",
      parentSelector: "html",
    }),
  ],
};

export default preview;
