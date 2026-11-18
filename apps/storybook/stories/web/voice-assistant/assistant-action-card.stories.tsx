import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { AssistantActionCard } from "@/components/voice-assistant/assistant-action-card";
import { withWebApp } from "../../../.storybook/decorators/web";

const event = (
  id: string,
  title: string,
  type: string,
  start: string,
  end: string,
) => ({
  id,
  title,
  type,
  startAt: `2026-11-28T${start}:00.000Z`,
  endAt: `2026-11-28T${end}:00.000Z`,
});

const CREATED = {
  id: "a1",
  name: "calendar.create_event",
  args: { title: "Record the unboxing" },
  status: "done" as const,
  summary: "Created",
  data: {
    kind: "calendar-event" as const,
    change: "created" as const,
    event: event("ev1", "Record the unboxing", "RECORDING", "20:00", "21:30"),
    conflicts: [],
    url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
  },
};

const meta = {
  title: "Web/Voice assistant/AssistantActionCard",
  component: AssistantActionCard,
  decorators: [
    (Story) => (
      <div className="w-[26rem] max-w-full">
        <Story />
      </div>
    ),
    withWebApp,
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "What Robotina **did** during a reply (ARCHITECTURE.md §14g “Actions”): a session she added, moved or deleted in the Content Planner (with its type, day and time, its previous time, overlap warnings and a link to the planner on that week), a video project she created, changed or deleted, the agenda or projects she read, a deletion waiting for the user's “yes”, an action in progress, or one that failed (she explains why out loud). Shown in the chat bubbles and, compact, on the dashboard widget. Times are in the user's language and time zone.",
      },
    },
  },
  argTypes: {
    action: { description: "The action record (status, result data)." },
    compact: {
      description: "One line (dashboard widget).",
      control: "boolean",
    },
  },
  args: { action: CREATED, compact: false },
} satisfies Meta<typeof AssistantActionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EventCreated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Added to your calendar")).toBeVisible();
    await expect(canvas.getByText("Record the unboxing")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Open in planner →" }),
    ).toHaveAttribute("href", CREATED.data.url);
  },
};

export const WithOverlap: Story = {
  args: {
    action: {
      ...CREATED,
      data: {
        ...CREATED.data,
        conflicts: [
          event("ev9", "Weekly livestream", "LIVESTREAM", "20:30", "22:00"),
        ],
      },
    },
  },
};

export const Compact: Story = { args: { compact: true } };

/** "Move the recording to 5 pm": the new time and the previous one. */
export const Moved: Story = {
  args: {
    action: {
      ...CREATED,
      name: "calendar.update_event",
      data: {
        ...CREATED.data,
        change: "updated",
        event: event(
          "ev1",
          "Record the unboxing",
          "RECORDING",
          "22:00",
          "23:30",
        ),
        previous: {
          startAt: "2026-11-28T20:00:00.000Z",
          endAt: "2026-11-28T21:30:00.000Z",
        },
      },
    },
  },
};

/** A delete never runs at once: she asks, the user says "yes" next. */
export const AwaitingConfirmation: Story = {
  args: {
    action: {
      ...CREATED,
      name: "calendar.delete_event",
      status: "needs_confirmation",
      data: { ...CREATED.data, change: "deleted" },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText("Waiting for your OK to delete"),
    ).toBeVisible();
  },
};

export const Deleted: Story = {
  args: {
    action: {
      ...CREATED,
      name: "calendar.delete_event",
      data: { ...CREATED.data, change: "deleted" },
    },
  },
};

const PROJECT = {
  id: "p1",
  title: "Phone review",
  platform: "youtube-long",
  publishAt: "2026-12-10T23:00:00.000Z",
  sessions: { total: 5, done: 2 },
};

export const ProjectCreated: Story = {
  args: {
    action: {
      id: "a5",
      name: "calendar.create_project",
      args: {},
      status: "done",
      data: {
        kind: "calendar-project",
        change: "created",
        project: PROJECT,
        url: "/tools/content-planner",
      },
    },
  },
};

export const Projects: Story = {
  args: {
    action: {
      id: "a6",
      name: "calendar.list_projects",
      args: {},
      status: "done",
      data: {
        kind: "calendar-projects",
        projects: [
          PROJECT,
          { ...PROJECT, id: "p2", title: "Weekly vlog", publishAt: null },
        ],
        url: "/tools/content-planner",
      },
    },
  },
};

export const Agenda: Story = {
  args: {
    action: {
      id: "a2",
      name: "calendar.list_events",
      args: { date: "2026-11-28" },
      status: "done",
      data: {
        kind: "calendar-agenda",
        from: "2026-11-28",
        days: 1,
        events: [
          event("e1", "Script the intro", "SCRIPTING", "14:00", "15:30"),
          event("e2", "Record the unboxing", "RECORDING", "20:00", "21:30"),
        ],
        url: "/tools/content-planner",
      },
    },
  },
};

export const Running: Story = {
  args: {
    action: {
      id: "a3",
      name: "calendar.create_event",
      args: {},
      status: "running",
    },
  },
};

export const Failed: Story = {
  args: {
    action: {
      id: "a4",
      name: "calendar.create_event",
      args: {},
      status: "failed",
    },
  },
};
