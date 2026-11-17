import { addons } from "storybook/manager-api";
import { creatorHubTheme } from "./theme";

addons.setConfig({
  theme: creatorHubTheme,
  sidebar: { showRoots: true },
});
