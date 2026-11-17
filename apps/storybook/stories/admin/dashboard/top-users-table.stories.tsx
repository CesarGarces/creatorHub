import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TopUsersTable } from "@admin/components/dashboard/top-users-table";
import { withAdminApp } from "../../../.storybook/decorators/admin";
import { viewport } from "../../../.storybook/viewports";

const meta = {
  title: "Admin/Dashboard/TopUsersTable",
  component: TopUsersTable,
  decorators: [withAdminApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A `table-stack` table: inside its `@container` wrapper, when the table has less than 48rem of room each row becomes a card and each cell a “label — value” line (`data-label`; `data-primary` titles the card). Same DOM and table semantics. Resize with the viewport toolbar to see it switch.",
      },
    },
  },
  argTypes: {
    users: {
      description: "Top users (from `GET /admin/dashboard/top-users`).",
      control: "object",
    },
  },
  args: {
    users: [
      {
        userId: "u1",
        userName: "Ana Creator",
        userEmail: "ana.creator@example.com",
        userPlan: "STARTER",
        usageCount: 128,
        creditsUsed: 4200,
      },
      {
        userId: "u2",
        userName: "Bruno Silva",
        userEmail: "bruno@example.com",
        userPlan: "FREE",
        usageCount: 42,
        creditsUsed: 380,
      },
    ],
  },
} satisfies Meta<typeof TopUsersTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const StackedOnMobile: Story = { globals: viewport("mobile") };
export const Empty: Story = { args: { users: [] } };
