import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  DashboardWidgets,
  type DashboardWidgetsProps,
} from "@/components/dashboard-widgets/widget-grid";
import { seedWebSession, withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import {
  CUSTOM_LAYOUT,
  DEFAULT_LAYOUT,
  dashboardApi,
  seedDashboardLayout,
} from "../../fixtures/dashboard";

/** Keeps `editing` in state so Done / a long press work in the canvas. */
function Controlled(args: DashboardWidgetsProps) {
  const [editing, setEditing] = useState(args.editing);
  return (
    <div className="p-4 sm:p-6">
      <DashboardWidgets
        {...args}
        editing={editing}
        onEditingChange={(next) => {
          setEditing(next);
          args.onEditingChange(next);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Web/Dashboard/DashboardWidgets",
  component: DashboardWidgets,
  decorators: [withWebApp],
  beforeEach: () => {
    seedWebSession();
    seedDashboardLayout(DEFAULT_LAYOUT);
  },
  render: (args) => <Controlled {...args} />,
  parameters: {
    layout: "fullscreen",
    api: dashboardApi(DEFAULT_LAYOUT),
    nextjs: { appDirectory: true, navigation: { pathname: "/dashboard" } },
    docs: {
      description: {
        component:
          "The dashboard's widgets in the user's order (Settings → Dashboard chooses which). One column on phones and tablets, two from `lg` (`full` widgets span both). Each widget is its own lazy chunk, loaded — with its data — when it nears the viewport; a same-size placeholder holds the space. " +
          "**Press and hold** a widget (~0.4 s, mouse or finger) to pick it up: the dashboard switches to rearranging (iOS-style wobble), the widget follows the pointer with a bounce, neighbours make room and it bounces into place on release (order saved). While rearranging: drag right away (touch: short hold, so swipes scroll), `−` hides a widget (with Undo), the grip button moves one with the keyboard, Done/Escape finishes. Motion stops with reduced motion.",
      },
    },
  },
  args: { editing: false, onEditingChange: fn() },
  argTypes: {
    editing: {
      description: "Rearranging mode (wobble, `−` badges, edit bar).",
      control: "boolean",
    },
    onEditingChange: {
      description:
        "Rearranging started (long press, Customize) or finished (Done, Escape).",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
} satisfies Meta<typeof DashboardWidgets>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { globals: viewport("desktop") };

export const Rearranging: Story = {
  args: { editing: true },
  globals: viewport("desktop"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Hide Recent activity" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Move Recent activity" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Done" }));
    await expect(
      canvas.queryByRole("button", { name: "Hide Recent activity" }),
    ).toBeNull();
  },
};

export const CustomLayout: Story = {
  name: "Custom layout (credits on top)",
  beforeEach: () => seedDashboardLayout(CUSTOM_LAYOUT),
  parameters: { api: dashboardApi(CUSTOM_LAYOUT) },
  globals: viewport("desktop"),
};

export const Empty: Story = {
  name: "Every widget hidden",
  beforeEach: () =>
    seedDashboardLayout(DEFAULT_LAYOUT.map((w) => ({ ...w, visible: false }))),
  parameters: {
    api: dashboardApi(DEFAULT_LAYOUT.map((w) => ({ ...w, visible: false }))),
  },
};

export const Phone: Story = { globals: viewport("mobile") };

export const PhoneRearranging: Story = {
  name: "Phone · rearranging",
  args: { editing: true },
  globals: viewport("mobileSmall"),
};
