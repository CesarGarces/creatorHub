import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FavoritesWidget } from "@/components/dashboard-widgets/widgets/favorites-widget";
import { useFavoritesStore } from "@/store/favorites.store";
import { useToolsStore } from "@/store/tools.store";
import {
  seedWebSession,
  withWebApp,
} from "../../../../.storybook/decorators/web";
import { viewport } from "../../../../.storybook/viewports";
import { dashboardApi } from "../../../fixtures/dashboard";

const meta = {
  title: "Web/Dashboard/Widgets/FavoritesWidget",
  component: FavoritesWidget,
  decorators: [withWebApp],
  beforeEach: () => {
    seedWebSession();
    useToolsStore.setState({ tools: [] });
    useFavoritesStore.setState({ favoriteIds: [] });
  },
  parameters: {
    layout: "padded",
    api: dashboardApi(),
    docs: {
      description: {
        component:
          "Dashboard widget: the user's favorite tools in their order — each card has its own drag handle (44px on touch, `touch-action: none`) that reorders favorites and never lifts the whole widget — or quick access to the first four tools when there are no favorites. Placeholders hold the grid until tools and favorites have loaded.",
      },
    },
  },
} satisfies Meta<typeof FavoritesWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Favorites: Story = {};
export const QuickAccess: Story = {
  name: "No favorites (quick access)",
  parameters: { api: { ...dashboardApi(), "/user/favorites": [] } },
};
export const Phone: Story = { globals: viewport("mobile") };
