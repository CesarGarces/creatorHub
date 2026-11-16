import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

// This dialog is a large form (two 16-option pickers per edited step, the
// steps list, the preview): role queries over it take ~1 s per test alone
// and several times longer when every workspace suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 });

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";
import { PlanVideoDialog } from "@/components/content-planner/plan-video-dialog";
import { EventDialog } from "@/components/content-planner/event-dialog";
import { useContentPlannerStore } from "@/store/content-planner.store";
import type {
  ProductionStep,
  SavedProductionStep,
} from "@/lib/content-planner/steps";

const actions = {
  createProject: vi.fn(),
  saveProductionSteps: vi.fn(),
  fetchProductionSteps: vi.fn(),
  fetchCustomPlatforms: vi.fn(),
  createCustomPlatform: vi.fn(),
  deleteCustomPlatform: vi.fn(),
  createCustomType: vi.fn(),
  createEvent: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useContentPlannerStore.setState(
    useContentPlannerStore.getInitialState(),
    true,
  );
  useContentPlannerStore.setState({
    ...actions,
    productionSteps: [],
    customPlatforms: [],
  });
  actions.createProject.mockResolvedValue({ projectId: "p1", conflicts: [] });
  actions.saveProductionSteps.mockResolvedValue(undefined);
  actions.fetchProductionSteps.mockResolvedValue(undefined);
  actions.fetchCustomPlatforms.mockResolvedValue(undefined);
  actions.createEvent.mockResolvedValue([]);
});

function renderDialog() {
  const props = { onClose: vi.fn(), onPlanned: vi.fn() };
  render(<PlanVideoDialog open {...props} />);
  return props;
}

const total = () => screen.getByTestId("plan-total").textContent;
const stepNames = () =>
  screen
    .getAllByTestId(/^step-row-/)
    .map((row) => within(row).getAllByRole("checkbox")[0]!)
    .map(
      (box) =>
        screen.getByText((_, el) => el?.getAttribute("for") === box.id)
          .textContent,
    );
