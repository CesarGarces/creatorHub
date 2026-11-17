import { create } from "storybook/theming";

/** Storybook's own UI and docs pages, in the product's dark palette. */
export const creatorHubTheme = create({
  base: "dark",
  brandTitle: "Creator Hub · UI",
  brandUrl: "https://app.creatorhubplatform.com",
  brandImage: "/isologo_white.png",
  brandTarget: "_blank",

  colorPrimary: "#00bbd9",
  colorSecondary: "#00bbd9",

  appBg: "#0b0f19",
  appContentBg: "#121826",
  appPreviewBg: "#0b0f19",
  appBorderColor: "#1e293b",
  appBorderRadius: 8,

  textColor: "#f1f5f9",
  textMutedColor: "#94a3b8",
  textInverseColor: "#0b0f19",

  barBg: "#121826",
  barTextColor: "#94a3b8",
  barSelectedColor: "#00bbd9",
  barHoverColor: "#00bbd9",

  inputBg: "#1a2236",
  inputBorder: "#1e293b",
  inputTextColor: "#f1f5f9",
  inputBorderRadius: 6,

  fontBase: '"Inter", ui-sans-serif, system-ui, sans-serif',
  fontCode: '"JetBrains Mono", ui-monospace, monospace',
});
