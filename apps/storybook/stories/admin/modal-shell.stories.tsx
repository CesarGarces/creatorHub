import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ModalShell } from "@admin/components/modal-shell";
import { withAdminApp } from "../../.storybook/decorators/admin";
import { viewport } from "../../.storybook/viewports";

const meta = {
  title: "Admin/Overlays/ModalShell",
  component: ModalShell,
  decorators: [withAdminApp],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Overlay + panel of the admin\'s inline forms (credit plans, modes, tool modes, credit emails). Layout only — open state stays with the page. `role="dialog"` named by `labelledBy`; never taller than the visible viewport, so the form scrolls while the on-screen keyboard is open.',
      },
      story: { inline: false, iframeHeight: 600 },
    },
  },
  argTypes: {
    labelledBy: {
      description: "`id` of the element that titles the dialog.",
      control: "text",
    },
    size: {
      description: "Max width: `md` 28rem · `lg` 32rem · `5xl` 64rem.",
      control: "inline-radio",
      options: ["md", "lg", "5xl"],
      table: { defaultValue: { summary: "md" } },
    },
    className: { description: "Extra classes for the panel.", control: "text" },
    children: { description: "Dialog content.", control: false },
  },
  args: {
    labelledBy: "plan-form-title",
    size: "md",
    children: (
      <form className="space-y-4">
        <h2 id="plan-form-title" className="text-lg font-semibold text-text">
          Create Credit Plan
        </h2>
        {["Slug", "Name", "Description", "Price (USD)", "Credits Given"].map(
          (label) => (
            <label key={label} className="block text-sm font-medium text-text">
              {label}
              <input className="mt-1 w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text" />
            </label>
          ),
        )}
        <div className="grid grid-cols-2 gap-3 pt-2 sm:flex sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-muted sm:min-h-0 sm:py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground sm:min-h-0 sm:py-2"
          >
            Create Plan
          </button>
        </div>
      </form>
    ),
  },
} satisfies Meta<typeof ModalShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = { globals: viewport("desktop") };
export const Mobile: Story = { globals: viewport("mobileSmall") };