const preview = () =>
  within(screen.getByRole("list", { name: "Schedule preview" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");

function fillBasics(title = "My video") {
  fireEvent.change(screen.getByLabelText("Video title"), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText("Publish date"), {
    target: { value: "2030-03-08" }, // a Friday
  });
}
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Create plan" }));
const sentEvents = () =>
  actions.createProject.mock.calls[0]![0].events as Array<
    Record<string, unknown>
  >;

// ─── Steps list, preview and total ───────────────────────────────────

describe("production steps", () => {
  it("shows the built-in steps with a total of 11h 30m", () => {
    renderDialog();
    expect(stepNames()).toEqual([
      "Ideation",
      "Scripting",
      "Recording",
      "Editing",
      "Thumbnail",
      "PublishingAt publish time",
    ]);
    expect(total()).toBe("Total plan: 11h 30m");
    expect(preview()).toHaveLength(6);
  });

  it("updates the preview and the total as durations and toggles change", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Editing duration in minutes"), {
      target: { value: "90" },
    });
    expect(total()).toBe("Total plan: 9h");

    fireEvent.click(screen.getByRole("checkbox", { name: "Thumbnail" }));
    expect(total()).toBe("Total plan: 8h");
    expect(preview().some((p) => p.includes("Thumbnail"))).toBe(false);

    fireEvent.change(screen.getByLabelText("Publishing duration in minutes"), {
      target: { value: "45" },
    });
    expect(total()).toBe("Total plan: 8h 15m");
  });

  it("shows minutes only for short plans", () => {
    renderDialog();
    for (const name of [
      "Ideation",
      "Scripting",
      "Recording",
      "Editing",
      "Thumbnail",
    ]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }
    expect(total()).toBe("Total plan: 30m");
  });

  it("deletes a step with its trash button", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete Scripting" }));

    expect(stepNames()).not.toContain("Scripting");
    expect(preview().some((p) => p.includes("Scripting"))).toBe(false);
    expect(total()).toBe("Total plan: 9h 30m");
  });

  it("edits a step's name, color and icon, and sends that look with its session", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Edit Recording" }));
    fireEvent.change(screen.getByLabelText("Step name"), {
      target: { value: "Filming" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Teal" }));
    fireEvent.click(screen.getByRole("radio", { name: "Microphone" }));
    // The preview follows the edit right away.
    expect(preview().some((p) => p.includes("Filming"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(stepNames()).toContain("Filming");
    const dot = within(screen.getByRole("list", { name: "Schedule preview" }))
      .getAllByRole("listitem")[2]!
      .querySelector("span");
    expect(dot?.className).toContain("bg-teal-400");

    fillBasics();
    submit();
    await waitFor(() => expect(actions.createProject).toHaveBeenCalled());
    const filming = sentEvents().find((e) => e.title === "Filming: My video");
    expect(filming).toMatchObject({
      type: "RECORDING",
      customType: { name: "Filming", color: "teal", icon: "mic" },
    });
    // Untouched built-in steps keep their type and send no look.
    expect(
      sentEvents().find((e) => e.title === "Editing: My video"),
    ).not.toHaveProperty("customType");
  });

  it("picking the built-in look again keeps a step untouched", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Edit Ideation" }));
    fireEvent.click(screen.getByRole("radio", { name: "Teal" }));
    fireEvent.click(screen.getByRole("radio", { name: "Amber" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    fillBasics();
    submit();
    await waitFor(() => expect(actions.createProject).toHaveBeenCalled());
    expect(sentEvents()[0]).not.toHaveProperty("customType");
    expect(sentEvents()[0]).toMatchObject({ type: "IDEATION" });
  });

  it("adds a new step before publishing and opens it for editing", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    const name = screen.getByLabelText("Step name") as HTMLInputElement;
    expect(name.value).toBe("New step");
    fireEvent.change(name, { target: { value: "Voiceover" } });
    fireEvent.keyDown(name, { key: "Enter" }); // Enter = Done, not "Create plan"

    expect(actions.createProject).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Step name")).toBeNull();
    expect(stepNames().slice(-2)).toEqual([
      "Voiceover",
      "PublishingAt publish time",
    ]);
    expect(total()).toBe("Total plan: 12h 30m");
  });

  it("requires a name for steps the user added", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(screen.getByLabelText("Step name"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Every step needs a name",
    );
    expect(screen.getByLabelText("Step name")).toBeTruthy(); // still editing
  });

  it("clearing a built-in step's name brings back its own name", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Edit Editing" }));
    fireEvent.change(screen.getByLabelText("Step name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(stepNames()).toContain("Editing");
  });

  it("reorders steps by dragging their handle (keyboard sensor)", async () => {
    // jsdom has no layout: give each row a position so dnd-kit can sort.
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const row = this.closest("[data-testid^='step-row-']");
        const rows = Array.from(
          document.querySelectorAll("[data-testid^='step-row-']"),
        );
        const top = Math.max(0, rows.indexOf(row as Element)) * 50;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          bottom: top + 40,
          right: 300,
          width: 300,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect;
      });
    try {
      renderDialog();
      const handle = screen.getByRole("button", {
        name: "Drag to reorder Editing",
      });
      handle.focus();
      // dnd-kit measures between key presses: let each step settle.
      const press = async (target: Element | Document, code: string) => {
        fireEvent.keyDown(target, { code });
        await act(() => new Promise((r) => setTimeout(r, 30)));
      };
      await press(handle, "Space");
      await press(document, "ArrowUp");
      await press(document, "ArrowUp");
      await press(document, "Space");

      await waitFor(() =>
        expect(stepNames()).toEqual([
          "Ideation",
          "Editing",
          "Scripting",
          "Recording",
          "Thumbnail",
          "PublishingAt publish time",
        ]),
      );
      // The schedule follows the new order.
      expect(preview()[1]).toContain("Editing");
    } finally {
      rect.mockRestore();
    }
  });

  it("keeps the publishing step pinned last (no drag handle)", () => {
    renderDialog();
    expect(
      screen.queryByRole("button", { name: "Drag to reorder Publishing" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Drag to reorder Ideation" }),
    ).toBeTruthy();
  });

  it("resets to the default steps", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete Scripting" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Editing" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reset to default steps" }),
    );
    expect(stepNames()).toHaveLength(6);
    expect(total()).toBe("Total plan: 11h 30m");
  });

  it("starts from the user's saved steps", () => {
    const saved: SavedProductionStep[] = [
      {
        baseType: null,
        name: "Voiceover",
        color: "orange",
        icon: "mic",
        durationMinutes: 45,
        enabled: true,
        isPublish: false,
      },
      {
        baseType: "PUBLISHING",
        name: null,
        color: null,
        icon: null,
        durationMinutes: 30,
        enabled: true,
        isPublish: true,
      },
    ];
    useContentPlannerStore.setState({ productionSteps: saved });
    renderDialog();
    expect(stepNames()).toEqual(["Voiceover", "PublishingAt publish time"]);
    expect(total()).toBe("Total plan: 1h 15m");
  });

  it("refuses two customised steps with the same name", async () => {
    renderDialog();
    for (const name of ["Voiceover", "voiceover"]) {
      fireEvent.click(screen.getByRole("button", { name: "Add step" }));
      fireEvent.change(screen.getByLabelText("Step name"), {
        target: { value: name },
      });
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    }
    fillBasics();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Two steps are called “voiceover”. Give each step its own name.",
    );
    expect(actions.createProject).not.toHaveBeenCalled();
  });

  it("refuses to plan when every step is disabled", async () => {
    renderDialog();
    fillBasics();
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    expect(
      screen.getByText("Enable at least one step to see the schedule."),
    ).toBeTruthy();
    expect(total()).toBe("Total plan: 0m");
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Enable at least one production step",
    );
    expect(actions.createProject).not.toHaveBeenCalled();
  });
});

// ─── Creating the plan ───────────────────────────────────────────────

describe("creating the plan", () => {
  it("creates every session, then remembers the steps for next time", async () => {
    const props = renderDialog();
    fillBasics();
    fireEvent.click(screen.getByRole("button", { name: "Delete Thumbnail" }));
    submit();

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(actions.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My video",
        platform: "youtube-long",
        publishAt: new Date(2030, 2, 8, 18, 0).toISOString(),
      }),
    );
    expect(
      sentEvents().map((e) => [
        e.title,
        new Date(e.startAt as string).toString().slice(0, 21),
      ]),
    ).toEqual([
      ["Ideation: My video", "Mon Mar 04 2030 10:00"],
      ["Scripting: My video", "Tue Mar 05 2030 10:00"],
      ["Recording: My video", "Wed Mar 06 2030 10:00"],
      ["Editing: My video", "Thu Mar 07 2030 10:00"],
      ["Publishing: My video", "Fri Mar 08 2030 18:00"],
    ]);
    const saved = actions.saveProductionSteps.mock
      .calls[0]![0] as SavedProductionStep[];
    expect(saved.map((s) => s.baseType)).toEqual([
      "IDEATION",
      "SCRIPTING",
      "RECORDING",
      "EDITING",
      "PUBLISHING",
    ]);
    expect(saved[0]).not.toHaveProperty("key");
    expect(props.onPlanned).toHaveBeenCalledWith(new Date(2030, 2, 4, 10, 0));
    expect(toast.success).toHaveBeenCalledWith(
      "“My video” is planned: 5 sessions added",
    );
  });

  it("still finishes (with a warning) when the steps can't be remembered", async () => {
    actions.saveProductionSteps.mockRejectedValue(new Error("offline"));
    const props = renderDialog();
    fillBasics();
    submit();
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(toast.warning).toHaveBeenCalledWith(
      "The plan was created, but your steps couldn't be saved for next time.",
    );
  });

  it("does not remember the steps when the plan fails", async () => {
    actions.createProject.mockRejectedValue(
      new Error("You can have up to 30 custom types"),
    );
    renderDialog();
    fillBasics();
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "You can have up to 30 custom types",
    );
    expect(actions.saveProductionSteps).not.toHaveBeenCalled();
  });
});

