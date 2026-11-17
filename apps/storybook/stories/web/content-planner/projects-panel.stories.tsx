import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ProjectsPanel } from "@/components/content-planner/projects-panel";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import { PLANNER_PROJECTS } from "../../fixtures/planner";

const meta = {
  title: "Web/Content Planner/ProjectsPanel",
  component: ProjectsPanel,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Video projects with their progress and next session. Selecting a project highlights its sessions; the icon buttons jump to the publish date or delete the project (40px on touch screens: `pointer-coarse:h-10`). " +
          "Below `lg` it sits under the calendar and flows with the page; from `lg` it is a 300px side column with its own scroll.",
      },
    },
  },
  argTypes: {
    projects: {
      description: "Projects (from `GET /tools/content-planner/projects`).",
      control: "object",
    },
    focusedProjectId: {
      description: "Highlighted project.",
      control: "select",
      options: [null, "proj-1", "proj-2"],
    },
    onToggleFocus: {
      description: "A project was selected/deselected.",
      table: { category: "Events" },
    },
    onGoToDate: {
      description: "“Go to publish date” pressed.",
      table: { category: "Events" },
    },
  },
  args: {
    projects: PLANNER_PROJECTS,
    focusedProjectId: null,
    onToggleFocus: fn(),
    onGoToDate: fn(),
  },
} satisfies Meta<typeof ProjectsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithProjects: Story = {};
export const Focused: Story = { args: { focusedProjectId: "proj-1" } };
export const Empty: Story = { args: { projects: [] } };
export const Mobile: Story = { globals: viewport("mobile") };