// ─── Custom platforms ────────────────────────────────────────────────

describe("custom platforms", () => {
  beforeEach(() => {
    actions.createCustomPlatform.mockImplementation(async (name: string) => {
      const created = { id: "pl1", name };
      useContentPlannerStore.setState((s) => ({
        customPlatforms: [...s.customPlatforms, created],
      }));
      return created;
    });
    actions.deleteCustomPlatform.mockImplementation(async (id: string) => {
      useContentPlannerStore.setState((s) => ({
        customPlatforms: s.customPlatforms.filter((p) => p.id !== id),
      }));
    });
  });
  const platformSelect = () =>
    screen.getByLabelText("Platform") as HTMLSelectElement;

  it("adds a platform with the + button and plans the video on it", async () => {
    renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom platform" }),
    );
    fireEvent.change(screen.getByLabelText("Platform name"), {
      target: { value: " Kick " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add platform" }));

    await waitFor(() => expect(platformSelect().value).toBe("custom:pl1"));
    expect(actions.createCustomPlatform).toHaveBeenCalledWith("Kick");
    expect(
      within(platformSelect()).getByRole("group", { name: "Custom platforms" }),
    ).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("Platform “Kick” added");

    fillBasics();
    submit();
    await waitFor(() => expect(actions.createProject).toHaveBeenCalled());
    const input = actions.createProject.mock.calls[0]![0];
    expect(input.customPlatformId).toBe("pl1");
    expect(input).not.toHaveProperty("platform");
  });

  it("pressing Enter adds the platform instead of submitting the plan", async () => {
    renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom platform" }),
    );
    const field = screen.getByLabelText("Platform name");
    fireEvent.change(field, { target: { value: "Kick" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() =>
      expect(actions.createCustomPlatform).toHaveBeenCalled(),
    );
    expect(actions.createProject).not.toHaveBeenCalled();
  });

  it("rejects blank names and names that already exist (built-in included)", () => {
    useContentPlannerStore.setState({
      customPlatforms: [{ id: "pl0", name: "Kick" }],
    });
    renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom platform" }),
    );
    const add = () =>
      fireEvent.click(screen.getByRole("button", { name: "Add platform" }));

    add();
    expect(screen.getByRole("alert").textContent).toBe(
      "Give the platform a name",
    );
    for (const taken of ["KICK", "tiktok"]) {
      fireEvent.change(screen.getByLabelText("Platform name"), {
        target: { value: taken },
      });
      add();
      expect(screen.getByRole("alert").textContent).toBe(
        "That platform already exists",
      );
    }
    expect(actions.createCustomPlatform).not.toHaveBeenCalled();
  });

  it("deletes the selected custom platform after confirming", async () => {
    useContentPlannerStore.setState({
      customPlatforms: [{ id: "pl1", name: "Kick" }],
    });
    renderDialog();
    expect(
      screen.queryByRole("button", { name: "Delete custom platform" }),
    ).toBeNull();
    fireEvent.change(platformSelect(), { target: { value: "custom:pl1" } });

    fireEvent.click(
      screen.getByRole("button", { name: "Delete custom platform" }),
    );
    expect(screen.getByText("Delete “Kick”?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() =>
      expect(actions.deleteCustomPlatform).toHaveBeenCalledWith("pl1"),
    );
    await waitFor(() => expect(platformSelect().value).toBe("youtube-long"));
  });
});

// ─── Custom types get an icon too ────────────────────────────────────

describe("custom type icon", () => {
  it("creates a custom type with the chosen icon from the session dialog", async () => {
    actions.createCustomType.mockResolvedValue({
      id: "t1",
      name: "Podcast",
      color: "teal",
      icon: "mic",
    });
    render(
      <EventDialog
        target={{ mode: "create", start: new Date(2026, 2, 4, 10, 0) }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create custom type" }));
    fireEvent.change(screen.getByLabelText("Type name"), {
      target: { value: "Podcast" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Microphone" }));
    fireEvent.click(screen.getByRole("button", { name: "Add type" }));
    await waitFor(() =>
      expect(actions.createCustomType).toHaveBeenCalledWith(
        "Podcast",
        "teal",
        "mic",
      ),
    );
  });
});

describe("plan reminders", () => {
  it("applies the chosen reminder to every planned session", async () => {
    renderDialog();
    const reminder = screen.getByLabelText(
      "Remind me before each session",
    ) as HTMLSelectElement;
    expect(reminder.value).toBe("15");
    fireEvent.change(reminder, { target: { value: "1440" } });
    fillBasics();
    submit();
    await waitFor(() => expect(actions.createProject).toHaveBeenCalled());
    expect(new Set(sentEvents().map((e) => e.reminderMinutes))).toEqual(
      new Set([1440]),
    );
  });
});

// ─── Continuing from the AI planner ─────────────────────────────────

describe("review of an AI plan", () => {
  const aiSteps = (): ProductionStep[] => [
    {
      key: "a",
      baseType: "SCRIPTING",
      name: null,
      color: null,
      icon: null,
      durationMinutes: 60,
      enabled: true,
      isPublish: false,
      toolAction: {
        toolId: "script-writer",
        intention: "Draft the script",
        prompt: "Write it",
      },
    },
    {
      key: "b",
      baseType: "RECORDING",
      name: "Dough timelapse",
      color: null,
      icon: null,
      durationMinutes: 120,
      enabled: true,
      isPublish: false,
    },
    {
      key: "c",
      baseType: "PUBLISHING",
      name: null,
      color: null,
      icon: null,
      durationMinutes: 30,
      enabled: true,
      isPublish: true,
    },
  ];

  function renderWithInitial() {
    const props = { onClose: vi.fn(), onPlanned: vi.fn() };
    render(
      <PlanVideoDialog
        open
        {...props}
        initial={{
          title: "Sourdough",
          platformValue: "tiktok",
          publishDate: "2030-03-08",
          publishTime: "17:30",
          steps: aiSteps(),
          aiPlanId: "plan-1",
        }}
      />,
    );
    return props;
  }

  it("starts from the AI plan instead of the saved steps", () => {
    useContentPlannerStore.setState({
      productionSteps: [
        {
          baseType: "EDITING",
          name: null,
          durationMinutes: 90,
          enabled: true,
          isPublish: false,
        },
      ] as SavedProductionStep[],
    });
    renderWithInitial();
    expect(
      (screen.getByLabelText("Video title") as HTMLInputElement).value,
    ).toBe("Sourdough");
    expect(
      (screen.getByLabelText("Publish date") as HTMLInputElement).value,
    ).toBe("2030-03-08");
    expect(
      (screen.getByLabelText("Publish time") as HTMLInputElement).value,
    ).toBe("17:30");
    expect(stepNames()).toEqual([
      "Scripting",
      "Dough timelapse",
      "PublishingAt publish time",
    ]);
    expect(total()).toBe("Total plan: 3h 30m");
    expect(
      screen.getByRole("img", {
        name: "Suggested tool: script-writer — Draft the script",
      }),
    ).toBeTruthy();
  });

  it("links the project to the plan, keeps tool actions and does not overwrite saved steps", async () => {
    const props = renderWithInitial();
    submit();
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(actions.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sourdough",
        platform: "tiktok",
        aiPlanId: "plan-1",
        publishAt: new Date(2030, 2, 8, 17, 30).toISOString(),
      }),
    );
    expect(sentEvents()[0]).toMatchObject({
      type: "SCRIPTING",
      toolAction: { toolId: "script-writer", intention: "Draft the script" },
    });
    expect(sentEvents()[1]).toMatchObject({
      customType: { name: "Dough timelapse" },
    });
    expect(actions.saveProductionSteps).not.toHaveBeenCalled();
  });
});

describe("session with a suggested tool", () => {
  it("shows the tool, its intention and a pre-filled link", () => {
    render(
      <EventDialog
        target={{
          mode: "edit",
          event: {
            id: "e1",
            projectId: "p1",
            title: "Scripting: Sourdough",
            type: "SCRIPTING",
            status: "PLANNED",
            startAt: new Date(2030, 2, 5, 10, 0).toISOString(),
            endAt: new Date(2030, 2, 5, 11, 0).toISOString(),
            notes: null,
            toolAction: {
              toolId: "script-writer",
              intention: "Draft the voice-over",
              prompt: "Write a sourdough script",
            },
          },
        }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );
    const card = screen.getByTestId("tool-action");
    expect(card.textContent).toContain("Intention: Draft the voice-over");
    expect(card.textContent).toContain("“Write a sourdough script”");
    expect(
      within(card)
        .getByRole("link", { name: "Open script-writer" })
        .getAttribute("href"),
    ).toBe("/tools/script-writer?prompt=Write%20a%20sourdough%20script");
  });

  it("sessions without one show no card", () => {
    render(
      <EventDialog
        target={{ mode: "create", start: new Date(2030, 2, 5, 10, 0) }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("tool-action")).toBeNull();
  });
});
